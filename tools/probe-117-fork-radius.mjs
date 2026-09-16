#!/usr/bin/env node
// ACCEPTANCE — WHAT DOES FORKING THE TAKE-OFF RADIUS COST?
//
// TODO 117's decided topology (the reader rides the hour) has been refused
// twice at ALARM_TRACK_RMID, both times by measurement and both times on the
// same side of the feeler's arm: reversing the bias blade costs 83.61 mN
// against TODO 16's 5–50 mN detent envelope (probe-117-reversed-bias.mjs), and
// the position-space escape — a ring on the TRACK side of the arm — has 0.0133
// of room where it needs 0.5667. The line named the remaining move itself: the
// reader's RADIUS is what moves. That is a fork of line row 1, a spec quantity,
// and the fold rule says price the quantities the fork changes BEFORE cutting.
//
// This prices them. The fork's whole content is that the lever's input arm
// grows inboard (A = ALARM_FEELER_PIVOT_R − r), and four quantities read A:
// the beak's withdrawal, the bias blade's stiffness, the silence finger's
// force, and — through the withdrawal — the read-error budget that sets the
// journal. Two of those have bars.
//
// WHY THE BLADE IS THE QUESTION AND NOT THE WITHDRAWAL. The withdrawal falls
// inboard and its bar (clear the engagement by one margin) is generous. The
// blade's seating force is the one that sits inside an INHERITED envelope with
// 8.2 mN of headroom at the top, and an envelope is the one thing a fork may
// never move. So the row that decides the fork is the seat's, and the sign of
// its motion is the finding.
//
// WHICH PROBE THIS IS NOT. probe-117-line.mjs designs the take-off in a line
// and fixes r at ALARM_TRACK_RMID by choosing gain 1; it prices ONE radius.
// probe-117-takeoff.mjs maps where a ring fits in (r, z) and says nothing about
// force. probe-117-reversed-bias.mjs prices the OTHER escape — reversing the
// blade at the shipped radius — and refuses it. This one asks what the escape
// that survives actually costs.
//
// WHAT IT DELIBERATELY DOES NOT ANSWER. Whether a ring, a notch and a lever tip
// FIT at the forked radius is geometry over the built tree, not arithmetic over
// constants: the disc's hub, the reader's own journal and the lever's inboard
// jog all live there. That is the free-ring map's question, asked again at the
// new radius, and it is the next measurement — not this one. A probe that
// answered it from literals would be the fabricated-constant failure this item
// has already recorded once.

// --- layout.js, the movement's own constants -------------------------------
const UNIT_MM = 0.72 / 1.9;                 // CHAIN_PITCH_MM / CHAIN_PITCH
const CLEAR_MARGIN = 0.15;                  // the ONE margin
const SPRING_FLAT_U = 0.05 / UNIT_MM;       // spring flat stock
const STEEL_E_PA = 200e9;                   // the one steel
const DETENT_MN = [5, 50];                  // SELECTOR_DETENT_WINDOW_MN — TODO 16's envelope, INHERITED and never forkable
const PIVOT_FIT = 0.01;                     // the movement's stated running fit (probe-117-line.mjs row "journal length")

// --- main.js ---------------------------------------------------------------
const ALARM_PIN_DROP = 0.10;                // stop-banked travel
const ALARM_TRACK_RMID = 3.05;              // the REFERENCE take-off radius — line row 1
const ALARM_FEELER_PIVOT_R = 5.5;           // bracket lugs clear the rim's tips by one margin
const ALARM_PAWL_ENGAGE = 0.06;             // beak's reach into the contrate band
const ALARM_FEELER_SPR_FREE = 0.7;          // stud stands outboard of the pivot
const ALARM_FEELER_BEAR_FRAC = 0.45;        // ALARM_FEELER_BEAR_R = ARM_LEN * 0.45 — bearing inboard of the pin
const ALARM_SIL_FINGER_R = 5.86;            // the silence finger's radius
const ALARM_SIL_TAIL_ARM = ALARM_SIL_FINGER_R - ALARM_FEELER_PIVOT_R;
const PIVOT_TO_CLIMB = 10.427;              // |pivot → climb axis| — the withdrawal's lever arm, as probe-117-line.mjs cites it
const READER_CORRIDOR_U = 2.970;            // the axial room the reader's corridor offers a journal, at the SHIPPED radius

