#!/usr/bin/env node
// THE ROCKING BAR'S RETURN BLADE AND BANKING, PLACED UNDER THE PLATE (§334 landing 5c) — acceptance, one native boot.
//
//   node --import ./tools/native/loader.mjs tools/probe-keyless-rocking-bar-springs.mjs
//
// `underPlateSprings` (src/keyless-rocking-bar.js) cuts the line's blade for an azimuth about the driver's axis and the
// banking BRIDGE for its post's place; where each goes is free, so this SEARCHES them against the built movement and
// the bar's own wheels, and holds the declared `UNDER_PLATE.bladeAz` / `.postAz` / `.postR` to the answer.
//   S0  CHOICE: on a 5° grid, the blade azimuth whose stud and blade stand farthest from everything (the movement's
//       metal exact, the bar's own wheels and plate analytic, over the whole swing); then, on a 5° × 0.25 u grid all round the
//       driver from 2.5 u out, the post NEAREST the slot whose post, bridge and run-down pin all clear (the shortest
//       bridge) — in the default build AND in every swept spec point's (SWEEP_POINTS, each booted in a child process:
//       the bridge stands in the keyless works, which every later solve reads as built, and a post that leaves the
//       default clear took the reserve train's room on `stopwork-140`); the declared values are that answer
//   S1  the blade's tip deflects by the line's own swing at its lever (within the ear's half-width offset), and pushes
//       the bar toward its banking out
//   S2  the carried pin touches the bridge slot's in-end engaged and its out-end at the banking, and clears it by the
//       running fit mid-swing
//   S3  every new member stands CLEAR_MARGIN off the movement and off the bar's own wheels and plate over the swing
//       (exact for the movement's metal); CONTROL: the blade at the carried wheel's own azimuth fouls its wheel's path
import { bootNative } from './native/host.mjs';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const SCAN = process.env.KB_SCAN_SPEC;   // child mode: one spec point's clear posts, as JSON on the last line
const r = await bootNative({ query: SCAN ?? '' });
const C = r.clock, THREE = await import('three');
const I = await import('../src/inspect.js');
const { foldUnderPlate, underPlateMetal, underPlateSprings, UNDER_PLATE, polyGap } = await import('../src/keyless-rocking-bar.js');
const { CLEAR_MARGIN: M, crownWheelTeeth, WIND_SPUR_TEETH } = await import('../src/layout.js');
const { plateFaces } = await import('./plate-faces.mjs');

const fails = [];
const row = (id, ok, msg) => { console.log(`${ok ? 'PASS' : 'FAIL'} ${id}  ${msg}`); if (!ok) fails.push(id); };
const PF = plateFaces(C, THREE).base;
const byName = {}; C.scene.traverse((o) => { if (o.name && !byName[o.name]) byName[o.name] = o; });
const wp = (n) => byName[n].getWorldPosition(new THREE.Vector3());
C.setPose({}); C.scene.updateMatrixWorld(true);
const axis = wp('crownWheelArbor'), spur = wp('windSpur');
// the fold's world sense is the build's (CROWN_RAD_PER_TURN's sign): read back as the one that puts the carried wheel
// where the build did, with the bar engaged
C.setPose({ kbSwing: 1 }); C.scene.updateMatrixWorld(true);
const carriedBuilt = wp('kbCarried');
const fold = (sense) => foldUnderPlate({ axisAt: axis, spurAt: spur, windSenseWorld: sense, driverTeeth: UNDER_PLATE.driverTeeth,
  carriedTeeth: UNDER_PLATE.carriedTeeth, fuseeTorque_Nmm: 1.76029057487366 * crownWheelTeeth / WIND_SPUR_TEETH, side: UNDER_PLATE.side });
const U = [fold(1), fold(-1)].sort((a, b) => Math.hypot(a.centresWorld(a.line.engaged.phi)[1].x - carriedBuilt.x, a.centresWorld(a.line.engaged.phi)[1].y - carriedBuilt.y)
  - Math.hypot(b.centresWorld(b.line.engaged.phi)[1].x - carriedBuilt.x, b.centresWorld(b.line.engaged.phi)[1].y - carriedBuilt.y))[0];
C.setPose({ kbSwing: 0 }); C.scene.updateMatrixWorld(true);
const L = U.line, K = underPlateMetal(U, PF.back);
const DEG = Math.PI / 180;

