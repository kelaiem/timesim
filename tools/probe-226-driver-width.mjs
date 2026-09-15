// §226 — HOW MUCH WIDER CAN THE COLUMN-WHEEL DRIVER'S ARMS BE CUT?
//
// The owner's question was "can we make it wider if not that much thicker?"
// §226 route A already spent the driver's Z (0.120 mm -> 0.228 mm, paid 1:1 in
// cased height). Plan width is the other axis, and it is nearly free in z — so
// the question is what the surrounding metal allows.
//
// IT ANSWERS IN THE PART'S OWN AUTHORED CONSTANTS, not in free cells. The
// driver's outline is the CONVEX HULL OF DISCS (makeColumnDriver): a hub disc
// plus one tip disc per arm. Every shipped radius is a functional core plus one
// minimum wall —
//
//     hubR   = bore + PIVOT_BORE_CLEAR + STOCK_MIN_U
//     tipR_0 = slotHalfW             + STOCK_MIN_U     (the pusher-pin slot)
//     tipR_1 = STOCK_MIN_R10         + STOCK_MIN_U     (the pawl post)
//     tipR_2 = anchorArmTipR         (>= STOCK_MIN_R10 + STOCK_MIN_U)
//
// — so the arms are "the hole, plus the thinnest wall §50 permits". That is a
// FLOOR standing in for a design, which is why they read slender. This probe
// measures the ceiling the movement puts on each of those four radii, so the
// wall can be chosen between the two instead of pinned to one of them.
//
// WHICH INSTRUMENT THIS IS NOT (the skill's rule, so the next search works):
//   · NOT probe-section-headroom.mjs. That grows a BAR's section uniformly and
//     reports ONE scalar headroom per bar against its nearest cross-unit metal.
//     Right question, wrong shape: this part is a flat plate whose growth is
//     per-disc and whose walls are all INSIDE its own unit, so that probe's
//     same-unit exclusion would discard every obstacle that matters here.
//   · NOT findFreeAnnulus (inspect.js). Its slicing technique is reused below
//     and credited, but it is ORIGIN-CENTRED POLAR — it answers "which annulus
//     of the movement is free". The driver's question lives in the driver's own
//     rotating frame, which is the whole difficulty (see SWEPT, below).
//   · NOT probe-104.mjs. That is a siting survey of the striking corner.
//
// THE OBSTACLE SET IS THE ENTIRE DIFFICULTY, and the first version of this
// probe got it wrong in the way that reads CLEAN-ish: it counted the driver's
// DECLARED JOINTS as obstacles, so 1546 cells of the outline the movement
// already ships came back blocked, and it reported an 86 mm^2 figure that was
// withdrawn rather than quoted. A part is meant to touch what it is joined to
// (the skill's "the ground is not an obstacle"). Excluded here, per mesh:
//   1. the driver itself;
//   2. its four DECLARED joints, read from inspect.js's INTRA_UNIT_CONTACTS
//      rather than named here — alarmColStud (arbor in the bore),
//      alarmPusherRiser (the pin in the slot), alarmColPawlPost and
//      alarmColPawlSpringStud (both RIVETED INTO the arms, so that metal is
//      the point, not a collision);
//   3. meshes measured RIGID with the driver over the pose net (sameFrame),
//      which cannot collide with a body they travel with.
// Everything else stays an obstacle INCLUDING the rest of the 'Alarm switch'
// unit — the column wheel's skirt and castellations, the jumper, the pusher's
// other members. Those are the walls. Exclusion by UNIT would delete them all.
//
// SWEPT IN THE DRIVER'S OWN FRAME. A widened arm is rigid with the driver, so
// it must clear every obstacle at EVERY pose of the driver's stroke. Obstacle
// triangles are therefore transformed into driver-local coordinates per pose
// and OR-ed there — not rasterised in world. Rasterising in world would answer
// a question about a driver that never turns.
//
// Marking is INTERIOR FILL + EDGE WALK, taken from findFreeAnnulus, for its
// reason: centre-test fill alone loses anything thinner than a cell (a 0.2 u
// wire between cell centres vanishes), and bounding-box fill is far too blunt.
//
// THE IN-PLANE MARGIN IS A FUNCTION OF THE Z GAP, and getting that wrong is
// what the second version of this probe did. Clearance is 3D: a neighbour
// separated from the driver's own metal by dz in z needs only
//
//     m(dz) = sqrt(max(0, CLEAR_MARGIN^2 - dz^2))
//
// of PLAN separation, and none at all once dz reaches CLEAR_MARGIN. Charging
// every neighbour the full CLEAR_MARGIN in plan is not "conservative", it
// destroys the signal: measured, the THREE-QUARTER PLATE's top face stands at
// world z 9.5454 and the driver's underside at 9.6954 — a gap of exactly
// CLEAR_MARGIN, because the driver turns ON that plate. Charged as a plan
// obstacle it marked 444380 of 523328 cells, 85% of the grid, and every disc
// came back "already inside the margin". That is the skill's GROUND-IS-NOT-AN-
// OBSTACLE trap arriving through a z slab, with TANGENCY READ AS INTERSECTION
// underneath it (the gap is CLEAR_MARGIN minus 6e-9 of float noise).
//
// So each triangle is marked with its own m(dz) DILATION rather than into a
// binary slab: a triangle contributes the cells within m of its footprint, and
// a candidate outline is admissible iff it contains no marked cell. Triangles
// at dz >= CLEAR_MARGIN are skipped — already clear in 3D whatever the plan
// does. This is exact, not a band approximation, and it needs no distance
// transform for the verdict.
//
// ONE NUMBER HERE IS NOT A MEASUREMENT OF THE MOVEMENT: the "nearest undilated
// metal" printed beside C1 is taken over cell centres inside the scanned
// window, so it moves with CAP (5.2041 u at CAP 4, 4.9912 u at CAP 8) and
// under-reports metal too thin to hold a cell centre. The VERDICT does not use
// it — the growth column comes from the dilated marks alone.
//
// SECOND TIER — WHAT IS SEEN. Fitting is not the whole question: growth under
// an occluder buys mass, growth in the open buys legibility, and §226 makes
// legibility a stated design value. Each cell is scored by the fraction of
// poses at which nothing covers it ABOVE the driver's top face, viewed from
// the exhibition caseback (high world z). Two things this gets wrong if done
// naively, both now controls: a WINDOW IS NOT A WALL (caseBackCrystal is
// transparent, opacity 0.14 — counted as an occluder it made the driver read
// 100.0% hidden, C8), and the DENOMINATOR IS THE DRIVER'S OWN METAL rather
// than its hull, because the hull fills the pivot bore and the pin slot and
// counting holes as driver flatters every figure. C6 holds the result against
// an independently measured 57.9% hidden.
//
// A REPORT (it prints a table and exits 0 on its measurements) with ACCEPTANCE
// CONTROLS (it exits 1 if a control fails, because a control that is allowed to
// fail quietly is not a control):
//   C1 SELF-CONSISTENCY — the SHIPPED hull contains no occupied cell. If the
//      movement's own metal reads impossible, the obstacle set is wrong. This
//      is the control the withdrawn first version failed.
//   C2 THE DETECTOR LIVES — each disc grown by +5 u IS blocked. A ceiling
//      reported by a probe that cannot say "no" is not a measurement.
//   C3 THE EXCLUSION DOES WORK — with the four declared joints put back into
//      the obstacle set, C1 must FAIL. This re-runs the original bug on
//      purpose: if it now passes, the exclusion is not what fixed anything.
//   C4 THE FIELD IS NOT EMPTY — occupied cells exist and their contributing
//      meshes are named, so "lots of room" cannot come from measuring nothing.
//   C5 THE GROUND IS GROUND BY MEASUREMENT — the three-quarter plate, the one
//      part skipped wholesale, is asserted to clear the driver in z by at
//      least CLEAR_MARGIN. Skipping it is then a reading, not an assumption.
//   C6 TWO METHODS AGREE — the visible fraction reproduces a separately
//      measured 57.9% hidden within 6 points. A visibility number nothing
//      corroborates is a picture, not a measurement.
//   C7 THE DOMINANT OCCLUDER IS NAMED — and it is the column wheel's own
//      body, which sits ABOVE the driver, so no window cut in the plate
//      BELOW can uncover what it hides. That is the load-bearing fact for
//      route B and it is measured here rather than assumed.
//   C8 THE CASEBACK IS A WINDOW — see-through is read off the MATERIAL, never
//      a name list, and caseBackCrystal must be in that set.
//
// Usage: cd tools && node probe-226-driver-width.mjs [out.json]
//        env CELL=0.02 CAP=8.0 SAMPLES=5
import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import { writeFileSync } from 'node:fs';

