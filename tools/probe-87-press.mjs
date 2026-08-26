// TODO 87 — THE PRESS STROKE, MEASURED FRAME BY FRAME AGAINST THE METAL.
//
// Item 87's first finding is that the pawl keeps travelling after the wheel has
// stopped: the tick clamps what the pawl carries at one tooth and latches, and
// the head is still going in. The figures the item quotes for that — one press
// carrying 117.4% of a tooth, 0.398 u of travel arriving after the latch — are
// ARITHMETIC ON THE SHIPPED CONSTANTS, and the item says so in those words.
// This probe is what promotes them to measurements, or refutes them.
//
// No instrument in the battery can see this. `alarmPusherT` does not appear
// anywhere in inspect.js: `resetInputs` and `setPose` both zero it, no axis
// varies it, and the `pusher pawl ⇄ ratchet skirt` hand-off row says of itself
// that it measures the PARK only — "the index STROKE is a transient the static
// poses cannot reach". The stroke exists exclusively in live frames, which is
// where a viewer reported seeing the pawl pass through the wheel.
//
// WHAT THIS MEASURES, and where each number comes from:
//
// · The trajectory, per frame, off the BUILT TREE rather than internal state
//   (there is no read path for alarmPusherT at all): the pawl's own world
//   displacement along the press line, and the wheel's rotation.
//
// · The pawl ⇄ ratchet-skirt separation as ONE SIGNED NUMBER per frame —
//   negative is a burial. `meshClearance` cannot answer this: it clamps a
//   contact to <= 0 and reports no depth. So the containment method is
//   probe-121-depth's, both directions, which is also why the skirt's tooth
//   tips entering the pawl's box are caught as well as the reverse.
//
//   AND ITS DEPTH ANSWERS A DIFFERENT QUESTION THAN THE ONE ITEM 87 ASKS.
//   closestPointToPoint measures to the NEAREST surface. The pawl's 0.24 of z
//   sits INSIDE the skirt's band with ~0.038 to each face, so every contained
//   sample's nearest surface is a face and the depth is CAPPED at that margin
//   however far the pawl advances in plane — which is why it barely moves
//   through a stroke that travels 2.7 u. The probe prints it as the z fact it
//   is, with both members' bands, and carries the in-plane advance separately
//   as the travel arriving after the latch. Two numbers, each labelled with
//   the question it answers; reading the first as a penetration depth would
//   understate this by two orders.
//
// · The moment arm, MEASURED as d(travel)/d(angle) while the pawl is still
//   carrying the wheel, so the 117.4% is re-derived from motion rather than
//   re-quoted from ALARM_PUSH_TRAVEL / ALARM_PAWL_ARM (both module-private,
//   which is a feature here).
//
// TRAPS PAID FOR ONCE:
//
// · rAF eats the stroke. frame() runs advanceFrame(realDt) on its own, and an
//   automated pane throttles to ~1 fps with a large accumulated realDt, so one
//   stray frame swallows a 0.24 s press between two evaluate() calls. The whole
//   trace therefore runs inside ONE page.evaluate with beginSweepHold() up.
//
// · The wheel's three bodies used to share one name `alarmColWheel` (item 87's
//   own finding — one INTRA_UNIT_CONTACTS row waived all three). Step 4 named
//   them apart at the builder, so the skirt is selected by name; the geometric
//   test that used to do the selecting is kept as a CHECK on the name, because
//   a name is a claim and the geometry can settle it.
//
// · A sampling rate can manufacture an extremum. The ramp is linear in dt, so
//   a finer step should sample the same trajectory — asserted, not assumed, by
//   running the whole trace at two rates and comparing the worst reading.
//
// Run: cd tools && node probe-87-press.mjs
//      node tools/probe-87-press.mjs press-trace.json
import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import { writeFileSync } from 'node:fs';

const port = process.env.PORT || '8465';
const root = process.env.ROOT || '..';
const srv = spawn('python3', ['-m', 'http.server', port, '--bind', '127.0.0.1'], { cwd: root, stdio: 'ignore' });
await new Promise((r) => setTimeout(r, 900));
const browser = await chromium.launch();
const page = await browser.newPage();
const warns = [];
page.on('pageerror', (e) => console.log('PAGEERROR', String(e)));
page.on('console', (m) => { if (m.type() === 'warning') warns.push(m.text()); });
await page.goto(`http://127.0.0.1:${port}/index.html?hud=0&sync=0`, { waitUntil: 'load', timeout: 90000 });
await page.waitForFunction(() => !!window.__clock, null, { timeout: 90000 });

