// THE DIAL-SIDE BAND'S FREE VOLUME, OVER THE POSE NET — where, between the base
// plate's dial face and the dial's back, a folded action group could stand.
//
// REPORT with fatal controls (exit 2 when a control fails). §261 step 2. It
// replaces the entry's first map, a vertex-binned grid at the BUILD pose, with
// a surface scan at every pose of §152's digest net, and its verdict on the
// free annulus (r 24–40 by two-thirds of the circle, 2.6 mm deep) is what the
// fold is sited on — or not at all, by the entry's own refusal point (§112's
// rods were true at the rest pose and false over their travel).
//
// What it is NOT: `probe-interplate-demand.mjs` asks what pins the
// three-quarter plate's UNDERSIDE (the gap between the plates, z > 0); this
// asks what stands in the band on the OTHER side of the base plate (z < 0).
// Its raycast footprint and its control style are borrowed from there.
// `probe-261-height-ledger.mjs` measures the stack's faces, not this band's
// tenants; `probe-187-casing-path` is the case's question.
//
// METHOD. A polar grid of cells over the band (r 0..R_MAX, DR × DAZ), one ray
// per cell centre cast along +z from in front of the whole movement. Every
// mesh's hits are kept DOUBLE-SIDED and paired entry/exit into the solid
// intervals that ray crosses (instruments skill: a ray cast inside a solid,
// or culled by its face, measures nothing — this one starts outside
// everything and sees both faces). Rays are cast against one mesh at a time,
// only in the cells under that mesh's box, so a pose costs the meshes that are
// in the band, not the movement.
//
//  · THE GROUND IS NOT AN OBSTACLE. The two walls are cast separately: the
//    dial plate (mesh `dialPlate`) is the band's floor and the base plate (the
//    HELD fixture, mesh `backPlate`, TODO 187) its ceiling, PER CELL — so a
//    pocket cut into the plate's dial face (TODO 172) or a sub-dial well in the
//    dial deepens that cell's band, and neither wall is ever a tenant. The
//    dial's feet and every other Dial-unit mesh ARE tenants.
//  · THE POSE NET. `digestPoses()` (every axis at f ∈ {0, 0.5, 1} unioned with
//    the fingerprint's combined states), each entered by resetInputs+setPose,
//    the way unitDigests walks it. A cell's occupancy is the UNION over poses,
//    with the pose that first claimed each interval kept for the report.
//  · AN OPEN MESH reads as an odd number of crossings. Those (mesh, cell)
//    incidences are counted per unit and filled conservatively, first hit to
//    last — the error runs toward COUNTING metal, never toward a free cell.
//
// CONTROLS (fatal):
//  C1 a known tenant: the §29 centre chain fills the r < 2 cells (at least
//     half of the band's depth), owned by the Dial unit's tube chain.
//  C2 both faces: every cell the report calls FREE at the fold's depth, and a
//     sample of occupied ones, re-cast from BEHIND (−z from past the plate)
//     must read the same intervals to 1e-4.
//  C3 the pose net is applied: some cell is occupied at a net pose and free
//     at the reference pose (resetInputs + setPose({})), and the keyless works' swept lane at full pull is
//     among them (the crown axis at f = 1).
//  C4 walls found: the floor and ceiling read in at least 90 % of the plate's
//     cells, and no wall mesh appears in any tenant table.
//  C5 a planted block of known extent, set in the band at a cell nobody owns,
//     reads exactly its own z interval on that cell's ray, and nothing in a
//     cell three units away.
//  C6 a planted pin of ⌀ 0.1, set inside that cell but off its ray: the ray
//     must MISS it (or the control tests nothing) and the surface pass must
//     give the cell the pin's whole height.
//
// Run from tools/: node probe-261-dial-band.mjs   (ROOT= for another tree)
import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
const ROOT = process.env.ROOT || join(dirname(fileURLToPath(import.meta.url)), '..');
const PORT = 8594;
const srv = spawn('python3', ['-m', 'http.server', String(PORT), '--bind', '127.0.0.1'], { cwd: ROOT, stdio: 'ignore' });
process.on('exit', () => { try { srv.kill(); } catch {} });
await new Promise((r) => setTimeout(r, 1200));
const browser = await chromium.launch();
const page = await browser.newPage();
const warns = [];
page.on('console', (m) => { if (m.type() === 'warning' && !/WebGL|GPU stall|GroupMarker/.test(m.text())) warns.push(m.text()); });
page.on('pageerror', (e) => warns.push('PAGEERROR ' + String(e)));
await page.goto(`http://127.0.0.1:${PORT}/index.html`, { waitUntil: 'load', timeout: 300000 });
await page.waitForFunction(() => !!window.__clock || !!window.__bootError, null, { timeout: 300000 });
const bootError = await page.evaluate(() => (window.__bootError ? String(window.__bootError) : null));
if (bootError) { console.log('boot failed: ' + bootError); process.exit(2); }

