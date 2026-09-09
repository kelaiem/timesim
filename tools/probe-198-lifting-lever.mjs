// §198 — THE RING LEAVES THE PLATE: does the strike chain still close through
// the lifting lever, and did the annulus buy the pitch it was taken for?
// ACCEPTANCE. Measures the built metal over a whole strike cycle — never the
// build's own constants — and fails on any of: the lever's tip parting from
// the hammer's tail at any phase (the corner's restoring answer is that
// contact), the nose off the cam's flank mid-rise or on it mid-fall, a
// lever⇄hammer ratio that is not 1 at rest, a blow that is not radial, a
// fundamental off TODO 17's 2.5 kHz, a foot that had to walk, gong or hammer
// metal outside the annulus's walls or the ring over its declared ceiling, or
// a cam whose base and pickup radii are not §25's.
//
// What this is NOT: probe-197-gong-loudness re-derives the acoustic chain
// (level, μ, contact time) a second way and stays the gate for those; this
// one holds the FOLD — positions, contacts, senses, ratio — which §197 had no
// lever to ask about. probe-back-envelope holds what the hammer's swing does
// to the caseback. Neither of those knows the lever exists.
//
// Controls, both directions: the nose arm must intersect its own post (the
// riveted boss — a must-hit), and the gong arc must stand far from the
// lever's nose (a must-miss); a run in which either fails has measured the
// wrong thing.
//
// Run from tools/: node probe-198-lifting-lever.mjs   (PORT=, ROOT= as usual)
import { spawn } from 'node:child_process';
import { chromium } from 'playwright';

const port = process.env.PORT || '8532';
const root = process.env.ROOT || '..';
const srv = spawn('python3', ['-m', 'http.server', port, '--bind', '127.0.0.1'], { cwd: root, stdio: 'ignore' });
process.on('exit', () => srv.kill());
await new Promise((r) => setTimeout(r, 900));
const browser = await chromium.launch();
const page = await browser.newPage();
const warns = [];
page.on('console', (m) => { if (m.type() === 'warning' || m.type() === 'error') warns.push(m.text()); });
page.on('pageerror', (e) => warns.push('PAGEERROR ' + e.message));
await page.goto(`http://127.0.0.1:${port}/index.html`, { waitUntil: 'load', timeout: 90000 });
await page.waitForFunction(() => !!window.__clock, null, { timeout: 90000 });

