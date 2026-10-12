// THE TANGENTIAL BEAK — TODO 240. Is the alarm link's beak lever, re-aimed so
// its pin runs along the column wheel's RADIUS at the nose, the lever its line
// spec describes, does its pose law close the cam contact it claims, and does
// the castellations' flank now push in the lever's plane rather than along its
// pin?
//
// ACCEPTANCE (exit 1 on a failed row, 2 on a failed control).
//
// WHY. Until TODO 240 the lever lay on the wheel's radius (its arm aimed at the
// wheel's centre), so its tilt axis, and the pin on it, lay along the wheel's
// TANGENT at the nose — exactly the direction the flanks slope (profileAt is a
// rise over wheel angle), so the flank's push ran along the pin: 64–87 mN
// climbing on the §261 2c lever, a 0.39–0.53 N·u twist, the pin at 1.1–1.4 GPa
// (TODO 239). The face cam's own layout puts the follower's pivot axis along
// the radius at the contact; the lever then runs along the tangent, and a STUB
// carries the nose radially onto the columns from a bar that stands clear of
// them.
//
// METHOD, in the page:
//  S1–S4 THE LINE (the gate's own evaluator on 'alarm link tangential', at the
//     reference's run and the as-built fork's): the seat law lands the nose's
//     deepest corner on the gap floor (S1), the rod makes the rim's stroke at
//     the seat tilt (S2), the ratio is seat drop over stroke (S3), and the arms
//     share the run same-side, beak − tail = run (S4).
//  M1 THE PIN, on the metal: its axis's component along the wheel's tangent at
//     the nose is 0 (posed at rest).
//  M2 THE FLANK'S PUSH (clock.beakPivot.flank, the build's own record): what
//     still bears along the pin is only the leading corner's skew,
//     sin(atan(W_AZ/2 / r)) of the push, under an eighth of it at every radius
//     the nose spans — against the WHOLE push the radial lever took there.
//  M3 THE POSE LAW CLOSES THE CONTACT: at every pose of alarmToggle and
//     alarmPress (64 + 2 samples), the nose posed by the tick's own law
//     (alarmLinkNoseTheta: a flat face tilting ALONG the flank, solved) touches
//     the column — the castellations or the gap floor read within 1e-4 — and
//     it stands no deeper in the metal than the cut's own chord error (the
//     mesh is straight between makeColumnWheel's stations while the law reads
//     profileAt exactly, so at a flank's foot the metal stands up to
//     slope·spacing/4 above the law): it rides the cut, never in it.
// CONTROL (fatal): M3 re-run with the tilt scaled 0.9 must find poses where
//     the nose no longer touches (a law that does not reach the floor), and
//     S1 re-run with the stroke 10% wrong must fail.
//
// What it is NOT: probe-261-dial-beak (retired with the radial lever) chose the
// same-side CLASS; probe-230-beak-retention slides the lever along its pin and
// holds the thrust faces; probe-70-line-spec fires the line-spec gate. This one
// holds the new aim and its pose law.
//
//   cd tools && node probe-240-tangential-beak.mjs
import { chromium } from 'playwright';
import { spawn } from 'node:child_process';

const port = process.env.PORT || '8586';
const root = process.env.ROOT || '..';
const srv = spawn('python3', ['-m', 'http.server', port, '--bind', '127.0.0.1'], { cwd: root, stdio: 'ignore' });
process.on('exit', () => srv.kill());
await new Promise((r) => setTimeout(r, 900));
const browser = await chromium.launch();
const page = await browser.newPage();
const warns = [];
page.on('console', (m) => { if ((m.type() === 'warning' || m.type() === 'error') && !/WebGL|GPU stall|GL Driver|GroupMarker|404|coplanar/.test(m.text())) warns.push(m.text()); });
page.on('pageerror', (e) => warns.push('PAGEERROR ' + String(e)));
await page.goto(`http://127.0.0.1:${port}/index.html?hud=0&sync=0`, { waitUntil: 'load', timeout: 240000 });
await page.waitForFunction(() => !!window.__clock || !!window.__bootError, null, { timeout: 300000 });
const bootError = await page.evaluate(() => (window.__bootError ? String(window.__bootError) : null));
if (bootError) { console.log('boot failed: ' + bootError); process.exit(2); }

