// §106 — THE GENEVA LINE SPEC, derived in the straight chain before any fold.
//
// This exists because the filed siting is built on an INVERTED Geneva
// relation, and every radius downstream of it inherits the inversion. The
// entry states `a = d·cos(π/N)` for the finger's pin circle and
// `b = d·sin(π/N)` for the cross, then computes d = b/sin(π/8) = 3.536,
// a = 3.266, b = 1.353. Those three satisfy a² + b² = d² — which is why it
// looked right — but a²+b²=d² is only the RIGHT-ANGLE half of the condition
// and says nothing about the index angle.
//
// The angle is the other half. At entry the pin's velocity is perpendicular
// to the crank, and it must lie along the slot, which is radial on the
// cross; so the right angle is AT THE PIN, and the angle at the CROSS'S
// centre is β = π/N — half the 2π/N index the cross turns per engagement.
// In that triangle the crank radius `a` is the side OPPOSITE β. Therefore
//
//     a = d·sin(π/N)      (the driver's pin circle — the SMALL one)
//     b = d·cos(π/N)      (the cross's slot-tip radius — the LARGE one)
//
// which is the reverse of the filing. The controls below are the check that
// this is the textbook relation and not another plausible-looking algebra:
// a 4-slot Geneva must come out with crank radius EQUAL to wheel radius, and
// a 6-slot with 0.500 d and 0.866 d. Both are published constants of the
// device, so a derivation that misses them is wrong no matter how tidy.
//
// What the inversion costs, if built as filed: asin(a/d) = 67.5°, an index
// of 135°, and 360/135 = 2.667 STATIONS. The cross cannot have 8 slots — it
// cannot have an integer number of slots at all — so the 56-click landing
// the whole entry is built to hold does not survive its own geometry.
//
// Repairing it keeps b at its floor (the slot-pitch requirement, which is
// sound and independent of the Geneva relation) and re-derives d and a from
// the CORRECT angle. The assembly gets SMALLER, so §106's az-12° siting
// survives with more slack than it was accepted with, not less.
//
// Run: node tools/probe-106-geneva.mjs
const UNIT_MM = 0.379;                 // layout.js — mm per unit
const STOCK_MIN_U = 0.12 / UNIT_MM;    // §50 section floor, 0.317
const PIVOT_MIN_U = 0.07 / UNIT_MM;    // §50 pivot floor, 0.185
const CLEAR_MARGIN = 0.15;             // the ONE clearance margin (rule 1)

const R = (x, n = 3) => Number(x.toFixed(n));
const deg = (r) => (r * 180) / Math.PI;

// ---------------------------------------------------------------------------
// 0. The control: does this relation reproduce the device's published pairs?
// ---------------------------------------------------------------------------
console.log('--- control: the textbook Geneva pairs, at d = 1 ---');
for (const [N, want] of [[4, 'a = b'], [6, 'a = 0.500, b = 0.866']]) {
  const b = Math.PI / N;
  console.log(`  N=${N}  a = sin(π/N) = ${R(Math.sin(b), 4)}   b = cos(π/N) = ${R(Math.cos(b), 4)}   (published: ${want})`);
}

// ---------------------------------------------------------------------------
// 1. The count. Fixed by the travel, not chosen.
// ---------------------------------------------------------------------------
const ARBOR_TURNS = 1.75;        // ALARM_BARREL_TURNS — the barrel's full wind
const ARBOR_W = 44;              // ALARM_WIND_W, the arbor wheel
const PINION_T = 11;             // the dedicated pinion; 1.75·44 = 77 = 7·11
const RATCHET_N = 32;            // ALARM_RATCHET_N — clicks per arbor turn
const travel = (ARBOR_TURNS * ARBOR_W) / PINION_T;   // driver turns
const N = travel + 1;            // (N−1)/m driver turns at m = 1 pin
const PINS = 1;
const clicks = ARBOR_TURNS * RATCHET_N;
console.log('\n--- the count ---');
console.log(`  travel        ${R(travel)} driver turns   (${ARBOR_TURNS} arbor turns × ${ARBOR_W}/${PINION_T})`);
console.log(`  stations      N = ${N} at m = ${PINS} pin   → (N−1)/m = ${R((N - 1) / PINS)}`);
console.log(`  landing       ${clicks} clicks   integer: ${Number.isInteger(clicks)}`);

// ---------------------------------------------------------------------------
// 2. The cross's size. Its rim pitch must carry a slot and two walls.
//    This floor is independent of the Geneva relation — the filing's own
//    derivation of it stands, and it is the one number carried across.
// ---------------------------------------------------------------------------
const beta = Math.PI / N;
const slotW = 2 * PIVOT_MIN_U + 0.06;          // pin ⌀ at the pivot floor + running clearance
const pitchMin = slotW + 2 * STOCK_MIN_U;      // slot + a wall each side, at the §50 floor
const bFloor = (pitchMin * N) / (2 * Math.PI); // 2πb/N ≥ pitchMin
console.log('\n--- the cross, from its own slots ---');
console.log(`  slot width    ${R(slotW)}   = 2·PIVOT_MIN_U + 0.06`);
console.log(`  rim pitch     ${R(pitchMin)} floor   = slot + 2·STOCK_MIN_U`);
console.log(`  b (slot tip)  ${R(bFloor)}   = pitchMin·N/2π`);

// ---------------------------------------------------------------------------
// 3. The relation, both ways, so the inversion is visible rather than argued.
// ---------------------------------------------------------------------------
const STUD_R = PIVOT_MIN_U + 0.01 + STOCK_MIN_U;   // the cross's stud: bore + running clearance + floor wall
const hubR = STUD_R + STOCK_MIN_U;  // the cross's own hub, floor wall over its stud