const out = await page.evaluate(async () => {
  const THREE = await import('./vendor/three.module.js');
  const I = await import('./src/inspect.js');
  const clock = window.__clock;
  const A = JSON.parse(JSON.stringify(clock.acoustics));
  const base = { tau: 0.13, crownPullT: 0, leverEngage: 0, tension: 1, alarmOn: 1, alarmReleased: 1 };
  const mesh = (name) => clock.scene.getObjectByName(name);
  const liftPivot = mesh('alarmLiftNose').parent, hamPivot = mesh('alarmHammerHead').parent;
  const rows = [
    { label: 'tip ⇄ tail', unitA: 'Alarm lifting lever', meshA: 'alarmLiftTip', unitB: 'Alarm hammer', meshB: 'alarmTail' },
    // The NOSE is the sampled side: measureHandoffsNow reads A's vertices
    // against B's surface, and an extrusion's vertices all sit on its two
    // caps — the cam's caps stand 0.15 beyond the nose's faces in z, so
    // sampled the other way round the row read 0.150 at every phase while
    // the point sat exactly on the flank (the instruments skill's "vertices
    // are not the surface", met here on the first run).
    { label: 'cam ⇄ nose', unitA: 'Alarm lifting lever', meshA: 'alarmLiftNose', unitB: 'Alarm striking wheel', meshB: 'alarmCam' },
    // must-hit: the two arms share their root corners at the pivot (0 by construction)
    { label: 'CONTROL hit: nose arm ⇄ far arm', unitA: 'Alarm lifting lever', meshA: 'alarmLiftNose', unitB: 'Alarm lifting lever', meshB: 'alarmLiftTip' },
    { label: 'CONTROL miss: arc ⇄ nose', unitA: 'Alarm gong', meshA: 'alarmGongArc', unitB: 'Alarm lifting lever', meshB: 'alarmLiftNose' },
  ];
  // 1 — the contacts over one cycle, at phases coprime to nothing in
  // particular: 40 samples of the fraction, the rise and the fall both seen.
  const cycle = [];
  for (let k = 0; k < 40; k++) {
    const u = (k + 0.5) / 40;
    clock.setPose({ ...base, alarmStrikePhase: 3 + u });
    clock.scene.updateMatrixWorld(true);
    const m = I.measureHandoffsNow(clock, { handoffs: rows });
    cycle.push({ u, hammer: hamPivot.rotation.z, lever: liftPivot.rotation.z,
      tipTail: m[0].gap, camNose: m[1].gap, ctrlHit: m[2].gap, ctrlMiss: m[3].gap });
  }
  // 2 — the ratio at rest (small angles either side of pickup): dθL/dθH.
  const at = (u) => { clock.setPose({ ...base, alarmStrikePhase: 3 + u }); return { h: hamPivot.rotation.z, l: liftPivot.rotation.z }; };
  const r0 = at(0.385), r1 = at(0.40);
  const ratioRest = (r1.l - r0.l) / (r1.h - r0.h);
  const rDraw = at(0.999);
  // 3 — the blow's direction: the head's FACE centre — the point the build
  // declares (faceR_u on the free end's azimuth), carried by the pivot group
  // — differenced across the fall's last step before the wire. The pivot
  // stands on the tangent there, so THIS point's motion is the radial one;
  // the head's box centre sits behind it and moves 8° off, and a vertex
  // picked by radius jumps between corners as the head turns (both were
  // tried first and both measured the instrument, not the blow).
  const a1 = A.hammer.freeEndAzDeg * Math.PI / 180;
  const faceRest = new THREE.Vector3(Math.cos(a1) * A.hammer.faceR_u, Math.sin(a1) * A.hammer.faceR_u, 0);
  clock.setPose({ ...base, alarmStrikePhase: 3 + 0.38 }); clock.scene.updateMatrixWorld(true);   // the hammer at rest: the face's declared station
  const faceLocal = hamPivot.worldToLocal(faceRest.clone().setZ(hamPivot.getWorldPosition(new THREE.Vector3()).z));
  const centre = () => { clock.scene.updateMatrixWorld(true); return hamPivot.localToWorld(faceLocal.clone()); };
  clock.setPose({ ...base, alarmStrikePhase: 3 + 0.10 }); const c0 = centre();
  clock.setPose({ ...base, alarmStrikePhase: 3 + 0.12 }); const c1 = centre();
  const v = { x: c1.x - c0.x, y: c1.y - c0.y };
  const az = Math.atan2(c0.y, c0.x), rad = { x: Math.cos(az), y: Math.sin(az) };
  const vLen = Math.hypot(v.x, v.y);
  const blowAngleDeg = Math.acos(Math.min(1, Math.abs(v.x * rad.x + v.y * rad.y) / vLen)) * 180 / Math.PI;
  const blowOutward = (v.x * rad.x + v.y * rad.y) > 0;
  // 4 — the annulus, AT REST (u = 0.38, the pickup — the hammer's angle is
  // 0 there): every vertex of the gong unit and of the hammer's head, arm,
  // post and spring stud inside the walls; the ring under its ceiling. (The
  // tail and the blade reach inboard over the plate by design — they ride
  // the lever's plane — so they are excluded by name; and the head swings
  // under the plate's rim at full draw by design too, which is the pair
  // sweep's to hold, so its full-draw reach is reported below, not gated.)
  clock.setPose({ ...base, alarmStrikePhase: 3 + 0.38 });
  clock.scene.updateMatrixWorld(true);
  const walls = { rIn: A.band.annulusIn_u, rOut: A.band.annulusOut_u, top: A.band.ceiling };
  const env = { rMin: Infinity, rMax: 0, zMax: -Infinity, zMin: Infinity, ringTop: -Infinity, outside: [] };
  const vv = new THREE.Vector3();
  for (const name of ['alarmGongArc', 'alarmGongPost', 'alarmHammerHead', 'alarmHammerArm', 'alarmHammerPost', 'alarmHammerSpringStud']) {
    const o = mesh(name); const p = o.geometry.attributes.position;
    let worst = 0;
    for (let i = 0; i < p.count; i++) {
      o.localToWorld(vv.fromBufferAttribute(p, i));
      const r = Math.hypot(vv.x, vv.y);
      env.rMin = Math.min(env.rMin, r); env.rMax = Math.max(env.rMax, r);
      env.zMax = Math.max(env.zMax, vv.z); env.zMin = Math.min(env.zMin, vv.z);
      if (name === 'alarmGongArc') env.ringTop = Math.max(env.ringTop, vv.z);
      worst = Math.max(worst, walls.rIn - r, r - walls.rOut);
    }
    if (worst > 1e-6) env.outside.push({ name, by: worst });
  }
  // the head's full-draw reach, reported
  clock.setPose({ ...base, alarmStrikePhase: 3 }); clock.scene.updateMatrixWorld(true);
  let headDrawRMin = Infinity, headDrawZMax = -Infinity;
  { const o = mesh('alarmHammerHead'); const p = o.geometry.attributes.position;
    for (let i = 0; i < p.count; i++) { o.localToWorld(vv.fromBufferAttribute(p, i)); headDrawRMin = Math.min(headDrawRMin, Math.hypot(vv.x, vv.y)); headDrawZMax = Math.max(headDrawZMax, vv.z); } }
  return { A, cycle, ratioRest, rDraw, blowAngleDeg, blowOutward, walls, env, headDrawRMin, headDrawZMax };
});
await browser.close();
srv.kill();

