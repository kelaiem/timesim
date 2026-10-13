// WHERE CAN THE ALARM DETECTOR STAND OFF THE CENTRE COLUMN, AND CAN TWO 1:1
// IDLERS REACH IT? — §278 landing 4's site report for the satellite fold. The
// detector (the set-carried disc with its notched track, the hour-carried
// reader collar and its pin, TODO 144's seat plate and pad, and the feeler that
// reads the collar) stands on the hour tube today and spends 5.312 u of the
// 7.240 u dial-side band. The owner's decision (§278's study): carry it to a
// SATELLITE arbor fed by two 1:1 idlers, one carrying the hour wheel's angle and
// one the alarm setting wheel's — TODO 117's topology, unchanged (the 'alarm
// detector' line spec's `orbit`, `setCarry` and `discStill` rows are what the
// transfers must keep). The study estimated the station at r ≈ 14, az 300–315°.
// This measures it. NO METAL MOVES: every candidate is the stack as it is today,
// carried in plan, and measured.
//
// REPORT with fatal controls (exit 2 when a control fails; exit 0 with the
// tables otherwise). What it answers, each over the pose net (§152's
// `digestPoses`, the reset pose included):
//
//   1. THE MAP. Where can the stack's CORE stand clear by CLEAR_MARGIN? The core
//      is the envelope of the disc, the reader, the seat's plate and pad and the
//      feeler's tip and jog: one solid cylinder, its radius and z-band read off
//      that metal about the disc's axis (the stack as it is today — its radius
//      and its band; the satellite's own arbor is inside it). Stage one judges
//      every station of an (r, az) grid against `dialBandScan`'s cells (the
//      dial-side band's tenants, unioned over the pose net, with the four
//      detector units EXCLUDED — they are the fold's own members — and the
//      disc's rim drive, idler 1b and its sleeve, detached for the scan: the
//      fold retires them, the satellite's set idler replaces them). A cell is
//      read when its centre stands within the core's radius plus the margin, so
//      the map is good to half a cell; its `spare` column is how much larger the
//      core could be and still read free.
//   2. THE FEELER. It reads the collar at every azimuth at once (TODO 117), so
//      its azimuth about the satellite is free: for each station the free
//      window of feeler azimuths, its own metal (arm, tail, stop, bracket lugs,
//      blade, stud) carried round the stack's axis and judged point by point
//      against the cells, its lugs planted in the base plate as today; of the
//      free azimuths, the one that ends its tail nearest the lock is taken.
//   3. EXACT. The best stations, re-measured with `meshClearance` against every
//      mesh (the same exclusions; the base plate is the lugs' ground) at every
//      pose of the net: the core as a ghost cylinder and the feeler as ghosts of
//      its own meshes at the window's centre. This is the verdict; stage one
//      only chose where to look.
//   4. THE COLUMN. At each of those stations, the free z-runs over the core's
//      footprint (dial back to plate face) — how much band the satellite has,
//      against the core's height, for step 5's re-funding of Z_DIAL.
//   5. THE IDLER PATHS. For each source (the hour wheel and the alarm setting
//      wheel, their pitch radius, module and stratum read off the built gears),
//      the satellite needs a TWIN of the source (same count, so 1:1) at the
//      station, and between them either one intermediate idler — its centre on
//      the perpendicular bisector of source and satellite, at the pitch sum
//      R_s + r_i from both, two choices of side — or an equal-pitch pair, both
//      wheels of pitch |S|/2, meshing direct. A one-idler path keeps the sense;
//      a direct pair reverses it, which TODO 117's coincidence survives only if
//      BOTH transfers reverse. For each side, the smallest idler that stands
//      clear in the source's own stratum (the source's unit skipped — the idler
//      meshes it), the twin's clearance at the station in the same stratum,
//      and the free strata over the smallest idler's footprint. And AT THE
//      CENTRE, once: the strata where each source could carry a coaxial
//      transfer wheel of its own size (its bore to its tip, the stack's band
//      vacated), and what a pipe of §50's floor stock rising to each from the
//      source's own stratum would cross — an idler in a stratum the source
//      cannot reach is no path. And the set's EXISTING lift: idler 1's compound
//      pinion (i1b) already carries the set up from the setting lane into the
//      disc's own plane and meshes the disc's rim there, so a satellite disc
//      standing on the circle of that centre distance about i1b's axis needs no
//      set idler at all — the circle is judged like the map (i1b itself, which
//      it meshes by design, is not its obstacle) and its roomiest station is
//      confirmed with the rest.
//   6. THE RUN TO THE LOCK. From the feeler's tail (its output, TODO 199's
//      open stage) at the station to the alarm lock's pivot and pad: the plan
//      run, the rise, and what a straight run at the tail's plane meets.
//
// CONTROLS (exit 2):
//   K1 must-hit at the centre: the core judged at the disc's own axis, with the
//      stack excluded, meets the centre column (the hour tube and the motion
//      works) — the map can see what the stack stands on today.
//   K2 the scan's own plants (dial-band-scan's C5/C6): a block on a cell's ray
//      reads its own interval and nothing three units out; a pin off the ray is
//      missed by the ray and caught by the surface pass.
//   K3 the exact instrument: the disc hub on the hour tube reads its running fit
//      (bore + 0.05) to the lathes' facet error, and the core ghost at the axis
//      reads ≤ 0 against the tube.
//   K4 a ghost at the identity (the axis, azimuth 0) reproduces the feeler's
//      metal exactly — the carry is a carry and nothing else.
//   K5 the core envelope contains every vertex of the metal it stands for.
//
// What it is NOT: probe-strike-site.mjs re-sites the STRIKE (cam, lever,
// hammer) against the back glass; probe-261-fold-site.mjs sited the alarm
// SWITCH under the dial; probe-117-takeoff.mjs and probe-117-fork-room.mjs
// priced the reader's take-off AT the centre; dial-band-scan.mjs is the band
// scan this reads (one copy of the method). It sizes no idler's teeth and moves
// nothing: step 4 designs the transfers in a line, step 5 folds them.
//
// Run: cd tools && node probe-detector-site.mjs   (ROOT= for another tree)
import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { dialBandScan } from './dial-band-scan.mjs';

const ROOT = process.env.ROOT || join(dirname(fileURLToPath(import.meta.url)), '..');
const PORT = Number(process.env.PORT || 8653);
const GRID = { DR: 0.5, DAZ_DEG: 2.5 };               // probe-261-fold-site's pitch: half a cell is the map's resolution
const STACK = ['Alarm release disc', 'Alarm release reader', 'Alarm release seat', 'Alarm release feeler'];
const STUDY = { r: [13, 15], az: [300, 315] };
const N_EXACT = 10;                                   // stations confirmed exactly

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
const bootWarns = warns.splice(0);

