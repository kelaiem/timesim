#!/usr/bin/env node
// THE ROCKING BAR'S FOLD, PLANNED AGAINST THE BUILT MOVEMENT (§334 landings 3b and 3c, TODO 318) — acceptance, one
// native boot.
//
//   node --import ./tools/native/loader.mjs tools/probe-keyless-rocking-bar-fold.mjs
//
// LANDING 3c's CORRECTIONS. Landings 3b and 3c read the plate's faces off a box over the plate and its children, which
// include the pillars standing on it, and so put its top face at z 8.40 where it is at 0 (PLATE_TOP; the slab is 2.3).
// Every z this probe measured was in that wrong frame: landing 3c's "blind bore under 7.6 u of plate" and "the barrel
// in the pocket's band" were both artefacts of it, and were withdrawn. The faces are read off the slab's own mesh now.
// Two corrections stand: the transfer wheel's own bore is not an obstacle (the bar pivots on that arbor, and the bore
// moves out with it), and the blade's azimuth asks the metal (metalGap). What 3b found stands too: corner K's opening
// lies under the bar's first arm, and K's blanks rise to 0.11 u under the top face, so no blind bore can part them.
// The probe stays RED on that until the setting traverse is re-planned (§334 landing 3c, as re-filed). Its F-rows are
// read on the plan with K's opening set aside, so the rest of the fit is measured while that work is done.
//
// src/keyless-rocking-bar.js's `foldRockingBar` places the line-spec bar in the default build: the transfer moved out
// to the derived centre distance, the bar on the side the movement's winding sense calls for, its plate and return
// blade in a pocket milled into the base plate's top face, an arm bowed round any opening its pocket would crowd.
// Nothing is cut yet; this holds the plan to the movement as it stands, so the cut can follow it.
//   K   the bar's pocket keeps a plate land (one bevel + STOCK_MIN_U) to corner K's opening. RED today: the gate
//       the re-planned traverse must turn green
//   F1  every pocket piece keeps a plate land to every other opening the plate has (each read off the cut plate,
//       its convex hull taken: conservative), the transfer's own bore excepted
//   F2  the pocket's floor leaves at least STOCK_MIN_U of plate under it
//   F3  no metal of the movement stands inside the pocket's volume (exact mesh distance, meshClearance), except the
//       plate itself and the transfer's own wheel and arbor (which the bar pivots on). CONTROL: a pocket piece moved
//       onto the fusee's lower staff reads metal inside
//   F4  the bar's wheels, at every sampled swing angle, stand CLEAR_MARGIN off every other metal in the movement
//       (exact), their mesh partners (the spur, the transfer) and the parts the fold replaces excepted. CONTROL: a
//       wheel moved onto the great wheel's band reads under the margin
//   F5  the moved transfer stands CLEAR_MARGIN off the spur and everything else in the winding band (exact)
// REPORTS: the move, the bows, the blade's azimuth, every piece's land.
import { bootNative } from './native/host.mjs';

const r = await bootNative({ query: '' });
const C = r.clock, THREE = await import('three');
const I = await import('../src/inspect.js');
const { foldRockingBar, convexGap } = await import('../src/keyless-rocking-bar.js');
const L = await import('../src/layout.js');
const G = await import('../src/geometry.js');
const fails = [];
const ok = (name, cond, detail = '') => { console.log(`${cond ? 'PASS' : 'FAIL'}  ${name}${detail ? ` — ${detail}` : ''}`); if (!cond) fails.push(name); };
const f = (v, n = 4) => Number(v).toPrecision(n);

const byName = {}; C.scene.traverse((o) => { if (o.name && !byName[o.name]) byName[o.name] = o; });
C.setPose({}); C.scene.updateMatrixWorld(true);
const transfer = byName.transferWheel, spur = byName.windSpur, plate = byName.backPlate;
const T0 = transfer.getWorldPosition(new THREE.Vector3()), S = spur.getWorldPosition(new THREE.Vector3());
// the winding sense, measured: wind a little and read the transfer's world angle
const ang = () => { const v = new THREE.Vector3(1, 0, 0).applyQuaternion(transfer.getWorldQuaternion(new THREE.Quaternion())); return Math.atan2(v.y, v.x); };
C.setPose({ tension: 0.5 }); C.scene.updateMatrixWorld(true); const a0 = ang();
C.setPose({ tension: 0.52 }); C.scene.updateMatrixWorld(true); let dA = ang() - a0; dA = Math.atan2(Math.sin(dA), Math.cos(dA));
const windSenseWorld = Math.sign(dA);
C.setPose({}); C.scene.updateMatrixWorld(true);

