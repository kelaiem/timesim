#!/usr/bin/env node
// ACCEPTANCE — WHAT DOES REVERSING THE FEELER'S BIAS BLADE COST?
//
// TODO 117's line (probe-117-line.mjs) prices the collar's force path in its
// ROW 4, and that row rests on one sentence: "the release lever's existing bias
// blade already seats the pin, and moving the contact from the track to the
// ring's face only makes that force path ONE MEMBER LONGER." That is a SERIES
// claim — blade pushes lever pushes ring pushes pin onto the track, everything
// in the same direction, and the only cost is the compliance a member in series
// robs from the seat (0.82%, comfortably inside its 5% bar).
//
// THE SERIES CLAIM DEPENDS ON WHICH SIDE OF THE RING THE LEVER SITS, and the
// line never had to ask because it was designing in free space. The folded z
// stack answers it, and the answer is the other one: the lever's arm lies
// between the ring and the track, so a lever biased onto the ring's underside
// pushes the ring AWAY from the track. The path is not longer, it is OPPOSED.
//
// This prices that. It is an ACCEPTANCE test because each row is a claim that
// should hold from now on — if a later fold moves the ring to the far side of
// the arm, these rows are how you find out the conflict has gone.
//
// WHICH PROBE THIS IS NOT. probe-117-line.mjs designs the take-off in a
// straight line and prices it there; it cannot see a stacking order because a
// line has none. probe-117-takeoff.mjs maps the free (r, z) annulus and says
// where a ring FITS, never which way a force runs through it. This one asks the
// single question both leave open.
const UNIT_MM = 0.72 / 1.9;                 // layout.js — CHAIN_PITCH_MM / CHAIN_PITCH
const CLEAR_MARGIN = 0.15;                  // layout.js — the ONE margin
const SPRING_FLAT_U = 0.05 / UNIT_MM;       // layout.js — spring flat stock
const STEEL_E_PA = 200e9;                   // layout.js — the one steel
const DETENT_MN = [5, 50];                  // layout.js SELECTOR_DETENT_WINDOW_MN — TODO 16's envelope, INHERITED and never forkable
const ALARM_PIN_DROP = 0.10;                // main.js
const ALARM_TRACK_RMID = 3.05;              // main.js
const ALARM_FEELER_PIVOT_R = 5.5;           // main.js
const ALARM_FEELER_ARM_LEN = ALARM_FEELER_PIVOT_R - ALARM_TRACK_RMID;
const ALARM_FEELER_BEAR_R = ALARM_FEELER_ARM_LEN * 0.45;
const ALARM_FEELER_SPR_FREE = 0.7;          // main.js — stud outboard of the pivot
const ALARM_FEELER_SEAT_DROP = ALARM_PIN_DROP + CLEAR_MARGIN;  // main.js

// MEASURED off the built tree in this session, not assumed (world z):
const Z = { trackTop: -5.38, feelerArm: -5.86, ring: -6.3722, dialBack: -8.35 };

const cantileverK_N_per_m = (a_u, c_u, L_u) => {
  const m = UNIT_MM / 1000;
  const I = (a_u * m) * Math.pow(c_u * m, 3) / 12;
  return 3 * STEEL_E_PA * I / Math.pow(L_u * m, 3);
};
const rows = [];
const push = (what, ok, got, want) => { rows.push({ what, ok, got, want }); };

// ROW 1 — the stacking order, which is the whole finding.
// "Toward the dial" is MORE NEGATIVE world z (the dial's back face is the most
// negative member of the stack), so the ring being more negative than the arm
// means the ring is on the DIAL side and the arm is on the TRACK side.
const ringIsDialSideOfArm = Z.ring < Z.feelerArm;
push('the ring sits on the DIAL side of the lever\'s arm', ringIsDialSideOfArm,
  `ring ${Z.ring}, arm ${Z.feelerArm}`, 'ring more negative');
push('…so the lever must reach TOWARD the dial to touch it, reversing its bias',
  ringIsDialSideOfArm, 'bias must press the arm dial-ward', 'the opposite of today\'s "down onto the disc"');
