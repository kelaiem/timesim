// TODO 131, re-cut for TODO 226 step 3 — does the escape wheel's tooth RIDE the
// pallet stones through a whole beat, with the LOCK the escapement now has?
// ACCEPTANCE: it exits non-zero unless, over one beat from banking to banking
// (the +x stone locked at the start, the −x stone at the end), measured in the
// FORK's own frame — the wheel outline and the stone cross-sections read off
// the built meshes and carried through the live world matrices — the tooth tip
//   · rests DOWN the +x stone's locking face at the banking, a total lock deep
//     (not on the corner: that was the escapement with no lock);
//   · stays ON that stone, within HANDOFF_TRACK_TOL of the locking face or the
//     impulse face, from the banking until it passes the let-off corner — the
//     unlock and the impulse with no free air between them;
//   · makes the wheel RECOIL through the unlock (it turns back as the face
//     lifts, which is what draw is), and reaches the corner before it impulses;
//   · and the NEXT tooth comes to rest down the −x stone's locking face, a
//     total lock deep, at the far banking;
//   · and no tooth outline overlaps a stone's by more than HANDOFF_TRACK_TOL at
//     any sampled pose (the 2D outline-vs-outline depth; the wheel's metal is
//     held to its authored tooth circle, measured here off the vertices).
// The drop is read off the solve the parts were cut from (the fork's
// `userData.escapement`) and held to its declared floor. Two controls hold the
// measure honest: a must-hit (the tooth shoved 0.3 through the locked stone's
// locking face reads the depth the tip's own position predicts, within 10%)
// and a must-miss (at the banking the stone the tooth is NOT on stands clear by
// more than 0.1).
//
// It is NOT probe-fork-blank (one blank, one thickness, the seats' mirror
// symmetry — that probe never looks at a tooth) and NOT the battery's
// `penetration` row (an MTV over two meshes, which reads a whole tooth for any
// interleaved pair and cannot say WHERE on the stone the tip is). This is the
// probe that would have said, at §16 and again at TODO 115, that the impulse
// face was cut 45° off the path the tip travels; and, at TODO 226 step 3, that
// a lock deep enough to hold puts the stone's corner inside the tooth unless
// the tooth's locking face is undercut (it read 0.039 before it was).
//
// Run from tools/ (ROOT is '..'):  node probe-131-escapement-slide.mjs
import { chromium } from 'playwright';
import { spawn } from 'node:child_process';

const ROOT = process.env.ROOT || '..';
const PORT = Number(process.env.PORT || 8531);
const srv = spawn('python3', ['-m', 'http.server', String(PORT), '--bind', '127.0.0.1'],
  { cwd: new URL(ROOT + '/', import.meta.url).pathname, stdio: 'ignore' });
// The server dies with this process, thrown or not: an orphan on this port
// would make the next run's boot timeout look like a build failure
// (SKILL.md; `node tools/servers.mjs` is the audit).
process.on('exit', () => { try { srv.kill(); } catch { /* already gone */ } });
await new Promise((r) => setTimeout(r, 900));
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 900, height: 700 } });
page.setDefaultTimeout(120000);
const bootWarns = [];
page.on('console', (m) => { if (m.type() === 'warning' && !/WebGL|GroupMarker|GL Driver/.test(m.text())) bootWarns.push(m.text()); });
page.on('pageerror', (e) => bootWarns.push('PAGEERROR ' + String(e)));
await page.goto(`http://127.0.0.1:${PORT}/index.html?schematic=0`, { waitUntil: 'load', timeout: 60000 });
await page.waitForFunction(() => !!window.__clock, null, { timeout: 60000 });
await new Promise((r) => setTimeout(r, 1500));

