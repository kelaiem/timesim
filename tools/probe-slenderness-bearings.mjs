// TODO 78 — the alarm link's lay shaft, MEASURED. Every number the §54 note
// block quotes about this shaft (33.387, 2.45, 22, λ 135.4, "the 19.55 u
// bush-to-bush span") comes from prose; this reads them off the built tree.
//
// It answers three things and nothing else:
//   1. What the SHAFT MESH actually is — the geometry box the check reads,
//      and the chord it is cut from (the two differ: the rod retreats
//      ALARM_FORK_RETREAT so the centre pin can span the gap to the fork).
//   2. Where the bushes actually sit, DETECTED from the tree rather than
//      taken from the source literals, and therefore what the free lengths
//      between and beyond them are.
//   3. What λ is over each of those free lengths at the shipped section, and
//      what section / how many bearings the §54 ceiling would need.
//
// Usage: node probe-slenderness-bearings.mjs [out.json]   (from tools/;
// needs npm ci + Playwright Chromium). ROOT= serves a different tree.
import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import { writeFileSync } from 'node:fs';

const PORT = process.env.PORT || 8461;
const ROOT = process.env.ROOT || '..';
const srv = spawn('python3', ['-m', 'http.server', String(PORT), '--bind', '127.0.0.1'], { cwd: ROOT, stdio: 'ignore' });
await new Promise((r) => setTimeout(r, 800));
const browser = await chromium.launch();
const page = await browser.newPage();
page.on('pageerror', (e) => console.error('PAGEERROR', String(e)));
await page.goto(`http://127.0.0.1:${PORT}/index.html`, { waitUntil: 'load', timeout: 60000 });
await page.waitForFunction(() => !!window.__clock, null, { timeout: 60000 });