// ---------------------------------------------------------------------------
// The page half, stage 0: the stack's metal, the sources, the lock, and the
// members the fold retires (detached for the scan, restored at the end).
const setup = await page.evaluate(async ({ STACK }) => {
  const THREE = await import('three');
  const I = await import('./src/inspect.js');
  const LAY = await import('./src/layout.js');
  const clock = window.__clock;
  clock.resetInputs(); clock.setPose({}); clock.scene.updateMatrixWorld(true);
  const labelOf = new Map();
  for (const e of clock.labelEntries) if (!labelOf.has(e.obj)) labelOf.set(e.obj, e.name);
  const ownerOf = (o) => { for (let p = o; p; p = p.parent) if (labelOf.has(p)) return labelOf.get(p); return null; };
  const isSchem = (o) => { for (let p = o; p; p = p.parent) if (p.userData?.schematic) return true; return false; };
  const meshes = [];
  clock.scene.traverse((o) => { if (o.isMesh && !isSchem(o) && o.geometry?.attributes?.position) meshes.push(o); });
  const byName = (n) => meshes.find((o) => o.name === n);
  const v = new THREE.Vector3();
  const hub = byName('alarmDiscHub');
  const box = new THREE.Box3().setFromObject(hub, true);
  const C = { x: (box.min.x + box.max.x) / 2, y: (box.min.y + box.max.y) / 2 };
  // the core: the disc, the reader, the seat's plate and pad, the feeler's tip and jog
  const coreSet = meshes.filter((o) => ['Alarm release disc', 'Alarm release reader'].includes(ownerOf(o))
    || ['alarmSeatPlate', 'alarmSeatPad', 'alarmFeelerTip', 'alarmFeelerJog'].includes(o.name));
  let R = 0, z0 = Infinity, z1 = -Infinity;
  for (const o of coreSet) {
    o.updateWorldMatrix(true, false);
    const pos = o.geometry.attributes.position;
    for (let i = 0; i < pos.count; i++) { v.fromBufferAttribute(pos, i).applyMatrix4(o.matrixWorld); R = Math.max(R, Math.hypot(v.x - C.x, v.y - C.y)); z0 = Math.min(z0, v.z); z1 = Math.max(z1, v.z); }
  }
  // the feeler's own metal OUTSIDE the core, as surface samples relative to C
  // (every triangle at 0.1 — vertices are not the surface)
  const feeler = meshes.filter((o) => ownerOf(o) === 'Alarm release feeler');
  const fPts = [], seenPt = new Set();   // deduplicated on a 0.05 lattice (dial-band-scan's)
  const STEP = 0.1;
  const a = new THREE.Vector3(), b = new THREE.Vector3(), c = new THREE.Vector3();
  for (const o of feeler) {
    const pos = o.geometry.attributes.position, idx = o.geometry.index, n = idx ? idx.count : pos.count;
    for (let t = 0; t < n; t += 3) {
      a.fromBufferAttribute(pos, idx ? idx.getX(t) : t).applyMatrix4(o.matrixWorld);
      b.fromBufferAttribute(pos, idx ? idx.getX(t + 1) : t + 1).applyMatrix4(o.matrixWorld);
      c.fromBufferAttribute(pos, idx ? idx.getX(t + 2) : t + 2).applyMatrix4(o.matrixWorld);
      const L = Math.max(a.distanceTo(b), a.distanceTo(c), b.distanceTo(c)), s = Math.max(1, Math.ceil(L / STEP));
      for (let i = 0; i <= s; i++) for (let j = 0; j <= s - i; j++) {
        const u = i / s, w = j / s;
        const x = a.x + (b.x - a.x) * u + (c.x - a.x) * w, y = a.y + (b.y - a.y) * u + (c.y - a.y) * w, z = a.z + (b.z - a.z) * u + (c.z - a.z) * w;
        if (Math.hypot(x - C.x, y - C.y) <= R && z >= z0 && z <= z1) continue;   // inside the core: the core answers for it
        const key = `${Math.round((x - C.x) / 0.05)},${Math.round((y - C.y) / 0.05)},${Math.round(z / 0.05)}`;
        if (seenPt.has(key)) continue;
        seenPt.add(key);
        fPts.push([x - C.x, y - C.y, z, o.name === 'alarmFeelerLug' ? 1 : 0]);
      }
    }
  }
  // the feeler's output: the tail's outer end (the point farthest from C)
  const tail = byName('alarmFeelerTail');
  let tailEnd = null, tr = -1;
  { const pos = tail.geometry.attributes.position; let sx = 0, sy = 0, sz = 0, n = 0;
    const pts = []; for (let i = 0; i < pos.count; i++) { v.fromBufferAttribute(pos, i).applyMatrix4(tail.matrixWorld); pts.push(v.clone()); tr = Math.max(tr, Math.hypot(v.x - C.x, v.y - C.y)); }
    for (const p of pts) if (Math.hypot(p.x - C.x, p.y - C.y) > tr - 1e-6) { sx += p.x; sy += p.y; sz += p.z; n++; }
    tailEnd = { x: sx / n - C.x, y: sy / n - C.y, z: sz / n }; }
  // the two sources: the gear group behind a mesh carries pitch r, teeth, module
  const gearOf = (m) => { for (let p = m; p; p = p.parent) if (p.userData && p.userData.teeth) return p; return null; };
  const srcOf = (mesh, unit) => {
    const g = gearOf(mesh); if (!g) return null;
    mesh.updateWorldMatrix(true, false);
    const pos = mesh.geometry.attributes.position; let lo = Infinity, hi = -Infinity, tip = 0;
    for (let i = 0; i < pos.count; i++) { v.fromBufferAttribute(pos, i).applyMatrix4(mesh.matrixWorld); lo = Math.min(lo, v.z); hi = Math.max(hi, v.z); tip = Math.max(tip, Math.hypot(v.x - C.x, v.y - C.y)); }
    let bore = Infinity; for (let i = 0; i < pos.count; i++) { v.fromBufferAttribute(pos, i).applyMatrix4(mesh.matrixWorld); bore = Math.min(bore, Math.hypot(v.x - C.x, v.y - C.y)); }
    return { unit, mesh: mesh.name || '(unnamed)', R: g.userData.r, teeth: g.userData.teeth, m: g.userData.module, z0: lo, z1: hi, tip, bore };
  };
  const hourMesh = byName('mwHourWheel');
  const setUnitMeshes = meshes.filter((o) => ownerOf(o) === 'Alarm setting wheel');
  const setMesh = setUnitMeshes.find((o) => gearOf(o));
  const sources = { hour: srcOf(hourMesh, 'Hour wheel'), set: setMesh ? srcOf(setMesh, 'Alarm setting wheel') : null };
  // the lock: its pivot post and its pad (the finger in the stop wheel)
  const ctr = (o) => { const bb = new THREE.Box3().setFromObject(o, true); return { x: (bb.min.x + bb.max.x) / 2 - C.x, y: (bb.min.y + bb.max.y) / 2 - C.y, z0: bb.min.z, z1: bb.max.z }; };
  const lock = { pivot: ctr(byName('alarmLockPivotPost')), pad: ctr(byName('alarmLockPad')) };
  // the members the fold retires: the disc's rim drive (idler 1b) and its sleeve
  const i1b = clock.scene.getObjectByName('i1b');
  const retired = [];
  // the set's EXISTING lift, read before it is detached: idler 1's compound
  // pinion (i1b) meshes the disc's rim in the disc's own plane, so it already
  // presents the set — 1:1 with the setting wheel through the rim — at its own
  // axis, r ≈ 8.7 from the centre
  let lift = null;
  if (i1b) {
    const A = new THREE.Vector3(); i1b.getWorldPosition(A);
    const bb = new THREE.Box3().setFromObject(i1b, true);
    const discG = gearOf(byName('alarmDiscBody'));
    lift = { A: { x: A.x - C.x, y: A.y - C.y }, rb: i1b.userData.r, teeth: i1b.userData.teeth, m: i1b.userData.module, z0: bb.min.z, z1: bb.max.z,
      discR: discG ? discG.userData.r : null, discTeeth: discG ? discG.userData.teeth : null };
  }
  if (i1b) {
    const parent = i1b.parent;
    const sleeve = parent.children.find((o) => o.isMesh && o !== i1b && o.geometry?.type === 'LatheGeometry'
      && Math.abs((o.geometry.parameters?.points?.[0]?.x ?? 0) - 0.5) < 1e-9 && Math.abs((o.geometry.parameters?.points?.[1]?.x ?? 0) - 0.62) < 1e-9);
    for (const o of [i1b, sleeve].filter(Boolean)) { retired.push({ o, parent: o.parent, name: o.name || 'idler 1b sleeve' }); }
    for (const r of retired) r.parent.remove(r.o);
  }
  window.__D = { THREE, I, clock, C, R, z0, z1, retired, meshes, ownerOf, isSchem, feeler, coreSet, byName };
  // K5: every core vertex inside the envelope (it is their max, so this holds
  // by construction unless the axis is not the disc's — which is what it checks)
  let k5 = 0;
  for (const o of coreSet) { const pos = o.geometry.attributes.position; for (let i = 0; i < pos.count; i++) { v.fromBufferAttribute(pos, i).applyMatrix4(o.matrixWorld); if (Math.hypot(v.x - C.x, v.y - C.y) > R + 1e-9 || v.z < z0 - 1e-9 || v.z > z1 + 1e-9) k5++; } }
  return { C, R, z0, z1, core: coreSet.map((o) => o.name || '?'), fPts, tailEnd, sources, lock, lift, retired: retired.map((r) => r.name), k5,
    CM: LAY.CLEAR_MARGIN, UNIT_MM: LAY.UNIT_MM, STOCK: LAY.STOCK_MIN_U };
}, { STACK });
const CM = setup.CM, UNIT_MM = setup.UNIT_MM;   // layout.js's: the one margin, and the unit