const SEAT_DROP = ALARM_PIN_DROP + CLEAR_MARGIN;   // ALARM_FEELER_SEAT_DROP — still pushing at the bank

const cantileverK_N_per_m = (a_u, c_u, L_u) => {
  const m = UNIT_MM / 1000;
  const I = (a_u * m) * Math.pow(c_u * m, 3) / 12;
  return 3 * STEEL_E_PA * I / Math.pow(L_u * m, 3);
};

// EVERYTHING the fork touches, as one function of the take-off radius. Written
// once so no row can quietly use a different arm than its neighbour.
function atRadius(r) {
  const arm = ALARM_FEELER_PIVOT_R - r;             // the forked quantity
  const bearR = arm * ALARM_FEELER_BEAR_FRAC;       // rides the arm, so the RATIO at the blade is invariant
  const bladeL = ALARM_FEELER_SPR_FREE + bearR;     // anchor → bear chord: the ONLY way the fork reaches the blade
  const kBlade = cantileverK_N_per_m(SPRING_FLAT_U, SPRING_FLAT_U, bladeL);
  // Force at the bear point for a given tip drop: the drop arrives at the blade
  // reduced by bearR/arm, which is ALARM_FEELER_BEAR_FRAC and does not move.
  const bladeF_mN = (drop) => kBlade * drop * ALARM_FEELER_BEAR_FRAC * UNIT_MM;  // N/m · u · (mm/u) = µN·… → mN
  const seatRiding = bladeF_mN(SEAT_DROP);
  const seatDropped = bladeF_mN(SEAT_DROP - ALARM_PIN_DROP);
  // The silence finger re-levers the blade's force change about the feeler
  // pivot onto the tail (main.js ALARM_SIL_FINGER_MN, same arithmetic).
  const silFinger = kBlade * ALARM_PIN_DROP * ALARM_FEELER_BEAR_FRAC * UNIT_MM * (bearR / ALARM_SIL_TAIL_ARM);
  const withdrawal = ALARM_PIN_DROP * PIVOT_TO_CLIMB / arm;
  const gain = withdrawal / ALARM_PIN_DROP;
  // False release is the hard bound: a spurious read of δ withdraws the beak by
  // δ·gain, and at ALARM_PAWL_ENGAGE the alarm has released with nothing under
  // the pin. The journal must be long enough that its slack cannot produce δ.
  const readBudget = ALARM_PAWL_ENGAGE / gain;
  const journal = 2 * PIVOT_FIT * r / readBudget;
  return { r, arm, bearR, bladeL, kBlade, seatRiding, seatDropped, silFinger, withdrawal, gain, readBudget, journal };
}

const WINDOW = [2.20, 2.40, 2.60, 2.80];            // the fork's candidate radii — inboard, where the arm is not overhead
const REF = atRadius(ALARM_TRACK_RMID);
const CLEAR_BAR = ALARM_PAWL_ENGAGE + CLEAR_MARGIN; // the beak must withdraw clear of its engagement by one margin

const rows = [];
const push = (what, ok, got, want) => rows.push({ what, ok, got, want });
const near = (a, b, tol = 1e-3) => Math.abs(a - b) <= tol;

