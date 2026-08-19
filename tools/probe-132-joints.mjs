// §132 — MEASURE the intra-unit joints the chatons add. `intraUnit`'s FF tier
// REPORTS rather than gates outside INTRA_TIER_SCOPE, and 'Three-quarter
// plate' is outside it, so the fifteen new rows in that report are exactly
// the residue CLAUDE.md says to measure yourself. This does that: signed
// clearance for each named pair, at the base pose.
//
//   node tools/probe-132-joints.mjs
import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
const port = process.env.PORT || '8531';
const srv = spawn('python3', ['-m', 'http.server', port, '--bind', '127.0.0.1'],
  { cwd: new URL('..', import.meta.url).pathname, stdio: 'ignore' });
await new Promise((r) => setTimeout(r, 1200));
const b = await chromium.launch();
const p = await b.newPage();
await p.goto(`http://127.0.0.1:${port}/index.html`, { waitUntil: 'load', timeout: 90000 });
await p.waitForFunction(() => !!window.__clock, null, { timeout: 60000 });
const rows = await p.evaluate(async () => {
  const I = await import('./src/inspect.js');
  const C = window.__clock;
  C.scene.updateMatrixWorld(true);
  const plate = C.labelEntries.find((e) => e.name === 'Three-quarter plate').obj;
  const by = new Map();
  plate.traverse((o) => {
    if (!o.isMesh) return;
    const n = o.name || o.geometry.type + '#?';
    if (!by.has(n)) by.set(n, []);
    by.get(n).push(o);
  });
  const PAIRS = [
    ['pivotCollar', 'chatonSeatLand'],
    ['pivotCollar', 'chatonBezel'],
    ['chatonBezel', 'chatonJewel'],
    ['chatonBezel', 'screwHeads'],
    ['threeQuarterPlate', 'chatonBezel'],
    ['threeQuarterPlate', 'chatonSeatLand'],
    ['threeQuarterPlate', 'pivotCollar'],
  ];
  const out = [];
  for (const [an, bn] of PAIRS) {
    const A = by.get(an) || [], B = by.get(bn) || [];
    let worst = Infinity, n = 0;
    for (const x of A) for (const y of B) {
      const d = I.meshClearance(x, y);
      const v = typeof d === 'number' ? d : (d && d.distance);
      if (typeof v === 'number') { worst = Math.min(worst, v); n++; }
    }
    out.push({ kind: 'clearance', a: an, b: bn, meshes: `${A.length}×${B.length}`, tested: n,
      worst: Number.isFinite(worst) ? +worst.toFixed(5) : null });
  }
  // meshClearance CANNOT tell touching from overlapping — a BVH distance is
  // non-negative either way — so the joints this entry claims are measured
  // on the surfaces that define them instead: radii about the pivot, and the
  // seating planes in z. Chaton sites only (the three with a bezel).
  const THREE = (await import('three'));
  const sites = [];
  for (const bez of (by.get('chatonBezel') || [])) {
    const c = new THREE.Vector3();
    bez.getWorldPosition(c);
    sites.push({ x: c.x, y: c.y });
  }
  const near = (o, s) => { const c = new THREE.Vector3(); o.getWorldPosition(c);
    return Math.hypot(c.x - s.x, c.y - s.y) < 0.001; };
  const band = (o, s) => {                        // radii about the site, and z extent
    const v = new THREE.Vector3(); o.updateMatrixWorld(true);
    const pos = o.geometry.attributes.position;
    let rMin = Infinity, rMax = 0, zMin = Infinity, zMax = -Infinity;
    for (let i = 0; i < pos.count; i++) {
      v.fromBufferAttribute(pos, i).applyMatrix4(o.matrixWorld);
      const r = Math.hypot(v.x - s.x, v.y - s.y);
      rMin = Math.min(rMin, r); rMax = Math.max(rMax, r);
      zMin = Math.min(zMin, v.z); zMax = Math.max(zMax, v.z);
    }
    return { rMin, rMax, zMin, zMax };
  };
  for (const s of sites) {
    const collar = (by.get('pivotCollar') || []).find((o) => near(o, s));
    const bez = (by.get('chatonBezel') || []).find((o) => near(o, s));
    const lands = (by.get('chatonSeatLand') || []).filter((o) => {
      const bb = band(o, s); return bb.rMax < 3;         // this site's three
    });
    if (!collar || !bez || lands.length !== 3) continue;
    const C = band(collar, s), Z = band(bez, s);
    const landRmin = Math.min(...lands.map((o) => band(o, s).rMin));
    out.push({ kind: 'joint', site: `${s.x.toFixed(2)},${s.y.toFixed(2)}`,
      collarOuterR: +C.rMax.toFixed(4), landInnerR: +landRmin.toFixed(4),
      radialGap: +(landRmin - C.rMax).toFixed(5),
      collarTopZ: +C.zMax.toFixed(4), bezelBottomZ: +Z.zMin.toFixed(4),
      seatGap: +(Z.zMin - C.zMax).toFixed(5) });
  }
  return out;
});
for (const r of rows.filter((x) => x.kind === 'clearance')) {
  console.log(`${r.a} ⇄ ${r.b}`.padEnd(46), `${r.meshes}`.padEnd(7),
    r.worst === null ? 'not measurable' : `worst ${r.worst >= 0 ? '+' : ''}${r.worst}`);
}
console.log('\nthe joints, on the surfaces that define them '
  + '(a BVH distance cannot tell touching from overlapping):');
for (const r of rows.filter((x) => x.kind === 'joint')) {
  console.log(`  site ${r.site}`.padEnd(22)
    + `collar OD ${r.collarOuterR} vs land ID ${r.landInnerR} -> radial ${r.radialGap >= 0 ? '+' : ''}${r.radialGap}   `
    + `collar top ${r.collarTopZ} vs bezel base ${r.bezelBottomZ} -> seat ${r.seatGap >= 0 ? '+' : ''}${r.seatGap}`);
}
await b.close(); srv.kill();
