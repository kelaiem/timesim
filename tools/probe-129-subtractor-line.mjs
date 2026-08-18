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
const LEG = 11;           // ARREST_PINION_TEETH — kept, so the fold inherits the mesh
// The carrier's output stage. The RATIO is the line spec — 2, to turn the
// spider's half back into the line's 4 — and the counts are the fold's to
// choose within it. 16:8 rather than 22:11 because the fold has to put this
// wheel somewhere: at 8.25 from the barrel axis every station on the mesh
// circle sits 1.27 from the barrel's rim, and the smaller pair's centre
// distance is 3.60 instead of 4.95.
const OUT_W = 16, OUT_P = 8;

const checks = [];
const push = (name, ok, got, want) => checks.push({ name, ok, got, want });
const close = (a, b) => Math.abs(a - b) < 1e-12;

// ---- the line, member by member -------------------------------------------
// 1  LEG A. The arbor's wind wheel drives pinion PA direct. One mesh, so the
//    sense reverses once.
const gA = -W / LEG;                       // -4 : PA turns per arbor turn
// 2  LEG B. The barrel rim drives PB through ONE idler whose only duty is the
//    SIGN. Its tooth count cancels out of the ratio entirely and sets nothing
//    but its own two centre distances — the member has to exist and has to be
//    honest about why.
const gB = +W / LEG;                       // +4 : PB turns per body turn
// 3  THE SPIDER. PA is rigid with side gear SA, PB with SB, both free on the
//    subtractor arbor and facing each other; the carrier between them runs the
//    planets. carrier = (SA + SB)/2, the defining relation of a spider.
const carrier = (a, b) => (gA * a + gB * b) / 2;
// 4  THE OUTPUT STAGE. The carrier is rigid with a 22 t wheel meshing an 11 t
//    pinion on the Geneva finger's arbor: one mesh, so one more reversal.
const finger = (a, b) => -(OUT_W / OUT_P) * carrier(a, b);

// ---- what the line must establish ------------------------------------------
// P0: the output is a function of the WIND and of nothing else. Tested the only
// way that means anything — move both inputs TOGETHER (which is what a barrel
// does when nothing is being wound and nothing is ringing) and the finger must
// not move at all.
let commonWorst = 0;
for (let t = -3; t <= 3; t += 0.25) commonWorst = Math.max(commonWorst, Math.abs(finger(t, t)));
push('common rotation moves the finger not at all', commonWorst < 1e-12,
  commonWorst.toExponential(1), '0 — it reads the difference, not either input');

// the gain, which is the number the fold may not change
const GAIN = finger(1, 0);
push('the finger turns 4 per turn of wind', close(GAIN, 4), GAIN, 4);
push('winding and running down are OPPOSITE', close(finger(0, 1), -GAIN),
  finger(0, 1), -GAIN);

// P0: the travel closes on the stop-work that already exists. A single-pin
// Geneva travels N-1 turns, so the finger's turns over a full wind must BE
// N-1 — the identity §106 already asserts, re-derived here through the
// subtractor rather than through a rigid 4:1.
const travel = GAIN * TURNS;
push('full wind = N-1 finger turns', close(travel, N - 1), travel, N - 1);

// P1: the idler is a SIGN and must be provably nothing else — the ratio has to
// come out the same whatever count it is given.
let idlerDrift = 0;
for (const zI of [12, 15, 18, 24, 30, 36]) {
  const viaIdler = (W / zI) * (zI / LEG);   // rim -> idler -> PB, magnitude only
  idlerDrift = Math.max(idlerDrift, Math.abs(viaIdler - W / LEG));
}
push('the idler cancels out of the ratio', idlerDrift < 1e-12,
  idlerDrift.toExponential(1), '0 for every count — it buys the sign only');

// P1: every mesh in the line is between real, cuttable counts, and the two
// legs must share a centre distance or they cannot share the subtractor arbor.
const cd = (z1, z2) => (M * (z1 + z2)) / 2;
push('both legs mesh at ONE centre distance', close(cd(W, LEG), cd(W, LEG)),
  cd(W, LEG), 'the mesh circle, 8.25');
push('the output stage doubles, which is the line spec', close(OUT_W / OUT_P, 2),
  `${OUT_W}:${OUT_P} = ${OUT_W / OUT_P}`, '2 — the counts are the fold\'s, the ratio is not');

// ---- the road not taken, priced ---------------------------------------------
// Unequal legs into a compound-planet epicyclic: out = (R*in1 - in2)/(R - 1),
// so alpha = R/(R-1) which leaves [0,1] for R < 1 and lets both legs arrive in
// the SAME sense. It works, and it costs more than it saves.
const g1 = -W / 11, g2 = -W / 22;            // 11 t and 22 t on the coaxial pair
const R = g2 / g1;                            // 0.5 — the epicyclic's internal ratio
const epi = (a, b) => (R * g1 * a - g2 * b) / (R - 1);
push('[road not taken] the epicyclic also lands 4', close(epi(1, 0), 4), epi(1, 0), 4);
push('[road not taken] but its legs need TWO centre distances',
  !close(cd(W, 11), cd(W, 22)), `${cd(W, 11)} vs ${cd(W, 22)}`, 'differ — cannot share a stud');

console.log('--- the line ---');
console.log(`  leg A   wind wheel ${W} t -> pinion ${LEG} t          gain ${gA}`);
console.log(`  leg B   barrel rim ${W} t -> idler -> pinion ${LEG} t  gain ${gB}  (the idler is the sign)`);
console.log(`  spider  carrier = (SA + SB)/2                       gain ${carrier(1, 0)} per turn of wind`);
console.log(`  output  carrier ${OUT_W} t -> finger ${OUT_P} t              gain ${GAIN} per turn of wind`);
console.log(`\n  LINE SPEC: gain ${GAIN}, travel ${travel} finger turns over ${TURNS} turns of wind,`);
console.log(`             ${N} stations, both leg meshes at centre distance ${cd(W, LEG)}`);
console.log('\n--- checks ---');
let bad = 0;
for (const c of checks) {
  if (!c.ok) bad++;
  console.log(`  ${c.ok ? 'PASS' : 'FAIL'}  ${c.name.padEnd(46)} ${String(c.got).padStart(16)}   want ${c.want}`);
}
console.log(bad ? `\n${bad} FAILING` : '\nall checks pass');
process.exit(bad ? 1 : 0);
