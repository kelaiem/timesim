// WHERE CAN A FORM CASE'S LEDGE BEAR? A REPORT (TODO 300 step 3: the casing-clamp hold designed in a line before any
// metal; it judges nothing).
//
//   node tools/probe-300-ledge-band.mjs [--depth U] ['<query>' …]      (no queries: the default form builds below)
//
// TODO 300's chosen hold (the owner's, 2026-11-10) is the casing-clamp one most form cases use: the case middle's bore
// fits the base plate's own cut outline, the plate rests on a LEDGE of case metal in front of it (dial side), and
// screws in the band press dogs onto the plate's back face. §186 left exactly that kind of seat on the round case (an
// interrupted step at plateR − 1 mm, "six lands among the dial-side works") for an outboard rim, because the plate's
// dial-side face near its edge is crowded. So the first question is the one §186's probe-ledge-occupancy.mjs asked of
// the annulus OUTSIDE the plate, asked of the band INSIDE it: over the pose net, what metal stands within --depth of
// the plate's cut outline, in the z band between the plate's dial face and the dial (and the dial itself), and where
// along the outline. A ledge can bear only on the stretches nothing occupies; how deep each occupant reaches says how
// wide a ledge each stretch allows.
//
// The outline is the base plate's own cut shape (its extrude's `parameters.shapes`, the outer ring), carried to world
// coordinates; a point is IN the band when it is inside that polygon and within --depth of its boundary, and between
// z0 = the dial's front face and z1 = the plate's dial face (both measured off their metal). Stations along the
// outline are 120 bins by arc length. Every labelled mesh is scanned by its EDGES (probe-ledge-occupancy's lesson: a
// body can cross a band carrying no vertex inside it), each edge subdivided at a fifth of the band depth, over the
// rest pose and every axis at f ∈ {0, 0.5, 1}. The case is skipped (it is the ledge's own metal), and so is the base
// plate (it is what the ledge carries). CONTROL: the dial is cut to the same outline, so on a form build it MUST occupy
// every station; a scan that finds it nowhere has measured nothing.
import { bootMany } from './boot-pool.mjs';

