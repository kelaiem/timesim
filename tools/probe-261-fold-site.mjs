// WHERE CAN THE ALARM SWITCH STAND UNDER THE DIAL? — §261 step 4's siting
// study, landing one of the fold: the whole switch-and-lock cluster carried to
// the dial side of the base plate, tried at every rotation about the striking
// wheel's arbor, and tested against the band's tenants over the pose net.
//
// REPORT with fatal controls (exit 2 when a control fails). It moves no metal.
// The owner's two calls fix its shape (2026-10-11): the lock keeps braking the
// STRIKING WHEEL, whose arbor is carried down through the base plate to a stop
// wheel in the dial band, and the fold is PROVEN in free space before it is
// swapped in. A cluster rigidly carried about the arbor it brakes keeps every
// row of the switch's and the lock's line specs — azimuth about a mesh point is
// one of the fold's position-space currencies (CLAUDE.md) — so the one free
// variable here is that rotation, φ, and the question is which φ the band
// leaves room for.
//
// METHOD.
//  · THE BAND: `dialBandScan` (tools/dial-band-scan.mjs, probe-261-dial-band's
//    own scan, every mesh owned by its NEAREST label) with the three units the
//    fold moves EXCLUDED — the switch, the
//    lock and the link (the link is re-routed by the fold and its dial-side
//    shaft goes with it). Everything else under the dial is a tenant, over the
//    pose net, with the plate's dial face and the dial's back as the walls.
//  · THE CLUSTER: every mesh of the switch and lock units except the pusher
//    (whose stem runs between the plates today and must be re-routed in the
//    band — it is reported as a LINE below, not carried as metal), plus the
//    stop wheel the lock brakes. Its surface is sampled at STEP over its own
//    motions — §152's digest net, a whole press stroke, both toggle parities and
//    a turn of the striking train — and the union is the swept cloud.
//  · THE FOLD: the cloud is mirrored through the plate, the cluster's floor
//    (the three-quarter plate's top, read off a post planted in it) landing on
//    the base plate's dial face, and turned by φ about the arbor's axis (the
//    stop wheel's cut outline's centroid). Plan is unchanged by the mirror;
//    the teeth's HAND is not, and re-cutting them is the build's business, not
//    the siting's.
//  · THE TEST: a folded point conflicts if it stands within CLEAR_MARGIN of an
//    occupied interval in its own cell or in the cells a margin away from it
//    in plan, below the dial's back plus a margin, or past the case wall less a
//    margin. Points above the plate's dial face are IN the plate — the posts
//    and studs planted in the three-quarter plate today are planted in the base
//    plate after the fold — and are not conflicts.
//  · THE PUSHER, as a line: the pin's line of travel over the press, folded with
//    the cluster and run outward from its rest until it meets the case wall;
//    reported is where it meets the case (azimuth) and whether a stem of the
//    pusher's own section clears the band along it at the driver's folded z.
//    Then THE TRADE: the rotations whose line is direct (no tenant on it), and
//    which of those the cluster also fits at. The line is fixed to the
//    cluster, so where the two sets do not meet the fold owes the pusher a
//    corner — a fold-added part (CLAUDE.md's corners/idlers currency).
//  · THE LINK, as a distance: from the folded column wheel's axis to the
//    selector ring's — the run the re-routed link has to make.
//  · BETWEEN THE PLATES (the owner's call for landing 2: the button stays
//    there, its riser dropping through the base plate): the same scan with
//    the base plate's top face and the three-quarter plate's underside as
//    walls, the folded pin's line run at every stratum a stem of its own
//    section fits, and the riser's drop checked in both bands.
//  · THE CORNER: a bell crank from today's stem (proven clear by K5) to the
//    folded pin. Its pivot is forced, where the normals through the two pins
//    meet, so what is reported is where that lands, its arm ratio, whether it
//    pushes the pawl, and the tallest z window each arm's swing leaves free in
//    either band. No section is assumed; a window only bounds one.
//
// CONTROLS (fatal):
//  K1 the pivot: the stop wheel's samples stand in its own annulus about the
//     arbor's axis at every pose, so the rotation turns the cluster about the
//     part it brakes.
//  K2 the exclusion took: meshes were excluded, no cell lists a moved unit as a
//     tenant, and the selector (which stays) is a tenant somewhere.
//  K3 the detector fires: a sliver of metal planted at one folded point of the
//     best rotation makes that rotation conflict, and the same sliver planted
//     in the same ring OFF the cluster's folded footprint does not. (The first
//     draft planted it eight cells out radially — four units, still under a
//     cluster six across, and the control failed on the cluster's own metal.)
//  K4 the cloud is swept: it holds more points than the cluster at rest, and
//     the lock's finger stands in different cells at the two parities.
//  K5 the line test finds a line where one exists: today's own stem, unfolded
//     at its own stratum, reads clear between the plates and leaves the case
//     at its own azimuth (it is the shipped stem, green in every gate).
//  K6 and a block where one exists: a sliver planted on that line blocks it.
//  K7 the between-plates band reads its walls, and today's stem stands in it.
//
// Run from tools/: node probe-261-fold-site.mjs
import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { dialBandScan } from './dial-band-scan.mjs';
const ROOT = process.env.ROOT || join(dirname(fileURLToPath(import.meta.url)), '..');
const PORT = 8596;
const srv = spawn('python3', ['-m', 'http.server', String(PORT), '--bind', '127.0.0.1'], { cwd: ROOT, stdio: 'ignore' });
process.on('exit', () => { try { srv.kill(); } catch {} });
await new Promise((r) => setTimeout(r, 1200));
const browser = await chromium.launch();
const page = await browser.newPage();
await page.goto(`http://127.0.0.1:${PORT}/index.html`, { waitUntil: 'load', timeout: 300000 });
await page.waitForFunction(() => !!window.__clock || !!window.__bootError, null, { timeout: 300000 });
const bootError = await page.evaluate(() => (window.__bootError ? String(window.__bootError) : null));
if (bootError) { console.log('boot failed: ' + bootError); process.exit(2); }

