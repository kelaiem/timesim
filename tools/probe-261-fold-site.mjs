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
//  K8 the linkage is 1:1 over the whole stroke: the shortest one, swung by
//     forward kinematics (the rod pinned at both ends), moves the pawl forward
//     by the stem's travel to within one CLEAR_MARGIN.
//
// THE LINKAGE (the owner's call after the single crank's forced ratio): two
// 1:1 cranks and a rod, today's stem held exactly. Each crank is determined by
// the rod's line, so the search runs over φ, the rod line and which band the
// rod runs in, and reports the shortest linkages whose every member finds room
// over the stroke — see the block above `linkagesAt` for its bounds.
//
// AND HOW THE LAST PIN REACHES THE DRIVER, which the first version got wrong.
// At the folded driver the pin's track lies INSIDE the column wheel's
// footprint (r ≈ 5.1 from its axis against a solid base to 5.7 and a saw to
// 6.4), and the search exempted that column as "the coupling" — so it reported
// a rod-under-the-dial linkage whose last riser would have to pass through the
// wheel. The 'dial' configuration now counts the folded wheel's samples in the
// pin's column below the driver's dial face and refuses on any (it is refused
// at every φ). In the cluster's own frame the pin always rose to the driver
// through a three-quarter-plate slot, so folded it comes DOWN through a slot
// in the base plate, from between the plates: the 'slot' configuration keeps
// every member between the plates, both cranks on studs, and requires the
// pin's drop column clear from the plate up to the arm that carries it.
//
// THE DIAL-SIDE BEAK AND THE LAY SHAFT (landing 2c's siting): at the one fold
// on the stop wheel's pitch (240°), the same-side beak landing 2b designed
// (`clock.lineLaws.seat(run, stroke, +1)`) is stood on every ray that keeps
// the castellations' phase (today's + φ + k × 60°) at every run, and each
// member is tested where it moves: the bar swept through its seat tilt, its
// underside the seat law's lift off the column tops (the castellations and
// the column base are the seat law's to clear, not obstacles here), the
// pivot post up to the plate face, the foot down to the lay shaft's rim. The
// lay shaft then runs from the foot to the ring's tab at any azimuth, held
// where a hanger can rise to the plate. Its section is what its governing
// span asks (§54's λ = L/d target, an overhang counted SLENDER_OVERHANG_K
// long, the lathe's L/D on the whole bar), and a shaft of THAT section must
// clear. The shaft is judged by DISTANCE to the band scan's surface samples
// (a cell is the shaft's whole margin), read down by the sample lattice's
// STEP/√3. The last 1.8 of the chord is the crank's working zone over the
// ring, trimmed exactly as the build's §112 `scoreChord` trims it.
//  K9 that shaft test passes the shipped shaft: today's rod to today's tab,
//     at today's stratum and section, reads clear (it is green in every gate).
//
// `--dump FILE` writes the browser half's measurements; `--from FILE` reads
// them back and skips the browser (the Node half takes ~4 min). A run from a
// dump is only as current as the tree that wrote it.
//
// Run from tools/: node probe-261-fold-site.mjs
import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { readFileSync, writeFileSync } from 'node:fs';
import { dialBandScan } from './dial-band-scan.mjs';
const GRID = { DR: 0.5, DAZ_DEG: 2.5 };
const MOVED = ['Alarm switch', 'Alarm lock', 'Alarm link'];
const argv = process.argv.slice(2);
const argOf = (k) => (argv.includes(k) ? argv[argv.indexOf(k) + 1] : null);
const FROM = argOf('--from'), DUMP = argOf('--dump');

// ---- the browser half: two band scans and the cluster's swept cloud ----------
// `--dump FILE` writes what it measured and `--from FILE` reads it back instead
// of booting, so the Node half (the fold, the line tests, the linkage search)
// can be iterated in seconds. A run from a dump is only as current as the tree
// that wrote it: the acceptance run is always the one without `--from`.
async function measure() {
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

  // the lay shaft's stratum, read off its own mesh at the reference pose: the
  // band scan returns its surface samples a unit either side of it, which is
  // what the lay shaft's corridor (landing 2c) is measured against — a cell
  // there is 0.5 u, the shaft's whole margin
  const shaftZWin = await page.evaluate(async () => {
    const THREE = await import('three'); const clock = window.__clock;
    clock.resetInputs(); clock.setPose({}); clock.scene.updateMatrixWorld(true);
    let m = null; clock.scene.traverse((o) => { if (!m && o.isMesh && o.name === 'alarmLinkShaft' && !o.userData.schematic) m = o; });
    if (!m) return null;
    const b = new THREE.Box3().setFromObject(m, true);
    return [b.min.z - 1, b.max.z + 1];
  });
  const band = await page.evaluate(dialBandScan, { GRID, exclude: MOVED, pointsZ: shaftZWin });
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
    // §261 landing 2c — what the dial-side beak and the re-sited lay shaft are
    // designed from: the link reference's own rows (the gate's evaluator), the
    // seat law's SAME-SIDE solve over the runs it could take, today's lever ray
    // (the wheel → rod direction, which sets the castellation phase the nose
    // reads), the lay shaft's stratum and the ring tab the shaft drives
    const byName = (n) => { let m = null; clock.scene.traverse((o) => { if (!m && o.isMesh && o.name === n && !o.userData.schematic) m = o; }); return m; };
    const LL = clock.lineLaws, refOf = (n) => I.LINE_SPECS.find((r) => r.name === n);
    const drvRef = I.lineSpecEvaluate(refOf('alarm switch drive'), {}, null, LL).out;
    // (TODO 240 retired the radial 'alarm link' reference for the tangential
    // lever's; the seat law below is that lever's now, so this table describes it)
    const lk = I.lineSpecEvaluate(refOf('alarm link tangential'), drvRef, null, LL).out;
    const seatTable = [];
    for (let run = 1.5; run <= 16 + 1e-9; run += 0.25) { const q = LL.seat(run, lk.rodTravel, 1); seatTable.push({ run, beakLen: q.beakLen, tailLen: q.tailLen, theta: q.theta, lift: q.lift, h: q.h }); }
    const rodM = byName('alarmLinkRod'), shaftM = byName('alarmLinkShaft'), tabM = byName('alarmSelTab'), castM = byName('alarmColCastellations');
    const link = {
      landR: lk.landR, rodTravel: lk.rodTravel, footRest: lk.footRest, colH: lk.colH, noseWRad: null,
      rod: rodM ? centre(rodM) : null, shaft: shaftM ? centre(shaftM) : null, tab: tabM ? centre(tabM) : null,
      cast: castM ? centre(castM) : null, seatTable,
      // the bar's plan width (main.js ALARM_LINK_ARM_W, one ratchet tooth), read
      // off the cut box's own local extent — the new beak is cut to the same
      armW: (() => { const m = byName('alarmLinkBeakBar'); if (!m) return null; m.geometry.computeBoundingBox(); const b = m.geometry.boundingBox; return b.max.y - b.min.y; })(),
    };
    const sel = centre(selector);
    return {
      points: [...cloud.values()], members: members.map((m) => m.name || m.geometry.type), atRest, poses: poses.length + 1,
      A: { x: A.x, y: A.y }, W: { x: W.x, y: W.y }, zBase, pin, drv, sel,
      stemD: stemBox.max.z - stemBox.min.z,             // a round stem lying in plan: its z extent is its diameter
      stemZ: (stemBox.min.z + stemBox.max.z) / 2,        // its axis, today: the stratum it runs in between the plates
      riserHalf: (() => { const b = boxOf(riser); return Math.min(b.max.x - b.min.x, b.max.y - b.min.y) / 2; })(),
      pushAz: (() => { const b = boxOf(stem); const c = { x: (b.min.x + b.max.x) / 2, y: (b.min.y + b.max.y) / 2 }; return Math.atan2(c.y, c.x); })(),
      collarAnnulus: [cMin, cMax], collarTipR: (() => { const sh = collar.geometry.parameters.shapes; const s = Array.isArray(sh) ? sh[0] : sh; return Math.max(...s.getPoints().map((q) => Math.hypot(q.x, q.y))); })(),
      padCell, CLEAR_MARGIN: L.CLEAR_MARGIN, link,
    };
  });
  return { band, inter, cl };
}
const { band, inter, cl } = FROM ? JSON.parse(readFileSync(FROM, 'utf8')) : await measure();
if (DUMP) writeFileSync(DUMP, JSON.stringify({ band, inter, cl }));

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

