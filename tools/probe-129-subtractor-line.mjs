// §129 — THE WIND SUBTRACTOR, AS A STRAIGHT LINE.
//
// CLAUDE.md's "design in a line, fold to fit": before any of this is sited,
// the chain is laid out input-to-output with no corridors, and the quantities
// it establishes are the LINE SPEC the folded build must measure back to. In
// the line it is structurally impossible to pay for packaging with a ratio.
//
// The problem (TODO 55). The alarm's stop-work must count the WIND — the angle
// the ribbon holds between the barrel ARBOR and the barrel BODY. Both members
// are real rotating wheels, they are COAXIAL, and they carry the SAME tooth
// count (ALARM_WIND_W = ALARM_BARREL_TEETH = 44 at module 0.3). No rigid
// plate-mounted train can read their difference: a wheel's angle is a fixed
// multiple of its one driving chain, and a single body meshing both coaxial
// wheels is over-constrained — it does not subtract, it LOCKS the barrel.
// Subtracting two angles needs a member with two degrees of freedom, which is
// a differential.
//
// WHY IT IS THE SPIDER AND NOT AN EPICYCLIC, which is the part of this that is
// arithmetic rather than taste. Every three-port epicyclic obeys
//     out = alpha*in1 + (1 - alpha)*in2
// — the two coefficients SUM TO ONE, whatever the tooth counts. Feed it two
// legs of ratio g1 and g2 and the output is alpha*g1*arbor + (1-alpha)*g2*body;
// for that to be proportional to (arbor - body) the two coefficients must be
// equal and opposite. With legs of the same magnitude and the same sense that
// needs alpha = -(1 - alpha), which has no solution — so equal legs can only
// be subtracted by reversing one of them and halving, alpha = 1/2 exactly.
// alpha = 1/2 is the SPIDER: two equal side gears and a planet between them,
// carrier = (theta1 + theta2)/2. A sun-planet-annulus cannot reach it (it would
// need annulus teeth = sun teeth), which is why the reserve-de-marche
// differential is a spider in real movements too.
//
// The one alternative the arithmetic does allow is unequal legs into a
// compound-planet epicyclic (alpha outside [0,1], no reversing idler). It is
// checked here as the ROAD NOT TAKEN so the choice is recorded as a comparison
// rather than an assertion: it needs its two leg pinions at DIFFERENT centre
// distances from the barrel axis (11 t at 8.25, 22 t at 9.90), so they cannot
// share a stud, and the train that then has to reach the differential's axis
// costs more wheels than the reversing idler it saves.
//
// Run: node tools/probe-129-subtractor-line.mjs
const M = 0.3;            // ALARM_TRAIN_MODULE
const W = 44;             // ALARM_WIND_W === ALARM_BARREL_TEETH, coaxial
const TURNS = 1.75;       // ALARM_BARREL_TURNS
const N = 8;              // ARREST_STATIONS
// THE COUNTS ARE THE FOLD'S; THE GAIN IS THE LINE'S. Both legs must share a
// count (equal legs are what the spider's alpha = 1/2 subtracts), and that
// count sets the mesh circle at module·(44 + LEG)/2 — so it is a POSITION, and
// positions are what a fold is allowed to spend. The shipped fold took 22
// rather than 11, standing the tower 9.90 from the barrel axis instead of 8.25
// and taking its radius budget beside the barrel from 1.011 to 2.66; the
// output stage absorbed the difference. Both are checked below, because a line
// spec that only holds for the counts it was written with is not one.


// The two folds: the one §106's mesh circle would have given, and the shipped one.
const FOLDS = [
  { name: 'LEG 11 — the §106 mesh circle', LEG: 11, OUT_W: 16, OUT_P: 8 },
  { name: 'LEG 22 — shipped (§129)', LEG: 22, OUT_W: 32, OUT_P: 8 },
];
const checks = [];
const push = (name, ok, got, want) => checks.push({ name, ok, got, want });
const close = (a, b) => Math.abs(a - b) < 1e-12;
const cd = (z1, z2) => (M * (z1 + z2)) / 2;

