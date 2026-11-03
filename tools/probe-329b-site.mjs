// §329 landing 3b — WHERE COULD OPTION B'S GENEVA STAR STAND? A REPORT (it prints and judges nothing).
//   node tools/probe-329b-site.mjs ['k=v&…' spec] ['k=v&…' spec] …     several specs boot AT ONCE (tools/boot-pool.mjs), reported in order
// src/stopwork-arrest.js gives the star's size from the pin's orbit (the lug's, windArrest.lugOuter): a pivot a from the cone's axis and a
// tip circle of radius rTip about it, in the lug's z band. This samples the SURFACE of every unit's metal in that band (each triangle cut by
// the plane at the band's bottom, middle and top, then walked), the chain at ten tensions across the wind, and reports for each azimuth of
// the pivot the nearest foreign metal inside the star's disc (tip circle + CLEAR_MARGIN) — which unit it is, and how far in it stands.
// The cone ("Fusee & great wheel") is the LOCK DISC's seat, not a blocker: its radius in the band is printed instead, to be read against
// the lock window. "Winding arrest" is the part option B would replace, so it is left out.
import { bootMany } from './boot-pool.mjs';
import { genevaDims } from '../src/stopwork-arrest.js';
import { CLEAR_MARGIN } from '../src/layout.js';

const SPECS = process.argv.length > 2 ? process.argv.slice(2) : [''];
const EXPR = `(async () => {
  const c = window.__clock, wa = c.windArrest, C = c.P.barrel;
  const zlo = wa.lugZ[0], zhi = wa.lugZ[1], zs = [zlo, (zlo + zhi) / 2, zhi];
  const pts = [];   // [unit, x, y]
  const sampleMesh = (unit, m) => {
    m.updateWorldMatrix(true, false);
    const g = m.geometry, pos = g.attributes.position, idx = g.index, M = m.matrixWorld;
    const v = (i) => { const o = { x: pos.getX(i), y: pos.getY(i), z: pos.getZ(i) }; const w = new m.position.constructor(o.x, o.y, o.z).applyMatrix4(M); return w; };
    const n = idx ? idx.count : pos.count;
    for (let t = 0; t + 2 < n; t += 3) {
      const a = v(idx ? idx.getX(t) : t), b = v(idx ? idx.getX(t + 1) : t + 1), d = v(idx ? idx.getX(t + 2) : t + 2);
      if (Math.max(a.z, b.z, d.z) < zlo || Math.min(a.z, b.z, d.z) > zhi) continue;
      for (const z of zs) {
        const cut = [];
        for (const [p, q] of [[a, b], [b, d], [d, a]]) if ((p.z - z) * (q.z - z) < 0) { const u = (z - p.z) / (q.z - p.z); cut.push([p.x + u * (q.x - p.x), p.y + u * (q.y - p.y)]); }
        if (cut.length === 2) { const L = Math.hypot(cut[1][0] - cut[0][0], cut[1][1] - cut[0][1]), k = Math.max(1, Math.ceil(L / 0.2));
          for (let i = 0; i <= k; i++) pts.push([unit, cut[0][0] + (i / k) * (cut[1][0] - cut[0][0]), cut[0][1] + (i / k) * (cut[1][1] - cut[0][1])]); }
        else if (Math.abs(a.z - z) < 1e-9 && Math.abs(b.z - z) < 1e-9 && Math.abs(d.z - z) < 1e-9) for (const p of [a, b, d]) pts.push([unit, p.x, p.y]);
      }
    }
  };
  const meshes = (root) => { const o = []; root.traverse((x) => { if (x.isMesh && !x.userData.schematic && x.geometry?.attributes?.position) o.push(x); }); return o; };
  for (const e of c.labelEntries) { if (e.name === 'Winding arrest' || e.name === 'Chain' || e.name === 'Case') continue; for (const m of meshes(e.obj)) sampleMesh(e.name, m); }
  // the base plate and the three-quarter plate are HELD fixtures named by mesh
  c.movement.traverse((x) => { if (x.isMesh && (x.name === 'backPlate' || x.name === 'threeQuarterPlate') && x.geometry?.attributes?.position) sampleMesh(x.name, x); });
  const chain = [];
  for (let t = 0; t <= 1.0001; t += 0.1) { c.setPose({ tension: Math.min(t, 1) }); for (const e of c.labelEntries) if (e.name === 'Chain') for (const m of meshes(e.obj)) { const n0 = pts.length; sampleMesh('Chain', m); chain.push(...pts.splice(n0)); } }
  // the cone's own radius in the band: the farthest sampled point of the cone unit from the axis, per azimuth is overkill — report the max and min
  let coneMax = 0; const sec = new Array(72).fill(0);
  for (const [u, x, y] of pts) if (u === 'Fusee & great wheel') { const r = Math.hypot(x - C.x, y - C.y); coneMax = Math.max(coneMax, r); let a = Math.atan2(y - C.y, x - C.x); if (a < 0) a += 2 * Math.PI; const b = Math.min(71, Math.floor(a / (2 * Math.PI) * 72)); sec[b] = Math.max(sec[b], r); }
  return { C, lugOuter: wa.lugOuter, lugZ: wa.lugZ, coneMax, sec, pts: pts.filter((p) => p[0] !== 'Fusee & great wheel'), chain, units: [...new Set(pts.map((p) => p[0]))] };
})()`;