const meshes = []; C.scene.traverse((o) => { if (o.isMesh && !o.userData?.schematic && o.geometry?.attributes?.position) meshes.push(o); });
const within = (o, names) => { for (let p = o; p; p = p.parent) if (names.includes(p.name)) return true; return false; };
const OWN = ['backPlate', 'kbBarGroup', 'kbBar', 'kbPin', 'kbCarried', 'kbDriver', 'kbFollower', 'kbBlade', 'kbBladeStud', 'kbBridge', 'kbBridgePost'];   // the bar's own metal, built or planned
const nearest = (probe, also = []) => { const pb = new THREE.Box3().setFromObject(probe).expandByScalar(1.5); let best = { d: Infinity, n: '-' };
  for (const o of meshes) { if (within(o, OWN) || within(o, also)) continue; if (!new THREE.Box3().setFromObject(o).intersectsBox(pb)) continue;
    const d = I.meshClearance(probe, o, 1.5); if (d < best.d) best = { d, n: o.name || `(in ${o.parent?.name})` }; } return best; };
const disc = (c, rr, z0, z1) => { const g = new THREE.CylinderGeometry(rr, rr, z1 - z0, 48); g.rotateX(Math.PI / 2); g.translate(c.x, c.y, (z0 + z1) / 2); const m = new THREE.Mesh(g); m.updateMatrixWorld(true); return m; };
const strip = (b, z0, z1) => { const g = new THREE.BoxGeometry(b.len, b.h ?? L.blade.h_mm / 0.37894736842105264, z1 - z0); g.translate(b.len / 2, 0, 0); g.rotateZ(b.ang); g.translate(b.root.x, b.root.y, (z0 + z1) / 2); const m = new THREE.Mesh(g); m.updateMatrixWorld(true); return m; };
const prism = (pts, z0, z1) => { const g = new THREE.ExtrudeGeometry(new THREE.Shape(pts.map(([x, y]) => new THREE.Vector2(x, y))), { depth: z1 - z0, bevelEnabled: false }); g.translate(0, 0, z0); const m = new THREE.Mesh(g); m.updateMatrixWorld(true); return m; };
const rect = (b, hh) => { const c = Math.cos(b.ang), s = Math.sin(b.ang), n = { x: -s, y: c };
  return [[0, -hh], [b.len, -hh], [b.len, hh], [0, hh]].map(([u, v]) => [b.root.x + u * c + v * n.x, b.root.y + u * s + v * n.y]); };
const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);

const S0 = underPlateSprings(U, PF.back, { bladeAz: 0, postAz: 0, postR: 6 });
const PSI = [0, 0.25, 0.5, 0.75, 1].map((f) => f * S0.psiN);
const F = U.followerAt, D = K.centres[0];
const carriedAt = (psi) => { const c = K.centres[1], x = c.x - D.x, y = c.y - D.y, cs = Math.cos(psi), sn = Math.sin(psi); return { x: D.x + x * cs - y * sn, y: D.y + x * sn + y * cs }; };
const reachD = L.reach[0], reachC = L.reach[1], reachF = L.reach[2];
// a post through the wheel band against the bar's own wheels, analytic over the swing
const postOwn = (at, rr) => Math.min(dist(at, D) - reachD - rr, dist(at, F) - reachF - rr, ...PSI.map((p) => dist(at, carriedAt(p)) - reachC - rr));

