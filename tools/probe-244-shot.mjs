// §244 — the zero reset at the frame of first cam motion, measured in PLAN as
// well as in metal, so the eye's question ("is the roller touching when the
// heart starts to turn?") is answered by a number and a picture rather than by
// probe-reset-contact.mjs's planar vertex gap alone.
//
// REPORT, not a gate. For each start phase it steps the shipped eased crown
// pull at 1/60 s, stops on the first frame the hammer SHIFTS the seconds
// reference (the heart turning with the train is not a move), and prints two
// gaps for the frame before and the frame of that move:
//   · METAL — roller circle to the nearest heart vertex, all of them, which
//     includes the bevel-dilated side wall the contact law measures against;
//   · PLAN  — roller circle to the heart's TOP CAP only (its highest-z
//     vertices, which sit on the cut outline). This is where a camera above the
//     cam sees the flat face end. METAL and PLAN differ by the chamfer, which
//     was §244's first hypothesis.
// It then writes a top-down PNG of the two units alone (every other label
// entry hidden for the shot and restored after).
//
// NOT probe-reset-contact.mjs, which is the ACCEPTANCE for the contact law and
// has no view. Measuring and rendering are separate evaluates, so the numbers
// print even when the picture does not arrive. The PNG is whatever view the
// profile boots in, and a fresh profile boots in the §66 LINE tier, which draws
// the heart as its pitch circle and so cannot show the chamfer. QS='?schematic=0'
// asks for the solid view, but on this container's headless SwiftShader that
// run went idle and never reached the first evaluate (twice, 10 and 25 min).
// The GAPS are the evidence; the picture is a convenience.
//
// cd tools && node probe-244-shot.mjs [outprefix]        (PHASES=11,41 to pick)
import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import { writeFileSync } from 'node:fs';
const port = process.env.PORT || '8531';
const srv = spawn('python3', ['-m', 'http.server', port, '--bind', '127.0.0.1'], { cwd: '..', stdio: 'ignore' });
await new Promise((r) => setTimeout(r, 900));
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 700, height: 700 } });
p.on('pageerror', (e) => console.log('PAGEERROR', String(e)));
await p.goto(`http://127.0.0.1:${port}/index.html${process.env.QS || ""}`, { waitUntil: 'load', timeout: 90000 });
await p.waitForFunction(() => !!window.__clock, null, { timeout: 90000 });
const OUT = process.argv[2] || '/tmp/shot244';
const phases = (process.env.PHASES || '11,41').split(',').map(Number);

const f = (g) => (g ? `metal ${g.metal.toFixed(4)} · plan ${g.plan.toFixed(4)}` : '—');
for (const startTau of phases) {
  const res = await p.evaluate((startTau) => {
    const C = window.__clock;
    const find = (n) => C.labelEntries.find((e) => e.name === n)?.obj ?? null;
    const cam = find('Heart cam (seconds reset)'), ham = find('Reset hammer');
    let roller = null;
    ham.traverse((o) => {
      if (!o.isMesh || o.geometry.type !== 'CylinderGeometry') return;
      if (!roller || Math.hypot(o.position.x, o.position.y) > Math.hypot(roller.position.x, roller.position.y)) roller = o;
    });
    const rollerR = roller.geometry.parameters.radiusTop;
    const heart = [];
    cam.traverse((o) => { if (o.isMesh) heart.push(o); });
    const wp = (o) => { o.updateWorldMatrix(true, false); const e = o.matrixWorld.elements; return { x: e[12], y: e[13], z: e[14] }; };
    const gaps = () => {
      const rc = wp(roller);
      let metal = Infinity, plan = Infinity, zTop = -Infinity;
      const pts = [];
      for (const m of heart) {
        m.updateWorldMatrix(true, false);
        const e = m.matrixWorld.elements, a = m.geometry.attributes.position;
        for (let i = 0; i < a.count; i++) {
          const x = a.getX(i), y = a.getY(i), z = a.getZ(i);
          const wx = e[0] * x + e[4] * y + e[8] * z + e[12];
          const wy = e[1] * x + e[5] * y + e[9] * z + e[13];
          const wz = e[2] * x + e[6] * y + e[10] * z + e[14];
          pts.push([wx, wy, wz]);
          if (wz > zTop) zTop = wz;
        }
      }
      for (const [x, y, z] of pts) {
        const d = Math.hypot(x - rc.x, y - rc.y);
        if (d < metal) metal = d;
        if (z > zTop - 1e-4 && d < plan) plan = d;
      }
      return { metal: metal - rollerR, plan: plan - rollerR };
    };
    C.resetInputs();
    C.setPose({ tau: 0, crownPullT: 0, leverEngage: 0, tension: 1 });
    for (let i = 0; i < Math.round(startTau * 10); i++) C.step(0.1);
    document.getElementById('btn-crown').click();
    let prev = C.secondsZeroRef, frame = -1, before = null, at = null;
    for (let i = 0; i < 90; i++) {
      const g0 = gaps();
      C.step(1 / 60);
      if (Math.abs(C.secondsZeroRef - prev) > 1e-9) { frame = i + 1; before = g0; at = gaps(); break; }
      prev = C.secondsZeroRef;
    }
    return { frame, before, at };
  }, startTau);
  console.log(`τ ${String(startTau).padStart(2)} | first push on frame ${res.frame} | frame before: ${f(res.before)} | that frame: ${f(res.at)}`);

  const png = await p.evaluate(() => {
    const C = window.__clock;
    const find = (n) => C.labelEntries.find((e) => e.name === n)?.obj ?? null;
    const cam = find('Heart cam (seconds reset)'), ham = find('Reset hammer');
    const hidden = [];
    for (const e of C.labelEntries) if (e.obj !== cam && e.obj !== ham && e.obj.visible) { e.obj.visible = false; hidden.push(e.obj); }
    const cp = new window.__clock.camera.position.constructor();
    cam.getWorldPosition(cp);
    const hp = cp.clone();
    ham.getWorldPosition(hp);
    const mx = (cp.x * 2 + hp.x) / 3, my = (cp.y * 2 + hp.y) / 3;
    C.camera.position.set(mx, my, cp.z + 30);
    C.camera.up.set(0, 1, 0);
    C.camera.lookAt(mx, my, cp.z);
    C.camera.updateProjectionMatrix();
    C.render();
    const url = document.querySelector('canvas').toDataURL('image/png');
    for (const o of hidden) o.visible = true;
    return url;
  });
  writeFileSync(`${OUT}-tau${startTau}.png`, Buffer.from(png.split(',')[1], 'base64'));
}
await b.close();
srv.kill();
