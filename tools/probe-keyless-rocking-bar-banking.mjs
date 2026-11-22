#!/usr/bin/env node
// THE ROCKING BAR'S BANKING, PLACED UNDER THE BAR (§334 landing 7) — acceptance, native boots.
//
//   node --import ./tools/native/loader.mjs tools/probe-keyless-rocking-bar-banking.mjs
//
// The line banks the bar with one pin in an arc slot whose ends stand the swing apart. `underPlateBanking`
// (src/keyless-rocking-bar.js) cuts the slot in a TONGUE of the bar's own, a layer under the return blade, and plants
// the pin as a fixed POST in the plate that drops past the wheels, the bar and the blade into it. Its place, (R, alpha)
// about the bar's pivot, is free, so this SEARCHES it and holds the declared `UNDER_PLATE.banking` to the answer.
//   B0  CHOICE: of the places whose post clears the bar's own metal (the three wheels' reach over the swing, the bar's
//       outline swept, the blade's every frame, its stud and its pin) and whose tongue clears the blade's stud, ranked
//       by the tongue's reach R (the shortest first: the post is sized for the load there, so every place meets its P1
//       duty, and ranking by the load instead ran to the search's edge, because a longer arm always loads the post
//       less), the first whose post and tongue (swept over the swing) stand CLEAR_MARGIN off the movement's metal in the
//       default build AND in every spec point (SPEC_POINTS, each booted in a child process: the post stands in the
//       keyless works, which every later solve reads as built). A tie on R goes to the one standing furthest off
//       the movement. The declared banking is that answer
//   B1  the slot's two end walls each touch the post at one end of the swing (engaged and out) to float noise, and
//       stand clear of it in between. CONTROL: the slot cut for a swing 2° short pinches the post at the out end
//   B2  the load: the post's diameter is TODO 193's pin law at the line's moment over R and its cantilever, at least
//       §50's floor; the tongue's arm at its root is wider than the bending at yield asks
import { bootNative } from './native/host.mjs';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const SCAN = process.env.KB_BANK_SPEC;   // child mode: which of the candidates (JSON in KB_BANK_CANDS) clear this spec point
const r = await bootNative({ query: SCAN ?? '' });
const C = r.clock, THREE = await import('three');
const I = await import('../src/inspect.js');
const RB = await import('../src/keyless-rocking-bar.js');
const { CLEAR_MARGIN: M, STOCK_MIN_U, UNIT_MM, crownWheelTeeth, WIND_SPUR_TEETH } = await import('../src/layout.js');
const { plateFaces } = await import('./plate-faces.mjs');
const fails = [];
const row = (id, ok, msg) => { console.log(`${ok ? 'PASS' : 'FAIL'} ${id}  ${msg}`); if (!ok) fails.push(id); };

const PF = plateFaces(C, THREE).base;
const byName = {}; C.scene.traverse((o) => { if (o.name && !byName[o.name]) byName[o.name] = o; });
if (!byName.kbBar) { console.log(JSON.stringify({ spec: SCAN, clear: null, why: 'no bar built' })); process.exit(SCAN ? 0 : 1); }
const wp = (n) => byName[n].getWorldPosition(new THREE.Vector3());
C.resetInputs(); C.setPose({ kbSwing: 1 }); C.scene.updateMatrixWorld(true);
const axis = wp('crownWheelArbor'), spur = wp('windSpur'), cb = wp('kbCarried');
const BLADE = RB.UNDER_PLATE.blade;
const foldWith = (sense) => RB.foldUnderPlate({ axisAt: axis, spurAt: spur, windSenseWorld: sense, driverTeeth: RB.UNDER_PLATE.driverTeeth,
  carriedTeeth: RB.UNDER_PLATE.carriedTeeth, fuseeTorque_Nmm: 1.76029057487366 * crownWheelTeeth / WIND_SPUR_TEETH, side: RB.UNDER_PLATE.side, blade: BLADE });
