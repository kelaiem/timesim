// §170 — IS THE PRESS LINE RADIAL? Measured, not asserted.
//
// The press DIRECTION was always radial; the LINE was that radius displaced
// sideways by ALARM_PUSH_CHORD, so its axis missed the movement's centre and
// crossed the case band off the band's own normal — a pusher tube bored askew,
// which no cased watch has. §170 rotates the line instead of translating it,
// keeping the perpendicular offset the pin-in-slot coupling requires.
//
// The number that matters is the angle between the STEM'S OWN AXIS and the
// RADIUS THROUGH ITS CAP, because that is the angle a case-maker would have to
// bore at. The first cut of this probe computed it as asin(d / capR) from the
// old construction and printed it as a fact — which stayed plausible after the
// fix and was no longer a measurement of anything. It is read off the built
// metal now: two points on the stem give its axis, the cap gives the radius.
import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
const srv = spawn('python3', ['-m', 'http.server', '8486', '--bind', '127.0.0.1'], { cwd: '..', stdio: 'ignore' });
await new Promise((r) => setTimeout(r, 900));
const b = await chromium.launch(); const p = await b.newPage();
p.on('pageerror', (e) => console.log('PAGEERROR', String(e)));
await p.goto('http://127.0.0.1:8486/index.html?hud=0&sync=0', { waitUntil: 'load', timeout: 90000 });
await p.waitForFunction(() => !!window.__clock, null, { timeout: 90000 });
const out = await p.evaluate(async () => {
  const THREE = await import('./vendor/three.module.js');
  const clock = window.__clock;
  const find = (n) => { let r = null; clock.scene.traverse((o) => { if (o.name === n) r = o; }); return r; };
  clock.resetInputs(); clock.scene.updateMatrixWorld(true);

  // THE STEM'S AXIS, from the metal: a cylinder's axis is the line joining the
  // centroids of its two end rings, which is what its own rotation carries.
  const stem = find('alarmPusherStem');
  const axis = new THREE.Vector3(0, 1, 0).applyQuaternion(stem.getWorldQuaternion(new THREE.Quaternion()));
  const cap = find('alarmPusherCap');
  const C = new THREE.Box3().setFromObject(cap).getCenter(new THREE.Vector3());
  const S = stem.getWorldPosition(new THREE.Vector3());

  // the angle between the stem's axis and the radius through the cap — the
  // angle a case-maker bores at. Both flattened to the case band's plane.
  const a2 = new THREE.Vector2(axis.x, axis.y).normalize();
  const rad = new THREE.Vector2(C.x, C.y).normalize();
  const bore = Math.acos(Math.min(1, Math.abs(a2.dot(rad)))) * 180 / Math.PI;

  // and how far the line's own axis passes from the movement's centre: the
  // perpendicular distance from the origin to the line through S along axis.
  const miss = Math.abs(S.x * -a2.y + S.y * a2.x);

  // the offset the coupling needs, still measured against the wheel
  const W = new THREE.Box3().setFromObject(find('alarmColBase')).getCenter(new THREE.Vector3());
  const wheelPerp = Math.abs((W.x - S.x) * -a2.y + (W.y - S.y) * a2.x);
  return {
    plateR: +clock.plateR.toFixed(4),
    wheelR: +Math.hypot(W.x, W.y).toFixed(4),
    wheelAz: +(Math.atan2(W.y, W.x) * 180 / Math.PI).toFixed(4),
    capR: +Math.hypot(C.x, C.y).toFixed(4),
    capAz: +(Math.atan2(C.y, C.x) * 180 / Math.PI).toFixed(4),
    stemAxisAz: +(Math.atan2(a2.y, a2.x) * 180 / Math.PI).toFixed(4),
    boreAngle: +bore.toFixed(4),
    missesCentreBy: +miss.toFixed(5),
    offsetFromWheel: +wheelPerp.toFixed(5),
  };
});
console.log(`plate radius ${out.plateR}   column wheel r ${out.wheelR} az ${out.wheelAz}°`);
console.log(`pusher cap    r ${out.capR} az ${out.capAz}°   ·  stem axis bearing ${out.stemAxisAz}°\n`);
console.log(`  the press line misses the movement's centre by   ${out.missesCentreBy}`);
console.log(`  angle between the stem's axis and its cap's radius ${out.boreAngle}°   ← what a case-maker bores at`);
console.log(`  perpendicular offset from the WHEEL's centre      ${out.offsetFromWheel}   ← what the coupling needs`);
const radial = out.missesCentreBy < 1e-3 && out.boreAngle < 1e-3;
console.log('\n' + (radial
  ? 'RADIAL — the line passes through the centre and the tube is bored on the band\'s own normal.'
  : 'NOT RADIAL — the line is displaced, and the tube would be bored askew by the angle above.'));
await b.close(); srv.kill();