// The grid. DR and DAZ put a cell at about 1 u of arc at r 24 (the annulus's
// inner edge) and 1.9 u at the plate's rim, finer than any member the fold
// would place (the column wheel's skirt is 0.617 u deep and ~6 u across).
const GRID = { DR: 0.5, DAZ_DEG: 2.5 };

const t0 = Date.now();
const res = await page.evaluate(async (GRID) => {
  const THREE = await import('three');
  const I = await import('./src/inspect.js');
  const clock = window.__clock;
  const DS = THREE.DoubleSide;
  const NEAR = -60, FAR = 60;                       // in front of the crystal, behind the case back

  // ---- populations -------------------------------------------------------
  const owner = new Map();                          // mesh → unit
  for (const e of clock.labelEntries) e.obj.traverse((o) => { if (o.isMesh && !owner.has(o)) owner.set(o, e.name); });
  const plateMeshes = I.heldFixtureEntries(clock).find((h) => h.name === 'Base plate')?.meshes ?? [];
  const dialMeshes = [];
  clock.scene.traverse((o) => { if (o.isMesh && o.name === 'dialPlate' && !o.userData.schematic) dialMeshes.push(o); });
  const walls = new Set([...plateMeshes, ...dialMeshes]);
  const caseRoot = clock.scene.getObjectByName('case');
  const inCase = (o) => { for (let p = o; p; p = p.parent) if (p === caseRoot) return true; return false; };
  const tenantsAll = [];
  clock.scene.traverse((o) => {
    if (!o.isMesh || o.userData.schematic || walls.has(o) || !o.geometry?.attributes?.position) return;
    if (!o.visible && !owner.has(o) && !inCase(o)) return;
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
    cell[k] = { depth: H - L, filled, gap, gapAt, units, n: u.length, refFilled: union(refOcc[k]).reduce((s, [a, b]) => s + b - a, 0) };
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
    Z_FLOOR, Z_CEIL, R_MAX, NR, NA, poses: poses.length, raysCast, meshScans, surfOnly, openIncidences, openByUnit: { ...openByUnit },
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
}, GRID);

// ---------------------------------------------------------------------------
const MM = 0.378947;            // u → mm, UNIT_MM (§39)
const CASE_R_IN = 44.16;        // plateR + 1 mm (§186), read off the stack table in §261; a REPORT boundary, not a gate
const f = (x, d = 3) => x.toFixed(d);
console.log(`band: dial back z ${f(res.Z_FLOOR, 4)} .. plate dial face z ${f(res.Z_CEIL, 4)} = ${f(res.Z_CEIL - res.Z_FLOOR)} u (${f((res.Z_CEIL - res.Z_FLOOR) * MM)} mm) nominal`);
console.log(`grid: ${res.NR} rings × ${res.NA} az = ${res.NR * res.NA} cells to r ${f(res.R_MAX, 2)}; ${res.poses} poses (reference + §152 digest net); ${res.tenantsCount} tenant meshes, ${res.meshScans} mesh placements scanned; ${res.raysCast} rays`);
console.log(`scan wall clock ${((Date.now() - t0) / 1000).toFixed(0)} s (after boot)`);
console.log(`walls read per cell: floor ${res.wallsFound.floor}, ceiling ${res.wallsFound.ceil} (of ${res.plateCells} inside the dial)`);
console.log(`surface pass reached cells no ray did (thin members), by unit: ${Object.entries(res.surfOnly).sort((a, b) => b[1] - a[1]).slice(0, 8).map(([u, n]) => `${u} ${n}`).join(', ') || 'none'}`);
console.log(`open-mesh incidences (odd crossings, filled first-to-last): ${res.openIncidences}${res.openIncidences ? ' — ' + Object.entries(res.openByUnit).sort((a, b) => b[1] - a[1]).slice(0, 6).map(([u, n]) => `${u} ${n}`).join(', ') : ''}`);

// The scratch map's own shape, re-measured: occupancy (union over the net, as a
// fraction of each cell's band) in 2 u × 15° bins, mean over the bin's cells.
const RB = 2, AB = 15;
const bins = new Map();
for (const c of res.cells) {
  if (c.depth <= 0) continue;
  const key = `${Math.floor(c.r / RB)}|${Math.floor(c.az / AB)}`;
  const b = bins.get(key) || { s: 0, n: 0, sb: 0 };
  b.s += c.filled / c.depth; b.sb += c.refFilled / c.depth; b.n++;
  bins.set(key, b);
}
console.log(`\nOCCUPANCY, pose-net union, % of band depth (rows r in ${RB} u, columns az in ${AB}°):`);
console.log('   r \\ az ' + Array.from({ length: 360 / AB }, (_, j) => String(j * AB).padStart(4)).join(''));
for (let ri = 0; ri * RB < res.R_MAX; ri++) {
  let line = `${String(ri * RB).padStart(4)}-${String((ri + 1) * RB).padEnd(4)}`;
  for (let ai = 0; ai < 360 / AB; ai++) {
    const b = bins.get(`${ri}|${ai}`);
    line += b ? String(Math.round(100 * b.s / b.n)).padStart(4) : '   .';
  }
  console.log(line);
}

// The verdict on the annulus: per 1-u ring, the az arcs whose cells all keep a
// contiguous free gap of at least NEED u, at three depths. 3.1 is the column
// wheel's whole stack (~2.8 u: skirt band 0.617 + castellations 0.617 + base
// 0.633 + driver band 0.90) plus two CLEAR_MARGINs, read off §261's own fold
// scope; it is a SCOPING depth, not a design.
const NEEDS = [1.0, 2.0, 3.1];
// Runs of az columns in which EVERY cell of the ring keeps a gap ≥ need, as
// [fromDeg, lengthDeg], longest first. Walked from a blocked column so a run
// that wraps through 0° is one run, not two.
function arcs(rLo, rHi, need) {
  const n = res.NA, step = 360 / n, ok = new Array(n).fill(true);
  let any = false;
  for (const c of res.cells) if (c.r >= rLo && c.r < rHi) { any = true; if (!(c.gap >= need)) ok[Math.floor(c.az / step)] = false; }
  if (!any) return [];
  const b0 = ok.indexOf(false);
  if (b0 < 0) return [[0, 360]];
  const out = [];
  let start = null;
  for (let i = 1; i <= n; i++) {
    const j = (b0 + i) % n;
    if (ok[j] && start === null) start = j;
    if ((!ok[j] || i === n) && start !== null) { out.push([start * step, ((j - start + n) % n || n) * step]); start = null; }
  }
  return out.sort((x, y) => y[1] - x[1]);
}
console.log(`\nFREE ARCS by ring — every cell in the arc keeps a contiguous free gap ≥ need (pose-net union):`);
for (let r = 18; r < Math.ceil(res.R_MAX); r += 2) {
  const row = NEEDS.map((need) => {
    const a = arcs(r, r + 2, need);
    const total = a.reduce((t, [, len]) => t + len, 0);
    return `≥${need}u: ${String(Math.round(total)).padStart(3)}° (longest ${a.length ? `${a[0][1]}° from ${a[0][0]}°` : '—'})`;
  });
  console.log(`  r ${String(r).padStart(2)}–${String(r + 2).padEnd(2)}  ${row.join('   ')}`);
}

// Who lives in the annulus, over the net: units by the number of cells they
// reach between r 24 and the case's inner wall (CASE_R_IN = plateR + 1 mm,
// 44.16 u; everything outboard of it reads as the case and is not the band's),
// with the deepest single interval they occupy there.
const annulus = new Map();
for (const c of res.cells) if (c.r >= 24 && c.r < CASE_R_IN) for (const [u, d] of Object.entries(c.units)) {
  const a = annulus.get(u) || { cells: 0, deep: 0 }; a.cells++; a.deep = Math.max(a.deep, d); annulus.set(u, a);
}
console.log(`\nTENANTS of r 24–${CASE_R_IN} over the net (cells reached, deepest interval):`);
for (const [u, a] of [...annulus].sort((x, y) => y[1].cells - x[1].cells).slice(0, 24))
  console.log(`  ${u.padEnd(40)} ${String(a.cells).padStart(5)} cells  ${f(a.deep)} u`);

// What the pose net added over the reference pose: cells occupied only away from it.
const added = res.cells.filter((c) => c.filled - c.refFilled > 0.05);
const addedBy = {};
for (const c of added) for (const u of Object.keys(c.units)) addedBy[u] = (addedBy[u] || 0) + 1;
console.log(`\nPOSE NET over REFERENCE POSE: ${added.length} cells gained > 0.05 u of occupancy away from it; units present there: ` +
  Object.entries(addedBy).sort((a, b) => b[1] - a[1]).slice(0, 10).map(([u, n]) => `${u} ${n}`).join(', '));

// ---- controls -------------------------------------------------------------
let ok = true;
const fail = (s) => { ok = false; console.log('CONTROL FAIL: ' + s); };
const pass = (s) => console.log('CONTROL PASS: ' + s);
console.log('');
// C1
{
  const core = res.cells.filter((c) => c.r < 2 && c.depth > 0);
  const frac = core.reduce((s, c) => s + c.filled / c.depth, 0) / Math.max(1, core.length);
  const owners = new Set(core.flatMap((c) => Object.keys(c.units)));
  if (frac < 0.5 || !owners.has('Dial')) fail(`C1 centre chain: r < 2 filled ${f(100 * frac, 1)} % of the band, owners [${[...owners].join(', ')}] — the §29 tube chain was not found where it stands`);
  else pass(`C1 the §29 centre chain fills ${f(100 * frac, 1)} % of the band at r < 2 (owners include Dial: ${[...owners].slice(0, 6).join(', ')})`);
}
// C2
if (res.c2.n === 0) fail('C2 nothing to re-cast — the sample is empty');
else if (res.c2.bad) fail(`C2 both faces: ${res.c2.bad}/${res.c2.n} cells read differently from behind; first r ${f(res.c2.sample.r, 2)} az ${res.c2.sample.az}: fwd ${JSON.stringify(res.c2.sample.fwd)} back ${JSON.stringify(res.c2.sample.back)}`);
else pass(`C2 ${res.c2.n} cells re-cast from behind read the same intervals (worst ${res.c2.worst.toExponential(1)})`);
// C3
{
  const keyless = Object.keys(addedBy).filter((u) => /[Kk]eyless|[Ss]etting lever|[Yy]oke|[Cc]lutch/.test(u));
  if (!added.length) fail('C3 the pose net added no occupancy over the reference pose — the poses were not applied');
  else if (!keyless.length) fail(`C3 the keyless works never swept a cell the reference pose left free (units that did: ${Object.keys(addedBy).slice(0, 8).join(', ')})`);
  else pass(`C3 the pose net is applied: ${added.length} cells gained occupancy away from the reference pose, the keyless lane among them (${keyless.join(', ')})`);
}
// C4
{
  const wallAsTenant = res.cells.some((c) => Object.keys(c.units).some((u) => u === 'Base plate'));
  const cov = Math.min(res.wallsFound.floor, res.wallsFound.ceil) / Math.max(1, res.plateCells);
  if (wallAsTenant) fail('C4 the base plate appears as a tenant — the ground got counted');
  else if (cov < 0.9) fail(`C4 walls read in only ${f(100 * cov, 1)} % of the dial's cells — the band's floor/ceiling were not measured`);
  else pass(`C4 walls read per cell (${f(100 * cov, 1)} % of the dial's cells), and neither wall is a tenant`);
}
// C5
if (!res.plant) fail('C5 no empty cell at r ≈ 30 to plant in — nothing to test the method against');
else {
  const [w0, w1] = res.plant.want, g = res.plant.got;
  const good = g.length === 1 && Math.abs(g[0][0] - w0) < 1e-4 && Math.abs(g[0][1] - w1) < 1e-4 && res.plant.missCount === 0;
  if (!good) fail(`C5 planted block at r ${f(res.plant.r, 2)} az ${res.plant.az}: want [${f(w0, 4)}, ${f(w1, 4)}], read ${JSON.stringify(g)}, must-miss hits ${res.plant.missCount}`);
  else pass(`C5 a planted block at r ${f(res.plant.r, 2)} az ${res.plant.az} reads its own interval [${f(w0, 4)}, ${f(w1, 4)}] to 1e-4, and nothing three units out`);
}
// C6
if (res.plant) {
  const [w0, w1] = res.plant.want, sp = res.plant.pinSurf;
  if (res.plant.pinRayHits) fail(`C6 the pin was meant to sit off the cell's ray and the ray hit it ${res.plant.pinRayHits}× — the control tests nothing`);
  else if (!sp || Math.abs(sp[0] - w0) > 1e-4 || Math.abs(sp[1] - w1) > 1e-4) fail(`C6 a ⌀ 0.1 pin off the ray: surface pass read ${JSON.stringify(sp)}, want [${f(w0, 4)}, ${f(w1, 4)}] — thin members slip between rays`);
  else pass(`C6 a ⌀ 0.1 pin set off the cell's ray is missed by the ray and read whole by the surface pass [${f(sp[0], 4)}, ${f(sp[1], 4)}]`);
}
if (warns.length) console.log(`\nboot warnings (${warns.length}): ${warns.slice(0, 3).join(' | ')}`);
await browser.close();
process.exit(ok ? 0 : 2);
