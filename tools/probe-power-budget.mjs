// Does the going spring deliver enough energy, after friction, to keep the balance at the amplitude the movement claims? It walks the power from the ribbon to the balance, loss by loss: mainspring, drum, chain, fusee, four meshes, four pivoted arbors, escapement, then solves the amplitude the delivered energy can sustain against the balance's own pivot friction and damping — and ASSERTS its answer against the record main.js publishes (EQUALISATION.going.energy, TODO 192 step 1), exiting non-zero if the two disagree. The verdict itself is a REPORT; the agreement is the acceptance.
//
// Why it exists. Until TODO 192 every number the movement published about its
// power was FRICTIONLESS. EQUALISATION holds the fusee's level product to float
// noise and the spring's k to its ribbon, and OSCILLATOR solves the hairspring
// to the balance's inertia; nothing asked whether one could DRIVE the other.
// AMPLITUDE_TRUE_DEG = 270 is called a "physical reference", and two sites price
// loads against it: the hack brake's 1.3 mN (main.js, the priceRigidBentLink
// block) and §218's physical breathing peaks. This probe asked first; the
// record now carries the same arithmetic, and this is the second path.
//
// Where the numbers come from. The live figures are read off a booted tree:
// the equalisation record (k, set-up and full-wind angles, the fusee's radii),
// the oscillator record (k, I) and the balance's published dimensions (mass).
// The train counts, chain stock and the FRICTION bands come from layout.js.
// Numbers that live only in main.js or geometry.js (pivot staffs, drum radius,
// drop) are QUOTED: read out of the source text by regex, and the probe throws
// if any quote stops matching, so it cannot silently price a stale constant.
// That is what makes the assert worth having — the record reads the same
// constants by NAME inside main.js; this reads them by TEXT from outside.
//
// The friction coefficients, the escapement efficiency and the balance's
// non-pivot Q are declared bands, not measurements (layout.js FRICTION, each
// row with its source). The probe runs all three corners, and a conclusion
// that flips between corners is not a conclusion.
//
// What it is NOT. It is not `equalisation` (the gate — rows 9–11 of which hold
// the record's arithmetic; this holds the record against an independent
// computation). It is not `transfers` (static force budgets at sprung
// corners). It is not probe-218-breathing (the hairspring's own mechanics).
//
// Filed as ACCEPTANCE (it can exit non-zero) though its verdict is a report:
// the non-zero exit is reserved for the record disagreeing with this
// computation, never for the watch failing to run.
//
// Run from tools/: `node probe-power-budget.mjs [--json FILE]`.
import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import { readFileSync, writeFileSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import * as L from '../src/layout.js';

const f = (x, d = 3) => Number(x).toFixed(d), e = (x) => Number(x).toExponential(3);
const ROOT = new URL('..', import.meta.url).pathname;
const argJson = (() => { const i = process.argv.indexOf('--json'); return i > 0 ? process.argv[i + 1] : null; })();

// ---- QUOTES: constants that live outside layout.js, read out of the source ----
const SRC = {
  main: readFileSync(join(ROOT, 'src/main.js'), 'utf8'),
  geom: readFileSync(join(ROOT, 'src/geometry.js'), 'utf8'),
};
function quote(file, re, what) {
  const m = SRC[file].match(re);
  if (!m) throw new Error(`quote went stale: ${what} (${re}) no longer matches src/${file === 'main' ? 'main' : 'geometry'}.js`);
  return Number(m[1]);
}
const Q = {
  upperStaffR: quote('main', /^const TRAIN_STAFF_R = ([\d.]+);/m, 'TRAIN_STAFF_R'),
  forkStaffR: quote('main', /addLowerPivot\(forkGroup, \{ staffR: ([\d.]+)/, 'pallet fork lower staffR'),
  balStaffR: quote('main', /^const BALANCE_STAFF_R = ([\d.]+);/m, 'BALANCE_STAFF_R'),
  drumR: quote('main', /const DRUM_R_ACTUAL = ([\d.]+);/, 'DRUM_R_ACTUAL'),
  arborK: quote('geom', /export const barrelArborR = \(radius\) => radius \* ([\d.]+);/, 'barrelArborR factor'),
  escR: quote('main', /makeEscapeWheel\(\{[^}]*?radius: ([\d.]+)/s, 'escape wheel radius'),
  escTeeth: quote('main', /makeEscapeWheel\(\{[^}]*?teeth: (\d+)/s, 'escape wheel teeth'),
  dropDeg: quote('geom', /const DROP_DEG = ([\d.]+);/, 'DROP_DEG'),
};

// ---- THE BANDS: layout.js's FRICTION table, one corner at a time ----
// "favourable" is the corner kind to the movement. Every row is a literature
// band, not a fit, and its source is on the table.
const ASSUME = Object.fromEntries(Object.entries(L.FRICTION).map(([k, v]) => [k, { band: L.FRICTION_CORNERS.map((c) => v[c]), src: v.why }]));
const CORNERS = Object.fromEntries(L.FRICTION_CORNERS.map((c) => [c, Object.fromEntries(Object.entries(L.FRICTION).map(([k, v]) => [k, v[c]]))]));

// ---- BOOT ----
const port = process.env.PORT || '8493';
const stateDir = mkdtempSync(join(tmpdir(), 'power-budget-'));
const srv = spawn('python3', [join(ROOT, 'dev_server.py'), port], { cwd: ROOT, env: { ...process.env, TMPDIR: stateDir }, stdio: 'ignore' });
await new Promise((r) => setTimeout(r, 1200));
const browser = await chromium.launch({ args: ['--disable-background-timer-throttling', '--disable-renderer-backgrounding'] });
let live;
try {
  const page = await browser.newPage();
  page.on('pageerror', (e) => console.log('PAGEERROR', String(e)));
  await page.goto(`http://127.0.0.1:${port}/index.html`, { waitUntil: 'load', timeout: 180000 });
  await page.waitForFunction(() => !!window.__clock || !!window.__bootError, null, { timeout: 180000 });
  live = await page.evaluate(() => {
    if (window.__bootError) return { error: String(window.__bootError) };
    const C = window.__clock;
    let bal = null;
    C.scene.traverse((o) => { if (!bal && o.userData && o.userData.rim && o.userData.screws && o.userData.arm) bal = o.userData; });
    return {
      eq: JSON.parse(JSON.stringify(C.equalisation.going)),   // carries .energy, the record this probe asserts against
      eqAlarm: JSON.parse(JSON.stringify(C.equalisation.alarm)),
      osc: { I: C.oscillator.I_kgm2, k: C.oscillator.k_Nm_per_rad, f: C.oscillator.fSpecHz },
      bal: bal && { rim: bal.rim, arm: bal.arm, screws: bal.screws },
      fuseeWrapTurns: C.fuseeWrapTurns, hoursPerFuseeTurn: C.hoursPerFuseeTurn,
    };
  });
} finally {
  await browser.close();
  srv.kill();
}
if (live.error) throw new Error(`boot failed: ${live.error}`);
if (!live.bal) throw new Error('balance dimensions not found (userData.rim/arm/screws) — the mass term would be silently zero');

// ---- DERIVED, frictionless ----
const U = L.UNIT_MM / 1000;                          // m per u
const { eq, osc } = live;
const E_spring = 0.5 * eq.k_Nm_per_rad * (eq.windFullRad ** 2 - eq.setup.sweepRad ** 2); // J released over the reserve
const reserveS = L.SPEC.reserveHours * 3600;
const beatsPerS = L.SPEC.vph / 3600;
const beats = reserveS * beatsPerS;
const T = L.TRAIN;
const r = (m) => m.module * m.teeth / 2, rp = (m) => m.module * m.pinion / 2;
const meshes = [
  { name: 'great wheel → centre pinion', z1: T.barrel.teeth, z2: T.barrel.pinion },
  { name: 'centre → third pinion', z1: T.center.teeth, z2: T.center.pinion },
  { name: 'third → fourth pinion', z1: T.third.teeth, z2: T.third.pinion },
  { name: 'fourth → escape pinion', z1: T.fourth.teeth, z2: T.fourth.pinion },
];
const ratio = meshes.reduce((a, m) => a * m.z1 / m.z2, 1);
// Each arbor: pinion in (radius), wheel out (radius), pivot radius.
const arbors = [
  { name: 'centre', rIn: rp(T.barrel), rOut: r(T.center), rPiv: Q.upperStaffR },
  { name: 'third', rIn: rp(T.center), rOut: r(T.third), rPiv: Q.upperStaffR },
  { name: 'fourth', rIn: rp(T.third), rOut: r(T.fourth), rPiv: Q.upperStaffR },
  { name: 'escape', rIn: rp(T.fourth), rOut: Q.escR, rPiv: Q.upperStaffR },
];
const rWrap = Q.drumR + L.CHAIN_END_R_OUT;           // DRUM_WRAP_R, the chain's feed radius
const rFuseeLarge = eq.rLarge, rFuseeSmall = eq.fuseeK; // r·M/M_full = K ⇒ r at full wind is K
const rFuseeMean = (rFuseeLarge + rFuseeSmall) / 2;
const rGreat = r(T.barrel);
const fuseeTurns = live.fuseeWrapTurns;
const tauFusee = E_spring / (fuseeTurns * 2 * Math.PI);  // N·m, level by construction
const tauEsc = tauFusee / ratio;
const beatRad = L.BEAT_DEG * Math.PI / 180;
const grossPerBeat = E_spring / beats;              // J at the fusee arbor, per beat

// The balance's mass, by main.js OSC_I's own decomposition (rim brass, arm and screws steel).
const B = live.bal;
const rimM = 8500 * Math.PI * (B.rim.rO ** 2 - B.rim.rI ** 2) * B.rim.h * U ** 3;
const armM = 7850 * B.arm.x * B.arm.y * B.arm.z * U ** 3;
const screwM = 7850 * B.screws.n * (Math.PI * B.screws.len / 3) * (B.screws.r1 ** 2 + B.screws.r1 * B.screws.r2 + B.screws.r2 ** 2) * U ** 3;
const balMass = rimM + armM + screwM;               // kg, staff/rollers neglected (<1% by OSC_I's own bound)

// ---- THE CHAIN OF LOSSES, per corner ----
function run(A, piv = { train: Q.upperStaffR, bal: Q.balStaffR }) {
  const stages = [];
  const push = (name, eta, how) => stages.push({ name, eta, how });
  push('mainspring (coil friction)', A.springInt, 'assumed band');
  push('drum on its fixed arbor', 1 - A.muPlain * (Q.arborK * Q.drumR) / rWrap, `μ·r_arbor/R_wrap = ${A.muPlain}·${(Q.arborK * Q.drumR).toFixed(2)}/${rWrap.toFixed(2)}`);
  push('chain articulation', 1 - A.muChain * L.CHAIN_PIN_R * (1 / rFuseeMean + 1 / rWrap), `μ·r_pin·(1/r_fusee + 1/R_wrap), rivet r ${L.CHAIN_PIN_R} u`);
  push('fusee arbor pivots', 1 - A.muPlain * Q.upperStaffR * (1 / rFuseeMean + 1 / rGreat), `μ·r_piv·(1/r_fusee + 1/r_great), staff r ${Q.upperStaffR} u, top bush plain`);
  meshes.forEach((m, i) => {
    push(`mesh ${m.name} (${m.z1}/${m.z2})`, 1 - Math.PI * A.muTooth * (1 / m.z1 + 1 / m.z2), 'πμ(1/z₁ + 1/z₂)');
    const a = arbors[i];
    push(`${a.name} arbor pivots`, 1 - A.muJewel * piv.train * (1 / a.rIn + 1 / a.rOut), `μ·r_piv·(1/r_pinion + 1/r_out) = loads additive (upper bound), staff r ${f(piv.train)} u`);
  });
  push('lever escapement', A.escEff, 'assumed band');
  const etaTotal = stages.reduce((p, s) => p * s.eta, 1);
  const etaTrain = stages.filter((s) => /mesh|arbor|fusee|chain|drum/.test(s.name)).reduce((p, s) => p * s.eta, 1);

  // Balance: Coulomb pivot friction and viscous-like damping (Q_other).
  const g = 9.81;
  const tfVert = A.muJewel * balMass * g * piv.bal * U;        // N·m, staff horizontal (watch vertical), weight on the pivot sides
  const tfFlat = A.muJewel * balMass * g * (2 / 3) * A.endContactMm / 1000; // N·m, end on endstone
  const k = osc.k;
  const supply = etaTotal * grossPerBeat;           // J delivered to the balance per beat
  // Per beat (half an oscillation): loss = (π/Q)·½kθ²  +  2θ·T_f  ⇒  aθ² + bθ − c = 0.
  const amp = (tf) => { const a = Math.PI * k / (2 * A.qOther), b = 2 * tf, c = supply; return (-b + Math.sqrt(b * b + 4 * a * c)) / (2 * a); };
  const thT = L.AMPLITUDE_TRUE_DEG * Math.PI / 180;
  const needPerBeat = (tf) => Math.PI * k / (2 * A.qOther) * thT ** 2 + 2 * thT * tf;
  const need = needPerBeat(tfVert);
  const eNeeded = need / etaTotal * beats;          // J the ribbon must release over the reserve
  // Two ways to find it: more working turns at today's k and set-up, or a stiffer ribbon at today's angles.
  const thFullNeeded = Math.sqrt(2 * eNeeded / eq.k_Nm_per_rad + eq.setup.sweepRad ** 2);
  return {
    stages, etaTrain, etaTotal, supply_nJ: supply * 1e9,
    balance: {
      tfVert_Nm: tfVert, tfFlat_Nm: tfFlat,
      qPivotVertAt270: Math.PI * k * thT / (4 * tfVert), qPivotFlatAt270: Math.PI * k * thT / (4 * tfFlat),
      ampVertDeg: amp(tfVert) * 180 / Math.PI, ampFlatDeg: amp(tfFlat) * 180 / Math.PI,
      ampNoFrictionTrainDeg: (() => { const s = grossPerBeat * A.escEff; const a = Math.PI * k / (2 * A.qOther), b = 2 * tfVert; return (-b + Math.sqrt(b * b + 4 * a * s)) / (2 * a) * 180 / Math.PI; })(),
    },
    at270: {
      needPerBeat_nJ: need * 1e9, shortfall: need / supply,
      springEnergyNeeded_mJ: eNeeded * 1e3,
      workingTurnsNeeded: (thFullNeeded - eq.setup.sweepRad) / (2 * Math.PI),
      torqueRatioThen: thFullNeeded / eq.setup.sweepRad,
      kMultiplierAtTodaysAngles: eNeeded / E_spring,
    },
  };
}
const results = Object.fromEntries(Object.entries(CORNERS).map(([n, A]) => [n, run(A)]));
// WHAT-IF: the pivots cut to §50's OWN stated real band ("real train pivots run
// 0.07-0.12 mm", layout.js PIVOT_MIN_U's basis) — train at the top of it, the
// balance at the bottom, as real movements do. The fusee keeps its staff (a
// winding arbor is legitimately thick). This changes nothing in the build; it
// asks how much of the shortfall is pivot size alone.
const REAL_PIV = { train: 0.12 / 2 / L.UNIT_MM, bal: 0.07 / 2 / L.UNIT_MM };
const realPivots = Object.fromEntries(Object.entries(CORNERS).map(([n, A]) => [n, run(A, REAL_PIV)]));

// THE RIBBON'S OWN STRESS — nothing in the battery asks it. A spiral spring
// wound off its free coil carries a UNIFORM moment M = k·θ along its length,
// so the outer fibre sees σ = M·a/I everywhere (a = the rhombus's radial
// half-diagonal, I = a³c/3, both published on the equalisation record).
const sec = eq.section;
const Zm3 = (sec.I_u4 / sec.a) * U ** 3;
const ribbon = {
  sigmaFull_MPa: eq.momentRange_Nmm[1] / 1000 / Zm3 / 1e6,
  sigmaEmpty_MPa: eq.momentRange_Nmm[0] / 1000 / Zm3 / 1e6,
  repoLimit_MPa: L.SPRING_SIGMA_Y_PA / 1e6,
  volume_mm3: 2 * sec.a * sec.c * eq.devLen_u * L.UNIT_MM ** 3,
};
// The alarm ribbon, the same arithmetic on the other half of the record.
const secA = live.eqAlarm.section, ZmA = (secA.I_u4 / secA.a) * U ** 3;
const alarmRibbon = { sigmaEmpty_MPa: live.eqAlarm.momentRange_Nmm[0] / 1000 / ZmA / 1e6, sigmaFull_MPa: live.eqAlarm.momentRange_Nmm[1] / 1000 / ZmA / 1e6 };

// ---- PRINT ----
console.log('\n=== POWER BUDGET — going train, spring to balance ===\n');
console.log(`spring    k ${e(eq.k_Nm_per_rad)} N·m/rad, wind ${f(eq.setup.sweepRad)} → ${f(eq.windFullRad)} rad (${f((eq.windFullRad - eq.setup.sweepRad) / (2 * Math.PI))} working turns of the drum)`);
console.log(`          moment ${f(eq.momentRange_Nmm[0])} → ${f(eq.momentRange_Nmm[1])} N·mm, ratio ${f(eq.windFullRad / eq.setup.sweepRad, 2)}:1`);
console.log(`          energy released over ${L.SPEC.reserveHours} h: ${f(E_spring * 1e3, 3)} mJ = ${f(E_spring / reserveS * 1e9, 1)} nW mean`);
console.log(`fusee     ${f(fuseeTurns, 3)} turns, level torque ${f(tauFusee * 1e3, 4)} N·mm, r ${f(rFuseeSmall)} → ${f(rFuseeLarge)} u; drum feed R ${f(rWrap)} u`);
console.log(`train     ratio fusee → escape ${f(ratio, 2)}; escape torque ${f(tauEsc * 1e9, 2)} nN·m; ${f(grossPerBeat * 1e9, 3)} nJ per beat at the fusee`);
console.log(`balance   I ${e(osc.I)} kg·m², k ${e(osc.k)} N·m/rad, ${osc.f} Hz; mass ${f(balMass * 1e6, 2)} mg; E at ${L.AMPLITUDE_TRUE_DEG}° = ${f(0.5 * osc.k * (L.AMPLITUDE_TRUE_DEG * Math.PI / 180) ** 2 * 1e6, 3)} µJ`);
console.log(`pivots    train staffs r ${Q.upperStaffR} u = ${f(Q.upperStaffR * L.UNIT_MM * 2, 3)} mm ⌀; fork ${f(Q.forkStaffR * L.UNIT_MM * 2, 3)} mm ⌀; balance ${f(Q.balStaffR * L.UNIT_MM * 2, 3)} mm ⌀`);
for (const [n, R] of Object.entries(results)) {
  console.log(`\n--- ${n} corner ---`);
  for (const s of R.stages) console.log(`  ${s.name.padEnd(42)} η ${f(s.eta, 4)}   ${s.how}`);
  console.log(`  train (drum → escape wheel)                η ${f(R.etaTrain, 4)}`);
  console.log(`  TOTAL ribbon → balance                     η ${f(R.etaTotal, 4)}  ⇒ ${f(R.supply_nJ, 3)} nJ per beat reaches the balance`);
  const b = R.balance;
  console.log(`  balance pivot friction: vertical ${e(b.tfVert_Nm)} N·m (Q_pivot ${f(b.qPivotVertAt270, 0)} at 270°), dial-flat ${e(b.tfFlat_Nm)} N·m (Q_pivot ${f(b.qPivotFlatAt270, 0)})`);
  console.log(`  SUSTAINED AMPLITUDE: vertical ${f(b.ampVertDeg, 1)}°, dial-flat ${f(b.ampFlatDeg, 1)}°  (train made frictionless, vertical: ${f(b.ampNoFrictionTrainDeg, 1)}°)`);
  const t = R.at270;
  console.log(`  to hold ${L.AMPLITUDE_TRUE_DEG}° vertical: ${f(t.needPerBeat_nJ, 2)} nJ/beat = ${f(t.shortfall, 2)}× what arrives; ribbon must release ${f(t.springEnergyNeeded_mJ, 1)} mJ`);
  console.log(`     = ${f(t.workingTurnsNeeded, 2)} working turns at today's k (moment ratio then ${f(t.torqueRatioThen, 2)}:1), or k ×${f(t.kMultiplierAtTodaysAngles, 1)} at today's angles`);
}
console.log(`\n--- what-if: pivots at §50's real band (train ${f(REAL_PIV.train * L.UNIT_MM * 2, 3)} mm ⌀, balance ${f(REAL_PIV.bal * L.UNIT_MM * 2, 3)} mm ⌀) ---`);
for (const [n, R] of Object.entries(realPivots))
  console.log(`  ${n.padEnd(11)} train η ${f(R.etaTrain, 3)}, total η ${f(R.etaTotal, 3)}; amplitude vertical ${f(R.balance.ampVertDeg, 1)}°, dial-flat ${f(R.balance.ampFlatDeg, 1)}°; 270° needs ${f(R.at270.springEnergyNeeded_mJ, 1)} mJ = ${f(R.at270.workingTurnsNeeded, 2)} working turns or k ×${f(R.at270.kMultiplierAtTodaysAngles, 1)}`);
console.log(`\n--- the ribbon's own stress (uniform moment, σ = M·a/I) ---`);
console.log(`  going  σ ${f(ribbon.sigmaEmpty_MPa, 0)} → ${f(ribbon.sigmaFull_MPa, 0)} MPa over the reserve, against SPRING_SIGMA_Y_PA ${f(ribbon.repoLimit_MPa, 0)} MPa; ribbon volume ${f(ribbon.volume_mm3, 2)} mm³`);
console.log(`  alarm  σ ${f(alarmRibbon.sigmaEmpty_MPa, 0)} → ${f(alarmRibbon.sigmaFull_MPa, 0)} MPa over its strike travel (both sections ${sec.shape}: modulus a²c/3, a quarter of the bounding strip's)`);
// ---- THE ASSERT: the record's energy column against this computation -------
// Same constants, two readers — the record by name inside main.js, this by
// text from outside — and two writers of the arithmetic. 1e-9 relative is
// float noise over a dozen multiplications; a stage renamed, a radius quoted
// from the wrong constant, a corner swapped, all land far outside it.
const REC = eq.energy;
const disagreements = [];
const same = (what, mine, theirs, tol = 1e-9) => {
  const d = Math.abs(mine - theirs) / Math.max(Math.abs(theirs), 1e-300);
  if (!(d <= tol)) disagreements.push({ what, probe: mine, record: theirs, rel: d });
};
if (!REC || !REC.corners) {
  disagreements.push({ what: 'record', probe: 'computed', record: 'EQUALISATION.going.energy is missing' });
} else {
  same('released_J', E_spring, REC.released_J);
  same('escapeTorque_Nm', tauEsc, REC.escapeTorque_Nm);
  same('perBeat_J', grossPerBeat, REC.perBeat_J);
  same('balance mass_kg', balMass, REC.balance.mass_kg);
  for (const [n, R] of Object.entries(results)) {
    const C = REC.corners[n];
    if (!C) { disagreements.push({ what: `corner ${n}`, probe: 'present', record: 'absent' }); continue; }
    same(`${n}: etaTotal`, R.etaTotal, C.etaTotal);
    same(`${n}: etaTrain`, R.etaTrain, C.etaTrain);
    same(`${n}: sustained vertical (deg)`, R.balance.ampVertDeg, C.sustainedDeg.vertical);
    same(`${n}: sustained flat (deg)`, R.balance.ampFlatDeg, C.sustainedDeg.flat);
    same(`${n}: claim factor`, R.at270.shortfall, C.claim.factorOverSupply);
  }
}
console.log('\n--- the record (EQUALISATION.going.energy) against this computation ---');
if (disagreements.length) { for (const d of disagreements) console.log(`  DISAGREE ${d.what}: probe ${d.probe} vs record ${d.record}${d.rel !== undefined ? ` (rel ${d.rel.toExponential(2)})` : ''}`); }
else console.log(`  AGREES — ${4 + 5 * Object.keys(results).length} figures within 1e-9 relative`);

console.log('\nAssumption bands (favourable / nominal / adverse):');
for (const [k, v] of Object.entries(ASSUME)) console.log(`  ${k.padEnd(13)} ${v.band.join(' / ').padEnd(20)} ${v.src}`);
console.log('\nThe verdict above is a REPORT. The only acceptance here is the record agreeing with this computation.\n');

if (argJson) writeFileSync(argJson, JSON.stringify({ quotes: Q, assume: ASSUME, live, derived: { E_spring, tauFusee, tauEsc, ratio, grossPerBeat, balMass, rWrap, rFuseeSmall, rFuseeLarge }, results, realPivots, realPivotSizes_u: REAL_PIV, ribbon, alarmRibbon, disagreements }, null, 1));
if (disagreements.length) { console.log(`FAIL — ${disagreements.length} disagreement(s) between the record and this computation`); process.exit(1); }
