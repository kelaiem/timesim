// TODO 138 Landing 2 — DO THE MOVEMENT'S BEVEL CORNERS TURN THE WAY THEIR CONES
// DEMAND? Report, browser, on the converted tree.
//
// Converting the corners to real conjugate teeth made a question askable that
// the shear form could not raise: whether the tick law DRIVES the two members
// in the relation two rolling cones actually have. The sheared blanks never
// touched at any station, so any sense, any ratio and any phase "worked" there
// — probe-crossed-axis-mesh measured that pair at 0.0000 for exactly that
// reason. With teeth that interleave, a wrong coupling grinds, and it reads as
// burial no index can clear.
//
// THE CONDITION, derived rather than assumed. Two cones sharing an apex, axes
// û_A and û_B pointing from the apex into each blank, roll without slip iff
// their RELATIVE angular velocity lies along the contact ray d — everything
// else is sliding. d lies between the axes, γ_A from û_A and γ_B from û_B, so
// the parts of û_A and û_B perpendicular to d are sin γ_A and sin γ_B along
// one direction n and its opposite. The relative velocity's n-component must
// vanish:
//
//     ω_A·sin γ_A + ω_B·sin γ_B = 0   ⟹   ω_B = −ω_A · sin γ_A / sin γ_B
//
// and since each pitch radius is coneR·sin γ = m·z/2, that is −ω_A·z_A/z_B AT
// ANY SHAFT ANGLE — the tooth-count ratio with a sign. For equal counts it is
// simply ω_B = −ω_A: equal and opposite about their own axes, mitre or not.
//
// THE FIRST VERSION OF THIS FILE WROTE THE 90° CASE AS THE GENERAL ONE. It
// had d = cos γ_A·û_A + cos γ_B·û_B (a unit ray only when û_A ⟂ û_B) and
// reduced the condition to −tan γ_A, which equals −sin γ_A / sin γ_B only when
// γ_B = 90° − γ_A. Every corner was 90° then. §234's fold added the motion
// works' RISE (Σ 99.5°) and FOLD (Σ 162.2°) corners, both 10/10, and the
// probe asked them for −1.18 and −6.40 where two equal cones can only roll at
// −1 — and TODO 163 recorded the resulting MISMATCH rows as a defect of the
// corners. The corners were right; the condition was not.
//
// THE PITCH ANGLE IS READ OFF THE CUT, not recomputed beside it: each blank
// carries the γ `bevelToothSpec` derived it from (`userData.solid.gamma`), and
// the row asserts that γ_A + γ_B is the axes' measured angle and that
// sin γ_A / sin γ_B is the count ratio. A blank cut for a different shaft
// angle than its mounting would fail there, before any ratio is compared.
//
// WHAT IS MEASURED, and it is measured off the metal rather than read out of
// the tick law's source. Each gear gets a marker point fixed in its own body;
// the probe drives the corner's real input and tracks the marker's SIGNED SWING
// about that gear's own axis in world. The ratio of the two swings is then
// compared with the ratio the cones demand. Reading `rotation.z` instead would
// re-state whatever the builder assigned, which is the thing under suspicion.
//
// GUARDS against a clean-but-empty answer:
//   · the axis must hold still through the sweep (a mount that turns makes the
//     swing about a moving axis meaningless, and it is reported);
//   · both markers must actually move (a member that stands still has no ratio,
//     and a ratio of 0/0 must not read as agreement);
//   · the apexes must coincide at the swept pose, or the pair is not a corner
//     there and nothing about its ratio matters.
//
// cd tools && node probe-138-coupling.mjs
import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
const ROOT = process.env.ROOT || join(dirname(fileURLToPath(import.meta.url)), '..');
const PORT = Number(process.env.PORT || 8531);
const srv = spawn('python3', ['-m', 'http.server', String(PORT), '--bind', '127.0.0.1'], { cwd: ROOT, stdio: 'ignore' });
process.on('exit', () => srv.kill());
await new Promise((r) => setTimeout(r, 1200));
const browser = await chromium.launch();
const page = await browser.newPage();
page.on('pageerror', (e) => console.log('PAGEERROR', String(e)));
await page.goto(`http://127.0.0.1:${PORT}/index.html`, { waitUntil: 'load', timeout: 90000 });
await page.waitForFunction(() => !!window.__clock, null, { timeout: 90000 });

