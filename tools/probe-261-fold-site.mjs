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
//    own scan) with the three units the fold moves EXCLUDED — the switch, the
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
//  · THE LINK, as a distance: from the folded column wheel's axis to the
//    selector ring's — the run the re-routed link has to make.
//
// CONTROLS (fatal):
//  K1 the pivot: the stop wheel's samples stand in its own annulus about the
//     arbor's axis at every pose, so the rotation turns the cluster about the
//     part it brakes.
//  K2 the exclusion took: meshes were excluded, no cell lists a moved unit as a
//     tenant, and the selector (which stays) is a tenant somewhere.
//  K3 the detector fires: a sliver of metal planted at one folded point of the
//     best rotation makes that rotation conflict, and the same sliver a cell
//     away does not.
//  K4 the cloud is swept: it holds more points than the cluster at rest, and
//     the lock's finger stands in different cells at the two parities.
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

// ---- the cluster's swept cloud ---------------------------------------------
const cl = await page.evaluate(async () => {
  const THREE = await import('three');
  const I = await import('./src/inspect.js');
  const L = await import('./src/layout.js');
  const clock = window.__clock;
  const STEP = 0.25, Q = 0.05;                       // sample pitch on each triangle; dedupe lattice
  const members = [];
  let collar = null, riser = null, driver = null, skirt = null, post = null, pad = null, stem = null;
  for (const e of clock.labelEntries) {
    if (e.name !== 'Alarm switch' && e.name !== 'Alarm lock') continue;
    e.obj.traverse((o) => {
      if (!o.isMesh || o.userData.schematic) return;
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
  if (collar) members.push(collar);
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
const unitOfIv = (k, z0, z1) => {
  // which tenant owns the interval: the largest-span unit listed in the cell
  let best = null, span = -1; for (const [u, d] of Object.entries(cells[k].units)) if (d > span) { span = d; best = u; }
  return best;
};
function judge(phi, extra = null) {
  let conflicts = 0, minGap = Infinity;
  const by = {};
  for (const [x, y, z] of cl.points) {
    const [X, Y, Z] = fold(x, y, z, phi);
    const r = Math.hypot(X, Y);
    if (r > CASE_R_IN - CM) { conflicts++; by.case = (by.case || 0) + 1; continue; }
    const own = cellOf(X, Y);
    if (own < 0) { conflicts++; by.offGrid = (by.offGrid || 0) + 1; continue; }
    if (Z > cells[own].hi) continue;                 // inside the plate: planted, not a tenant's
    if (Z < cells[own].lo + CM) { conflicts++; by.dial = (by.dial || 0) + 1; continue; }
    for (const k of nearCells(X, Y)) {
      const ivs = extra && extra.k === k ? [...cells[k].ivs, extra.iv] : cells[k].ivs;
      for (const [z0, z1] of ivs) {
        const g = Z < z0 ? z0 - Z : Z > z1 ? Z - z1 : -Math.min(Z - z0, z1 - Z);
        if (g < minGap) minGap = g;
        if (g < CM) { conflicts++; const u = extra && extra.k === k && z0 === extra.iv[0] ? 'PLANT' : unitOfIv(k, z0, z1); by[u] = (by[u] || 0) + 1; }
      }
    }
  }
  return { phi, conflicts, minGap, by };
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
    for (const k of nearCells(x, y)) for (const [z0, z1] of cells[k].ivs) {
      if (zDrv + rad + CM > z0 && zDrv - rad - CM < z1) { blocked++; const u = unitOfIv(k, z0, z1); owners[u] = (owners[u] || 0) + 1; break; }
    }
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
  const kFar = Math.min(NR - 1, Math.floor(Math.hypot(X, Y) / GRID.DR) + 8) * NA + (k % NA);
  const far = judge(trial.deg * DEG, { k: kFar, iv: [Z - 0.01, Z + 0.01] });
  const plantedFar = (far.by.PLANT || 0);
  k3 = `planted at φ ${trial.deg}°: ${hit.by.PLANT || 0} conflicts on the sliver; four units out: ${plantedFar}`;
  if (!((hit.by.PLANT || 0) > 0) || plantedFar > 0) fails.push(`K3 the detector: ${k3}`);
}
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
    + (r.conflicts ? `  — ${Object.entries(r.by).sort((a, b) => b[1] - a[1]).slice(0, 3).map(([u, n]) => `${u} ${n}`).join(', ')}` : '');
};
console.log(`\n  the best ten by margin${feasible.length ? '' : ' (none is feasible: the least-conflicted ten)'}:`);
const ranked = feasible.length ? [...feasible].sort((a, b) => b.minGap - a.minGap) : [...results].sort((a, b) => a.conflicts - b.conflicts);
for (const r of ranked.slice(0, 10)) console.log('    ' + show(r));
console.log(`\n  every 30°, for the shape of it:`);
for (let d = 0; d < 360; d += 30) console.log('    ' + show(results[d]));
console.log(`\n  controls:`);
console.log(`    K1 the stop wheel stays in its annulus about the arbor: ${f(cl.collarAnnulus[0])}–${f(cl.collarAnnulus[1])} (tip ${f(tipR)})`);
console.log(`    K2 ${band.excludedMeshes} meshes excluded; no moved unit is a tenant; the selector is`);
console.log(`    K3 ${k3}`);
console.log(`    K4 ${cl.points.length} swept samples against ${cl.atRest} at rest; the finger moves ${f(padMoved, 4)} between parities`);
if (fails.length) { console.log('\nCONTROL FAILED:\n  ' + fails.join('\n  ')); process.exit(2); }
console.log(`\nREPORT — controls pass; ${feasible.length ? `${feasible.length} feasible rotation(s)` : 'NO rotation of the rigid cluster fits the band as it stands'}`);
process.exit(0);