const V = await page.evaluate(async () => {
  const clock = window.__clock;
  const THREE = await import('./vendor/three.module.js');
  await import('./src/inspect.js');           // patches BufferGeometry with computeBoundsTree
  const fail = [];
  const round = (x, n = 4) => +x.toFixed(n);

  // ---- the members ------------------------------------------------------
  const unit = clock.labelEntries.find((e) => e.name === 'Alarm switch');
  if (!unit) return { fail: ['no `Alarm switch` unit in labelEntries'] };
  // §163 — TWO members now, where one used to do both jobs. The pusher's bar
  // was rigid on the head, so its own displacement WAS the press travel and its
  // own return WAS the head's. The driving member is a sprung pawl on a driver
  // pivoted on the wheel's arbor: it rotates, its angle is the output of a seat
  // solve, and its world position answers a different question from the head's.
  // TRAVEL and the RETURN are read off the head; CONTACT off the pawl's nose.
  let pawl = null, head = null; const wheelMeshes = [];
  unit.obj.traverse((o) => {
    if (o.userData && o.userData.schematic) return;   // §71: flagged display is not metal
    if (!o.isMesh) return;
    // §163 — the driving member left the pusher. It is a shaped, sprung pawl on
    // a driver pivoted on the wheel's own arbor, and the body that TOUCHES the
    // saw is its NOSE, which is what this probe was reading the pusher's bar for.
    if (o.name === 'alarmColPawlNose') pawl = o;
    if (o.name === 'alarmPusherCap') head = o;
    if (/^alarmCol(Base|Castellations|Skirt)$/.test(o.name)) wheelMeshes.push(o);
  });
  if (!pawl) fail.push('no mesh named `alarmColPawlNose` — §163 moved the driving member off the pusher');
  if (!head) fail.push('no mesh named `alarmPusherCap`');
  if (wheelMeshes.length !== 3) fail.push(`expected the wheel's 3 named bodies, found ${wheelMeshes.length}`);

  // TODO 87 step 4 named the three bodies apart, so the skirt is SELECTED by
  // name — and then the geometric test that used to do the selecting is kept
  // as a CHECK on the name. A name is a claim about which body this is; the
  // geometry can settle it, so it does, and a mis-named body fails here
  // rather than being measured as if it were the right one.
  const described = wheelMeshes.map((m) => {
    m.geometry.computeBoundingBox();
    const bb = m.geometry.boundingBox;
    let rMax = 0;
    const p = m.geometry.attributes.position;
    for (let i = 0; i < p.count; i++) rMax = Math.max(rMax, Math.hypot(p.getX(i), p.getY(i)));
    return { m, name: m.name, type: m.geometry.type, zMin: bb.min.z, zMax: bb.max.z, rMax,
             tris: (m.geometry.index ? m.geometry.index.count : p.count) / 3 };
  });
  const named = described.find((d) => d.name === 'alarmColSkirt') || null;
  const belowAll = described.filter((d) => d.zMax <= 1e-6);            // entirely under the disc's mid-plane
  const widest = described.reduce((a, b) => (a.rMax >= b.rMax ? a : b)); // the saw's tips overhang the disc
  const buffers = described.filter((d) => d.type === 'BufferGeometry'); // the castellations, hand-emitted
  if (!named) fail.push('no mesh named `alarmColSkirt`');
  if (belowAll.length !== 1) fail.push(`skirt test A ambiguous: ${belowAll.length} meshes lie entirely below z=0`);
  if (named && belowAll.length === 1 && belowAll[0].m !== named.m)
    fail.push('the mesh NAMED alarmColSkirt is not the one lying under the disc — the builder named the wrong body');
  if (named && widest.m !== named.m)
    fail.push('the mesh NAMED alarmColSkirt is not the one reaching furthest out — the builder named the wrong body');
  if (buffers.length !== 1 || buffers[0].name !== 'alarmColCastellations')
    fail.push('the hand-emitted BufferGeometry is not the mesh named alarmColCastellations');
  const skirt = named;
  if (!skirt) fail.push('could not identify the ratchet skirt');
  if (fail.length) return { fail, described: described.map(({ m, ...d }) => ({ ...d, z: [round(d.zMin), round(d.zMax)] })) };

  // ---- the measurement (probe-121-depth's method, both directions) -------
  const v = new THREE.Vector3(), tgt = {};
  const parityRay = new THREE.Ray();
  const DIR = new THREE.Vector3(0.317, 0.591, 0.741).normalize();
  const insideTree = (tree, pLocal) => {
    parityRay.origin.copy(pLocal); parityRay.direction.copy(DIR);
    let n = 0;
    for (const h of tree.raycast(parityRay, THREE.DoubleSide)) if (h.distance > 1e-9) n++;
    return (n % 2) === 1;
  };
  const stat = (src, dst) => {
    src.updateWorldMatrix(true, false); dst.updateWorldMatrix(true, false);
    if (!dst.geometry.boundsTree) dst.geometry.computeBoundsTree();
    const tree = dst.geometry.boundsTree;
    const pos = src.geometry.attributes.position;
    const toDst = dst.matrixWorld.clone().invert().multiply(src.matrixWorld);
    let inN = 0, deep = 0, near = Infinity, threw = 0;
    for (let i = 0; i < pos.count; i++) {
      v.fromBufferAttribute(pos, i).applyMatrix4(toDst);
      try {
        const hit = tree.closestPointToPoint(v, tgt);
        if (hit && hit.distance < near) near = hit.distance;
        if (insideTree(tree, v)) { inN++; if (hit && hit.distance > deep) deep = hit.distance; }
      } catch { threw++; }
    }
    return { inN, n: pos.count, deep, near, threw };
  };
  // One signed number: + is a gap, − is a burial, 0 is touch (checkAlarmHandoffs'
  // own convention, re-implemented because its own version poses internally).
  const separation = () => {
    const a = stat(pawl, skirt.m), b = stat(skirt.m, pawl);
    const deep = Math.max(a.deep, b.deep);
    const inN = a.inN + b.inN;
    return { sep: inN ? -deep : Math.min(a.near, b.near), inN, deep, near: Math.min(a.near, b.near) };
  };

  // ---- the trace --------------------------------------------------------
  const wheelRoot = skirt.m.parent;    // the wheel group: the skirt turns with it
  const relAngle = (qNow, qRest) => 2 * Math.acos(Math.min(1, Math.abs(qNow.clone().invert().multiply(qRest).w)));

  const trace = (dt, presses) => {
    clock.resetInputs();
    for (let i = 0; i < 240; i++) clock.step(dt);   // settle: the wheel's own state is banked
    clock.scene.updateMatrixWorld(true);
    const pRest = head.getWorldPosition(new THREE.Vector3());
    const runs = [];
    for (let k = 0; k < presses; k++) {
      // Each press gets its OWN angular origin. A cumulative one would call
      // the second press's tooth "two teeth" and halve its delivered percent —
      // an artifact of the datum, not of the mechanism.
      const qRest = wheelRoot.getWorldQuaternion(new THREE.Quaternion());
      document.getElementById('btn-alarm').click();   // the only public door to pressAlarmPusher()
      const rows = [];
      let peak = 0, home = false;
      for (let i = 0; i < Math.ceil(1.5 / dt) && !home; i++) {
        clock.step(dt);
        clock.scene.updateMatrixWorld(true);
        const travel = head.getWorldPosition(new THREE.Vector3()).distanceTo(pRest);
        const angle = relAngle(wheelRoot.getWorldQuaternion(new THREE.Quaternion()), qRest);
        const s = separation();
        rows.push({ i, t: round(i * dt, 5), travel: round(travel, 5), angle: round(angle, 6),
                    shownA: round(clock.alarmDebug.alarmColShownA, 6),
                    sep: round(s.sep, 5), inN: s.inN, deep: round(s.deep, 5) });
        peak = Math.max(peak, travel);
        if (peak > 1e-3 && travel <= 1e-6 && i > 2) home = true;   // head back on its seat
      }
      runs.push({ press: k + 1, returnedHome: home, rows });
    }
    return { dt, runs };
  };

  // ---- what the trajectory says -----------------------------------------
  const derive = (run) => {
    const rows = run.rows;
    if (!rows.length) return { err: 'no frames' };
    const maxA = Math.max(...rows.map((r) => r.angle));
    // The latch: first frame at the wheel's final angle for this press.
    const latch = rows.find((r) => r.angle >= maxA - 1e-9) || rows[rows.length - 1];
    const bottom = rows.reduce((a, b) => (b.travel >= a.travel ? b : a));
    // The moment arm, from motion: head travel per radian of wheel while the
    // pawl still carries, over the widest pre-latch interval available. §163
    // makes this a MEAN rather than a constant — a pin in a radial slot has the
    // arm (d² + s²)/d, 5.012 at the foot rising to 5.372 at either end — so the
    // delivered percent below is the figure to read, not this.
    const carrying = rows.filter((r) => r.angle > 1e-6 && r.angle < maxA - 1e-9);
    const arm = carrying.length >= 2
      ? (carrying[carrying.length - 1].travel - carrying[0].travel) /
        (carrying[carrying.length - 1].angle - carrying[0].angle)
      : null;
    const worst = rows.reduce((a, b) => (b.sep <= a.sep ? b : a));
    // THE LATCH FALLS BETWEEN FRAMES, so the first frame AT the final angle is
    // already past it — by up to one frame of travel (0.047 u at 1/480, 0.19 at
    // 1/120), which would understate the overrun by exactly the sampling rate.
    // Pre-latch the wheel turns travel/arm exactly, so the latch travel is
    // arm × tooth: both measured here, neither quoted.
    // WHERE THE LATCH FALLS, and why this is no longer arm × tooth. The first
    // filing took the latch travel as the constant moment arm times the tooth,
    // because a rigid pawl on a straight line HAS a constant arm and the frame
    // grid understates the overrun by up to one frame of travel. §163's pin in
    // a radial slot has the arm (d² + s²)/d — 5.012 at the foot of the
    // perpendicular rising to 5.372 at either end — so arm × tooth is not a
    // travel the mechanism ever stands at, and using it makes the "overrun"
    // move with the step rate: measured, 0.134 at 1/120 against 0.022 at 1/480,
    // which is the probe reporting its own model rather than the metal.
    //
    // INTERPOLATED instead, off the trajectory itself: the wheel's angle is
    // monotone through the carry, so the head's travel at the moment it reaches
    // its final angle is a straight read between the two frames that straddle
    // it. That is rate-robust for the reason arm × tooth was not — it assumes
    // nothing about the arm.
    let latchTravelExact = null;
    for (let i = 1; i < rows.length; i++) {
      if (rows[i].angle >= maxA - 1e-12 && rows[i - 1].angle < maxA - 1e-12) {
        const a0 = rows[i - 1].angle, a1 = rows[i].angle;
        const f = a1 > a0 ? (maxA - a0) / (a1 - a0) : 1;
        latchTravelExact = rows[i - 1].travel + f * (rows[i].travel - rows[i - 1].travel);
        break;
      }
    }
    // The arm at either END of the coupling's swing, as local slopes — the two
    // numbers a varying arm actually has, where `arm` above is their mean.
    const slope = (a, b) => (b.angle - a.angle > 1e-9 ? (b.travel - a.travel) / (b.angle - a.angle) : null);
    const armEarly = carrying.length >= 3 ? slope(carrying[0], carrying[1]) : null;
    const armLate = carrying.length >= 3 ? slope(carrying[carrying.length - 2], carrying[carrying.length - 1]) : null;
    return {
      latchFrame: latch.i, latchAngle: latch.angle, latchTravel: latch.travel,
      latchTravelExact: latchTravelExact === null ? null : round(latchTravelExact, 5),
      bottomFrame: bottom.i, bottomTravel: bottom.travel,
      postLatchTravel: latchTravelExact === null ? null : round(bottom.travel - latchTravelExact, 5),
      postLatchTravelByFrame: round(bottom.travel - latch.travel, 5),
      armMeasured: arm === null ? null : round(arm, 4),
      armEarly: armEarly === null ? null : round(armEarly, 4),
      armLate: armLate === null ? null : round(armLate, 4),
      sweepRad: arm === null ? null : round(bottom.travel / arm, 5),
      toothRad: latch.angle,
      // WHAT ONE PRESS DELIVERS, read off the WHEEL rather than off a travel
      // divided by an arm. This is the question finding 1 asked, and it is the
      // one quantity in the run that no assumption about the coupling touches.
      deliveredPct: round(100 * latch.angle / (clock.jumperLaw.pitch / 2), 2),
      worstSep: worst.sep, worstFrame: worst.i, worstInN: worst.inN,
      buriedFrames: rows.filter((r) => r.sep < 0).length, frames: rows.length,
    };
  };

  // The two members' z bands, measured once. This is what explains a
  // containment DEPTH that barely moves through the stroke: closestPointToPoint
  // returns the distance to the NEAREST surface, and for two overlapping plates
  // that is the face, not the driving cliff. So the depth number below is the
  // z overlap — a static fact — and the in-plane advance is carried by the
  // post-latch travel instead. Saying which number answers which question is
  // the whole point of taking both.
  const worldZ = (m) => {
    m.updateWorldMatrix(true, false);
    const p = m.geometry.attributes.position, v2 = new THREE.Vector3();
    let lo = Infinity, hi = -Infinity;
    for (let i = 0; i < p.count; i++) {
      v2.fromBufferAttribute(p, i).applyMatrix4(m.matrixWorld);
      lo = Math.min(lo, v2.z); hi = Math.max(hi, v2.z);
    }
    return [lo, hi];
  };
  clock.scene.updateMatrixWorld(true);
  const zPawl = worldZ(pawl), zSkirt = worldZ(skirt.m);
  const zOverlap = Math.min(zPawl[1], zSkirt[1]) - Math.max(zPawl[0], zSkirt[0]);

  if (!clock.beginSweepHold || !clock.endSweepHold) return { fail: ['__clock has no beginSweepHold/endSweepHold — rAF would eat the stroke'] };
  clock.beginSweepHold();
  let coarse, fine;
  try {
    coarse = trace(1 / 120, 2);
    fine = trace(1 / 480, 2);
  } finally { clock.endSweepHold(); }

  const out = { fail, skirt: { tris: skirt.tris, z: [round(skirt.zMin), round(skirt.zMax)], rMax: round(skirt.rMax) },
                castellationTris: buffers[0].tris,
                zPawl: zPawl.map((x) => round(x)), zSkirt: zSkirt.map((x) => round(x)), zOverlap: round(zOverlap),
                toothStepPublic: round(clock.jumperLaw.pitch / 2, 6),   // half a pitch per actuation
                coarse: { dt: coarse.dt, runs: coarse.runs.map((r) => ({ press: r.press, returnedHome: r.returnedHome, ...derive(r) })) },
                fine: { dt: fine.dt, runs: fine.runs.map((r) => ({ press: r.press, returnedHome: r.returnedHome, ...derive(r) })) },
                rows: fine.runs.map((r) => ({ press: r.press, rows: r.rows })) };

  // ---- could this probe do its job? --------------------------------------
  for (const [name, t] of [['1/120', out.coarse], ['1/480', out.fine]]) {
    for (const r of t.runs) {
      if (!r.returnedHome) fail.push(`${name} press ${r.press}: the head never came back to its seat`);
      if (r.armMeasured === null) fail.push(`${name} press ${r.press}: too few carrying frames to measure the moment arm`);
      if (r.toothRad <= 1e-6) fail.push(`${name} press ${r.press}: the wheel never turned`);
    }
  }
  const cw = out.coarse.runs[0], fw = out.fine.runs[0];
  if (cw && fw && Math.abs(cw.worstSep - fw.worstSep) > 0.01)
    fail.push(`the worst separation moves with the step rate: ${cw.worstSep} at 1/120 vs ${fw.worstSep} at 1/480 — the probe is measuring its own sampling`);
  if (cw && fw && Math.abs(cw.postLatchTravel - fw.postLatchTravel) > 0.01)
    fail.push(`the overrun moves with the step rate: ${cw.postLatchTravel} at 1/120 vs ${fw.postLatchTravel} at 1/480 — the probe is measuring its own sampling`);
  // The MEAN arm is a secant over whatever frames the rate happened to give,
  // and §163's arm varies 7.18% end to end, so it is reported and not gated.
  // What must not move with the rate is the delivered tooth, which is read off
  // the wheel and assumes nothing about the coupling.
  if (cw && fw && Math.abs(cw.deliveredPct - fw.deliveredPct) > 0.05)
    fail.push(`the delivered tooth moves with the step rate: ${cw.deliveredPct}% at 1/120 vs ${fw.deliveredPct}% at 1/480 — the probe is measuring its own sampling`);
  if (fw && Math.abs(fw.toothRad - out.toothStepPublic) > 1e-3)
    fail.push(`the measured tooth ${fw.toothRad} disagrees with jumperLaw.pitch/2 = ${out.toothStepPublic}`);
  out.fail = fail;
  return out;
});