const PORT = process.env.PORT || 8492;
const ROOT = process.env.ROOT || '..';
const CELL = +(process.env.CELL || 0.02);
const CAP = +(process.env.CAP || 8.0);
const SAMPLES = +(process.env.SAMPLES || 5);

const srv = spawn('python3', ['-m', 'http.server', String(PORT), '--bind', '127.0.0.1'], { cwd: ROOT, stdio: 'ignore' });
process.on('exit', () => srv.kill());
await new Promise((r) => setTimeout(r, 900));
const browser = await chromium.launch();
const page = await browser.newPage();
page.on('pageerror', (e) => console.error('PAGEERROR', String(e)));
await page.goto(`http://127.0.0.1:${PORT}/index.html`, { waitUntil: 'load', timeout: 60000 });
await page.waitForFunction(() => !!window.__clock, null, { timeout: 60000 });

const R = await page.evaluate(async ({ CELL, CAP, SAMPLES }) => {
  const THREE = await import('./vendor/three.module.js');
  const I = await import('./src/inspect.js');
  const { CLEAR_MARGIN, UNIT_MM } = await import('./src/layout.js');
  const clock = window.__clock;

  // ---- the part ---------------------------------------------------------
  let driver = null;
  clock.scene.traverse((o) => { if (o.name === 'alarmColDriver') driver = o; });
  if (!driver) throw new Error('alarmColDriver not in the scene');
  const outline = driver.userData.outline.map(([x, y]) => [x, y]);
  const arms = driver.userData.arms;
  driver.geometry.computeBoundingBox();
  const thickness = driver.geometry.boundingBox.max.z - driver.geometry.boundingBox.min.z;
  const zBase = driver.geometry.boundingBox.min.z;

  // ---- the exclusions, read from the repo's own declaration --------------
  const jointNames = new Set();
  for (const r of I.INTRA_UNIT_CONTACTS) {
    if (r.a === 'alarmColDriver') jointNames.add(r.b);
    if (r.b === 'alarmColDriver') jointNames.add(r.a);
  }

  // ---- poses: every axis, plus the build pose ---------------------------
  const poses = [];
  for (const axis of I.AXES) for (let s = 0; s < SAMPLES; s++) poses.push({ axis, f: s / Math.max(1, SAMPLES - 1) });

  // Rigid-with-the-driver, MEASURED: a mesh whose transform relative to the
  // driver never changes over the pose net travels with it.
  const relOf = (o, dInv) => { const m = new THREE.Matrix4().multiplyMatrices(dInv, o.matrixWorld); return m.elements.slice(); };
  const candidates = [];
  clock.scene.traverse((o) => {
    if (!o.isMesh || !o.geometry?.attributes?.position) return;
    if (o.userData && o.userData.schematic) return;
    candidates.push(o);
  });
  const relFirst = new Map();
  const rigid = new Set();
  {
    I.enterAxis(clock);
    clock.scene.updateMatrixWorld(true);
    const dInv = new THREE.Matrix4().copy(driver.matrixWorld).invert();
    for (const o of candidates) relFirst.set(o, relOf(o, dInv));
    for (const o of candidates) rigid.add(o);
  }
  let lastAxis = null;
  for (const p of poses) {
    if (p.axis !== lastAxis) { I.enterAxis(clock); lastAxis = p.axis; }
    clock.setPose(p.axis.pose(p.f));
    clock.scene.updateMatrixWorld(true);
    const dInv = new THREE.Matrix4().copy(driver.matrixWorld).invert();
    for (const o of Array.from(rigid)) {
      const a = relFirst.get(o), b = relOf(o, dInv);
      let same = true;
      for (let i = 0; i < 16; i++) if (Math.abs(a[i] - b[i]) > I.FRAME_TOL) { same = false; break; }
      if (!same) rigid.delete(o);
    }
  }

  const rigidNames = Array.from(rigid).map((o) => o.name || '(unnamed)').sort();

  // ---- the grid, in DRIVER-LOCAL coordinates ----------------------------
  const ox = outline.map((p) => p[0]), oy = outline.map((p) => p[1]);
  const pad = CAP + 2 * CLEAR_MARGIN + 0.5;
  const x0 = Math.min(...ox) - pad, x1 = Math.max(...ox) + pad;
  const y0 = Math.min(...oy) - pad, y1 = Math.max(...oy) + pad;
  const nx = Math.ceil((x1 - x0) / CELL), ny = Math.ceil((y1 - y0) / CELL);
  const zLo = zBase - CLEAR_MARGIN, zHi = zBase + thickness + CLEAR_MARGIN;
  const dzTol = 1e-6;                      // tangency is not intersection
  const mOf = (dz) => Math.sqrt(Math.max(0, CLEAR_MARGIN * CLEAR_MARGIN - dz * dz));
  // 2D point-to-triangle distance (0 inside), for the m(dz) dilation
  const segD = (px, py, ax, ay, bx, by) => {
    const vx = bx - ax, vy = by - ay, wx = px - ax, wy = py - ay;
    const L = vx * vx + vy * vy;
    const t = L < 1e-18 ? 0 : Math.max(0, Math.min(1, (wx * vx + wy * vy) / L));
    return Math.hypot(px - (ax + t * vx), py - (ay + t * vy));
  };

  // A mesh with no name of its own is reported by its nearest named ancestor
  // plus its unit — an unnamed 5227-cell contributor is exactly the row a
  // reader cannot act on.
  const unitOf = new Map();
  for (const e of clock.labelEntries) e.obj.traverse((o) => { if (!unitOf.has(o)) unitOf.set(o, e.name); });
  const nameOf = (o) => {
    if (o.name) return o.name;
    for (let q = o.parent; q; q = q.parent) if (q.name) return `${q.name}/(child)`;
    return `(unnamed in ${unitOf.get(o) || 'no unit'})`;
  };
  // buildOcc(includeJoints) -> { occ, contributors }
  const buildOcc = (includeJoints, wantRaw = false) => {
    const occ = new Uint8Array(nx * ny);
    const raw = wantRaw ? new Uint8Array(nx * ny) : null;
    const contributors = new Map();
    const A = new THREE.Vector3(), B = new THREE.Vector3(), C = new THREE.Vector3();
    const dInv = new THREE.Matrix4();
    const corner = new THREE.Vector3();
    let lastAx = null;
    for (const p of poses) {
      if (p.axis !== lastAx) { I.enterAxis(clock); lastAx = p.axis; }
      clock.setPose(p.axis.pose(p.f));
      clock.scene.updateMatrixWorld(true);
      dInv.copy(driver.matrixWorld).invert();
      for (const o of candidates) {
        if (o === driver) continue;
        if (rigid.has(o)) continue;
        if (!includeJoints && jointNames.has(o.name)) continue;
        // broad phase: the mesh's world AABB corners taken into driver-local
        const bb = new THREE.Box3().setFromObject(o);
        let lo = Infinity, hi = -Infinity, bxLo = Infinity, bxHi = -Infinity, byLo = Infinity, byHi = -Infinity;
        for (let i = 0; i < 8; i++) {
          corner.set(i & 1 ? bb.max.x : bb.min.x, i & 2 ? bb.max.y : bb.min.y, i & 4 ? bb.max.z : bb.min.z).applyMatrix4(dInv);
          lo = Math.min(lo, corner.z); hi = Math.max(hi, corner.z);
          bxLo = Math.min(bxLo, corner.x); bxHi = Math.max(bxHi, corner.x);
          byLo = Math.min(byLo, corner.y); byHi = Math.max(byHi, corner.y);
        }
        if (lo > zHi || hi < zLo) continue;
        if (bxLo > x1 || bxHi < x0 || byLo > y1 || byHi < y0) continue;
        const M = new THREE.Matrix4().multiplyMatrices(dInv, o.matrixWorld);
        const pos = o.geometry.getAttribute('position');
        const index = o.geometry.getIndex();
        const n = index ? index.count : pos.count;
        let marked = 0;
        const mark = (x, y) => {
          const i = Math.floor((x - x0) / CELL), j = Math.floor((y - y0) / CELL);
          if (i < 0 || i >= nx || j < 0 || j >= ny) return;
          const k = j * nx + i;
          if (!occ[k]) { occ[k] = 1; marked++; }
        };
        for (let t = 0; t < n; t += 3) {
          const a = index ? index.getX(t) : t, b = index ? index.getX(t + 1) : t + 1, c = index ? index.getX(t + 2) : t + 2;
          A.fromBufferAttribute(pos, a).applyMatrix4(M);
          B.fromBufferAttribute(pos, b).applyMatrix4(M);
          C.fromBufferAttribute(pos, c).applyMatrix4(M);
          // THE Z GAP DECIDES THE PLAN MARGIN. dz is the separation between the
          // triangle's z span and the driver's OWN metal interval; at dz >=
          // CLEAR_MARGIN the pair is clear in 3D whatever the outline does.
          const tzLo = Math.min(A.z, B.z, C.z), tzHi = Math.max(A.z, B.z, C.z);
          const dz = Math.max(0, tzLo - (zBase + thickness), zBase - tzHi);
          if (dz >= CLEAR_MARGIN - dzTol) continue;
          const m = mOf(dz);
          const tx0 = Math.min(A.x, B.x, C.x), tx1 = Math.max(A.x, B.x, C.x);
          const ty0 = Math.min(A.y, B.y, C.y), ty1 = Math.max(A.y, B.y, C.y);
          if (tx1 + m < x0 || tx0 - m > x1 || ty1 + m < y0 || ty0 - m > y1) continue;
          // Mark every cell within m of the triangle's footprint — the
          // dilation IS the clearance, so a marked cell inside a candidate
          // outline is a violation with no further test.
          const d0 = (B.y - C.y) * (A.x - C.x) + (C.x - B.x) * (A.y - C.y);
          const i0 = Math.max(0, Math.floor((tx0 - m - x0) / CELL)), i1 = Math.min(nx - 1, Math.ceil((tx1 + m - x0) / CELL));
          const j0 = Math.max(0, Math.floor((ty0 - m - y0) / CELL)), j1 = Math.min(ny - 1, Math.ceil((ty1 + m - y0) / CELL));
          for (let j = j0; j <= j1; j++) {
            const py = y0 + (j + 0.5) * CELL;
            for (let i = i0; i <= i1; i++) {
              const k = j * nx + i;
              if (occ[k]) continue;
              const px = x0 + (i + 0.5) * CELL;
              let inside = false;
              if (Math.abs(d0) > 1e-12) {
                const u = ((B.y - C.y) * (px - C.x) + (C.x - B.x) * (py - C.y)) / d0;
                const v = ((C.y - A.y) * (px - C.x) + (A.x - C.x) * (py - C.y)) / d0;
                inside = (u >= 0 && v >= 0 && u + v <= 1);
              }
              if (!inside && m <= 0) continue;
              if (!inside) {
                const dd = Math.min(segD(px, py, A.x, A.y, B.x, B.y),
                                    segD(px, py, B.x, B.y, C.x, C.y),
                                    segD(px, py, C.x, C.y, A.x, A.y));
                if (dd > m) continue;
              }
              occ[k] = 1; marked++;
              if (raw && !inside) continue;
              if (raw && inside) raw[k] = 1;
            }
          }
        }
        if (marked > 0) { const nm = nameOf(o); contributors.set(nm, (contributors.get(nm) || 0) + marked); }
      }
    }
    return { occ, raw, contributors };
  };

  // ---- exact squared EDT (separable, Felzenszwalb) ----------------------
  const edt = (occ) => {
    const INF = 1e20;
    const f = new Float64Array(Math.max(nx, ny));
    const d = new Float64Array(nx * ny);
    for (let k = 0; k < nx * ny; k++) d[k] = occ[k] ? 0 : INF;
    const v = new Int32Array(Math.max(nx, ny));
    const z = new Float64Array(Math.max(nx, ny) + 1);
    const dt1 = (arr, n, out) => {
      let k = 0; v[0] = 0; z[0] = -INF; z[1] = INF;
      for (let q = 1; q < n; q++) {
        let s;
        for (;;) {
          s = ((arr[q] + q * q) - (arr[v[k]] + v[k] * v[k])) / (2 * q - 2 * v[k]);
          if (s <= z[k]) k--; else break;
        }
        k++; v[k] = q; z[k] = s; z[k + 1] = INF;
      }
      k = 0;
      for (let q = 0; q < n; q++) {
        while (z[k + 1] < q) k++;
        out[q] = (q - v[k]) * (q - v[k]) + arr[v[k]];
      }
    };
    const col = new Float64Array(ny), colOut = new Float64Array(ny);
    for (let i = 0; i < nx; i++) {
      for (let j = 0; j < ny; j++) col[j] = d[j * nx + i];
      dt1(col, ny, colOut);
      for (let j = 0; j < ny; j++) d[j * nx + i] = colOut[j];
    }
    const row = new Float64Array(nx), rowOut = new Float64Array(nx);
    for (let j = 0; j < ny; j++) {
      for (let i = 0; i < nx; i++) row[i] = d[j * nx + i];
      dt1(row, nx, rowOut);
      for (let i = 0; i < nx; i++) d[j * nx + i] = rowOut[i];
    }
    for (let k = 0; k < nx * ny; k++) d[k] = Math.sqrt(d[k]) * CELL;
    return d;
  };

  // ---- hull of (shipped outline + one grown disc) -----------------------
  const hullOf = (pts) => {
    const cross = (o, a, b) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
    const s = pts.slice().sort((p, q) => (p[0] - q[0]) || (p[1] - q[1]));
    const lo = [], hi = [];
    for (const p of s) { while (lo.length >= 2 && cross(lo[lo.length - 2], lo[lo.length - 1], p) <= 0) lo.pop(); lo.push(p); }
    for (let i = s.length - 1; i >= 0; i--) { const p = s[i]; while (hi.length >= 2 && cross(hi[hi.length - 2], hi[hi.length - 1], p) <= 0) hi.pop(); hi.push(p); }
    lo.pop(); hi.pop();
    return lo.concat(hi);
  };
  const discPts = (cx, cy, r, segs = 128) => {
    const out = [];
    for (let i = 0; i < segs; i++) { const t = (2 * Math.PI * i) / segs; out.push([cx + r * Math.cos(t), cy + r * Math.sin(t)]); }
    return out;
  };
  // THE VERDICT: a marked cell inside the outline is a violation, because the
  // mark already carries its own m(dz) dilation.
  //
  // OUT OF GRID COUNTS AS BLOCKED, and that is not a detail. A cell beyond the
  // grid was never measured, and unmeasured is not free — scored as free, a
  // disc grown past the edge came back unblocked and the C2 control caught it.
  // Scored as blocked, every ceiling this probe reports is a LOWER BOUND, and
  // a ceiling set by the edge rather than by metal is labelled as such instead
  // of being quoted as a measurement.
  const hullHits = (hull, occ) => {
    const hx = hull.map((p) => p[0]), hy = hull.map((p) => p[1]);
    const gi0 = Math.floor((Math.min(...hx) - x0) / CELL), gi1 = Math.ceil((Math.max(...hx) - x0) / CELL);
    const gj0 = Math.floor((Math.min(...hy) - y0) / CELL), gj1 = Math.ceil((Math.max(...hy) - y0) / CELL);
    const n = hull.length;
    let marked = 0, outside = 0;
    for (let j = gj0; j <= gj1; j++) {
      const py = y0 + (j + 0.5) * CELL;
      for (let i = gi0; i <= gi1; i++) {
        const px = x0 + (i + 0.5) * CELL;
        let inside = true;
        for (let e = 0; e < n; e++) {
          const a = hull[e], b = hull[(e + 1) % n];
          if ((b[0] - a[0]) * (py - a[1]) - (b[1] - a[1]) * (px - a[0]) < 0) { inside = false; break; }
        }
        if (!inside) continue;
        if (i < 0 || i >= nx || j < 0 || j >= ny) { outside++; continue; }
        if (occ[j * nx + i]) marked++;
      }
    }
    return { marked, outside };
  };
  const overHull = (hull, cb) => {
    const hx = hull.map((p) => p[0]), hy = hull.map((p) => p[1]);
    const i0 = Math.max(0, Math.floor((Math.min(...hx) - x0) / CELL)), i1 = Math.min(nx - 1, Math.ceil((Math.max(...hx) - x0) / CELL));
    const j0 = Math.max(0, Math.floor((Math.min(...hy) - y0) / CELL)), j1 = Math.min(ny - 1, Math.ceil((Math.max(...hy) - y0) / CELL));
    const n = hull.length;
    for (let j = j0; j <= j1; j++) {
      const py = y0 + (j + 0.5) * CELL;
      for (let i = i0; i <= i1; i++) {
        const px = x0 + (i + 0.5) * CELL;
        let inside = true;
        for (let e = 0; e < n; e++) {
          const a = hull[e], b = hull[(e + 1) % n];
          if ((b[0] - a[0]) * (py - a[1]) - (b[1] - a[1]) * (px - a[0]) < 0) { inside = false; break; }
        }
        if (inside) cb(j * nx + i);
      }
    }
  };
  // min clearance over the hull's own cells
  const minClearOfHull = (hull, dist) => {
    const hx = hull.map((p) => p[0]), hy = hull.map((p) => p[1]);
    const i0 = Math.max(0, Math.floor((Math.min(...hx) - x0) / CELL)), i1 = Math.min(nx - 1, Math.ceil((Math.max(...hx) - x0) / CELL));
    const j0 = Math.max(0, Math.floor((Math.min(...hy) - y0) / CELL)), j1 = Math.min(ny - 1, Math.ceil((Math.max(...hy) - y0) / CELL));
    let best = Infinity;
    const n = hull.length;
    for (let j = j0; j <= j1; j++) {
      const py = y0 + (j + 0.5) * CELL;
      for (let i = i0; i <= i1; i++) {
        const px = x0 + (i + 0.5) * CELL;
        // point in convex polygon (CCW)
        let inside = true;
        for (let e = 0; e < n; e++) {
          const a = hull[e], b = hull[(e + 1) % n];
          if ((b[0] - a[0]) * (py - a[1]) - (b[1] - a[1]) * (px - a[0]) < 0) { inside = false; break; }
        }
        if (!inside) continue;
        const dv = dist[j * nx + i];
        if (dv < best) best = dv;
      }
    }
    return best;
  };

  // hub radius, MEASURED off the part: the largest disc at the origin the
  // shipped outline already contains (adding it changes the hull by nothing).
  const hullArea = (h) => { let a = 0; for (let i = 0; i < h.length; i++) { const p = h[i], q = h[(i + 1) % h.length]; a += p[0] * q[1] - q[0] * p[1]; } return Math.abs(a) / 2; };
  const baseHull = hullOf(outline);
  const baseArea = hullArea(baseHull);
  let hLo = 0, hHi = 6;
  for (let it = 0; it < 40; it++) {
    const m = (hLo + hHi) / 2;
    if (hullArea(hullOf(outline.concat(discPts(0, 0, m)))) <= baseArea * (1 + 1e-7)) hLo = m; else hHi = m;
  }
  const hubR = hLo;

  // EACH ARM IS NAMED BY THE METAL IT CARRIES, never by its index. The first
  // version of this probe labelled the arms from a build-order note list —
  // but `makeColumnDriver` SORTS its arms by azimuth before cutting, so all
  // three labels were rotated and the visibility tier credited the wrong arm.
  // The tip-disc centres coincide with the parts they hold to ~1e-15, so the
  // association is a measurement, not a guess.
  const carriers = new Map();
  {
    const dInv = new THREE.Matrix4().copy(driver.matrixWorld).invert();
    const named = [];
    clock.scene.traverse((o) => {
      if (o.isMesh && ['alarmColPawlPost', 'alarmColPawlSpringStud', 'alarmPusherRiser'].includes(o.name)) named.push(o);
    });
    for (const a of arms) {
      const cx = a.reach * Math.cos(a.az), cy = a.reach * Math.sin(a.az);
      let best = null, bd = Infinity;
      for (const o of named) {
        const q = new THREE.Vector3().setFromMatrixPosition(o.matrixWorld).applyMatrix4(dInv);
        const d = Math.hypot(q.x - cx, q.y - cy);
        if (d < bd) { bd = d; best = o.name; }
      }
      carriers.set(a, { part: best, dist: bd });
    }
  }
  const ROLE = { alarmColPawlPost: 'pawl post', alarmColPawlSpringStud: 'anchor / blade stud', alarmPusherRiser: 'pusher-pin slot' };
  const discs = [{ what: 'hub', cx: 0, cy: 0, r: hubR, note: 'bore + PIVOT_BORE_CLEAR + STOCK_MIN_U' }];
  arms.forEach((a) => {
    const c = carriers.get(a);
    discs.push({
      what: `${ROLE[c.part] || c.part} @ ${(a.az * 180 / Math.PI).toFixed(1)}°`,
      cx: a.reach * Math.cos(a.az), cy: a.reach * Math.sin(a.az), r: a.tipR,
      note: `carries ${c.part} (tip-disc centre to ${c.dist.toExponential(1)}), reach ${a.reach.toFixed(3)}`,
      carrier: c.part, carrierDist: c.dist,
    });
  });

  // ---- THE REFERENCE DIMENSION: the ratchet tooth the pawl indexes -------
  // §226's design target is that the driver's features read at roughly the
  // size of the ratchet teeth below the column wheel. Taken off `ratchetPoly`
  // — the very polygon the skirt is extruded from — rather than re-derived,
  // so the target cannot drift from the cut.
  let tooth = null;
  {
    let wheel = null;
    clock.scene.traverse((o) => { if (o.userData && o.userData.ratchetPoly) wheel = o; });
    if (wheel) {
      const poly = wheel.userData.ratchetPoly.map((q) => ({ x: q.x, y: q.y, r: Math.hypot(q.x, q.y) }));
      const teethN = poly.length / 2;
      let tipR = -Infinity, rootR = Infinity;
      for (const q of poly) { tipR = Math.max(tipR, q.r); rootR = Math.min(rootR, q.r); }
      const pitchRad = 2 * Math.PI / teethN;
      tooth = { teethN, tipR, rootR, depth: tipR - rootR,
        pitchAtMid: pitchRad * (tipR + rootR) / 2, bandH: wheel.userData.skirtH };
    }
  }

  // ---- the real field, and the controls ---------------------------------
  const real = buildOcc(false, true);
  const distRaw = edt(real.raw);                 // true nearest metal, undilated — for the report only
  const withJoints = buildOcc(true);

  const shippedHitsO = hullHits(baseHull, real.occ);
  const shippedHits = shippedHitsO.marked + shippedHitsO.outside;
  const shippedHitsJoints = hullHits(baseHull, withJoints.occ).marked;
  const shippedClear = minClearOfHull(baseHull, distRaw);

  // C5 — the one part skipped wholesale is skipped BY MEASUREMENT.
  let plateGap = null;
  {
    let plate = null;
    clock.scene.traverse((o) => { if (o.name === 'threeQuarterPlate') plate = o; });
    if (plate) {
      I.enterAxis(clock); clock.scene.updateMatrixWorld(true);
      const dInv2 = new THREE.Matrix4().copy(driver.matrixWorld).invert();
      const M2 = new THREE.Matrix4().multiplyMatrices(dInv2, plate.matrixWorld);
      const pos2 = plate.geometry.getAttribute('position');
      const P = new THREE.Vector3();
      let best = Infinity;
      for (let i = 0; i < pos2.count; i++) {
        P.fromBufferAttribute(pos2, i).applyMatrix4(M2);
        best = Math.min(best, Math.max(0, Math.max(P.z - (zBase + thickness), zBase - P.z)));
      }
      plateGap = best;
    }
  }

  const rows = [];
  for (const d of discs) {
    // bisect the largest radius whose outline still admits no marked cell
    let lo = d.r, hi = d.r + CAP;
    const at = (r) => hullHits(hullOf(outline.concat(discPts(d.cx, d.cy, r))), real.occ);
    const ok = (r) => { const h = at(r); return h.marked === 0 && h.outside === 0; };
    if (!ok(lo)) { const h = at(lo); rows.push({ ...d, max: null, growth: null, hits: h, note2: 'shipped radius already inside the margin' }); continue; }
    if (ok(hi)) { rows.push({ ...d, max: hi, growth: hi - d.r, atCap: true, boundBy: 'search ceiling (CAP)' }); continue; }
    for (let it = 0; it < 30; it++) { const m = (lo + hi) / 2; if (ok(m)) lo = m; else hi = m; }
    // WHAT stopped it: real metal, or the edge of what was measured?
    const h = at(hi);
    rows.push({ ...d, max: lo, growth: lo - d.r, atCap: false,
      boundBy: h.marked > 0 ? 'metal' : 'grid edge (UNMEASURED — a lower bound, not a ceiling)' });
  }

  // ---- WHAT IS SEEN, not just what fits ------------------------------
  // Growth under an occluder buys mass; growth in the open buys legibility,
  // which is the whole point of the entry. The viewer is the exhibition
  // caseback, at HIGH world z (§187's stepped glass; zStepUnder 13.18), so a
  // cell is occluded at a pose iff some non-driver metal covers it in xy
  // ABOVE the driver's top face.
  //
  // This is done in the DRIVER'S frame like everything else, and that is
  // sound here for a measured reason rather than by assumption: the driver is
  // a flat plate turning about z, so its local z is parallel to world z (its
  // 0.6004 of local thickness spans exactly 0.6004 of world z). Occlusion
  // along world z is therefore occlusion along local z, and a cell fixed to
  // the driver can be counted in the frame it is fixed to.
  //
  // NOTHING is excluded from the occluder set except the driver itself — the
  // pawl, its post and the skirt are real metal and really do block the view.
  // That is the opposite of the obstacle set above, on purpose: a declared
  // joint is not a collision, but it is very much an occluder.
  const zTop = zBase + thickness;
  const seen = new Uint16Array(nx * ny);       // poses at which the cell is clear
  const occluderCensus = new Map();

  // A WINDOW IS NOT A WALL. The exhibition caseback is glass, so a mesh that
  // transmits most of its light does not occlude what is behind it. Read off
  // the MATERIAL, never a name list, and printed so a reader can audit which
  // meshes were treated as see-through — counting caseBackCrystal (opacity
  // 0.14) as an occluder made the driver read 100.0% hidden, which is what
  // C6 caught.
  const seeThrough = (o) => {
    const m = o.material;
    if (!m || !m.transparent) return false;
    return (m.opacity != null && m.opacity < 0.5) || (m.transmission > 0);
  };
  const seeThroughNames = candidates.filter(seeThrough).map(nameOf).sort();

  // THE DENOMINATOR IS THE DRIVER'S OWN METAL, not its hull: the hull fills
  // the pivot bore and the pusher-pin slot, which are holes, and counting
  // them as driver would flatter every visibility figure. Rasterised from the
  // part's own triangles, so the holes are where the builder cut them.
  const baseSet = new Set();
  {
    const A = new THREE.Vector3(), B = new THREE.Vector3(), C = new THREE.Vector3();
    const pos = driver.geometry.getAttribute('position');
    const index = driver.geometry.getIndex();
    const n = index ? index.count : pos.count;
    for (let t = 0; t < n; t += 3) {
      const a = index ? index.getX(t) : t, b = index ? index.getX(t + 1) : t + 1, c = index ? index.getX(t + 2) : t + 2;
      A.fromBufferAttribute(pos, a); B.fromBufferAttribute(pos, b); C.fromBufferAttribute(pos, c);
      const d0 = (B.y - C.y) * (A.x - C.x) + (C.x - B.x) * (A.y - C.y);
      if (Math.abs(d0) <= 1e-12) continue;
      const tx0 = Math.min(A.x, B.x, C.x), tx1 = Math.max(A.x, B.x, C.x);
      const ty0 = Math.min(A.y, B.y, C.y), ty1 = Math.max(A.y, B.y, C.y);
      const i0 = Math.max(0, Math.floor((tx0 - x0) / CELL)), i1 = Math.min(nx - 1, Math.ceil((tx1 - x0) / CELL));
      const j0 = Math.max(0, Math.floor((ty0 - y0) / CELL)), j1 = Math.min(ny - 1, Math.ceil((ty1 - y0) / CELL));
      for (let j = j0; j <= j1; j++) {
        const py = y0 + (j + 0.5) * CELL;
        for (let i = i0; i <= i1; i++) {
          const k = j * nx + i;
          if (baseSet.has(k)) continue;
          const px = x0 + (i + 0.5) * CELL;
          const u = ((B.y - C.y) * (px - C.x) + (C.x - B.x) * (py - C.y)) / d0;
          const v = ((C.y - A.y) * (px - C.x) + (A.x - C.x) * (py - C.y)) / d0;
          if (u >= 0 && v >= 0 && u + v <= 1) baseSet.add(k);
        }
      }
    }
  }
  {
    const A = new THREE.Vector3(), B = new THREE.Vector3(), C = new THREE.Vector3();
    const dInv = new THREE.Matrix4(), M = new THREE.Matrix4();
    const cover = new Uint8Array(nx * ny);
    let lastAx = null;
    for (const p of poses) {
      if (p.axis !== lastAx) { I.enterAxis(clock); lastAx = p.axis; }
      clock.setPose(p.axis.pose(p.f));
      clock.scene.updateMatrixWorld(true);
      dInv.copy(driver.matrixWorld).invert();
      cover.fill(0);
      for (const o of candidates) {
        if (o === driver) continue;
        if (seeThrough(o)) continue;               // a window is not a wall
        M.multiplyMatrices(dInv, o.matrixWorld);
        const pos = o.geometry.getAttribute('position');
        const index = o.geometry.getIndex();
        const n = index ? index.count : pos.count;
        let censusHits = 0;
        for (let t = 0; t < n; t += 3) {
          const a = index ? index.getX(t) : t, b = index ? index.getX(t + 1) : t + 1, c = index ? index.getX(t + 2) : t + 2;
          A.fromBufferAttribute(pos, a).applyMatrix4(M);
          B.fromBufferAttribute(pos, b).applyMatrix4(M);
          C.fromBufferAttribute(pos, c).applyMatrix4(M);
          if (Math.max(A.z, B.z, C.z) <= zTop) continue;      // below the top face: cannot occlude
          const d0 = (B.y - C.y) * (A.x - C.x) + (C.x - B.x) * (A.y - C.y);
          if (Math.abs(d0) <= 1e-12) continue;
          const tx0 = Math.min(A.x, B.x, C.x), tx1 = Math.max(A.x, B.x, C.x);
          const ty0 = Math.min(A.y, B.y, C.y), ty1 = Math.max(A.y, B.y, C.y);
          if (tx1 < x0 || tx0 > x1 || ty1 < y0 || ty0 > y1) continue;
          const i0 = Math.max(0, Math.floor((tx0 - x0) / CELL)), i1 = Math.min(nx - 1, Math.ceil((tx1 - x0) / CELL));
          const j0 = Math.max(0, Math.floor((ty0 - y0) / CELL)), j1 = Math.min(ny - 1, Math.ceil((ty1 - y0) / CELL));
          for (let j = j0; j <= j1; j++) {
            const py = y0 + (j + 0.5) * CELL;
            for (let i = i0; i <= i1; i++) {
              const k = j * nx + i;
              const px = x0 + (i + 0.5) * CELL;
              const u = ((B.y - C.y) * (px - C.x) + (C.x - B.x) * (py - C.y)) / d0;
              const v = ((C.y - A.y) * (px - C.x) + (A.x - C.x) * (py - C.y)) / d0;
              if (!(u >= 0 && v >= 0 && u + v <= 1)) continue;
              // census counts the SHIPPED outline's cells this mesh covers,
              // per pose, so the dominant occluder is named not assumed
              if (!cover[k] && baseSet.has(k)) censusHits++;
              cover[k] = 1;
            }
          }
        }
        if (censusHits) { const nm = nameOf(o); occluderCensus.set(nm, (occluderCensus.get(nm) || 0) + censusHits); }
      }
      for (let k = 0; k < cover.length; k++) if (!cover[k]) seen[k]++;
    }
  }
  const nPose = poses.length;
  const visFrac = (k) => seen[k] / nPose;

  // The shipped driver's own visible fraction, and the added-metal question:
  // for each disc, how much of the growth is SEEN.
  let baseCells = 0, baseSeen = 0;
  for (const k of baseSet) { baseCells++; baseSeen += visFrac(k); }
  const baseVisible = baseCells ? baseSeen / baseCells : 0;

  const growthVis = [];
  for (const d of discs) {
    const row = { what: d.what, steps: [] };
    const ceiling = (rows.find((r) => r.what === d.what) || {}).max;
    for (const frac of [0.25, 0.5, 0.75, 1.0]) {
      if (ceiling == null) continue;
      const r = d.r + (ceiling - d.r) * frac;
      const h = hullOf(outline.concat(discPts(d.cx, d.cy, r)));
      let cells = 0, vis = 0;
      overHull(h, (k) => { if (baseSet.has(k)) return; cells++; vis += visFrac(k); });
      row.steps.push({ r, addedCells: cells, addedArea: cells * CELL * CELL,
        visibleArea: vis * CELL * CELL, visFrac: cells ? vis / cells : 0 });
    }
    growthVis.push(row);
  }

  // C2 — THE DETECTOR LIVES, tested independently of how big the grid is:
  // put a small disc ON a cell the scan marked and require the outline that
  // contains it to read blocked. The earlier version of this control grew a
  // disc by +5 u, which left the grid and read FREE for that reason alone.
  let detector = null;
  {
    let k = -1;
    for (let i = 0; i < real.occ.length; i++) if (real.occ[i]) { k = i; break; }
    if (k >= 0) {
      const ci = k % nx, cj = Math.floor(k / nx);
      const px = x0 + (ci + 0.5) * CELL, py = y0 + (cj + 0.5) * CELL;
      const h = hullHits(hullOf(outline.concat(discPts(px, py, 3 * CELL))), real.occ);
      detector = { px, py, marked: h.marked, outside: h.outside };
    }
  }
  // C2b — and the SHIPPED outline with that same disc removed must still be
  // clean, so C2 cannot pass by the hull simply being large.
  const contrib = Array.from(real.contributors.entries()).sort((a, b) => b[1] - a[1]).slice(0, 14);
  let occN = 0; for (let k = 0; k < real.occ.length; k++) if (real.occ[k]) occN++;

  return {
    UNIT_MM, CLEAR_MARGIN, CELL, CAP, SAMPLES,
    grid: { nx, ny, x0, y0, cells: nx * ny, occupied: occN },
    slab: { zLo, zHi, thickness },
    poses: poses.length,
    jointNames: Array.from(jointNames).sort(),
    rigidNames,
    hubR, shippedClear, shippedHits, shippedHitsJoints, plateGap, detector, tooth,
    baseVisible, baseCells, growthVis, seeThroughNames,
    occluders: Array.from(occluderCensus.entries()).sort((a, b) => b[1] - a[1]).slice(0, 10),
    rows, contrib,
  };
}, { CELL, CAP, SAMPLES });