const N = Number(process.env.N || 240);
const out = await page.evaluate(async (N) => {
  const THREE = await import('three');
  const L = await import('./src/layout.js');
  const I = await import('./src/inspect.js');
  const clock = window.__clock;
  clock.resetInputs();
  const ent = (n) => clock.labelEntries.find((e) => e.name === n).obj;
  const wheelG = ent('Escape wheel'), forkG = ent('Pallet fork');
  let prof = null; wheelG.traverse((o) => { if (o.userData?.profile) prof = o; });
  let wheel = null, br = 0;
  prof.traverse((o) => { if (o.isMesh) { o.geometry.computeBoundingSphere(); if (o.geometry.boundingSphere.radius > br) { br = o.geometry.boundingSphere.radius; wheel = o; } } });
  const stones = []; forkG.traverse((o) => { if (o.isMesh && o.material?.name === 'ruby') stones.push(o); });
  let esc = null; forkG.traverse((o) => { if (o.userData?.escapement) esc = o.userData.escapement; });
  const radius = prof.userData.r;
  let reach = 0;
  { const pos = wheel.geometry.attributes.position;
    for (let i = 0; i < pos.count; i++) { if (Math.abs(pos.getZ(i)) > 0.4 + 1e-5) continue; reach = Math.max(reach, Math.hypot(pos.getX(i), pos.getY(i))); } }
  const poly0 = prof.userData.profile.poly;
  let tipR = 0; for (const [x, y] of poly0) tipR = Math.max(tipR, Math.hypot(x, y));
  const tipIdx = poly0.map(([x, y], i) => [Math.hypot(x, y), i]).filter(([r]) => r > tipR - 1e-9).map(([, i]) => i);
  // ONE BEAT, banking to banking: the balance's half-swing h = 0, from its
  // extreme at p = −½ to the next at p = +½ (θ = A·sin πp, p = 2F(τ − τφ),
  // τφ = IMPULSE_WIDTH/(4F) — main.js balanceTheta / BALANCE_PHASE_TAU). The
  // fork moves only while the pin is in the notch, so p is sampled densely
  // across the middle and the two extremes are the rests.
  const F = L.F_BALANCE, tauPh = L.IMPULSE_WIDTH / (4 * F);
  const tauOf = (p) => tauPh + p / (2 * F);
  const forkInv = (() => { clock.setPose({ tau: tauOf(-0.5), crownPullT: 0, leverEngage: 0, tension: 1 }); clock.scene.updateMatrixWorld(true); return new THREE.Matrix4().copy(forkG.matrixWorld).invert(); })();
  const stonePolys = stones.map((s) => {
    const m = new THREE.Matrix4().multiplyMatrices(forkInv, s.matrixWorld);
    return s.geometry.parameters.shapes.getPoints(1).map((p) => { const v = new THREE.Vector3(p.x, p.y, 0).applyMatrix4(m); return [v.x, v.y]; });
  }).sort((a, b) => a[0][0] - b[0][0]);   // by locking-corner x: [0] is the −x stone
  const frameAt = (p, label) => {
    clock.setPose({ tau: tauOf(p), crownPullT: 0, leverEngage: 0, tension: 1 }); clock.scene.updateMatrixWorld(true);
    const inv = new THREE.Matrix4().copy(forkG.matrixWorld).invert();
    const m = new THREE.Matrix4().multiplyMatrices(inv, prof.matrixWorld);
    const poly = poly0.map(([x, y]) => { const v = new THREE.Vector3(x, y, 0).applyMatrix4(m); return [v.x, v.y]; });
    return { p: label ?? p, poly, tips: tipIdx.map((i) => poly[i]), wheelA: wheelG.rotation.z, forkA: forkG.rotation.z };
  };
  const frames = [frameAt(-0.5, 'rest0')];
  for (let k = 0; k <= N; k++) frames.push(frameAt(-0.12 + 0.24 * (k / N)));
  frames.push(frameAt(0.5, 'rest1'));
  const s0 = esc.stones.map((q) => ({ sigma: q.sigma, dropDeg: q.dropDeg, faceRakeDeg: q.faceRake * 180 / Math.PI }));
  return { radius, reach, stonePolys, frames, tol: I.HANDOFF_TRACK_TOL ?? 0.03, beatDeg: L.BEAT_DEG, sense: L.MOVEMENT_SENSE,
    esc: { lockDeg: esc.lock * 180 / Math.PI, runDeg: esc.run * 180 / Math.PI, dropDeclared: esc.drop * 180 / Math.PI, stones: s0 } };
}, N);
await browser.close(); srv.kill();

