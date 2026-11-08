// WHAT DOES THE MAINSPRING DRUM BIND, AND IS THERE ROOM FOR A SECOND ONE? A REPORT (BACKLOG §339 landing 0: a twin-barrel
// going train): it boots each spec and prints, judging nothing.
//
//   node tools/probe-twin-barrel-room.mjs [--json FILE] ['<query>' …]      (no queries: the DEFAULT_SPECS below)
//
// Per boot, read at the rest pose (tension as booted) unless a row says otherwise:
//   (a) REACH: what the drum's group (Mainspring drum, Chain, Set-up work) sets. On the round build, its farthest metal
//       against plateR and against the rest of the metal's farthest radius. On a form build, per side (±x, ±y), how far
//       the group stands past everything else counted: a positive excursion is a side the drum sets, and the most a
//       smaller drum could give back there.
//   (b) FREE DISCS: the largest discs clear of all labelled metal over the drum's z band (one CLEAR_MARGIN either side),
//       inside the allowed region: the round plate one CLEAR_MARGIN in (TODO 207's bound), or on a form build the convex
//       hull of the counted metal (a disc inside it cannot grow a convex fit). Two obstacle sets: with the drum's group
//       (room for a SECOND drum beside today's), and without it (room once drum A shrinks). A raster at RES and an exact
//       Euclidean distance transform; a triangle counts whole if its z range meets the band, the safe direction (discs
//       read small). Moving parts are measured at rest only, so a free disc is a CANDIDATE for landing 2's sweeps.
//   (c) THE CHAIN'S Z on drum A over the reserve (setPose tension 0…1): the coil's z extent within the drum's wall
//       annulus and the span's outside it, so the coupling band's legal window is [drum bottom, coil low) ∪ (coil top,
//       drum top].
//   (d) DEPTH: the next metal above and below the drum inside its plan disc, and every unit OUTSIDE the drum's group
//       whose top stands within 2·CLEAR_MARGIN of the drum's top: if that list is not empty, a thinner drum lowers
//       nothing by itself.
//   (e) PACKING (SJX Watches, Ichim 2025, the source §339 cites): α = r/e (innermost coil's radius over the strip's
//       thickness; today's floor ~10, Defossez 16), r/R and the fill, off the spring's own record (userData.mainspring).
//
// The control is the build itself: the round default must read the drum's reach equal to its TODO 207 plate bound
// (plateR − CLEAR_MARGIN to within 0.01), and a form build's drum must read a positive excursion on the side §327 found
// it setting (alarm=0&case=fitted: +y). A boot with an unknown query key is refused (tool-construction §3).
import { writeFileSync } from 'node:fs';
import { bootMany } from './boot-pool.mjs';

const DEFAULT_SPECS = [
  '',                                                        // the round default (validated 'identity')
  'case=rect&formrect=-45.72,45.72,-44.38,44.38',            // the validated 'form-rect' point (src/validated-configs.js)
  'case=cushion',
  'case=tonneau',
  'case=fitted',
  'alarm=0&case=fitted',                                     // §327's boot (docs/built/0327.md)
  'case=free&alarm=0&barrelstep=-140&rsvaz=0&rsvidl=2&frame=lands', // the lands preview (docs/built/0075.md)
];