const R = await page.evaluate(async () => {
  const THREE = await import('./vendor/three.module.js');
  const I = await import('./src/inspect.js');
  const clock = window.__clock, L = clock.lineLaws;
  const ref = (n) => I.LINE_SPECS.find((r) => r.name === n);
  const drive = I.lineSpecEvaluate(ref('alarm switch drive'), {}, null, L);
  const fork = I.LINE_SPEC_FORKS.find((f) => f.ref === 'alarm link tangential');
  const line = [];
  for (const [label, over] of [['reference', null], ['as built', fork ? fork.rows : null]]) {
    const v = I.lineSpecEvaluate(ref('alarm link tangential'), drive.out, over, L).out;
    const q = L.seat(v.run, v.rodTravel);
    const bad = L.seat(v.run, v.rodTravel * 1.1);
    line.push({ label, run: v.run, rodTravel: v.rodTravel, colH: v.colH, q, ratio: v.ratio,
      ctlS1: bad.tailLen * bad.theta - v.rodTravel });
  }
  // M1 — the pin against the tangent at the nose, at rest
  const find = (n) => { let r = null; clock.scene.traverse((o) => { if (!r && o.isMesh && o.name === n && !o.userData.schematic) r = o; }); return r; };
  const nose = find('alarmLinkBeak'), pin = find('alarmLinkBeakPin'), skirt = find('alarmColSkirt');
  const cast = find('alarmColCastellations'), base = find('alarmColBase');
  I.enterAxis(clock); clock.scene.updateMatrixWorld(true);
  pin.updateWorldMatrix(true, false);
  const ax = new THREE.Vector3(0, 1, 0).transformDirection(pin.matrixWorld);
  const W = skirt.getWorldPosition(new THREE.Vector3());
  const N = new THREE.Box3().setFromObject(nose).getCenter(new THREE.Vector3());
  const nr = { x: N.x - W.x, y: N.y - W.y }; const nl = Math.hypot(nr.x, nr.y);
  const pinTan = Math.abs((-nr.y * ax.x + nr.x * ax.y) / (nl * Math.hypot(ax.x, ax.y)));
  // M3 — the law's contact, posed through the two axes
  const arm = nose.parent;
  const AX = Object.fromEntries(I.AXES.map((a) => [a.name, a]));
  const poses = [['toggle 0', AX.alarmToggle.pose(0)], ['toggle 0.5', AX.alarmToggle.pose(0.5)]];
  for (let i = 0; i < 64; i++) poses.push([`press ${(i / 64).toFixed(4)}`, AX.alarmPress.pose(i / 64)]);
  const contact = (scale) => {
    const rows = [];
    for (const [label, pose] of poses) {
      I.enterAxis(clock); clock.setPose(pose);
      if (scale !== 1) arm.rotation.y *= scale;
      clock.scene.updateMatrixWorld(true);
      const d0 = Math.min(I.meshClearance(nose, cast, 1), I.meshClearance(nose, base, 1));
      // how deep it stands in the cut METAL: lifted off the wheel (the arm's
      // frame carries the fold, so the lift is in the PARENT's z), bisected to
      // the height at which it first clears both bodies
      const z0 = arm.position.z;
      const clearAt = (dz) => { arm.position.z = z0 + dz; arm.updateMatrixWorld(true); return Math.min(I.meshClearance(nose, cast, 1), I.meshClearance(nose, base, 1)) > 0; };
      let lo = 0, hi = 0.05;
      if (clearAt(1e-6)) hi = 1e-6; else for (let k = 0; k < 16; k++) { const m = (lo + hi) / 2; if (clearAt(m)) hi = m; else lo = m; }
      arm.position.z = z0; arm.updateMatrixWorld(true);
      rows.push({ label, tilt: arm.rotation.y, d0, burial: hi });
    }
    I.enterAxis(clock);
    return rows;
  };
  // the lift must be AWAY from the wheel in the cluster's frame (+z there): read it
  I.enterAxis(clock); clock.scene.updateMatrixWorld(true);
  const zW0 = new THREE.Box3().setFromObject(nose).min.z;
  const z0 = arm.position.z; arm.position.z = z0 + 1e-3; arm.updateMatrixWorld(true);
  const zW1 = new THREE.Box3().setFromObject(nose).min.z;
  arm.position.z = z0; arm.updateMatrixWorld(true);
  const law = contact(1), ctl = contact(0.9);
  // the cut's own fidelity: makeColumnWheel samples each column's half-arc at
  // M = round(9·edge/flank) stations and the mesh is straight between them,
  // while the law reads profileAt exactly, so at a concave corner (a flank's
  // foot) the metal's chord stands up to slope·spacing/4 above the law
  const ud = cast.parent.userData, edge = ud.colFlatHalf + ud.colFlank;
  const Mst = Math.max(2, Math.round(9 * (edge / ud.colFlank)));
  const chordBound = (ud.colH / ud.colFlank) * (2 * edge / (2 * Mst)) / 4;
  return { warns: null, line, pinTan, chordBound, flank: clock.beakPivot.flank, lever: clock.beakLever, law, ctl,
    liftSign: Math.sign(zW1 - zW0), foldDet: arm.parent.matrixWorld.determinant() };
});

