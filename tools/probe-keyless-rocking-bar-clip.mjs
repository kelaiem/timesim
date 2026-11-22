#!/usr/bin/env node
// THE ROCKING BAR'S FRICTION CLIP, CUT AS METAL (§334 landing 6) — acceptance, one native boot.
//
//   node --import ./tools/native/loader.mjs tools/probe-keyless-rocking-bar-clip.mjs
//
// The line (landing 2) sizes the friction carry that ties the bar to the crown wheel's arbor as two jaws, each a
// quarter round long and N/2 of grip; `underPlateClip` (src/keyless-rocking-bar.js) cuts ONE such jaw in a pocket of the
// bar's boss and lets the bore's far wall be the other. These rows hold the cut to the line and to the movement.
//   K1  the carry the CUT jaw makes is the line's: its section, height and length read off the built mesh, its spring at
//       the line's interference, μ·(F + F)·r (the jaw and the bore's reaction) at each of muPlain's corners equal to the
//       line's carry, so the window the line solved is the one built. CONTROL: without the bore's reaction, half
//   K2  the built jaw stands on the arbor (its inner face at the arbor's radius, under 1e-6), its back one CLEAR_MARGIN
//       off the pocket's back wall and its free end one margin off the pocket's end, and it touches the bar only at
//       its root
//   K3  every wall the pocket leaves is a §50 wall: behind it to the boss lobe's edge, and to the return blade's pin
//       hole; the jaw's section is the line's (SPRING_FLAT_U)
//   K4  the boss lobe clears the movement by CLEAR_MARGIN over the bar's whole swing.
//       CONTROL: the same lobe turned half round (the second jaw two opposite jaws need) reaches the winding stem
import { bootNative } from './native/host.mjs';

const r = await bootNative({ query: '' });
const C = r.clock, THREE = await import('three');
const I = await import('../src/inspect.js');
const RB = await import('../src/keyless-rocking-bar.js');
const { CLEAR_MARGIN: M, STOCK_MIN_U, SPRING_FLAT_U, FRICTION, UNIT_MM, MAINSPRING_E_PA, crownWheelTeeth, WIND_SPUR_TEETH } = await import('../src/layout.js');
const { plateFaces } = await import('./plate-faces.mjs');
const fails = [];
const row = (id, ok, msg) => { console.log(`${ok ? 'PASS' : 'FAIL'} ${id}  ${msg}`); if (!ok) fails.push(id); };
const byName = {}; C.scene.traverse((o) => { if (o.name && !byName[o.name]) byName[o.name] = o; });
if (!byName.kbClip) { console.log('FAIL  the default build has no friction clip (kbClip)'); process.exit(1); }
const PF = plateFaces(C, THREE).base;
const wp = (n) => byName[n].getWorldPosition(new THREE.Vector3());
C.resetInputs(); C.setPose({ kbSwing: 1 }); C.scene.updateMatrixWorld(true);
const axis = wp('crownWheelArbor'), spur = wp('windSpur'), cb = wp('kbCarried');
const foldWith = (sense) => RB.foldUnderPlate({ axisAt: axis, spurAt: spur, windSenseWorld: sense, driverTeeth: RB.UNDER_PLATE.driverTeeth,
  carriedTeeth: RB.UNDER_PLATE.carriedTeeth, fuseeTorque_Nmm: 1.76029057487366 * crownWheelTeeth / WIND_SPUR_TEETH, side: RB.UNDER_PLATE.side, blade: RB.UNDER_PLATE.blade });
// the sense whose engaged carried wheel is the built one
const U = [1, -1].map(foldWith).sort((a, b) => { const e = (u) => { const c = u.centresWorld(u.line.engaged.phi)[1]; return Math.hypot(c.x - cb.x, c.y - cb.y); }; return e(a) - e(b); })[0];
const L = U.line, SP = RB.underPlateCurvedSpring(U, PF.back, RB.UNDER_PLATE.blade), CL = SP.clip;
const D = { x: axis.x, y: axis.y };