const EXPR = `(() => {
  const c = window.__clock, CM = 0.15, RES = 0.2;
  const DRUM_UNITS = ['Mainspring drum', 'Chain', 'Set-up work'];
  const SKIP = /^Case\\b|liner/i;
  const sp = c.scene.getObjectByName('spring'), ms = sp.userData.mainspring;
  const drumObj = c.labelEntries.find((e) => e.name === 'Mainspring drum').obj;
  // world vertices / triangles per unit
  // EVERY mesh in the scene, not only the labelled units: the base plate (a held fixture, TODO 187) and any unlabelled
  // part are metal a second drum must clear. Each mesh is filed under its nearest labelled ancestor, else 'unlabelled:<name>'.
  const labelOf = new Map(c.labelEntries.map((e) => [e.obj, e.name]));
  c.scene.updateWorldMatrix(true, true);
  const byName = new Map();
  c.scene.traverse((o) => {
    if (!o.isMesh || !o.geometry?.attributes?.position) return;
    let unit = null;
    for (let a = o; a; a = a.parent) { if (a.userData?.schematic) return; if (unit === null && labelOf.has(a)) unit = labelOf.get(a); }
    if (unit === null) unit = (o.name === 'plate' ? 'Base plate' : 'unlabelled:' + (o.name || o.geometry.type));
    if (SKIP.test(unit) || unit === 'unlabelled:PlaneGeometry') return;   // the case, its liners, and the scene's backdrop plane
    if (!byName.has(unit)) byName.set(unit, []);
    byName.get(unit).push(o);
  });
  const units = [...byName.keys()].map((name) => ({ name }));
  const meshesOf = (name) => byName.get(name);
  const W = (o) => { const p = o.geometry.attributes.position, e = o.matrixWorld.elements, n = p.count, a = new Float64Array(n * 3);
    for (let i = 0; i < n; i++) { const x = p.getX(i), y = p.getY(i), z = p.getZ(i);
      a[3*i] = e[0]*x+e[4]*y+e[8]*z+e[12]; a[3*i+1] = e[1]*x+e[5]*y+e[9]*z+e[13]; a[3*i+2] = e[2]*x+e[6]*y+e[10]*z+e[14]; } return a; };
  const data = units.map((u) => ({ name: u.name, drum: DRUM_UNITS.includes(u.name), meshes: meshesOf(u.name).map((m) => ({ v: W(m), idx: m.geometry.index ? m.geometry.index.array : null, name: m.name })) }));
  // drum band from the drum unit's own metal
  let dz0 = Infinity, dz1 = -Infinity;
  for (const m of data.find((d) => d.name === 'Mainspring drum').meshes) for (let i = 2; i < m.v.length; i += 3) { dz0 = Math.min(dz0, m.v[i]); dz1 = Math.max(dz1, m.v[i]); }
  const D = c.drum;
  // (a) reach
  const THROUGH = /stem|crown|pusher/i;
  const counted = (d) => !THROUGH.test(d.name) && !/three-quarter plate|^Dial\\b|base plate|^unlabelled:(dial|backPlate)/i.test(d.name);
  const ext = (pred) => { let x0=Infinity,x1=-Infinity,y0=Infinity,y1=-Infinity,rr=0,by=null; const side = {};
    for (const d of data) if (pred(d)) for (const m of d.meshes) { if (THROUGH.test(m.name)) continue; for (let i = 0; i < m.v.length; i += 3) { const x=m.v[i], y=m.v[i+1];
      if (x<x0){x0=x;side['-x']=d.name;} if(x>x1){x1=x;side['+x']=d.name;} if(y<y0){y0=y;side['-y']=d.name;} if(y>y1){y1=y;side['+y']=d.name;} const r=Math.hypot(x,y); if(r>rr){rr=r;by=d.name;} } }
    return { x0, x1, y0, y1, r: rr, farthestBy: by, sideBy: side }; };
  const g = ext((d) => d.drum), rest = ext((d) => !d.drum && counted(d));
  const reach = { drumGroup: g, rest, excursion: { '-x': rest.x0 - g.x0, '+x': g.x1 - rest.x1, '-y': rest.y0 - g.y0, '+y': g.y1 - rest.y1 },
    plateR: c.plateR, drumFarthest: Math.hypot(D.x, D.y) + D.reachR, restFarthestR: rest.r, drumCentre: [D.x, D.y], drumDist: D.dist, drumReachR: D.reachR };
  // (b) free discs
  const hull = (pts) => { pts.sort((a, b) => a[0] - b[0] || a[1] - b[1]); const cr = (o, a, b) => (a[0]-o[0])*(b[1]-o[1])-(a[1]-o[1])*(b[0]-o[0]);
    const lo = [], up = []; for (const p of pts) { while (lo.length >= 2 && cr(lo[lo.length-2], lo[lo.length-1], p) <= 0) lo.pop(); lo.push(p); }
    for (let i = pts.length - 1; i >= 0; i--) { const p = pts[i]; while (up.length >= 2 && cr(up[up.length-2], up[up.length-1], p) <= 0) up.pop(); up.push(p); }
    return lo.slice(0, -1).concat(up.slice(0, -1)); };
  const form = !!c.formFootprint;
  let region;
  if (form) { const pts = []; for (const d of data) if (!d.drum && counted(d)) for (const m of d.meshes) { if (THROUGH.test(m.name)) continue; for (let i = 0; i < m.v.length; i += 3) pts.push([m.v[i], m.v[i+1]]); }
    region = { kind: 'hull of counted metal (drum group out)', poly: hull(pts) }; }
  else region = { kind: 'plate circle', R: c.plateR - CM };
  const inside = (x, y) => { if (!form) return Math.hypot(x, y) <= region.R; const P = region.poly; let s = true;
    for (let i = 0; i < P.length; i++) { const a = P[i], b = P[(i+1) % P.length]; if ((b[0]-a[0])*(y-a[1]) - (b[1]-a[1])*(x-a[0]) < 0) { s = false; break; } } return s; };
  let bx0, bx1, by0, by1;
  if (form) { bx0 = Math.min(...region.poly.map((p) => p[0])); bx1 = Math.max(...region.poly.map((p) => p[0])); by0 = Math.min(...region.poly.map((p) => p[1])); by1 = Math.max(...region.poly.map((p) => p[1])); }
  else { bx0 = by0 = -region.R; bx1 = by1 = region.R; }
  const nx = Math.ceil((bx1 - bx0) / RES) + 1, ny = Math.ceil((by1 - by0) / RES) + 1;
  const z0 = dz0 - CM, z1 = dz1 + CM;
  const field = (withDrum) => {
    const occ = new Uint8Array(nx * ny);
    const mark = (x, y) => { const i = Math.round((x - bx0) / RES), j = Math.round((y - by0) / RES); if (i >= 0 && j >= 0 && i < nx && j < ny) occ[j * nx + i] = 1; };
    const byUnit = {};
    for (const d of data) { if (d.drum && !withDrum) continue;
      for (const m of d.meshes) { const v = m.v, n = m.idx ? m.idx.length : v.length / 3;
        for (let t = 0; t + 2 < n; t += 3) {
          const ia = m.idx ? m.idx[t] : t, ib = m.idx ? m.idx[t+1] : t+1, ic = m.idx ? m.idx[t+2] : t+2;
          const za = v[3*ia+2], zb = v[3*ib+2], zc = v[3*ic+2];
          if (Math.max(za, zb, zc) < z0 || Math.min(za, zb, zc) > z1) continue;
          byUnit[d.name] = (byUnit[d.name] || 0) + 1;
          const ax = v[3*ia], ay = v[3*ia+1], bxx = v[3*ib], byy = v[3*ib+1], cx = v[3*ic], cy = v[3*ic+1];
          // edges sampled at RES/2, interior by cell centres
          for (const [p, q] of [[[ax,ay],[bxx,byy]],[[bxx,byy],[cx,cy]],[[cx,cy],[ax,ay]]]) { const L = Math.hypot(q[0]-p[0], q[1]-p[1]), k = Math.max(1, Math.ceil(L / (RES / 2)));
            for (let s = 0; s <= k; s++) mark(p[0] + (q[0]-p[0]) * s / k, p[1] + (q[1]-p[1]) * s / k); }
          const tx0 = Math.min(ax,bxx,cx), tx1 = Math.max(ax,bxx,cx), ty0 = Math.min(ay,byy,cy), ty1 = Math.max(ay,byy,cy);
          if (tx1 - tx0 < RES && ty1 - ty0 < RES) continue;
          const den = (byy-cy)*(ax-cx) + (cx-bxx)*(ay-cy); if (Math.abs(den) < 1e-12) continue;
          for (let j = Math.max(0, Math.ceil((ty0-by0)/RES)); j <= Math.min(ny-1, Math.floor((ty1-by0)/RES)); j++)
            for (let i = Math.max(0, Math.ceil((tx0-bx0)/RES)); i <= Math.min(nx-1, Math.floor((tx1-bx0)/RES)); i++) {
              const x = bx0 + i*RES, y = by0 + j*RES, l1 = ((byy-cy)*(x-cx) + (cx-bxx)*(y-cy)) / den, l2 = ((cy-ay)*(x-cx) + (ax-cx)*(y-cy)) / den;
              if (l1 >= 0 && l2 >= 0 && l1 + l2 <= 1) occ[j*nx + i] = 1; } } } }
    // outside the region is occupied
    for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) if (!inside(bx0 + i*RES, by0 + j*RES)) occ[j*nx + i] = 1;
    // exact EDT (Felzenszwalb) in cells², then free radius = dist − CM
    const INF = 1e20, f = new Float64Array(Math.max(nx, ny)), dd = new Float64Array(Math.max(nx, ny)), vv = new Int32Array(Math.max(nx, ny)), zz = new Float64Array(Math.max(nx, ny) + 1);
    const edt1 = (n) => { let k = 0; vv[0] = 0; zz[0] = -INF; zz[1] = INF;
      for (let q = 1; q < n; q++) { let s; while (true) { s = ((f[q] + q*q) - (f[vv[k]] + vv[k]*vv[k])) / (2*q - 2*vv[k]); if (s <= zz[k]) { k--; continue; } break; }
        k++; vv[k] = q; zz[k] = s; zz[k+1] = INF; }
      k = 0; for (let q = 0; q < n; q++) { while (zz[k+1] < q) k++; dd[q] = (q - vv[k]) ** 2 + f[vv[k]]; } };
    const G = new Float64Array(nx * ny);
    for (let i = 0; i < nx * ny; i++) G[i] = occ[i] ? 0 : INF;
    for (let i = 0; i < nx; i++) { for (let j = 0; j < ny; j++) f[j] = G[j*nx + i]; edt1(ny); for (let j = 0; j < ny; j++) G[j*nx + i] = dd[j]; }
    for (let j = 0; j < ny; j++) { for (let i = 0; i < nx; i++) f[i] = G[j*nx + i]; edt1(nx); for (let i = 0; i < nx; i++) G[j*nx + i] = dd[i]; }
    // three best discs, each centre outside the previous discs
    const best = [];
    for (let pass = 0; pass < 3; pass++) { let bi = -1, bv = -1;
      for (let i = 0; i < nx * ny; i++) { if (G[i] <= bv) continue; const x = bx0 + (i % nx)*RES, y = by0 + Math.floor(i / nx)*RES, r = Math.sqrt(G[i]) * RES;
        if (best.some((b) => Math.hypot(x - b.x, y - b.y) < b.r + r)) continue; bv = G[i]; bi = i; }
      if (bi < 0) break; const r = Math.sqrt(G[bi]) * RES - RES / 2 - CM;   // half a cell for the raster, then the margin
      best.push({ x: +(bx0 + (bi % nx)*RES).toFixed(2), y: +(by0 + Math.floor(bi / nx)*RES).toFixed(2), r: +r.toFixed(2) }); }
    // for each disc: what bounds it (the units within 1 u of its rim, in the band) and whether plate metal stands over it
    for (const b of best) { const near = {}; let over = 0, overZ = Infinity;
      for (const d of data) { if (d.drum && !withDrum) continue;
        for (const m of d.meshes) for (let i = 0; i < m.v.length; i += 3) { const x = m.v[i], y = m.v[i+1], z = m.v[i+2], r = Math.hypot(x - b.x, y - b.y);
          if (z >= z0 && z <= z1 && r <= b.r + CM + 1) near[d.name] = Math.min(near[d.name] ?? Infinity, +(r - b.r).toFixed(2));
        }
        // plate cover by FACES, not vertices (a slab's big triangles have no vertex near the centre): any three-quarter
        // plate triangle above the band whose plan contains the disc's centre
        if (/three-quarter plate/i.test(d.name)) for (const m of d.meshes) { const v = m.v, n = m.idx ? m.idx.length : v.length / 3;
          for (let t = 0; t + 2 < n; t += 3) { const ia = m.idx ? m.idx[t] : t, ib = m.idx ? m.idx[t+1] : t+1, ic = m.idx ? m.idx[t+2] : t+2;
            const zmin = Math.min(v[3*ia+2], v[3*ib+2], v[3*ic+2]); if (zmin <= z1) continue;
            const ax = v[3*ia], ay = v[3*ia+1], bx = v[3*ib], by = v[3*ib+1], cx = v[3*ic], cy = v[3*ic+1];
            const den = (by-cy)*(ax-cx) + (cx-bx)*(ay-cy); if (Math.abs(den) < 1e-12) continue;
            const l1 = ((by-cy)*(b.x-cx) + (cx-bx)*(b.y-cy)) / den, l2 = ((cy-ay)*(b.x-cx) + (ax-cx)*(b.y-cy)) / den;
            if (l1 >= 0 && l2 >= 0 && l1 + l2 <= 1) { over++; if (zmin < overZ) overZ = zmin; } } } }
      b.boundedBy = Object.entries(near).sort((p, q) => p[1] - q[1]).slice(0, 5); b.plateOver = over ? +overZ.toFixed(3) : null; }
    return { discs: best, bandTriangles: byUnit };
  };
  const free = { region: form ? { kind: region.kind, vertices: region.poly.length } : region, zBand: [z0, z1], res: RES,
    withDrumA: field(true), withoutDrumGroup: field(false) };
  for (const k of ['withDrumA', 'withoutDrumGroup']) { const b = free[k].bandTriangles; free[k].bandUnits = Object.entries(b).sort((p, q) => q[1] - p[1]).slice(0, 12); delete free[k].bandTriangles; }
  // (d) depth, at rest
  const inDisc = (x, y) => Math.hypot(x - D.x, y - D.y) <= D.reachR;
  let above = Infinity, aboveBy = null, below = -Infinity, belowBy = null;
  const top = {};
  for (const d of data) { if (d.drum) continue; let tmax = -Infinity;
    for (const m of d.meshes) for (let i = 0; i < m.v.length; i += 3) { const x = m.v[i], y = m.v[i+1], z = m.v[i+2];
      if (inDisc(x, y)) { if (z >= dz1 && z < above) { above = z; aboveBy = d.name + '/' + m.name; } if (z <= dz0 && z > below) { below = z; belowBy = d.name + '/' + m.name; } }
      if (z <= dz1 + 2*CM && z > tmax) tmax = z; }
    if (tmax >= dz1 - 2*CM) top[d.name] = +tmax.toFixed(3); }
  const depth = { drumZ: [dz0, dz1], nextAboveInDisc: [above, aboveBy], nextBelowInDisc: [below, belowBy], gapAbove: above - dz1, gapBelow: dz0 - below,
    otherUnitsAtDrumCeiling: top };
  // (e) packing
  const a = ms.ribbonR, e = 2 * a, rCollar = ms.innerR - a, R = ms.outerR;
  const packing = { thicknessU: e, collarR: rCollar, innerCentreR: ms.innerR, springOuterR: R, devLen: ms.devLen, coils: ms.coils, heightU: ms.height,
    alphaCollar: rCollar / e, alphaInnerCoil: ms.innerR / e, rOverR: rCollar / R, fill: (e * ms.devLen) / (Math.PI * (R * R - rCollar * rCollar)),
    windRad: { free: ms.sweepFree, setup: ms.setupSweep, full: ms.sweepFull } };
  return { form: form ? { kind: c.form?.kind ?? null, rect: c.formFootprint?.rect ?? null } : null, reach, free, depth, packing };
})()`;