const U = [1, -1].map(foldWith).sort((a, b) => { const e = (u) => { const c = u.centresWorld(u.line.engaged.phi)[1]; return Math.hypot(c.x - cb.x, c.y - cb.y); }; return e(a) - e(b); })[0];
const L = U.line, K = RB.underPlateMetal(U, PF.back), SP = RB.underPlateCurvedSpring(U, PF.back, BLADE);
const D = K.centres[0], F = U.followerAt;
// the bar's swing OUT as the build poses it (read, never typed: §334 landing 6's search swept a typed sign the wrong way)
C.setPose({ kbSwing: 0 }); C.scene.updateMatrixWorld(true);
const PSI_OUT = byName.kbBarGroup.rotation.z;
if (Math.abs(PSI_OUT - SP.psiN) > 1e-9) { console.log(`FAIL  the build's swing ${PSI_OUT} is not the law's ${SP.psiN}`); process.exit(1); }
const FR = [0, 0.25, 0.5, 0.75, 1];
const rotD = (p, d) => { const c = Math.cos(d), s = Math.sin(d), x = p.x - D.x, y = p.y - D.y; return { x: D.x + x * c - y * s, y: D.y + x * s + y * c }; };
const rotPts = (pts, d) => pts.map(([x, y]) => { const p = rotD({ x, y }, d); return [p.x, p.y]; });
const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
// a point's distance to a polygon's boundary, negative inside
const polyDist = (P, pts) => { let d = Infinity, inside = false;
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) { const [ax, ay] = pts[j], [bx, by] = pts[i];
    const ex = bx - ax, ey = by - ay, t = Math.max(0, Math.min(1, ((P.x - ax) * ex + (P.y - ay) * ey) / (ex * ex + ey * ey)));
    d = Math.min(d, Math.hypot(P.x - ax - t * ex, P.y - ay - t * ey));
    if ((ay > P.y) !== (by > P.y) && P.x < ax + (bx - ax) * (P.y - ay) / (by - ay)) inside = !inside; }
  return inside ? -d : d; };
const polyline = (P, pts) => { let d = Infinity; for (let i = 1; i < pts.length; i++) { const a = pts[i - 1], b = pts[i], ex = b.x - a.x, ey = b.y - a.y,
  t = Math.max(0, Math.min(1, ((P.x - a.x) * ex + (P.y - a.y) * ey) / (ex * ex + ey * ey))); d = Math.min(d, Math.hypot(P.x - a.x - t * ex, P.y - a.y - t * ey)); } return d; };

const meshes = []; C.scene.traverse((o) => { if (o.isMesh && !o.userData?.schematic && o.geometry?.attributes?.position) meshes.push(o); });
const within = (o, names) => { for (let p = o; p; p = p.parent) if (names.includes(p.name)) return true; return false; };
const OWN = ['backPlate', 'kbBarGroup', 'kbBar', 'kbPin', 'kbCarried', 'kbDriver', 'kbFollower', 'kbBlade', 'kbBladeStud', 'kbBladePin', 'kbClip', 'kbBankPost', 'kbBankTongue'];
const nearest = (probe, also = []) => { const pb = new THREE.Box3().setFromObject(probe).expandByScalar(1.2); let best = { d: Infinity, n: '-' };
  for (const o of meshes) { if (within(o, OWN) || within(o, also)) continue; if (!new THREE.Box3().setFromObject(o).intersectsBox(pb)) continue;
    const d = I.meshClearance(probe, o, 1.2); if (d < best.d) best = { d, n: o.name || `(in ${o.parent?.name})` }; } return best; };
const disc = (c, rr, z0, z1) => { const g = new THREE.CylinderGeometry(rr, rr, z1 - z0, 24); g.rotateX(Math.PI / 2); g.translate(c.x, c.y, (z0 + z1) / 2); const m = new THREE.Mesh(g); m.updateMatrixWorld(true); return m; };
const prism = (pts, z0, z1, holes = []) => { const sh = new THREE.Shape(pts.map(([x, y]) => new THREE.Vector2(x, y)));
  for (const h of holes) sh.holes.push(new THREE.Path(h.map(([x, y]) => new THREE.Vector2(x, y))));
  const g = new THREE.ExtrudeGeometry(sh, { depth: z1 - z0, bevelEnabled: false }); g.translate(0, 0, z0); const m = new THREE.Mesh(g); m.updateMatrixWorld(true); return m; };

