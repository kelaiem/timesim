// §106 — RE-SITE, in position space only. The battery confirmed
// `Alarm striking wheel ⇄ Alarm winding arrest` (overlap 0.181, refined min
// gap 0 at beat f=0), and the cause is a gap in how the station was chosen:
// the pinion was sited off §106's free-disc scan of the WIND-WHEEL band, but
// the finger and cross ride a band ABOVE it that no scan ever measured.
//
// The pinion's centre is not free — it must sit on the mesh circle, 8.25 from
// the alarm arbor, or it does not mesh. So azimuth on that circle is the ONE
// position-space currency here (the other, stratum, is measured too and
// reported beside it). Nothing about the mechanism's dimensions is in play:
// this scan takes them as given and asks only where they fit.
//
// FIRST PASS asked for a free DISC of d + b + margin about the pinion axis and
// found 0 of 180 azimuths — but that question was too strict and the answer
// was misleading. The assembly is not a disc: it is the pinion, plus a cross
// hanging off in ONE direction. Requiring room in every direction asks for
// space the mechanism never occupies.
//
// It did find the real defect, which was the STRATUM and not the azimuth: the
// finger and cross were put at z 3.173–3.806, which is the alarm MAINSPRING's
// band. The scan that sited the pinion covered the wind-wheel band and nobody
// ever measured the one the other two parts actually ride in.
//
// So this asks the three-freedom question instead, with the mechanism's
// dimensions fixed: the pinion stays on its mesh circle at its proven station,
// and the two remaining position-space currencies are swept —
//   · the finger/cross PLANE along the pinion's own arbor (stratum), and
//   · the cross's AZIMUTH about that arbor (station).
// For each pair it measures the finger's disc at the pinion axis and the
// cross's disc at distance d, and reports where BOTH clear.
//
// Run: node tools/probe-106-resite.mjs
import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
const port = process.env.PORT || '8502';
const srv = spawn('python3', ['-m', 'http.server', port, '--bind', '127.0.0.1'],
  { cwd: '..', stdio: 'ignore' });
await new Promise((r) => setTimeout(r, 900));
const browser = await chromium.launch();
const page = await browser.newPage();
page.on('pageerror', (e) => console.log('PAGEERROR', String(e)));
await page.goto(`http://127.0.0.1:${port}/index.html`, { waitUntil: 'load', timeout: 90000 });
await page.waitForFunction(() => !!window.__clock, null, { timeout: 90000 });