const GRID = { DR: 0.5, DAZ_DEG: 2.5 };
const MOVED = ['Alarm switch', 'Alarm lock', 'Alarm link'];
const band = await page.evaluate(dialBandScan, { GRID, exclude: MOVED });
// the stratum the pusher's stem keeps (the owner's call for landing 2: the
// button stays between the plates and its riser drops through the base plate)
const inter = await page.evaluate(dialBandScan, { GRID, exclude: MOVED, band: 'interplate' });

// ---- the cluster's swept cloud ---------------------------------------------
const cl = await page.evaluate(async () => {
  const THREE = await import('three');
  const I = await import('./src/inspect.js');
  const L = await import('./src/layout.js');
  const clock = window.__clock;
  const STEP = 0.25, Q = 0.05;                       // sample pitch on each triangle; dedupe lattice
  const members = [];
  let collar = null, riser = null, driver = null, skirt = null, post = null, pad = null, stem = null;
  // membership by NEAREST label (§40's hops rule, as the band's scan owns its
  // meshes): a plain subtree walk would count a nested unit's meshes twice, or
  // carry another unit nested inside the switch along with it
  const labelOf = new Map();
  for (const e of clock.labelEntries) if (!labelOf.has(e.obj)) labelOf.set(e.obj, e.name);
  const nearest = (o) => { for (let p = o; p; p = p.parent) if (labelOf.has(p)) return labelOf.get(p); return null; };
  const taken = new Set();
  for (const e of clock.labelEntries) {
    if (e.name !== 'Alarm switch' && e.name !== 'Alarm lock') continue;
    e.obj.traverse((o) => {
      if (!o.isMesh || o.userData.schematic || taken.has(o) || nearest(o) !== e.name) return;
      taken.add(o);
      if (o.name === 'alarmPusherRiser') riser = o;
      if (o.name === 'alarmPusherStem') stem = o;
      if (/^alarmPusher/.test(o.name)) return;        // the pusher is a line, below
      if (o.name === 'alarmColDriver') driver = o;
      if (o.name === 'alarmColSkirt') skirt = o;
      if (o.name === 'alarmLockBeakRiser') post = o;
      if (o.name === 'alarmLockPad') pad = o;
      members.push(o);
    });
  }
  clock.scene.traverse((o) => { if (!collar && o.isMesh && o.name === 'alarmLockCollar' && !o.userData.schematic) collar = o; });
  if (collar && !taken.has(collar)) members.push(collar);
  const v = new THREE.Vector3();
  const outlineCentre = (mesh) => {
    const sh = mesh.geometry.parameters?.shapes; const shp = Array.isArray(sh) ? sh[0] : sh;
    const p = shp.getPoints(); const ring = p.length > 1 && p[0].distanceTo(p[p.length - 1]) < 1e-9 ? p.slice(0, -1) : p;
    mesh.updateWorldMatrix(true, false);
    const c = new THREE.Vector3(); for (const q of ring) c.add(new THREE.Vector3(q.x, q.y, 0).applyMatrix4(mesh.matrixWorld));
    return c.multiplyScalar(1 / ring.length);
  };
  const boxOf = (m) => new THREE.Box3().setFromObject(m);
  const centre = (m) => { const b = boxOf(m); return { x: (b.min.x + b.max.x) / 2, y: (b.min.y + b.max.y) / 2, z0: b.min.z, z1: b.max.z }; };
  const cloud = new Map();                           // lattice key → [x, y, z, memberIndex]
  const sample = (tag) => {
    clock.scene.updateMatrixWorld(true);
    let added = 0;
    members.forEach((m, mi) => {
      const g = m.geometry, pos = g.attributes.position, idx = g.index;
      const n = pos.count, W = new Float64Array(n * 3);
      for (let i = 0; i < n; i++) { v.fromBufferAttribute(pos, i).applyMatrix4(m.matrixWorld); W[3 * i] = v.x; W[3 * i + 1] = v.y; W[3 * i + 2] = v.z; }
      const T = idx ? idx.count / 3 : n / 3;
      for (let t = 0; t < T; t++) {
        const a = idx ? idx.getX(3 * t) : 3 * t, b = idx ? idx.getX(3 * t + 1) : 3 * t + 1, c = idx ? idx.getX(3 * t + 2) : 3 * t + 2;
        const L0 = Math.max(Math.hypot(W[3*b]-W[3*a], W[3*b+1]-W[3*a+1], W[3*b+2]-W[3*a+2]), Math.hypot(W[3*c]-W[3*a], W[3*c+1]-W[3*a+1], W[3*c+2]-W[3*a+2]), Math.hypot(W[3*c]-W[3*b], W[3*c+1]-W[3*b+1], W[3*c+2]-W[3*b+2]));
        const s = Math.max(1, Math.ceil(L0 / STEP));
        for (let i = 0; i <= s; i++) for (let j = 0; j <= s - i; j++) {
          const u = i / s, w = j / s;
          const x = W[3*a] + (W[3*b]-W[3*a]) * u + (W[3*c]-W[3*a]) * w;
          const y = W[3*a+1] + (W[3*b+1]-W[3*a+1]) * u + (W[3*c+1]-W[3*a+1]) * w;
          const z = W[3*a+2] + (W[3*b+2]-W[3*a+2]) * u + (W[3*c+2]-W[3*a+2]) * w;
          const key = `${Math.round(x / Q)},${Math.round(y / Q)},${Math.round(z / Q)}`;
          if (!cloud.has(key)) { cloud.set(key, [x, y, z, mi]); added++; }
        }
      }
    });
    return added;
  };
  // the poses: the digest net, a whole press, both parities, a turn of the strike
  const poses = [];
  for (const p of I.digestPoses(clock)) poses.push({ axis: null, p });
  const ax = (n) => I.AXES.find((a) => a.name === n);
  for (let i = 0; i <= 32; i++) poses.push({ axis: 'alarmPress', p: ax('alarmPress').pose(i / 32) });
  for (const f of [0, 0.5]) poses.push({ axis: 'alarmToggle', p: ax('alarmToggle').pose(f) });
  for (let i = 0; i < 24; i++) poses.push({ axis: 'alarmStrike', p: ax('alarmStrike').pose(i / 24, clock) });
  // rest first, so K4 can compare the swept union against it
  I.enterAxis(clock); clock.resetInputs(); clock.setPose({});
  const atRest = sample('rest');
  const padCell = {};
  for (const { axis, p } of poses) {
    I.enterAxis(clock); clock.resetInputs(); clock.setPose(p);
    sample(axis || 'net');
  }
  for (const f of [0, 0.5]) { I.enterAxis(clock); clock.setPose(ax('alarmToggle').pose(f)); clock.scene.updateMatrixWorld(true); padCell[f] = centre(pad); }
  // the pivot, the floor, the pin's line, the driver's band, the wheel's axis
  I.enterAxis(clock); clock.resetInputs(); clock.setPose({}); clock.scene.updateMatrixWorld(true);
  const A = outlineCentre(collar);
  const W = outlineCentre(skirt);
  const zBase = boxOf(post).min.z;                   // the beak riser is planted in the three-quarter plate: its foot IS the plate's top
  const pin = [];
  for (const f of [0, 0.5]) { I.enterAxis(clock); clock.setPose(ax('alarmPress').pose(f)); clock.scene.updateMatrixWorld(true); pin.push(centre(riser)); }
  I.enterAxis(clock); clock.resetInputs(); clock.setPose({}); clock.scene.updateMatrixWorld(true);
  const drv = centre(driver);
  const stemBox = boxOf(stem);
  // the stop wheel's annulus about A, over every pose, for K1
  const collarIdx = members.indexOf(collar);
  let cMin = Infinity, cMax = 0;
  for (const [x, y, , mi] of cloud.values()) if (mi === collarIdx) { const r = Math.hypot(x - A.x, y - A.y); cMin = Math.min(cMin, r); cMax = Math.max(cMax, r); }
  let selector = null; clock.scene.traverse((o) => { if (!selector && o.isMesh && o.name === 'alarmSelRing') selector = o; });
  const sel = centre(selector);
  return {
    points: [...cloud.values()], members: members.map((m) => m.name || m.geometry.type), atRest, poses: poses.length + 1,
    A: { x: A.x, y: A.y }, W: { x: W.x, y: W.y }, zBase, pin, drv, sel,
    stemD: stemBox.max.z - stemBox.min.z,             // a round stem lying in plan: its z extent is its diameter
    stemZ: (stemBox.min.z + stemBox.max.z) / 2,        // its axis, today: the stratum it runs in between the plates
    riserHalf: (() => { const b = boxOf(riser); return Math.min(b.max.x - b.min.x, b.max.y - b.min.y) / 2; })(),
    pushAz: (() => { const b = boxOf(stem); const c = { x: (b.min.x + b.max.x) / 2, y: (b.min.y + b.max.y) / 2 }; return Math.atan2(c.y, c.x); })(),
    collarAnnulus: [cMin, cMax], collarTipR: (() => { const sh = collar.geometry.parameters.shapes; const s = Array.isArray(sh) ? sh[0] : sh; return Math.max(...s.getPoints().map((q) => Math.hypot(q.x, q.y))); })(),
    padCell, CLEAR_MARGIN: L.CLEAR_MARGIN,
  };
});

