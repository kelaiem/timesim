// §152 probe — CAN A PER-UNIT KEY BE BUILT, AND WHAT DOES IT COST?
//
// The entry disqualifies the AABB fingerprint as the incremental key by
// measurement (§77's castellations moved no box) and proposes a per-unit
// digest over actual vertex data. Nothing had measured whether such a digest
// is cheap enough to sit at boot, whether it is DETERMINISTIC across two
// virgin boots (the property the whole scheme rests on, and the one the
// fingerprint's own double-boot gate exists to establish), or what a
// restriction actually buys on this movement's unit census.
//
// So this measures, on the built scene:
//   1. the unit census both ways (includeExcluded) and the pair counts that
//      follow — the entry quotes 52 units / 1326 pairs from §107's landing;
//   2. SHAPE digest: FNV-1a over every unit's position + index buffers, at
//      the fingerprint's canonical poses (a morphing part installs a
//      different frame at a different pose — a one-pose walk would digest
//      one frame of a pool);
//   3. PLACE digest: the same units' per-mesh world matrices, quantised, at
//      the same poses — the half the AABB fingerprint approximates and the
//      vertex digest cannot see at all;
//   4. both digests' cost, and their equality across two VIRGIN contexts;
//   5. what a restriction buys: pairs touching k changed units;
//   6. the fixed cost a narrowed `inspection` would keep — the per-pose
//      unit-AABB rebuild, timed against the pair loop it feeds.
import { chromium } from 'playwright';
import { spawn } from 'node:child_process';

const port = process.env.PORT || '8531';
const srv = spawn('python3', ['-m', 'http.server', port, '--bind', '127.0.0.1'], { cwd: '..', stdio: 'ignore' });
await new Promise((r) => setTimeout(r, 900));