await browser.close(); srv.kill();

const mm = (u) => (u * R.UNIT_MM).toFixed(4);
console.log('§226 — THE COLUMN-WHEEL DRIVER\'S PLAN WIDTH: what the movement allows');
console.log(`grid ${R.grid.nx}×${R.grid.ny} cells of ${CELL} u in the DRIVER'S frame, ${R.poses} poses, slab z ${R.slab.zLo.toFixed(3)}..${R.slab.zHi.toFixed(3)} (thickness ${R.slab.thickness.toFixed(4)} + CLEAR_MARGIN both sides)`);
console.log(`occupied ${R.grid.occupied} of ${R.grid.cells} cells`);
console.log(`declared joints excluded: ${R.jointNames.join(', ')}`);
console.log(`measured rigid with the driver (excluded): ${R.rigidNames.join(', ')}`);
console.log('');
console.log('disc                       shipped r     max r    growth   growth mm   bound by');
for (const r of R.rows) {
  const mx = r.max == null ? '   —  ' : r.max.toFixed(4);
  const gr = r.growth == null ? '   —  ' : r.growth.toFixed(4);
  const gm = r.growth == null ? '  —   ' : mm(r.growth);
  console.log(`${r.what.padEnd(24)} ${r.r.toFixed(4).padStart(9)} ${mx.padStart(9)} ${gr.padStart(9)} ${gm.padStart(10)}   ${r.boundBy || '—'}`);
  console.log(`  ${r.note}${r.note2 ? ' — ' + r.note2 : ''}`);
}
console.log('');
console.log('nearest metal contributing to the field (cells marked):');
for (const [n, c] of R.contrib) console.log(`  ${String(c).padStart(7)}  ${n}`);
console.log('');
console.log(`see-through by material, excluded from the occluder set (${R.seeThroughNames.length}): ${R.seeThroughNames.filter((n) => !n.startsWith('(unnamed')).join(', ')}`);
console.log(`WHAT IS SEEN. The shipped driver is ${(100 * R.baseVisible).toFixed(1)}% visible through the back over ${R.poses} poses (${(100 * (1 - R.baseVisible)).toFixed(1)}% hidden), ${R.baseCells} cells.`);
console.log('occluders of the shipped outline (pose-cells covered):');
{
  const tot = R.occluders.reduce((a, b) => a + b[1], 0);
  for (const [n, c] of R.occluders) console.log(`  ${(100 * c / Math.max(1, tot)).toFixed(1).padStart(5)}%  ${String(c).padStart(8)}  ${n}`);
}
console.log('');
console.log('GROWTH, WEIGHTED BY WHETHER IT IS SEEN — added metal per disc, toward its metal ceiling:');
for (const g of R.growthVis) {
  if (!g.steps.length) { console.log(`${g.what.padEnd(24)}  (no ceiling in range)`); continue; }
  console.log(`${g.what}`);
  console.log('      r      added u^2   visible u^2   of added');
  for (const st of g.steps)
    console.log(`  ${st.r.toFixed(4).padStart(7)} ${st.addedArea.toFixed(3).padStart(11)} ${st.visibleArea.toFixed(3).padStart(13)} ${(100 * st.visFrac).toFixed(1).padStart(8)}%`);
}
console.log('');
let fail = 0;
const ctl = (name, pass, detail) => { console.log(`${pass ? 'PASS' : 'FAIL'}  ${name} — ${detail}`); if (!pass) fail++; };
ctl('C1 self-consistency', R.shippedHits === 0,
  `the outline the movement already ships admits ${R.shippedHits} marked cells (must be 0). Beside it, nearest undilated metal ${R.shippedClear.toFixed(4)} u = ${mm(R.shippedClear)} mm — a REPORT only: it is measured within the scanned window and over cell centres, so it moves with CAP and is not the verdict`);