// ---- the fold, in Node -------------------------------------------------------
const { NR, NA, Z_CEIL, cells } = band;
const CM = cl.CLEAR_MARGIN;
const CASE_R_IN = 44.16;                             // plateR + 1 mm (§186), as probe-261-dial-band reads it
const DEG = Math.PI / 180;
const cellOf = (x, y) => {
  const r = Math.hypot(x, y); if (r >= NR * GRID.DR) return -1;
  let a = Math.atan2(y, x) / DEG; if (a < 0) a += 360;
  return Math.min(NR - 1, Math.floor(r / GRID.DR)) * NA + Math.min(NA - 1, Math.floor(a / GRID.DAZ_DEG));
};
const { A, zBase } = cl;
const fold = (x, y, z, phi) => {                     // mirror through the plate, then turn φ about the arbor
  const c = Math.cos(phi), s = Math.sin(phi), dx = x - A.x, dy = y - A.y;
  return [A.x + c * dx - s * dy, A.y + s * dx + c * dy, Z_CEIL - (z - zBase)];
};
// the cells a margin away in plan: the point's own, and its four plan
// neighbours at ±CM radially and tangentially (a cell is 0.5 × ~1.3 u here)
const nearCells = (x, y) => {
  const r = Math.hypot(x, y) || 1e-9, ux = x / r, uy = y / r;
  const out = new Set();
  for (const [dr, dt] of [[0, 0], [CM, 0], [-CM, 0], [0, CM], [0, -CM]]) {
    const k = cellOf(x + ux * dr - uy * dt, y + uy * dr + ux * dt); if (k >= 0) out.add(k);
  }
  return out;
};
function judge(phi, extra = null) {
  let conflicts = 0, minGap = Infinity;
  const by = {}, gapBy = {};
  for (const [x, y, z] of cl.points) {
    const [X, Y, Z] = fold(x, y, z, phi);
    const r = Math.hypot(X, Y);
    if (r > CASE_R_IN - CM) { conflicts++; by.case = (by.case || 0) + 1; continue; }
    const own = cellOf(X, Y);
    if (own < 0) { conflicts++; by.offGrid = (by.offGrid || 0) + 1; continue; }
    if (Z > cells[own].hi) continue;                 // inside the plate: planted, not a tenant's
    if (Z < cells[own].lo + CM) { conflicts++; by.dial = (by.dial || 0) + 1; continue; }
    for (const k of nearCells(X, Y)) {
      const owned = extra && extra.k === k ? [...cells[k].uivs, ['PLANT', [extra.iv]]] : cells[k].uivs;
      for (const [u, ivs] of owned) for (const [z0, z1] of ivs) {
        const g = Z < z0 ? z0 - Z : Z > z1 ? Z - z1 : -Math.min(Z - z0, z1 - Z);
        if (g < minGap) minGap = g;
        if (!(gapBy[u] <= g)) gapBy[u] = g;
        if (g < CM) { conflicts++; by[u] = (by[u] || 0) + 1; }
      }
    }
  }
  return { phi, conflicts, minGap, by, gapBy };
}
// the pusher's line, folded, run out to the case wall
function pusherLine(phi) {
  const [x0, y0] = fold(cl.pin[0].x, cl.pin[0].y, 0, phi), [x1, y1] = fold(cl.pin[1].x, cl.pin[1].y, 0, phi);
  let dx = x0 - x1, dy = y0 - y1; const L = Math.hypot(dx, dy); dx /= L; dy /= L;   // outward: against the press
  const zDrv = Z_CEIL - ((cl.drv.z0 + cl.drv.z1) / 2 - zBase);
  const rad = cl.stemD / 2;
  let blocked = 0, steps = 0, x = x0, y = y0;
  const owners = {};
  while (Math.hypot(x, y) < CASE_R_IN && steps < 400) {
    steps++;
    let hitU = null;
    for (const k of nearCells(x, y)) for (const [u, ivs] of cells[k].uivs) for (const [z0, z1] of ivs) {
      if (!hitU && zDrv + rad + CM > z0 && zDrv - rad - CM < z1) hitU = u;
    }
    if (hitU) { blocked++; owners[hitU] = (owners[hitU] || 0) + 1; }
    x += dx * 0.25; y += dy * 0.25;
  }
  const hitR = Math.hypot(x, y) >= CASE_R_IN;
  let az = Math.atan2(y, x) / DEG; if (az < 0) az += 360;
  return { exitAz: hitR ? az : null, run: steps * 0.25, blockedSteps: blocked, steps, owners, zDrv };
}
const linkRun = (phi) => { const [x, y] = fold(cl.W.x, cl.W.y, 0, phi); return Math.hypot(x - cl.sel.x, y - cl.sel.y); };

