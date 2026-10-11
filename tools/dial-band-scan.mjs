// THE DIAL-SIDE BAND'S TENANTS, OVER THE POSE NET — the scan itself, as a
// function a page can run, shared by its two callers: probe-261-dial-band.mjs
// (the free-volume map, §261 step 2) and probe-261-fold-site.mjs (where the
// alarm switch can stand under the dial, §261 step 4). One copy, because two
// copies of a measuring method drift the way two copies of a law do.
//
// Not an instrument on its own: it is page code. Pass it to page.evaluate:
//     await page.evaluate(dialBandScan, { GRID, exclude: ['Alarm switch'] })
// It must stay SELF-CONTAINED (Playwright serializes it), so it imports what
// it needs inside and reads nothing from this module's scope.
//
//   GRID     { DR, DAZ_DEG } — the polar cell pitch
//   exclude  unit names whose meshes are NOT tenants (a fold's own members,
//            which the caller is about to move) — empty for the plain map
//
// Every cell also carries `ivs`, its union of occupied z intervals, and
// `uivs`, the same per owning unit ([unit, intervals] pairs), for a caller
// that tests a body against the band rather than reading its gaps.
// The method, the walls, the pose net and controls C2/C5/C6's raw readings are
// documented in probe-261-dial-band.mjs's header, which owns them.
//
// KNOWN VARIANCE, measured when the scan was lifted here (§261 step 4): the
// eased members (the keyless lane, the minute jumper) stand wherever the live
// loop's eases had got to when the scan began — setPose ticks with zero dt and
// cannot move an ease — so their placement keys, and the extra placements they
// buy, vary with boot timing: 1876 against 1882 placements and 357998–358086
// rays over four runs of one tree, every difference in those units, at most
// one point of one cell in the occupancy table. A REPORT may carry that; a
// gate built on this scan would have to settle the eases first.
export async function dialBandScan({ GRID, exclude = [] }) {
  const THREE = await import('three');
  const I = await import('./src/inspect.js');
  const clock = window.__clock;
  const DS = THREE.DoubleSide;
  const NEAR = -60, FAR = 60;                       // in front of the crystal, behind the case back

  // ---- populations -------------------------------------------------------
  // mesh → unit, NEAREST labelled ancestor (§40's hops rule). Labels nest —
  // the whole dial-side alarm works hang inside 'Dial' — so the first label to
  // traverse a mesh is not its owner: the selector ring read as 'Dial', and an
  // exclusion by unit name would have left a moved unit's nested parts in the
  // band as obstacles and a staying unit's parts out of it.
  const labelOf = new Map();
  for (const e of clock.labelEntries) if (!labelOf.has(e.obj)) labelOf.set(e.obj, e.name);
  const owner = new Map();
  clock.scene.traverse((o) => {
    if (!o.isMesh) return;
    for (let p = o; p; p = p.parent) if (labelOf.has(p)) { owner.set(o, labelOf.get(p)); break; }
  });
  const plateMeshes = I.heldFixtureEntries(clock).find((h) => h.name === 'Base plate')?.meshes ?? [];
  const dialMeshes = [];
  clock.scene.traverse((o) => { if (o.isMesh && o.name === 'dialPlate' && !o.userData.schematic) dialMeshes.push(o); });
  const walls = new Set([...plateMeshes, ...dialMeshes]);
  const caseRoot = clock.scene.getObjectByName('case');
  const inCase = (o) => { for (let p = o; p; p = p.parent) if (p === caseRoot) return true; return false; };
  const tenantsAll = [];
  const excluded = new Set(exclude);
  let excludedMeshes = 0;
  clock.scene.traverse((o) => {
    if (!o.isMesh || o.userData.schematic || walls.has(o) || !o.geometry?.attributes?.position) return;
    if (!o.visible && !owner.has(o) && !inCase(o)) return;
    if (excluded.has(owner.get(o))) { excludedMeshes++; return; }
    tenantsAll.push(o);
  });
  const unitOf = (o) => owner.get(o) ?? (inCase(o) ? `case:${o.name || '?'}` : `(unlabelled) ${o.name || o.geometry.type}`);

  // ---- the band, nominally: the walls' own faces at the reference pose --------
  clock.resetInputs(); clock.setPose({}); clock.scene.updateMatrixWorld(true);
  const box = new THREE.Box3();
  const bbOf = (list) => { const b = new THREE.Box3(); for (const m of list) b.union(box.setFromObject(m, true)); return b; };
  const plateBox = bbOf(plateMeshes), dialBox = bbOf(dialMeshes);
  const Z_FLOOR = dialBox.max.z, Z_CEIL = plateBox.min.z;      // dial back (most +z of the dial plate) and plate's dial face
  // The plate is a disc, so its box's half-width IS its radius (the box's
  // corner is not: hypot of the two half-widths reads √2 × plateR, and the
  // first run scanned the case band out to r 70.8 for it). The case's inner
  // wall stands one mm outboard of this, so nothing past it is the band's.
  const R_MAX = Math.max(-plateBox.min.x, plateBox.max.x, -plateBox.min.y, plateBox.max.y);

  // ---- grid --------------------------------------------------------------
  const NR = Math.ceil(R_MAX / GRID.DR), NA = Math.round(360 / GRID.DAZ_DEG);
  const N = NR * NA;
  const cx = new Float64Array(N), cy = new Float64Array(N), cr = new Float64Array(N), caz = new Float64Array(N);
  for (let ri = 0; ri < NR; ri++) for (let ai = 0; ai < NA; ai++) {
    const k = ri * NA + ai, r = (ri + 0.5) * GRID.DR, a = (ai + 0.5) * GRID.DAZ_DEG * Math.PI / 180;
    cx[k] = r * Math.cos(a); cy[k] = r * Math.sin(a); cr[k] = r; caz[k] = (ai + 0.5) * GRID.DAZ_DEG;
  }

  // ---- one mesh, one set of cells: solid z intervals along each ray ------
  const ray = new THREE.Raycaster(); ray.near = 0; ray.far = FAR - NEAR;
  const org = new THREE.Vector3(), up = new THREE.Vector3(0, 0, 1), down = new THREE.Vector3(0, 0, -1);
  const bvhVer = new Map();
  function prepare(mesh) {
    const g = mesh.geometry, ver = g.attributes.position.version;
    if (!g.boundsTree || bvhVer.get(g) !== ver) { g.computeBoundsTree(); bvhVer.set(g, ver); }
  }
  function withDoubleSide(mesh, fn) {
    const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
    const saved = mats.map((m) => m.side);
    for (const m of mats) m.side = DS;
    try { return fn(); } finally { mats.forEach((m, i) => { m.side = saved[i]; }); }
  }
  let openIncidences = 0;
  const openByUnit = {};
  // Returns [[z0,z1],…] for this mesh on the ray through (x, y), cast in `dir`.
  function intervals(mesh, x, y, dir = up) {
    org.set(x, y, dir === up ? NEAR : FAR);
    ray.set(org, dir);
    const hits = [];
    mesh.raycast(ray, hits);
    if (!hits.length) return [];
    const zs = hits.map((h) => h.point.z).sort((a, b) => a - b);
    const u = [];
    for (const z of zs) if (!u.length || z - u[u.length - 1] > 1e-6) u.push(z);  // a ray through a shared edge hits both triangles
    if (u.length % 2) {
      openIncidences++;
      const n = unitOf(mesh); openByUnit[n] = (openByUnit[n] || 0) + 1;
      return [[u[0], u[u.length - 1]]];
    }
    const out = [];
    for (let i = 0; i < u.length; i += 2) out.push([u[i], u[i + 1]]);
    return out;
  }
  function cellsUnder(b) {
    const out = [];
    const rMin = 0, rMax = Math.hypot(Math.max(Math.abs(b.min.x), Math.abs(b.max.x)), Math.max(Math.abs(b.min.y), Math.abs(b.max.y)));
    const ri1 = Math.min(NR - 1, Math.floor(rMax / GRID.DR));
    for (let ri = Math.floor(rMin / GRID.DR); ri <= ri1; ri++) for (let ai = 0; ai < NA; ai++) {
      const k = ri * NA + ai;
      if (cx[k] >= b.min.x && cx[k] <= b.max.x && cy[k] >= b.min.y && cy[k] <= b.max.y) out.push(k);
    }
    return out;
  }

  // ---- walls, per cell (fixtures: one cast) -------------------------------
  const floorZ = new Float64Array(N).fill(NaN), ceilZ = new Float64Array(N).fill(NaN);
  const mid = (Z_FLOOR + Z_CEIL) / 2;
  for (const m of dialMeshes) { prepare(m); withDoubleSide(m, () => {
    for (const k of cellsUnder(box.setFromObject(m, true))) for (const [, z1] of intervals(m, cx[k], cy[k]))
      if (z1 < mid && !(z1 <= floorZ[k])) floorZ[k] = z1;            // the dial's metal nearest the band
  }); }
  for (const m of plateMeshes) { prepare(m); withDoubleSide(m, () => {
    for (const k of cellsUnder(box.setFromObject(m, true))) for (const [z0] of intervals(m, cx[k], cy[k]))
      if (z0 > mid && !(z0 >= ceilZ[k])) ceilZ[k] = z0;               // the plate's metal nearest the band
  }); }
  const lo = (k) => (Number.isNaN(floorZ[k]) ? Z_FLOOR : floorZ[k]);
  const hi = (k) => (Number.isNaN(ceilZ[k]) ? Z_CEIL : ceilZ[k]);

  // ---- tenants over the pose net ------------------------------------------
  // Two passes per mesh, unioned. RAYS give a solid's interior at each cell
  // centre. SURFACE SAMPLES give every triangle's z-span over each cell it
  // crosses, sampled at STEP along the triangle — which is what catches a
  // member thinner than the cell pitch (a dial foot, a screw, a pin), since a
  // ray at the cell's centre can pass beside it (instruments skill: vertices
  // are not the surface, and neither is one ray). The samples are ON the
  // surface, so they add no metal that is not there; a flat face adds a
  // zero-length span and the ray carries its interior.
  // occ[k] = list of {z0, z1, unit, pose}, clipped to the cell's band.
  const STEP = 0.2;
  const occ = Array.from({ length: N }, () => []);
  const refOcc = Array.from({ length: N }, () => []);
  const surfOnly = {};                                // unit → cells the surface pass reached that rays did not
  const B0 = Z_FLOOR - 1, B1 = Z_CEIL + 1;          // a mesh whose box misses the band by a unit cannot occupy it
  const cellOf = (x, y) => {
    const r = Math.hypot(x, y); if (r >= NR * GRID.DR) return -1;
    let a = Math.atan2(y, x) * 180 / Math.PI; if (a < 0) a += 360;
    return Math.min(NR - 1, Math.floor(r / GRID.DR)) * NA + Math.min(NA - 1, Math.floor(a / GRID.DAZ_DEG));
  };
  const wv = new THREE.Vector3();
  function surfaceSpans(m) {                          // Map k → [zmin, zmax] over this mesh's triangles
    const g = m.geometry, pos = g.attributes.position, idx = g.index;
    const n = pos.count, W = new Float64Array(n * 3);
    for (let i = 0; i < n; i++) { wv.fromBufferAttribute(pos, i).applyMatrix4(m.matrixWorld); W[3 * i] = wv.x; W[3 * i + 1] = wv.y; W[3 * i + 2] = wv.z; }
    const out = new Map();
    const T = idx ? idx.count / 3 : n / 3;
    for (let t = 0; t < T; t++) {
      const ia = idx ? idx.getX(3 * t) : 3 * t, ib = idx ? idx.getX(3 * t + 1) : 3 * t + 1, ic = idx ? idx.getX(3 * t + 2) : 3 * t + 2;
      const ax = W[3 * ia], ay = W[3 * ia + 1], az = W[3 * ia + 2], bx = W[3 * ib], by = W[3 * ib + 1], bz = W[3 * ib + 2], qx = W[3 * ic], qy = W[3 * ic + 1], qz = W[3 * ic + 2];
      if (Math.max(az, bz, qz) < Z_FLOOR - 1 || Math.min(az, bz, qz) > Z_CEIL + 1) continue;
      const L = Math.max(Math.hypot(bx - ax, by - ay, bz - az), Math.hypot(qx - ax, qy - ay, qz - az), Math.hypot(qx - bx, qy - by, qz - bz));
      const s = Math.max(1, Math.ceil(L / STEP));
      for (let i = 0; i <= s; i++) for (let j = 0; j <= s - i; j++) {
        const u = i / s, v = j / s;
        const x = ax + (bx - ax) * u + (qx - ax) * v, y = ay + (by - ay) * u + (qy - ay) * v, z = az + (bz - az) * u + (qz - az) * v;
        const k = cellOf(x, y); if (k < 0) continue;
        const e = out.get(k);
        if (!e) out.set(k, [z, z]); else { if (z < e[0]) e[0] = z; if (z > e[1]) e[1] = z; }
      }
    }
    return out;
  }
  // A mesh is re-scanned only when its placement or its shape changed since a
  // pose already scanned it: the union cannot gain from a repeat, and most of
  // the band is fixtures and slow movers.
  const seen = new Map();                             // mesh → Set of placement keys
  let raysCast = 0, meshScans = 0;
  const scanInto = (target, poseName, dedupe) => {
    clock.scene.updateMatrixWorld(true);
    for (const m of tenantsAll) {
      box.setFromObject(m);                          // cheap: the geometry's box, transformed
      if (box.isEmpty() || box.max.z < B0 || box.min.z > B1) continue;
      if (dedupe) {
        const key = m.matrixWorld.elements.map((e) => e.toFixed(9)).join(',') + '|' + m.geometry.attributes.position.version + '|' + m.geometry.uuid;
        let ks = seen.get(m); if (!ks) seen.set(m, ks = new Set());
        if (ks.has(key)) continue;
        ks.add(key);
      }
      meshScans++;
      const unit = unitOf(m);
      const hit = new Set();
      const cells = cellsUnder(box);
      if (cells.length) {
        prepare(m);
        withDoubleSide(m, () => {
          for (const k of cells) {
            raysCast++;
            for (const [z0, z1] of intervals(m, cx[k], cy[k])) {
              const a = Math.max(z0, lo(k)), b = Math.min(z1, hi(k));
              if (b - a > 1e-6) { target[k].push({ z0: a, z1: b, unit, pose: poseName }); hit.add(k); }
            }
          }
        });
      }
      for (const [k, [z0, z1]] of surfaceSpans(m)) {
        const a = Math.max(z0, lo(k)), b = Math.min(z1, hi(k));
        if (b - a > 1e-6) {
          target[k].push({ z0: a, z1: b, unit, pose: poseName });
          if (!hit.has(k) && target === occ) surfOnly[unit] = (surfOnly[unit] || 0) + 1;
        }
      }
    }
  };
  // The REFERENCE pose is resetInputs then setPose({}): reset alone moves the
  // inputs and not the metal (setPose is what ticks), so a scan after reset
  // alone reads whatever pose ran last. C2 caught exactly that on the first run.
  const atReset = () => { clock.resetInputs(); clock.setPose({}); };
  const poses = [{ name: 'reset', p: {} }, ...I.digestPoses(clock).map((p, i) => ({ name: `net#${i}`, p }))];
  for (const { name, p } of poses) {
    clock.resetInputs(); clock.setPose(p);
    scanInto(occ, name, true);
    if (name === 'reset') scanInto(refOcc, name, false);
  }
  atReset(); clock.scene.updateMatrixWorld(true);

  // ---- per cell: union, free depth, largest gap ---------------------------
  const union = (list) => {
    const s = list.map((o) => [o.z0, o.z1]).sort((a, b) => a[0] - b[0]);
    const u = [];
    for (const [a, b] of s) { if (u.length && a <= u[u.length - 1][1] + 1e-6) u[u.length - 1][1] = Math.max(u[u.length - 1][1], b); else u.push([a, b]); }
    return u;
  };
  const cell = new Array(N);
  for (let k = 0; k < N; k++) {
    const u = union(occ[k]), L = lo(k), H = hi(k);
    let filled = 0, gap = 0, gapAt = null, prev = L;
    for (const [a, b] of u) { filled += b - a; if (a - prev > gap) { gap = a - prev; gapAt = [prev, a]; } prev = b; }
    if (H - prev > gap) { gap = H - prev; gapAt = [prev, H]; }
    const units = {};
    for (const o of occ[k]) units[o.unit] = Math.max(units[o.unit] || 0, o.z1 - o.z0);
    const byUnit = {};                                // unit → its own intervals, unioned: who owns each piece of metal
    for (const o of occ[k]) (byUnit[o.unit] ||= []).push(o);
    const uivs = Object.entries(byUnit).map(([unit, list]) => [unit, union(list)]);
    cell[k] = { depth: H - L, filled, gap, gapAt, units, n: u.length, refFilled: union(refOcc[k]).reduce((s, [a, b]) => s + b - a, 0), ivs: u, uivs, lo: L, hi: H };
  }

  // ---- C2: the same cells cast from both faces ----------------------------
  // Every cell later called FREE at the fold's depth, plus every 37th occupied
  // cell, cast front-to-back and back-to-front at the reference pose, rays
  // only (C2 checks the CASTING — culling, pairing, open meshes — not the pose
  // net or the surface pass).
  const castCell = (k, dir) => {
    const list = [];
    for (const m of tenantsAll) {
      box.setFromObject(m);
      if (box.isEmpty() || box.max.z < B0 || box.min.z > B1) continue;
      if (cx[k] < box.min.x || cx[k] > box.max.x || cy[k] < box.min.y || cy[k] > box.max.y) continue;
      prepare(m);
      withDoubleSide(m, () => {
        for (const [z0, z1] of intervals(m, cx[k], cy[k], dir)) {
          const a = Math.max(z0, lo(k)), b = Math.min(z1, hi(k));
          if (b - a > 1e-6) list.push({ z0: a, z1: b });
        }
      });
    }
    return union(list);
  };

  // ---- C5 / C6: planted bodies in an empty cell ---------------------------
  // Chosen AFTER the scan: the emptiest cell at r ≈ 30 (deep inside the
  // annulus), so each plant tests the method where the verdict will be read.
  // C5 a block on the cell's ray: the RAYS must read its interval exactly, and
  //    nothing three units outboard.
  // C6 a pin of ⌀ 0.1 set half a cell off the ray, where no ray passes: the
  //    SURFACE pass must still give that cell its height. This is the dial
  //    feet's case, and the reason the surface pass exists.
  let plant = null;
  {
    let best = -1, kp = -1;
    for (let k = 0; k < N; k++) if (Math.abs(cr[k] - 30) < GRID.DR && cell[k].n === 0 && cell[k].depth > best) { best = cell[k].depth; kp = k; }
    if (kp >= 0) {
      const k = kp, L = lo(k), H = hi(k);
      const z0 = L + 0.25 * (H - L), z1 = L + 0.6 * (H - L);
      const g = new THREE.BoxGeometry(0.4, 0.4, z1 - z0);
      const m = new THREE.Mesh(g, new THREE.MeshBasicMaterial());
      m.position.set(cx[k], cy[k], (z0 + z1) / 2);
      clock.scene.add(m); m.updateMatrixWorld(true); prepare(m);
      const got = withDoubleSide(m, () => intervals(m, cx[k], cy[k]));
      const kFar = Math.min(NR - 1, Math.floor(cr[k] / GRID.DR) + 6) * NA + (k % NA);
      const miss = withDoubleSide(m, () => intervals(m, cx[kFar], cy[kFar]));
      clock.scene.remove(m); g.dispose();
      // the pin: radially a quarter cell outboard of the centre, tangentially
      // a quarter of the cell's arc round — inside the cell, off its ray
      const rP = cr[k] + GRID.DR / 4, aP = (caz[k] + GRID.DAZ_DEG / 4) * Math.PI / 180;
      const pg = new THREE.CylinderGeometry(0.05, 0.05, z1 - z0, 12).rotateX(Math.PI / 2);
      const pin = new THREE.Mesh(pg, new THREE.MeshBasicMaterial());
      pin.position.set(rP * Math.cos(aP), rP * Math.sin(aP), (z0 + z1) / 2);
      clock.scene.add(pin); pin.updateMatrixWorld(true); prepare(pin);
      const pinRay = withDoubleSide(pin, () => intervals(pin, cx[k], cy[k]));
      const pinSurf = surfaceSpans(pin).get(k) ?? null;
      clock.scene.remove(pin); pg.dispose();
      plant = { r: cr[k], az: caz[k], want: [z0, z1], got, missCount: miss.length, pinRayHits: pinRay.length, pinSurf };
    }
  }

  // ---- reductions for the report ------------------------------------------
  return {
    Z_FLOOR, Z_CEIL, R_MAX, NR, NA, poses: poses.length, exclude: [...excluded], excludedMeshes, raysCast, meshScans, surfOnly, openIncidences, openByUnit: { ...openByUnit },
    wallsFound: { floor: [...floorZ].filter((z) => !Number.isNaN(z)).length, ceil: [...ceilZ].filter((z) => !Number.isNaN(z)).length },
    plateCells: (() => { let n = 0; for (let k = 0; k < N; k++) if (cr[k] < Math.min(R_MAX, dialBox.max.x)) n++; return n; })(),
    tenantsCount: tenantsAll.length, wallNames: [...walls].map((m) => m.name),
    cells: cell.map((c, k) => ({ r: cr[k], az: caz[k], ...c })),
    c2: (() => {
      const pick = [];
      cell.forEach((c, k) => { if (c.gap >= 3.1 || (c.n > 0 && k % 37 === 0)) pick.push(k); });
      atReset(); clock.scene.updateMatrixWorld(true);
      let bad = 0, worst = 0, sample = null;
      for (const k of pick) {
        const back = castCell(k, down), fwd = castCell(k, up);
        const d = back.length !== fwd.length ? Infinity : Math.max(0, ...back.map((iv, i) => Math.max(Math.abs(iv[0] - fwd[i][0]), Math.abs(iv[1] - fwd[i][1]))));
        if (d > 1e-4) { bad++; if (!sample) sample = { r: cr[k], az: caz[k], fwd, back }; }
        if (d < Infinity) worst = Math.max(worst, d);
      }
      return { n: pick.length, bad, worst, sample };
    })(),
    plant,
  };
}
