// §266 — THE HAMMER SPRING IS A SPRING NOW: does the fall law read √(k/I) off
// the metal, and is the metal there? ACCEPTANCE.
//
// TODO 128's blade was redrawn each frame from a fixed anchor to a moving
// bearing point and changed length by 36% of itself over the draw, so the
// fall's angular frequency was SOLVED from a chosen fall time and the blow's
// energy with it. §266 replaces it with a torsion spiral coaxial with the
// hammer's post (inner end in the hammer's collet, outer end on a rim stud),
// its rate sized from the alarm train's torque budget, and the fall is
// √(k/I) off the built ribbon and the built rotor. This probe boots the build
// and holds, off `__clock.acoustics` and the scene:
//   1. the fall law's identities — W² = k/I, the cos law's released energy
//      equal to the rotor's arrival AND to the elastica's own stored energy
//      between the draw and the wire (three readings of one number);
//   2. the line spec — the strip at the tail's height, t above SPRING_FLAT_U,
//      the strain at the draw on 0.9·σy/E, the lift's peak ON its budget
//      (ALARM_HSPIRAL_LIFT_SHARE of the strike arbor's torque at set-up,
//      recomputed here from the published inputs) and the mean spend under
//      the arbor's torque;
//   3. the metal — the blade and its stud are gone, the spiral, collet and
//      stud exist, the spiral is a morph that SWAPS FRAMES with the hammer's
//      angle (geometry id changes between rest, draw and wire — a spring
//      that did not breathe would pass every distance check), and at each of
//      those three poses its two ends sit within HANDOFF_TRACK_TOL of the
//      collet and the stud (the clamps are real, not posed beside the metal);
//   4. the cadence — the governor's law carries the lift's spend: the
//      record's gap at full and at empty recomputed here from k, the set-up,
//      the two ratios, the per-mesh efficiency, the spend, I_a, φ and ρ, and
//      the hammer window still holding the 1.5 ms fall;
//   5. a CONTROL: the pre-§266 arithmetic (a third of the free window) must
//      NOT reproduce the shipped W — a probe that could pass both programs
//      measures neither.
//
//   cd tools && node probe-266-hammer-spiral.mjs     (exit 1 on any failure)
//   node probe-266-hammer-spiral.mjs --json           (the measured payload)
import { chromium } from 'playwright';
import { spawn } from 'node:child_process';

const port = process.env.PORT || '8566';
const root = process.env.ROOT || '..';
const JSON_OUT = process.argv.includes('--json');

const srv = spawn('python3', ['-m', 'http.server', port, '--bind', '127.0.0.1'], { cwd: root, stdio: 'ignore' });
process.on('exit', () => srv.kill());
await new Promise((r) => setTimeout(r, 900));
const browser = await chromium.launch();
const page = await browser.newPage();
const warns = [];
page.on('console', (m) => { if (m.type() === 'warning' && !/GroupMarker|GL Driver|ExtendedTriangle/.test(m.text())) warns.push(m.text()); });
await page.goto(`http://127.0.0.1:${port}/index.html`, { waitUntil: 'load', timeout: 240000 });
await page.waitForFunction(() => !!window.__clock || !!window.__bootError, null, { timeout: 240000 });