console.log(`boot warnings ${bootWarns.length}${bootWarns.length ? ': ' + bootWarns.slice(0, 3).join(' | ') : ''}`);
console.log(`the detector's axis (the disc hub's centre) (${setup.C.x.toFixed(4)}, ${setup.C.y.toFixed(4)}); the CORE (${setup.core.length} meshes: disc, reader, seat plate and pad, feeler tip and jog) `
  + `is r ≤ ${setup.R.toFixed(4)} over z ${setup.z0.toFixed(4)} … ${setup.z1.toFixed(4)} (height ${(setup.z1 - setup.z0).toFixed(4)} u = ${((setup.z1 - setup.z0) * UNIT_MM).toFixed(3)} mm)`);
console.log(`the feeler outside the core: ${setup.fPts.length} surface samples; its tail's end at (${setup.tailEnd.x.toFixed(3)}, ${setup.tailEnd.y.toFixed(3)}) from the axis, z ${setup.tailEnd.z.toFixed(4)}`);
for (const [k, s] of Object.entries(setup.sources)) console.log(`source ${k}: ${s ? `${s.unit} '${s.mesh}', ${s.teeth} T, module ${s.m.toFixed(5)}, pitch R ${s.R.toFixed(4)}, tip ${s.tip.toFixed(4)}, stratum z ${s.z0.toFixed(4)} … ${s.z1.toFixed(4)}` : 'NOT FOUND'}`);
console.log(`retired for the scan (the disc's rim drive, which the satellite's set idler replaces): ${setup.retired.join(', ') || 'none found'}`);

// ---------------------------------------------------------------------------
// Stage 1: the band, scanned once with the stack excluded.
const t0 = Date.now();
const band = await page.evaluate(dialBandScan, { GRID, exclude: STACK });
console.log(`dial band scanned in ${((Date.now() - t0) / 1000).toFixed(0)} s: floor (dial back) ${band.Z_FLOOR.toFixed(4)}, ceiling (plate face) ${band.Z_CEIL.toFixed(4)}, `
  + `${band.NR}×${band.NA} cells, ${band.poses} poses, ${band.tenantsCount} tenants (${band.excludedMeshes} excluded), open incidences ${band.openIncidences}`);
const { NR, NA, cells } = band;
const DEG = Math.PI / 180;
const C = setup.C;
const cellOf = (x, y) => {
  const r = Math.hypot(x, y); if (r >= NR * GRID.DR) return -1;
  let a = Math.atan2(y, x) / DEG; if (a < 0) a += 360;
  return Math.min(NR - 1, Math.floor(r / GRID.DR)) * NA + Math.min(NA - 1, Math.floor(a / GRID.DAZ_DEG));
};
// cells whose centre stands within `reach` of (x, y)
const cellsWithin = (x, y, reach) => {
  const out = [], r = Math.hypot(x, y);
  const r0 = Math.max(0, r - reach), r1 = r + reach;
  for (let ri = Math.floor(r0 / GRID.DR); ri <= Math.min(NR - 1, Math.floor(r1 / GRID.DR)); ri++) for (let ai = 0; ai < NA; ai++) {
    const k = ri * NA + ai, c = cells[k];
    const cx = c.r * Math.cos(c.az * DEG), cy = c.r * Math.sin(c.az * DEG);
    if (Math.hypot(cx - x, cy - y) <= reach) out.push(k);
  }
  return out;
};
// what stands within the margin of a vertical body of radius rad over [zA, zB]
// at (x, y): the owners, and whether the walls do (skip: a unit the body meshes)
const blockers = (x, y, rad, zA, zB, skip = null) => {
  const own = new Map();
  for (const k of cellsWithin(x, y, rad + CM)) {
    const c = cells[k];
    if (zA - CM < c.lo) own.set('(the dial)', 1);
    if (zB + CM > c.hi) own.set('(the base plate)', 1);
    for (const [u, ivs] of c.uivs) { if (u === skip) continue; for (const [a, b] of ivs) if (zB + CM > a && zA - CM < b) own.set(u, (own.get(u) || 0) + 1); }
  }
  return own;
};
const coreClear = (x, y, grow = 0) => blockers(x, y, setup.R + grow, setup.z0, setup.z1).size === 0;
const rot = (p, phi) => ({ x: p[0] * Math.cos(phi) - p[1] * Math.sin(phi), y: p[0] * Math.sin(phi) + p[1] * Math.cos(phi) });
// the feeler's samples at azimuth φ about the stack's axis, at station (x, y)
const feelerJudge = (x, y, phi) => {
  const own = new Map();
  for (const p of setup.fPts) {
    const q = rot(p, phi), X = x + q.x, Y = y + q.y, Z = p[2];
    const k0 = cellOf(X, Y); if (k0 < 0) { own.set('(off the grid)', 1); continue; }
    if (Z >= cells[k0].hi - 1e-9 && p[3]) continue;        // a lug's foot in the plate: planted (the ground is not an obstacle)
    for (const k of nearCells(X, Y)) {
      const c = cells[k];
      if (Z - CM < c.lo) own.set('(the dial)', (own.get('(the dial)') || 0) + 1);
      if (Z + CM > c.hi && !p[3]) own.set('(the base plate)', (own.get('(the base plate)') || 0) + 1);
      for (const [u, ivs] of c.uivs) for (const [a, b] of ivs) if (Z + CM > a && Z - CM < b) own.set(u, (own.get(u) || 0) + 1);
    }
  }
  return own;
};
// the cells a margin away in plan: the point's own and its eight plan
// neighbours at the margin (probe-261-fold-site's nearCells, diagonals added)
const nearCells = (x, y) => {
  const r = Math.hypot(x, y) || 1e-9, ux = x / r, uy = y / r, out = new Set();
  for (const [dr, dt] of [[0, 0], [CM, 0], [-CM, 0], [0, CM], [0, -CM], [CM * 0.7071, CM * 0.7071], [-CM * 0.7071, CM * 0.7071], [CM * 0.7071, -CM * 0.7071], [-CM * 0.7071, -CM * 0.7071]]) {
    const k = cellOf(x + ux * dr - uy * dt, y + uy * dr + ux * dt); if (k >= 0) out.add(k);
  }
  return out;
};
const fmtOwn = (m) => [...m.entries()].sort((a, b) => b[1] - a[1]).slice(0, 3).map(([u, n]) => `${u}×${n}`).join(', ');