// ROW 1 — the STRUCTURE of the fork's reach, which is why its sign is knowable
// rather than guessable. ALARM_FEELER_BEAR_R is defined as a FRACTION of the
// arm, so the bearing rides the fork and the lever ratio at the blade cannot
// move. The fork therefore reaches the blade through its free length alone.
{
  const refRatio = REF.bearR / REF.arm;
  const allSame = WINDOW.every((r) => near(atRadius(r).bearR / atRadius(r).arm, refRatio, 1e-12));
  push('the lever ratio AT THE BLADE is invariant under the fork', allSame,
    `bearR/arm = ${refRatio.toFixed(4)} at every candidate`, 'ALARM_FEELER_BEAR_R rides the arm');
  const lengthsGrow = WINDOW.every((r) => atRadius(r).bladeL > REF.bladeL);
  push('…so the fork reaches the blade only through its FREE LENGTH, which grows inboard',
    lengthsGrow, `${REF.bladeL.toFixed(4)} → ${atRadius(WINDOW[0]).bladeL.toFixed(4)}`, 'longer blade');
  const softens = WINDOW.every((r) => atRadius(r).kBlade < REF.kBlade);
  push('…and k ∝ 1/L³, so the fork SOFTENS the blade — it moves AWAY from the ceiling',
    softens, `${REF.kBlade.toFixed(1)} → ${atRadius(WINDOW[0]).kBlade.toFixed(1)} N/m`, 'falling');
}

// ROW 2 — THE ENVELOPE, which is the row the fork lives or dies on.
for (const r of WINDOW) {
  const f = atRadius(r);
  push(`r ${r.toFixed(2)}: the seat stays inside the detent envelope`,
    f.seatDropped >= DETENT_MN[0] && f.seatRiding <= DETENT_MN[1],
    `${f.seatDropped.toFixed(2)} … ${f.seatRiding.toFixed(2)} mN`, `inside ${DETENT_MN[0]}–${DETENT_MN[1]}`);
}

// ROW 3 — the withdrawal, which falls inboard and must still clear.
for (const r of WINDOW) {
  const f = atRadius(r);
  push(`r ${r.toFixed(2)}: the beak still withdraws clear of its engagement by one margin`,
    f.withdrawal >= CLEAR_BAR, `${f.withdrawal.toFixed(4)}`, `≥ ${CLEAR_BAR.toFixed(4)}`);
}

// ROW 4 — where the 5 mN FLOOR would bind, since the fork walks towards it.
// Solved rather than sampled: seatDropped(r) = DETENT_MN[0].
{
  let lo = 0.01, hi = ALARM_TRACK_RMID;
  for (let i = 0; i < 200; i++) {
    const mid = (lo + hi) / 2;
    if (atRadius(mid).seatDropped < DETENT_MN[0]) lo = mid; else hi = mid;
  }
  const rFloor = (lo + hi) / 2;
  push('the envelope\'s FLOOR binds far inboard of anything the fork wants',
    rFloor < Math.min(...WINDOW) - 1, `the seat reaches ${DETENT_MN[0]} mN only at r ${rFloor.toFixed(3)}`,
    `well inboard of r ${Math.min(...WINDOW).toFixed(2)}`);
}

// ROW 5 — the JOURNAL, which the fork shortens twice over: a smaller radius
// carries a smaller read error for the same tilt, and a looser budget tolerates
// more of it. The line had to take the disc's bore to afford 4.327; report
// where the fork would not need to.
{
  let lo = 0.01, hi = ALARM_TRACK_RMID;
  for (let i = 0; i < 200; i++) {
    const mid = (lo + hi) / 2;
    if (atRadius(mid).journal < READER_CORRIDOR_U) lo = mid; else hi = mid;
  }
  const rFit = (lo + hi) / 2;
  push('the fork SHORTENS the journal, and inboard of one radius it fits the shipped corridor',
    atRadius(Math.min(...WINDOW)).journal < READER_CORRIDOR_U,
    `${REF.journal.toFixed(3)} at r ${ALARM_TRACK_RMID} → ${atRadius(Math.min(...WINDOW)).journal.toFixed(3)} at r ${Math.min(...WINDOW).toFixed(2)}; fits under ${READER_CORRIDOR_U} from r ${rFit.toFixed(3)} inboard`,
    'reported — the corridor\'s depth at the forked radius is NOT measured here');
}