const out = await page.evaluate(async () => {
  const I = await import('./src/inspect.js');
  const THREE = await import('./vendor/three.module.js');
  const C = window.__clock;
  if (window.__bootError) return { bootError: String(window.__bootError) };
  const A = C.acoustics, S = A.spring;
  const eq = C.equalisation.alarm, c = eq.cadence;
  const scene = C.scene;
  const byName = (n) => scene.getObjectByName(n);
  const spiral = byName('alarmHammerSpiral'), collet = byName('alarmHammerCollet'), stud = byName('alarmHammerStud');
  const HS = spiral && spiral.userData.hammerSpiral;
  // the three poses — rest (pickup, the lift about to start), the release
  // (full draw) and the wire (the strike instant, read off the fall time)
  const base = { tau: 0.13, crownPullT: 0, leverEngage: 0, tension: 1, alarmOn: 1, alarmReleased: 1 };
  const gapAtFull = c.gapFull_s;
  const poses = { rest: 0.38, drawn: 0.9999, wire: A.hammer.fall_s / gapAtFull };
  const seats = {};
  for (const [name, ph] of Object.entries(poses)) {
    C.setPose({ ...base, alarmStrikePhase: ph });
    scene.updateMatrixWorld(true);
    seats[name] = {
      hammerRot: byName('alarmHammerArm').parent.rotation.z,
      frame: spiral ? spiral.userData.spiralFrame : null,
      geoId: spiral ? spiral.geometry.id : null,
      toCollet: spiral && collet ? I.meshClearance(spiral, collet, 1.0) : null,
      toStud: spiral && stud ? I.meshClearance(spiral, stud, 1.0) : null,
    };
  }
  C.resetInputs();
  return {
    tol: I.HANDOFF_TRACK_TOL, spring: S, hammer: A.hammer, strike: A.strike, cadence: c,
    alarmK: eq.k_Nm_per_rad, setupRad: eq.setup.sweepRad, HS: HS && { ...HS, frameRows: undefined },
    meshes: { blade: !!byName('alarmHammerSpring'), bladeStud: !!byName('alarmHammerSpringStud'), spiral: !!spiral, collet: !!collet, stud: !!stud,
      spiralIsMesh: !!(spiral && spiral.isMesh), spiralScaleZ: spiral && spiral.scale.z, frames: spiral && spiral.userData.spiralFrames && spiral.userData.spiralFrames.length },
    seats,
    layout: { SPRING_FLAT_U: 0.05 / 0.379, tailT: 0.5 },
  };
});
await browser.close();
srv.kill();
if (out.bootError) { console.error('BOOT FAILED:', out.bootError); process.exit(1); }
if (JSON_OUT) { console.log(JSON.stringify(out, null, 1)); process.exit(0); }

