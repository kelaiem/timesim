#!/usr/bin/env node
// THE ROCKING BAR'S CURVED RETURN BLADE, PLACED UNDER THE BAR (§334 landing 6) — acceptance, native boots.
//
//   node --import ./tools/native/loader.mjs tools/probe-keyless-rocking-bar-curved.mjs
//
// A straight blade short enough to fit made the carry the clip must give about 2.2 N of grip (its moment rose ×1129
// over the swing); a blade bent round under the bar is soft enough to bring that to a few tenths of a newton. Its path
// is free (curvedBladePath: a polar spiral from a stud to a pin on the bar near the pivot), so this SEARCHES it and
// holds the declared `UNDER_PLATE.blade` to the answer.
//   C0  CHOICE: of the paths whose stud clears the bar's own wheels and whose END faces the pin's in-swing, ranked by
//       the clip grip the line asks at each (the softest first), the first whose blade (every frame of its bend), stud,
//       pin and ear stand CLEAR_MARGIN off the movement's metal in the default build AND in every spec point
//       (SPEC_POINTS, each booted in a child process: the stud stands in the keyless works, which every later solve
//       reads as built). The declared blade is that answer
//   C1  the blade's end travels along its push exactly the swing times the line's lever (the line and the metal agree),
//       and the frames hold the root still
//   C2  the line at that blade: a window (q > 1), the blade under the alloy's limit, and the clip's grip reported
//   C3  CONTROL: the same blade with its end turned away from the pin is refused (facesIn false)
import { bootNative } from './native/host.mjs';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const SCAN = process.env.KB_CURVED_SPEC;   // child mode: which of the candidates (JSON in KB_CURVED_CANDS) clear this spec point
const r = await bootNative({ query: SCAN ?? '' });
const C = r.clock, THREE = await import('three');
const I = await import('../src/inspect.js');
const RB = await import('../src/keyless-rocking-bar.js');
const { CLEAR_MARGIN: M, crownWheelTeeth, WIND_SPUR_TEETH } = await import('../src/layout.js');
const { plateFaces } = await import('./plate-faces.mjs');
const fails = [];
const row = (id, ok, msg) => { console.log(`${ok ? 'PASS' : 'FAIL'} ${id}  ${msg}`); if (!ok) fails.push(id); };

const PF = plateFaces(C, THREE).base;
const byName = {}; C.scene.traverse((o) => { if (o.name && !byName[o.name]) byName[o.name] = o; });
if (!byName.kbBar) { console.log(JSON.stringify({ spec: SCAN, clear: null, why: 'no bar built' })); process.exit(SCAN ? 0 : 1); }
const wp = (n) => byName[n].getWorldPosition(new THREE.Vector3());
C.resetInputs(); C.setPose({ kbSwing: 1 }); C.scene.updateMatrixWorld(true);
const axis = wp('crownWheelArbor'), spur = wp('windSpur'), cb = wp('kbCarried');
const foldWith = (sense, blade = null) => RB.foldUnderPlate({ axisAt: axis, spurAt: spur, windSenseWorld: sense, driverTeeth: RB.UNDER_PLATE.driverTeeth,
  carriedTeeth: RB.UNDER_PLATE.carriedTeeth, fuseeTorque_Nmm: 1.76029057487366 * crownWheelTeeth / WIND_SPUR_TEETH, side: RB.UNDER_PLATE.side, blade });
const sense = [1, -1].map((s) => [s, foldWith(s)]).sort((a, b) => { const e = (u) => { const c = u.centresWorld(u.line.engaged.phi)[1]; return Math.hypot(c.x - cb.x, c.y - cb.y); }; return e(a[1]) - e(b[1]); })[0][0];
C.setPose({ kbSwing: 0 }); C.scene.updateMatrixWorld(true);
const U0 = foldWith(sense), L0 = U0.line, K = RB.underPlateMetal(U0, PF.back);
const D = K.centres[0], F = U0.followerAt;
const carriedAt = (psi) => { const c = K.centres[1], x = c.x - D.x, y = c.y - D.y, cs = Math.cos(psi), sn = Math.sin(psi); return { x: D.x + x * cs - y * sn, y: D.y + x * sn + y * cs }; };
const DEG = Math.PI / 180, dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);

const meshes = []; C.scene.traverse((o) => { if (o.isMesh && !o.userData?.schematic && o.geometry?.attributes?.position) meshes.push(o); });
const within = (o, names) => { for (let p = o; p; p = p.parent) if (names.includes(p.name)) return true; return false; };
const OWN = ['backPlate', 'kbBarGroup', 'kbBar', 'kbPin', 'kbCarried', 'kbDriver', 'kbFollower', 'kbBlade', 'kbBladeStud', 'kbBladePin'];   // the bar's own metal, the blade it replaces included
const nearest = (probe, also = []) => { const pb = new THREE.Box3().setFromObject(probe).expandByScalar(1.2); let best = { d: Infinity, n: '-' };
  for (const o of meshes) { if (within(o, OWN) || within(o, also)) continue; if (!new THREE.Box3().setFromObject(o).intersectsBox(pb)) continue;
    const d = I.meshClearance(probe, o, 1.2); if (d < best.d) best = { d, n: o.name || `(in ${o.parent?.name})` }; } return best; };