const fails = [], ctrl = [];
const ok = (c, msg) => { if (!c) fails.push(msg); };
ok(warns.length === 0, `boot not silent: ${warns.slice(0, 3).join(' | ')}`);
console.log('TODO 240 — the tangential beak lever');
for (const r of R.line) {
  const q = r.q;
  console.log(`  ${r.label.padEnd(9)} run ${r.run.toFixed(4)}  beak ${q.beakLen.toFixed(4)}  tail ${q.tailLen.toFixed(4)}  ratio ${(q.beakLen / q.tailLen).toFixed(4)}  θs ${q.theta.toFixed(5)}  lift ${q.lift.toFixed(4)}  corner ${q.deepest.toFixed(9)} / colH ${r.colH.toFixed(9)}`);
  ok(Math.abs(q.deepest - r.colH) <= 1e-9, `S1 ${r.label}: the deepest corner ${q.deepest} is not on the gap floor ${r.colH}`);
  ok(Math.abs(q.tailLen * q.theta - r.rodTravel) <= 1e-12, `S2 ${r.label}: tail·θs ${q.tailLen * q.theta} ≠ the stroke ${r.rodTravel}`);
  ok(Math.abs(q.beakLen / q.tailLen - q.seatDrop / r.rodTravel) <= 1e-9 && Math.abs(q.beakLen / q.tailLen - r.ratio) <= 1e-12, `S3 ${r.label}: the ratio is not seat drop over stroke`);
  ok(Math.abs(q.beakLen - q.tailLen - r.run) <= 1e-12, `S4 ${r.label}: beak − tail ${q.beakLen - q.tailLen} ≠ run ${r.run}`);
  if (!(Math.abs(r.ctlS1) > 1e-6)) ctrl.push(`S1/S2 control at ${r.label}: a 10% wrong stroke still closed (${r.ctlS1})`);
}
console.log(`  M1 the pin's component along the tangent at the nose: ${R.pinTan.toExponential(3)}`);
ok(R.pinTan <= 1e-9, `M1: the pin leans ${R.pinTan} toward the wheel's tangent at the nose`);
for (const f of R.flank) {
  const frac = f.alongPin_N / f.climb_N;
  console.log(`  M2 r ${f.r.toFixed(3)} α ${f.alphaDeg.toFixed(1)}°: the climb pushes ${(f.climb_N * 1000).toFixed(1)} mN in the lever's plane (the radial lever took it all along the pin); ${(f.alongPin_N * 1000).toFixed(2)} mN still along the pin (${(100 * frac).toFixed(1)}%), twist ${(f.twist_Nu * 1000).toFixed(1)} mN·u`);
  ok(frac > 0 && frac < 1 / 8, `M2 r ${f.r}: ${(100 * frac).toFixed(1)}% of the push along the pin`);
}
let worst0 = 0, worst1 = 0, worstAt = '', buryAt = '';
for (const r of R.law) {
  if (r.d0 > worst0) { worst0 = r.d0; worstAt = r.label; }
  if (r.burial > worst1) { worst1 = r.burial; buryAt = r.label; }
  ok(r.d0 <= 1e-4, `M3 ${r.label}: the posed nose stands ${r.d0.toFixed(5)} off the column (tilt ${r.tilt.toFixed(5)})`);
  ok(r.burial <= R.chordBound + 1e-4, `M3 ${r.label}: the posed nose stands ${r.burial.toFixed(5)} deep in the cut, past the mesh's own chord bound ${R.chordBound.toFixed(5)}`);
}
console.log(`  M3 over ${R.law.length} poses: the posed nose's worst gap to the cut ${worst0.toExponential(2)} (${worstAt}); its deepest stand in the metal ${worst1.toFixed(5)} (${buryAt}) against the cut's chord bound ${R.chordBound.toFixed(5)} (the fold's determinant ${R.foldDet.toFixed(0)})`);
const ctlMiss = R.ctl.filter((r) => r.d0 > 1e-3).length;
console.log(`  control: the tilt scaled 0.9 leaves the nose off the cut at ${ctlMiss} of ${R.ctl.length} poses`);
if (ctlMiss === 0) ctrl.push('M3 control: a 0.9-scaled tilt still read as touching everywhere');
if (ctrl.length) { console.log('\nCONTROL FAILED:\n  ' + ctrl.join('\n  ')); process.exit(2); }
if (fails.length) { console.log('\nFAIL:\n  ' + fails.join('\n  ')); process.exit(1); }
console.log('\nPASS — the line closes at both runs, the pin lies along the nose’s radius, the flank pushes in the lever’s plane, and the pose law rides the cut at every pose; both controls fail as they must');
await Promise.race([browser.close(), new Promise((r) => setTimeout(r, 4000))]);
process.exit(0);