// K1 — must-hit at the centre
const k1 = blockers(C.x, C.y, setup.R, setup.z0, setup.z1);
const k1ok = k1.size > 0 && [...k1.keys()].some((u) => /Hour wheel|Motion works|Dial|Alarm disc/.test(u));
// K2 — the scan's own plants
const pl = band.plant;
const k2ok = !!pl && pl.got.length === 1 && Math.abs(pl.got[0][0] - pl.want[0]) < 1e-6 && Math.abs(pl.got[0][1] - pl.want[1]) < 1e-6
  && pl.missCount === 0 && pl.pinRayHits === 0 && !!pl.pinSurf && pl.pinSurf[0] <= pl.want[0] + 1e-6 && pl.pinSurf[1] >= pl.want[1] - 1e-6;

// The map: every station of an (r, az) grid
const stations = [];
for (let r = 7; r <= 36 + 1e-9; r += 0.5) for (let az = 0; az < 360; az += 2.5) {
  const x = C.x + r * Math.cos(az * DEG), y = C.y + r * Math.sin(az * DEG);
  const own = blockers(x, y, setup.R, setup.z0, setup.z1);
  let spare = null;
  if (own.size === 0) { spare = 0; for (let g = 0.25; g <= 4 + 1e-9; g += 0.25) { if (coreClear(x, y, g)) spare = g; else break; } }
  stations.push({ r, az, x, y, clear: own.size === 0, spare, own });
}
const clearSt = stations.filter((s) => s.clear);
console.log(`\nSTAGE 1 — the core (r ${setup.R.toFixed(3)}, band ${setup.z0.toFixed(3)} … ${setup.z1.toFixed(3)}) over ${stations.length} stations (r 7–36 by 0.5, az by 2.5°; azimuths are WORLD atan2(y, x) about the axis): `
  + `${clearSt.length} read clear by CLEAR_MARGIN in the cells`);
// the compact map: one row per radius, one column per 10° (the best of four 2.5° stations): '#' blocked, 'o' clear, digit = spare in quarters (capped 9)
console.log('   r  ' + Array.from({ length: 36 }, (_, i) => String((i * 10) % 100 === 0 ? (i * 10) / 100 : ' ')).join(''));
for (let r = 7; r <= 36 + 1e-9; r += 0.5) {
  let line = '';
  for (let a = 0; a < 360; a += 10) {
    const g = stations.filter((s) => s.r === r && s.az >= a && s.az < a + 10);
    const best = g.filter((s) => s.clear).sort((p, q) => q.spare - p.spare)[0];
    line += best ? (best.spare >= 0.25 ? String(Math.min(9, Math.round(best.spare / 0.25))) : 'o') : '#';
  }
  console.log(`${r.toFixed(1).padStart(5)} ${line}`);
}
console.log('       (columns: 0°, 10°, … 350°; # no clear station in the 10°, o clear with < 0.25 spare, 1–9 the spare radius in quarter units, 9 meaning ≥ 2.25)');
// the study's window
console.log(`\nthe study's window (r ${STUDY.r.join('–')}, az ${STUDY.az.join('–')}°):`);
for (const s of stations.filter((s) => s.r >= STUDY.r[0] && s.r <= STUDY.r[1] && s.az >= STUDY.az[0] && s.az <= STUDY.az[1] && s.az % 5 === 0))
  console.log(`  r ${s.r.toFixed(1)} az ${s.az.toFixed(1).padStart(5)}: ${s.clear ? `CLEAR, spare ${s.spare.toFixed(2)}` : 'blocked by ' + fmtOwn(s.own)}`);
// who blocks, over the whole map
const blockTally = {};
for (const s of stations) for (const u of s.own.keys()) blockTally[u] = (blockTally[u] || 0) + 1;
console.log(`blockers over the map (stations each blocks): ${Object.entries(blockTally).sort((a, b) => b[1] - a[1]).slice(0, 14).map(([u, n]) => `${u} ${n}`).join('; ')}`);

// The feeler at the clear stations with the most spare (and every clear one in
// the study's window): its free azimuth windows
const FEELER_N = 80;
const feelerSet = [...clearSt].sort((a, b) => b.spare - a.spare).slice(0, FEELER_N);
for (const s of clearSt) if (s.r >= STUDY.r[0] && s.r <= STUDY.r[1] && s.az >= STUDY.az[0] && s.az <= STUDY.az[1] && !feelerSet.includes(s)) feelerSet.push(s);
for (const s of feelerSet) {
  const free = [];
  for (let d = 0; d < 360; d += 5) { const own = feelerJudge(s.x, s.y, d * DEG); free.push({ d, ok: own.size === 0, own }); }
  s.fFree = free.filter((f) => f.ok).length;
  // the longest run of free azimuths (circular), its centre
  let bestLen = 0, bestStart = -1;
  for (let i = 0; i < free.length; i++) { if (!free[i].ok) continue; let L = 0; while (L < free.length && free[(i + L) % free.length].ok) L++; if (L > bestLen) { bestLen = L; bestStart = i; } }
  s.fRun = bestLen * 5;
  // within the free azimuths, the one whose tail ends nearest the lock's pivot
  // (the run TODO 199's output stage will have to make); the window's centre
  // only when no lock was found
  s.fPhi = null; let bestRun = Infinity;
  for (const f of free) {
    if (!f.ok) continue;
    const q = rot([setup.tailEnd.x, setup.tailEnd.y], f.d * DEG), P = setup.lock.pivot;
    const run = Math.hypot(s.x + q.x - (C.x + P.x), s.y + q.y - (C.y + P.y));
    if (run < bestRun) { bestRun = run; s.fPhi = f.d; }
  }
  if (bestStart < 0) { const tally = {}; for (const f of free) for (const u of f.own.keys()) tally[u] = (tally[u] || 0) + 1; s.fBlock = tally; }
}
const withFeeler = feelerSet.filter((s) => s.fRun > 0);
console.log(`\nSTAGE 1, THE FEELER (its azimuth about the satellite free, 5° steps, φ 0 = its azimuth about the axis today): `
  + `judged at the ${feelerSet.length} clear stations with the most spare and the study window's; ${withFeeler.length} have a free feeler azimuth`);