const { A, cycle, ratioRest, rDraw, blowAngleDeg, blowOutward, walls, env, headDrawRMin, headDrawZMax } = out;
const TOL = 0.03;   // HANDOFF_TRACK_TOL — the tessellation slack a contact may miss touch by
let bad = 0;
const say = (ok, msg) => { console.log(`${ok ? 'PASS' : 'FAIL'}  ${msg}`); if (!ok) bad++; };

console.log('§198 — the lifting lever, measured over one strike cycle (u = phase fraction; gaps in units, + air / 0 touch)');
console.log('   u     hammer   lever   tip⇄tail  cam⇄nose');
for (const c of cycle) console.log(`  ${c.u.toFixed(3)}  ${c.hammer.toFixed(4).padStart(7)}  ${c.lever.toFixed(4).padStart(7)}   ${c.tipTail.toFixed(4)}    ${c.camNose.toFixed(4)}`);
const tipWorst = Math.max(...cycle.map((c) => c.tipTail));
say(tipWorst <= TOL, `tip on tail at every phase — worst gap ${tipWorst.toFixed(4)} (tol ${TOL})`);
const rise = cycle.filter((c) => c.u > 0.42 && c.u < 0.97), fall = cycle.filter((c) => c.u > 0.02 && c.u < 0.36);
const riseWorst = Math.max(...rise.map((c) => c.camNose)), fallBest = Math.min(...fall.map((c) => c.camNose));
say(riseWorst <= TOL, `nose on the flank through the rise — worst gap ${riseWorst.toFixed(4)} over ${rise.length} phases`);
say(fallBest >= 0.15, `nose free of the cam through fall and rebound — least gap ${fallBest.toFixed(4)} (≥ CLEAR_MARGIN)`);
say(Math.max(...cycle.map((c) => c.ctrlHit)) < 1e-6, `CONTROL must-hit: the lever's two arms share their root (${Math.max(...cycle.map((c) => c.ctrlHit)).toExponential(1)})`);
say(Math.min(...cycle.map((c) => c.ctrlMiss)) > 5, `CONTROL must-miss: gong arc ⇄ nose stand apart (${Math.min(...cycle.map((c) => c.ctrlMiss)).toFixed(2)})`);
say(Math.abs(ratioRest + 1) < 0.02, `corner ratio at rest dθL/dθH = ${ratioRest.toFixed(4)} (a ratio of −1: equal arms, anti-parallel)`);
say(Math.abs(rDraw.l - A.lever.angleAtDraw_rad) < 2e-3 && Math.abs(rDraw.h - A.lever.hammerDraw_rad) < 2e-3,
  `at full draw the hammer stands ${rDraw.h.toFixed(4)} and the lever ${rDraw.l.toFixed(4)} — declared ${A.lever.hammerDraw_rad.toFixed(4)} / ${A.lever.angleAtDraw_rad.toFixed(4)}`);
