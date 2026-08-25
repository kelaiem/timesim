// §164 — IS THERE ROOM ON THE STEM FOR A RETURN SPRING, AND WHERE.
//
// TODO 87 step 5 tier two: the pusher's return is `ALARM_RETURN_S`, a settling
// time in the tick with no metal behind it, and the item sites the fix — a
// fixed abutment hanging from the plate's underside, a collar on the stem, and
// a spring between them. §163 then moved the riser from the stem's inner end
// all the way in to the pin's station, so the run the item measured is not the
// run that exists; this takes it again.
//
// What it reports:
//   · the stem's own stations, and the guide boss's, in the press frame;
//   · the largest COAXIAL envelope around the press axis that is clear over
//     that run, swept across the whole stroke — which is what a coil around
//     the stem has to live inside;
//   · the plate's underside, since the abutment hangs from it.
//
// The envelope is a vertex-min measurement (MODELING.md rule 5), so it sites
// the part and the battery's own mesh clearances accept it.
//
// Run: cd tools && node probe-164-return.mjs
import { chromium } from 'playwright';
import { spawn } from 'node:child_process';

const srv = spawn('python3', ['-m', 'http.server', '8488', '--bind', '127.0.0.1'], { cwd: '..', stdio: 'ignore' });
await new Promise((r) => setTimeout(r, 900));
const b = await chromium.launch();
const p = await b.newPage();
p.on('pageerror', (e) => console.log('PAGEERROR', String(e)));
await p.goto('http://127.0.0.1:8488/index.html?hud=0&sync=0', { waitUntil: 'load', timeout: 90000 });
await p.waitForFunction(() => !!window.__clock, null, { timeout: 90000 });

const out = await p.evaluate(async () => {
  const clock = window.__clock;
  const V3 = clock.camera.position.constructor;
  const unit = clock.labelEntries.find((e) => e.name === 'Alarm switch');
  let group = null, stem = null, boss = null, plate = null;
  unit.obj.traverse((o) => {
    if (o.userData && o.userData.stem) group = o;
    if (o.name === 'alarmPusherStem') stem = o;
    if (o.name === 'alarmPusherGuide') boss = o;
  });
  clock.scene.traverse((o) => { if (o.name === 'threeQuarterPlate') plate = o; });
  const S = group.userData.stem;
  const gp = group.getWorldPosition(new V3());
  const ux = S.ux, uy = S.uy;
  // the press frame: s along û from the group's own origin (the foot), w across
  const sOf = (x, y) => (x - gp.x) * ux + (y - gp.y) * uy;
  const wOf = (x, y) => (x - gp.x) * (-uy) + (y - gp.y) * ux;

  const spanOf = (m) => {
    m.updateWorldMatrix(true, false);
    const a = m.geometry.getAttribute('position'); const v = new V3();
    let lo = Infinity, hi = -Infinity, zlo = Infinity, zhi = -Infinity;
    for (let i = 0; i < a.count; i++) {
      v.fromBufferAttribute(a, i).applyMatrix4(m.matrixWorld);
      const s = sOf(v.x, v.y); lo = Math.min(lo, s); hi = Math.max(hi, s);
      zlo = Math.min(zlo, v.z); zhi = Math.max(zhi, v.z);
    }
    return { s: [+lo.toFixed(4), +hi.toFixed(4)], z: [+zlo.toFixed(4), +zhi.toFixed(4)] };
  };

  // THE ENVELOPE: for each s along the run, the nearest non-pusher metal to the
  // press AXIS, in the plane perpendicular to it. Swept over the whole stroke by
  // measuring in the group's own (translating) frame — a coil on the stem rides
  // with it, so its clearance is a fixed quantity in that frame only if nothing
  // else moves; everything that could is sampled at both ends of the stroke.
  const mine = new Set(); group.traverse((o) => mine.add(o));
  const S0 = 3, S1 = 18, NS = 60;
  const prof = new Array(NS + 1).fill(Infinity);
  const who = new Array(NS + 1).fill(null);
  const v = new V3();
  for (const T of [0, 1]) {
    clock.resetInputs();
    clock.setPose({ alarmPressCycle: T });
    clock.scene.updateMatrixWorld(true);
    const g2 = group.getWorldPosition(new V3());
    const s2 = (x, y) => (x - g2.x) * ux + (y - g2.y) * uy;
    clock.scene.traverse((o) => {
      if (!o.isMesh || mine.has(o) || o.userData.schematic) return;
      const a = o.geometry.getAttribute('position'); if (!a) return;
      for (let i = 0; i < a.count; i++) {
        v.fromBufferAttribute(a, i).applyMatrix4(o.matrixWorld);
        const s = s2(v.x, v.y);
        if (s < S0 || s > S1) continue;
        const dw = wOf(v.x, v.y), dz = v.z - g2.z;
        const r = Math.hypot(dw, dz);
        const k = Math.round(((s - S0) / (S1 - S0)) * NS);
        if (r < prof[k]) { prof[k] = r; who[k] = o.name || o.geometry.type; }
      }
    });
  }
  clock.resetInputs();
  return {
    stem: spanOf(stem), boss: spanOf(boss),
    bossS: +sOf(boss.getWorldPosition(new V3()).x, boss.getWorldPosition(new V3()).y).toFixed(4),
    plateZ: (() => { const sp = spanOf(plate); return sp.z; })(),
    axisZ: +gp.z.toFixed(4),
    userData: S,
    profile: prof.map((r, k) => ({ s: +(S0 + (k / NS) * (S1 - S0)).toFixed(2),
                                   clear: Number.isFinite(r) ? +r.toFixed(3) : null, by: who[k] })),
  };
});
console.log(JSON.stringify(out, null, 1));
await b.close(); srv.kill();