// THE SET'S EXISTING LIFT: stations where the satellite's disc meshes idler 1's
// compound pinion (i1b) DIRECTLY — the centre distance it keeps today, rb + R_disc
// about i1b's axis — so the set arrives with no new idler and the sense and
// the ratio of today's branch
const liftCircle = [];
if (setup.lift && setup.lift.discR) {
  const L = setup.lift, Dm = L.rb + L.discR;
  for (let t = 0; t < 360; t += 2.5) {
    const x = C.x + L.A.x + Dm * Math.cos(t * DEG), y = C.y + L.A.y + Dm * Math.sin(t * DEG);
    const r = Math.hypot(x - C.x, y - C.y); let az = Math.atan2(y - C.y, x - C.x) / DEG; if (az < 0) az += 360;
    const own = blockers(x, y, setup.R, setup.z0, setup.z1);
    const st = { r, az, x, y, clear: own.size === 0, spare: null, own, t, viaLift: true, fRun: 0 };
    if (st.clear) {
      st.spare = 0; for (let g = 0.25; g <= 4 + 1e-9; g += 0.25) { if (coreClear(x, y, g)) st.spare = g; else break; }
      st.fPhi = null; let bestRun = Infinity, nFree = 0;
      for (let d = 0; d < 360; d += 5) {
        if (feelerJudge(x, y, d * DEG).size) continue;
        nFree++;
        const q = rot([setup.tailEnd.x, setup.tailEnd.y], d * DEG), P = setup.lock.pivot;
        const run = Math.hypot(x + q.x - (C.x + P.x), y + q.y - (C.y + P.y));
        if (run < bestRun) { bestRun = run; st.fPhi = d; }
      }
      st.fRun = nFree * 5;
    }
    liftCircle.push(st);
  }
  const ok = liftCircle.filter((q) => q.clear && q.fRun > 0);
  console.log(`\nTHE SET'S EXISTING LIFT — idler 1's compound pinion i1b (${L.teeth} T, pitch ${L.rb.toFixed(3)}, stratum ${L.z0.toFixed(3)} … ${L.z1.toFixed(3)}) stands at (${L.A.x.toFixed(3)}, ${L.A.y.toFixed(3)}), `
    + `r ${Math.hypot(L.A.x, L.A.y).toFixed(3)} from the axis, and meshes the disc's ${L.discTeeth} T rim (pitch ${L.discR.toFixed(3)}) in the disc's own plane. A satellite disc meshing it directly stands on the circle `
    + `of radius ${Dm.toFixed(3)} about it: ${ok.length} of ${liftCircle.length} stations on that circle (2.5° steps) read clear in the cells for the core and have a free feeler azimuth`);
  let run0 = null;
  const arcs = [];
  for (let i = 0; i <= liftCircle.length; i++) {
    const q = liftCircle[i % liftCircle.length], good = i < liftCircle.length && q.clear && q.fRun > 0;
    if (good && run0 === null) run0 = i;
    if ((!good || i === liftCircle.length) && run0 !== null) { arcs.push([run0, i - 1]); run0 = null; }
  }
  for (const [a, b] of arcs) {
    const qa = liftCircle[a], qb = liftCircle[b];
    const best = liftCircle.slice(a, b + 1).sort((p, q) => q.spare - p.spare)[0];
    console.log(`  about i1b ${qa.t.toFixed(1)}°…${qb.t.toFixed(1)}°: stations r ${qa.r.toFixed(2)} az ${qa.az.toFixed(1)}° … r ${qb.r.toFixed(2)} az ${qb.az.toFixed(1)}°; the roomiest r ${best.r.toFixed(2)} az ${best.az.toFixed(1)}° (spare ${best.spare.toFixed(2)})`);
  }
  if (!arcs.length) {
    const tally = {}; for (const q of liftCircle) for (const u of q.own.keys()) tally[u] = (tally[u] || 0) + 1;
    console.log(`  none: blocked by ${Object.entries(tally).sort((p, q) => q[1] - p[1]).slice(0, 6).map(([u, n]) => `${u} ${n}`).join(', ')}`);
  }
}
// choose stations to confirm: rank by spare, then by the feeler's window, keep them ≥ 2 u apart
const ranked = [...withFeeler].sort((a, b) => (b.spare - a.spare) || (b.fRun - a.fRun) || (a.r - b.r));
const picks = [];
for (const s of ranked) { if (picks.every((p) => Math.hypot(p.x - s.x, p.y - s.y) >= 2)) picks.push(s); if (picks.length >= N_EXACT) break; }
// and the study window's best, if it has a clear one
const studyBest = withFeeler.filter((s) => s.r >= STUDY.r[0] && s.r <= STUDY.r[1] && s.az >= STUDY.az[0] && s.az <= STUDY.az[1])
  .sort((a, b) => (b.spare - a.spare) || (b.fRun - a.fRun))[0];
if (studyBest && !picks.includes(studyBest)) picks.push(studyBest);
// and the roomiest station on i1b's circle, nearest the study's radius among the roomiest
const liftBest = liftCircle.filter((q) => q.clear && q.fRun > 0).sort((a, b) => (b.spare - a.spare) || (Math.abs(a.r - 14) - Math.abs(b.r - 14)))[0];
if (liftBest) picks.push(liftBest);
console.log(' station          spare  feeler azimuths free');
for (const s of picks) console.log(`  r ${s.r.toFixed(1).padStart(4)} az ${s.az.toFixed(1).padStart(5)}  ${s.spare.toFixed(2).padStart(5)}  ${s.fRun >= 360 ? 'every azimuth' : `${s.fRun}° run`}; φ ${s.fPhi.toFixed(1)}° puts the tail nearest the lock${s === studyBest ? '   ← the study window\'s best' : ''}${s.viaLift ? '   ← on i1b\'s circle (the set by the existing lift)' : ''}`);