const results = [];
for (let d = 0; d < 360; d++) results.push({ ...judge(d * DEG), deg: d });
const feasible = results.filter((r) => r.conflicts === 0);
const best = [...feasible].sort((a, b) => b.minGap - a.minGap)[0] || null;

// ---- THE PUSHER BETWEEN THE PLATES (landing 2's first question) ---------------
// The owner kept the button between the plates, its riser dropping through the
// base plate to the folded pawl. Landing 1's line test ran in the DIAL band, at
// the folded driver's height, and found no direct line at any φ; between the
// plates the stem runs at a different height past different parts, so the
// question is asked again there, at every stratum the band leaves a stem room
// for. A body of radius `rad` reads a cell a margin plus its radius away in plan.
const IC = inter.cells;
if (inter.NR !== NR || inter.NA !== NA) throw new Error(`the two bands are on different grids: ${inter.NR}×${inter.NA} against ${NR}×${NA}`);
const nearCellsR = (x, y, reach) => {
  const r = Math.hypot(x, y) || 1e-9, ux = x / r, uy = y / r, out = new Set();
  for (const [dr, dt] of [[0, 0], [reach, 0], [-reach, 0], [0, reach], [0, -reach], [reach * 0.7071, reach * 0.7071], [-reach * 0.7071, reach * 0.7071], [reach * 0.7071, -reach * 0.7071], [-reach * 0.7071, -reach * 0.7071]]) {
    const k = cellOf(x + ux * dr - uy * dt, y + uy * dr + ux * dt); if (k >= 0) out.add(k);
  }
  return out;
};
// what blocks a body standing over (x, y) between zA and zB in a band's cells
// (its own walls included: a margin off each plate), or null
const blockerAt = (cellsB, x, y, reach, zA, zB, extra = null, walls = true) => {
  for (const k of nearCellsR(x, y, reach)) {
    const c = cellsB[k];
    if (walls && (zA - CM < c.lo || zB + CM > c.hi)) return 'plate';
    const owned = extra && extra.k === k ? [...c.uivs, ['PLANT', [extra.iv]]] : c.uivs;
    for (const [u, ivs] of owned) for (const [z0, z1] of ivs) if (zB + CM > z0 && zA - CM < z1) return u;
  }
  return null;
};
// a stem of radius rad at height z, from (x0, y0) along (dx, dy) to the case wall
function stemRun(x0, y0, dx, dy, z, rad, extra = null) {
  let blocked = 0, steps = 0, x = x0, y = y0; const owners = {};
  while (Math.hypot(x, y) < CASE_R_IN && steps < 400) {
    steps++;
    const u = blockerAt(IC, x, y, rad, z - rad, z + rad, extra);
    if (u) { blocked++; owners[u] = (owners[u] || 0) + 1; }
    x += dx * 0.25; y += dy * 0.25;
  }
  let az = Math.atan2(y, x) / DEG; if (az < 0) az += 360;
  return { blocked, steps, owners, exitAz: az, run: steps * 0.25 };
}
const rad = cl.stemD / 2;
const zLo = inter.Z_FLOOR + rad + CM, zHi = inter.Z_CEIL - rad - CM;
const strata = []; for (let z = zLo; z <= zHi + 1e-9; z += 0.05) strata.push(z);
// the folded riser: its swept plan stations (rest → pressed), its drop between
// the plates (base plate's top up to the stem) and its column in the dial band
// (the plate's dial face down to where the riser met the pawl's reach today)
const riserDialLen = cl.pin[0].z1 - zBase;            // today it rises this far above the three-quarter plate's top
function riserDrop(phi, z) {
  const [ax0, ay0] = fold(cl.pin[0].x, cl.pin[0].y, 0, phi), [ax1, ay1] = fold(cl.pin[1].x, cl.pin[1].y, 0, phi);
  const reach = cl.riserHalf;
  let inPlates = null, inDial = null;
  for (let t = 0; t <= 1.0001; t += 0.125) {
    const x = ax0 + (ax1 - ax0) * t, y = ay0 + (ay1 - ay0) * t;
    // the riser runs THROUGH the base plate, so neither column is judged against it
    if (!inPlates) inPlates = blockerAt(IC, x, y, reach, inter.Z_FLOOR, z + rad, null, false);
    if (!inDial) { const zTop = band.Z_CEIL; inDial = blockerAt(cells, x, y, reach, zTop - riserDialLen, zTop, null, false); }
  }
  return { inPlates, inDial };
}
const between = feasible.map((r) => {
  const phi = r.deg * DEG;
  const [x0, y0] = fold(cl.pin[0].x, cl.pin[0].y, 0, phi), [x1, y1] = fold(cl.pin[1].x, cl.pin[1].y, 0, phi);
  let dx = x0 - x1, dy = y0 - y1; const L = Math.hypot(dx, dy); dx /= L; dy /= L;
  const runs = strata.map((z) => ({ z, ...stemRun(x0, y0, dx, dy, z, rad) }));
  const clear = runs.filter((q) => q.blocked === 0);
  const best = [...runs].sort((a, b) => a.blocked - b.blocked)[0];
  const pick = clear.length ? clear[Math.floor(clear.length / 2)] : best;   // the middle of the clear strata, or the least blocked
  return { deg: r.deg, clear, best, pick, drop: riserDrop(phi, pick.z) };
});