await browser.close();
srv.kill();

if (V.fail && V.fail.length && !V.fine) {
  console.error('probe could not run:');
  for (const f of V.fail) console.error('  · ' + f);
  if (V.described) console.error('  wheel meshes: ' + JSON.stringify(V.described));
  process.exit(1);
}

const f = V.fine.runs[0];
console.log(`\nTODO 87 — the alarm pusher's press, measured (dt 1/480, two presses)\n`);
console.log(`  ratchet skirt identified: ${V.skirt.tris} tris, z ${V.skirt.z[0]}..${V.skirt.z[1]}, reach ${V.skirt.rMax}`);
console.log(`  castellations (the BufferGeometry): ${V.castellationTris} tris\n`);

console.log('  frame     t      travel     angle      sep      inside');
const rows = V.rows[0].rows;
for (const r of rows.filter((_, i) => i % Math.ceil(rows.length / 22) === 0))
  console.log(`  ${String(r.i).padStart(5)}  ${String(r.t).padStart(6)}  ${String(r.travel).padStart(8)}`
    + `  ${String(r.angle).padStart(8)}  ${String(r.sep).padStart(8)}  ${String(r.inN).padStart(5)}`
    + (r.sep < 0 ? '  ← BURIED' : ''));

console.log(`\n  MEASURED, off the built tree:`);
console.log(`    moment arm (d travel / d angle)   ${f.armMeasured} u`);
console.log(`    one tooth (measured latch angle)  ${f.toothRad} rad   [jumperLaw.pitch/2 = ${V.toothStepPublic}]`);
console.log(`    one press carries                 ${f.sweepRad} rad = ${f.deliveredPct}% of a tooth`);
console.log(`    travel at the latch (arm × tooth) ${f.latchTravelExact} u`);
console.log(`    travel at the bottom             ${f.bottomTravel} u`);
console.log(`    IN-PLANE OVERRUN after the latch ${f.postLatchTravel} u`
  + `   [${f.postLatchTravelByFrame} if snapped to the frame grid — one frame of travel coarser]`);
