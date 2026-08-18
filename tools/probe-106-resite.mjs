// §106 — RE-SITE, in position space only, over all three freedoms P3 grants.
//
// The battery confirmed `Alarm striking wheel ⇄ Alarm winding arrest` (overlap
// 0.181, refined min gap 0 at beat f=0). Measured since, that unit is an ARBOR
// COLUMN — governor wheel, governor sleeve, strike pinion, strike sleeve
// stacked up the whole height — and the arrest's az-12° station sits on it at
// EVERY plane. No stratum and no cross azimuth can rescue that station.
//
// TWO EARLIER SHAPES OF THIS PROBE WERE WRONG, and both are worth keeping in
// view because each produced a confident, useless answer:
//
//   · It asked for a free DISC of d + b + margin about the pinion axis and
//     found 0 of 180 azimuths. True, and meaningless: the assembly is a pinion
//     with a cross hanging off in ONE direction and never occupies that disc.
//     The question has to be asked per MEMBER.
//   · It filtered obstacle VERTICES into each candidate band. ExtrudeGeometry
//     carries vertices only on its two faces, so a band falling strictly
//     between them reads EMPTY — it called z 2.4–2.5 clear while the arbor
//     wheel (2.223–3.023) straddles it. A solid is present in every band its
//     z-range OVERLAPS, whatever its tessellation put there.
//
// AND THE RULE THAT MAKES THE ANSWER CORRECT: a mesh partner is not an
// obstacle to the wheel that meshes it — the pinion is SUPPOSED to overlap the
// arbor wheel's tip circle, and scoring it as an obstacle caps every station on
// the mesh circle at 1.089 (which is just the distance to that wheel). But the
// exemption is PER MEMBER: the finger and cross mesh nothing, so the arbor
// wheel is a hard obstacle to them. Getting this backwards either way produces
// a map that looks measured and is not.
//
// The three freedoms, with every mechanism dimension held fixed:
//   · STATION azimuth on the mesh circle (the pinion's centre is not free — it
//     must sit at module·(44+11)/2 = 8.25 from the alarm arbor or it does not
//     mesh, which is exactly the coordinate the filed siting dropped);
//   · the finger/cross PLANE along the pinion's arbor;
//   · the cross's AZIMUTH about that arbor.
//
// Scored as PIECES at their own radii against obstacles at theirs, min over the
// lot (the §99 click-stud convention), and picked by MAXIMIN so no member is
// left knife-edge.
//
// Caveat it owes the reader (public TODO 54): the pose axes do not pin each
// other — setPose assigns only the keys it is given and no sweep resets between
// axes — so this obstacle cloud inherits poses across axis boundaries and is a
// function of AXES order. Every pose in it is reachable; the coverage is not
// the product of the axes' ranges.
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

  // what each member needs, about its own axis
  const PINION_NEED = 1.95 + M;              // the 11 t tip circle
  const FINGER_NEED = A.spec.a + A.spec.pinR + M;   // the pin sweeps a FULL circle
  const CROSS_NEED = A.spec.b + M;           // the cross's rim
  const D = A.spec.d;                        // cross stud from the pinion axis
  const CD = 8.25;                           // the mesh circle — not a free parameter
  const T = 0.317;                           // the plate stock finger and cross are cut from
  // THE COLUMNS, which the first shape of this sweep forgot. The finger's
  // arbor and the cross's stud both run from the base plate up to the chosen
  // plane, so they cross every band on the way and are scored against all of
  // them — the §99 click-stud convention, where `col: true` pieces are judged
  // over the bands they pass through rather than the one they end in. Without
  // this the sweep happily picks a plane whose column spears the going train.
  const ARBOR_NEED = A.spec.arborR + M;
  const STUD_NEED = A.spec.studR + M;
  const PLATE_Z = -0.5;                      // ALARM_U_FLOOR − 0.5, where studs plant

  // the arbor's axis and the pinion's own band, read off built parts
  c.scene.updateMatrixWorld(true);
  let ax = null, pinZ = null;
  c.scene.traverse((o) => {
    if (!o.isMesh) return;
    if (!ax && o.name === 'alarmArborRatchet') {
      o.updateMatrixWorld(true);
      ax = { x: o.matrixWorld.elements[12], y: o.matrixWorld.elements[13] };
    }
    if (pinZ === null && o.name === 'alarmArrestPinion') {
      o.updateMatrixWorld(true);
      pinZ = o.matrixWorld.elements[14];
    }
  });
  const PIN_BAND = [pinZ - 0.4, pinZ + 0.4];   // ALARM_WIND_WHEEL_T / 2 either side

  const units = () => c.labelEntries.map(({ name, obj }) => {
    const meshes = [];
    obj.traverse((o) => {
      if (!o.isMesh) return;
      for (let n = o; n; n = n.parent) if (n.userData && n.userData.schematic) return;
      meshes.push(o);
    });
    return { name, meshes };
  });

  // Collect every solid within reach of ANY station on the mesh circle, once,
  // as {zLo, zHi, xy[], tag, isMeshPartner}. Per mesh, not per vertex.
  const solids = [], seen = new Set();
  const REACH = CD + D + CROSS_NEED + 0.5;
  for (const axis of I.AXES) {
    for (let i = 0; i < 5; i++) {
      c.resetInputs?.(); c.setPose(axis.pose(i / 4));
      c.scene.updateMatrixWorld(true);
      for (const u of units()) {
        if (u.name === 'Alarm winding arrest') continue;   // the thing being moved
        for (const m of u.meshes) {
          m.updateMatrixWorld(true);
          const p = m.geometry.attributes.position, v = new THREE.Vector3();
          let zLo = 1e9, zHi = -1e9;
          const xy = [], sxy = new Set();
          for (let k = 0; k < p.count; k++) {
            v.set(p.getX(k), p.getY(k), p.getZ(k));
            const w = m.localToWorld(v.clone());
            zLo = Math.min(zLo, w.z); zHi = Math.max(zHi, w.z);
            if (Math.hypot(w.x - ax.x, w.y - ax.y) > REACH) continue;
            const kk = `${Math.round(w.x / 0.05)},${Math.round(w.y / 0.05)}`;
            if (sxy.has(kk)) continue;
            sxy.add(kk);
            xy.push([w.x, w.y]);
          }
          if (!xy.length) continue;
          const key = `${u.name}|${m.name}|${Math.round(zLo * 20)}|${Math.round(zHi * 20)}|${xy.length}`;
          if (seen.has(key)) continue;
          seen.add(key);
          solids.push({ zLo, zHi, xy, tag: `${u.name} :: ${m.name || m.geometry.type}`,
            meshPartner: m.name === 'alarmArborWheel' });
        }
      }
    }
  }

  // A uniform-grid nearest-point index, because the sweep is
  // stations × planes × azimuths × points and the naive form is 1e9.
  const CELL = 0.5;
  const index = (pts) => {
    const g = new Map();
    for (const q of pts) {
      const k = `${Math.floor(q[0] / CELL)},${Math.floor(q[1] / CELL)}`;
      let a = g.get(k); if (!a) g.set(k, a = []); a.push(q);
    }
    return g;
  };
  const nearest = (g, x, y) => {
    const ci = Math.floor(x / CELL), cj = Math.floor(y / CELL);
    let best = Infinity, tag = null;
    for (let ring = 0; ring < 60; ring++) {
      for (let i = ci - ring; i <= ci + ring; i++) {
        for (let j = cj - ring; j <= cj + ring; j++) {
          if (ring > 0 && Math.abs(i - ci) !== ring && Math.abs(j - cj) !== ring) continue;
          const a = g.get(`${i},${j}`); if (!a) continue;
          for (const q of a) {
            const d = Math.hypot(x - q[0], y - q[1]);
            if (d < best) { best = d; tag = q[2]; }
          }
        }
      }
      // one ring past the first hit is enough: a point in ring n+1 cannot be
      // closer than n·CELL, so stop when the ring's floor exceeds what we have
      if (best < ring * CELL) break;
    }
    return { d: best, tag };
  };

  const bandPts = (zLo, zHi, { excludeMeshPartner }) => {
    const pts = [];
    for (const s of solids) {
      if (s.zHi < zLo || s.zLo > zHi) continue;
      if (excludeMeshPartner && s.meshPartner) continue;
      for (const [x, y] of s.xy) pts.push([x, y, s.tag]);
    }
    return index(pts);
  };

  // The pinion lives in one band for every station, so index it once. Its mesh
  // partner is excluded HERE and only here.
  const gPin = bandPts(PIN_BAND[0] - M, PIN_BAND[1] + M, { excludeMeshPartner: true });
  // one index per column height, since a taller column sees strictly more
  const gCol = new Map();
  // the finger/cross planes, indexed once each — the arbor wheel COUNTS in these
  const PLANES = [];
  // the same floor the build's solve searches from (ALARM_U_FLOOR − 0.5 + 0.6),
  // so this axis-swept sweep actually covers the plane the build can choose —
  // a validator whose range is narrower than the thing it validates is not one
  for (let z = 0.1; z <= 5.5001; z += 0.1) PLANES.push(+z.toFixed(2));
  const gPlane = new Map();
  for (const z of PLANES) gPlane.set(z, bandPts(z - M, z + T + M, { excludeMeshPartner: false }));

  const rows = [];
  for (let deg = 0; deg < 360; deg += 2) {
    const a = (deg * Math.PI) / 180;
    const px = ax.x + Math.cos(a) * CD, py = ax.y + Math.sin(a) * CD;
    const pin = nearest(gPin, px, py);
    const pinFree = pin.d - M;
    if (pinFree < PINION_NEED) { rows.push({ deg, pinFree: +pinFree.toFixed(3), pinBy: pin.tag, ok: false }); continue; }
    // this station holds the pinion; now the plane and the cross azimuth
    let best = null;
    for (const z of PLANES) {
      const g = gPlane.get(z);
      const f = nearest(g, px, py);
      const fingerFree = f.d - M;
      if (fingerFree < FINGER_NEED) continue;
      // The arbor from the plate to this plane, against every band it crosses.
      // Its top is not the finger's plane: the finger and the PINION share one
      // arbor, so the column always runs at least to the pinion's top face,
      // whichever of the two is higher. A finger sited BELOW the pinion still
      // needs the whole column, and the first cut of this check quietly gave a
      // low plane a short arbor it does not have.
      const colTop = Math.max(z + T, PIN_BAND[1]);
      const ck = colTop.toFixed(2);
      if (!gCol.has(ck)) gCol.set(ck, bandPts(PLATE_Z, colTop, { excludeMeshPartner: false }));
      const gc = gCol.get(ck);
      // the cross's stud is its own column and stops at the cross
      const sk = (z + T).toFixed(2);
      if (!gCol.has(sk)) gCol.set(sk, bandPts(PLATE_Z, z + T, { excludeMeshPartner: false }));
      const gs = gCol.get(sk);
      const arb = nearest(gc, px, py);
      const arborFree = arb.d - M;
      if (arborFree < ARBOR_NEED) continue;
      for (let cd = 0; cd < 360; cd += 3) {
        const ca = (cd * Math.PI) / 180;
        const cx = px + Math.cos(ca) * D, cy = py + Math.sin(ca) * D;
        const q = nearest(g, cx, cy);
        const crossFree = q.d - M;
        if (crossFree < CROSS_NEED) continue;
        const st = nearest(gs, cx, cy);            // the cross's stud, to the cross only
        const studFree = st.d - M;
        if (studFree < STUD_NEED) continue;
        // MAXIMIN over every member, so a station is not chosen by one that had
        // room to spare anyway
        const slack = Math.min(pinFree - PINION_NEED, fingerFree - FINGER_NEED,
          crossFree - CROSS_NEED, arborFree - ARBOR_NEED, studFree - STUD_NEED);
        // AND THE PLANE IS TAKEN AS LOW AS IT WILL GO, not as free as it will
        // go. Height here is arbor LENGTH: the finger rides a 0.185-radius
        // column standing off the base plate, and picking the roomiest plane
        // put it 5.9 tall — a 0.14 mm arbor nearly 2.3 mm long, which is a P1
        // slenderness problem bought with clearance nobody needed. Lowest
        // viable plane first; slack only breaks ties between planes.
        if (!best || z < best.z - 1e-9 || (Math.abs(z - best.z) < 1e-9 && slack > best.slack))
          best = { z, crossAz: cd, slack: +slack.toFixed(3),
            finger: +fingerFree.toFixed(3), fingerBy: f.tag,
            cross: +crossFree.toFixed(3), crossBy: q.tag,
            arbor: +arborFree.toFixed(3), arborBy: arb.tag,
            stud: +studFree.toFixed(3), studBy: st.tag };
      }
    }
    rows.push({ deg, pinFree: +pinFree.toFixed(3), pinBy: pin.tag, ok: !!best, ...(best || {}) });
  }
  return {
    axis: { x: +ax.x.toFixed(3), y: +ax.y.toFixed(3) }, pinZ: +pinZ.toFixed(3),
    needs: { pinion: +PINION_NEED.toFixed(3), finger: +FINGER_NEED.toFixed(3), cross: +CROSS_NEED.toFixed(3),
      arbor: +ARBOR_NEED.toFixed(3), stud: +STUD_NEED.toFixed(3) },
    d: +D.toFixed(3), cd: CD, nSolids: solids.length, rows,
    built: (() => {
      let m = null;
      c.scene.traverse((o) => { if (!m && o.isMesh && o.name === 'alarmArrestPinion') m = o; });
      if (!m) return null;
      m.updateMatrixWorld(true);
      const bx = m.matrixWorld.elements[12] - ax.x, by = m.matrixWorld.elements[13] - ax.y;
      let deg = Math.atan2(by, bx) * 180 / Math.PI;
      if (deg < 0) deg += 360;
      return { deg: +deg.toFixed(1), r: +Math.hypot(bx, by).toFixed(3) };
    })(),
  };
});