// ---- THE LINKAGE: two 1:1 cranks joined by a rod (the owner's call) ---------
// The single crank's pivot is forced and its ratio with it, so the corner is
// two cranks with EQUAL arms and a rod between them: the button keeps its
// station, its stroke and its force, and the pawl gets exactly what the stem
// gives today. Given the rod's line, each crank is determined: its pivot stands
// on the line through its pin square to that pin's travel, at the distance a
// that puts it as far from the rod's line as from the pin (two mirror
// solutions), and its other arm ends on the rod's line square to it. So the
// search runs over the fold φ, the rod line (angle θ, offset c), the two mirror
// choices and the band the rod runs in, and keeps a linkage only when:
//  · both arms of each crank are at least A_MIN — an arm shorter than s²/(8·CM)
//    sags off its chord by more than one CLEAR_MARGIN over the stroke, so a pin
//    coupling would need a slot longer than the margin the movement carries
//    (a SCOPING bound, like step 2's 3.1 u depth: the design derives its own),
//    and at most A_MAX, half the case radius — a search bound, reported when hit;
//  · the crank driven by the rod turns the folded pawl the way the stem does
//    today (the rod may push or pull);
//  · every member, swept over the stroke, finds a z window at least the §50
//    floor plus a margin each side, common to every cell it sweeps, in its
//    band; at the crank that crosses the base plate the metal is clear from
//    each window to the plate (its arbor runs through it), while the other
//    members may stand at any stratum, a riser carrying the last arm's end to
//    the pawl as the stem's riser does today; and in the dial band the
//    folded cluster itself is an obstacle, except where the last arm meets the
//    pawl, which is the coupling.
// Ranked by total length (four arms and the rod), shortest first.
const LAY = await import('../src/layout.js');
const A_MIN = stroke * stroke / (8 * CM), A_MAX = CASE_R_IN / 2;
const MIN_WIN = LAY.STOCK_MIN_U + 2 * CM;
const perp = (v) => ({ x: -v.y, y: v.x });
const dot = (u, v) => u.x * v.x + u.y * v.y;
const sub = (u, v) => ({ x: u.x - v.x, y: u.y - v.y });
const rotAbout = (P, X, th) => { const c = Math.cos(th), s2 = Math.sin(th), dx = X.x - P.x, dy = X.y - P.y; return { x: P.x + c * dx - s2 * dy, y: P.y + s2 * dx + c * dy }; };
function segCells(A, B, out) {
  const L = Math.hypot(B.x - A.x, B.y - A.y), n = Math.max(1, Math.ceil(L / 0.25));
  for (let j = 0; j <= n; j++) for (const k of nearCellsR(A.x + (B.x - A.x) * j / n, A.y + (B.y - A.y) * j / n, CM)) out.add(k);
}
function armCells(P, E, th, out) { for (let i = 0; i <= 4; i++) segCells(P, rotAbout(P, E, th * i / 4), out); }
function rodCells(A, B, v, out) { for (let i = 0; i <= 4; i++) { const d = stroke * i / 4; segCells({ x: A.x + v.x * d, y: A.y + v.y * d }, { x: B.x + v.x * d, y: B.y + v.y * d }, out); } }
const minus = (ivs, o) => { if (!o) return ivs; const out = []; for (const [a, b] of ivs) { if (o[1] <= a || o[0] >= b) out.push([a, b]); else { if (o[0] > a) out.push([a, o[0]]); if (o[1] < b) out.push([o[1], b]); } } return out; };
// a group's common windows (every free interval at least MIN_WIN tall, common
// to every cell it sweeps), and the crossing arbor's column: at the pivot that
// runs through the base plate the metal must be clear from the window to the
// plate itself, on that band's plate side (the floor between the plates, the
// ceiling under the dial). The other members may stand at any stratum: a riser
// carries the last arm's end to the pawl, as the stem's riser does today.
function groupWindows(cellsB, ks, obs) {
  let win = null;
  for (const k of ks) { const f = minus(freeOf(cellsB[k]), obs && obs.get(k)); win = win === null ? f : meet(win, f); if (!win.length) return []; }
  return (win || []).filter(([a, b]) => b - a >= MIN_WIN);
}
function columnClear(cellsB, ks, obs, w, side) {
  for (const k of ks) {
    const c = cellsB[k], f = minus(freeOf(c), obs && obs.get(k));
    const need = side === 'floor' ? [c.lo, w[1]] : [w[0], c.hi];
    if (!f.some(([a, b]) => a <= need[0] + 1e-6 && b >= need[1] - 1e-6)) return false;
  }
  return true;
}
function pickWindow(cellsB, ks, obs, pivot, side) {
  const ws = groupWindows(cellsB, ks, obs).filter((w) => !pivot || columnClear(cellsB, pivot, obs, w, side));
  return ws.length ? ws.reduce((m, w) => (w[1] - w[0] > m[1] - m[0] ? w : m)) : null;
}
const p0 = { x: cl.pin[0].x, y: cl.pin[0].y };
const d0 = { x: (cl.pin[1].x - p0.x) / stroke, y: (cl.pin[1].y - p0.y) / stroke }, n0 = perp(d0);
// forward kinematics over the whole stroke: crank A turned by the stem, the rod
// pinned at both ends (its far end found on crank B's circle), crank B turned by
// the rod. Returns the stem pin's travel along its press and the pawl's along its.
function swing(k, q0, dq) {
  const th = k.sA * stroke / Math.abs(k.a);
  const pin1 = rotAbout(k.PA, p0, th), EA1 = rotAbout(k.PA, k.EA, th);
  const rb = Math.abs(k.b), dxy = sub(EA1, k.PB), D = Math.hypot(dxy.x, dxy.y);
  const aa = (rb * rb - k.rod * k.rod + D * D) / (2 * D), h2 = rb * rb - aa * aa;
  if (!(h2 >= 0)) return null;                        // the rod cannot reach: the linkage locks
  const hh = Math.sqrt(h2), mid = { x: k.PB.x + aa * dxy.x / D, y: k.PB.y + aa * dxy.y / D };
  const cA = { x: mid.x - hh * dxy.y / D, y: mid.y + hh * dxy.x / D }, cB = { x: mid.x + hh * dxy.y / D, y: mid.y - hh * dxy.x / D };
  const EB1 = Math.hypot(cA.x - k.EB.x, cA.y - k.EB.y) < Math.hypot(cB.x - k.EB.x, cB.y - k.EB.y) ? cA : cB;
  const thB = Math.atan2(EB1.y - k.PB.y, EB1.x - k.PB.x) - Math.atan2(k.EB.y - k.PB.y, k.EB.x - k.PB.x);
  const q1 = rotAbout(k.PB, q0, thB);
  return { inp: dot(sub(pin1, p0), d0), outp: dot(sub(q1, q0), dq) };
}
// the sweep is the slow half, so each φ sweeps at most SWEEP_CAP candidates,
// shortest first; a band that found nothing BEFORE the cap is reported as such,
// never as infeasible
const SWEEP_CAP = 4000;
let obsBites = 0;
const stemCol = new Set(); segCells(p0, { x: cl.pin[1].x, y: cl.pin[1].y }, stemCol);
function linkagesAt(r) {
  const phi = r.deg * DEG;
  const [qx0, qy0] = fold(cl.pin[0].x, cl.pin[0].y, 0, phi), [qx1, qy1] = fold(cl.pin[1].x, cl.pin[1].y, 0, phi);
  const q0 = { x: qx0, y: qy0 }, dq = { x: (qx1 - qx0) / stroke, y: (qy1 - qy0) / stroke }, nq = perp(dq);
  // the folded cluster in the dial band, per cell (its z hull there), the coupling exempt
  const obs = new Map(), cpl = new Set();
  segCells(q0, { x: qx1, y: qy1 }, cpl);
  for (const [x, y, z] of cl.points) {
    const [X, Y, Z] = fold(x, y, z, phi), k = cellOf(X, Y);
    if (k < 0 || cpl.has(k) || Z > cells[k].hi) continue;
    const o = obs.get(k); if (!o) obs.set(k, [Z, Z]); else { if (Z < o[0]) o[0] = Z; if (Z > o[1]) o[1] = Z; }
  }
  const cand = [];
  for (let td = 0; td < 180; td += 1) {
    const m = { x: Math.cos(td * DEG), y: Math.sin(td * DEG) }, t = perp(m);
    for (let c = -CASE_R_IN; c <= CASE_R_IN; c += 0.5) {
      for (const sa of [1, -1]) for (const sb of [1, -1]) {
        const gA = dot(m, n0), gB = dot(m, nq);
        if (Math.abs(sa - gA) < 1e-6 || Math.abs(sb - gB) < 1e-6) continue;
        const a = (c - dot(m, p0)) / (gA - sa), b = (c - dot(m, q0)) / (gB - sb);
        if (!(Math.abs(a) >= A_MIN && Math.abs(a) <= A_MAX && Math.abs(b) >= A_MIN && Math.abs(b) <= A_MAX)) continue;
        const PA = { x: p0.x + a * n0.x, y: p0.y + a * n0.y }, PB = { x: q0.x + b * nq.x, y: q0.y + b * nq.y };
        const hA = dot(m, PA) - c, hB = dot(m, PB) - c;
        const EA = { x: PA.x - hA * m.x, y: PA.y - hA * m.y }, EB = { x: PB.x - hB * m.x, y: PB.y - hB * m.y };
        const rod = Math.hypot(EB.x - EA.x, EB.y - EA.y);
        if (rod < 2 * CM) continue;
        const inCase = (P) => Math.hypot(P.x, P.y) <= CASE_R_IN - CM;
        if (![PA, PB, EA, EB].every(inCase)) continue;
        // senses: the stem drives p0 along +d0; the rod carries E_A's motion to E_B
        const sA = Math.sign(dot(perp(sub(p0, PA)), d0)) || 1;
        const pA = perp(sub(EA, PA)), vA = { x: sA * pA.x / Math.abs(a), y: sA * pA.y / Math.abs(a) };
        const sB = Math.sign(dot(perp(sub(EB, PB)), vA)) || 1;
        const out = perp(sub(q0, PB));
        if (!(sB * dot(out, dq) > 0)) continue;
        const k0 = { a, b, PA, PB, EA, EB, rod, sA };
        const sw = swing(k0, q0, dq);
        // 1:1 over the WHOLE stroke, not only at its start: the pawl's travel
        // within one CLEAR_MARGIN of the stem's (the same bound A_MIN holds the sag to)
        if (!sw || !(sw.outp > 0) || Math.abs(sw.outp - sw.inp) > CM) continue;
        cand.push({ td, c, a, b, PA, PB, EA, EB, rod, vA, sA, sB, sw, len: 2 * Math.abs(a) + 2 * Math.abs(b) + rod });
      }
    }
  }
  cand.sort((u, v) => u.len - v.len);
  const found = { dial: [], plates: [], slot: [] };
  // the pin's own drop: at the folded driver the pin's track lies INSIDE the
  // column wheel's footprint (r 5.0–5.2 against a solid base to 5.7 and a saw
  // to 6.4), so no member can reach it from the dial side — the wheel is in
  // the way. Today the pin rises to the driver through a slot in the
  // three-quarter plate; folded, it comes DOWN through a slot in the base
  // plate, from between the plates. Its column over the whole track must be
  // clear from the plate top up to the arm that carries it.
  const drop = new Set(); segCells(q0, { x: qx1, y: qy1 }, drop);
  // and from the DIAL side the same column is the wheel's: any folded cluster
  // metal in it dialward of the driver's own dial face stands between an arm
  // under the dial and the pin it would have to raise (the coupling exemption
  // above spares the cells, not this column — the first version of this search
  // exempted it, and reported a dial-side linkage the wheel makes impossible)
  const drvIdx = cl.members.indexOf('alarmColDriver');
  let drvFace = Infinity;
  for (const [x, y, z, mi] of cl.points) if (mi === drvIdx) drvFace = Math.min(drvFace, fold(x, y, z, phi)[2]);
  let dialDropBlocked = 0;
  for (const [x, y, z] of cl.points) {
    const [X, Y, Z] = fold(x, y, z, phi);
    if (Z < drvFace - 1e-6 && drop.has(cellOf(X, Y))) dialDropBlocked++;
  }
  let checked = 0;
  for (const k of cand) {
    if ((found.dial.length >= 3 && found.plates.length >= 3 && found.slot.length >= 3) || checked >= SWEEP_CAP) break;
    checked++;
    const thA = k.sA * stroke / Math.abs(k.a), thB = k.sB * stroke / Math.abs(k.b);
    const aIn = new Set(), aOut = new Set(), rodS = new Set(), bIn = new Set(), bOut = new Set(), pvA = new Set(), pvB = new Set();
    armCells(k.PA, p0, thA, aIn); armCells(k.PA, k.EA, thA, aOut); rodCells(k.EA, k.EB, k.vA, rodS);
    armCells(k.PB, k.EB, thB, bIn); armCells(k.PB, q0, thB, bOut);
    for (const kk of nearCellsR(k.PA.x, k.PA.y, CM)) pvA.add(kk); for (const kk of nearCellsR(k.PB.x, k.PB.y, CM)) pvB.add(kk);
    const U = (...ss) => { const o = new Set(); for (const x of ss) for (const y of x) o.add(y); return o; };
    for (const cfg of ['dial', 'plates', 'slot']) {
      if (found[cfg].length >= 3) continue;
      if (cfg === 'slot') {
        // everything between the plates: both cranks on studs planted in the
        // base plate, the rod beside them, and crank B's pin dropping through
        // a base-plate slot into the folded driver
        const g = U(aIn, aOut, rodS, bIn, bOut, pvA, pvB);
        const ws = groupWindows(IC, g, null).filter((w) => columnClear(IC, U(pvA, pvB, drop), null, w, 'floor'));
        if (!ws.length) continue;
        const wS = ws.reduce((m, w) => (w[1] - w[0] > m[1] - m[0] ? w : m));
        if (!(wS[0] <= cl.stemZ + rad && wS[1] >= cl.stemZ - rad)) {
          const lo2 = Math.min(wS[1], cl.stemZ), hi2 = Math.max(wS[0], cl.stemZ);
          if ([...stemCol].some((kk) => !freeOf(IC[kk]).some(([a2, b2]) => a2 <= lo2 + 1e-6 && b2 >= hi2 - 1e-6))) continue;
        }
        found.slot.push({ ...k, wP: wS, wD: null, cfg });
        continue;
      }
      // dial: crank A crosses the plate (its input arm between the plates), rod and crank B under the dial
      // plates: crank A and the rod between the plates, crank B crosses the plate (its output arm under the dial)
      const gP = cfg === 'dial' ? U(aIn, pvA) : U(aIn, aOut, rodS, bIn, pvA, pvB);
      const gD = cfg === 'dial' ? U(aOut, rodS, bIn, bOut, pvA, pvB) : U(bOut, pvB);
      const cross = cfg === 'dial' ? pvA : pvB;          // the pivot whose arbor runs through the base plate
      const wP = pickWindow(IC, gP, null, cross, 'floor');
      if (!wP) continue;
      // the stem meets crank A's input arm: at the stem's own stratum, or by a
      // riser from it, whose column over the pin's travel must be clear
      if (!(wP[0] <= cl.stemZ + rad && wP[1] >= cl.stemZ - rad)) {
        const lo2 = Math.min(wP[1], cl.stemZ), hi2 = Math.max(wP[0], cl.stemZ);
        if ([...stemCol].some((kk) => !freeOf(IC[kk]).some(([a2, b2]) => a2 <= lo2 + 1e-6 && b2 >= hi2 - 1e-6))) continue;
      }
      if (cfg === 'dial' && dialDropBlocked) continue;
      const wD = pickWindow(cells, gD, obs, cross, 'ceiling');
      if (!wD) { if (pickWindow(cells, gD, null, cross, 'ceiling')) obsBites++; continue; }
      found[cfg].push({ ...k, wP, wD, cfg });
    }
  }
  return { deg: r.deg, n: cand.length, checked, found, dialDropBlocked };
}
const linkage = feasible.map(linkagesAt);
const allFound = linkage.flatMap((L) => [...L.found.dial, ...L.found.plates].map((x) => ({ ...x, deg: L.deg })));
const shortest = allFound.sort((u, v) => u.len - v.len)[0];