// ---- THE CORNER: a bell crank from today's stem to the folded pawl ------------
// No feasible φ has a straight stem in either band, so the pusher needs a
// corner. Today's stem is proven clear (K5), so it stays as it is, and a bell
// crank carries its stroke to the folded pin. A crank's geometry is not a
// choice: each arm's end moves square to the arm, so the pivot stands where the
// line through today's pin square to today's press meets the line through the
// folded pin square to the folded press. What this reports is what that
// construction leaves room for — each arm's swept path, and the tallest z
// window free in every cell it sweeps, in each band. No section is assumed;
// the arms' section is derived from their load at design time (P1), and a
// window is only an upper bound on it.
const freeOf = (c) => { const out = []; let p = c.lo; for (const [a, b] of c.ivs) { if (a > p) out.push([p, Math.min(a, c.hi)]); p = Math.max(p, b); } if (c.hi > p) out.push([p, c.hi]); return out; };
const meet = (A, B) => { const out = []; for (const [a0, a1] of A) for (const [b0, b1] of B) { const lo = Math.max(a0, b0), hi = Math.min(a1, b1); if (hi > lo) out.push([lo, hi]); } return out; };
function armWindow(cellsB, Px, Py, Ex, Ey, sweep) {
  // the arm from the pivot to its end, at five angles over its swing
  let win = null; const ks = new Set();
  for (let i = 0; i <= 4; i++) {
    const th = sweep * i / 4, c = Math.cos(th), sn = Math.sin(th);
    const ex = Px + c * (Ex - Px) - sn * (Ey - Py), ey = Py + sn * (Ex - Px) + c * (Ey - Py);
    const L = Math.hypot(ex - Px, ey - Py), n = Math.max(1, Math.ceil(L / 0.25));
    for (let j = 0; j <= n; j++) for (const k of nearCellsR(Px + (ex - Px) * j / n, Py + (ey - Py) * j / n, CM)) ks.add(k);
  }
  for (const k of ks) { win = win === null ? freeOf(cellsB[k]) : meet(win, freeOf(cellsB[k])); if (!win.length) break; }
  const best = (win || []).reduce((m, w) => (w[1] - w[0] > (m ? m[1] - m[0] : 0) ? w : m), null);
  return best;
}
const stroke = Math.hypot(cl.pin[1].x - cl.pin[0].x, cl.pin[1].y - cl.pin[0].y);
const crank = feasible.map((r) => {
  const phi = r.deg * DEG;
  const p0 = cl.pin[0], p1 = cl.pin[1];
  const d0 = { x: (p1.x - p0.x) / stroke, y: (p1.y - p0.y) / stroke };
  const [qx0, qy0] = fold(p0.x, p0.y, 0, phi), [qx1, qy1] = fold(p1.x, p1.y, 0, phi);
  const dq = { x: (qx1 - qx0) / stroke, y: (qy1 - qy0) / stroke };
  // p0 + s·n0 = q0 + t·nq, n = d rotated a quarter turn
  const n0 = { x: -d0.y, y: d0.x }, nq = { x: -dq.y, y: dq.x };
  const det = n0.x * -nq.y - n0.y * -nq.x;
  if (Math.abs(det) < 1e-9) return { deg: r.deg, parallel: true };
  const bx = qx0 - p0.x, by = qy0 - p0.y;
  const sP = (bx * -nq.y - by * -nq.x) / det;
  const Px = p0.x + sP * n0.x, Py = p0.y + sP * n0.y;
  const a1 = Math.hypot(Px - p0.x, Py - p0.y), a2 = Math.hypot(Px - qx0, Py - qy0);
  const sw1 = stroke / a1, sw2 = stroke * (a2 / a1) / a2;            // one swing, both arms (the crank is rigid)
  // turning by +Δ moves a point square to its arm, (−(y−Py), x−Px); the sense
  // that drives today's pin ALONG its press is the one whose motion has a
  // positive dot with d0. The same turn moves the folded pin along +dq (the
  // crank PUSHES the pawl, as the stem does today) or −dq (it would PULL).
  const sgn = Math.sign(-(p0.y - Py) * d0.x + (p0.x - Px) * d0.y) || 1;
  const push = Math.sign(-(qy0 - Py) * dq.x + (qx0 - Px) * dq.y) * sgn > 0;
  const w = { plates: [armWindow(IC, Px, Py, p0.x, p0.y, sgn * sw1), armWindow(IC, Px, Py, qx0, qy0, sgn * sw2)],
              dial: [armWindow(cells, Px, Py, p0.x, p0.y, sgn * sw1), armWindow(cells, Px, Py, qx0, qy0, sgn * sw2)] };
  const pr = Math.hypot(Px, Py);
  return { deg: r.deg, Px, Py, pr, a1, a2, ratio: a2 / a1, push, w };
});

