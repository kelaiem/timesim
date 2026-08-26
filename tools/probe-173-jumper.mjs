// §173 ACCEPTANCE — THE SAUTOIR, MEASURED AGAINST WHAT THE CLICK FAILED.
//
// This file replaces tools/probe-90-click.mjs, which measured TODO 90 finding
// 3: the switch click failing four ways at once. Every check below is the
// direct inverse of one of those four, at the same poses, with the same two
// controls — because a probe that only ever agrees with the thing it measures
// is a probe nobody can trust when it comes back green.
//
//   finding 3.1  NO DETENT. Restoring torque was zero at all 12 stops (both
//                parities landed the ball on a flat concentric with the axis).
//                → here: dr/dθ and F·dr/dθ non-zero at all 12, measured by
//                  stepping the SHIPPED law rather than a re-implementation.
//   finding 3.2  THE SPRING NEVER TOUCHED THE ARM (2.0963 at every pose).
//                → here: the blade IS the follower, so the question becomes
//                  whether the member is one connected body — asserted by
//                  triangle contact between blade, shank and tip.
//   finding 3.3  THE BLADE WAS OVER-STRAINED (≈2.2 GPa).
//                → here: crest strain against SPRING_STRAIN_MAX, from the
//                  section actually built rather than the one solved for.
//   finding 3.4  THE ARM INTERPENETRATED THE COLUMNS (110/130 triangle pairs
//                at the two poses; the BALL did not, which is how four earlier
//                passes missed it).
//                → here: the tip is the ONLY member allowed in the tooth
//                  space. Every other jumper mesh against every wheel body,
//                  triangle-level, over the whole pitch — and the tip against
//                  the two bodies it must never touch.
//
// TWO CONTROLS, kept from the file this replaces. A must-hit pair proves the
// intersection test is wired up at all (probe-90-click's own history: an
// earlier version called a non-exported helper, got `null` every time and
// reported "0 intersections" having tested nothing), and a must-miss pair
// proves it is not simply returning true.
import { chromium } from 'playwright';
import { spawn } from 'node:child_process';

const srv = spawn('python3', ['-m', 'http.server', '8531', '--bind', '127.0.0.1'], { cwd: '..', stdio: 'ignore' });
await new Promise((r) => setTimeout(r, 900));
const b = await chromium.launch();
const p = await b.newPage();
p.on('pageerror', (e) => console.log('PAGEERROR', String(e)));
await p.goto('http://127.0.0.1:8531/index.html?hud=0&sync=0', { waitUntil: 'load', timeout: 90000 });
await p.waitForFunction(() => !!window.__clock, null, { timeout: 90000 });