// ---- 2D geometry ----------------------------------------------------------
const inside = (pt, poly) => { let c = false; for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) { const [xi, yi] = poly[i], [xj, yj] = poly[j]; if (((yi > pt[1]) !== (yj > pt[1])) && (pt[0] < (xj - xi) * (pt[1] - yi) / (yj - yi) + xi)) c = !c; } return c; };
const segD = (p, a, b) => { const dx = b[0] - a[0], dy = b[1] - a[1]; const t = Math.max(0, Math.min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / (dx * dx + dy * dy || 1))); return Math.hypot(p[0] - a[0] - t * dx, p[1] - a[1] - t * dy); };
const bd = (p, poly) => { let m = Infinity; for (let i = 0; i < poly.length; i++) m = Math.min(m, segD(p, poly[i], poly[(i + 1) % poly.length])); return m; };
const dense = (poly, n) => { const o = []; for (let i = 0; i < poly.length; i++) { const a = poly[i], b = poly[(i + 1) % poly.length]; for (let k = 0; k < n; k++) o.push([a[0] + (b[0] - a[0]) * k / n, a[1] + (b[1] - a[1]) * k / n]); } return o; };
const depth = (A, B) => { let d = 0; for (const p of dense(A, 6)) if (inside(p, B)) d = Math.max(d, bd(p, B)); for (const p of dense(B, 24)) if (inside(p, A)) d = Math.max(d, bd(p, A)); return d; };

const { radius, reach, stonePolys, frames, tol, sense, esc } = out;
const fails = [];
const say = (ok, msg) => { console.log(`${ok ? 'PASS' : 'FAIL'}  ${msg}`); if (!ok) fails.push(msg); };
// Along-segment parameter and distance: 0 at a, 1 at b.
const seg = (p, a, b) => { const dx = b[0] - a[0], dy = b[1] - a[1], L2 = dx * dx + dy * dy; const t = ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / L2; const tc = Math.max(0, Math.min(1, t)); return { t, d: Math.hypot(p[0] - a[0] - tc * dx, p[1] - a[1] - tc * dy), along: t * Math.sqrt(L2) }; };
// Stone vertex 0 = locking corner, 1 = let-off corner, 3 = the locking face's far end.
const lockFace = (st, p) => seg(p, st[0], st[3]);
const impFace = (st, p) => seg(p, st[0], st[1]);
const R2D = 180 / Math.PI;

console.log(`TODO 131 / 226 step 3 — one beat banking to banking, ${frames.length} poses, tol ${tol}; lock ${esc.lockDeg}° + run ${esc.runDeg}° of fork`);
say(Math.abs(reach - radius) <= 1e-5, `wheel metal reaches ${reach.toFixed(6)} in its body band; authored tooth circle ${radius}`);

const [minus, plus] = stonePolys;
const r0 = frames[0], r1 = frames[frames.length - 1];
// The tooth locked at the start: the tip nearest the +x stone's locking face.
const tipK = r0.tips.map((t, i) => [lockFace(plus, t).d, i]).sort((a, b) => a[0] - b[0])[0][1];
const lock0 = lockFace(plus, r0.tips[tipK]);
say(lock0.d <= tol && lock0.along > tol,
  `at the banking the tip rests DOWN the +x stone's locking face: ${lock0.d.toFixed(4)} off it, ${lock0.along.toFixed(4)} from the corner`);

// Ride: from the banking until the tip passes the let-off corner it is on one
// of the stone's two faces; the unlock ends where it reaches the corner.
let worstOff = 0, letOffAt = null, cornerAt = null, recoil = 0, wheelAtCorner = null, onLockFrames = 0, onImpFrames = 0;
const a0 = r0.wheelA;
for (let i = 0; i < frames.length - 1; i++) {
  const f = frames[i], tip = f.tips[tipK];
  const lf = lockFace(plus, tip), im = impFace(plus, tip);
  if (im.t > 1 + 1e-6 && lf.d > tol) { letOffAt = f.p; break; }
  const off = Math.min(lf.d, im.d);
  worstOff = Math.max(worstOff, off);
  if (cornerAt === null && lf.along <= 1e-3) { cornerAt = f.p; wheelAtCorner = f.wheelA; }
  if (cornerAt === null) { onLockFrames++; recoil = Math.max(recoil, -sense * (f.wheelA - a0)); } else onImpFrames++;
}
say(letOffAt !== null && worstOff <= tol,
  `the tip stays on the stone from the banking to the let-off (${onLockFrames} poses on the locking face, ${onImpFrames} on the impulse face), at most ${worstOff.toFixed(4)} off a face`);