// ---- controls ----------------------------------------------------------------
const fails = [];
const tipR = cl.collarTipR;
if (!(cl.collarAnnulus[1] <= tipR + 0.05 && cl.collarAnnulus[0] > 0)) fails.push(`K1 the stop wheel's samples reach ${cl.collarAnnulus[1].toFixed(4)} from the arbor's axis, past its tip ${tipR.toFixed(4)} — the pivot is not the arbor`);
const tenantUnits = new Set(); for (const c of cells) for (const u of Object.keys(c.units)) tenantUnits.add(u);
const leaked = MOVED.filter((u) => tenantUnits.has(u));
if (!(band.excludedMeshes > 0) || leaked.length || !tenantUnits.has('Alarm selector'))
  fails.push(`K2 the exclusion: ${band.excludedMeshes} meshes excluded, moved units still tenant: [${leaked.join(', ')}], selector a tenant: ${tenantUnits.has('Alarm selector')}`);
let k3 = 'not run';
{
  const trial = best || results.reduce((a, b) => (a.conflicts < b.conflicts ? a : b));
  const [x, y, z] = cl.points[Math.floor(cl.points.length / 2)];
  const [X, Y, Z] = fold(x, y, z, trial.deg * DEG);
  const k = cellOf(X, Y);
  const hit = judge(trial.deg * DEG, { k, iv: [Z - 0.01, Z + 0.01] });
  // the far plant: the same sliver in the first cell of the same ring that no
  // folded point reaches, even a margin away — off the cluster's footprint,
  // where nothing of the cluster can see it
  const foot = new Set();
  for (const [px, py, pz] of cl.points) { const [FX, FY] = fold(px, py, pz, trial.deg * DEG); for (const q of nearCells(FX, FY)) foot.add(q); }
  const ring = Math.floor(k / NA);
  let kFar = -1;
  for (let i = 1; i < NA && kFar < 0; i++) { const q = ring * NA + ((k % NA) + i) % NA; if (!foot.has(q) && !foot.has(q - NA) && !foot.has(q + NA)) kFar = q; }
  const far = kFar < 0 ? { by: { PLANT: Infinity } } : judge(trial.deg * DEG, { k: kFar, iv: [Z - 0.01, Z + 0.01] });
  const plantedFar = (far.by.PLANT || 0);
  const farAz = kFar < 0 ? '—' : (((kFar % NA) + 0.5) * GRID.DAZ_DEG).toFixed(1);
  k3 = `planted at φ ${trial.deg}°: ${hit.by.PLANT || 0} conflicts on the sliver; the same sliver off the footprint (ring ${ring}, az ${farAz}°): ${plantedFar}`;
  if (!((hit.by.PLANT || 0) > 0) || plantedFar > 0) fails.push(`K3 the detector: ${k3}`);
}
// K5 the line test finds a line where one exists: TODAY'S pusher, unfolded, at
// its own stratum, runs clear between the plates to the case wall (it is the
// shipped stem, green in every gate) and leaves at its own azimuth. K6 it finds
// a block where one exists: a sliver planted on that same line blocks it.
let k5 = 'not run', k6 = 'not run';
{
  const { x: x0, y: y0 } = cl.pin[0], { x: x1, y: y1 } = cl.pin[1];
  let dx = x0 - x1, dy = y0 - y1; const L = Math.hypot(dx, dy); dx /= L; dy /= L;
  const today = stemRun(x0, y0, dx, dy, cl.stemZ, rad);
  let pushAz = cl.pushAz / DEG; if (pushAz < 0) pushAz += 360;
  const dAz = Math.abs(((today.exitAz - pushAz + 540) % 360) - 180);
  k5 = `today's stem, unfolded at z ${cl.stemZ.toFixed(3)}: ${today.blocked} of ${today.steps} steps blocked${today.blocked ? ' by ' + Object.entries(today.owners).map(([u, n]) => `${u} ${n}`).join(', ') : ''}, leaves at az ${today.exitAz.toFixed(1)}° (the stem's own ${pushAz.toFixed(1)}°)`;
  if (today.blocked || dAz > 3) fails.push(`K5 the line test: ${k5}`);
  const mx = x0 + dx * 0.25 * Math.floor(today.steps / 2), my = y0 + dy * 0.25 * Math.floor(today.steps / 2);
  const planted = stemRun(x0, y0, dx, dy, cl.stemZ, rad, { k: cellOf(mx, my), iv: [cl.stemZ - 0.01, cl.stemZ + 0.01] });
  k6 = `a sliver planted mid-line blocks ${planted.owners.PLANT || 0} step(s)`;
  if (!((planted.owners.PLANT || 0) > 0)) fails.push(`K6 the line test's detector: ${k6}`);
}
// K7 the between-plates band reads its walls, and today's stem stands inside it
const k7 = `band z ${inter.Z_FLOOR.toFixed(3)} .. ${inter.Z_CEIL.toFixed(3)} (${(inter.Z_CEIL - inter.Z_FLOOR).toFixed(3)} u); strata for a stem of ⌀ ${cl.stemD.toFixed(3)}: ${zLo.toFixed(3)} .. ${zHi.toFixed(3)}; today's stem axis ${cl.stemZ.toFixed(3)}`;
if (!(inter.Z_CEIL > inter.Z_FLOOR) || !(cl.stemZ > inter.Z_FLOOR && cl.stemZ < inter.Z_CEIL) || inter.excludedMeshes <= 0) fails.push(`K7 the between-plates band: ${k7}`);
const padMoved = Math.hypot(cl.padCell[0].x - cl.padCell[0.5].x, cl.padCell[0].y - cl.padCell[0.5].y);
if (!(cl.points.length > cl.atRest) || !(padMoved > 0.05)) fails.push(`K4 the sweep: ${cl.points.length} swept vs ${cl.atRest} at rest; the finger moved ${padMoved.toFixed(4)}`);