const out = await p.evaluate(async () => {
  const THREE = await import('./vendor/three.module.js');
  const BVH = await import('./vendor/three-mesh-bvh.module.js');
  const clock = window.__clock;
  const J = clock.jumperLaw;
  const find = (n) => { let r = null; clock.scene.traverse((o) => { if (o.name === n) r = o; }); return r; };
  const N = (n) => { const m = find(n); if (!m) throw new Error('no mesh named ' + n); return m; };

  // The intersection test, built here rather than borrowed: bvhFor is not an
  // export and a helper that resolves to undefined returns null forever.
  const tree = new Map();
  const bvh = (m) => {
    if (!tree.has(m.uuid)) {
      const g = m.geometry;
      if (!g.index) g.setIndex([...Array(g.getAttribute('position').count).keys()]);
      g.boundsTree = new BVH.MeshBVH(g);
      tree.set(m.uuid, g.boundsTree);
    }
    return tree.get(m.uuid);
  };
  const one = (a, c) => {
    bvh(a); bvh(c);
    const m = new THREE.Matrix4().copy(c.matrixWorld).premultiply(new THREE.Matrix4().copy(a.matrixWorld).invert());
    return a.geometry.boundsTree.intersectsGeometry(c.geometry, m);
  };
  // BOTH DIRECTIONS, AND THEY MUST AGREE. `intersectsGeometry` falls back to a
  // CONTAINMENT test when no triangles cross, and containment asks whether the
  // other body is inside the BVH's own — which a small owner holding a large
  // other answers wrongly. Measured here, at the pose this probe first ran:
  // shank-as-owner said the shank met the skirt, skirt-as-owner said it did
  // not, and the geometry says 0.576 of clearance. So a one-directional answer
  // is not an answer. Agreement is required; a disagreement is REPORTED as
  // unresolved rather than resolved by whichever call was made first.
  // …and when they disagree, a THIRD method decides, because "unresolved" is
  // not an answer either. Both members in dispute here are turned cylinders,
  // so the distance from the cylinder's AXIS SEGMENT to the other body, less
  // its radius, is the separation exactly. The segment is SAMPLED rather than
  // read off vertices: a CylinderGeometry carries vertices only at its two end
  // rings, so a rod that CROSSES a band has no vertex in it (MODELING.md rule
  // 5 — this cluster has now paid for that lesson seven times).
  const axisGap = (cyl, other) => {
    bvh(other);
    const pr = cyl.geometry.parameters;
    const inv = new THREE.Matrix4().copy(other.matrixWorld).invert();
    const a = new THREE.Vector3(0, -pr.height / 2, 0).applyMatrix4(cyl.matrixWorld).applyMatrix4(inv);
    const c = new THREE.Vector3(0, pr.height / 2, 0).applyMatrix4(cyl.matrixWorld).applyMatrix4(inv);
    let best = Infinity;
    const q = new THREE.Vector3(), t = {};
    for (let i = 0; i <= 96; i++) {
      q.lerpVectors(a, c, i / 96);
      const r = other.geometry.boundsTree.closestPointToPoint(q, t);
      if (r) best = Math.min(best, r.distance);
    }
    return best - pr.radiusTop;
  };
  const split = [];
  const hits = (a, c) => {
    const ac = one(a, c), ca = one(c, a);
    if (ac === ca) return ac;
    // `intersectsGeometry` falls back to a CONTAINMENT test when no triangles
    // cross, and containment asks whether the other body is inside the BVH's
    // own — which a small owner holding a large other answers wrongly.
    // Measured at the pose this probe first ran: shank-as-owner said the shank
    // met the skirt, skirt-as-owner said it did not, and the axis measurement
    // below says 0.576 of clearance. So a one-directional answer is not one.
    const cyl = a.geometry.type === 'CylinderGeometry' ? a : (c.geometry.type === 'CylinderGeometry' ? c : null);
    const gap = cyl ? axisGap(cyl, cyl === a ? c : a) : null;
    split.push({ a: a.name, b: c.name, aOwner: ac, bOwner: ca, axisGap: gap === null ? null : +gap.toFixed(4) });
    return gap === null ? true : gap <= 0;   // undecidable ⇒ report it as a hit, the safe direction
  };
  // The tip's SEAT is measured, not intersected: it is solved to exact
  // tangency, and tangency is the one case a triangle test cannot answer
  // stably. Distance from the tip's AXIS to the skirt, minus the tip's radius,
  // is the same quantity `sawSeatAt` produced — so this is geometry.js's
  // polygon law checked against the metal that was actually extruded.
  const seatGap = (tipMesh, skirtMesh) => {
    bvh(skirtMesh);
    const ax = new THREE.Vector3();
    tipMesh.getWorldPosition(ax);
    ax.applyMatrix4(new THREE.Matrix4().copy(skirtMesh.matrixWorld).invert());
    const t = {};
    const r = skirtMesh.geometry.boundsTree.closestPointToPoint(ax, t);
    return r ? r.distance - tipMesh.geometry.parameters.radiusTop : null;
  };

  const JUMPER = ['alarmJumperBlade', 'alarmJumperShank', 'alarmJumperTip', 'alarmJumperStud'].map(N);
  const WHEEL = ['alarmColBase', 'alarmColCastellations', 'alarmColSkirt'].map(N);
  const tip = N('alarmJumperTip');

  // ————— 3.1  A DETENT EXISTS AT EVERY STOP THE WHEEL TAKES —————
  // Stepped through the SHIPPED law (J.seatR, the same sawSeatAt the skirt is
  // extruded from), because a probe that re-derives the profile measures its
  // own arithmetic. dθ is a hundredth of a pitch: small enough to sit on one
  // flank, large enough that the difference is not float noise.
  const dth = J.sawPitch / 100;
  const stops = [];
  for (let k = 0; k < 12; k++) {
    const a = k * J.pitch / 2;                       // the wheel's own stops — half a column pitch apart
    const r0 = J.seatR(a), rF = J.seatR(a + dth), rB = J.seatR(a - dth);
    const defl0 = (r0 - J.seat) + J.preload;         // model units
    const dFwd = (rF - r0) / dth, dBwd = (rB - r0) / dth;
    stops.push({
      stop: k,
      seated: +(r0 - J.seat).toFixed(9),             // 0 ⇒ the tip is home at this stop
      drFwd: +dFwd.toFixed(4), drBwd: +dBwd.toFixed(4),
      tqFwd_Nmm: +(J.k_N_per_m * defl0 * 3.788e-4 * dFwd * 0.3788).toExponential(4),
    });
  }

  // ————— 3.4  THE TIP IS THE ONLY MEMBER IN THE TOOTH SPACE —————
  // Swept over a whole pitch AND both alarm states, since setPose banks the
  // wheel to integer steps and the flank is only reachable through the law.
  const trespass = [], contact = [];
  const SWEEP = 24;
  for (const alarmOn of [0, 1]) {
    clock.setPose({ tau: 0.13, crownPullT: 0, leverEngage: 0, tension: 1, windAccumTurns: 0, alarmOn });
    for (let i = 0; i <= SWEEP; i++) {
      J.poseJumper((i / SWEEP) * J.sawPitch);
      clock.scene.updateMatrixWorld(true);
      contact.push(+seatGap(tip, N('alarmColSkirt')).toFixed(6));
      for (const j of JUMPER) for (const w of WHEEL) {
        if (j === tip && w.name === 'alarmColSkirt') continue;   // the working contact — measured, not intersected
        if (!hits(j, w)) continue;
        trespass.push({ jumper: j.name, wheel: w.name, alarmOn, frac: +(i / SWEEP).toFixed(3) });
      }
    }
  }

  // ————— 3.2  THE PART IS ONE CONNECTED BODY —————
  // The click's arm and the blade said to press it were 2.0963 apart. Here the
  // spring and the follower are one member, so what has to be true is that its
  // three meshes actually touch each other.
  clock.resetInputs(); clock.scene.updateMatrixWorld(true);
  const joints = [
    ['alarmJumperBlade', 'alarmJumperStud'], ['alarmJumperBlade', 'alarmJumperShank'],
    ['alarmJumperShank', 'alarmJumperTip'],
  ].map(([a, c]) => ({ a, b: c, touching: hits(N(a), N(c)) }));

  // ————— 3.3  THE SECTION, READ OFF THE BUILT MESH —————
  // Not off jumperLaw's own w/t: the solve and the metal parting is exactly
  // what this is for. The blade is a box, so its two smallest world extents
  // ARE its thickness and width.
  // Off the geometry's OWN parameters, not a world bounding box: the blade
  // stands at 217° and a rotated box's AABB is bigger than the box in two of
  // three axes, which read 5.4815 for a 0.7029 blade the first time this ran.
  const bp = N('alarmJumperBlade').geometry.parameters;
  const ext = [bp.height, bp.depth, bp.width];
  const strain = 3 * (J.preload + J.throw_u) * J.t / (2 * J.L * J.L);

  // ————— THE CONTROLS —————
  // A bore on a stud is a RUNNING FIT — it does not intersect, which is what
  // the first must-hit control here got wrong. The positive control is built
  // instead: a box deliberately placed inside the base disc, so it is a true
  // positive by construction rather than by belief about the movement.
  const probeBox = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1));
  N('alarmColBase').getWorldPosition(probeBox.position);
  probeBox.position.x += 3;   // well inside the disc's annulus, clear of its bore
  probeBox.updateMatrixWorld(true);
  const ctrl = {
    mustHit: hits(N('alarmColBase'), probeBox),
    mustMiss: hits(N('alarmJumperStud'), N('alarmColBase')),  // the anchor, 12 u out and a band below
    split,
  };

  return {
    stops, trespass, contact, joints, ctrl,
    section: { thin: ext[0], wide: ext[1], t: J.t, w: J.w },
    strain, strainMax: 0.004 + 1e-12,
    forces: { seat_mN: J.fSeat_mN, crest_mN: J.fCrest_mN, window: [5, 50] },
    flanks: J.flanksDeg, detent_Nmm: J.detent_Nmm,
  };
});

