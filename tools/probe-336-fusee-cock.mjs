// §336 — THE FUSEE COCK, measured off a real boot: does the cock that took the
// fusee's top bush out of the three-quarter plate carry it as matter, does the
// arbor actually end in its boss, and does it show more of the cone than the
// plate's boss and three webs did?
//
// ACCEPTANCE (exits non-zero). What it holds, each read off the built metal or
// re-derived from the record's own inputs:
//  · THE SECTIONS ARE THE LOAD'S (P1). The record's reaction R is the sum of
//    its own four moments over the bearing span (the stall: chain, mesh, stop,
//    winding input, every force added); the arm's root σ = 6·R·L/(T·b²) is
//    re-computed at the root width and must sit at or under the plate metal's
//    yield; the leg's and the post's von Mises stresses under it too; and the
//    arm's width at every station is √(6·R·s/(T·σ)) or its shear floor — the
//    taper the build was cut to, read off the built arm's outline;
//  · THE ARBOR ENDS IN THE COCK. The fusee's staff tops out at the boss's
//    mid-plane (its bearing plane), inside the boss's bore with running
//    clearance, and the let-down square stands on the boss's top face;
//  · THE PLATE KEEPS NO BOSS OVER THE CONE: no cone vertex is under the plate,
//    and the cone window solved bossless with nothing in its webs' place;
//  · the cock shows MORE cone than the plate did: the share of the cone's
//    vertices with a clear path up past the plate AND the cock is over §322's
//    73.7% (the boss and three webs);
//  · THE STEADY PINS (§336 landing 4, TODO 286) carry the foot's twist: their couple 2·F·r_p IS the arm's moment about the
//    leg (the record's twist), each pin's shear is under the steel's shear yield and its bearing in the plate and the flange
//    under the nickel silver's, there are two of them, each through the base plate's whole depth and the flange's, and each
//    leaves a §50 floor of plate to the foot screw's tapped hole;
//  · the foot screw measures engaged, and at rest the cock keeps CLEAR_MARGIN
//    from the three-quarter plate it stands in (landing 2: a slot merged with the cone window), and from the
//    centre wheel and the chain its leg stands beside (the fusee itself runs
//    in the boss: that is the declared bearing, not a clearance).
// CONTROLS (fatal): a pin of half the radius reads over the steel's shear yield; the stress law reads OVER the yield at half the root width
// (a check that cannot fail passes everything); the cone's reveal test reads a
// vertex under the cock's boss as COVERED (a reveal that cannot see the cock
// counts the boss's shadow as view).
//
// Boot must be silent (rule 6).
//
//   cd tools && node probe-336-fusee-cock.mjs           (the default build: the stop-work's stud seated in the crank, §336 landing 3)
//   QUERY='arrest=stop-iron' node probe-336-fusee-cock.mjs   (§47's arrest: no seat, the stop bounded; also 'reserveh=24')
import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
const ROOT = process.env.ROOT || join(dirname(fileURLToPath(import.meta.url)), '..');
const port = process.env.PORT || '8536';
const srv = spawn('python3', ['-m', 'http.server', port, '--bind', '127.0.0.1'], { cwd: ROOT, stdio: 'ignore' });
process.on('exit', () => srv.kill());
await new Promise((r) => setTimeout(r, 1000));
const browser = await chromium.launch();
const page = await browser.newPage();
const warns = [];
const stateMiss = [];
page.on('response', (r) => { if (r.status() === 404 && new URL(r.url()).pathname === '/__state') stateMiss.push(1); });
page.on('console', (m) => {
  const t = m.text();
  if (/WebGL|ReadPixels|GPU stall/.test(t)) return;
  if (/Failed to load resource: .*404/.test(t) && stateMiss.length) { stateMiss.pop(); return; }
  if (/Failed to load resource: .*501/.test(t)) return;   // the static server has no PUT for /__state
  if (m.type() === 'warning' || m.type() === 'error') warns.push(t);
});
page.on('pageerror', (e) => warns.push('PAGEERROR ' + String(e)));
const QUERY = process.env.QUERY ?? '';
await page.goto(`http://127.0.0.1:${port}/index.html?${QUERY}`, { waitUntil: 'load', timeout: 180000 });
await page.waitForFunction(() => !!window.__clock && (!window.__clock.boot || window.__clock.boot.done !== false), null, { timeout: 400000 });
await page.waitForTimeout(1000);