// ---------------------------------------------------------------------------
// Stage 2: EXACT, over the pose net, with meshClearance. The ghosts carry
// their placement in matrix and matrixWorld (probe-strike-site's idiom).
const exact = await page.evaluate(async ({ picks, CM }) => {
  const D = window.__D, { THREE, I, clock, C } = D;
  const ghost = (geo, mat, world) => { const g = new THREE.Mesh(geo, mat); g.matrixAutoUpdate = false; g.matrixWorldAutoUpdate = false; g.matrix.copy(world); g.matrixWorld.copy(world); return g; };
  // the core: a cylinder CIRCUMSCRIBING the envelope (a 64-gon inscribed in R
  // stands R(1 − cos(π/64)) inside it), standing along z
  const seg = 64, Rc = D.R / Math.cos(Math.PI / seg), H = D.z1 - D.z0;
  const coreGeo = new THREE.CylinderGeometry(Rc, Rc, H, seg, 1, false).rotateX(Math.PI / 2);
  const mat = new THREE.MeshBasicMaterial();
  const stackSet = new Set(D.meshes.filter((o) => ['Alarm release disc', 'Alarm release reader', 'Alarm release seat', 'Alarm release feeler'].includes(D.ownerOf(o))));
  const inScene = (o) => { for (let p = o; p; p = p.parent) if (p === clock.scene) return true; return false; };
  const obstacles = D.meshes.filter((o) => !stackSet.has(o) && inScene(o));
  const plate = obstacles.filter((o) => o.name === 'backPlate');
  const poses = [{}, ...I.digestPoses(clock)];
  const carry = (S, phi) => new THREE.Matrix4().makeTranslation(S.x - C.x, S.y - C.y, 0)
    .multiply(new THREE.Matrix4().makeTranslation(C.x, C.y, 0)).multiply(new THREE.Matrix4().makeRotationZ(phi)).multiply(new THREE.Matrix4().makeTranslation(-C.x, -C.y, 0));
  // K3 and K4 at the reset pose
  clock.resetInputs(); clock.setPose({}); clock.scene.updateMatrixWorld(true);
  const tube = D.byName('hourTube'), hub = D.byName('alarmDiscHub');
  const fit = I.meshClearance(hub, tube);
  const hubSeg = hub.geometry.parameters?.segments, hubBoreR = hub.geometry.parameters?.points?.[0]?.x;
  const coreAt = (S) => ghost(coreGeo, mat, new THREE.Matrix4().makeTranslation(S.x, S.y, (D.z0 + D.z1) / 2));
  const coreOnTube = I.meshClearance(coreAt(C), tube);
  const v = new THREE.Vector3(), w = new THREE.Vector3();
  let k4 = 0;
  { const M = carry(C, 0); for (const o of D.feeler) { const g = ghost(o.geometry, o.material, new THREE.Matrix4().multiplyMatrices(M, o.matrixWorld)); const pos = o.geometry.attributes.position;
      for (let i = 0; i < pos.count; i++) { v.fromBufferAttribute(pos, i).applyMatrix4(o.matrixWorld); w.fromBufferAttribute(pos, i).applyMatrix4(g.matrixWorld); k4 = Math.max(k4, v.distanceTo(w)); } } }
  const out = picks.map((s) => ({ key: `${s.r}/${s.az}`, core: { d: Infinity, b: null, pose: null }, feeler: { d: Infinity, a: null, b: null, pose: null } }));
  const box = new THREE.Box3(), gb = new THREE.Box3();
  const UB = CM + 0.6;
  for (const [pi, p] of poses.entries()) {
    clock.resetInputs(); clock.setPose(p); clock.scene.updateMatrixWorld(true);
    const obs = obstacles.map((o) => ({ o, b: box.setFromObject(o).clone() }));
    for (const [k, s] of picks.entries()) {
      const S = { x: s.x, y: s.y };
      const gh = [{ g: coreAt(S), kind: 'core', name: 'core envelope' }];
      const M = carry(S, s.fPhi * Math.PI / 180);
      for (const o of D.feeler) { o.updateWorldMatrix(true, false); gh.push({ g: ghost(o.geometry, o.material, new THREE.Matrix4().multiplyMatrices(M, o.matrixWorld)), kind: 'feeler', name: o.name || '(feeler)', lug: o.name === 'alarmFeelerLug' }); }
      for (const G of gh) {
        gb.setFromObject(G.g);
        const rec = out[k][G.kind];
        for (const ob of obs) {
          if (G.lug && plate.includes(ob.o)) continue;     // the lugs stand on the base plate: planted
          const B = ob.b, dBox = Math.hypot(Math.max(0, B.min.x - gb.max.x, gb.min.x - B.max.x), Math.max(0, B.min.y - gb.max.y, gb.min.y - B.max.y), Math.max(0, B.min.z - gb.max.z, gb.min.z - B.max.z));
          if (dBox >= Math.min(rec.d, UB)) continue;
          const d = I.meshClearance(G.g, ob.o, Math.min(rec.d, UB));
          if (d < rec.d) Object.assign(rec, { d, a: G.name, b: `${D.ownerOf(ob.o) || '(unlabelled)'} / ${ob.o.name || '(unnamed)'}`, pose: pi === 0 ? 'reset' : `net#${pi - 1}` });
        }
      }
    }
  }
  clock.resetInputs(); clock.setPose({}); clock.scene.updateMatrixWorld(true);
  return { out, fit, hubSeg, hubBoreR, coreOnTube, k4, poses: poses.length, obstacles: obstacles.length };
}, { picks: picks.map((s) => ({ r: s.r, az: s.az, x: s.x, y: s.y, fPhi: s.fPhi })), CM });
// the fit is 0.05 between the lathes' VERTEX circles; the hub's bore edges
// stand its facet sagitta R·(1 − cos(π/N)) inside that, so the reading lies in
// [0.05 − sagitta, 0.05] and nowhere else
const k3lo = 0.05 - exact.hubBoreR * (1 - Math.cos(Math.PI / exact.hubSeg));
const k3ok = exact.fit >= k3lo - 1e-6 && exact.fit <= 0.05 + 1e-6 && exact.coreOnTube <= 0;
const k4ok = exact.k4 === 0;
console.log(`\nSTAGE 2 — EXACT (meshClearance against ${exact.obstacles} meshes over ${exact.poses} poses; clearances above ${CM + 0.6} read as ≥ that):`);
console.log(' station          core clear  nearest (pose)                                          feeler clear  nearest (pose)');
for (const [k, s] of picks.entries()) {
  const e = exact.out[k];
  s.exact = e;
  const f = (d) => (d === Infinity ? `≥ ${(CM + 0.6).toFixed(2)}` : d.toFixed(4)).padStart(9);
  console.log(`  r ${s.r.toFixed(1).padStart(4)} az ${s.az.toFixed(1).padStart(5)}  ${f(e.core.d)}  ${(e.core.b ? `${e.core.b} (${e.core.pose})` : '—').slice(0, 54).padEnd(54)}  ${f(e.feeler.d)}  ${e.feeler.b ? `${e.feeler.a} → ${e.feeler.b} (${e.feeler.pose})` : '—'}`);
}