console.log(`alarm arbor axis ${JSON.stringify(out.axis)} · mesh circle d ${out.cd} · pinion plane z ${out.pinZ}`);
console.log(`needs — pinion ${out.needs.pinion} · finger ${out.needs.finger} · cross ${out.needs.cross} (at d ${out.d})`);
console.log(`       arbor column ${out.needs.arbor} · cross stud column ${out.needs.stud}, both from the plate up`);
console.log(`${out.nSolids} obstacle solids in reach\n`);

const viable = out.rows.filter((r) => r.ok);
const pinOnly = out.rows.filter((r) => r.pinFree >= out.needs.pinion);
console.log(`stations holding the PINION:        ${pinOnly.length} of ${out.rows.length}`);
console.log(`stations holding ALL THREE members: ${viable.length} of ${out.rows.length}`);

// contiguous sectors, so the pick is a region and not a lucky sample
const runs = [];
let cur = null;
for (const r of out.rows) {
  if (r.ok) { if (cur && r.deg - cur.hi === 2) { cur.hi = r.deg; cur.rows.push(r); } else runs.push(cur = { lo: r.deg, hi: r.deg, rows: [r] }); }
  else cur = null;
}
for (const r of runs) r.best = r.rows.reduce((m, x) =>
  (x.z < m.z - 1e-9 || (Math.abs(x.z - m.z) < 1e-9 && x.slack > m.slack) ? x : m), r.rows[0]);