function bladeScore(az, exact = true) {
  const S = underPlateSprings(U, PF.back, { bladeAz: az, postAz: 0, postR: 6 });
  const own = postOwn(S.stud.at, S.stud.r);
  // the blade in the bar's plane against the line's bar outline (its own ear is its contact, so the plain bar)
  let barGap = Infinity;
  for (const p of PSI) { const b = S.bladeAt(p); const out = underPlateMetal(U, PF.back, { phi: null }).outline.map(([x, y]) => { const dx = x - D.x, dy = y - D.y, c = Math.cos(p), s = Math.sin(p); return [D.x + dx * c - dy * s, D.y + dx * s + dy * c]; });
    // the blade meets the bar only at its ear, beside the boss edge: no overlap anywhere, and the margin along the
    // blade outside a margin's ring round its contact (the part that bears on nothing)
    const whole = polyGap(rect(b, S.blade.h / 2), out);
    const cut = (2 * M + S.blade.h) / b.len, far = { ...b, len: b.len * (1 - cut) };
    barGap = Math.min(barGap, whole > 0 ? polyGap(rect(far, S.blade.h / 2), out) : -1); }
  const res = { az, own, barGap };
  if (!exact || own < M || barGap < M) return { ...res, worst: Math.min(own, barGap) };
  const st = nearest(disc(S.stud.at, S.stud.r, S.stud.z0, PF.back));
  let bl = { d: Infinity };
  for (const p of [0, S0.psiN]) { const n = nearest(strip({ ...S.bladeAt(p), h: S.blade.h }, K.zB0, K.zB1)); if (n.d < bl.d) bl = n; }
  return { ...res, stud: st, blade: bl, worst: Math.min(own, barGap, st.d, bl.d) };
}
function postScore(az, rr, bladeAz, exact = true) {
  const S = underPlateSprings(U, PF.back, { bladeAz, postAz: az, postR: rr }), Q = S.bridge.post;
  const own = postOwn(Q.at, Q.r);
  let bar = Infinity;
  const circle = Array.from({ length: 32 }, (_, k) => [Q.at.x + Q.r * Math.cos(2 * Math.PI * k / 32), Q.at.y + Q.r * Math.sin(2 * Math.PI * k / 32)]);
  for (const p of PSI) bar = Math.min(bar, polyGap(circle, S.outlineAt(p)));
  const res = { az, rr, own, barPost: bar };
  if (!exact || own < M || bar < M) return { ...res, worst: Math.min(own, bar) };
  const post = nearest(disc(Q.at, Q.r, Q.z0, PF.back));
  const bridge = nearest(prism(S.bridge.outline, S.bridge.z0, S.bridge.z1));
  let pin = { d: Infinity };
  for (const p of [0, S0.psiN / 2, S0.psiN]) { const n = nearest(disc(carriedAt(p), K.pin.r, S.pinRun.z0, K.zB0)); if (n.d < pin.d) pin = n; }
  return { ...res, post, bridge, pin, worst: Math.min(own, bar, post.d, bridge.d, pin.d) };
}
const fmtD = (a) => (a / DEG).toFixed(0) + '°';
const POST_GRID = [];
for (let a = -180; a < 180; a += 5) for (let rr = 2.5; rr <= 7.5 + 1e-9; rr += 0.25) POST_GRID.push([a, rr]);
const key = (a, rr) => `${a}/${rr}`;
if (SCAN !== undefined) {
  // a spec point: the post and the bridge against that build's metal (its own wheels and bar are the default's law)
  const clear = [];
  for (const [a, rr] of POST_GRID) {
    const S = underPlateSprings(U, PF.back, { bladeAz: UNDER_PLATE.bladeAz * DEG, postAz: a * DEG, postR: rr }), Q = S.bridge.post;
    if (postOwn(Q.at, Q.r) < M) continue;
    if (Math.min(nearest(disc(Q.at, Q.r, Q.z0, PF.back)).d, nearest(prism(S.bridge.outline, S.bridge.z0, S.bridge.z1)).d) >= M) clear.push(key(a, rr));
  }
  console.log(JSON.stringify({ spec: SCAN, clear }));
  process.exit(0);
}
const { SWEEP_POINTS } = await import('./ci-battery.mjs');
const self = fileURLToPath(import.meta.url), loader = new URL('./native/loader.mjs', import.meta.url).href;
// (the native loader's once-only flag must not ride into a child, or the child never registers it)
const runChild = (q) => new Promise((res) => { let out = ''; const ch = spawn(process.execPath, ['--import', loader, self], { env: { ...process.env, KB_SCAN_SPEC: q, __TIMESIM_NATIVE_LOADER__: '' }, stdio: ['ignore', 'pipe', 'pipe'] });
  let err = ''; ch.stderr.on('data', (d) => { err += d; });
  ch.stdout.on('data', (d) => { out += d; }); ch.on('close', (code) => { const last = out.trim().split('\n').pop(); try { res(JSON.parse(last)); } catch { res({ spec: q, clear: null, why: `exit ${code}: ${err.trim().split('\n').slice(-3).join(' | ')}` }); } }); });
const specClear = [];
for (let i = 0; i < SWEEP_POINTS.length; i += 2) specClear.push(...await Promise.all(SWEEP_POINTS.slice(i, i + 2).map((p) => runChild(p.q))));   // two at a time: each child is a whole boot
const everywhere = new Set(POST_GRID.map(([a, rr]) => key(a, rr)).filter((k) => specClear.every((c) => c.clear && c.clear.includes(k))));
console.log(`  spec points scanned: ${specClear.map((c) => `${c.spec || '(default)'} ${c.clear ? c.clear.length : `FAILED (${c.why})`}`).join('; ')}; clear in every one ${everywhere.size}`);
const grid = Array.from({ length: 72 }, (_, k) => (-180 + 5 * k) * DEG);
const blades = grid.map((a) => bladeScore(a, false)).filter((b) => b.worst >= M).map((b) => bladeScore(b.az)).filter((b) => b.worst >= M).sort((a, b) => b.worst - a.worst);
if (!blades.length) { row('S0', false, 'no blade azimuth clears'); process.exit(1); }
const B = blades[0];
const postGrid = POST_GRID.filter(([a, rr]) => everywhere.has(key(a, rr))).map(([a, rr]) => [a * DEG, rr]);
const postsA = postGrid.map(([a, rr]) => postScore(a, rr, B.az, false));
const posts = postsA.filter((b) => b.worst >= M).map((b) => postScore(b.az, b.rr, B.az)).filter((b) => b.worst >= M)
  // of the posts that clear, the one NEAREST the slot: the shortest bridge, the stiffest under the banking load (the pin
  // run's clearance does not depend on the post, so "farthest" would only push it to the grid's edge)
  .map((b) => { const S = underPlateSprings(U, PF.back, { bladeAz: B.az, postAz: b.az, postR: b.rr }); return { ...b, span: dist(S.bridge.post.at, carriedAt(S.psiN / 2)) }; })
  .sort((a, b) => a.span - b.span || b.worst - a.worst);