const V = await page.evaluate(async () => {
  const THREE = await import('./vendor/three.module.js');
  const L = await import('./src/layout.js');
  const clock = window.__clock;
  clock.resetInputs();
  clock.scene.updateMatrixWorld(true);

  const byName = (n) => clock.scene.getObjectByName(n);
  const shaft = byName('alarmLinkShaft');
  if (!shaft) throw new Error('alarmLinkShaft is not in the scene');
  shaft.geometry.computeBoundingBox();
  const bb = shaft.geometry.boundingBox;
  const ext = { x: bb.max.x - bb.min.x, y: bb.max.y - bb.min.y, z: bb.max.z - bb.min.z };
  const sorted = [ext.x, ext.y, ext.z].sort((a, b) => a - b);
  const [tMin, tMid, len] = sorted;
  const longAxis = ['x', 'y', 'z'].find((k) => ext[k] === len);

  // The mesh's two ends in world, and the unit vector along it.
  const wv = (o, x, y, z) => new THREE.Vector3(x, y, z).applyMatrix4(o.matrixWorld);
  const half = len / 2;
  const eA = wv(shaft, longAxis === 'x' ? -half : 0, longAxis === 'y' ? -half : 0, longAxis === 'z' ? -half : 0);
  const eB = wv(shaft, longAxis === 'x' ? half : 0, longAxis === 'y' ? half : 0, longAxis === 'z' ? half : 0);

  // Which end is the CENTRE (inner) end? The centre pin lives there.
  const pin = byName('alarmLinkCentrePin');
  const pinW = pin ? new THREE.Vector3().setFromMatrixPosition(pin.matrixWorld) : null;
  const innerIsA = pinW ? eA.distanceTo(pinW) < eB.distanceTo(pinW) : true;
  const inner = innerIsA ? eA : eB, outer = innerIsA ? eB : eA;
  const u = outer.clone().sub(inner).normalize();

  // DETECT the bushes: LatheGeometry meshes of the Alarm link unit whose
  // centre sits on the shaft's line. Their station is measured from the
  // shaft's own inner END (not from the chord origin) — the free lengths of
  // THIS MESH are what λ is about.
  const entry = clock.labelEntries.find((e) => e.name === 'Alarm link');
  const rings = [];
  entry.obj.traverse((m) => {
    if (!m.isMesh || m === shaft) return;
    const c = new THREE.Vector3().setFromMatrixPosition(m.matrixWorld);
    const d = c.clone().sub(inner);
    const s = d.dot(u);
    const off = d.clone().addScaledVector(u, -s).length();
    if (off < 0.05 && s > -0.05 && s < len + 0.05)
      rings.push({ type: m.geometry.type, s: +s.toFixed(4), off: +off.toFixed(4) });
  });
  rings.sort((a, b) => a.s - b.s);
  // Bushes are the turned rings; the hanger posts are boxes standing off in z.
  const bushS = rings.filter((r) => r.type === 'LatheGeometry').map((r) => r.s);

  // Free lengths of the METAL, in the mesh's own parameter space.
  const cuts = [0, ...bushS, len];
  const segs = [];
  for (let i = 0; i < cuts.length - 1; i++) {
    const Lseg = cuts[i + 1] - cuts[i];
    const kind = (i === 0 || i === cuts.length - 2) ? 'overhang' : 'span';
    segs.push({ kind, from: +cuts[i].toFixed(4), to: +cuts[i + 1].toFixed(4), L_u: +Lseg.toFixed(4),
      L_mm: +(Lseg * L.UNIT_MM).toFixed(4), lambdaRaw: +(Lseg / tMid).toFixed(2) });
  }

  // Stiffness under each segment's OWN end conditions: a span pinned both
  // ends loaded at midspan is 48EI/L³; an overhang loaded at its free tip is
  // 3EI/L³. The existing column applies the cantilever form to the whole part.
  const E = 200e9, r = tMid / 2 * L.UNIT_MM * 1e-3;
  const I = Math.PI * r ** 4 / 4;
  for (const s of segs) {
    const Lm = s.L_mm * 1e-3;
    s.stiffness_N_per_m = +((s.kind === 'span' ? 48 : 3) * E * I / Lm ** 3).toFixed(1);
    s.stiffnessModel = s.kind === 'span' ? '48EI/L³' : '3EI/L³';
  }

  return {
    unitMm: L.UNIT_MM, slenderMax: L.SLENDER_MAX,
    shaft: {
      geometryType: shaft.geometry.type,
      params: shaft.geometry.parameters ? { ...shaft.geometry.parameters } : null,
      longAxis, extents: { x: +ext.x.toFixed(4), y: +ext.y.toFixed(4), z: +ext.z.toFixed(4) },
      tMin: +tMin.toFixed(4), tMid: +tMid.toFixed(4), len_u: +len.toFixed(4),
      len_mm: +(len * L.UNIT_MM).toFixed(4),
      lambdaWholeMesh: +(len / tMid).toFixed(2),
      innerEndWorld: inner.toArray().map((v) => +v.toFixed(3)),
      outerEndWorld: outer.toArray().map((v) => +v.toFixed(3)),
    },
    ringsOnAxis: rings,
    bushStationsOnMesh: bushS.map((s) => +s.toFixed(4)),
    segments: segs,
  };
});

await browser.close();
srv.kill();
writeFileSync(process.argv[2] || 'slenderness-bearings.json', JSON.stringify(V, null, 2));

const f = (n, d = 3) => Number(n).toFixed(d);
const S = V.shaft;
console.log(`alarmLinkShaft — ${S.geometryType}, long axis ${S.longAxis}`);
console.log(`  metal ${f(S.len_u)} u (${f(S.len_mm)} mm), section tMid ${f(S.tMid, 4)} u  ⇒  λ over the WHOLE MESH = ${f(S.lambdaWholeMesh, 1)}`);
console.log(`  ends: inner ${S.innerEndWorld.join(', ')}   outer ${S.outerEndWorld.join(', ')}`);
console.log(`meshes found ON the shaft axis (station measured from the inner END OF METAL):`);
for (const r of V.ringsOnAxis) console.log(`  ${r.type} at s ${f(r.s)} (off-axis ${f(r.off, 4)})`);
console.log(`free lengths, ceiling ${V.slenderMax}:`);
for (const s of V.segments)
  console.log(`  ${s.kind.padEnd(8)} ${f(s.from)} → ${f(s.to)}  L ${f(s.L_u)} u / ${f(s.L_mm)} mm  λ ${f(s.lambdaRaw, 1)}  k ${s.stiffness_N_per_m} N/m (${s.stiffnessModel})`);