const disc = (c, rr, z0, z1) => { const g = new THREE.CylinderGeometry(rr, rr, z1 - z0, 24); g.rotateX(Math.PI / 2); g.translate(c.x, c.y, (z0 + z1) / 2); const m = new THREE.Mesh(g); m.updateMatrixWorld(true); return m; };
const prism = (pts, z0, z1) => { const g = new THREE.ExtrudeGeometry(new THREE.Shape(pts.map(([x, y]) => new THREE.Vector2(x, y))), { depth: z1 - z0, bevelEnabled: false }); g.translate(0, 0, z0); const m = new THREE.Mesh(g); m.updateMatrixWorld(true); return m; };
const strip = (pts, hw) => { const L = [], R = []; for (let i = 0; i < pts.length; i++) { const a = pts[Math.max(0, i - 1)], c = pts[Math.min(pts.length - 1, i + 1)], l = Math.hypot(c.x - a.x, c.y - a.y), nx = -(c.y - a.y) / l, ny = (c.x - a.x) / l;
  L.push([pts[i].x + nx * hw, pts[i].y + ny * hw]); R.push([pts[i].x - nx * hw, pts[i].y - ny * hw]); } return [...L, ...R.reverse()]; };
const reachD = L0.reach[0], reachC = L0.reach[1], reachF = L0.reach[2], PSI = [0, 0.5, 1].map((f) => f * -20.96 * DEG);

// the candidates: every path whose stud's column clears the bar's own wheels (the stud passes the wheel band) and whose
// end faces the pin's in-swing; b at a quarter of the band's stock (the softest the scan found worth its height)
const B_U = 0.18, cands = [];
for (let studR = 3.0; studR <= 5.5 + 1e-9; studR += 0.25) for (let studAz = 0; studAz < 360; studAz += 10) for (const turn of [1, -1])
  for (let span = 120; span <= 420; span += 30) for (const tipR of [1.25, 1.35, 1.5]) {
    const blade = { studR, studAz, turn, span, tipR, b_u: B_U };
    const P = RB.curvedBladePath(blade), th = Math.atan2(K.centres[1].y - D.y, K.centres[1].x - D.x);
    const s = { x: D.x + P.pts[0].x * Math.cos(th) - P.pts[0].y * Math.sin(th), y: D.y + P.pts[0].x * Math.sin(th) + P.pts[0].y * Math.cos(th) };
    const sr = RB.ROCKING_BAR_INPUTS ? 0.185 : 0.185;
    const own = Math.min(dist(s, D) - reachD - sr, dist(s, F) - reachF - sr, ...PSI.map((p) => dist(s, carriedAt(p)) - reachC - sr));
    if (own < M) continue;
    cands.push(blade);
  }
const key = (b) => `${b.studR}/${b.studAz}/${b.turn}/${b.span}/${b.tipR}`;
const judge = (blade) => {
  const U = foldWith(sense, blade);
  if (!U.feasible) return { ok: false, why: U.why };
  const S = RB.underPlateCurvedSpring(U, PF.back, blade);
  if (!S.facesIn) return { ok: false, why: 'end faces away' };
  const res = { U, S, grip: U.line.clip.N_N, q: U.line.window.q };
  return { ok: true, ...res };
};
const exact = (S) => {
  let worst = { d: Infinity, n: '-' }; const take = (n) => { if (n.d < worst.d) worst = n; };
  for (const f of [0, 0.5, 1]) take(nearest(prism(strip(S.frameAt(f), S.h / 2), S.layer.z0, S.layer.z1), ['crownWheelArbor']));
  take(nearest(disc(S.stud.at, S.stud.r, S.stud.z0, PF.back)));
  for (const f of [0, 1]) { const p = { x: 0, y: 0 }; const pinW = (() => { const c = S.pin.at, ang = (1 - f) * S.psiN, x = c.x - D.x, y = c.y - D.y; return { x: D.x + x * Math.cos(ang) - y * Math.sin(ang), y: D.y + x * Math.sin(ang) + y * Math.cos(ang) }; })();
    take(nearest(disc(pinW, S.pin.r, S.pin.z0, K.zB0))); take(nearest(prism(S.outlineAt((1 - f) * S.psiN), K.zB0, K.zB1), ['crownWheelArbor'])); }
  return worst;
};

if (SCAN !== undefined) {
  const list = JSON.parse(process.env.KB_CURVED_CANDS), clear = [];
  for (const b of list) { const j = judge(b); if (j.ok && exact(j.S).d >= M) clear.push(key(b)); }
  console.log(JSON.stringify({ spec: SCAN, clear }));
  process.exit(0);
}

