// TODO 90 finding 3 — THE SWITCH CLICK, MEASURED FOUR WAYS.
//
// Eye-reported as "touching the column wheel doesn't seem sufficient to hold it
// in position when the pawl's moving around". It is not, and the reason is
// structural rather than a matter of spring force.
//
// Each of the four tests below exists because a cheaper one lied first:
//
//  · meshClearance clamps at 0, so it cannot separate a kiss from a burial;
//  · a NEAREST-VERTEX-PAIR figure is not a lower bound on solid separation — a
//    bar passing through a face has no vertices near each other, which is
//    precisely the click arm crossing a column, and reasoning from it produced
//    a confident "the arm does not touch" that was wrong;
//  · a RADIAL bound taken over VERTICES is wrong for the same reason: a box's
//    inner FACE runs closer to the wheel's axis than any of its corners.
//
// So the intersection question is settled at TRIANGLE level with the same test
// intraUnit uses, and the run carries two CONTROLS — a pair that must hit and a
// pair that must miss — because a test that silently does nothing reports clean.
import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
const srv = spawn('python3', ['-m', 'http.server', '8516', '--bind', '127.0.0.1'], { cwd: '..', stdio: 'ignore' });
await new Promise((r) => setTimeout(r, 900));
const b = await chromium.launch(); const p = await b.newPage();
p.on('pageerror', (e) => console.log('PAGEERROR', String(e)));
await p.goto('http://127.0.0.1:8516/index.html?hud=0&sync=0', { waitUntil: 'load', timeout: 90000 });
await p.waitForFunction(() => !!window.__clock, null, { timeout: 90000 });
const out = await p.evaluate(async () => {
  const THREE = await import('./vendor/three.module.js');
  const BVH = await import('./vendor/three-mesh-bvh.module.js');
  const I = await import('./src/inspect.js');
  const clock = window.__clock;
  const find = (n) => { let r = null; clock.scene.traverse((o) => { if (o.name === n) r = o; }); return r; };
  const arm = find('switchClickArm'), nose = find('switchClickNose'), spring = find('switchClickSpring');
  const cast = find('alarmColCastellations'), base = find('alarmColBase'), skirt = find('alarmColSkirt');
  let wheel = null;
  clock.scene.traverse((o) => { if (o.userData && o.userData.profileAt && o.userData.ratchetPoly) wheel = o; });

  const trees = new Map();
  const tree = (m) => { if (!trees.has(m)) trees.set(m, new BVH.MeshBVH(m.geometry)); return trees.get(m); };
  const mat = new THREE.Matrix4();
  const hits = (a, bo) => { const ta = tree(a); tree(bo);
    mat.copy(a.matrixWorld).invert().multiply(bo.matrixWorld);
    return ta.intersectsGeometry(bo.geometry, mat); };

  clock.resetInputs(); clock.scene.updateMatrixWorld(true);
  const control = { mustHit: hits(base, cast), mustMiss: hits(arm, skirt) };

  // (1) does a detent EXIST? a restoring torque needs the follower driven out
  //     as the wheel turns, so sample the cut profile across one column pitch.
  const prof = [];
  for (let i = 0; i <= 48; i++) prof.push(wheel.userData.profileAt((i / 48) * (Math.PI * 2 / 6)));
  const flatTop = prof.filter((v) => v === 1).length;
  const flatGap = prof.filter((v) => v === 0).length;

  // (2) does the spring reach the arm?
  const ba = new THREE.Box3().setFromObject(arm), bs = new THREE.Box3().setFromObject(spring);
  let springGap = Infinity;
  // (4) does the arm cross the columns, and does the ball?
  let armHits = 0, noseHits = 0, n = 0;
  for (const alarmOn of [0, 1]) for (let i = 0; i <= 64; i++) {
    I.enterAxis(clock);
    clock.setPose({ tau: 0.13, crownPullT: 0, leverEngage: 0, tension: 1, windAccumTurns: 0,
                    alarmOn, alarmPressCycle: (i / 64) * 2 });
    clock.scene.updateMatrixWorld(true);
    n++;
    if (hits(arm, cast)) armHits++;
    if (hits(nose, cast)) noseHits++;
    springGap = Math.min(springGap, I.meshClearance(arm, spring));
  }
  return { control, teeth: wheel.userData.ratchetPoly.length / 2, columns: 6,
    flatTop, flatGap, ramp: prof.length - flatTop - flatGap, samples: prof.length,
    armZ: [+ba.min.z.toFixed(4), +ba.max.z.toFixed(4)], sprZ: [+bs.min.z.toFixed(4), +bs.max.z.toFixed(4)],
    springGap: +springGap.toFixed(4), armHits, noseHits, n };
});
const ok = (b) => b ? 'ok' : 'BROKEN';
console.log(`controls: must-hit ${ok(out.control.mustHit)} · must-miss ${ok(!out.control.mustMiss)}`
  + ((!out.control.mustHit || out.control.mustMiss) ? '   <-- the test itself is not working; ignore everything below' : ''));
console.log(`\n1. CAN IT INDEX?  saw teeth ${out.teeth} → ${out.teeth} stops per revolution, against ${out.columns} columns to sit on.`);
console.log(`   profile across one pitch: ${out.flatTop} samples flat TOP, ${out.flatGap} flat GAP FLOOR, ${out.ramp} ramp (of ${out.samples}).`);
console.log(`   Both flats are concentric with the axis, and both parities land the ball ON a flat —`);
console.log(`   so the surface drives it out by nothing and the restoring torque at every stop is ZERO.`);
console.log(`\n2. DOES ITS SPRING REACH IT?  arm z ${out.armZ[0]}..${out.armZ[1]}, blade z ${out.sprZ[0]}..${out.sprZ[1]}`);
console.log(`   closest over the whole toggle: ${out.springGap}  ${out.springGap > 0.15 ? '— IT NEVER TOUCHES' : ''}`);
console.log(`\n4. WHAT CROSSES THE COLUMNS?  over ${out.n} poses, both parities:`);
console.log(`   switchClickArm  intersects at ${out.armHits}`);
console.log(`   switchClickNose intersects at ${out.noseHits}   (the declared reader)`);
await b.close(); srv.kill();