// the plate's openings as cut: every hole of its extrude, in world xy (the plate stands at the origin, unrotated); its
// faces off the SLAB's own geometry, never a box over the plate and its children, which include the pillars standing
// on it (landings 3b–3c read the top face at 8.40 that way, where it is at 0)
const body = [plate, ...plate.children].find((o) => o.isMesh && o.geometry.parameters?.shapes);
body.geometry.computeBoundingBox();
const pb = body.geometry.boundingBox.clone().applyMatrix4(body.matrixWorld);   // its own geometry: setFromObject would take in its children, the pillars to 8.40
const plateTopZ = pb.max.z, plateBackZ = pb.min.z;
ok('the plate\'s faces are the slab\'s: top at PLATE_TOP 0, BACK_PLATE_T apart', Math.abs(plateTopZ) < 1e-6 && Math.abs(plateTopZ - plateBackZ - 2.3) < 1e-6,
  `z ${f(plateBackZ)} … ${f(plateTopZ)} (the plate group's box reads ${f(new THREE.Box3().setFromObject(plate).max.z)} at the top)`);
const shape = [].concat(body.geometry.parameters.shapes)[0];
const holesW = shape.extractPoints(72).holes.map((h) => h.map((p) => new THREE.Vector3(p.x, p.y, 0).applyMatrix4(body.matrixWorld)).map((v) => [v.x, v.y]));
const hullOf = (pts) => { const P = [...pts].sort((a, b) => a[0] - b[0] || a[1] - b[1]); const cr = (o, a, b) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
  const lo = [], up = []; for (const p of P) { while (lo.length >= 2 && cr(lo.at(-2), lo.at(-1), p) <= 0) lo.pop(); lo.push(p); }
  for (const p of P.slice().reverse()) { while (up.length >= 2 && cr(up.at(-2), up.at(-1), p) <= 0) up.pop(); up.push(p); } return lo.slice(0, -1).concat(up.slice(0, -1)); };
const cut = holesW.map((h, i) => ({ name: `opening ${i}`, pts: hullOf(h) }));
const bev = C.plateR * G.PLATE_BEVEL_F;
const landMin = bev + L.STOCK_MIN_U;   // the pocket's wall swells by the bevel when cut, the opening already has
const cenOf = (o) => ({ x: o.pts.reduce((a, q) => a + q[0], 0) / o.pts.length, y: o.pts.reduce((a, q) => a + q[1], 0) / o.pts.length });
const near = (o, p) => Math.hypot(cenOf(o).x - p.x, cenOf(o).y - p.y);
// the transfer's own bore: the bar pivots on its arbor, which moves out with its bore (the bar's boss is that bearing)
const ownBore = cut.reduce((a, o) => (near(o, T0) < near(a, T0) ? o : a));
// K's bore: the fold's corner opening as the build published it (foldOpeningFor), found among the cut holes
const Fd = C.settingFold, Kop = Fd.bearings.foldOpening;
const kBore = cut.reduce((a, o) => (near(o, Kop) < near(a, Kop) ? o : a));
console.log(`REPORT the transfer's own bore is ${ownBore.name} (${f(near(ownBore, T0))} u off the arbor), K's is ${kBore.name} (${f(near(kBore, Kop))} u off K)`);
const openings = cut.filter((o) => o !== ownBore && o !== kBore);
const inputs = { transferAt: { x: T0.x, y: T0.y }, spurAt: { x: S.x, y: S.y }, windSenseWorld, plateTopZ, plateBackZ, landMin };
// exact clearances: the pocket pieces as prisms, the wheels as tip-radius discs
const prism = (pts, z0, z1) => { const sh = new THREE.Shape(pts.map(([x, y]) => new THREE.Vector2(x, y)));
  const g = new THREE.ExtrudeGeometry(sh, { depth: z1 - z0, bevelEnabled: false }); g.translate(0, 0, z0); const m = new THREE.Mesh(g); m.updateMatrixWorld(true); return m; };