const out = await page.evaluate(async () => {
  const THREE = await import('three');
  const C = window.__clock;

  // the pitch angle the blank was CUT at, off the builder's own declaration
  const gammaOf = (name) => {
    let g = null;
    C.scene.traverse((o) => {
      if (!o.isMesh || !o.userData.solid || o.userData.solid.kind !== 'apexCone') return;
      if (o.name === name || (o.parent && o.parent.name === name)) g = o.userData.solid.gamma;
    });
    return g;
  };
  const groupOf = (name) => {
    let g = null;
    C.scene.traverse((o) => {
      if (!o.isMesh || !o.userData.solid || o.userData.solid.kind !== 'apexCone') return;
      if (o.name === name || (o.parent && o.parent.name === name)) g = o.parent;
    });
    return g;
  };
  const axisOf = (g) => new THREE.Vector3(0, 0, 1).transformDirection(g.matrixWorld).normalize();
  const apexOf = (g) => new THREE.Vector3().setFromMatrixPosition(g.matrixWorld);
  // a marker fixed in the body, taken off the axis so its swing is measurable
  const markOf = (g) => new THREE.Vector3(1, 0, 0).applyMatrix4(g.matrixWorld)
    .sub(apexOf(g));
  // the component of the marker perpendicular to the axis
  const perp = (v, u) => v.clone().sub(u.clone().multiplyScalar(v.dot(u)));
  const signedAngle = (a, b, u) => Math.atan2(new THREE.Vector3().crossVectors(a, b).dot(u), a.dot(b));

  const CORNERS = [
    // EACH DRIVE IS THE AXIS'S OWN POSE, copied from inspect.js's AXES rather
    // than invented here. The first version of this probe guessed them, and two
    // of the four corners came back with a member standing still: the
    // motion-works pair moves on `setPathRot` ALONE (the `handSet` axis, and
    // adding windStemSlip was what pinned it), and the alarm's winding corner
    // is written by `alarmWindRotation`, not `alarmCrownRotation`. A pose the
    // watch never reaches measures nothing, and says so.
    // THE MOTION-WORKS PAIR NEEDS THE EASE TO RUN. Its driving value is
    // `handSetOffset`, which while the crown is out comes from `jumpDisp` — the
    // minute jumper's DETENTED display — and setPose ticks with zero dt, so an
    // eased quantity cannot move under it (CLAUDE.md's trap, and TODO 135's
    // subject). Posed alone, both members stood still and the probe said so
    // rather than scoring 0/0 as agreement. Stepping lets the detent settle.
    { name: 'motion works, drop corner', a: 'mwCornerDropIn', b: 'mwCornerDropOut',
      drive: (f) => { C.setPose({ tau: 0.05, crownPullT: 1, leverEngage: 0, tension: 1,
        setPathRot: f * (C.setPathPerMinuteWheelRev || 0) });
        for (let k = 0; k < 40; k++) C.step(0.05); } },
    { name: 'motion works, rise corner', a: 'mwCornerRiseIn', b: 'mwCornerRiseOut',
      drive: (f) => { C.setPose({ tau: 0.05, crownPullT: 1, leverEngage: 0, tension: 1,
        setPathRot: f * (C.setPathPerMinuteWheelRev || 0) });
        for (let k = 0; k < 40; k++) C.step(0.05); } },
    // §234 fold — the third motion-works corner, an ANGULAR pair (Σ ≈ 150°,
    // not a mitre); equal counts, so the swing ratio it must show is −1 like
    // the two mitres either side of it.
    { name: 'motion works, fold corner', a: 'mwCornerFoldIn', b: 'mwCornerFoldOut',
      drive: (f) => { C.setPose({ tau: 0.05, crownPullT: 1, leverEngage: 0, tension: 1,
        setPathRot: f * (C.setPathPerMinuteWheelRev || 0) });
        for (let k = 0; k < 40; k++) C.step(0.05); } },
    { name: 'alarm SETTING, stem to disc', a: 'alarmStemBevel', b: 'alarmDiscBevel',
      drive: (f) => C.setPose({ tau: 0.13, crownPullT: 0, leverEngage: 0, tension: 1,
        alarmCrownRotation: f * 2 * Math.PI, alarmOn: 1, alarmCrownPullT: 1 }) },
    // TODO 140 — THE SAME CORNER, DRIVEN BY THE OTHER THING THAT DRIVES IT.
    // The row above sweeps the CROWN. The hour also reaches this pair, through
    // `alarmCrownCreep` (§194 F) on one side and `3 * _bd` on the rotor's own
    // angle on the other, and nothing has ever measured whether those two
    // paths agree with each other about the corner. A pair driven by two
    // relations is not one coupling, and re-solving its index at engagement
    // would stand on that.
    //
    // SINCE TODO 144 THE HOUR DOES NOT REACH THIS CORNER AT ALL — the disc
    // carries the SET alone and `alarmCrownCreep` is written by nothing — so
    // the right answer is BOTH members still, and the row says so (`still`).
    // One member moving would be an orphan, TODO 144's own defect, and fails.
    { name: 'alarm SETTING, the HOUR back-drive through the same teeth', a: 'alarmStemBevel', b: 'alarmDiscBevel',
      still: 'TODO 144 — the hour no longer drives the alarm setting branch',
      // tau far enough to move the HOUR: it reaches this corner as 3*_bd and
      // _bd is the hour wheel's dial angle, so a short sweep gives a swing near
      // float noise — and a sign read off noise is not a finding.
      drive: (f) => C.setPose({ tau: 0.13 + f * 1800, crownPullT: 0, leverEngage: 0, tension: 1,
        alarmCrownRotation: 0, alarmOn: 1, alarmCrownPullT: 1 }) },
    // TODO 136's two keyless corners, added by TODO 139 — they were cut as bevel
    // pairs and never added HERE, so nothing measured whether the movement drives
    // them conjugately. The winding one is swept by the bank (the crown wheel's
    // own input); the setting one by the crown PULLED, which is the only state
    // where the clutch rim and the setting wheel's bevel half are engaged.
    { name: 'keyless WINDING, crown wheel to pinion', a: 'crownWheel', b: 'windingPinion',
      drive: (f) => C.setPose({ tau: 0.13, crownPullT: 0, leverEngage: 0,
        tension: 1 - 0.5 * f }) },
    // The setting corner needs an input that turns the CLUTCH, which rides the
    // stem — `setPathRot` poses the setting path DOWNSTREAM of it, so the rim
    // stands still and the row reads "no ratio" rather than a wrong one. Driven
    // by the crown itself, pulled, which is the only state where the rim and
    // the setting wheel's bevel half are engaged at all.
    { name: 'keyless SETTING, setting bevel to clutch', a: 'settingBevel', b: 'clutchRim',
      drive: (f) => { C.setPose({ tau: 0.13, crownPullT: 1, leverEngage: 0, tension: 1 });
        C.setCrownRotation(f * 2 * Math.PI);
        for (let k = 0; k < 40; k++) C.step(0.05); } },
    { name: 'alarm WINDING, stem to contrate', a: 'alarmStemBevel', b: 'alarmWindContrate',
      drive: (f) => C.setPose({ tau: 0.13, crownPullT: 0, leverEngage: 0, tension: 1,
        alarmWindRotation: -f * (C.alarmWindCrownTurns || 1.75 / (12 / 44)) * 2 * Math.PI,
        alarmOn: 0, alarmReleased: 0, alarmCrownPullT: 0 }) },
  ];

  const rows = [];
  for (const cor of CORNERS) {
    const row = { name: cor.name, a: cor.a, b: cor.b, still: cor.still || null };
    const N = 24;
    let gA = null, gB = null, uA = null, uB = null, mA = null, mB = null;
    let axisDriftA = 0, axisDriftB = 0, apexGap = 0, swA = 0, swB = 0;
    for (let i = 0; i <= N; i++) {
      cor.drive(i / N);
      C.scene.updateMatrixWorld(true);
      const ga = groupOf(cor.a), gb = groupOf(cor.b);
      if (!ga || !gb) { row.bad = `missing ${!ga ? cor.a : cor.b}`; break; }
      const ua = axisOf(ga), ub = axisOf(gb);
      const ma = perp(markOf(ga), ua), mb = perp(markOf(gb), ub);
      const gap = apexOf(ga).distanceTo(apexOf(gb));
      if (gap > apexGap) apexGap = gap;
      if (i === 0) { gA = ga; gB = gb; uA = ua.clone(); uB = ub.clone(); mA = ma.clone(); mB = mb.clone(); row.teethA = ga.userData.teeth; row.teethB = gb.userData.teeth; }
      else {
        axisDriftA = Math.max(axisDriftA, uA.angleTo(ua));
        axisDriftB = Math.max(axisDriftB, uB.angleTo(ub));
        swA += signedAngle(mA, ma, uA); swB += signedAngle(mB, mb, uB);
        mA.copy(ma); mB.copy(mb);
      }
    }
    C.resetInputs(); C.scene.updateMatrixWorld(true);
    if (row.bad) { rows.push(row); continue; }
    row.axisAngleDeg = (uA.angleTo(uB) * 180) / Math.PI;
    row.apexGap = +apexGap.toFixed(4);
    row.axisDriftDeg = +(Math.max(axisDriftA, axisDriftB) * 180 / Math.PI).toFixed(4);
    row.swA = +swA.toFixed(5); row.swB = +swB.toFixed(5);
    row.got = Math.abs(swA) > 1e-6 ? +(swB / swA).toFixed(5) : null;
    // the cones' own demand: −sin γ_A / sin γ_B with γ read off each CUT, and
    // the cut held to the mounting (γ_A + γ_B = Σ) and to the counts
    const SIG = uA.angleTo(uB);
    const gA_ = gammaOf(cor.a), gB_ = gammaOf(cor.b);
    row.gammaA = +((gA_ * 180) / Math.PI).toFixed(3);
    row.gammaB = +((gB_ * 180) / Math.PI).toFixed(3);
    row.sigmaErrDeg = +(((gA_ + gB_ - SIG) * 180) / Math.PI).toFixed(6);
    row.countErr = Math.abs(Math.sin(gA_) / Math.sin(gB_) - row.teethA / row.teethB);
    row.want = +(-Math.sin(gA_) / Math.sin(gB_)).toFixed(5);
    rows.push(row);
  }
  return { rows };
});
await browser.close(); srv.kill();