// ---- THE DIAL-SIDE BEAK AND THE LAY SHAFT (§261 landing 2c's siting) --------
// The swap folds at ONE φ: the lock's finger meets the striking rotor's stop
// wheel, whose phase against the cam is when the stop catches, so turning the
// lock about the arbor by anything but a whole tooth pitch re-clocks the stop
// against the hammer. The fold is the feasible φ that is a whole multiple of
// the stop wheel's pitch (360°/12 = 30°): 240°, the only one in the range.
// At that fold the new beak (landing 2b's same-side lever) stands on a ray off
// the folded wheel: its nose must read the castellations in today's phase, so
// the ray is today's lever ray turned by the fold, plus any whole column pitch
// (360°/6 — the castellation pattern repeats per column). Along the ray the nose
// lands at landR, the tail's FOOT at landR + run (over the lay shaft's rim) and
// the pivot at landR + beakLen (the seat law, side +1, at that run). The lay
// shaft keeps its stratum and section and runs from the foot to its inner end
// at the ring tab's reach. Every member, swept where it moves, must clear the
// band's tenants, the folded cluster and the 240° linkage's rod-under-the-dial
// group, each held to CLEAR_MARGIN.
const STOP_PITCH = 2 * Math.PI / 12, COL_PITCH = 2 * Math.PI / 6;
const PHI_FOLD_DEG = (() => { const m = feasible.filter((r) => Math.abs(Math.round(r.deg * DEG / STOP_PITCH) * STOP_PITCH - r.deg * DEG) < 1e-9); return m.length === 1 ? m[0].deg : null; })();
const beakSite = (() => {
  const lk = cl.link;
  if (PHI_FOLD_DEG === null || !lk || !lk.rod || !lk.shaft || !lk.cast) return { error: `no single fold on the stop wheel's pitch (${PHI_FOLD_DEG}) or the link's inputs are missing` };
  const phi = PHI_FOLD_DEG * DEG;
  const [wx, wy] = fold(cl.W.x, cl.W.y, 0, phi);
  const Wf = { x: wx, y: wy };
  const aOld = Math.atan2(lk.rod.y - cl.W.y, lk.rod.x - cl.W.x);
  const zFace = band.Z_CEIL - (lk.cast.z1 - zBase);          // the castellation tops, folded: the face the nose rides from the dial side
  const shaftZ = (lk.shaft.z0 + lk.shaft.z1) / 2, shaftR = (lk.shaft.z1 - lk.shaft.z0) / 2;
  const rimTop = shaftZ + lk.footRest;
  // obstacles in the dial band: the folded cluster's hull per cell, and the
  // 240° linkage's dial-side group held over its whole window
  // The bar's clearance over the castellations and the column base is the seat
  // law's own (`_barLiftFor` sweeps the cut profile at every radius the columns
  // occupy, through the tilt): an in-group P2 fact the build asserts, so those
  // two members are not obstacles here — counting their coarse per-cell hull
  // would read the designed lift as a collision. Every other folded member is.
  const SEAT_PRICED = new Set(['alarmColCastellations', 'alarmColBase'].map((n) => cl.members.indexOf(n)));
  const obs = new Map();
  for (const [x, y, z, mi] of cl.points) {
    if (SEAT_PRICED.has(mi)) continue;
    const [X, Y, Z] = fold(x, y, z, phi), k = cellOf(X, Y);
    if (k < 0 || Z > cells[k].hi) continue;
    const o = obs.get(k); if (!o) obs.set(k, [Z, Z]); else { if (Z < o[0]) o[0] = Z; if (Z > o[1]) o[1] = Z; }
  }
  const L240 = linkage.find((L) => L.deg === PHI_FOLD_DEG), lnk = L240 && L240.found.dial[0];
  const lnkCells = new Set();
  if (lnk) {
    const [qx0, qy0] = fold(cl.pin[0].x, cl.pin[0].y, 0, phi);
    const thA = lnk.sA * stroke / Math.abs(lnk.a), thB = lnk.sB * stroke / Math.abs(lnk.b);
    armCells(lnk.PA, lnk.EA, thA, lnkCells); rodCells(lnk.EA, lnk.EB, lnk.vA, lnkCells);
    armCells(lnk.PB, lnk.EB, thB, lnkCells); armCells(lnk.PB, { x: qx0, y: qy0 }, thB, lnkCells);
  }
  const lnkIv = lnk ? lnk.wD : null;
  // a body over (x, y) with plan reach r, between zA and zB — clear of every
  // tenant, the cluster (unless exempt) and the linkage, or the first blocker
  const clearAt = (x, y, r, zA, zB, exempt = null, skipUnit = null, linkageOnly = false) => {
    for (const k of nearCellsR(x, y, r + CM)) {
      const c = cells[k];
      if (!linkageOnly) for (const [u, ivs] of c.uivs) { if (u === skipUnit) continue; for (const [z0, z1] of ivs) if (zB + CM > z0 && zA - CM < z1) return u; }
      const o = obs.get(k);
      if (linkageOnly) { if (lnkIv && lnkCells.has(k) && zB + CM > lnkIv[0] && zA - CM < lnkIv[1]) return 'pusher linkage'; continue; } if (o && !(exempt && exempt.has(k)) && zB + CM > o[0] && zA - CM < o[1]) return 'folded cluster';
      if (lnkIv && lnkCells.has(k) && zB + CM > lnkIv[0] && zA - CM < lnkIv[1]) return 'pusher linkage';
    }
    return null;
  };
  // `meet`: the coupling at B's end — within `meet.reach` of B the named unit
  // is the member this body is designed to engage, not an obstacle
  const seg = (A, B, r, zA, zB, ex, meet = null, linkageOnly = false) => { const L = Math.hypot(B.x - A.x, B.y - A.y), n = Math.max(1, Math.ceil(L / 0.25)); for (let j = 0; j <= n; j++) { const skip = meet && L * (1 - j / n) <= meet.reach ? meet.unit : null; const u = clearAt(A.x + (B.x - A.x) * j / n, A.y + (B.y - A.y) * j / n, r, zA, zB, ex, skip, linkageOnly); if (u) return u; } return null; };
  // the lay shaft's inner end carries the fork that takes the ring's tab: over
  // the fork's span (main.js ALARM_FORK_RETREAT, 1.1) plus the crank's own
  // section the selector is the member it meets
  const FORK_MEET = { unit: 'Alarm selector', reach: CM };
  // The shaft ENDS a fork span short of the tab (main.js ALARM_FORK_RETREAT,
  // "the pin's span, root at the shaft's end to tip at the tab"), and what
  // spans the rest — the centre crank, its pin, the fork block on the tab — is
  // seated by the build's own §112 solve against the real metal (the rim
  // guard, the post guard, the tab score), which this grid is far too coarse to
  // second-guess. So the probe judges the shaft's BODY, T → the fork's root,
  // and leaves the fork span to the solve that already owns it.
  // The trim is the build's own (main.js scoreChord, §112): "the last 1.8 of
  // the chord is the crank's WORKING zone over the ring — its clearances are
  // the fork/crank contacts' own asserts". The fork span (1.1) lies inside it.
  const FORK_SPAN = 1.8;
  // Measured by DISTANCE, not occupancy: a band cell is 0.5 u and the shaft's
  // margin is 0.15, so the grid refused the shipped shaft itself (K9). The band
  // scan's own surface samples in the shaft's window are the obstacle set; a
  // sample lattice of pitch STEP on a triangle puts every surface point within
  // STEP/√3 of a sample (the circumradius of a lattice cell with sides ≤ STEP),
  // so that is the slack a sample's distance is read down by.
  if (!band.points) return { error: 'the band scan carried no surface samples (re-dump)' };
  const PH = 1, ph = new Map();
  for (const p of band.points) { const key = `${Math.floor(p[0] / PH)},${Math.floor(p[1] / PH)}`; let a = ph.get(key); if (!a) ph.set(key, a = []); a.push(p); }
  const SLACK = band.pointStep / Math.sqrt(3);
  const near3 = (ax, ay, bx, by, z, reach) => {
    const vx = bx - ax, vy = by - ay, L2 = vx * vx + vy * vy || 1e-12;
    let worst = null;
    for (let gx = Math.floor((Math.min(ax, bx) - reach) / PH); gx <= Math.floor((Math.max(ax, bx) + reach) / PH); gx++)
      for (let gy = Math.floor((Math.min(ay, by) - reach) / PH); gy <= Math.floor((Math.max(ay, by) + reach) / PH); gy++)
        for (const p of ph.get(`${gx},${gy}`) || []) {
          const t = Math.max(0, Math.min(1, ((p[0] - ax) * vx + (p[1] - ay) * vy) / L2));
          const d = Math.hypot(p[0] - (ax + vx * t), p[1] - (ay + vy * t), p[2] - z);
          if (d < reach && (!worst || d < worst.d)) worst = { d, u: band.pointUnits[p[3]] };
        }
    return worst;
  };
  const layShaft = (T0, I0, rS = shaftR) => {
    const L = Math.hypot(I0.x - T0.x, I0.y - T0.y); if (L <= FORK_SPAN) return 'chord shorter than the fork span';
    const R0 = { x: I0.x + (T0.x - I0.x) * FORK_SPAN / L, y: I0.y + (T0.y - I0.y) * FORK_SPAN / L };
    const w = near3(T0.x, T0.y, R0.x, R0.y, shaftZ, rS + CM + SLACK);
    if (w) return `${w.u} (${(w.d - rS - SLACK).toFixed(3)} off the shaft's skin, read down by the lattice)`;
    // the 240° linkage's dial-side group is not in the band scan (it is not
    // built yet): its cells, held over its window, as before
    return seg(T0, R0, rS, shaftZ - rS, shaftZ + rS, null, null, true);
  };
  const TURN_LD = LAY.TURN_LD_TARGET, STOCK = LAY.STOCK_MIN_U;
  const ARM_W = lk.armW;
  if (!(ARM_W > 0)) return { error: `the beak bar's width was not read (armW ${ARM_W}) — re-dump` };
  const out = [];
  for (let k = 0; k < 6; k++) {
    const psi = aOld + phi + k * COL_PITCH, u = { x: Math.cos(psi), y: Math.sin(psi) };
    const at = (d) => ({ x: Wf.x + u.x * d, y: Wf.y + u.y * d });
    for (const row of lk.seatTable) {
      const N = at(lk.landR), T = at(lk.landR + row.run), P = at(lk.landR + row.beakLen);
      if (Math.hypot(P.x, P.y) > CASE_R_IN - CM) continue;
      // the build's bar (main.js, §229): its underside the seat law's lift off
      // the column tops, its depth max(STOCK, beakLen/SLENDER_TARGET) growing
      // AWAY from the columns, ARM_W wide — and here, folded, "away" is dialward
      const H = Math.max(STOCK, row.beakLen / LAY.SLENDER_TARGET);
      const under = zFace - row.lift, axisZ = zFace - row.h;
      const sweep = row.beakLen * row.theta;                         // the seat drop: the nose end tilts this far toward the plate
      const bar = seg(P, N, ARM_W / 2, under - H, under + sweep);
      if (bar) { out.push({ k, run: row.run, why: 'bar: ' + bar }); continue; }
      const post = clearAt(P.x, P.y, STOCK, under - H, band.Z_CEIL);
      if (post) { out.push({ k, run: row.run, why: 'pivot post: ' + post }); continue; }
      const footLen = (under - H) - rimTop, rf = Math.max(STOCK, footLen / (2 * TURN_LD));
      if (!(footLen > 0)) { out.push({ k, run: row.run, why: 'the foot would stand above the bar' }); continue; }
      const foot = clearAt(T.x, T.y, rf, rimTop, under - H);
      if (foot) { out.push({ k, run: row.run, why: 'foot: ' + foot }); continue; }
      // the lay shaft: foot → inner end at the tab's reach, any azimuth. It is
      // HELD where a hanger can rise from it to the plate's dial face, and its
      // section is a CONSEQUENCE of the spans that leaves (main.js §232: the
      // build cuts r to put the governing span on §54's target, λ = L/d ≤
      // SLENDER_TARGET, an overhang counted SLENDER_OVERHANG_K long, and the
      // whole bar on the lathe's L/D target). So for each chord: the stations
      // a hanger can stand at, the governing span they leave, the r it asks,
      // and whether a shaft of THAT r still runs clear.
      let best = null; const shBlk = {};
      for (let ad = 0; ad < 360; ad += 3) {
        const I0 = { x: cl.sel.x + Math.cos(ad * DEG) * 5.4, y: cl.sel.y + Math.sin(ad * DEG) * 5.4 };
        const L = Math.hypot(I0.x - T.x, I0.y - T.y), Lb = L - FORK_SPAN;   // the body, foot tip to the working zone
        if (!(Lb > 0)) continue;
        const sup = [];
        for (let sd = 0; sd <= Lb + 1e-9; sd += 0.25) {
          const Hh = { x: T.x + (I0.x - T.x) * sd / L, y: T.y + (I0.y - T.y) * sd / L };
          if (!clearAt(Hh.x, Hh.y, STOCK, shaftZ + shaftR, band.Z_CEIL)) sup.push(sd);
        }
        if (sup.length < 2) { shBlk['no two hanger columns'] = (shBlk['no two hanger columns'] || 0) + 1; continue; }
        let gap = 0; for (let i = 1; i < sup.length; i++) gap = Math.max(gap, sup[i] - sup[i - 1]);
        const Leff = Math.max(gap, LAY.SLENDER_OVERHANG_K * sup[0], LAY.SLENDER_OVERHANG_K * (Lb - sup[sup.length - 1]));
        const rReq = Math.max(Leff / (2 * LAY.SLENDER_TARGET), Lb / (2 * TURN_LD));
        const sh = layShaft(T, I0, Math.max(rReq, shaftR));
        if (sh) { const u0 = sh.split(' (')[0]; shBlk[u0] = (shBlk[u0] || 0) + 1; continue; }
        if (!best || rReq < best.rReq - 1e-9 || (Math.abs(rReq - best.rReq) < 1e-9 && L < best.len)) best = { ad, len: L, I0, rReq, Leff, hangers: sup.length, firstHanger: sup[0], lastHanger: sup[sup.length - 1] };
      }
      if (!best) { out.push({ k, run: row.run, why: 'no clear lay shaft from the foot to the tab', shBlk }); continue; }
      out.push({ k, run: row.run, ok: true, beakLen: row.beakLen, tailLen: row.tailLen, theta: row.theta, N, T, P, axisZ, H, footLen, rf, shaft: best, total: row.beakLen + best.len });
    }
  }
  // K9 the lay-shaft test passes the shipped one: today's foot (the rod) to
  // today's inner end (the tab's azimuth at the tab's reach), at today's stratum
  const tabAz = Math.atan2(lk.tab.y - cl.sel.y, lk.tab.x - cl.sel.x);
  const todayInner = { x: cl.sel.x + Math.cos(tabAz) * 5.4, y: cl.sel.y + Math.sin(tabAz) * 5.4 };
  const k9 = layShaft({ x: lk.rod.x, y: lk.rod.y }, todayInner);
  const k9Near = (() => { const L = Math.hypot(todayInner.x - lk.rod.x, todayInner.y - lk.rod.y); const R0 = { x: todayInner.x + (lk.rod.x - todayInner.x) * FORK_SPAN / L, y: todayInner.y + (lk.rod.y - todayInner.y) * FORK_SPAN / L }; return near3(lk.rod.x, lk.rod.y, R0.x, R0.y, shaftZ, 5); })();
  return { k9, k9Near, shaftR, slack: SLACK, phiDeg: PHI_FOLD_DEG, Wf, aOldDeg: aOld / DEG, zFace, shaftZ, rimTop, linkageLen: lnk ? lnk.len : null, rows: out };
})();

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
// K8 the construction is 1:1: swing the shortest linkage through the stroke by
// forward kinematics — crank A turned by the stem, the rod pinned at both ends
// (its far end found on crank B's circle), crank B turned by the rod — and the
// pawl must move forward along its own press by the stem's travel, to within
// one CLEAR_MARGIN. A forced ratio (the single crank's 1.96), a wrong sense or a
// linkage that is 1:1 only at the start of its stroke fails it. (The search
// applies the same test to every candidate; this re-runs it on the winner.)
let k8 = 'no linkage to swing';
if (shortest) {
  const [qx0, qy0] = fold(cl.pin[0].x, cl.pin[0].y, 0, shortest.deg * DEG), [qx1, qy1] = fold(cl.pin[1].x, cl.pin[1].y, 0, shortest.deg * DEG);
  const sw = swing(shortest, { x: qx0, y: qy0 }, { x: (qx1 - qx0) / stroke, y: (qy1 - qy0) / stroke });
  k8 = sw ? `the shortest linkage swung through the stroke: the stem's pin moves ${sw.inp.toFixed(4)} along its press, the pawl's ${sw.outp.toFixed(4)} along its own (${(sw.outp - sw.inp).toFixed(4)} apart)` : 'the shortest linkage locks';
  if (!sw || !(sw.outp > 0) || Math.abs(sw.outp - sw.inp) > CM) fails.push(`K8 the linkage is not 1:1: ${k8}`);
}
// K9 (beakSite's): the lay-shaft corridor test passes the shipped shaft
const k9 = beakSite.error ? 'not run: ' + beakSite.error : (beakSite.k9 ? `today's lay shaft is BLOCKED by ${beakSite.k9}` : `today's lay shaft, rod to the working zone at its own stratum (r ${beakSite.shaftR.toFixed(3)}), runs clear: nearest ${beakSite.k9Near ? beakSite.k9Near.u + ' ' + (beakSite.k9Near.d - beakSite.shaftR - beakSite.slack).toFixed(3) + ' off its skin' : 'nothing within 5'} (margin ${CM}, lattice slack ${beakSite.slack.toFixed(3)})`);
if (beakSite.error || beakSite.k9) fails.push(`K9 ${k9}`);
{
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
const fw2 = (w) => `${fz(w[0])}..${fz(w[1])} (${(w[1] - w[0]).toFixed(2)})`;
console.log(`\n  THE LINKAGE: two 1:1 cranks and a rod, today's stem held (arms ${f(A_MIN, 2)} .. ${f(A_MAX, 2)}, member window ≥ ${f(MIN_WIN)}; the shortest three per band the rod runs in):`);
for (const L of linkage) {
  const parts = [];
  const NAME = { dial: 'rod under the dial', plates: 'rod between the plates', slot: 'all between the plates, the pin down a base-plate slot' };
  for (const cfg of ['dial', 'plates', 'slot']) {
    const b = L.found[cfg][0];
    parts.push(b ? `${NAME[cfg]} ${f(b.len, 2)} (arms ${f(Math.abs(b.a), 2)} / ${f(Math.abs(b.b), 2)}, rod ${f(b.rod, 2)} at ${b.td}°, ${dot(b.vA, sub(b.EB, b.EA)) > 0 ? 'the rod pushes' : 'the rod pulls'}; plates ${fw2(b.wP)}${b.wD ? `, dial ${fw2(b.wD)}` : ''})` : `${NAME[cfg]} ${L.checked >= SWEEP_CAP ? 'none before the sweep cap' : 'none'}`);
  }
  console.log(`    φ ${String(L.deg).padStart(3)}°  ${L.n} geometric candidates, ${L.checked} swept — ${parts.join('; ')}${L.dialDropBlocked ? ` [under the dial: ${L.dialDropBlocked} wheel samples stand in the pin's column below the driver]` : ''}`);
}
if (shortest) {
  const pr = (P) => `(${f(P.x, 2)}, ${f(P.y, 2)})`;
  console.log(`    shortest: φ ${shortest.deg}°, ${shortest.cfg === 'dial' ? 'rod under the dial' : shortest.cfg === 'slot' ? 'all between the plates' : 'rod between the plates'}: crank A pivot ${pr(shortest.PA)} arms ${f(Math.abs(shortest.a), 3)}, rod ${pr(shortest.EA)} → ${pr(shortest.EB)} (${f(shortest.rod, 3)}), crank B pivot ${pr(shortest.PB)} arms ${f(Math.abs(shortest.b), 3)}; total ${f(shortest.len, 2)}`);
}
console.log(`    the folded cluster as an obstacle rejected ${obsBites} linkage(s) the band alone would have passed`);
if (beakSite.error) console.log(`\n  THE DIAL-SIDE BEAK: ${beakSite.error}`);
else {
  const okRows = beakSite.rows.filter((r) => r.ok).sort((a, b) => a.shaft.rReq - b.shaft.rReq || a.total - b.total);
  console.log(`\n  THE DIAL-SIDE BEAK AND THE LAY SHAFT at the fold φ ${beakSite.phiDeg}° (the stop wheel's pitch): folded wheel (${f(beakSite.Wf.x, 2)}, ${f(beakSite.Wf.y, 2)}), castellation face z ${f(beakSite.zFace)}, lay shaft z ${f(beakSite.shaftZ)}, rim top ${f(beakSite.rimTop)}; today's ray ${f(beakSite.aOldDeg, 1)}°`);
  console.log(`    ${okRows.length} clear of ${beakSite.rows.length} (direction × run, the nose's ray = today's + φ + k × 60°); by direction:`);
  for (let k = 0; k < 6; k++) {
    const rs = beakSite.rows.filter((q) => q.k === k), ok = rs.filter((q) => q.ok), why = {};
    for (const q of rs) if (!q.ok) { const w = q.why.split(' (')[0]; why[w] = (why[w] || 0) + 1; }
    const sh = {}; for (const q of rs) if (q.shBlk) for (const [u, n] of Object.entries(q.shBlk)) sh[u] = (sh[u] || 0) + n;
    const top = (o) => Object.entries(o).sort((a, b) => b[1] - a[1]).slice(0, 4).map(([u, n]) => `${u} ${n}`).join(', ');
    console.log(`      k${k}: ${ok.length}/${rs.length} clear${ok.length ? ` (runs ${f(ok[0].run, 2)}–${f(ok[ok.length - 1].run, 2)})` : ''}; refused by ${top(why) || '—'}${Object.keys(sh).length ? `; the shaft's chords by ${top(sh)}` : ''}`);
  }
  // the three thinnest shafts per clear direction (then the shortest)
  for (const r of [0, 1, 2, 3, 4, 5].flatMap((k) => okRows.filter((q) => q.k === k).slice(0, 3))) console.log(`    k${r.k} run ${f(r.run, 2)}: beak ${f(r.beakLen, 3)} tail ${f(r.tailLen, 3)} (pivot (${f(r.P.x, 2)}, ${f(r.P.y, 2)}), foot (${f(r.T.x, 2)}, ${f(r.T.y, 2)}) ${f(r.footLen, 2)} long ⌀ ${f(2 * r.rf, 3)}), lay shaft ${f(r.shaft.len, 2)} to the tab at ${r.shaft.ad}°, ${r.shaft.hangers} hanger stations ${f(r.shaft.firstHanger, 2)}–${f(r.shaft.lastHanger, 2)}, governing span ${f(r.shaft.Leff, 2)} → r ${f(r.shaft.rReq, 3)} (today's ${f(beakSite.shaftR, 3)}); total ${f(r.total, 2)}`);
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
console.log(`    K8 ${k8}`);
console.log(`    K9 ${k9}`);
console.log(`    K4 ${cl.points.length} swept samples against ${cl.atRest} at rest; the finger moves ${f(padMoved, 4)} between parities`);
if (fails.length) { console.log('\nCONTROL FAILED:\n  ' + fails.join('\n  ')); process.exit(2); }
console.log(`\nREPORT — controls pass; ${feasible.length ? `${feasible.length} feasible rotation(s)` : 'NO rotation of the rigid cluster fits the band as it stands'}`);
process.exit(0);