const out = await page.evaluate(async () => {
  const THREE = await import('./vendor/three.module.js');
  const I = await import('./src/inspect.js');
  const L = await import('./src/layout.js');
  const clock = window.__clock;
  const P = clock.P;
  const find = (n) => clock.labelEntries.find((e) => e.name === n);
  const fc = clock.fuseeCock;
  const cockE = find('Fusee cock');
  const plateE = find('Three-quarter plate');
  const meshesOf = (e) => { const m = []; e.obj.updateWorldMatrix(true, true); e.obj.traverse((o) => { if (o.isMesh && !o.userData?.schematic) m.push(o); }); return m; };
  const plateMeshes = meshesOf(plateE), cockMeshes = meshesOf(cockE);
  const slab = plateMeshes.find((m) => m.name === 'threeQuarterPlate');
  const sb = new THREE.Box3().setFromObject(slab); const zBot = sb.min.z;
  const rc = new THREE.Raycaster(); const up = new THREE.Vector3(0, 0, 1); const v = new THREE.Vector3();
  const hit = (meshes, x, y, z0) => { rc.set(new THREE.Vector3(x, y, z0), up); rc.far = 100; return rc.intersectObjects(meshes, false).length > 0; };
  // the cone's vertices, each tested against the plate alone and against the plate and the cock
  const fusee = find('Fusee & great wheel'); fusee.obj.updateWorldMatrix(true, true);
  let n = 0, underPlate = 0, clearAll = 0;
  fusee.obj.traverse((o) => {
    if (o.name !== 'fuseeCone') return;
    const pos = o.geometry.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      v.fromBufferAttribute(pos, i).applyMatrix4(o.matrixWorld);
      n++;
      if (hit(plateMeshes, v.x, v.y, v.z + 1e-3)) underPlate++;
      if (!hit(plateMeshes, v.x, v.y, v.z + 1e-3) && !hit(cockMeshes, v.x, v.y, v.z + 1e-3)) clearAll++;
    }
  });
  // control: a point just off the axis, under the boss, must read covered by the cock
  const ctlCovered = hit(cockMeshes, P.barrel.x + fc.boss.r_u * 0.6, P.barrel.y, zBot - 1);
  // the staff and the square
  let staffTop = null, squareBot = null, bossBore = null;
  fusee.obj.traverse((o) => {
    if (o.name === 'fuseeUpperPivot') staffTop = new THREE.Box3().setFromObject(o).max.z;
    if (o.isMesh && o.geometry.type === 'BoxGeometry' && Math.abs(o.geometry.parameters.width - 0.5 * Math.SQRT2) < 1e-9) squareBot = new THREE.Box3().setFromObject(o).min.z;
  });
  cockE.obj.traverse((o) => {
    if (o.name === 'bridgeBoss') {
      // the lathe's innermost radius about the arbor: the bore
      const pos = o.geometry.attributes.position; let r = Infinity;
      for (let i = 0; i < pos.count; i++) { v.fromBufferAttribute(pos, i).applyMatrix4(o.matrixWorld); r = Math.min(r, Math.hypot(v.x - P.barrel.x, v.y - P.barrel.y)); }
      bossBore = r;
    }
  });
  // the arms' outlines, read back as STATIONS: each strip is its left edge then its right edge reversed (main.js stripPts), so
  // station k's centre is the mid-point of the two edges' k-th points and its half-width half their distance. Each mesh says
  // whether it lies past the stud's seat (userData.armPast), which is whether the stud's moment is in its width.
  const arms = [];
  cockE.obj.traverse((o) => {
    if (o.name !== 'fuseeCockArm' && o.name !== 'fuseeCockCrank') return;
    const sh = o.geometry.parameters.shapes; let pts = (Array.isArray(sh) ? sh[0] : sh).getPoints();
    if (pts.length % 2 && Math.hypot(pts[0].x - pts[pts.length - 1].x, pts[0].y - pts[pts.length - 1].y) < 1e-12) pts = pts.slice(0, -1);
    const M = pts.length / 2;
    for (let k = 0; k < M; k++) {
      const a = pts[k], b = pts[pts.length - 1 - k];
      arms.push({ cx: (a.x + b.x) / 2, cy: (a.y + b.y) / 2, hw: Math.hypot(a.x - b.x, a.y - b.y) / 2, past: !!o.userData.armPast });
    }
  });
  const win = clock.tqWindows.find((w) => w.name === 'fusee');
  const joints = clock.frameJoints().filter((j) => j.joint === 'Fusee cock ⇄ base plate');
  // the steady pins as built: their z spans against the base plate's and the flange's, and where they stand
  const pinRows = [];
  let flangeZ = null;
  cockE.obj.traverse((o) => {
    if (o.name === 'steadyPin') { const b = new THREE.Box3().setFromObject(o); pinRows.push({ x: (b.min.x + b.max.x) / 2, y: (b.min.y + b.max.y) / 2, z0: b.min.z, z1: b.max.z }); }
    if (o.name === 'bridgeFoot') { const b = new THREE.Box3().setFromObject(o); flangeZ = [b.min.z, b.max.z]; }
  });
  // the base plate's faces as main.js places it: its top face at z 0 (BACK_PLATE_Z = −BACK_PLATE_T/2), its back face −BACK_PLATE_T
  const basePlateZ = [-L.BACK_PLATE_T, 0];
  const rest = {};
  // (not 'Fusee & great wheel': the staff RUNS in the boss's bore, the declared bearing)
  for (const nme of ['Three-quarter plate', 'Center wheel', 'Chain']) rest[nme] = I.clearanceAt(clock, 'Fusee cock', nme);
  return {
    CLEAR_MARGIN: L.CLEAR_MARGIN, yield: L.NICKEL_SILVER_SIGMA_Y_PA, unitMM: L.UNIT_MM, stockMin: L.STOCK_MIN_U, fc, cone: { n, underPlate, clearAll }, ctlCovered,
    staffTop, squareBot, bossBore, arms, barrel: P.barrel, win: { cut: win.cut, boss: win.boss, sectors: win.sectors.length },
    joints: joints.map((j) => ({ at: j.site, engagedMM: j.measuredMM, requiredMM: j.requiredMM })), rest,
    pinRows, flangeZ, basePlateZ, backPlateT: L.BACK_PLATE_T,
    pivotR: 0.5,
  };
});
await browser.close(); srv.kill();