const MEASURE = () => {
  const c = window.__clock;
  // collectUnits' own walk, replicated: the §66 schematic tier is display and
  // is pruned wherever it is parented (inspect.js prunes it in the one
  // collector every unit check flows through).
  const EXCLUDED = ['Dial', 'Power reserve', 'Small seconds'];
  const unitsOf = (includeExcluded) => {
    const out = [];
    for (const { name, obj } of c.labelEntries) {
      if (!includeExcluded && EXCLUDED.includes(name)) continue;
      const meshes = [];
      (function walk(o) {
        if (o.userData && o.userData.schematic) return;
        if (o.isMesh && o.geometry && o.geometry.attributes.position) meshes.push(o);
        for (const ch of o.children) walk(ch);
      })(obj);
      if (meshes.length) out.push({ name, obj, meshes });
    }
    return out;
  };

  const h32 = (h, n) => { h ^= n; return (h + ((h << 1) + (h << 4) + (h << 7) + (h << 8) + (h << 24))) >>> 0; };
  // Hash the RAW BYTES of a typed array — float bit patterns, not decimal
  // renderings: identical builds produce identical bits, and a build that
  // differs in the last ulp is a different geometry, which is the answer we
  // want rather than one a rounding would hide.
  const hashArray = (arr, h) => {
    const b = new Uint8Array(arr.buffer, arr.byteOffset, arr.byteLength);
    for (let i = 0; i < b.length; i++) h = h32(h, b[i]);
    return h;
  };

  const POSES = [
    { tau: 0, crownPullT: 0, leverEngage: 0, tension: 1 },
    { tau: 0.13, crownPullT: 0, leverEngage: 0, tension: 1 },
    { tau: 8 * 3600 * 0.37, crownPullT: 0, leverEngage: 0, tension: 1 },
    { tau: 0.05, crownPullT: 1, leverEngage: 1, tension: 1 },
    { tau: 0.13, crownPullT: 0, leverEngage: 0, tension: 0.4 },
    { tau: 0.13, crownPullT: 0, leverEngage: 0, tension: 1, alarmCrownRotation: 2.0 },
    { tau: 0.13, crownPullT: 0, leverEngage: 0, tension: 1, alarmStrikePhase: 7.3 },
    { tau: 0.13, crownPullT: 0, leverEngage: 0, tension: 1, alarmCrownRotation: 2.0, alarmOn: 1 },
    { tau: 0.13, crownPullT: 0, leverEngage: 0, tension: 1, alarmCrownPullT: 1 },
    { tau: 0.13, crownPullT: 0, leverEngage: 0, tension: 1, alarmOn: 1, alarmReleased: 1, alarmStrikePhase: 5.2 },
    { tau: 0.13, crownPullT: 0, leverEngage: 0, tension: 1, alarmBarrelWind: 1.75 },
  ];

  const units = unitsOf(true);
  const unitsNoExcl = unitsOf(false);

  // ---- census -----------------------------------------------------------
  let meshes = 0, tris = 0, verts = 0;
  const geos = new Set();
  for (const u of units) for (const m of u.meshes) {
    meshes++; geos.add(m.geometry);
    verts += m.geometry.attributes.position.count;
    tris += (m.geometry.index ? m.geometry.index.count : m.geometry.attributes.position.count) / 3;
  }

  // ---- SHAPE digest, at every canonical pose ----------------------------
  const shapeAt = (pose) => {
    c.resetInputs(); c.setPose(pose); c.scene.updateMatrixWorld(true);
    const rows = {};
    for (const u of unitsOf(true)) {
      let h = 0x811c9dc5;
      for (const m of u.meshes) {
        const g = m.geometry;
        h = hashArray(g.attributes.position.array, h);
        if (g.index) h = hashArray(g.index.array, h);
        h = h32(h, g.attributes.position.count);
      }
      rows[u.name] = h >>> 0;
    }
    return rows;
  };
  const t0 = performance.now();
  const shapeRows = POSES.map(shapeAt);
  const shapeMs = performance.now() - t0;
  // fold the per-pose rows into one digest per unit
  const shape = {};
  for (const name of Object.keys(shapeRows[0])) {
    let h = 0x811c9dc5;
    for (const r of shapeRows) h = h32(h, r[name] ?? 0);
    shape[name] = h >>> 0;
  }
  // how many units' shape actually VARIES across the pose set (the pools)
  const morphing = Object.keys(shapeRows[0]).filter((n) => shapeRows.some((r) => r[n] !== shapeRows[0][n]));

  // one-pose shape cost, for the "is 11 poses affordable" question
  const t1 = performance.now(); shapeAt(POSES[0]); const shapeOneMs = performance.now() - t1;

  // ---- PLACE digest -----------------------------------------------------
  const t2 = performance.now();
  const place = {};
  const q = (n) => Math.round(n * 1e6) / 1e6 + 0;
  for (const name of Object.keys(shape)) place[name] = 0x811c9dc5;
  for (const pose of POSES) {
    c.resetInputs(); c.setPose(pose); c.scene.updateMatrixWorld(true);
    for (const u of unitsOf(true)) {
      let h = place[u.name];
      for (const m of u.meshes) for (const e of m.matrixWorld.elements) {
        const s = String(q(e));
        for (let i = 0; i < s.length; i++) h = h32(h, s.charCodeAt(i));
      }
      place[u.name] = h >>> 0;
    }
  }
  const placeMs = performance.now() - t2;

  // ---- the fixed cost a narrowed inspection keeps ------------------------
  c.resetInputs(); c.setPose(POSES[0]); c.scene.updateMatrixWorld(true);
  const U = unitsOf(true);
  // The page does not publish THREE, and a probe must not import a second
  // copy of it — a Box3 from another module instance would not be the class
  // the scene's own bounding boxes are. Reach the constructor through one.
  const anyGeo = U[0].meshes[0].geometry;
  if (anyGeo.boundingBox === null) anyGeo.computeBoundingBox();
  const Box3C = anyGeo.boundingBox.constructor;
  const boxT0 = performance.now();
  const REP = 20;
  for (let r = 0; r < REP; r++) for (const u of U) new Box3C().setFromObject(u.obj);
  const boxesMs = (performance.now() - boxT0) / REP;
  // the broad-phase pair loop that consumes them, at this pose
  const boxes = U.map((u) => new Box3C().setFromObject(u.obj));
  const pairT0 = performance.now();
  let hits = 0;
  for (let r = 0; r < REP; r++) { hits = 0;
    for (let i = 0; i < U.length; i++) for (let j = i + 1; j < U.length; j++) if (boxes[i].intersectsBox(boxes[j])) hits++; }
  const pairLoopMs = (performance.now() - pairT0) / REP;

  // ---- per-unit weight, and the declared-row checks' incidence ----------
  // A pair count is not a wall-clock share: narrow-phase cost scales with the
  // meshes and triangles on both sides, and this scene's units differ by two
  // orders of magnitude. So the restriction's arithmetic is reported WITH the
  // weight of what it would skip, rather than as a flat percentage.
  const perUnit = units.map((u) => ({
    unit: u.name,
    meshes: u.meshes.length,
    tris: u.meshes.reduce((a, m) => a + (m.geometry.index ? m.geometry.index.count : m.geometry.attributes.position.count) / 3, 0),
  })).sort((a, b) => b.tris - a.tris);

  const n = units.length, n2 = unitsNoExcl.length;
  const touching = (k, N) => k * (N - k) + (k * (k - 1)) / 2;
  return {
    census: { labelEntries: c.labelEntries.length, units: n, unitsNoExcluded: n2, meshes, geometries: geos.size, triangles: tris, vertices: verts },
    pairs: {
      all: (n * (n - 1)) / 2, allNoExcluded: (n2 * (n2 - 1)) / 2,
      touching1: touching(1, n), touching2: touching(2, n), touching3: touching(3, n), touching5: touching(5, n),
      pctTouching2: +(100 * touching(2, n) / ((n * (n - 1)) / 2)).toFixed(2),
      chain: n - 1,
    },
    heaviestUnits: perUnit.slice(0, 8),
    lightestUnits: perUnit.slice(-4),
    shapeMs: +shapeMs.toFixed(1), shapeOneMs: +shapeOneMs.toFixed(1), placeMs: +placeMs.toFixed(1),
    morphing,
    broadPhase: { unitBoxesMs: +boxesMs.toFixed(2), pairLoopMs: +pairLoopMs.toFixed(2), aabbHits: hits },
    shape, place,
  };
};

