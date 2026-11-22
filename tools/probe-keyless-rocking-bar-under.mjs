#!/usr/bin/env node
// THE ROCKING BAR UNDER THE PLATE, PLANNED AGAINST THE BUILT MOVEMENT (§334 landing 4, TODO 318) — acceptance, one
// native boot.
//
//   node --import ./tools/native/loader.mjs tools/probe-keyless-rocking-bar-under.mjs
//
// The owner's "one customizable module": the bar is a COUPLING VARIANT of the keyless works, in the keyless layer under
// the base plate, so it never meets corner K (the plate-top fold's RED row) and the setting traverse is not rebuilt.
// `foldUnderPlate` (src/keyless-rocking-bar.js) puts the driver on the crown wheel's own arbor, the follower on a new
// arbor THROUGH the plate carrying the transfer wheel on the top face, the transfer swung round the fusee's winding spur
// at its own mesh distance. Nothing is cut yet; this holds the plan to the movement as it stands.
//   U0  CHOICE: over driver teeth 8–9 (10 reaches the winding pinion's inner end, 2.15 u from the axis) and one carried
//       wheel of 10–14, the declared UNDER_PLATE is the fit (every row below clear) with the WIDEST spring window
//       (the line's q: the friction band the clip must cover, over the band it has)
//   U1  the line solves with nF = nD (today's winding ratio) and one carried wheel (two meshes: today's winding sense)
//   U2  the follower is on the spur's circle (the transfer wheel keeps its mesh with the spur) and d from the axis
//   U4  (once built, landing 5a) every bar member and the moved transfer wheel stand where the plan puts them, at
//       both ends of the bar's swing since landing 5b
//   U3  exact mesh distance (meshClearance) ≥ CLEAR_MARGIN from every other metal: the driver, the follower, the carried
//       wheel, its pin and the bar's plate at every sampled swing angle (underPlateMetal, the build's own law), the follower's arbor below and above the plate,
//       and the moved transfer wheel (its mate the spur excused). The plate itself, and the transfer wheel and arbor
//       the fold replaces, are excused. CONTROL: the other crossing of the spur's circle (side −1) reads under the
//       margin — the setting traverse and the winding pinion stand there
// REPORTS: the stack (z), the swing, every clearance and the part nearest it.
import { bootNative } from './native/host.mjs';

const r = await bootNative({ query: '' });
const C = r.clock, THREE = await import('three');
const I = await import('../src/inspect.js');
const { foldUnderPlate, underPlateMetal, underPlateCurvedSpring, UNDER_PLATE } = await import('../src/keyless-rocking-bar.js');
const { gearOuterR } = await import('../src/geometry.js');
const { CLEAR_MARGIN: M, UNIT_MM, KW_MODULE, crownWheelTeeth, WIND_SPUR_TEETH } = await import('../src/layout.js');
const { plateFaces } = await import('./plate-faces.mjs');

const fails = [];
const row = (id, ok, msg) => { console.log(`${ok ? 'PASS' : 'FAIL'} ${id}  ${msg}`); if (!ok) fails.push(id); };

const PF = plateFaces(C, THREE).base;
const byName = {}; C.scene.traverse((o) => { if (o.name && !byName[o.name]) byName[o.name] = o; });
const wp = (n) => byName[n].getWorldPosition(new THREE.Vector3());
C.setPose({}); C.scene.updateMatrixWorld(true);
const built = !!byName.kbBar;   // §334 landing 5a: the bar is in the build; before it, the plan was read off the coaxial transfer
const axis = wp(built ? 'crownWheelArbor' : 'transferArbor'), spur = wp('windSpur');
// the winding sense, measured on the transfer wheel as the spring winds (the crown wheel turns with it today)
const TW = byName.transferWheel;
const ang = () => { const v = new THREE.Vector3(1, 0, 0).applyQuaternion(TW.getWorldQuaternion(new THREE.Quaternion())); return Math.atan2(v.y, v.x); };
C.setPose({ tension: 0.5 }); C.scene.updateMatrixWorld(true); const a0 = ang();
C.setPose({ tension: 0.52 }); C.scene.updateMatrixWorld(true);
let dA = ang() - a0; dA = Math.atan2(Math.sin(dA), Math.cos(dA)); const wind = Math.sign(dA);
C.setPose({}); C.scene.updateMatrixWorld(true);
const fuseeTorque_Nmm = C.going?.energy?.windTorqueAtTransfer_Nmm ?? 1.76029057487366 * crownWheelTeeth / WIND_SPUR_TEETH;