const disc = (c, rr, z0, z1) => { const g = new THREE.CylinderGeometry(rr, rr, z1 - z0, 96); g.rotateX(Math.PI / 2); g.translate(c.x, c.y, (z0 + z1) / 2);
  const m = new THREE.Mesh(g); m.updateMatrixWorld(true); return m; };
const sb = new THREE.Box3().setFromObject(spur), bandZ0 = sb.min.z, bandZ1 = sb.max.z;
const excludedUnder = (o, names) => { for (let p = o; p; p = p.parent) if (names.includes(p.name)) return true; return false; };
const movers = []; C.scene.traverse((o) => { if (o.isMesh && !o.userData?.schematic && o.geometry?.attributes?.position) movers.push(o); });
const nearest = (probe, skip, bound) => {
  const pbx = new THREE.Box3().setFromObject(probe).expandByScalar(bound);
  let best = { d: Infinity, name: null };
  for (const o of movers) {
    if (excludedUnder(o, skip)) continue;
    const ob = new THREE.Box3().setFromObject(o); if (!ob.intersectsBox(pbx)) continue;
    const d = I.meshClearance(probe, o, bound);
    if (d < best.d) best = { d, name: o.name || `(in ${o.parent?.name})` };
  }
  return best;
};
const POCKET_SKIP = ['backPlate', 'transferWheel', 'transferArbor', 'crownWheel'];   // the transfer's arbor moves out with its wheel and the bar's pivot
// the exact clearance of a pocket piece to the movement's metal, for the blade's azimuth (the same judge as F3 below)
const metalGap = (pts, z0, z1) => nearest(prism(pts, z0, z1), POCKET_SKIP, 1).d;
// K: the whole plan, K's opening included (the gate the re-planned traverse must turn green)
const whole = foldRockingBar({ ...inputs, openings: [...openings, kBore], metalGap });
ok('K the bar\'s pocket keeps the plate land to corner K\'s opening', whole.feasible, whole.why || 'it does');
// the rest of the fit, read on the plan with K's opening set aside
const plan = foldRockingBar({ ...inputs, openings, metalGap });
ok('the fold has a plan with K\'s opening set aside', plan.feasible, plan.why || `bend ${f(plan.bar.beta * 180 / Math.PI)}°; transfer moved out ${f(plan.moved)} u; winding turns it ${windSenseWorld > 0 ? '+z' : '−z'}; ${plan.report.join('; ') || 'no arm bowed'}; blade pin at ${f(plan.blade.psi * 180 / Math.PI)}° round the boss`);
if (!plan.feasible) { console.log(`\n${fails.length} FAILED`); process.exit(1); }
{
  const g = Math.min(...plan.pockets.map((p) => convexGap(p.pts, kBore.pts)));
  console.log(`REPORT the land that plan leaves to K's opening: ${f(g)} u against ${f(landMin)} (${plan.pockets.filter((p) => convexGap(p.pts, kBore.pts) < landMin).map((p) => p.name).join(', ')})`);
}

// F1 lands, with the straight-arm control
const worst = plan.pockets.reduce((a, p) => (p.land < a.land ? p : a));
ok('F1 every pocket piece keeps the plate land to every opening', plan.pockets.every((p) => p.land >= landMin - 1e-9),
  `land needed ${f(landMin)} u; least ${f(worst.land)} u (${worst.name}); ${plan.pockets.length} pieces`);
if (plan.armBends.some((h) => h)) {
  const straight = foldRockingBar({ ...inputs, openings: [] });
  const g = Math.min(...straight.pockets.filter((p) => p.name.startsWith('arm')).map((p) => Math.min(...openings.map((o) => convexGap(p.pts, o.pts)))));
  ok('F1 CONTROL the straight arms crowd an opening', g < landMin, `land ${f(g)} u`);
}