let failed = 0;
const fail = (m) => { failed++; console.log('FAIL ' + m); };
const ok = (m) => console.log('ok   ' + m);
const M = out.CLEAR_MARGIN, Y = out.yield, fc = out.fc;
console.log('§336 fusee cock');
if (warns.length) { for (const w of warns) console.log('  warn: ' + w.slice(0, 300)); fail(`boot not silent (${warns.length})`); } else ok('boot silent');

// --- the sections
const UM = out.unitMM / 1000;   // m per model unit, layout.js's pin
const ld = fc.load, span = ld.zUp - ld.zLow;
const sumM = ld.chain.F_N * (ld.chain.z - ld.zLow) + ld.gear.F_N * (ld.gear.z - ld.zLow) + ld.stop.F_N * (ld.stop.z - ld.zLow) + ld.wind.F_N * (ld.wind.z - ld.zLow);
const R = sumM / span;
console.log(`reaction: R ${R.toFixed(4)} N (running ${ld.R_running_N.toFixed(4)} N); chain ${ld.chain.F_N.toFixed(3)} N @ z ${ld.chain.z.toFixed(2)}, mesh ${ld.gear.F_N.toFixed(3)} N, stop ${ld.stop.F_N.toFixed(3)} N, wind ${ld.wind.F_N.toFixed(3)} N; span ${span.toFixed(3)}`);
if (Math.abs(R - ld.R_N) > 1e-9 * R) fail(`the record's R ${ld.R_N} is not its own moments over the span (${R})`); else ok('R is its four moments over the bearing span');
// σ at the root, from the record's own moment there and its width (R·L, and with a stud seated the stud's moment from its seat)
const sig = (b_u) => 6 * fc.bar.rootMoment_Nu * UM / ((fc.T * UM) * (b_u * UM) ** 2);
if (fc.seat) console.log(`seat: the stop-work's stud (r ${fc.seat.studR_u.toFixed(3)}) at (${fc.seat.x.toFixed(2)}, ${fc.seat.y.toFixed(2)}), ${fc.seat.F_N.toFixed(3)} N into the crank; the stop exact: ${ld.stop.exact}`);
const rootSig = sig(fc.bar.rootWidth_u);
console.log(`arm: L ${fc.L.toFixed(2)}, root ${fc.bar.rootWidth_u.toFixed(3)} wide (σ ${(rootSig / 1e6).toFixed(1)} MPa), ${fc.bar.widthAtWindow_u.toFixed(3)} at the window's rim, shear floor ${fc.bar.shearFloor_u.toFixed(3)}; tip deflection ${fc.bar.deflect_mm.toFixed(4)} mm`);
if (!(rootSig <= Y * (1 + 1e-6))) fail(`the arm's root reads ${(rootSig / 1e6).toFixed(1)} MPa, over the ${(Y / 1e6).toFixed(0)} MPa yield`); else ok(`the arm's root is at or under the yield (${(rootSig / 1e6).toFixed(1)} of ${(Y / 1e6).toFixed(0)} MPa)`);
if (!(sig(fc.bar.rootWidth_u / 2) > Y)) fail('control: half the root width does not read over the yield — the stress law cannot fail'); else ok('control: half the root width reads over the yield');
for (const [what, r] of [['leg', fc.leg], ['post', fc.post]])
  if (!(r.sigma_Pa <= Y * (1 + 1e-6))) fail(`the ${what} reads ${(r.sigma_Pa / 1e6).toFixed(1)} MPa, over the yield`); else ok(`the ${what} is under the yield (${(r.sigma_Pa / 1e6).toFixed(1)} MPa, r ${r.r_u.toFixed(3)})`);