const meshes = []; C.scene.traverse((o) => { if (o.isMesh && !o.userData?.schematic && o.geometry?.attributes?.position) meshes.push(o); });
const within = (o, names) => { for (let p = o; p; p = p.parent) if (names.includes(p.name)) return true; return false; };
const REPLACED = ['transferArbor', 'transferWheel', 'backPlate', 'crownWheelArbor', 'kbDriver', 'kbCarried', 'kbFollower', 'kbBar', 'kbPin', 'kbBlade', 'kbBladeStud', 'kbBladePin', 'kbClip'];   // the bar's own metal, and what it replaced
const nearest = (probe, excuse = []) => { const pb = new THREE.Box3().setFromObject(probe).expandByScalar(1.5); let best = { d: Infinity, n: '-' };
  for (const o of meshes) { if (within(o, REPLACED) || within(o, excuse)) continue; if (!new THREE.Box3().setFromObject(o).intersectsBox(pb)) continue;
    const d = I.meshClearance(probe, o, 1.5); if (d < best.d) best = { d, n: o.name || `(in ${o.parent?.name})` }; } return best; };
const disc = (c, rr, z0, z1) => { const g = new THREE.CylinderGeometry(rr, rr, z1 - z0, 64); g.rotateX(Math.PI / 2); g.translate(c.x, c.y, (z0 + z1) / 2); const m = new THREE.Mesh(g); m.updateMatrixWorld(true); return m; };
const prism = (pts, z0, z1) => { const g = new THREE.ExtrudeGeometry(new THREE.Shape(pts.map(([x, y]) => new THREE.Vector2(x, y))), { depth: z1 - z0, bevelEnabled: false }); g.translate(0, 0, z0); const m = new THREE.Mesh(g); m.updateMatrixWorld(true); return m; };
const hull = (pts) => { const P = [...pts].sort((a, b) => a[0] - b[0] || a[1] - b[1]); const cr = (o, a, b) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
  const lo = [], up = []; for (const p of P) { while (lo.length >= 2 && cr(lo.at(-2), lo.at(-1), p) <= 0) lo.pop(); lo.push(p); }
  for (const p of P.slice().reverse()) { while (up.length >= 2 && cr(up.at(-2), up.at(-1), p) <= 0) up.pop(); up.push(p); } return lo.slice(0, -1).concat(up.slice(0, -1)); };
const circ = (c, rr, n = 24) => Array.from({ length: n }, (_, k) => [c.x + rr * Math.cos(2 * Math.PI * k / n), c.y + rr * Math.sin(2 * Math.PI * k / n)]);

const tb = new THREE.Box3().setFromObject(TW);
const twR = gearOuterR({ module: KW_MODULE, teeth: crownWheelTeeth, thickness: 0.725, mates: [{ teeth: WIND_SPUR_TEETH, mates: [crownWheelTeeth] }] });