console.log('THE CONDITION: two cones on a shared apex roll only if ω_A·sin γ_A + ω_B·sin γ_B = 0,');
console.log('i.e. ω_B/ω_A = −z_A/z_B at ANY shaft angle — −1 for equal counts, mitre or not.\n');
console.log('corner                          teeth   axes°   γ_A°    γ_B°    swing A   swing B   ratio      wanted     verdict');
for (const r of out.rows) {
  if (r.bad) { console.log(`${r.name.padEnd(31)} ${r.bad}`); continue; }
  const ok = r.got !== null && Math.abs(r.got - r.want) <= 0.02 * Math.abs(r.want);
  const stillA = Math.abs(r.swA) < 1e-6, stillB = Math.abs(r.swB) < 1e-6;
  const cutBad = Math.abs(r.sigmaErrDeg) > 1e-4 || r.countErr > 1e-9;
  const verdict = cutBad ? `✗ CUT ≠ MOUNT (γ_A+γ_B−Σ ${r.sigmaErrDeg}°, count ratio off ${r.countErr.toExponential(2)})`
    : stillA && stillB ? (r.still ? `OK — both still: ${r.still}` : '✗ BOTH MEMBERS STOOD STILL — no ratio')
    : stillA || stillB ? '✗ ORPHAN — one member moves without the other'
    : r.still ? `✗ MOVED — expected still (${r.still})`
    : ok ? 'OK' : '✗ MISMATCH';
  console.log(`${r.name.padEnd(31)} ${`${r.teethA}/${r.teethB}`.padEnd(7)} ${r.axisAngleDeg.toFixed(1).padEnd(7)} `
    + `${String(r.gammaA).padEnd(7)} ${String(r.gammaB).padEnd(7)} ${String(r.swA).padEnd(9)} ${String(r.swB).padEnd(9)} `
    + `${String(r.got).padEnd(10)} ${String(r.want).padEnd(10)} ${verdict}`);
}
console.log('\nguards');
for (const r of out.rows) {
  if (r.bad) continue;
  console.log(`  ${r.name.padEnd(31)} apex gap ${String(r.apexGap).padEnd(8)} axis drift ${r.axisDriftDeg}°`
    + `${r.apexGap > 1e-3 ? '   ← NOT A CORNER at this pose' : ''}`
    + `${r.axisDriftDeg > 0.01 ? '   ← axis moved; the swing is about a moving axis' : ''}`);
}