say(blowAngleDeg < 1.5 && blowOutward === (A.hammer.blow > 0), `the blow is radial: ${blowAngleDeg.toFixed(2)}° off the radius, ${blowOutward ? 'outward' : 'inward'} (declared ${A.hammer.blow > 0 ? 'outward' : 'inward'})`);
const f1 = A.modes[0].f_Hz;
say(Math.abs(f1 / A.wire.targetF1_Hz - 1) < 5e-3, `fundamental ${f1.toFixed(1)} Hz against the ${A.wire.targetF1_Hz} Hz the annulus was taken for (TODO 127)`);
say(A.wire.footWalkedDeg === 0, `the foot walked ${A.wire.footWalkedDeg.toFixed(2)}° — no plate opening out here, so the arc is the design arc ${A.wire.designArcDeg.toFixed(2)}° (shipped ${A.wire.arcDeg.toFixed(2)}°)`);
say(env.outside.length === 0, `gong, block, head, arm, post and stud inside the annulus r ${walls.rIn.toFixed(3)}–${walls.rOut.toFixed(3)} (measured ${env.rMin.toFixed(3)}–${env.rMax.toFixed(3)})${env.outside.length ? ' — outside: ' + JSON.stringify(env.outside) : ''}`);
say(env.ringTop <= walls.top + 1e-6, `the ring's top ${env.ringTop.toFixed(4)} under its declared ceiling ${walls.top.toFixed(3)}`);
console.log(`      (at full draw the head reaches in to r ${headDrawRMin.toFixed(2)}, under the plate's rim, top z ${headDrawZMax.toFixed(2)} — the pair sweep's to hold)`);
const cam = A.lever.cam;
say(Math.abs(cam.base_u - cam.refBase_u) < 0.01 && Math.abs(cam.pickup_u - cam.refPickup_u) < 0.01,
  `cam base ${cam.base_u.toFixed(4)} / pickup ${cam.pickup_u.toFixed(4)} reproduce §25's ${cam.refBase_u.toFixed(4)} / ${cam.refPickup_u.toFixed(4)}; tip ${cam.tip_u.toFixed(4)} vs ${cam.refTip_u.toFixed(4)} is the declared fork (+${(cam.tip_u - cam.refTip_u).toFixed(4)})`);
say(A.strike.mu > 0.9 && A.strike.mu < 1.3, `impedance match μ = ${A.strike.mu.toFixed(3)} (the head solved to a quarter of the wire — H ${A.hammer.headH_u.toFixed(2)}, owned by the ${A.hammer.headHOwner}, match ${A.hammer.headHMatch_u.toFixed(2)}; the arm and tail add the rest)`);
console.log(`\n  level ${A.splA_dBA.toFixed(1)} dBA at 0.3 m, on axis — f₁ ${f1.toFixed(0)} Hz, f₂ ${A.modes[1].f_Hz.toFixed(0)} Hz; wire ⌀${A.wire.dia_mm.toFixed(3)} mm × ${A.wire.devLen_mm.toFixed(2)} mm at r ${A.wire.ringR_u.toFixed(2)}; head ${A.hammer.headH_u.toFixed(2)} × ${A.hammer.headL_u.toFixed(2)} u, ${A.hammer.headMass_mg.toFixed(1)} mg; blow ${(A.strike.energy_J * 1e9).toFixed(2)} nJ`);
const noise = warns.filter((w) => !/WebGL|GL Driver|GroupMarker|404|swiftshader/i.test(w));
say(noise.length === 0, `boot silent${noise.length ? ': ' + noise.join(' | ') : ''}`);
console.log(bad ? `\n${bad} FAILED` : '\nALL PASS');
process.exitCode = bad ? 1 : 0;
