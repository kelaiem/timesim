// §163 — SIZING THE PIN-IN-SLOT COUPLING AGAINST THE BUILT TREE.
//
// The coupling is settled (a pin on the pusher running in a radial slot in the
// arbor driver), and with it the offset: the driver's angle IS the pin's
// azimuth about the arbor, so one tooth needs
//     d = travel / (2·tan(step/2))
// and the stroke must STRADDLE the foot of the perpendicular. What is not
// settled is where the pin can physically be carried, and that is a question
// about the built tree rather than about the algebra:
//
//   · the pin must sit within ±travel/2 of the foot, so it is at radius
//     5.01–5.19 from the column arbor — INSIDE the saw's tip circle in plan;
//   · a REACH BAR carrying it inboard would lie along the press line at the
//     pin's own offset, which is exactly where the driver's slot arm has its
//     metal — measured here rather than argued;
//   · the alternative is no bar at all: the riser IS the pin, and the stem
//     grows inboard to reach the foot. That costs stem length, so §54's
//     ratio is measured too.
//
// WHAT THIS MEASURES AND WHAT IT DOES NOT. Every corridor here is a VERTEX-MIN
// sweep (MODELING.md rule 5): a triangle that spans a slab with all three
// vertices outside it reads clear. That is why the thresholds are printed
// rather than gated — this probe sites the mechanism, and the battery's own
// mesh clearances are what accept it.
//
// Run: cd tools && node probe-163-pin.mjs
import { chromium } from 'playwright';
import { spawn } from 'node:child_process';

const srv = spawn('python3', ['-m', 'http.server', '8484', '--bind', '127.0.0.1'], { cwd: '..', stdio: 'ignore' });
await new Promise((r) => setTimeout(r, 900));
const b = await chromium.launch();
const p = await b.newPage();
p.on('pageerror', (e) => console.log('PAGEERROR', String(e)));
await p.goto('http://127.0.0.1:8484/index.html?hud=0&sync=0', { waitUntil: 'load', timeout: 90000 });
await p.waitForFunction(() => !!window.__clock, null, { timeout: 90000 });