// ---------------------------------------------------------------------------
// The column, the idler paths and the run, for the stations that are clear
// EXACTLY (core and feeler both ≥ CLEAR_MARGIN).
const good = picks.filter((s) => s.exact.core.d >= CM && s.exact.feeler.d >= CM);
console.log(`\n${good.length} of ${picks.length} confirmed stations hold CLEAR_MARGIN exactly for both the core and the feeler`);
const freeRuns = (x, y, rad, skip = null) => {
  // union of every tenant interval over the footprint, then the gaps between
  // the highest floor and the lowest ceiling the footprint sees
  const ks = cellsWithin(x, y, rad);
  let lo = -Infinity, hi = Infinity; const ivs = [];
  for (const k of ks) { const c = cells[k]; lo = Math.max(lo, c.lo); hi = Math.min(hi, c.hi); for (const [u, iv] of c.uivs) if (u !== skip) ivs.push(...iv); }
  ivs.sort((a, b) => a[0] - b[0]);
  const u = []; for (const [a, b] of ivs) { if (u.length && a <= u[u.length - 1][1] + 1e-9) u[u.length - 1][1] = Math.max(u[u.length - 1][1], b); else u.push([a, b]); }
  const gaps = []; let p = lo; for (const [a, b] of u) { if (a > p) gaps.push([p, Math.min(a, hi)]); p = Math.max(p, b); } if (hi > p) gaps.push([p, hi]);
  return gaps.filter(([a, b]) => b - a > 1e-6);
};
const H = setup.z1 - setup.z0;
const fmtRuns = (g) => g.map(([a, b]) => `${a.toFixed(3)}…${b.toFixed(3)} (${(b - a).toFixed(3)})`).join(', ') || 'none';
// an annulus's free runs (a coaxial wheel on a source's pipe, or the pipe
// itself): every tenant interval over the cells whose centre lies in
// [rIn − CM, rOut + CM] of (x, y)
const annulusRuns = (x, y, rIn, rOut, skip = null) => {
  let lo = -Infinity, hi = Infinity; const ivs = [], own = new Map();
  for (const k of cellsWithin(x, y, rOut + CM)) {
    const c = cells[k], cx = c.r * Math.cos(c.az * DEG), cy = c.r * Math.sin(c.az * DEG);
    if (Math.hypot(cx - x, cy - y) < rIn - CM) continue;
    lo = Math.max(lo, c.lo); hi = Math.min(hi, c.hi);
    for (const [u, iv] of c.uivs) if (u !== skip) for (const q of iv) { ivs.push(q); own.set(u, [...(own.get(u) || []), q]); }
  }
  ivs.sort((a, b) => a[0] - b[0]);
  const u = []; for (const [a, b] of ivs) { if (u.length && a <= u[u.length - 1][1] + 1e-9) u[u.length - 1][1] = Math.max(u[u.length - 1][1], b); else u.push([a, b]); }
  const gaps = []; let p = lo; for (const [a, b] of u) { if (a > p) gaps.push([p, Math.min(a, hi)]); p = Math.max(p, b); } if (hi > p) gaps.push([p, hi]);
  return { gaps: gaps.filter(([a, b]) => b - a > 1e-6), own };
};
// AT THE CENTRE, once: where each source could present a coaxial transfer
// wheel of its own size (the annulus from its bore to its tip, the stack
// excluded — the fold vacates its band), and what a pipe of §50's floor stock
// rising from the source's own stratum to each such stratum would cross.
console.log(`\nAT THE CENTRE — a coaxial transfer wheel on each source (stack excluded: the fold vacates the core's band ${setup.z0.toFixed(3)} … ${setup.z1.toFixed(3)}):`);
const centreFree = {};
for (const [k, src] of Object.entries(setup.sources)) {
  if (!src) continue;
  const wheelT = src.z1 - src.z0;
  const ann = annulusRuns(C.x, C.y, src.bore, src.tip, src.unit);
  const fits = ann.gaps.filter(([a, b]) => b - a >= wheelT + 2 * CM);
  centreFree[k] = fits;
  console.log(`  ${k.toUpperCase()}: free over r ${src.bore.toFixed(3)} … ${src.tip.toFixed(3)} for a wheel ${wheelT.toFixed(3)} thick: ${fmtRuns(fits)}`);
  for (const [a, b] of fits) {
    if (src.z0 >= a - 1e-9 && src.z1 <= b + 1e-9) { console.log(`    the source's own stratum lies in ${a.toFixed(3)} … ${b.toFixed(3)}: no pipe needed`); continue; }
    // the pipe: from the source's stratum to the nearer face of this run, at r bore … bore + stock
    const zA = Math.min(src.z1, b), zB = Math.max(src.z0, a);
    const pipe = annulusRuns(C.x, C.y, src.bore, src.bore + setup.STOCK, src.unit);
    const lo = Math.min(zA, zB), hi = Math.max(zA, zB);
    const crossing = {};
    for (const [u, list] of pipe.own) for (const [p, q] of list) if (q > lo + 1e-9 && p < hi - 1e-9) crossing[u] = (crossing[u] || 0) + 1;
    console.log(`    to reach ${a.toFixed(3)} … ${b.toFixed(3)} a pipe at r ${src.bore.toFixed(3)} … ${(src.bore + setup.STOCK).toFixed(3)} rises ${lo.toFixed(3)} … ${hi.toFixed(3)} through ${Object.keys(crossing).length ? Object.entries(crossing).sort((p, q) => q[1] - p[1]).map(([u, n]) => `${u} (${n} cells)`).join(', ') : 'nothing'}`);
  }
}
for (const s of (good.length ? good : picks)) {
  console.log(`\n== r ${s.r.toFixed(1)} az ${s.az.toFixed(1)}° — plan (${s.x.toFixed(3)}, ${s.y.toFixed(3)}); core ${s.exact.core.d === Infinity ? '≥ 0.75' : s.exact.core.d.toFixed(4)}, feeler ${s.exact.feeler.d === Infinity ? '≥ 0.75' : s.exact.feeler.d.toFixed(4)} at φ ${s.fPhi.toFixed(1)}°`);
  // the column: free runs over the core's footprint, and whether one holds the core's height plus a margin each side
  const runs = freeRuns(s.x, s.y, setup.R);
  const fit = runs.filter(([a, b]) => b - a >= H + 2 * CM);
  console.log(`  COLUMN over r ≤ ${setup.R.toFixed(3)} (dial back → plate face): free ${fmtRuns(runs)}; the core needs ${H.toFixed(3)} + 2·${CM} = ${(H + 2 * CM).toFixed(3)} — ${fit.length ? `fits in ${fmtRuns(fit)}` : 'NO run holds it'}`);
  // the idler paths
  const SD = Math.hypot(s.x - C.x, s.y - C.y);
  for (const [k, src] of Object.entries(setup.sources)) {
    if (!src) continue;
    const tipAdd = src.tip - src.R;                  // the addendum as the source is CUT (its tip off its pitch), for the twin and the idler alike: one module, one profile
    const twin = blockers(s.x, s.y, src.R + tipAdd, src.z0, src.z1);
    const nMin = Math.max(10, Math.ceil((2 * (SD / 2 - src.R)) / src.m - 1e-9));
    const sides = [];
    for (const side of [1, -1]) {
      let first = null; const tried = [];
      for (let n = nMin; n <= nMin + 24; n++) {
        const ri = src.m * n / 2, d = src.R + ri;
        if (d < SD / 2) continue;
        const h = Math.sqrt(d * d - (SD / 2) ** 2);
        const ux = (s.x - C.x) / SD, uy = (s.y - C.y) / SD;
        const ix = C.x + ux * SD / 2 - uy * h * side, iy = C.y + uy * SD / 2 + ux * h * side;
        const own = blockers(ix, iy, ri + tipAdd, src.z0, src.z1, src.unit);
        tried.push({ n, ri, ix, iy, own });
        if (own.size === 0) { first = { n, ri, ix, iy }; break; }
      }
      const t0 = tried[0];
      const strata = t0 ? freeRuns(t0.ix, t0.iy, t0.ri + tipAdd, src.unit) : [];
      const wheelT = src.z1 - src.z0;
      sides.push({ side, first, t0, strata: strata.filter(([a, b]) => b - a >= wheelT + 2 * CM), blockedBy: first ? null : (t0 ? fmtOwn(t0.own) : 'no geometry') });
    }
    // the equal-pitch direct pair: both wheels of pitch |S|/2, meshing on the line
    const eq = blockers(C.x, C.y, SD / 2 + tipAdd, src.z0, src.z1, src.unit), eqS = blockers(s.x, s.y, SD / 2 + tipAdd, src.z0, src.z1);
    console.log(`  ${k.toUpperCase()} (${src.unit}, ${src.teeth} T, m ${src.m.toFixed(4)}, R ${src.R.toFixed(3)}, stratum ${src.z0.toFixed(3)}…${src.z1.toFixed(3)}): `
      + `twin at the station (tip ${(src.R + tipAdd).toFixed(3)}) ${twin.size ? 'BLOCKED by ' + fmtOwn(twin) : 'clear'} in the source's stratum; `
      + `free strata for the twin over its footprint: ${fmtRuns(freeRuns(s.x, s.y, src.R + tipAdd).filter(([a, b]) => b - a >= (src.z1 - src.z0) + 2 * CM))}`);
    for (const sd of sides) {
      const where = sd.first ? `the smallest clear idler is ${sd.first.n} T (pitch ${sd.first.ri.toFixed(3)}) at (${sd.first.ix.toFixed(3)}, ${sd.first.iy.toFixed(3)}), r ${Math.hypot(sd.first.ix - C.x, sd.first.iy - C.y).toFixed(3)} from the axis`
        : `no idler of ${nMin}–${nMin + 24} T stands clear in the source's stratum (the smallest blocked by ${sd.blockedBy})`;
      console.log(`    side ${sd.side > 0 ? '+' : '−'}: ${where}; strata free over the smallest idler's footprint (${sd.t0 ? sd.t0.n + ' T at (' + sd.t0.ix.toFixed(2) + ', ' + sd.t0.iy.toFixed(2) + ')' : '—'}) for a wheel of the source's thickness: ${fmtRuns(sd.strata)}`);
    }
    console.log(`    equal-pitch direct pair (pitch ${(SD / 2).toFixed(3)} at both ends — reverses the sense, so BOTH transfers would have to): at the axis ${eq.size ? 'BLOCKED by ' + fmtOwn(eq) : 'clear'}, at the station ${eqS.size ? 'BLOCKED by ' + fmtOwn(eqS) : 'clear'}`);
  }
  if (s.viaLift) console.log(`  SET BY THE EXISTING LIFT: the satellite's disc meshes i1b directly, centre distance ${(setup.lift.rb + setup.lift.discR).toFixed(3)} as today — no new set idler, today's ratio and sense`);
  // the run to the lock, from the feeler's tail end carried to the station
  const q = rot([setup.tailEnd.x, setup.tailEnd.y], s.fPhi * DEG);
  const T = { x: s.x + q.x, y: s.y + q.y, z: setup.tailEnd.z };
  for (const [nm, L] of Object.entries(setup.lock)) {
    const X = C.x + L.x, Y = C.y + L.y, run = Math.hypot(X - T.x, Y - T.y);
    // a straight run at the tail's plane, a 0.14 bar (the feeler's own half-width), stepped at 0.25
    let blocked = 0, steps = 0; const owners = {};
    for (let t = 0; t <= run; t += 0.25) {
      steps++;
      const x = T.x + (X - T.x) * t / run, y = T.y + (Y - T.y) * t / run;
      const own = blockers(x, y, 0.14, T.z - 0.14, T.z + 0.14);
      if (own.size) { blocked++; for (const u of own.keys()) owners[u] = (owners[u] || 0) + 1; }
    }
    console.log(`  RUN to the lock's ${nm} (${X.toFixed(2)}, ${Y.toFixed(2)}, z ${L.z0.toFixed(3)}…${L.z1.toFixed(3)}): plan ${run.toFixed(3)} from the tail's end (${T.x.toFixed(2)}, ${T.y.toFixed(2)}, z ${T.z.toFixed(3)}), `
      + `rise ${(Math.max(L.z0, Math.min(L.z1, T.z)) - T.z).toFixed(3)}; a straight bar at the tail's plane is blocked over ${blocked} of ${steps} steps${blocked ? ' (' + Object.entries(owners).sort((a, b) => b[1] - a[1]).slice(0, 4).map(([u, n]) => `${u} ${n}`).join(', ') + ')' : ''}`);
  }
}
// and today's run, for comparison
{
  const T = { x: C.x + setup.tailEnd.x, y: C.y + setup.tailEnd.y };
  const P = setup.lock.pivot;
  console.log(`\ntoday (the detector on the centre column): the feeler's tail end at (${T.x.toFixed(2)}, ${T.y.toFixed(2)}), plan ${Math.hypot(C.x + P.x - T.x, C.y + P.y - T.y).toFixed(3)} to the lock's pivot`);
}