// rank by the grip the line asks (the softest first), keep the first that clear here
const ranked = cands.map((b) => ({ b, j: judge(b) })).filter((x) => x.j.ok && x.j.q > 1).sort((a, b) => a.j.grip - b.j.grip);
const shortlist = [];
// one per stud position (the softest path from it), so a spec point that refuses one stud cannot empty the list
const seenStud = new Set();
for (const x of ranked) { if (shortlist.length >= 40) break; const sk = `${x.b.studR}/${x.b.studAz}`; if (seenStud.has(sk)) continue;
  const w = exact(x.j.S); if (w.d >= M) { shortlist.push({ ...x, w }); seenStud.add(sk); } }
console.log(`  ${cands.length} paths clear the bar's own wheels, ${ranked.length} face the pin with a window; the softest clear in the default build, one per stud: ${shortlist.map((x) => `${key(x.b)} ${x.j.grip.toFixed(3)} N`).join('; ')}`);
// every spec point, two children at a time
const { SPEC_POINTS } = await import('./ci-battery.mjs');
const self = fileURLToPath(import.meta.url), loader = new URL('./native/loader.mjs', import.meta.url).href;
// (the native loader's once-only flag must not ride into a child, or the child never registers it)
const runChild = (q) => new Promise((res) => { let out = ''; const ch = spawn(process.execPath, ['--import', loader, self],
  { env: { ...process.env, KB_CURVED_SPEC: q, KB_CURVED_CANDS: JSON.stringify(shortlist.map((x) => x.b)), __TIMESIM_NATIVE_LOADER__: '' }, stdio: ['ignore', 'pipe', 'ignore'] });
  ch.stdout.on('data', (d) => { out += d; }); ch.on('close', () => { try { res(JSON.parse(out.trim().split('\n').pop())); } catch { res({ spec: q, clear: null }); } }); });
const specs = SPEC_POINTS.map((p) => p.q).filter((q) => q);
const specClear = [];
for (let i = 0; i < specs.length; i += 2) specClear.push(...await Promise.all(specs.slice(i, i + 2).map((q) => runChild(q))));
const failedSpecs = specClear.filter((c) => !Array.isArray(c.clear) && c.why !== 'no bar built');
const everywhere = shortlist.filter((x) => specClear.every((c) => c.clear === null && c.why === 'no bar built' || (Array.isArray(c.clear) && c.clear.includes(key(x.b)))));
console.log(`  ${specs.length} spec points: ${failedSpecs.length} failed to judge; ${everywhere.length} of the shortlist clear in every one`);
for (const c of specClear) if (Array.isArray(c.clear) && c.clear.length < shortlist.length) console.log(`    ${c.spec}: refuses ${shortlist.filter((x) => !c.clear.includes(key(x.b))).map((x) => `${x.b.studR}/${x.b.studAz}`).join(' ')}`);
const win = everywhere[0], decl = RB.UNDER_PLATE.blade;
row('C0', !!win && !!decl && key(win.b) === key(decl) && failedSpecs.length === 0,
  `the softest clear everywhere: ${win ? `${key(win.b)} (grip ${win.j.grip.toFixed(3)} N, worst ${win.w.d.toFixed(3)} ${win.w.n})` : '—'}; declared ${decl ? key(decl) : 'none'}`);
const J = decl ? judge(decl) : null;
if (J && J.ok) {
  const S = J.S, travel = S.travel(1), want = Math.abs(S.psiN) * J.U.line.blade.lever_mm / 0.37894736842105264, f1 = S.frames[S.frames.length - 1];
  row('C1', Math.abs(travel - want) / want < 0.02 && Math.hypot(f1[0].x - S.body[0].x, f1[0].y - S.body[0].y) < 1e-12,
    `the end travels ${travel.toFixed(4)} u along its push against the swing × lever ${want.toFixed(4)}; the root still`);
  const l = J.U.line;
  row('C2', l.window.q > 1 && l.blade.sigmaE < l.blade.sigmaLimit,
    `window q ${l.window.q.toFixed(3)}, rise ×${l.window.rise.toFixed(2)}, blade σ ${l.blade.sigmaE.toFixed(0)}/${l.blade.sigmaLimit} MPa; the clip must grip ${l.clip.N_N.toFixed(3)} N at the arbor (the straight blade asked ${L0.clip.N_N.toFixed(3)})`);
  const ctl = RB.underPlateCurvedSpring(J.U, PF.back, { ...decl, turn: -decl.turn, studAz: decl.studAz + 2 * decl.turn * decl.span });
  row('C3', ctl.facesIn === false, `CONTROL: the same path run the other way round faces the pin: ${ctl.facesIn}`);
} else row('C1', false, 'no declared blade');
console.log(fails.length ? `FAIL ${fails.join(', ')}` : 'PASS all rows');
process.exit(fails.length ? 1 : 0);