// `blade`: null ranks a fit by the LINE's reference blade (landing 2's straight strip on the boss), which is how the
// fold is chosen — the teeth first, then the spring placed for the bar they make (§334 landing 6: the curved blade's path
// is placed on the declared bar, so ranking other bars by it would judge them with a spring nobody placed for them)
function fit(driverTeeth, carriedTeeth, side, blade = null) {
  const U = foldUnderPlate({ axisAt: axis, spurAt: spur, windSenseWorld: wind, driverTeeth, carriedTeeth, fuseeTorque_Nmm, side, blade });
  if (!U.feasible) return { U, rows: [], worst: -Infinity };
  const L = U.line, F = U.followerAt, rows = [];
  const K = underPlateMetal(U, PF.back), { zG0: zW0, zG1: zW1, zB0, zB1 } = K;   // the wheels' reach, their edge bevel included
  rows.push(['driver', nearest(disc(axis, L.reach[0], zW0, zW1))]);
  rows.push(['follower', nearest(disc(F, L.reach[2], zW0, zW1))]);
  rows.push(['follower arbor under the plate', nearest(disc(F, 0.7, zW0, PF.back))]);
  rows.push(['follower arbor over the plate', nearest(disc(F, 0.7, PF.top, tb.min.z))]);
  rows.push(['transfer wheel (spur excused)', nearest(disc(F, twR, tb.min.z, tb.max.z), ['windSpur'])]);
  let w = { d: Infinity }, pinW = { d: Infinity }, plW = { d: Infinity };
  for (let k = 0; k <= 8; k++) { const phi = L.engaged.phi + (L.neutral.phi - L.engaged.phi) * k / 8, Kk = underPlateMetal(U, PF.back, { phi });
    const n = nearest(disc(Kk.centres[1], L.reach[1], zW0, zW1)); if (n.d < w.d) w = n;
    const p = nearest(disc(Kk.pin.at, Kk.pin.r, Kk.pin.z0, Kk.pin.z1)); if (p.d < pinW.d) pinW = p;
    const b = nearest(prism(Kk.outline, zB0, zB1)); if (b.d < plW.d) plW = b; }
  rows.push(['carried wheel (whole swing)', w]);
  rows.push(['carried wheel pin (whole swing)', pinW]);
  rows.push(['bar plate (whole swing)', plW]);
  if (blade) { const CL = underPlateCurvedSpring(U, PF.back, blade).clip; let lobeW = null; for (let k = 0; k <= 8; k++) { const phi = L.engaged.phi + (L.neutral.phi - L.engaged.phi) * k / 8, d = U.centresWorld(phi)[1], e = U.centresWorld(L.engaged.phi)[1], rot = Math.atan2(d.y - axis.y, d.x - axis.x) - Math.atan2(e.y - axis.y, e.x - axis.x); const lb = CL.lobe.map(([x, y]) => [axis.x + (x - axis.x) * Math.cos(rot) - (y - axis.y) * Math.sin(rot), axis.y + (x - axis.x) * Math.sin(rot) + (y - axis.y) * Math.cos(rot)]); const nn = nearest(prism(lb, zB0, zB1)); if (!lobeW || nn.d < lobeW.d) lobeW = nn; } rows.push(['bar boss lobe for the clip (whole swing)', lobeW]); }
  return { U, rows, worst: Math.min(...rows.map(([, n]) => n.d)) };
}

// U0: the choice
const cands = [];
for (const nD of [8, 9]) for (let nc = 10; nc <= 14; nc++) {
  const f = fit(nD, nc, +1); const q = f.U.feasible ? f.U.line.window.q : null;
  cands.push({ nD, nc, q, worst: f.worst, f });
  console.log(`  ${nD}:${nc}:${nD}  ${f.U.feasible ? `q ${q.toFixed(3)}, worst ${f.worst.toFixed(3)}` : f.U.why}`);
}
const ok = cands.filter((c) => c.q !== null && c.worst >= M).sort((a, b) => b.q - a.q);
const win = ok[0];
row('U0', win && win.nD === UNDER_PLATE.driverTeeth && win.nc === UNDER_PLATE.carriedTeeth && UNDER_PLATE.side === 1,
  win ? `widest clear window ${win.nD}:${win.nc}:${win.nD} (q ${win.q.toFixed(3)}); declared ${UNDER_PLATE.driverTeeth}:${UNDER_PLATE.carriedTeeth}:${UNDER_PLATE.driverTeeth} side ${UNDER_PLATE.side}` : 'no candidate fits');