// restore the retired members
await page.evaluate(() => { const D = window.__D; for (const r of D.retired) r.parent.add(r.o); D.clock.resetInputs(); D.clock.setPose({}); });

console.log('\nCONTROLS');
const ctl = [
  ['K1 the core at the disc\'s own axis meets the centre column', k1ok, fmtOwn(k1)],
  ['K2 the scan\'s plants: the block reads its interval and nothing far; the off-ray pin is missed by the ray and caught by the surface', k2ok, pl ? `got ${JSON.stringify(pl.got.map((x) => x.map((z) => +z.toFixed(4))))} want ${JSON.stringify(pl.want.map((z) => +z.toFixed(4)))}, far ${pl.missCount}, pin ray ${pl.pinRayHits}, pin surface ${pl.pinSurf ? pl.pinSurf.map((z) => z.toFixed(4)).join('…') : 'none'}` : 'no plant cell'],
  ['K3 exact: the hub reads its running fit on the tube, and the core ghost at the axis meets the tube', k3ok, `fit ${exact.fit.toFixed(5)} in [${k3lo.toFixed(5)}, 0.05] (bore + 0.05 less the ${exact.hubSeg}-facet bore's sagitta), core on tube ${exact.coreOnTube.toFixed(4)}`],
  ['K4 the identity carry reproduces the feeler\'s metal exactly', k4ok, `max deviation ${exact.k4}`],
  ['K5 the core envelope contains every vertex of its metal', setup.k5 === 0, `${setup.k5} outside`],
];
let bad = 0;
for (const [n, ok, got] of ctl) { if (!ok) bad++; console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${n} — ${got}`); }
console.log(`\nsearch warnings ${warns.length}${warns.length ? ': ' + warns.slice(0, 3).join(' | ') : ''}`);
await Promise.race([browser.close(), new Promise((r) => setTimeout(r, 5000))]);
process.exit(bad ? 2 : 0);