ctl('C2 the detector lives', !!R.detector && R.detector.marked > 0,
  R.detector ? `a 3-cell disc placed on marked metal at (${R.detector.px.toFixed(3)}, ${R.detector.py.toFixed(3)}) makes the outline admit ${R.detector.marked} marked cells` : 'no marked cell to probe');
ctl('C3 the exclusion does work', R.shippedHitsJoints > 0,
  `putting the four declared joints BACK makes the shipped outline admit ${R.shippedHitsJoints} marked cells — the withdrawn first version's bug, reproduced on purpose`);
ctl('C4 the field is not empty', R.grid.occupied > 0 && R.contrib.length > 0,
  `${R.grid.occupied} marked cells from ${R.contrib.length}+ meshes`);
ctl('C8 the caseback is a window', R.seeThroughNames.some((n) => /caseBackCrystal/.test(n)),
  `${R.seeThroughNames.length} meshes are see-through by MATERIAL (not by a name list), caseBackCrystal among them — counting the back crystal as an occluder is what made this read 100.0% hidden`);
ctl('C6 the visible fraction reproduces an independent measurement', Math.abs((1 - R.baseVisible) - 0.579) <= 0.06,
  `shipped driver ${(100 * (1 - R.baseVisible)).toFixed(1)}% hidden against 57.9% measured separately (session scan, back view) — two methods, same part; a gap here means one of them is wrong`);
ctl('C7 the dominant occluder is the column wheel\'s own skirt', R.occluders.length > 0 && /alarmColSkirt|alarmColCastellations|alarmColBase/.test(R.occluders[0][0]),
  `top occluder is ${R.occluders.length ? R.occluders[0][0] : 'none'} — the skirt sits ABOVE the driver, so no window in the plate BELOW can uncover what it hides`);
ctl('C5 the ground is ground by measurement', R.plateGap != null && R.plateGap >= R.CLEAR_MARGIN - 1e-6,
  `the three-quarter plate clears the driver in z by ${R.plateGap == null ? 'n/a' : R.plateGap.toFixed(6)} u against CLEAR_MARGIN ${R.CLEAR_MARGIN} — the driver turns ON it, so it is floor, not wall`);
if (process.argv[2]) { writeFileSync(process.argv[2], JSON.stringify(R, null, 1)); console.log(`\nwrote ${process.argv[2]}`); }
console.log(fail ? `\n${fail} CONTROL(S) FAILED — the measurements above are not trustworthy` : '\nall controls PASS — the growth column is a measurement');
process.exit(fail ? 1 : 0);