const judge = (b) => { const B = RB.underPlateBanking(U, PF.back, BLADE, b); return B; };
// the bar's own metal, analytically: the post column against everything the bar carries or passes, over the swing
const ownClear = (B) => {
  const P = B.post.at, pk = B.post.r; let w = Infinity;
  w = Math.min(w, dist(P, D) - L.reach[0] - pk, dist(P, F) - L.reach[2] - pk);
  for (const f of FR) { const psi = (1 - f) * SP.psiN;
    w = Math.min(w, dist(P, rotD(K.centres[1], psi)) - L.reach[1] - pk);                    // the carried wheel
    w = Math.min(w, polyDist(P, SP.outlineAt(psi)) - pk);                                    // the bar's plate (its clip lobe included)
    w = Math.min(w, polyline(P, SP.frameAt(f)) - SP.h / 2 - pk);                             // the blade
    w = Math.min(w, dist(P, rotD(SP.pin.at, psi)) - SP.pin.r - pk);                          // the blade's pin
    w = Math.min(w, polyDist(SP.stud.at, rotPts(B.outline, psi)) - SP.stud.r); }            // the tongue against the blade's stud
  return Math.min(w, dist(P, SP.stud.at) - SP.stud.r - pk);
};
const exact = (B) => { let w = { d: Infinity, n: '-' }; const take = (n) => { if (n.d < w.d) w = n; };
  take(nearest(disc(B.post.at, B.post.r, B.post.z0, PF.back)));
  for (const f of [0, 0.5, 1]) take(nearest(prism(rotPts(B.outline, (1 - f) * SP.psiN), B.layer.z0, B.layer.z1), ['crownWheelArbor']));
  return w; };
const key = (b) => `${b.R}/${b.alpha}`;

if (SCAN !== undefined) {
  const list = JSON.parse(process.env.KB_BANK_CANDS), clear = [];
  for (const b of list) { const B = judge(b); if (ownClear(B) >= M && exact(B).d >= M) clear.push(key(b)); }
  console.log(JSON.stringify({ spec: SCAN, clear }));
  process.exit(0);
}

const cands = [];
for (let R = 1.75; R <= 9 + 1e-9; R += 0.25) for (let alpha = 0; alpha < 360; alpha += 5) cands.push({ R, alpha });
const own = cands.map((b) => ({ b, B: judge(b) })).map((x) => ({ ...x, own: ownClear(x.B) })).filter((x) => x.own >= M)
  .sort((a, b) => a.b.R - b.b.R || b.own - a.own);
// one per 20° of azimuth (the lightest there), so a spec point that refuses one region cannot empty the list
const shortlist = [], seen = new Set(), blocked = {};
for (const x of own) { if (shortlist.length >= 24) break; const bin = Math.floor(x.b.alpha / 20); if (seen.has(bin)) continue;
  const w = exact(x.B); if (w.d >= M) { shortlist.push({ ...x, w }); seen.add(bin); } else if (process.env.KB_BANK_DRY) blocked[bin] = (blocked[bin] ?? {}), blocked[bin][w.n] = (blocked[bin][w.n] ?? 0) + 1; }
if (process.env.KB_BANK_DRY) console.log('  blocked by bin:', JSON.stringify(blocked));
console.log(`  ${cands.length} places, ${own.length} clear of the bar's own metal; the shortest clear in the default build, one per 20°: ${shortlist.map((x) => `${key(x.b)} ${x.B.load.F_N.toFixed(3)} N (${x.w.d.toFixed(3)} ${x.w.n})`).join('; ')}`);
if (process.env.KB_BANK_DRY) process.exit(0);   // a dry run: the default build's shortlist only
const { SPEC_POINTS } = await import('./ci-battery.mjs');
const self = fileURLToPath(import.meta.url), loader = new URL('./native/loader.mjs', import.meta.url).href;
// (the native loader's once-only flag must not ride into a child, or the child never registers it)
const runChild = (q) => new Promise((res) => { let out = ''; const ch = spawn(process.execPath, ['--import', loader, self],
  { env: { ...process.env, KB_BANK_SPEC: q, KB_BANK_CANDS: JSON.stringify(shortlist.map((x) => x.b)), __TIMESIM_NATIVE_LOADER__: '' }, stdio: ['ignore', 'pipe', 'ignore'] });
  ch.stdout.on('data', (d) => { out += d; }); ch.on('close', () => { try { res(JSON.parse(out.trim().split('\n').pop())); } catch { res({ spec: q, clear: null }); } }); });
