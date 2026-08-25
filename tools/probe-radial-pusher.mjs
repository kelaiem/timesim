// Could the alarm pusher's stem point at the movement's CENTRE — a real
// case pusher bored radially through the band — instead of running parallel
// to a radius, displaced sideways by the drive offset?
//
// The coupling needs one thing from the line: a perpendicular offset d from
// the COLUMN WHEEL's centre, with the stroke straddling the foot. It does not
// care where the line sits otherwise. So the same d can be had by ROTATING
// the line's azimuth instead of translating it, and the question is only what
// the rotated corridor runs into.
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

  // the wheel's station, and the offset the coupling requires
  let drive = null;
  clock.scene.traverse((o) => { if (o.userData && o.userData.drive) drive = o.userData.drive; });
  const stem = find('alarmPusherStem'), cap = find('alarmPusherCap');
  const sb = new THREE.Box3().setFromObject(stem), cb = new THREE.Box3().setFromObject(cap);
  // the press line, read off the built metal: cap centre → stem's inner end
  const capC = cb.getCenter(new THREE.Vector3());
  // the column wheel's centre in world
  let wheelC = null;
  { const w = find('alarmColBase'); const wb = new THREE.Box3().setFromObject(w);
    wheelC = wb.getCenter(new THREE.Vector3()); }
  return {
    plateR: clock.plateR,
    wheel: [+wheelC.x.toFixed(4), +wheelC.y.toFixed(4)],
    wheelR: +Math.hypot(wheelC.x, wheelC.y).toFixed(4),
    wheelAz: +(Math.atan2(wheelC.y, wheelC.x) * 180 / Math.PI).toFixed(4),
    capCentre: [+capC.x.toFixed(4), +capC.y.toFixed(4)],
    capR: +Math.hypot(capC.x, capC.y).toFixed(4),
    stemSpan: { min: sb.min.toArray().map((v) => +v.toFixed(3)), max: sb.max.toArray().map((v) => +v.toFixed(3)) },
    driveOffset: drive ? null : null,
  };
});
const W = out.wheelR, azW = out.wheelAz;
console.log(`plate radius ${out.plateR}`);
console.log(`column wheel at r ${W}, azimuth ${azW}°`);
console.log(`pusher cap centre at r ${out.capR}, azimuth ${(Math.atan2(out.capCentre[1], out.capCentre[0]) * 180 / Math.PI).toFixed(4)}°`);
const d = 5.012260;   // ALARM_DRIVE_OFFSET — the coupling's requirement
const delta = Math.asin(d / W) * 180 / Math.PI;
console.log(`\nthe coupling needs perpendicular offset d = ${d} from the wheel's centre.`);
console.log(`  TODAY: the line is PARALLEL to the radius at the wheel's azimuth, displaced ${d} sideways.`);
console.log(`         so it misses the movement centre by ${d}, and crosses the case band`);
console.log(`         ${(Math.asin(d / out.capR) * 180 / Math.PI).toFixed(3)}° off the band's own normal — a tube bored askew.`);
console.log(`  RADIAL: a line THROUGH the centre at azimuth (wheelAz ± ${delta.toFixed(4)}°) passes the`);
console.log(`         wheel at exactly ${(W * Math.sin(delta * Math.PI / 180)).toFixed(5)} — the same d, by rotation instead of translation.`);
console.log(`         Δ = asin(d / |ALARM_COL_POS|) = asin(${(d / W).toFixed(5)})`);
await b.close(); srv.kill();