const S = out.spring, H = out.hammer, c = out.cadence, HS = out.HS, m = out.meshes;
const rows = [];
const row = (what, ok, got, need) => rows.push({ what, ok: !!ok, got, need });
const rel = (a, b) => Math.abs(a / b - 1);
const DRAW = S.wind_rad[1], AMP = -S.wind_rad[0];
// 1 — identities
row('W² = k/I', rel(S.W_rad_s ** 2, S.k_Nm_per_rad / S.I_kgm2) < 1e-9, `${S.W_rad_s.toFixed(2)} rad/s`, `√(${S.k_Nm_per_rad.toExponential(4)} / ${S.I_kgm2.toExponential(4)})`);
row('fall = acos(−AMP/DRAW)/W', rel(H.fall_s, Math.acos(-AMP / DRAW) / S.W_rad_s) < 1e-9, `${(H.fall_s * 1000).toFixed(3)} ms`, 'the cos law');
row('released energy = rotor arrival', rel(S.release_J, out.strike.energy_J) < 1e-9, `${(S.release_J * 1e6).toFixed(3)} µJ`, `${(out.strike.energy_J * 1e6).toFixed(3)} µJ (½Iθ̇²)`);
row('released energy = elastica stored between draw and wire', rel(S.release_J, S.storedAtDraw_J - S.storedAtWire_J) < 1e-9, `${(S.release_J * 1e6).toFixed(3)} µJ`, `${((S.storedAtDraw_J - S.storedAtWire_J) * 1e6).toFixed(3)} µJ`);
row('the acoustics block and the fall law read one rotor', rel(H.I_kgm2, S.I_kgm2) < 1e-9, H.I_kgm2.toExponential(4), S.I_kgm2.toExponential(4));
// 2 — the line spec
row('strip at the tail\'s height', rel(S.b_u, out.layout.tailT) < 1e-6, `${S.b_u.toFixed(4)} u`, `ALARM_TAIL_T ${out.layout.tailT}`);
row('strip above flat-spring stock', S.t_u >= out.layout.SPRING_FLAT_U, `${S.t_mm.toFixed(4)} mm`, '≥ 0.05 mm (SPRING_FLAT_U)');
row('strain at the draw on its target', S.strainMax <= S.strainTarget * (1 + 1e-9) && S.strainMax >= S.strainTarget * (1 - 1e-6), S.strainMax.toExponential(5), `${S.strainTarget.toExponential(5)} (0.9·σy/E)`);
const budget = S.liftShare * S.arborTqSetup_Nm;
row('lift peak ON its budget', rel(S.liftPeak_Nm, budget) < 1e-6, `${S.liftPeak_Nm.toExponential(5)} N·m`, `${S.liftShare} × ${S.arborTqSetup_Nm.toExponential(5)} (strike arbor at set-up)`);
const arborSetup = out.alarmK * out.setupRad * c.meshEffPer / c.strikeRatio;
row('strike arbor torque at set-up re-derived', rel(S.arborTqSetup_Nm, arborSetup) < 1e-9, S.arborTqSetup_Nm.toExponential(5), `${arborSetup.toExponential(5)} (k·setup·η/ratio)`);
row('mean lift spend under the arbor\'s torque', S.liftSpend_Nm < S.arborTqSetup_Nm, `${(100 * S.liftSpend_Nm / S.arborTqSetup_Nm).toFixed(1)}% of it`, '< 100% (or the train stalls at the ring\'s end)');
row('mean spend = lift work / lobe pitch', rel(S.liftSpend_Nm, S.liftWork_J / (Math.PI / 2)) < 1e-9, S.liftSpend_Nm.toExponential(5), `${(S.liftWork_J / (Math.PI / 2)).toExponential(5)}`);
// 3 — the metal
row('the blade and its stud are gone', !m.blade && !m.bladeStud, `blade ${m.blade}, stud ${m.bladeStud}`, 'neither in the scene');
row('spiral, collet and stud exist', m.spiral && m.collet && m.stud, `${m.spiral}/${m.collet}/${m.stud}`, 'all three meshes');
row('the strip stands on edge', m.spiralIsMesh && rel(m.spiralScaleZ, S.b_u / S.t_u) < 1e-9, `scale.z ${m.spiralScaleZ && m.spiralScaleZ.toFixed(4)}`, `b/t ${(S.b_u / S.t_u).toFixed(4)}`);
row('frames published for the schematic', m.frames === S.frames && m.frames >= 5, `${m.frames}`, `${S.frames}`);
const sr = out.seats;
row('the spiral breathes: three poses, three frames', sr.rest.geoId !== sr.drawn.geoId && sr.drawn.geoId !== sr.wire.geoId && sr.rest.frame !== sr.drawn.frame, `frames ${sr.rest.frame}/${sr.drawn.frame}/${sr.wire.frame}`, 'distinct geometries at rest, draw and wire');
row('the drawn pose is the draw', Math.abs(Math.abs(sr.drawn.hammerRot) - DRAW) < 1e-3, sr.drawn.hammerRot.toFixed(4), `±${DRAW}`);
for (const [name, s] of Object.entries(sr)) {
  row(`inner end seated in the collet (${name})`, s.toCollet !== null && s.toCollet <= out.tol, s.toCollet === null ? 'unmeasured' : s.toCollet.toFixed(4), `≤ HANDOFF_TRACK_TOL ${out.tol}`);
  row(`outer end seated on the stud (${name})`, s.toStud !== null && s.toStud <= out.tol, s.toStud === null ? 'unmeasured' : s.toStud.toFixed(4), `≤ HANDOFF_TRACK_TOL ${out.tol}`);
}
// 4 — the cadence carries the spend
const lawAt = (w) => 2 * c.teethPerStrike * Math.sqrt(2 * c.phiRad * c.I_kgm2
  / ((out.alarmK * (out.setupRad + w * 2 * Math.PI) * c.meshEffPer / c.strikeRatio - c.liftSpend_Nm) * c.meshEffPer / c.govRatio * c.rho));