// F2 the floor
ok('F2 the pocket floor leaves STOCK_MIN_U of plate', plan.floorLeft >= L.STOCK_MIN_U, `floor at z ${f(plan.floorZ)}, ${f(plan.floorLeft)} u of plate under it`);

let f3 = { d: Infinity };
for (const p of plan.pockets) { const n = nearest(prism(p.pts, plan.floorZ, plateTopZ), POCKET_SKIP, 1); if (n.d < f3.d) f3 = { ...n, piece: p.name }; }
ok('F3 no metal stands inside the pocket', f3.d > 0, f3.name ? `nearest ${f(f3.d)} u (${f3.name}, by ${f3.piece})` : 'nothing within 1 u');
{
  const staff = byName.fuseeLowerStaff; const sp = staff.getWorldPosition(new THREE.Vector3());
  const piece = plan.pockets[0].pts, cx = piece.reduce((a, q) => a + q[0], 0) / piece.length, cy = piece.reduce((a, q) => a + q[1], 0) / piece.length;
  const moved = piece.map(([x, y]) => [x - cx + sp.x, y - cy + sp.y]);
  const n = nearest(prism(moved, plan.floorZ, plateTopZ), POCKET_SKIP, 1);
  ok('F3 CONTROL a pocket piece moved onto the fusee\'s lower staff reads metal inside', n.d <= 0, `${f(n.d)} u (${n.name})`);
}

// F4 the bar's wheels over the swing
const B = plan.bar, WHEEL_SKIP = ['windSpur', 'transferWheel', 'transferArbor', 'crownWheel'];   // the arbor moves with its wheel
let f4 = { d: Infinity };
const toWorldAll = (phi) => { const P = B.centres(phi, B.beta); const e = plan.centresWorld.engaged[0];
  // the plan's frame: rebuild from its own engaged and neutral endpoints
  return P; };
const sampleCentres = [];
for (let k = 0; k <= 10; k++) {
  const t = k / 10;
  sampleCentres.push(plan.centresWorld.engaged.map((e, i) => ({ x: e.x + (plan.centresWorld.neutral[i].x - e.x) * t, y: e.y + (plan.centresWorld.neutral[i].y - e.y) * t })));
}
for (const P of sampleCentres) for (let i = 1; i < P.length - 1; i++) {
  const n = nearest(disc(P[i], B.reach[i], bandZ0, bandZ1), WHEEL_SKIP, 2);
  if (n.d < f4.d) f4 = { ...n, wheel: i };
}
ok('F4 the bar\'s wheels stand CLEAR_MARGIN off the movement over the whole swing', f4.d >= L.CLEAR_MARGIN - L.MEASURED_MARGIN_BAND, `nearest ${f(f4.d)} u (${f4.name}, wheel ${f4.wheel})`);
{
  const gw = byName.greatWheel; const gb = new THREE.Box3().setFromObject(gw);
  const n = nearest(disc(sampleCentres[0][1], B.reach[1], gb.min.z + 0.2, gb.min.z + 0.2 + (bandZ1 - bandZ0)), WHEEL_SKIP, 2);
  ok('F4 CONTROL a wheel lifted into the great wheel\'s band reads under the margin', n.d < L.CLEAR_MARGIN, `${f(n.d)} u (${n.name})`);
}

// F5 the moved transfer
const Tn = plan.transferAt;
const nT = nearest(disc(Tn, B.reach[0], bandZ0, bandZ1), ['transferWheel', 'transferArbor', 'crownWheel'], 2);
ok('F5 the moved transfer stands CLEAR_MARGIN off the spur and the band', nT.d >= L.CLEAR_MARGIN - L.MEASURED_MARGIN_BAND, `nearest ${f(nT.d)} u (${nT.name})`);

console.log('\nREPORT pockets:', plan.pockets.map((p) => `${p.name} land ${f(p.land)}`).join('; '));
console.log(fails.length ? `\n${fails.length} FAILED: ${fails.join('; ')}` : '\nall rows hold');
process.exit(fails.length ? 1 : 0);