say(cornerAt !== null && recoil > 0,
  `the unlock RECOILS the wheel ${(recoil * R2D).toFixed(3)}° before the tip reaches the corner (draw)`);
say(cornerAt !== null && Math.abs(sense * (wheelAtCorner - a0)) <= recoil + 1e-6,
  `the wheel has not advanced when the tip reaches the corner: it impulses only after the unlock`);

// Landing: the next tooth rests down the −x stone's locking face at the far banking.
const tipL = r1.tips.map((t, i) => [lockFace(minus, t).d, i]).sort((a, b) => a[0] - b[0])[0][1];
const lock1 = lockFace(minus, r1.tips[tipL]);
say(lock1.d <= tol && lock1.along > tol,
  `at the far banking the next tooth rests DOWN the −x stone's locking face: ${lock1.d.toFixed(4)} off it, ${lock1.along.toFixed(4)} from the corner`);
const minDrop = Math.min(...esc.stones.map((q) => q.dropDeg));
say(minDrop >= esc.dropDeclared - 1e-9,
  `drop ${esc.stones.map((q) => `${q.sigma > 0 ? '+x' : '−x'} ${q.dropDeg.toFixed(3)}°`).join(', ')} (the solve), floor ${esc.dropDeclared}°`);

let worstDepth = 0, worstAt = null;
for (const f of frames) for (const st of stonePolys) { const d = depth(f.poly, st); if (d > worstDepth) { worstDepth = d; worstAt = f.p; } }
say(worstDepth <= tol, `worst outline-vs-outline overlap ${worstDepth.toFixed(4)} at p = ${worstAt}`);

// Controls.
let miss = Infinity; for (const p of dense(minus, 24)) miss = Math.min(miss, bd(p, r0.poly));
say(miss > 0.1, `control (must-miss): at the banking the −x stone stands ${miss.toFixed(4)} clear of the wheel`);
// Must-hit: the tooth translated a known distance PERPENDICULAR to the locked
// stone's locking face, into the stone. The reading is predicted by the tip's
// own shoved position (its distance to the nearest edge of the stone, which
// is the locking face only when the shove is the smaller distance), and the
// instrument is held to it within 10%: a control, not a threshold.
const face = [plus[3][0] - plus[0][0], plus[3][1] - plus[0][1]]; const fl = Math.hypot(...face);
let nrm = [-face[1] / fl, face[0] / fl];
const imp = [plus[1][0] - plus[0][0], plus[1][1] - plus[0][1]];
if (imp[0] * nrm[0] + imp[1] * nrm[1] < 0) nrm = [-nrm[0], -nrm[1]];
const SHOVE = 0.3;
const shoved = r0.poly.map(([x, y]) => [x + SHOVE * nrm[0], y + SHOVE * nrm[1]]);
const tipS = [r0.tips[tipK][0] + SHOVE * nrm[0], r0.tips[tipK][1] + SHOVE * nrm[1]];
const expected = inside(tipS, plus) ? bd(tipS, plus) : 0;
const hit = depth(shoved, plus);
say(expected > 0.05 && Math.abs(hit - expected) <= 0.1 * expected,
  `control (must-hit): the tooth shoved ${SHOVE} through the locking face reads ${hit.toFixed(4)}, the tip's own position predicts ${expected.toFixed(4)}`);
say(bootWarns.length === 0, `boot silent (${bootWarns.length} warning(s))${bootWarns.length ? '\n  ' + bootWarns.join('\n  ') : ''}`);

console.log(fails.length ? `\n${fails.length} FAILURE(S)` : '\nALL PASS');
process.exit(fails.length ? 1 : 0);