// the taper, read off the built outline: every vertex's half-width is the law's at its station (or the floor)
{
  const T_m = fc.T * UM, tauY = Y / Math.sqrt(3), C = out.barrel, Fs = fc.seat ? fc.seat.F_N : 0;
  const shear = (F) => 1.5 * F / (T_m * tauY) / UM;
  let worst = 0;
  for (const a of out.arms) {
    const Mm = R * Math.hypot(a.cx - C.x, a.cy - C.y) + (a.past && fc.seat ? Fs * Math.hypot(a.cx - fc.seat.x, a.cy - fc.seat.y) : 0);
    const law = Math.max(out.stockMin, shear(R + (a.past ? Fs : 0)), Math.sqrt(6 * Mm * UM / (T_m * Y)) / UM) / 2;
    worst = Math.max(worst, Math.abs(a.hw - law));
  }
  if (!out.arms.length) fail('no arm outline read');
  else if (worst > 1e-3) fail(`the built arms depart from the taper law by up to ${worst.toFixed(4)}`); else ok(`the arms are cut to the taper (${out.arms.length} outline vertices, worst ${worst.toExponential(2)})`);
}
// --- the steady pins (TODO 286)
{
  const pn = fc.pins;
  console.log(`steady pins: r ${pn.r_u.toFixed(3)} at r_p ${pn.rp_u.toFixed(3)} (azimuth ${(pn.phi * 180 / Math.PI).toFixed(0)}°), ${pn.F_N.toFixed(2)} N each; shear ${(pn.shear_Pa / 1e6).toFixed(1)} of ${(pn.shearYield_Pa / 1e6).toFixed(1)} MPa, bearing ${(pn.bearing_Pa / 1e6).toFixed(1)} of ${(pn.bearingYield_Pa / 1e6).toFixed(0)} MPa; twist ${fc.footTwist_Nmm.toFixed(2)} N·mm`);
  const couple = 2 * pn.F_N * pn.rp_u;
  if (Math.abs(couple - pn.twist_Nu) > 1e-9 * pn.twist_Nu) fail(`the pins' couple ${couple} is not the foot's twist ${pn.twist_Nu}`); else ok('the pins\' couple is the foot\'s twist');
  if (Math.abs(pn.twist_Nu * out.unitMM - fc.footTwist_Nmm) > 1e-9 * fc.footTwist_Nmm) fail('the pins were sized to a different twist than the record\'s'); else ok('the pins carry the record\'s twist');
  const d = 2 * pn.r_u * UM, t = pn.flangeT_u * UM;
  const shear = (4 * pn.F_N) / (Math.PI * d * d), bear = pn.F_N / (d * t);
  if (!(shear <= pn.shearYield_Pa * (1 + 1e-6))) fail(`pin shear ${(shear / 1e6).toFixed(1)} MPa over the steel's ${(pn.shearYield_Pa / 1e6).toFixed(1)}`); else ok(`each pin's shear is under the steel's shear yield (${(shear / 1e6).toFixed(1)} MPa)`);
  if (!(bear <= pn.bearingYield_Pa * (1 + 1e-6))) fail(`pin bearing ${(bear / 1e6).toFixed(1)} MPa over the nickel silver's ${(pn.bearingYield_Pa / 1e6).toFixed(0)}`); else ok(`each pin's bearing in the plate and the flange is under the nickel silver's yield (${(bear / 1e6).toFixed(1)} MPa)`);
  if (!((4 * pn.F_N) / (Math.PI * (d / 2) ** 2) > pn.shearYield_Pa)) fail('control: a pin of half the radius does not read over the shear yield — the law cannot fail'); else ok('control: a pin of half the radius reads over the shear yield');
  if (out.pinRows.length !== 2) fail(`${out.pinRows.length} steady pins built, expected 2`);
  else {
    let worstZ = 0, worstLand = Infinity;
    for (const q of out.pinRows) {
      worstZ = Math.max(worstZ, Math.abs(q.z0 - out.basePlateZ[0]), Math.abs(q.z1 - out.flangeZ[1]));
      worstLand = Math.min(worstLand, Math.hypot(q.x - fc.foot.x, q.y - fc.foot.y) - pn.r_u);
    }
    if (worstZ > 1e-4) fail(`a pin does not span the base plate's back face to the flange's top (off by ${worstZ.toFixed(5)})`); else ok('both pins run from the base plate\'s back face to the flange\'s top');
    if (Math.abs(out.flangeZ[1] - out.flangeZ[0] - out.backPlateT) > 1e-4) fail(`the flange is ${(out.flangeZ[1] - out.flangeZ[0]).toFixed(4)} deep, not the plate's ${out.backPlateT}`); else ok('the flange is the plate\'s own depth (each pin engages both alike)');
    console.log(`  pin to foot axis less its radius: ${worstLand.toFixed(3)} (the build warns if that leaves under a §50 floor to the tapped hole)`);
  }
}