const bad = [];
const zeroTq = out.stops.filter((s) => Math.abs(s.tqFwd_Nmm) < 1e-9 || Math.abs(s.drFwd) < 1e-6);
const offSeat = out.stops.filter((s) => Math.abs(s.seated) > 1e-6);
if (!out.ctrl.mustHit) bad.push('CONTROL: the must-hit pair reported no intersection — the test is not wired up, so every clean row below is meaningless');
if (out.ctrl.mustMiss) bad.push('CONTROL: the must-miss pair reported an intersection — the test returns true regardless');
if (zeroTq.length) bad.push(`finding 3.1 NOT closed: ${zeroTq.length} of 12 stops have zero restoring torque`);
if (offSeat.length) bad.push(`finding 3.1 NOT closed: ${offSeat.length} of 12 stops are off the seat`);
if (out.trespass.length) bad.push(`finding 3.4 NOT closed: ${out.trespass.length} trespassing contacts (a member other than the tip in the wheel's space)`);
const seatMax = Math.max(...out.contact.map(Math.abs));
if (seatMax > 1e-4) bad.push(`finding 3.1 NOT closed: the tip stands up to ${seatMax} from the teeth over the pitch — the built skirt and sawSeatAt's polygon disagree, so the seat is not on the metal`);

for (const j of out.joints) if (!j.touching) bad.push(`finding 3.2 NOT closed: ${j.a} does not touch ${j.b} — the jumper is not one connected body`);
if (out.strain > out.strainMax) bad.push(`finding 3.3 NOT closed: crest strain ${out.strain.toExponential(3)} over ${out.strainMax}`);
if (Math.abs(out.section.thin - out.section.t) > 1e-6 || Math.abs(out.section.wide - out.section.w) > 1e-6)
  bad.push(`the built blade measures ${out.section.thin} × ${out.section.wide} against the solved ${out.section.t} × ${out.section.w} — the solve and the metal have parted`);