const out = await page.evaluate(async () => {
  const I = await import('./src/inspect.js');
  const THREE = await import('./vendor/three.module.js');
  const c = window.__clock;
  const A = c.arrestDebug;
  const M = 0.15;
  const FINGER_NEED = A.spec.a + A.spec.pinR + M;   // the pin sweeps a full circle
  const CROSS_NEED = A.spec.b + M;                  // the cross's own rim
  const D = A.spec.d;

  c.scene.updateMatrixWorld(true);
  let pin = null;
  c.scene.traverse((o) => {
    if (!pin && o.isMesh && o.name === 'alarmArrestPinion') {
      o.updateMatrixWorld(true);
      pin = { x: o.matrixWorld.elements[12], y: o.matrixWorld.elements[13], z: o.matrixWorld.elements[14] };
    }
  });
  const units = () => c.labelEntries.map(({ name, obj }) => {
    const meshes = [];
    obj.traverse((o) => {
      if (!o.isMesh) return;
      for (let n = o; n; n = n.parent) if (n.userData && n.userData.schematic) return;
      meshes.push(o);
    });
    return { name, meshes };
  });

  // every obstacle vertex NEAR the pinion's station, tagged with its z, over
  // every axis — the arrest itself excluded, since it is what is being moved
  // PER MESH, not per vertex — and this is the correction that matters.
  // ExtrudeGeometry carries vertices only on its two FACES, so a band falling
  // strictly between them contains no vertices at all and a vertex filter
  // reports it EMPTY. The first run of this probe did exactly that: it called
  // z 2.4–2.5 clear while the arbor wheel (z 2.223–3.023) straddles it, and
  // the rows on either side named that same wheel. A solid is present in every
  // band its z-range OVERLAPS, whatever its tessellation chose to put there.
  const meshes = [], seen = new Set();
  const REACH = D + CROSS_NEED + 0.5;
  for (const axis of I.AXES) {
    for (let i = 0; i < 5; i++) {
      c.resetInputs?.(); c.setPose(axis.pose(i / 4));
      c.scene.updateMatrixWorld(true);
      for (const u of units()) {
        if (u.name === 'Alarm winding arrest') continue;
        for (const m of u.meshes) {
          m.updateMatrixWorld(true);
          const p = m.geometry.attributes.position, v = new THREE.Vector3();
          let zLo = 1e9, zHi = -1e9;
          const xy = [];
          const seenXY = new Set();
          for (let k = 0; k < p.count; k++) {
            v.set(p.getX(k), p.getY(k), p.getZ(k));
            const w = m.localToWorld(v.clone());
            zLo = Math.min(zLo, w.z); zHi = Math.max(zHi, w.z);
            if (Math.hypot(w.x - pin.x, w.y - pin.y) > REACH) continue;
            const k2 = `${Math.round(w.x / 0.05)},${Math.round(w.y / 0.05)}`;
            if (seenXY.has(k2)) continue;
            seenXY.add(k2);
            xy.push([w.x, w.y]);
          }
          if (!xy.length) continue;
          const key = `${u.name}|${m.name}|${Math.round(zLo * 20)}|${Math.round(zHi * 20)}|${xy.length}|${Math.round(xy[0][0] * 20)},${Math.round(xy[0][1] * 20)}`;
          if (seen.has(key)) continue;
          seen.add(key);
          meshes.push({ zLo, zHi, xy, tag: `${u.name} :: ${m.name || m.geometry.type}` });
        }
      }
    }
  }

  const T = 0.317;                    // the plate stock the finger and cross are cut from
  const rows = [];
  for (let z = 0.6; z <= 5.2001; z += 0.1) {
    // a solid counts if its z-range OVERLAPS the band, not if it has vertices in it
    const band = [];
    for (const mm of meshes)
      if (mm.zHi >= z - M && mm.zLo <= z + T + M)
        for (const [x, y] of mm.xy) band.push({ x, y, tag: mm.tag });
    // the finger's full-circle sweep about the pinion axis
    let fFree = Infinity, fBy = null;
    for (const q of band) {
      const dd = Math.hypot(q.x - pin.x, q.y - pin.y);
      if (dd < fFree) { fFree = dd; fBy = q.tag; }
    }
    fFree = fFree - M;
    // the best cross azimuth at this plane
    let best = -Infinity, bestAz = null, bestBy = null;
    for (let deg = 0; deg < 360; deg += 3) {
      const a = (deg * Math.PI) / 180;
      const cx = pin.x + Math.cos(a) * D, cy = pin.y + Math.sin(a) * D;
      let near = Infinity, by = null;
      for (const q of band) {
        const dd = Math.hypot(q.x - cx, q.y - cy);
        if (dd < near) { near = dd; by = q.tag; }
      }
      const free = near - M;
      if (free > best) { best = free; bestAz = deg; bestBy = by; }
    }
    rows.push({
      z: +z.toFixed(2), nBand: band.length,
      finger: +fFree.toFixed(3), fingerBy: fBy,
      crossAz: bestAz, cross: +(best === -Infinity ? 99 : best).toFixed(3), crossBy: bestBy,
      ok: fFree >= FINGER_NEED && best >= CROSS_NEED,
    });
  }
  return { pin: { x: +pin.x.toFixed(3), y: +pin.y.toFixed(3), z: +pin.z.toFixed(3) },
    fingerNeed: +FINGER_NEED.toFixed(3), crossNeed: +CROSS_NEED.toFixed(3), d: +D.toFixed(3), rows };
});

console.log(`pinion axis ${JSON.stringify(out.pin)} · cross stud at d ${out.d}`);
console.log(`finger needs ${out.fingerNeed} about the arbor · cross needs ${out.crossNeed} about its stud\n`);
console.log('   z     finger   cross(best az)   both?   what bounds the finger');
for (const r of out.rows)
  console.log(`  ${String(r.z).padStart(4)}  ${String(r.finger).padStart(8)}  ${String(r.cross).padStart(7)} @${String(r.crossAz).padStart(3)}°  ${r.ok ? ' OK ' : '  . '}   ${r.fingerBy || '(clear)'}`);
const ok = out.rows.filter((r) => r.ok);
console.log(`\nplanes where both clear: ${ok.length} of ${out.rows.length}`);
if (ok.length) {
  const runs = [];
  let cur = [ok[0]];
  for (let i = 1; i < ok.length; i++) {
    if (Math.abs(ok[i].z - ok[i - 1].z - 0.1) < 1e-6) cur.push(ok[i]); else { runs.push(cur); cur = [ok[i]]; }
  }
  runs.push(cur);
  console.log('contiguous strata:');
  for (const r of runs)
    console.log(`   z ${r[0].z}–${r[r.length - 1].z}  (${r.length} planes)  best cross az ${r[Math.floor(r.length / 2)].crossAz}°`);
}
await browser.close();
srv.kill();