console.log(`    frames sharing space with the skirt  ${f.buriedFrames} / ${f.frames}`);
console.log(`    containment depth, worst          ${(-f.worstSep).toFixed(5)} u — and it is CAPPED, see below`);
console.log(`      pawl z ${V.zPawl[0]}..${V.zPawl[1]} (${V.zOverlap} thick) sits INSIDE`);
console.log(`      skirt z ${V.zSkirt[0]}..${V.zSkirt[1]}, leaving ${((V.zSkirt[1] - V.zPawl[1])).toFixed(5)} to the`);
console.log(`      upper face and ${((V.zPawl[0] - V.zSkirt[0])).toFixed(5)} to the lower — so a contained sample's`);
console.log(`      NEAREST surface is a face, and closestPointToPoint can never report`);
console.log(`      more than that however far the pawl advances in plane. The depth`);
console.log(`      number is a z fact; the in-plane advance is the line above it.`);
console.log(`\n  ITEM 87 COMPUTED: 117.4% of a tooth, 0.398 u after the latch.`);
console.log(`  THIS RUN MEASURES: ${f.deliveredPct}% of a tooth, ${f.postLatchTravel} u after the latch.`);
console.log(`  Second press: ${V.fine.runs[1].deliveredPct}% of a tooth, ${V.fine.runs[1].postLatchTravel} u overrun.`);
console.log(`  Rate check: overrun ${V.coarse.runs[0].postLatchTravel} at 1/120 vs ${f.postLatchTravel} at 1/480;`
  + ` z overlap ${(-V.coarse.runs[0].worstSep).toFixed(5)} vs ${(-f.worstSep).toFixed(5)}.`);

writeFileSync(process.argv[2] || 'press-trace.json', JSON.stringify(V, null, 2));
console.log(`\n  per-frame rows written to ${process.argv[2] || 'press-trace.json'}`);

const noise = warns.filter((w) => !/WebGL|GroupMarker/.test(w));
if (noise.length) { console.log('\n  boot warnings:'); noise.forEach((w) => console.log('    W ' + w.slice(0, 300))); }

if (V.fail.length) {
  console.error('\nFAILURES:');
  for (const x of V.fail) console.error('  · ' + x);
  process.exit(1);
}
console.log('\nprobe OK');