const spec = (label, d, a, b) => {
  const idx = 2 * Math.asin(a / d);
  console.log(`  ${label}`);
  console.log(`     d ${R(d)}   a ${R(a)}   b ${R(b)}`);
  console.log(`     a²+b²−d² = ${(a * a + b * b - d * d).toExponential(2)}   (right angle at the pin)`);
  console.log(`     index    = 2·asin(a/d) = ${R(deg(idx), 2)}°  → N = ${R(360 / deg(idx), 3)} stations`);
  return 360 / deg(idx);
};
console.log('\n--- the relation ---');
const nFiled = spec('AS FILED   a = d·cos β, b = d·sin β, d = b/sin β:',
  bFloor / Math.sin(beta), (bFloor / Math.sin(beta)) * Math.cos(beta), bFloor);
// ---------------------------------------------------------------------------
// 4. TWO FLOORS SET d, AND THE RIM PITCH IS NOT THE BINDING ONE.
//
// The filing derives the cross from its rim pitch alone. But the slots are
// cut inward from the rim to where the pin bottoms (d − a), and what holds
// the arms onto the hub is the WEB between the hub's outer edge and those
// slot bottoms. At the rim-pitch floor that web measures 0.076 — under the
// §50 section floor, i.e. the cross's arms are nearly severed at the root
// by its own slots. So the web is a second floor on d, and it binds first:
//
//     web:   d − a − hub ≥ STOCK_MIN_U,  a = d·sin β
//            → d ≥ (hub + STOCK_MIN_U) / (1 − sin β)
//
// d is the larger of the two, which is the whole point of writing both.
// ---------------------------------------------------------------------------
const dFromPitch = bFloor / Math.cos(beta);
const dFromWeb = (hubR + STOCK_MIN_U) / (1 - Math.sin(beta));
const D = Math.max(dFromPitch, dFromWeb);
const A = D * Math.sin(beta);
const B = D * Math.cos(beta);
console.log('\n--- the two floors on d ---');
console.log(`  from the rim pitch  d ≥ ${R(dFromPitch)}   (b at its slot-pitch floor)`);
console.log(`  from the arm web    d ≥ ${R(dFromWeb)}   (d − a − hub ≥ STOCK_MIN_U)`);
console.log(`  binding: ${dFromWeb > dFromPitch ? 'THE WEB' : 'the rim pitch'}   → d = ${R(D)}`);
const nDer = spec('DERIVED    a = d·sin β, b = d·cos β, at that d:', D, A, B);

const slotInner = D - A;            // the pin's closest approach to the cross centre
const slotDepth = B - slotInner;
console.log('\n--- the cross as matter ---');
console.log(`  b (slot tip)  ${R(B)}   rim pitch ${R((2 * Math.PI * B) / N)} vs floor ${R(pitchMin)}`);
console.log(`  slot inner r  ${R(slotInner)}   = d − a, where the pin bottoms`);
console.log(`  slot depth    ${R(slotDepth)}   = b − (d − a)`);
console.log(`  hub r         ${R(hubR)}   = stud ${R(STUD_R)} + STOCK_MIN_U`);
console.log(`  arm web       ${R(slotInner - hubR)}   vs the §50 floor ${R(STOCK_MIN_U)}`);

// The finger's locking disc: it fills the cross's hollows while the cross is
// locked, so its radius is bounded ABOVE by the cross keeping material at the
// hollow's deepest point, and BELOW by the arbor it is keyed to.
const rodR = 0.45;                                  // the idler-stud stock this corner already uses
const lockLo = rodR;
// Two ceilings: the hollow must leave the cross metal at its deepest point,
// and the pin must stand at or outside the disc's rim or it cannot present
// itself to a slot mouth.
const lockHi = Math.min(D - hubR, A);
console.log('\n--- the finger ---');
console.log(`  pin circle a  ${R(A)}   = d·sin β`);
console.log(`  locking disc  ρ ∈ [${R(lockLo)}, ${R(lockHi)}]   ≥ the arbor it carries; ≤ min(d − hub, a)`);
console.log(`     d − hub = ${R(D - hubR)} (the hollow leaves metal) · a = ${R(A)} (the pin stands proud)`);
console.log(`  feasible: ${lockHi > lockLo}`);

// ---------------------------------------------------------------------------
// 5. What the fold has to find room for, against §106's measured free disc.
// ---------------------------------------------------------------------------
const FREE_AT_AZ12 = 8.067;         // probe-106-stud.mjs, BAND=wheel, az 12°
const pinSweep = A + PIVOT_MIN_U + CLEAR_MARGIN;
const assembly = D + B + CLEAR_MARGIN;
console.log('\n--- the reach, against the sited station ---');
console.log(`  pin sweep     ${R(pinSweep)}   (filed: 3.601)`);
console.log(`  whole assembly ${R(assembly)}   (filed: 5.355)`);
console.log(`  free disc at az 12°: ${FREE_AT_AZ12}   → slack ${R(FREE_AT_AZ12 - assembly)}   fits: ${assembly < FREE_AT_AZ12}`);

console.log('\n--- what changed, and what did not ---');
console.log(`  count, travel, the ${clicks}-click landing   UNCHANGED — the ratio was never the defect`);
console.log(`  b   ${R(bFloor)} → ${R(B)}     re-floored by the arm web, not the rim pitch`);
console.log(`  d   ${R(bFloor / Math.sin(beta))} → ${R(D)}     a   ${R((bFloor / Math.sin(beta)) * Math.cos(beta))} → ${R(A)}`);
console.log(`  stations as filed ${R(nFiled, 3)} → derived ${R(nDer, 3)}`);