// (c) the chain over the reserve: its own expression, posing first
const CHAIN_EXPR = `(async () => {
  const c = window.__clock, D = c.drum, out = [];
  const chain = c.labelEntries.find((e) => e.name === 'Chain').obj;
  const drumR = D.reachR;   // the coil's outermost metal
  for (const t of [1, 0.75, 0.5, 0.25, 0]) {
    c.setPose({ tension: t }); c.render();
    chain.updateWorldMatrix(true, true);
    let cz0 = Infinity, cz1 = -Infinity, sz0 = Infinity, sz1 = -Infinity;
    chain.traverse((o) => { if (!o.isMesh) return; const p = o.geometry.attributes.position, e = o.matrixWorld.elements;
      for (let i = 0; i < p.count; i++) { const x = p.getX(i), y = p.getY(i), z = p.getZ(i);
        const wx = e[0]*x+e[4]*y+e[8]*z+e[12], wy = e[1]*x+e[5]*y+e[9]*z+e[13], wz = e[2]*x+e[6]*y+e[10]*z+e[14];
        if (Math.hypot(wx - D.x, wy - D.y) <= drumR + 1e-6) { if (wz < cz0) cz0 = wz; if (wz > cz1) cz1 = wz; }
        else if (Math.hypot(wx - D.x, wy - D.y) <= drumR + 4) { if (wz < sz0) sz0 = wz; if (wz > sz1) sz1 = wz; } } });
    out.push({ tension: t, coilZ: [cz0, cz1], spanNearDrumZ: [sz0, sz1] });
  }
  c.resetInputs?.();
  return out;
})()`;