const P2 = posts[0];
row('S0', !!P2 && Math.abs(B.az - UNDER_PLATE.bladeAz * DEG) < 1e-9 && P2 && Math.abs(P2.az - UNDER_PLATE.postAz * DEG) < 1e-9 && Math.abs(P2.rr - UNDER_PLATE.postR) < 1e-9,
  `blade ${fmtD(B.az)} (worst ${B.worst.toFixed(3)}, ${blades.length} clear), post ${P2 ? `${fmtD(P2.az)} at ${P2.rr.toFixed(2)} (bridge span ${P2.span.toFixed(3)}, worst ${P2.worst.toFixed(3)}, ${posts.length} clear)` : '—'}; declared ${UNDER_PLATE.bladeAz}°, ${UNDER_PLATE.postAz}° at ${UNDER_PLATE.postR}`);
const S = underPlateSprings(U, PF.back, { bladeAz: UNDER_PLATE.bladeAz * DEG, postAz: UNDER_PLATE.postAz * DEG, postR: UNDER_PLATE.postR });
const dLine = L.blade.swing_mm / 0.37894736842105264;
const engaged = S.bladeAt(0), out = S.bladeAt(S.psiN);
const pushSense = Math.sign((engaged.tip.x - out.tip.x) * -Math.sin(Math.atan2(out.tip.y - D.y, out.tip.x - D.x)) + (engaged.tip.y - out.tip.y) * Math.cos(Math.atan2(out.tip.y - D.y, out.tip.x - D.x)));
row('S1', Math.abs(dist(engaged.tip, out.tip) - dLine) < 0.02 && pushSense === -S.sOut,
  `tip deflection ${dist(engaged.tip, out.tip).toFixed(4)} against the line's ${dLine.toFixed(4)}; swinging in moves the tip ${pushSense === -S.sOut ? 'against' : 'WITH'} the blade's push`);
const segD = (p, a, b) => { const dx = b[0] - a[0], dy = b[1] - a[1], L2 = dx * dx + dy * dy, t = L2 ? Math.max(0, Math.min(1, ((p.x - a[0]) * dx + (p.y - a[1]) * dy) / L2)) : 0; return Math.hypot(p.x - a[0] - t * dx, p.y - a[1] - t * dy); };
const wall = (psi) => { const sl = S.bridge.slot, c = carriedAt(psi); let d = Infinity; for (let i = 0; i < sl.length; i++) d = Math.min(d, segD(c, sl[i], sl[(i + 1) % sl.length])); return d - K.pin.r; };
const w0 = wall(0), wm = wall(S.psiN / 2), wN = wall(S.psiN);
row('S2', Math.abs(w0) < 5e-4 && Math.abs(wN) < 5e-4 && wm > 0.04, `pin to slot wall: engaged ${w0.toExponential(1)}, mid ${wm.toFixed(4)}, out ${wN.toExponential(1)}`);
const ctl = bladeScore(0, false);
row('S3', B.worst >= M && P2 && P2.worst >= M && ctl.worst < M,
  `blade: stud ${B.stud.d.toFixed(3)} (${B.stud.n}), strip ${B.blade.d.toFixed(3)} (${B.blade.n}), own wheels ${B.own.toFixed(3)}, bar ${B.barGap.toFixed(3)}; `
  + (P2 ? `banking: post ${P2.post.d.toFixed(3)} (${P2.post.n}), bridge ${P2.bridge.d.toFixed(3)} (${P2.bridge.n}), pin run ${P2.pin.d.toFixed(3)} (${P2.pin.n}), post to own wheels ${P2.own.toFixed(3)}, to the bar ${P2.barPost.toFixed(3)}` : 'no post')
  + `; CONTROL blade at the carried wheel ${ctl.worst.toFixed(3)}`);
console.log(fails.length ? `FAIL ${fails.join(', ')}` : 'PASS all rows');
process.exit(fails.length ? 1 : 0);