// The incremental scheme has to STORE a baseline — the digests plus the run
// they belong to — and read it back on the next PR, so its size is a design
// input, not a detail. Measured on the two cheapest axes and reported with
// their pose share, so the extrapolation is visible rather than asserted.
const PAYLOAD_AXES = ['crown', 'alarmToggle'];

const run = async (b, withPayload = false) => {
  const ctx = await b.newContext();
  const p = await ctx.newPage();
  const warns = [];
  p.on('console', (m) => { if (m.type() === 'warning') warns.push(m.text()); });
  await p.goto(`http://127.0.0.1:${port}/index.html`, { waitUntil: 'load', timeout: 90000 });
  await p.waitForFunction(() => !!window.__clock, null, { timeout: 90000 });
  const out = await p.evaluate(MEASURE);
  let payload = null;
  if (withPayload) {
    // index.html does not import the inspector; every probe that drives a
    // check installs it the same way ci-battery.mjs does.
    await p.evaluate(async () => { window.__I = await import('./src/inspect.js'); });
    await p.evaluate(() => window.__clock.beginSweepHold());
    await p.evaluate(([axes]) => window.__I.start(window.__clock, 'inspection',
      { includeExcluded: true, yieldEvery: 64, axes }), [PAYLOAD_AXES]);
    for (let i = 0; i < 600; i++) {
      await new Promise((r) => setTimeout(r, 1000));
      const st = await p.evaluate(() => {
        const s = window.__I.status('inspection');
        return s.state === 'running' ? { state: 'running' } : s;
      });
      if (st.state !== 'running') { payload = st; break; }
    }
    payload = await p.evaluate(([ms]) => {
      const r = window.__inspectReport;
      const bytes = new TextEncoder().encode(JSON.stringify(r)).length;
      const poseEntries = r.report.reduce((a, row) =>
        a + Object.values(row.axes).reduce((x, fs) => x + fs.length, 0), 0);
      return { axes: r.axes, bytes, rows: r.report.length, poseEntries, ms };
    }, [payload && payload.ms]);
  }
  await ctx.close();
  return { out, payload, warns: warns.filter((w) => !/WebGL|GroupMarker|Automatic fallback|Fallback/i.test(w)) };
};

const b = await chromium.launch();
const A = await run(b, true);
const B = await run(b);
await b.close(); srv.kill();

const { shape: sA, place: pA, ...rest } = A.out;
console.log(JSON.stringify(rest, null, 1));
const diffShape = Object.keys(sA).filter((k) => sA[k] !== A.out.shape[k] || sA[k] !== B.out.shape[k]);
const diffPlace = Object.keys(pA).filter((k) => pA[k] !== B.out.place[k]);
console.log('boot-to-boot: shape rows differing', diffShape.length, '/', Object.keys(sA).length);
console.log('boot-to-boot: place rows differing', diffPlace.length, '/', Object.keys(pA).length);
if (diffShape.length) console.log('  shape drift:', diffShape.slice(0, 10).map((k) => `${k} ${sA[k]}/${B.out.shape[k]}`).join(', '));
if (diffPlace.length) console.log('  place drift:', diffPlace.slice(0, 10).map((k) => `${k} ${pA[k]}/${B.out.place[k]}`).join(', '));
console.log('two-axis inspection payload:', JSON.stringify(A.payload));
console.log('boot warns A:', A.warns.length, 'B:', B.warns.length);
A.warns.slice(0, 5).forEach((w) => console.log('  W ' + w.slice(0, 300)));