// K1: the carry the CUT metal makes, read off the built jaw: its section and height off the mesh, its length the arc it
// spans, its force the cantilever's at the line's interference, doubled by the bore's reaction
{
  const jaw = byName.kbClip; jaw.updateMatrixWorld(true);
  const p = jaw.geometry.attributes.position, v = new THREE.Vector3(); let rin = Infinity, rout = -Infinity, z0 = Infinity, z1 = -Infinity;
  for (let i = 0; i < p.count; i++) { v.fromBufferAttribute(p, i).applyMatrix4(jaw.matrixWorld); const d = Math.hypot(v.x - D.x, v.y - D.y); rin = Math.min(rin, d); rout = Math.max(rout, d); z0 = Math.min(z0, v.z); z1 = Math.max(z1, v.z); }
  const h = (rout - rin) * UNIT_MM, t = (z1 - z0) * UNIT_MM, len = (CL.jaw.free - CL.jaw.root) * rin * UNIT_MM;
  const F = 3 * (MAINSPRING_E_PA / 1e6) * (t * h * h * h / 12) * L.clip.interference_mm / Math.pow(len, 3);   // N, the jaw's spring at its interference
  const rr = rin * UNIT_MM, W = L.window;
  const got = { favourable: FRICTION.muPlain.favourable * 2 * F * rr, nominal: FRICTION.muPlain.nominal * 2 * F * rr, adverse: FRICTION.muPlain.adverse * 2 * F * rr };
  const want = { favourable: W.MfLo_Nmm, nominal: W.MfNom_Nmm, adverse: W.MfLo_Nmm * FRICTION.muPlain.adverse / FRICTION.muPlain.favourable };
  const err = Math.max(...Object.keys(got).map((k) => Math.abs(got[k] - want[k]) / want[k]));
  // CONTROL: the same jaw with no bore reaction (one-sided grip) carries half
  const half = FRICTION.muPlain.favourable * F * rr / W.MfLo_Nmm;
  row('K1', err < 1e-5 && Math.abs(half - 0.5) < 1e-5,   // the mesh is float32: its radii read to a few parts in 1e7, cubed
    `the cut jaw (h ${h.toFixed(4)} mm, ${t.toFixed(3)} mm high, ${len.toFixed(4)} mm long) springs ${F.toFixed(4)} N at the line's ${(L.clip.interference_mm * 1000).toFixed(1)} µm; `
    + `μ·2F·r = ${got.favourable.toFixed(4)} / ${got.nominal.toFixed(4)} / ${got.adverse.toFixed(4)} N·mm, the line's carry to ${err.toExponential(1)}; CONTROL without the bore's reaction ${half.toFixed(3)} of it; the pivot's side load ${F.toFixed(3)} N`);
}
// K2: the built jaw on the arbor, its gaps
{
  const jaw = byName.kbClip;
  const p = jaw.geometry.attributes.position, v = new THREE.Vector3();
  let rin = Infinity, rout = -Infinity;
  for (let i = 0; i < p.count; i++) { v.fromBufferAttribute(p, i).applyMatrix4(jaw.matrixWorld); const d = Math.hypot(v.x - D.x, v.y - D.y); rin = Math.min(rin, d); rout = Math.max(rout, d); }
  const back = CL.rP - rout, endGap = (CL.jaw.free + M / CL.r0 - CL.jaw.free) * CL.r0;
  const arbR = byName.crownWheelArbor.geometry.parameters.radiusTop;
  const dBar = I.meshClearance(jaw, byName.kbBar, 0.5);
  row('K2', Math.abs(rin - arbR) < 1e-6 && Math.abs(back - M) < 1e-6 && Math.abs(endGap - M) < 1e-9 && dBar < 1e-6,
    `jaw inner face at ${rin.toFixed(6)} on the arbor's ${arbR}; back gap ${back.toFixed(6)}, end gap ${endGap.toFixed(6)} (margin ${M}); jaw ⇄ bar ${dBar.toExponential(1)} (its root)`);
}
// K3: walls
{
  const lobeWall = CL.bossR - CL.rP, pinWall = CL.pinWall, sect = CL.h;
  row('K3', lobeWall >= STOCK_MIN_U - 1e-12 && pinWall >= STOCK_MIN_U - 1e-12 && Math.abs(sect - SPRING_FLAT_U) < 1e-9,
    `wall behind the pocket ${lobeWall.toFixed(4)}, to the blade pin's hole ${pinWall.toFixed(4)} (§50 ${STOCK_MIN_U.toFixed(4)}; the pocket turned ${(CL.turn * 180 / Math.PI).toFixed(1)}° off the bar's axis for it); jaw section ${sect.toFixed(4)} (SPRING_FLAT_U ${SPRING_FLAT_U.toFixed(4)})`);
}
// K4: the lobe over the swing, and the control
{
  const meshes = []; C.scene.traverse((o) => { if (o.isMesh && !o.userData?.schematic && o.geometry?.attributes?.position) meshes.push(o); });
  const within = (o, names) => { for (let q = o; q; q = q.parent) if (names.includes(q.name)) return true; return false; };
  const OWN = ['backPlate', 'kbBarGroup', 'crownWheelArbor', 'kbBlade', 'kbBladeStud', 'kbDriver', 'kbFollower'];
  const prism = (pts, z0, z1) => { const g = new THREE.ExtrudeGeometry(new THREE.Shape(pts.map(([x, y]) => new THREE.Vector2(x, y))), { depth: z1 - z0, bevelEnabled: false }); g.translate(0, 0, z0); const m = new THREE.Mesh(g); m.updateMatrixWorld(true); return m; };
  const nearest = (probe) => { const pb = new THREE.Box3().setFromObject(probe).expandByScalar(1.2); let best = { d: Infinity, n: '-' };
    for (const o of meshes) { if (within(o, OWN)) continue; if (!new THREE.Box3().setFromObject(o).intersectsBox(pb)) continue;
      const d = I.meshClearance(probe, o, 1.2); if (d < best.d) best = { d, n: o.name || `(in ${o.parent?.name})` }; } return best; };
  const e = U.centresWorld(L.engaged.phi)[1], a0 = Math.atan2(e.y - D.y, e.x - D.x);
  const sweep = (extra) => { let w = { d: Infinity, n: '-' };
    for (let k = 0; k <= 8; k++) { const c = U.centresWorld(L.engaged.phi + (L.neutral.phi - L.engaged.phi) * k / 8)[1], rot = Math.atan2(c.y - D.y, c.x - D.x) - a0 + extra;
      const lb = CL.lobe.map(([x, y]) => [D.x + (x - D.x) * Math.cos(rot) - (y - D.y) * Math.sin(rot), D.y + (x - D.x) * Math.sin(rot) + (y - D.y) * Math.cos(rot)]);
      const n = nearest(prism(lb, CL.z0, CL.z1)); if (n.d < w.d) w = n; } return w; };
  const built = sweep(0), ctl = sweep(Math.PI);
  row('K4', built.d >= M && ctl.d < M, `the lobe clears by ${built.d.toFixed(3)} (${built.n}) over the swing; CONTROL turned half round ${ctl.d.toFixed(3)} (${ctl.n})`);
}
console.log(fails.length ? `FAIL ${fails.join(', ')}` : 'PASS all rows');
process.exit(fails.length ? 1 : 0);