const args = process.argv.slice(2);
let jsonOut = null;
const qs = [];
for (let i = 0; i < args.length; i++) { if (args[i] === '--json') jsonOut = args[++i]; else qs.push(args[i]); }
const specs = qs.length ? qs : DEFAULT_SPECS;
const t0 = Date.now();
const results = await bootMany(specs, `(async () => ({ room: ${EXPR}, chain: await ${CHAIN_EXPR} }))()`);
const f = (x, d = 2) => (x === null || x === undefined || !Number.isFinite(x) ? String(x) : x.toFixed(d));
const all = [];
for (let k = 0; k < specs.length; k++) {
  const q = specs[k], r = results[k];
  console.log(`\n=== ${q || '(round default)'}`);
  if (r.unknownKeys?.length) { console.log(`  REFUSED: unknown query key(s) ${r.unknownKeys.join(', ')} — not the spec asked for`); continue; }
  if (r.bootError) { console.log(`  BOOT ERROR ${r.bootError}`); continue; }
  console.log(`  boot warnings: ${r.warnings.length}${r.warnings.length ? ' — ' + r.warnings.map((w) => w.slice(0, 120)).join(' | ') : ''}`);
  const { room, chain } = r.extra; all.push({ spec: q, warnings: r.warnings, ...r.extra });
  const R = room.reach;
  console.log(`  (a) drum at (${f(R.drumCentre[0])}, ${f(R.drumCentre[1])}), dist ${f(R.drumDist)}, coil reach r ${f(R.drumReachR)}; plateR ${f(R.plateR)}`);
  if (!room.form) console.log(`      round: drum's farthest metal ${f(R.drumGroup.r)} (bound plateR − CLEAR_MARGIN = ${f(R.plateR - 0.15)}), the rest's farthest ${f(R.restFarthestR)} (${R.rest.farthestBy})`);
  else console.log(`      form ${room.form.kind} rect ${JSON.stringify(room.form.rect)}; drum-group excursion past the rest: ${Object.entries(R.excursion).map(([s, v]) => `${s} ${f(v)} (rest set by ${R.rest.sideBy[s]})`).join(', ')}`);
  for (const k of ['withDrumA', 'withoutDrumGroup']) {
    const F = room.free[k];
    console.log(`  (b) free discs ${k === 'withDrumA' ? 'beside today\'s drum' : 'with the drum group removed'} (${room.free.region.kind ?? 'region'}, z ${f(room.free.zBand[0])}–${f(room.free.zBand[1])}): ${F.discs.map((d) => `r ${f(d.r)} at (${f(d.x)}, ${f(d.y)})`).join('; ')}`);
    for (const d of F.discs) console.log(`      r ${f(d.r)}: plate over its centre ${d.plateOver === null ? 'NONE (no arbor bearing above)' : 'at z ' + d.plateOver}; bounded by ${d.boundedBy.map(([u, g]) => `${u} ${g}`).join(', ')}`);
    console.log(`      band occupants: ${F.bandUnits.map(([u, n]) => `${u} ${n}`).join(', ')}`);
  }
  for (const c of chain) console.log(`  (c) tension ${c.tension}: chain coil z ${f(c.coilZ[0], 3)}–${f(c.coilZ[1], 3)}, span near drum z ${f(c.spanNearDrumZ[0], 3)}–${f(c.spanNearDrumZ[1], 3)}`);
  const Dp = room.depth;
  console.log(`  (d) drum z ${f(Dp.drumZ[0], 3)}–${f(Dp.drumZ[1], 3)}; next above in its disc ${f(Dp.nextAboveInDisc[0], 3)} (${Dp.nextAboveInDisc[1]}), gap ${f(Dp.gapAbove, 3)}; below ${f(Dp.nextBelowInDisc[0], 3)} (${Dp.nextBelowInDisc[1]})`);
  console.log(`      other units whose top reaches within 2·CLEAR_MARGIN of the drum's top: ${Object.entries(Dp.otherUnitsAtDrumCeiling).map(([u, z]) => `${u} ${z}`).join(', ') || 'none'}`);
  const P = room.packing;
  console.log(`  (e) strip e ${f(P.thicknessU, 3)} u, collar r ${f(P.collarR, 3)}, spring outer R ${f(P.springOuterR, 3)}, L ${f(P.devLen, 1)}, ${P.coils} coils: α = r/e ${f(P.alphaCollar)} (at the coil's centreline ${f(P.alphaInnerCoil)}), r/R ${f(P.rOverR, 3)}, fill ${f(P.fill, 3)}`);
  if (!room.form) {
    const ok = R.drumFarthest <= R.plateR - 0.15 + 1e-9 && R.plateR - 0.15 - R.drumFarthest < 0.02;
    console.log(`  CONTROL (TODO 207's bound read back): |drum centre| + coil reach = ${f(R.drumFarthest, 4)} ${ok ? 'IS' : 'IS NOT'} within 0.02 under plateR − CLEAR_MARGIN ${f(R.plateR - 0.15, 4)} (the literal 10.71 is the bound rounded down; the metal's vertices read ${f(R.drumGroup.r, 4)})`);
  }
}
if (jsonOut) writeFileSync(jsonOut, JSON.stringify(all, null, 1));
console.log(`\n${specs.length} boot(s), ${((Date.now() - t0) / 1000).toFixed(0)} s`);