const args = process.argv.slice(2);
const take = (f) => { const i = args.indexOf(f); if (i < 0) return null; const v = args[i + 1]; args.splice(i, 2); return v; };
const DEPTH = Number(take('--depth') ?? 3);   // movement units: the widest ledge worth asking about (~1.1 mm)
const QUERIES = args.length ? args : ['case=fitted', 'alarm=0&case=fitted', 'case=rect', 'alarm=0&case=rect'];
const NB = 120;
const EXPR = `(async () => {
  const I = await import('./src/inspect.js'), THREE = await import('three'), clock = window.__clock;
  const DEPTH = ${DEPTH}, NB = ${NB};
  let plate = null, dial = null; clock.scene.traverse((o) => { if (o.isMesh && o.name === 'backPlate' && !plate) plate = o; });
  const dialUnit = clock.labelEntries.find((e) => e.name === 'Dial')?.obj;
  plate.updateWorldMatrix(true, true);
  const shape = plate.geometry.parameters?.shapes;
  const sh = Array.isArray(shape) ? shape[0] : shape;
  if (!sh) return { error: 'the base plate carries no readable shape' };
  const v = new THREE.Vector3();
  const ring = sh.getPoints(4).map((p) => { plate.localToWorld(v.set(p.x, p.y, 0)); return [v.x, v.y]; });
  // the plate's dial face: the lowest z of its metal (the dial side is -z, probe-ledge-occupancy's zFront)
  let zFace = Infinity; { const p = plate.geometry.attributes.position; for (let i = 0; i < p.count; i++) { plate.localToWorld(v.fromBufferAttribute(p, i)); zFace = Math.min(zFace, v.z); } }
  let zDial = Infinity; if (dialUnit) dialUnit.traverse((o) => { if (!o.isMesh) return; o.updateWorldMatrix(true, false); const p = o.geometry.attributes.position; for (let i = 0; i < p.count; i++) { o.localToWorld(v.fromBufferAttribute(p, i)); zDial = Math.min(zDial, v.z); } });
  const z0 = zDial, z1 = zFace;
  // arc-length stations of the ring
  const segs = [], cum = [0];
  for (let i = 0; i < ring.length; i++) { const a = ring[i], b = ring[(i + 1) % ring.length]; segs.push([a, b]); cum.push(cum[i] + Math.hypot(b[0] - a[0], b[1] - a[1])); }
  const per = cum[cum.length - 1];
  const inside = (x, y) => { let c = false; for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) { const [xi, yi] = ring[i], [xj, yj] = ring[j]; if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) c = !c; } return c; };
  const nearest = (x, y) => { let best = Infinity, s = 0; for (let i = 0; i < segs.length; i++) { const [a, b] = segs[i], dx = b[0] - a[0], dy = b[1] - a[1], L2 = dx * dx + dy * dy; const t = L2 ? Math.max(0, Math.min(1, ((x - a[0]) * dx + (y - a[1]) * dy) / L2)) : 0; const d = Math.hypot(x - a[0] - t * dx, y - a[1] - t * dy); if (d < best) { best = d; s = cum[i] + t * Math.sqrt(L2); } } return { d: best, s }; };
  const occ = new Map();   // unit -> { bins: Map(bin -> minDepth), zMin, zMax }
  const takeP = (x, y, z, name) => {
    if (z < z0 - 1e-9 || z > z1 + 1e-9 || !inside(x, y)) return;
    const { d, s } = nearest(x, y); if (d > DEPTH) return;
    const bin = Math.min(NB - 1, Math.floor((s / per) * NB));
    const u = occ.get(name) || { bins: new Map(), zMin: Infinity, zMax: -Infinity };
    u.bins.set(bin, Math.min(u.bins.get(bin) ?? Infinity, d)); u.zMin = Math.min(u.zMin, z); u.zMax = Math.max(u.zMax, z);
    occ.set(name, u);
  };
  const poses = [() => {}]; for (const ax of I.AXES) for (const f of [0, 0.5, 1]) poses.push(() => { I.enterAxis(clock); clock.setPose(ax.pose(f, clock)); });
  const a = new THREE.Vector3(), b = new THREE.Vector3(), step = DEPTH / 5;
  for (const enter of poses) {
    enter(); clock.scene.updateMatrixWorld(true);
    for (const e of clock.labelEntries) {
      if (e.name === 'Case') continue;
      e.obj.traverse((o) => {
        if (!o.isMesh || o.userData.schematic || o === plate || !o.geometry?.attributes?.position) return;
        const pos = o.geometry.attributes.position, idx = o.geometry.index, n = idx ? idx.count : pos.count;
        for (let t = 0; t < n; t += 3) for (let k = 0; k < 3; k++) {
          const i0 = idx ? idx.getX(t + k) : t + k, i1 = idx ? idx.getX(t + (k + 1) % 3) : t + (k + 1) % 3;
          o.localToWorld(a.fromBufferAttribute(pos, i0)); o.localToWorld(b.fromBufferAttribute(pos, i1));
          if ((a.z < z0 && b.z < z0) || (a.z > z1 && b.z > z1)) continue;
          const L = a.distanceTo(b), m = Math.max(1, Math.ceil(L / step));
          for (let j = 0; j <= m; j++) { const s = j / m; takeP(a.x + (b.x - a.x) * s, a.y + (b.y - a.y) * s, a.z + (b.z - a.z) * s, e.name); }
        }
      });
    }
  }
  const units = [...occ.entries()].map(([name, u]) => ({ name, stations: u.bins.size, minDepth: Math.min(...u.bins.values()), zMin: u.zMin, zMax: u.zMax,
    bins: [...u.bins.entries()].sort((p, q) => p[0] - q[0]) })).sort((p, q) => q.stations - p.stations);
  return { per, z0, z1, poses: poses.length, units };
})()`;
const rs = await bootMany(QUERIES, EXPR);
const f = (x, d = 2) => (+x).toFixed(d);
let controlOk = true;
for (const r of rs) {
  console.log(`\n== ${r.query || '(default)'}`);
  if (r.bootError || !r.extra || r.extra.error) { console.log(`   FAILED: ${r.bootError ?? r.extra?.error ?? 'no reading'}`); controlOk = false; continue; }
  const { per, z0, z1, poses, units } = r.extra;
  console.log(`   outline ${f(per, 1)} u round; band ${DEPTH} u deep, z ${f(z0)}..${f(z1)} (dial front to plate's dial face); ${poses} poses`);
  const dial = units.find((u) => u.name === 'Dial');
  console.log(`   CONTROL: the Dial occupies ${dial ? dial.stations : 0} of ${NB} stations ${dial && dial.stations === NB ? '(PASS)' : '(FAIL: the scan is not reading the dial cut to this outline)'}`);
  if (!dial || dial.stations !== NB) controlOk = false;
  // what a ledge competes with: everything but the dial (which a ledge in front of the plate meets by construction
  // and is placed against separately), per unit: the stations it holds and the shallowest depth it reaches inward
  const others = units.filter((u) => u.name !== 'Dial');
  const taken = new Map();
  for (const u of others) for (const [b, d] of u.bins) taken.set(b, Math.min(taken.get(b) ?? Infinity, d));
  for (const u of others) console.log(`   ${u.name.padEnd(28)} ${String(u.stations).padStart(3)} stations, from ${f(u.minDepth)} u inside the outline, z ${f(u.zMin)}..${f(u.zMax)}`);
  // free stretches for a ledge of a given width w: a station is free when nothing stands within w of the outline
  for (const w of [0.5, 1, 1.5, 2, 3].filter((x) => x <= DEPTH)) {
    const free = [...Array(NB).keys()].filter((b) => !(taken.get(b) <= w));
    console.log(`   a ledge ${f(w, 1)} u wide (${f(w * 0.3789, 2)} mm): ${free.length} of ${NB} stations free (${f((free.length / NB) * 100, 0)}% of the outline)`);
  }
}
console.log(`\ncontrol ${controlOk ? 'PASS' : 'FAIL'}`);
process.exit(0);