const specs = SPEC_POINTS.map((p) => p.q).filter((q) => q);
const specClear = [];
for (let i = 0; i < specs.length; i += 2) specClear.push(...await Promise.all(specs.slice(i, i + 2).map((q) => runChild(q))));
const failedSpecs = specClear.filter((c) => !Array.isArray(c.clear) && c.why !== 'no bar built');
const everywhere = shortlist.filter((x) => specClear.every((c) => c.clear === null && c.why === 'no bar built' || (Array.isArray(c.clear) && c.clear.includes(key(x.b)))));
console.log(`  ${specs.length} spec points: ${failedSpecs.length} failed to judge; ${everywhere.length} of the shortlist clear in every one`);
for (const c of specClear) if (Array.isArray(c.clear) && c.clear.length < shortlist.length) console.log(`    ${c.spec}: refuses ${shortlist.filter((x) => !c.clear.includes(key(x.b))).map((x) => key(x.b)).join(' ')}`);
const tied = everywhere.filter((x) => Math.abs(x.b.R - everywhere[0]?.b.R) < 1e-9).sort((a, b) => b.w.d - a.w.d);
const win = tied[0], decl = RB.UNDER_PLATE.banking;
row('B0', !!win && !!decl && key(win.b) === key(decl) && failedSpecs.length === 0,
  `the shortest clear everywhere: ${win ? `${key(win.b)} (${win.B.load.F_N.toFixed(3)} N on the post, worst ${win.w.d.toFixed(3)} ${win.w.n})` : '—'}; declared ${decl ? key(decl) : 'none'}`);

if (decl) {
  const B = judge(decl), P = B.post.at, pk = B.post.r;
  // B1: the post against the slot's walls over the swing (the slot in the bar's frame, rotated by ψ)
  // the post's clearance to the slot's wall: its centre inside the slot ring reads negative there, so the gap is that
  // distance less the post's radius
  const wall = (slot, f) => -polyDist(P, rotPts(slot, (1 - f) * SP.psiN)) - pk;
  const ends = [wall(B.slot, 1), wall(B.slot, 0)], mid = Math.min(...[0.1, 0.25, 0.5, 0.75, 0.9].map((f) => wall(B.slot, f)));
  // CONTROL: the same law cutting the slot for a swing 2° short of the line's
  const ctl = wall(RB.underPlateBanking(U, PF.back, BLADE, decl, { swingShort: 2 * Math.PI / 180 }).slot, 0);
  row('B1', Math.abs(ends[0]) < 1e-6 && Math.abs(ends[1]) < 1e-6 && mid > 1e-3 && ctl < -1e-3,
    `the post touches the slot's end walls engaged ${ends[0].toExponential(1)} and out ${ends[1].toExponential(1)}, stands ${mid.toFixed(4)} clear in between; CONTROL the slot 2° short pinches it ${ctl.toFixed(4)} at the out end`);
  // B2: the load
  const want = Math.max(STOCK_MIN_U * UNIT_MM, Math.cbrt(32 * B.load.F_N * B.load.lever_mm / (Math.PI * B.load.sigY)));
  // the tongue's arm at the hub's edge: its width across the line from D to the post, read off the outline at that radius
  const hubR = B.bore.r + STOCK_MIN_U, u = { x: Math.cos(B.a0), y: Math.sin(B.a0) }, v = { x: -u.y, y: u.x };
  let lo = Infinity, hi = -Infinity; for (let k = -400; k <= 400; k++) { const s = k * 0.01, Q = { x: D.x + u.x * (hubR + 0.05) + v.x * s, y: D.y + u.y * (hubR + 0.05) + v.y * s };
    if (polyDist(Q, B.outline) < 0) { lo = Math.min(lo, s); hi = Math.max(hi, s); } }
  const width_mm = (hi - lo) * UNIT_MM;
  row('B2', Math.abs(B.load.postD_mm - want) < 1e-12 && B.load.postD_mm >= STOCK_MIN_U * UNIT_MM && width_mm > B.load.wLoad_mm,
    `${B.load.F_N.toFixed(3)} N on the post (the line's ${B.load.Mbank_Nmm.toFixed(4)} N·mm over R ${B.R} u), its cantilever ${B.load.lever_mm.toFixed(3)} mm: ⌀ ${B.load.postD_mm.toFixed(4)} mm; the tongue's arm ${width_mm.toFixed(3)} mm wide at its root, ${B.load.wLoad_mm.toFixed(4)} mm asked`);
} else row('B1', false, 'no declared banking');
console.log(fails.length ? `FAIL ${fails.join(', ')}` : 'PASS all rows');
process.exit(fails.length ? 1 : 0);