if (!(out.forces.seat_mN >= out.forces.window[0] && out.forces.crest_mN <= out.forces.window[1]))
  bad.push(`the detent forces ${out.forces.seat_mN}..${out.forces.crest_mN} mN leave SELECTOR_DETENT_WINDOW_MN ${out.forces.window}`);
if (out.flanks.cliff > 1e-6) bad.push(`the backward flank is ${out.flanks.cliff}° off radial — the un-index proof is geometric and needs it radial`);

console.log('§173 — the sautoir, against TODO 90 finding 3\n');
console.log('  stop   seated    dr/dθ fwd   dr/dθ bwd   forward torque');
for (const s of out.stops)
  console.log('   ' + String(s.stop).padStart(2) + '   ' + String(s.seated).padStart(8)
    + '   ' + String(s.drFwd).padStart(9) + '   ' + String(s.drBwd).padStart(9) + '   ' + s.tqFwd_Nmm);
console.log(`\n  tip⇄skirt gap over the pitch: worst |${seatMax.toExponential(2)}|   trespassing contacts: ${out.trespass.length}`);
for (const t of out.trespass.slice(0, 8)) console.log('    ' + JSON.stringify(t));
console.log('  joints: ' + out.joints.map((j) => `${j.a}⇄${j.b} ${j.touching ? 'touching' : 'APART'}`).join(', '));
console.log(`  blade section built ${out.section.thin} × ${out.section.wide} (solved ${out.section.t.toFixed(4)} × ${out.section.w.toFixed(4)})`);
console.log(`  crest strain ${out.strain.toExponential(3)} of ${out.strainMax}   forces ${out.forces.seat_mN.toFixed(2)}..${out.forces.crest_mN.toFixed(2)} mN in ${out.forces.window}`);
console.log(`  flanks: ramp ${out.flanks.ramp.toFixed(2)}° off radial, cliff ${out.flanks.cliff.toFixed(4)}°   forward detent ${out.detent_Nmm.toExponential(3)} N·mm`);
console.log(`  controls: must-hit ${out.ctrl.mustHit}, must-miss ${out.ctrl.mustMiss}`);
if (out.ctrl.split.length) {
  const seen = new Map();
  for (const s of out.ctrl.split) seen.set(s.a + '⇄' + s.b, s);
  console.log(`  ${out.ctrl.split.length} BVH direction disagreement(s), each settled by the axis measurement:`);
  for (const s of seen.values()) console.log(`    ${s.a}⇄${s.b}  owners ${s.aOwner}/${s.bOwner}  axis gap ${s.axisGap}`);
}
console.log('  tip⇄skirt gap samples: ' + out.contact.map((v) => v.toFixed(4)).join(' '));
console.log(bad.length ? '\nFAIL\n  ' + bad.join('\n  ') : '\nPASS — all four of finding 3 closed');
await b.close(); srv.kill();
process.exit(bad.length ? 1 : 0);
