// DOES THE ALARM PUSHER'S BUTTON STAY OUT OF THE CASE WALL UNTIL ITS STOP — ON
// EVERY CASE SHAPE? Acceptance (TODO 275). The head is solved (TODO 241) to land
// on the wall at the end of the carry, and the battery excuses it against the
// band BY NAME for that stop (`Alarm switch ⇄ Case` floors row,
// probe-case-relief's STOP set) — so a head whose RIM buries in the band reads
// as the stop, and did, on every form case, for as long as the head's face was
// square to a press line that crosses a form wall obliquely.
//
// What it measures, per case: rays cast ALONG THE PRESS LINE from far outboard
// on a grid across the button's disc, at alarmPress f = 0 … 0.49 and at the stop
// (0.5); the first hit is the outermost case metal under that point, read as its
// height over the button's inner face. Before the stop every height must be
// negative (clear); at the stop the largest must be the seat sink along the line
// times the wall's cosine to it — touch, not burial. Case vertices inside the
// button are counted too, and must be none short of the stop.
//
// THE CONTROL is the reason to believe a clean row: the same rays, read against
// a VIRTUAL face square to the press line through the same axis point — the head
// as it was cut before TODO 275 — must find metal past that face at the stop
// BEYOND THE SEAT SINK on every case whose wall the line crosses obliquely (any
// tilt over a degree). On the line itself that face is sunk exactly the sink, so
// anything more is the rim buried off the line, which is the defect. If the
// control reads nothing more, the rays are not seeing the wall and this run
// judged nothing.
//
// The cases: the round default, ?case=rect|cushion|tonneau, and the arrangement
// the battery sweeps — its query read back from tools/ci-battery.mjs's
// `arrangement-308` row, so the two cannot part.
//
// Run: node tools/probe-275-button-seat.mjs   (ROOT= to measure another tree)
import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = process.env.ROOT || join(HERE, '..');
const arr = readFileSync(join(HERE, 'ci-battery.mjs'), 'utf8').match(/name: 'arrangement-308', q: '([^']+)'/);
if (!arr) throw new Error("ci-battery.mjs has no `arrangement-308` row — this probe's fifth case is gone");
const CASES = [['round', ''], ['rect', 'case=rect'], ['cushion', 'case=cushion'], ['tonneau', 'case=tonneau'], ['arrangement-308', arr[1]]];
const FS = [0, 0.1, 0.2, 0.3, 0.4, 0.45, 0.49, 0.5];
const PORT = 8457;
const srv = spawn('python3', ['-m', 'http.server', String(PORT), '--bind', '127.0.0.1'], { cwd: ROOT, stdio: 'ignore' });
await new Promise((r) => setTimeout(r, 1200));
const browser = await chromium.launch();
let fails = 0;
const fail = (m) => { fails++; console.log(`  FAIL ${m}`); };
try {
  for (const [name, q] of CASES) {
    const page = await browser.newPage();
    page.on('pageerror', (e) => console.log('PAGEERROR', String(e)));
    await page.goto(`http://127.0.0.1:${PORT}/index.html${q ? `?${q}` : ''}`, { waitUntil: 'load', timeout: 300000 });
    await page.waitForFunction(() => !!window.__clock, null, { timeout: 300000 });
    const res = await page.evaluate(async (FS) => {
      const I = await import('./src/inspect.js');
      const THREE = await import('three');
      const clock = window.__clock, scene = clock.scene;
      const cap = scene.getObjectByName('alarmPusherCap');
      if (!cap || cap.geometry.type !== 'LatheGeometry') return { error: `alarmPusherCap is ${cap ? cap.geometry.type : 'missing'}, not the TODO 275 button` };
      const st = cap.parent.userData.stem;
      const caseMeshes = [];
      scene.traverse((o) => { if (o.isMesh && o.userData.casePart && !o.userData.schematic) caseMeshes.push(o); });
      const ax = I.AXES.find((a) => a.name === 'alarmPress');
      const pts = cap.geometry.parameters.points;
      const R = Math.max(...pts.map((p) => p.x)), H = Math.max(...pts.map((p) => p.y));
      const cosT = st.capNx * st.ux + st.capNy * st.uy;
      const ray = new THREE.Raycaster();
      const N = 24, rows = [];
      for (const f of FS) {
        I.enterAxis(clock); clock.setPose(ax.pose(f, clock)); scene.updateMatrixWorld(true);
        // the button's frame: lathe +Y the wall's normal, the inner face at y = 0
        const o = cap.getWorldPosition(new THREE.Vector3());          // the inner face ON the press line
        const nW = new THREE.Vector3(0, 1, 0).transformDirection(cap.matrixWorld);
        const uW = new THREE.Vector3(st.ux, st.uy, 0).transformDirection(cap.parent.matrixWorld);
        const aW = new THREE.Vector3(1, 0, 0).transformDirection(cap.matrixWorld);
        const bW = new THREE.Vector3(0, 0, 1).transformDirection(cap.matrixWorld);
        let worst = -Infinity, worstSquare = -Infinity;
        for (let i = -N; i <= N; i++) for (let k = -N; k <= N; k++) {
          const a = (i / N) * R, b = (k / N) * R;
          if (Math.hypot(a, b) > R) continue;
          const p = o.clone().addScaledVector(aW, a).addScaledVector(bW, b);   // a point of the inner face
          ray.set(p.clone().addScaledVector(uW, 40), uW.clone().negate()); ray.far = 200;
          const h = ray.intersectObjects(caseMeshes, false)[0];
          if (!h) continue;
          const hit = h.point;
          // height of the outermost metal over the REAL face (along its normal),
          // and over a VIRTUAL face square to the line through the same axis point
          // (the control: the head as cut before TODO 275)
          worst = Math.max(worst, hit.clone().sub(o).dot(nW));
          worstSquare = Math.max(worstSquare, hit.clone().sub(o).dot(uW));
        }
        const inv = cap.matrixWorld.clone().invert(), w = new THREE.Vector3();
        let inside = 0;
        for (const m of caseMeshes) {
          const ps = m.geometry.attributes.position;
          for (let i = 0; i < ps.count; i++) {
            w.fromBufferAttribute(ps, i); m.localToWorld(w); w.applyMatrix4(inv);
            if (Math.hypot(w.x, w.z) < R - 1e-4 && w.y > 1e-3 && w.y < H - 1e-4) inside++;
          }
        }
        rows.push({ f, worst, worstSquare, inside });
      }
      return { rows, R, cosT };
    }, FS);
    await page.close();
    console.log(`${name}${q ? ` (?${q})` : ''}`);
    if (res.error) { fail(res.error); continue; }
    const tiltDeg = Math.acos(Math.min(1, res.cosT)) * 180 / Math.PI;
    const sinkN = 0.02 * res.cosT;    // ALARM_SEAT_SINK along the line, read along the wall's normal
    console.log(`  wall's tilt to the press line ${tiltDeg.toFixed(2)}°, button r ${res.R.toFixed(4)}`);
    for (const r of res.rows) {
      const stop = r.f === 0.5;
      console.log(`  f ${r.f.toFixed(2)}  metal over the face ${r.worst.toFixed(4)}  (square face: ${r.worstSquare.toFixed(4)})  case vertices inside ${r.inside}`);
      if (!stop && !(r.worst < 0)) fail(`f ${r.f}: case metal stands ${r.worst.toFixed(4)} over the button's face before the stop`);
      if (!stop && r.inside) fail(`f ${r.f}: ${r.inside} case vertices inside the button before the stop`);
      if (stop && !(r.worst > 0 && r.worst <= sinkN + 1e-3)) fail(`at the stop the metal over the face reads ${r.worst.toFixed(4)} against the seat sink ${sinkN.toFixed(4)} — ${r.worst <= 0 ? 'the stop never lands' : 'the button buries'}`);
    }
    const stopRow = res.rows.find((r) => r.f === 0.5);
    if (tiltDeg > 1) {
      if (!(stopRow.worstSquare > 0.02 + 1e-3)) fail(`CONTROL: a face square to the line reads ${stopRow.worstSquare.toFixed(4)} past it at the stop, no more than the 0.02 seat sink — the rays are not seeing the wall`);
      else console.log(`  control: a face square to the line would bury ${stopRow.worstSquare.toFixed(4)} at the stop, past the 0.02 sink — the rays see the wall`);
    } else console.log('  control: the line is square to this wall, so the square face IS the seat — nothing to see');
  }
} finally {
  await browser.close(); srv.kill();
}
console.log(fails ? `${fails} failure(s)` : 'PASS — the button clears every case wall until its stop, and lands on it there');
process.exit(fails ? 1 : 0);