// ---- report --------------------------------------------------------------------
const f = (x, d = 3) => (Number.isFinite(x) ? x.toFixed(d) : String(x));
const azOf = (p) => { let a = Math.atan2(p.y, p.x) / DEG; if (a < 0) a += 360; return a; };
console.log(`§261 step 4 — the fold's siting: the switch and lock under the dial, turned about the striking arbor`);
console.log(`  band: ${band.poses} poses, ${band.tenantsCount} tenant meshes (${band.excludedMeshes} excluded: ${MOVED.join(', ')}); plate's dial face z ${f(Z_CEIL)}`);
console.log(`  cluster: ${cl.members.length} meshes, ${cl.points.length} swept samples over ${cl.poses} poses (${cl.atRest} at rest)`);
console.log(`  arbor axis (${f(A.x)}, ${f(A.y)}) r ${f(Math.hypot(A.x, A.y))} az ${f(azOf(A), 1)}°; cluster floor z ${f(zBase)} → plate face ${f(Z_CEIL)}`);
const runs = []; { let s = null; for (const r of results) { if (r.conflicts === 0) { if (s === null) s = r.deg; } else if (s !== null) { runs.push([s, r.deg - 1]); s = null; } } if (s !== null) runs.push([s, 359]); }
console.log(`  feasible rotations: ${feasible.length} of 360 — ${runs.map(([a, b]) => (a === b ? `${a}°` : `${a}–${b}°`)).join(', ') || 'none'}`);
const show = (r) => {
  const pl = pusherLine(r.deg * DEG);
  const [wx, wy] = fold(cl.W.x, cl.W.y, 0, r.deg * DEG);
  return `φ ${String(r.deg).padStart(3)}°  conflicts ${String(r.conflicts).padStart(6)}  min gap ${f(r.minGap)}  wheel at r ${f(Math.hypot(wx, wy), 2)} az ${f(azOf({ x: wx, y: wy }), 1)}°`
    + `  link run ${f(linkRun(r.deg * DEG), 2)}  pusher exits az ${pl.exitAz === null ? '—' : f(pl.exitAz, 1)}° after ${f(pl.run, 2)}, blocked ${pl.blockedSteps}/${pl.steps}`
    + (pl.blockedSteps ? ` by ${Object.entries(pl.owners).sort((a, b) => b[1] - a[1]).slice(0, 2).map(([u, n]) => `${u} ${n}`).join(', ')}` : '')
    + `\n          nearest: ${Object.entries(r.gapBy).sort((a, b) => a[1] - b[1]).slice(0, 4).map(([u, g]) => `${u} ${f(g)}`).join(', ')}`
    + (r.conflicts ? `  — ${Object.entries(r.by).sort((a, b) => b[1] - a[1]).slice(0, 3).map(([u, n]) => `${u} ${n}`).join(', ')}` : '');
};
console.log(`\n  the best ten by margin${feasible.length ? '' : ' (none is feasible: the least-conflicted ten)'}:`);
const ranked = feasible.length ? [...feasible].sort((a, b) => b.minGap - a.minGap) : [...results].sort((a, b) => a.conflicts - b.conflicts);
for (const r of ranked.slice(0, 10)) console.log('    ' + show(r));
// THE PUSHER'S TRADE: which rotations give the pusher a DIRECT line (no tenant
// on it, out to the case), and what those rotations collide with. A rigid fold
// keeps the pin's line of travel fixed to the cluster, so the pusher is only
// straight where the line happens to face out; anywhere else it needs a
// fold-added corner, which is a real part with its own P1 duties.
const direct = results.map((r) => ({ r, pl: pusherLine(r.deg * DEG) })).filter(({ pl }) => pl.exitAz !== null && pl.steps > 0 && pl.blockedSteps === 0);   // steps 0: the pin already stands past the case wall, which is no line at all
const dRuns = []; { let s0 = null, prev = null; for (const { r } of direct) { if (s0 === null) s0 = r.deg; else if (r.deg !== prev + 1) { dRuns.push([s0, prev]); s0 = r.deg; } prev = r.deg; } if (s0 !== null) dRuns.push([s0, prev]); }
const both = direct.filter(({ r }) => r.conflicts === 0);
console.log(`\n  the pusher's trade: a DIRECT line (from inside the case, unblocked to its wall) at ${direct.length} of 360 rotations — ${dRuns.map(([a, b]) => (a === b ? `${a}°` : `${a}–${b}°`)).join(', ') || 'none'}; feasible AND direct: ${both.length ? both.map(({ r }) => r.deg + '°').join(', ') : 'none'}`);
if (direct.length) {
  const least = [...direct].sort((a, b) => a.r.conflicts - b.r.conflicts)[0];
  console.log(`    the least-conflicted direct rotation: ${show(least.r)}`);
}
// the pusher between the plates, per feasible rotation
const ranges = (zs) => { const out = []; let a = null, p = null; for (const z of zs) { if (a === null) a = z; else if (z - p > 0.051) { out.push([a, p]); a = z; } p = z; } if (a !== null) out.push([a, p]); return out; };
const fz = (z) => z.toFixed(2);
console.log(`\n  the pusher BETWEEN THE PLATES (band z ${fz(inter.Z_FLOOR)} .. ${fz(inter.Z_CEIL)}, ${inter.tenantsCount} tenant meshes; a stem of ⌀ ${f(cl.stemD)} at any stratum ${fz(zLo)} .. ${fz(zHi)}; today's at ${fz(cl.stemZ)}):`);
for (const b of between) {
  const rs = ranges(b.clear.map((q) => q.z));
  const p = b.pick;
  console.log(`    φ ${String(b.deg).padStart(3)}°  ${b.clear.length ? `CLEAR at z ${rs.map(([a, c]) => (a === c ? fz(a) : `${fz(a)}–${fz(c)}`)).join(', ')}` : `no clear stratum; least blocked ${p.blocked}/${p.steps} at z ${fz(p.z)} by ${Object.entries(p.owners).sort((x, y) => y[1] - x[1]).slice(0, 2).map(([u, n]) => `${u} ${n}`).join(', ')}`}`
      + `  → case at az ${f(p.exitAz, 1)}° after ${f(p.run, 2)}; riser drop: plates ${b.drop.inPlates || 'clear'}, dial band ${b.drop.inDial || 'clear'}`);
}
const direct2 = between.filter((b) => b.clear.length && !b.drop.inPlates && !b.drop.inDial);
console.log(`    feasible, a straight stem between the plates, and a clear riser drop: ${direct2.length ? direct2.map((b) => b.deg + '°').join(', ') : 'none'}`);
const fw = (w) => (w ? `${fz(w[0])}..${fz(w[1])} (${(w[1] - w[0]).toFixed(2)})` : 'none');
console.log(`\n  THE CORNER: a bell crank from today's stem (pin at r ${f(Math.hypot(cl.pin[0].x, cl.pin[0].y), 2)}, stroke ${f(stroke)}) to the folded pin — pivot where the two arms' normals meet; free z window per arm (today's arm, folded arm):`);
for (const c of crank) {
  if (c.parallel) { console.log(`    φ ${String(c.deg).padStart(3)}°  the two presses are parallel: no crank`); continue; }
  const off = c.pr > CASE_R_IN - CM ? '  PIVOT OUTSIDE THE CASE' : '';
  console.log(`    φ ${String(c.deg).padStart(3)}°  pivot r ${f(c.pr, 2)}${off}  ${c.push ? 'push' : 'PULL'}  arms ${f(c.a1, 2)} / ${f(c.a2, 2)} (ratio ${f(c.ratio, 3)})  plates ${fw(c.w.plates[0])} | ${fw(c.w.plates[1])}  dial ${fw(c.w.dial[0])} | ${fw(c.w.dial[1])}`);
}
console.log(`\n  every 30°, for the shape of it:`);
for (let d = 0; d < 360; d += 30) console.log('    ' + show(results[d]));
console.log(`\n  controls:`);
console.log(`    K1 the stop wheel stays in its annulus about the arbor: ${f(cl.collarAnnulus[0])}–${f(cl.collarAnnulus[1])} (tip ${f(tipR)})`);
console.log(`    K2 ${band.excludedMeshes} meshes excluded; no moved unit is a tenant; the selector is a tenant`);
console.log(`    K3 ${k3}`);
console.log(`    K5 ${k5}`);
console.log(`    K6 ${k6}`);
console.log(`    K7 ${k7}`);
console.log(`    K4 ${cl.points.length} swept samples against ${cl.atRest} at rest; the finger moves ${f(padMoved, 4)} between parities`);
if (fails.length) { console.log('\nCONTROL FAILED:\n  ' + fails.join('\n  ')); process.exit(2); }
console.log(`\nREPORT — controls pass; ${feasible.length ? `${feasible.length} feasible rotation(s)` : 'NO rotation of the rigid cluster fits the band as it stands'}`);
process.exit(0);
