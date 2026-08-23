// TODO 77 — HOW DEEPLY DO THE RESERVE TRAIN'S TWO MESHES INTERPENETRATE?
//
// `probe-reserve-mesh.mjs` next door answers the other half of the question:
// are the two meshes in PHASE (a tooth against a gap on the line of centres).
// It measures 0.07% of a pitch off anti-phase, and it is measuring the right
// thing — but a correct phase at a correct centre distance cannot stop two
// NON-CONJUGATE outlines from passing through each other, which is exactly
// what `gearOutlineShape`'s straight-chord flanks are. So this is the second
// instrument: not "are they aligned" but "how much metal is in the same place".
//
// THE MEASURE, and its honest limit. For each gear pair, one gear's vertices
// are tested against the other's SILHOUETTE — the max radius per angular bin
// about that gear's own axis, 4096 bins. A gear outline is star-shaped about
// its axis (every ray from the centre crosses the boundary once), so a point
// at radius r and angle θ is inside the metal exactly when r < R(θ), and the
// depth is R(θ) − r. That is a RADIAL overlap: an upper bound on the
// minimum-translation penetration depth, never that depth itself. Quoted as
// what it is, because the alternative — calling it "penetration" — would
// overstate a number that is already bad enough.
//
// Tested BOTH ways per pair (A into B and B into A) and swept over the wind,
// because the worst pose is not the build pose: stage one peaks at tension
// 0.20 and stage two at 0.475.
//
// The pairs are identified STRUCTURALLY rather than by index — by axis and
// z-band — because the unit carries six extrusions (four gears and two studs)
// and an index list would silently re-point if a body were added. The first
// cut of this probe did exactly that and compared a stud against a pinion,
// reporting 1.55 mm of overlap between two bodies that share an axis and do
// not share a z-band at all.
//
// Run from tools/ with a Playwright Chromium: `node probe-reserve-mesh-overlap.mjs`.
// Re-run it after roadmap §136 lands: if the overlap does not go to zero, the
// new profile is not conjugate either, and TODO 77 is still the number.
import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
const port = process.env.PORT || '8479';
const root = process.env.ROOT || '..';
const srv = spawn('python3', ['-m', 'http.server', port, '--bind', '127.0.0.1'], { cwd: root, stdio: 'ignore' });
await new Promise((r) => setTimeout(r, 900));
const browser = await chromium.launch();
const page = await browser.newPage();
page.on('pageerror', (e) => console.log('PAGEERROR', String(e)));
await page.goto(`http://127.0.0.1:${port}/index.html`, { waitUntil: 'load', timeout: 90000 });
await page.waitForFunction(() => !!window.__clock, null, { timeout: 90000 });