const out = await p.evaluate(async () => {
  const clock = window.__clock;
  const unit = clock.labelEntries.find((e) => e.name === 'Alarm switch');
  let wheel = null, stem = null, riser = null, reach = null, pawl = null, group = null, skirt = null;
  unit.obj.traverse((o) => {
    if (o.name === 'alarmColSkirt') { skirt = o; wheel = o.parent; }
    if (o.name === 'alarmPusherStem') stem = o;
    if (o.name === 'alarmPusherRiser') riser = o;
    if (o.name === 'alarmPusherReach') reach = o;
    if (o.name === 'alarmPusherPawl') pawl = o;
    if (o.userData && o.userData.stem) group = o;
  });
  const V3 = clock.camera.position.constructor;
  const wp = wheel.getWorldPosition(new V3());
  const gp = group.getWorldPosition(new V3());
  const S = group.userData.stem;
  const box = (m) => {
    m.updateWorldMatrix(true, false);
    const g = m.geometry; if (!g.boundingBox) g.computeBoundingBox();
    const bb = g.boundingBox, lo = [Infinity,Infinity,Infinity], hi = [-Infinity,-Infinity,-Infinity];
    for (const x of [bb.min.x, bb.max.x]) for (const y of [bb.min.y, bb.max.y]) for (const z of [bb.min.z, bb.max.z]) {
      const v = new V3(x, y, z).applyMatrix4(m.matrixWorld).toArray();
      for (let i = 0; i < 3; i++) { lo[i] = Math.min(lo[i], v[i]); hi[i] = Math.max(hi[i], v[i]); }
    }
    return { min: lo.map(n=>+n.toFixed(4)), max: hi.map(n=>+n.toFixed(4)) };
  };
  const len = (m) => m.geometry.parameters;

  // ---- the coupling's own arithmetic, from the built saw ----
  const poly = wheel.userData.ratchetPoly;
  let ROOT = Infinity, TIP = 0;
  for (const q of poly) { const r = Math.hypot(q.x, q.y); ROOT = Math.min(ROOT, r); TIP = Math.max(TIP, r); }
  const STEP = Math.PI / 6, TRAVEL = (Math.PI * 2 / 12) * ROOT, HALF = TRAVEL / 2;
  const D = TRAVEL / (2 * Math.tan(STEP / 2));            // the offset one tooth forces
  const ux = S.ux, uy = S.uy, px = -uy, py = ux;
  const foot = { x: wp.x + px * -D, y: wp.y + py * -D };  // ratchetDrive = -1
  const at = (sv) => ({ x: foot.x + ux * sv, y: foot.y + uy * sv });

  // ---- what a REACH BAR under the plate would sweep ----
  // The bar rides at the stem's own z, so it is separated from the driver by
  // the three-quarter plate itself. It spans the riser (at the pin) out to the
  // stem's inner end, and translates one full travel.
  const zAxis = gp.z, barHalfZ = 0.15, barHalfW = 0.15;
  const sIn = -HALF, sOut = S.inner + 0.4;
  const corners = [];
  for (const sv of [sIn, sOut]) for (const wv of [-barHalfW, barHalfW]) {
    corners.push({ x: foot.x + ux * sv + px * wv, y: foot.y + uy * sv + py * wv });
  }
  const bx = [Math.min(...corners.map(c=>c.x)), Math.max(...corners.map(c=>c.x))];
  const by = [Math.min(...corners.map(c=>c.y)), Math.max(...corners.map(c=>c.y))];
  const bz = [zAxis - barHalfZ, zAxis + barHalfZ];

  // distance from a world point to the bar's swept slab, in the press frame
  const slabDist = (q) => {
    const dsv = (q.x - foot.x) * ux + (q.y - foot.y) * uy;
    const dwv = (q.x - foot.x) * px + (q.y - foot.y) * py;
    const es = Math.max(sIn - dsv, dsv - sOut, 0);
    const ew = Math.max(-barHalfW - dwv, dwv - barHalfW, 0);
    const ez = Math.max(bz[0] - q.z, q.z - bz[1], 0);
    return Math.hypot(es, ew, ez);
  };

  // ---- what the RISER's climb would sweep ----
  // The riser leaves the bar, pierces the plate in a slot cut on the pin's own
  // track, and its top IS the pin standing in the driver's radial slot.
  const TQ_TOP = 8.9845, DRV_BOT = TQ_TOP + 0.15, DRV_TOP = DRV_BOT + 0.317;
  const riserR = 0.16648, riserZ = [bz[1], DRV_TOP];
  const riserDist = (q) => {
    const dsv = (q.x - foot.x) * ux + (q.y - foot.y) * uy;
    const dwv = (q.x - foot.x) * px + (q.y - foot.y) * py;
    const es = Math.max(-HALF - dsv, dsv - HALF, 0);
    const rad = Math.hypot(es, Math.abs(dwv));
    const er = Math.max(rad - riserR, 0);
    const ez = Math.max(riserZ[0] - q.z, q.z - riserZ[1], 0);
    return Math.hypot(er, ez);
  };
  // ---- what the DRIVER's own disc would sweep ----
  // Everything the driver can occupy: an annulus out to the pawl post's circle,
  // in the band the raise opened between the plate top and the skirt.
  const DRV_R = 6.6 + 0.3;
  const drvDist = (q) => {
    const rad = Math.hypot(q.x - wp.x, q.y - wp.y);
    const er = Math.max(rad - DRV_R, 0);
    const ez = Math.max(DRV_BOT - q.z, q.z - DRV_TOP, 0);
    return Math.hypot(er, ez);
  };

  const mine = new Set();
  group.traverse((o) => mine.add(o));
  const near = (fn, skip) => {
    const hits = [];
    clock.scene.traverse((o) => {
      if (!o.isMesh || mine.has(o) || o.userData.schematic) return;
      if (skip && skip(o)) return;
      o.updateWorldMatrix(true, false);
      const g = o.geometry, pos = g.getAttribute('position');
      if (!pos) return;
      let best = Infinity;
      const v = new V3();
      for (let i = 0; i < pos.count; i++) {
        v.fromBufferAttribute(pos, i).applyMatrix4(o.matrixWorld);
        const d = fn(v);
        if (d < best) best = d;
        if (best === 0) break;
      }
      if (best < 1.2) hits.push({ name: o.name || g.type, dist: +best.toFixed(4) });
    });
    return hits.sort((a, b) => a.dist - b.dist).slice(0, 12);
  };
  const hits = near(slabDist);
  const riserHits = near(riserDist, (o) => o.name === 'threeQuarterPlate');
  const drvHits = near(drvDist);
  // WHERE they are, in the column's own frame: the driver is a LEVER, so what
  // matters is the azimuth window each obstacle occupies, not the annulus.
  const obstacles = [];
  clock.scene.traverse((o) => {
    if (!o.isMesh || mine.has(o) || o.userData.schematic) return;
    o.updateWorldMatrix(true, false);
    const g = o.geometry, pos = g.getAttribute('position');
    if (!pos) return;
    let rlo = Infinity, rhi = -Infinity, zlo = Infinity, zhi = -Infinity;
    const azs = [];
    const v = new V3();
    let any = false;
    for (let i = 0; i < pos.count; i++) {
      v.fromBufferAttribute(pos, i).applyMatrix4(o.matrixWorld);
      if (v.z < DRV_BOT - 0.15 || v.z > DRV_TOP + 0.15) continue;
      const dx = v.x - wp.x, dy = v.y - wp.y, r = Math.hypot(dx, dy);
      if (r > DRV_R + 0.3) continue;
      any = true;
      rlo = Math.min(rlo, r); rhi = Math.max(rhi, r);
      zlo = Math.min(zlo, v.z); zhi = Math.max(zhi, v.z);
      azs.push(Math.atan2(dy, dx) * 180 / Math.PI);
    }
    if (!any) return;
    azs.sort((a, b) => a - b);
    obstacles.push({ name: o.name || g.type, r: [+rlo.toFixed(3), +rhi.toFixed(3)],
                     z: [+zlo.toFixed(3), +zhi.toFixed(3)],
                     az: [+azs[0].toFixed(1), +azs[azs.length - 1].toFixed(1)] });
  });
  obstacles.sort((a, b) => a.r[0] - b.r[0]);
  // the driver's own azimuths, in the same frame
  const azOf = (q) => Math.atan2(q.y - wp.y, q.x - wp.x) * 180 / Math.PI;
  const slotAz = { rest: +azOf(at(HALF)).toFixed(2), mid: +azOf(at(0)).toFixed(2), pressed: +azOf(at(-HALF)).toFixed(2) };


  return {
    coupling: { ROOT: +ROOT.toFixed(5), TIP: +TIP.toFixed(5), TRAVEL: +TRAVEL.toFixed(5), HALF: +HALF.toFixed(5), D: +D.toFixed(5),
                footWorld: [+foot.x.toFixed(4), +foot.y.toFixed(4)],
                pinRest: at(HALF), pinPressed: at(-HALF),
                pinRadiusMid: +D.toFixed(5), pinRadiusEnd: +Math.hypot(D, HALF).toFixed(5),
                barSweep: { s: [+sIn.toFixed(3), +sOut.toFixed(3)], z: bz.map(n=>+n.toFixed(4)), x: bx.map(n=>+n.toFixed(3)), y: by.map(n=>+n.toFixed(3)) } },
    barNeighbours: hits,
    riserNeighbours_plateExcluded: riserHits,
    driverDiscNeighbours: drvHits,
    driverBandObstacles: obstacles,
    slotArmAzimuth: slotAz,
    plateR: clock.plateR,
    wheelWorld: wp.toArray(),
    pusherAxisWorld: gp.toArray(),
    stemUserData: S,
    stemParams: len(stem), stemBox: box(stem), stemSlender: +(len(stem).height / len(stem).radiusTop).toFixed(2),
    riserParams: len(riser), riserBox: box(riser),
    reachParams: reach ? len(reach) : null,
    pawlParams: len(pawl), pawlBox: box(pawl),
    skirtBox: box(skirt),
    ratchet: (() => {
      const poly = wheel.userData.ratchetPoly;
      let rr = Infinity, tip = 0;
      for (const q of poly) { const r = Math.hypot(q.x, q.y); rr = Math.min(rr, r); tip = Math.max(tip, r); }
      return { root: rr, tip, n: poly.length, drive: wheel.userData.ratchetDrive };
    })(),
  };
});
console.log(JSON.stringify(out, null, 1));
await b.close(); srv.kill();