for (const { query, extra, warnings, bootError, unknownKeys } of await bootMany(SPECS, EXPR)) {
console.log(`\n=== ${query || '(default)'}`);
if (unknownKeys?.length) { console.log(`UNKNOWN QUERY KEY(S) ${unknownKeys.join(', ')} — the page ignored them, so this is not the spec asked for; skipped`); continue; }
if (bootError || !extra) { console.log('BOOT ERROR', bootError); continue; }
const { C, lugOuter, coneMax } = extra, all = [...extra.pts, ...extra.chain];
const d = genevaDims(4, lugOuter);
console.log(`boot warnings: ${warnings.length}; cone axis (${C.x.toFixed(2)}, ${C.y.toFixed(2)}); lug orbit ${lugOuter.toFixed(3)}; z band ${extra.lugZ.map((v) => v.toFixed(3)).join('..')}`);
console.log(`cone metal in the band reaches ${coneMax.toFixed(3)} from its axis; the lock window is ${d.lockLo.toFixed(3)}..${d.lockHi.toFixed(3)} (n=4: a ${d.a.toFixed(3)}, tip ${d.rTip.toFixed(3)}, slot inner ${d.rIn.toFixed(3)})`);
const sorted = [...extra.sec].sort((a, b) => a - b);
console.log(`cone metal per 5° sector: min ${sorted[0].toFixed(3)}, median ${sorted[36].toFixed(3)}, max ${sorted[71].toFixed(3)} (the median is the body, the max the lug)`);
console.log(`${all.length} surface samples (${extra.chain.length} chain) from ${extra.units.length} units\n\nstar pivot azimuth (deg, movement frame) → nearest foreign metal inside the disc (tip + ${CLEAR_MARGIN}):`);
const R = d.rTip + CLEAR_MARGIN;
const freeAz = [];
for (let az = 0; az < 360; az += 5) {
  const a = (az * Math.PI) / 180, px = C.x + d.a * Math.cos(a), py = C.y + d.a * Math.sin(a);
  let worst = null;
  for (const [u, x, y] of all) { const dist = Math.hypot(x - px, y - py); if (dist < R && (!worst || R - dist > worst.depth)) worst = { u, depth: R - dist }; }
  if (!worst) freeAz.push(az);
  if (!process.env.QUIET) console.log(`  ${String(az).padStart(3)}°  ${worst ? `${worst.u} stands ${worst.depth.toFixed(2)} inside` : 'FREE'}`);
}
console.log(`\nfree azimuths: ${freeAz.length ? freeAz.join(', ') : 'none'}`);
}