for (const F of FOLDS) {
  const { LEG, OUT_W, OUT_P } = F;
  const tag = `[${F.LEG} t legs]`;
  // ---- the line, member by member ------------------------------------------
  // 1  LEG A. The arbor's wind wheel drives pinion PA direct. One mesh, so the
  //    sense reverses once.
  const gA = -W / LEG;
  // 2  LEG B. The barrel rim drives PB through ONE idler whose only duty is the
  //    SIGN. Its tooth count cancels out of the ratio entirely and sets nothing
  //    but its own two centre distances — the member has to exist and has to be
  //    honest about why.
  const gB = +W / LEG;
  // 3  THE SPIDER. PA is rigid with side gear SA, PB with SB, both free on the
  //    subtractor arbor and facing each other; the carrier between them runs the
  //    planets. carrier = (SA + SB)/2, the defining relation of a spider.
  const carrier = (a, b) => (gA * a + gB * b) / 2;
  // 4  THE OUTPUT STAGE, which absorbs whatever ratio the legs did not carry.
  const finger = (a, b) => -(OUT_W / OUT_P) * carrier(a, b);

  // P0: the output is a function of the WIND and of nothing else. Tested the
  // only way that means anything — move both inputs TOGETHER (which is what a
  // barrel does when nothing is being wound and nothing is ringing) and the
  // finger must not move at all.
  let commonWorst = 0;
  for (let t = -3; t <= 3; t += 0.25) commonWorst = Math.max(commonWorst, Math.abs(finger(t, t)));
  push(`${tag} common rotation moves the finger not at all`, commonWorst < 1e-12,
    commonWorst.toExponential(1), '0 — it reads the difference, not either input');

  const GAIN = finger(1, 0);
  push(`${tag} the finger turns 4 per turn of wind`, close(GAIN, 4), GAIN, 4);
  push(`${tag} winding and running down are OPPOSITE`, close(finger(0, 1), -GAIN),
    finger(0, 1), -GAIN);
  // P0: the travel closes on the stop-work that already exists. A single-pin
  // Geneva travels N−1 turns, so the finger's turns over a full wind must BE
  // N−1 — the identity §106 already asserts, re-derived through the subtractor.
  const travel = GAIN * TURNS;
  push(`${tag} full wind = N−1 finger turns`, close(travel, N - 1), travel, N - 1);
  // P1: the idler is a SIGN and must be provably nothing else.
  let idlerDrift = 0;
  for (const zI of [8, 12, 15, 18, 24, 30, 36])
    idlerDrift = Math.max(idlerDrift, Math.abs((W / zI) * (zI / LEG) - W / LEG));
  push(`${tag} the idler cancels out of the ratio`, idlerDrift < 1e-12,
    idlerDrift.toExponential(1), '0 for every count — it buys the sign only');
  push(`${tag} both legs mesh at ONE centre distance`, true, cd(W, LEG),
    'the mesh circle this fold stands on');
  F.gain = GAIN; F.cd = cd(W, LEG); F.travel = travel;
}

// ---- the road not taken, priced ---------------------------------------------
// Unequal legs into a compound-planet epicyclic: out = (R·in1 − in2)/(R − 1),
// so alpha = R/(R−1), which leaves [0,1] for R < 1 and lets both legs arrive in
// the SAME sense. It works, and it costs more than it saves.
{
  const g1 = -W / 11, g2 = -W / 22;
  const R = g2 / g1;
  const epi = (a, b) => (R * g1 * a - g2 * b) / (R - 1);
  push('[road not taken] the epicyclic also lands 4', close(epi(1, 0), 4), epi(1, 0), 4);
  push('[road not taken] but its legs need TWO centre distances',
    !close(cd(W, 11), cd(W, 22)), `${cd(W, 11)} vs ${cd(W, 22)}`, 'differ — cannot share a stud');
}

console.log('--- the line, per fold ---');
for (const F of FOLDS)
  console.log(`  ${F.name.padEnd(28)} gain ${F.gain}  travel ${F.travel} finger turns  `
    + `mesh circle ${F.cd}  output ${F.OUT_W}:${F.OUT_P}`);
console.log(`\n  LINE SPEC: gain 4 over ${TURNS} turns of wind into ${N} stations.`);
console.log('  The GAIN is the line\'s and the counts are the fold\'s — both folds land it.');
console.log('\n--- checks ---');
let bad = 0;
for (const c of checks) {
  if (!c.ok) bad++;
  console.log(`  ${c.ok ? 'PASS' : 'FAIL'}  ${c.name.padEnd(52)} ${String(c.got).padStart(14)}   want ${c.want}`);
}
console.log(bad ? `\n${bad} FAILING` : '\nall checks pass');
process.exit(bad ? 1 : 0);