// And the reader's pin, standing from the ring to the track, must cross the arm.
push('the reader\'s pin CROSSES the arm\'s plane to reach the track',
  Z.ring < Z.feelerArm && Z.feelerArm < Z.trackTop,
  `${Z.ring} → ${Z.trackTop} passes ${Z.feelerArm}`, 'the arm lies between them');

// ROW 2 — the force the blade supplies today, which is what must be replaced.
const kBlade = cantileverK_N_per_m(SPRING_FLAT_U, SPRING_FLAT_U, ALARM_FEELER_SPR_FREE + ALARM_FEELER_BEAR_R);
const bladeF_mN = (drop) => kBlade * drop * (ALARM_FEELER_BEAR_R / ALARM_FEELER_ARM_LEN) * (UNIT_MM / 1000) * 1000;
const seatRiding = bladeF_mN(ALARM_FEELER_SEAT_DROP);
const seatDropped = bladeF_mN(ALARM_FEELER_SEAT_DROP - ALARM_PIN_DROP);
push('the blade\'s seating force is the line\'s own figure',
  seatDropped >= DETENT_MN[0] && seatRiding <= DETENT_MN[1],
  `${seatDropped.toFixed(2)} … ${seatRiding.toFixed(2)} mN`, `inside ${DETENT_MN[0]}–${DETENT_MN[1]}`);

// ROW 3 — what the ring's own spring must now supply.
// Reversed, the blade no longer seats the reader: it OPPOSES the seat through
// the ring. So the ring needs a return of its own, and that return must both
// seat the pin AND overcome the blade.
const ringMustSupply_mN = seatRiding + seatRiding;   // its own seat + the blade it now fights
const kRing_N_per_m = (ringMustSupply_mN / 1000) / (ALARM_FEELER_SEAT_DROP * UNIT_MM / 1000);
// The line CAPPED a ring return at 5% of the blade, because there it was an
// optional compliance added to a seat the blade supplied. Reversed it is the
// seat, so the cap and the requirement are the same number read two ways.
const kRingCap = 0.05 * kBlade;
push('the ring\'s required return EXCEEDS the line\'s cap on it',
  kRing_N_per_m > kRingCap,
  `needs ${kRing_N_per_m.toFixed(1)} N/m, capped at ${kRingCap.toFixed(1)}`,
  'the requirement and the cap contradict');
push('…and by how much is the price', true,
  `${(kRing_N_per_m / kRingCap).toFixed(1)}× over the cap`, 'reported');

// ROW 4 — the envelope, which is inherited and NEVER forkable (the fold rule).
// Net seating at the track is the ring's spring less the blade opposing it, but
// the LOAD THE BEARING CARRIES is the sum, and it is the sum the envelope sees.
push('the opposed pair\'s total load leaves the detent envelope',
  ringMustSupply_mN > DETENT_MN[1],
  `${ringMustSupply_mN.toFixed(2)} mN`, `≤ ${DETENT_MN[1]} mN`);

// CONTROLS — the rows above are only meaningful if the arithmetic can say no.
push('CONTROL a ring on the TRACK side of the arm needs no reversal at all',
  !(Z.trackTop < Z.feelerArm), 'series, as the line assumed', 'the conflict is stack-order dependent');
push('CONTROL the blade alone sits INSIDE the envelope, so the excess is the second spring\'s',
  seatRiding <= DETENT_MN[1], `${seatRiding.toFixed(2)} mN`, `≤ ${DETENT_MN[1]}`);

let bad = 0;
console.log('\n  PRICING THE BIAS BLADE\'S REVERSAL (TODO 117)\n');
for (const r of rows) {
  if (!r.ok) bad++;
  console.log(`  ${r.ok ? 'ok  ' : 'FAIL'} ${r.what}`);
  console.log(`       got ${r.got}   want ${r.want}`);
}
console.log(`\n  kBlade ${kBlade.toFixed(1)} N/m · seat ${seatDropped.toFixed(2)}–${seatRiding.toFixed(2)} mN · ring needs ${kRing_N_per_m.toFixed(1)} N/m against a ${kRingCap.toFixed(1)} cap`);
console.log(`\n  ${rows.length} rows, ${bad} failing\n`);
// An acceptance test that cannot exit non-zero is a report wearing the wrong
// label — the split index-instruments.mjs records is read to decide how much a
// clean run is worth.
process.exit(bad ? 1 : 0);