row('gap at design re-derived with the spend', rel(c.gapAtDesign_s, lawAt(c.designWindTurns)) < 1e-9, c.gapAtDesign_s.toFixed(5), `${lawAt(c.designWindTurns).toFixed(5)} (design ${c.designGap_s})`);
row('gap at full re-derived with the spend', rel(c.gapFull_s, lawAt(1.75)) < 1e-9, c.gapFull_s.toFixed(5), lawAt(1.75).toFixed(5));
row('gap at empty re-derived with the spend', rel(c.gapEmpty_s, lawAt(0)) < 1e-9, c.gapEmpty_s.toFixed(5), lawAt(0).toFixed(5));
row('hammer window at the fastest gap', c.hammerWindow.ok && c.hammerWindow.fall_s <= c.hammerWindow.freeAtFastest_s, `${(c.hammerWindow.fall_s * 1000).toFixed(2)} ms fall`, `≤ ${(c.hammerWindow.freeAtFastest_s * 1000).toFixed(1)} ms free`);
// 5 — the control: §25's chosen third of the window must not be what shipped
const freeS = (1 - 0.62) * c.designGap_s, wOld = Math.acos(-AMP / DRAW) / (freeS / 3);
row('CONTROL — the chosen-third law does NOT reproduce W', rel(S.W_rad_s, wOld) > 0.5, `${S.W_rad_s.toFixed(1)} rad/s`, `far from ${wOld.toFixed(1)} (a third of the free window)`);
row('boot silent', warns.length === 0, `${warns.length} warning(s)`, '0');

console.log('§266 — the hammer\'s torsion spiral, held off the metal\n');
console.log(`  strip     ${S.t_mm.toFixed(4)} mm × ${(S.b_u * 0.379).toFixed(3)} mm, ${S.coils} turns, ${S.devLen_mm.toFixed(2)} mm developed (r ${S.innerR_u.toFixed(3)}–${S.outerR_u.toFixed(3)} u)`);
console.log(`  rate      k ${S.k_Nm_per_rad.toExponential(4)} N·m/rad (energy rate; secant ${S.kSecant_Nm_per_rad.toExponential(4)}, pure ${S.kPure_Nm_per_rad.toExponential(4)})`);
console.log(`  the fall  W ${S.W_rad_s.toFixed(1)} rad/s over I ${S.I_kgm2.toExponential(4)} kg·m² → ${(H.fall_s * 1000).toFixed(3)} ms; the blow ${(S.release_J * 1e6).toFixed(2)} µJ, ${H.v_ms.toFixed(3)} m/s at the face`);
console.log(`  the lift  peak ${S.liftPeak_Nm.toExponential(4)} N·m on a budget of ${budget.toExponential(4)} (${S.liftShare} × the strike arbor at set-up); mean spend ${S.liftSpend_Nm.toExponential(4)}`);
console.log(`  cadence   ${c.gapFull_s.toFixed(4)} s full → ${c.gapEmpty_s.toFixed(4)} s empty, ${c.ringSeconds.toFixed(2)} s ring; I_a ${c.I_kgm2.toExponential(4)}, ring section ${c.ring.section_mm.toFixed(4)} mm`);
console.log(`  stud      r ${S.stud.r_u.toFixed(4)} u at ${S.stud.rho_u.toFixed(3)} u / ${S.stud.psiDeg.toFixed(1)}° from the post, ${S.stud.load_mN.toFixed(1)} mN\n`);
let bad = 0;
for (const r of rows) { if (!r.ok) bad++; console.log(`  ${r.ok ? 'PASS' : 'FAIL'}  ${r.what}: ${r.got} — need ${r.need}`); }
for (const w of warns) console.log('  WARN', w);
console.log(bad ? `\n${bad} FAILED` : '\nALL PASS');
process.exit(bad ? 1 : 0);