// ROW 6 — REFERENCE, not a control: at the shipped radius this arithmetic must
// reproduce probe-117-line.mjs's published figures, or one of the two probes is
// describing a different lever. (The withdrawal is definitional — PIVOT_TO_CLIMB
// is quoted from that probe — so it is the SEAT and the JOURNAL that carry the
// agreement, and they come by an independent path.)
push('REFERENCE the shipped radius reproduces the line\'s published seat',
  near(REF.seatDropped, 25.08, 0.02) && near(REF.seatRiding, 41.80, 0.02),
  `${REF.seatDropped.toFixed(2)} … ${REF.seatRiding.toFixed(2)} mN`, '25.08 … 41.80 mN');
push('REFERENCE the shipped radius reproduces the line\'s published journal',
  near(REF.journal, 4.327, 0.002), `${REF.journal.toFixed(3)}`, '4.327');

// CONTROLS — must-fail rows, so the bars above are known to be able to say no.
{
  const bad = atRadius(4.00);   // OUTBOARD: a shorter arm stiffens the blade
  push('CONTROL an OUTBOARD take-off blows the detent envelope, so the envelope row can say no',
    bad.seatRiding > DETENT_MN[1], `r 4.00 seats at ${bad.seatRiding.toFixed(2)} mN`, `> ${DETENT_MN[1]}`);
  const tiny = atRadius(0.50);  // absurdly inboard: the arm swallows the withdrawal
  push('CONTROL a take-off at the centre starves the withdrawal, so that row can say no',
    tiny.withdrawal < CLEAR_BAR, `r 0.50 withdraws ${tiny.withdrawal.toFixed(4)}`, `< ${CLEAR_BAR.toFixed(4)}`);
  const spread = REF.seatRiding - atRadius(WINDOW[0]).seatRiding;
  push('CONTROL the seat actually MOVES across the window — the rows are not comparing a quantity with itself',
    Math.abs(spread) > 1, `${spread.toFixed(2)} mN between r ${WINDOW[0]} and r ${ALARM_TRACK_RMID}`, '> 1 mN');
}

// --- report ----------------------------------------------------------------
let bad = 0;
console.log('\n  PRICING THE TAKE-OFF RADIUS FORK (TODO 117)\n');
for (const r of rows) {
  if (!r.ok) bad++;
  console.log(`  ${r.ok ? 'ok  ' : 'FAIL'} ${r.what}`);
  console.log(`       got ${r.got}   want ${r.want}`);
}

console.log('\n  THE FORK, ROW BY ROW (r 3.05 is the line\'s own reference)\n');
console.log('     r      arm   blade L    k N/m    seat mN (dropped…riding)   withdrawal   silence mN   budget    journal');
for (const r of [...WINDOW, ALARM_TRACK_RMID].sort((a, b) => a - b)) {
  const f = atRadius(r);
  const mark = near(r, ALARM_TRACK_RMID, 1e-9) ? ' ←ref' : '';
  console.log(`  ${f.r.toFixed(2).padStart(5)}  ${f.arm.toFixed(3).padStart(6)}  ${f.bladeL.toFixed(4).padStart(7)}  ${f.kBlade.toFixed(1).padStart(7)}      ${f.seatDropped.toFixed(2).padStart(6)} … ${f.seatRiding.toFixed(2).padStart(6)}       ${f.withdrawal.toFixed(4)}      ${f.silFinger.toFixed(2).padStart(6)}   ${f.readBudget.toFixed(5)}    ${f.journal.toFixed(3).padStart(6)}${mark}`);
}
console.log(`\n  The silence finger's force is REPORTED, not gated: its transfer row declares a`);
console.log(`  'load' and no 'envelope', so nothing in the battery holds it. It falls with the`);
console.log(`  fork (${REF.silFinger.toFixed(2)} → ${atRadius(WINDOW[0]).silFinger.toFixed(2)} mN), which is the same direction as the seat and for the same reason.`);
console.log(`\n  ${rows.length} rows, ${bad} failing\n`);
process.exit(bad ? 1 : 0);