// --- the bearing
const bossMid = fc.bossMid;
if (Math.abs(out.staffTop - bossMid) > 1e-6) fail(`the staff tops out at ${out.staffTop} — not the boss's mid-plane ${bossMid}`); else ok(`the staff ends in the boss, at its mid-plane (${bossMid.toFixed(4)})`);
if (!(out.bossBore > out.pivotR + 1e-6)) fail(`the boss's bore (${out.bossBore}) does not clear the staff`); else ok(`the boss's bore ${out.bossBore.toFixed(4)} runs over the ${out.pivotR} staff`);
if (Math.abs(out.squareBot - (bossMid + fc.T / 2)) > 1e-6) fail(`the let-down square starts at ${out.squareBot}, not the boss's top`); else ok('the let-down square stands on the boss\'s top face');

// --- the cone
const c = out.cone;
console.log(`cone: ${c.n} vertices; under the plate ${c.underPlate}; clear past plate and cock ${(100 * c.clearAll / c.n).toFixed(1)}%`);
if (c.underPlate) fail(`${c.underPlate} cone vertices are still under the plate`); else ok('no cone vertex is under the plate');
if (out.win.boss || out.win.sectors !== 1) fail(`the cone window is not one bossless opening (boss ${out.win.boss}, ${out.win.sectors} sectors)`); else ok('the cone window is one bossless opening');
if (!(c.clearAll / c.n > 0.737)) fail(`the cone shows ${(100 * c.clearAll / c.n).toFixed(1)}%, no more than the plate's 73.7%`); else ok(`the cock shows more cone than the plate did (${(100 * c.clearAll / c.n).toFixed(1)}% against 73.7%)`);
if (!out.ctlCovered) fail('control: a point under the boss reads clear — the reveal cannot see the cock'); else ok('control: a point under the boss reads covered');

// --- the joint and the rest clearances
if (out.joints.length !== 1) fail(`${out.joints.length} foot screw joints declared, expected 1`);
for (const j of out.joints) if (!(j.engagedMM != null && j.engagedMM >= j.requiredMM - 1e-4)) fail(`foot screw engages ${j.engagedMM} mm of ${j.requiredMM}`); else ok(`the foot screw engaged (${j.engagedMM.toFixed(4)} mm of ${j.requiredMM.toFixed(4)})`);
for (const [nme, d] of Object.entries(out.rest)) {
  const mm = typeof d === 'number' ? d : d?.d ?? d?.min ?? NaN;
  if (!(mm >= M - 1e-6)) fail(`cock ⇄ ${nme}: ${mm} at rest, under ${M}`); else ok(`cock ⇄ ${nme}: ${mm.toFixed(3)} at rest`);
}
console.log(failed ? `FAIL ${failed}` : 'PASS');
process.exit(failed ? 1 : 0);