const D = fit(UNDER_PLATE.driverTeeth, UNDER_PLATE.carriedTeeth, UNDER_PLATE.side, UNDER_PLATE.blade), U = D.U, L = U.line;   // as built: the curved blade's line
row('U1', U.feasible && L.inputs.followerTeeth === L.inputs.driverTeeth && L.chain.length === 3,
  `chain ${L.chain.join(':')}, ratio ${(L.inputs.driverTeeth / L.inputs.followerTeeth).toFixed(3)}, line sense ${L.inputs.windSense}`);
const eS = Math.abs(Math.hypot(U.followerAt.x - spur.x, U.followerAt.y - spur.y) - Math.hypot(axis.x - spur.x, axis.y - spur.y));
const eD = Math.abs(Math.hypot(U.followerAt.x - axis.x, U.followerAt.y - axis.y) - L.inputs.centreDistance_u);
row('U2', eS < 1e-9 && eD < 1e-9, `follower at (${U.followerAt.x.toFixed(3)}, ${U.followerAt.y.toFixed(3)}), swung ${U.swingDeg.toFixed(2)}° round the spur; |F−S| err ${eS.toExponential(1)}, |F−D| err ${eD.toExponential(1)}`);
for (const [w, n] of D.rows) console.log(`    ${w.padEnd(32)} ${n.d.toFixed(3)}  (${n.n})`);
const ctl = fit(UNDER_PLATE.driverTeeth, UNDER_PLATE.carriedTeeth, -1, UNDER_PLATE.blade);
row('U3', D.worst >= M && ctl.worst < M, `worst ${D.worst.toFixed(3)} ≥ ${M}; CONTROL side −1 worst ${ctl.worst.toFixed(3)} (${ctl.rows.find(([, n]) => n.d === ctl.worst)?.[1].n})`);
const KS = underPlateMetal(U, PF.back);
// U4 (landing 5a): the build placed exactly this plan
if (built) {
  // since landing 5b the bar swings: held to the plan at both ends of its swing, engaged and at its banking
  const e = (a, b) => Math.hypot(a.x - b.x, a.y - b.y), errs = {};
  for (const [tag, swing, phi] of [['in', 1, U.line.engaged.phi], ['out', 0, U.line.neutral.phi]]) {
    C.setPose({ kbSwing: swing }); C.scene.updateMatrixWorld(true);
    const K = underPlateMetal(U, PF.back, { phi });
    Object.assign(errs, { [`driver ${tag}`]: e(wp('kbDriver'), axis), [`carried ${tag}`]: e(wp('kbCarried'), K.centres[1]), [`pin ${tag}`]: e(wp('kbPin'), K.pin.at),
      [`follower ${tag}`]: e(wp('kbFollower'), U.followerAt), [`transfer ${tag}`]: e(wp('transferWheel'), U.followerAt) });
  }
  C.setPose({ kbSwing: 0 }); C.scene.updateMatrixWorld(true);
  const worstE = Math.max(...Object.values(errs));
  row('U4', worstE < 1e-9, `the build's bar is the plan, in and out: worst centre error ${worstE.toExponential(1)}`);
} else console.log('  U4 not built: the plan only');
console.log(`  REPORT stack: wheels z ${KS.zW0.toFixed(3)}…${KS.zW1.toFixed(3)}, bar plate ${KS.zB0.toFixed(3)}…${KS.zB1.toFixed(3)} (plate back ${PF.back}), transfer wheel ${tb.min.z.toFixed(3)}…${tb.max.z.toFixed(3)}; window q ${L.window.q.toFixed(3)}`);
console.log(fails.length ? `FAIL ${fails.join(', ')}` : 'PASS all rows');
process.exit(fails.length ? 1 : 0);