// lowest plane first (shortest arbor), slack as the tie-break
runs.sort((p, q) => (p.best.z - q.best.z) || (q.best.slack - p.best.slack));
console.log('\n--- contiguous viable sectors, by lowest viable plane then slack ---');
for (const r of runs.slice(0, 8)) {
  const b = r.best;
  console.log(`  ${String(r.lo).padStart(3)}°–${String(r.hi).padStart(3)}°  (${r.rows.length} stations)  best az ${String(b.deg).padStart(3)}°  z ${b.z}  crossAz ${String(b.crossAz).padStart(3)}°  slack ${b.slack}`);
  console.log(`        pinion ${b.pinFree} (${b.pinBy}) · finger ${b.finger} (${b.fingerBy}) · cross ${b.cross} (${b.crossBy})`);
  console.log(`        arbor  ${b.arbor} (${b.arborBy}) · stud ${b.stud} (${b.studBy})`);
}
const win = runs.length ? runs[0].best : null;
if (win) {
  console.log(`\n--- THE PICK (lowest plane; maximin slack breaks ties) ---`);
  console.log(`  station az ${win.deg}° · finger/cross plane z ${win.z} · cross az ${win.crossAz}°`);
  console.log(`  worst-member slack ${win.slack}`);
}
if (out.built) {
  const near = out.rows.reduce((m, r) =>
    (Math.abs(r.deg - out.built.deg) < Math.abs(m.deg - out.built.deg) ? r : m), out.rows[0]);
  console.log(`\nthe station AS BUILT: az ${out.built.deg}° at r ${out.built.r} (mesh circle ${out.cd})`);
  console.log(`  nearest swept sample az ${near.deg}°: pinion ${near.pinFree} vs ${out.needs.pinion}`
    + `  ${near.ok ? `— viable, plane z ${near.z}, cross az ${near.crossAz}°, slack ${near.slack}` : `— NOT viable, bounded by ${near.pinBy}`}`);
}
await browser.close();
srv.kill();
process.exit(viable.length ? 0 : 1);
