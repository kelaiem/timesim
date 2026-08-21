// §153 probe — symmetric reserve arc + barely-recessed sector, boot-level.
// Boots the sim headless, verifies boot silence, then measures the redesign's
// claims directly off the built scene:
//   1. the reserve hand's math angle at tension 0 / 0.5 / 1 lands on
//      90 + 75, 90, 90 − 75 (the symmetric anchor at both ends and centre);
//   2. the hand's world plane sits its lift BEYOND the visible face
//      (a proud rider), and the sector floor RESERVE_RECESS inside it;
//   3. the arbor's front end stops 0.2 short of the hand's plane.
import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
const port = '8523';
const srv = spawn('python3', ['-m', 'http.server', port, '--bind', '127.0.0.1'], { cwd: '..', stdio: 'ignore' });
await new Promise((r) => setTimeout(r, 900));
const b = await chromium.launch(); const p = await b.newPage();
const warns = [];
p.on('console', (m) => { if (m.type() === 'warning') warns.push(m.text()); });
await p.goto(`http://127.0.0.1:${port}/index.html`, { waitUntil: 'load', timeout: 90000 });
await p.waitForFunction(() => !!window.__clock, null, { timeout: 60000 });
const out = await p.evaluate(() => {
  const c = window.__clock;
  const scene = c.scene;
  let hand = null, arbor = null, floor = null;
  scene.traverse((o) => {
    if (o.name === 'reserveShaft') hand = o.parent.parent; // shaft → burRod group → hand group
    if (o.name === 'rsvHandArbor') arbor = o;
    if (o.name === 'reserveSubdialFace') floor = o;
  });
  const T = new window.__clock.scene.constructor().constructor; // noop
  const res = { warnsAtEval: true };
  // hand math angle seen from the front, at three tensions
  const angles = {};
  for (const t of [0, 0.5, 1]) {
    c.setPose({ tension: t });
    // hand group: find by traversing for the group whose child mesh is reserveShaft
    let g = null;
    scene.traverse((o) => { if (o.name === 'reserveShaft') g = o.parent.parent; });
    // local rotation.z of the hand group; front math angle = 90 + rot(deg)
    angles[t] = 90 + (g.rotation.z * 180 / Math.PI);
  }
  // world planes
  scene.updateMatrixWorld(true);
  let g = null;
  scene.traverse((o) => { if (o.name === 'reserveShaft') g = o.parent.parent; });
  const hv = new g.position.constructor();
  g.getWorldPosition(hv);
  const fz = (() => { // sector floor world z (its geometry is baked at dial coords, mesh at origin of dial group)
    floor.geometry.computeBoundingBox();
    const bb = floor.geometry.boundingBox.clone().applyMatrix4(floor.matrixWorld);
    return (bb.min.z + bb.max.z) / 2;
  })();
  arbor.geometry.computeBoundingBox();
  const ab = arbor.geometry.boundingBox.clone().applyMatrix4(arbor.matrixWorld);
  return {
    angles,
    handWorldZ: hv.z,
    floorWorldZ: fz,
    arborFrontZ: Math.min(ab.min.z, ab.max.z),
    arborBackZ: Math.max(ab.min.z, ab.max.z),
  };
});
console.log(JSON.stringify(out, null, 1));
const noise = warns.filter((w) => !/WebGL|GroupMarker|Automatic fallback/.test(w));
console.log('boot warns (filtered):', noise.length);
noise.forEach((w) => console.log('  W ' + w.slice(0, 400)));
await b.close(); srv.kill();