const out = await page.evaluate(async () => {
  const C = window.__clock;
  const L = await import('/src/layout.js');
  const train = C.labelEntries.find((e) => e.name === 'Power-reserve train')?.obj;
  if (!train) return { error: 'no Power-reserve train label' };

  const bodies = [];
  train.traverse((o) => {
    if (!o.isMesh || o.geometry?.type !== 'ExtrudeGeometry') return;
    o.updateWorldMatrix(true, true);
    const e = o.matrixWorld.elements, ox = e[12], oy = e[13];
    const pos = o.geometry.attributes.position;
    const v = new (Object.getPrototypeOf(o.position).constructor)();
    let zlo = Infinity, zhi = -Infinity, tipR = 0;
    for (let i = 0; i < pos.count; i++) {
      v.fromBufferAttribute(pos, i).applyMatrix4(o.matrixWorld);
      if (v.z < zlo) zlo = v.z;
      if (v.z > zhi) zhi = v.z;
      const r = Math.hypot(v.x - ox, v.y - oy);
      if (r > tipR) tipR = r;
    }
    bodies.push({ obj: o, ox, oy, zlo, zhi, tipR });
  });
  // A MESH is two bodies on different axes whose z-bands overlap and whose tip
  // circles reach each other. Studs fail the tip test; the coaxial wheel+pinion
  // pair fails the axis test; the two stages fail each other's z test.
  const axisApart = (a, b) => Math.hypot(a.ox - b.ox, a.oy - b.oy);
  const meshes = [];
  for (let i = 0; i < bodies.length; i++) {
    for (let j = i + 1; j < bodies.length; j++) {
      const a = bodies[i], b = bodies[j], d = axisApart(a, b);
      if (d < 1e-6) continue;                                  // coaxial: one part
      if (Math.min(a.zhi, b.zhi) - Math.max(a.zlo, b.zlo) <= 0) continue;  // different planes
      if (a.tipR + b.tipR < d) continue;                       // tip circles do not reach
      meshes.push({ a, b, centre: d });
    }
  }

  const BINS = 4096;
  const silhouette = (g) => {
    g.obj.updateWorldMatrix(true, true);
    const e = g.obj.matrixWorld.elements, ox = e[12], oy = e[13];
    const pos = g.obj.geometry.attributes.position;
    const R = new Float64Array(BINS);
    const v = new (Object.getPrototypeOf(g.obj.position).constructor)();
    for (let i = 0; i < pos.count; i++) {
      v.fromBufferAttribute(pos, i).applyMatrix4(g.obj.matrixWorld);
      const dx = v.x - ox, dy = v.y - oy;
      const r = Math.hypot(dx, dy);
      let th = Math.atan2(dy, dx); if (th < 0) th += Math.PI * 2;
      const k = Math.min(BINS - 1, ((th / (Math.PI * 2)) * BINS) | 0);
      if (r > R[k]) R[k] = r;
    }
    return { R, ox, oy };
  };
  const deepestInto = (A, B) => {
    const sb = silhouette(B);
    A.obj.updateWorldMatrix(true, true);
    const pos = A.obj.geometry.attributes.position;
    const v = new (Object.getPrototypeOf(A.obj.position).constructor)();
    let worst = 0;
    for (let i = 0; i < pos.count; i++) {
      v.fromBufferAttribute(pos, i).applyMatrix4(A.obj.matrixWorld);
      const dx = v.x - sb.ox, dy = v.y - sb.oy;
      const r = Math.hypot(dx, dy);
      let th = Math.atan2(dy, dx); if (th < 0) th += Math.PI * 2;
      const k = Math.min(BINS - 1, ((th / (Math.PI * 2)) * BINS) | 0);
      if (sb.R[k] > 0 && sb.R[k] - r > worst) worst = sb.R[k] - r;
    }
    return worst;
  };

  const STEPS = 40;
  const rows = meshes.map((m) => ({ centre: +m.centre.toFixed(4), tipR: [+m.a.tipR.toFixed(3), +m.b.tipR.toFixed(3)], worstU: 0, atTension: null }));
  for (let i = 0; i <= STEPS; i++) {
    const t = i / STEPS;
    C.setPose({ tension: t });
    C.render();
    meshes.forEach((m, k) => {
      const d = Math.max(deepestInto(m.a, m.b), deepestInto(m.b, m.a));
      if (d > rows[k].worstU) { rows[k].worstU = d; rows[k].atTension = +t.toFixed(3); }
    });
  }
  return {
    unitMM: L.UNIT_MM,
    bodies: bodies.length,
    rows: rows.map((r) => ({ ...r, worstU: +r.worstU.toFixed(4), worstMM: +(r.worstU * L.UNIT_MM).toFixed(4) })),
  };
});

if (out.error) { console.log('ERROR', out.error); }
else {
  console.log(`${out.bodies} extruded bodies in the unit, ${out.rows.length} of their pairs are meshes\n`);
  console.log('centre dist   tip radii        worst RADIAL overlap   at tension');
  for (const r of out.rows) {
    console.log(`${String(r.centre).padEnd(13)} ${String(r.tipR.join(' / ')).padEnd(16)} `
      + `${(r.worstU.toFixed(4) + ' u = ' + r.worstMM.toFixed(4) + ' mm').padEnd(22)} ${r.atTension}`);
  }
  console.log('\nRadial overlap is an UPPER BOUND on the minimum-translation penetration '
    + 'depth, not that depth. Zero is what a conjugate profile would read (roadmap §136).');
}
await browser.close();
srv.kill();
