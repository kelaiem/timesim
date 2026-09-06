// TODO 131 — does the escape wheel's tooth tip RIDE the pallet stone's impulse
// face, or does it leave the locking corner into free air? ACCEPTANCE: it
// exits non-zero unless, over one beat measured in the FORK's own frame
// (wheel outline and stone cross-sections both read off the built meshes and
// carried through the live world matrices), the tooth tip
//   · rests ON the locking corner at lock (rest pose, both stones);
//   · stays within HANDOFF_TRACK_TOL of the impulse face, BETWEEN its two
//     corners, from the end of the recoil dip until it passes the let-off;
//   · then runs free by a drop of under 3° of wheel before the OTHER stone's
//     corner catches the next tooth at the end of the window;
//   · never overlaps a stone's outline by more than HANDOFF_TRACK_TOL at any
//     sampled pose (the 2D outline-vs-outline depth, which the wheel's bevel
//     can no longer inflate because the wheel's metal is held to its authored
//     tooth circle — that reach is measured here too, off the vertices).
// Two controls hold the measure honest: a must-hit (the tooth outline shoved
// 0.1 into the locked stone reads a depth of at least 0.09) and a must-miss
// (at rest the stone the tooth is NOT on stands clear by more than 0.1).
//
// It is NOT probe-fork-blank (one blank, one thickness, the seats' mirror
// symmetry — that probe never looks at a tooth) and NOT the battery's
// `penetration` row (an MTV over two meshes, which reads a whole tooth for any
// interleaved pair and cannot say WHERE on the stone the tip is). This is the
// probe that would have said, at §16 and again at TODO 115, that the impulse
// face was cut 45° off the path the tip travels: measured before the fix, the
// tip left the corner at s = 0 and stood 0.76 clear of the stone at s = 1,
// with the row's `penetration` reading 0.078 — green — at rest.
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

const N = Number(process.env.N || 64);
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
  const stones = []; forkG.traverse((o) => { if (o.isMesh && o.material.color.getHex() === 0xb01326) stones.push(o); });
  // The wheel's metal reach in its body band, off the vertices (the welded
  // geometry is what the scene carries; its z band is ±thickness/2 = ±0.4).
  const radius = prof.userData.r;
  let reach = 0;
  { const pos = wheel.geometry.attributes.position;
    for (let i = 0; i < pos.count; i++) { if (Math.abs(pos.getZ(i)) > 0.4 + 1e-5) continue; reach = Math.max(reach, Math.hypot(pos.getX(i), pos.getY(i))); } }
  const poly0 = prof.userData.profile.poly;
  let tipR = 0; for (const [x, y] of poly0) tipR = Math.max(tipR, Math.hypot(x, y));
  const tipIdx = poly0.map(([x, y], i) => [Math.hypot(x, y), i]).filter(([r]) => r > tipR - 1e-9).map(([, i]) => i);
  const beatT = 1 / (2 * L.F_BALANCE);
  const O = new THREE.Vector2();
  // Stone polygons in the fork frame — fixed for the whole beat (they ride
  // the fork). Vertex 0 = locking corner, 1 = let-off corner (geometry.js).
  clock.setPose({ tau: 0, crownPullT: 0, leverEngage: 0, tension: 1 }); clock.scene.updateMatrixWorld(true);
  const forkInv = new THREE.Matrix4().copy(forkG.matrixWorld).invert();
  const stonePolys = stones.map((s) => {
    const m = new THREE.Matrix4().multiplyMatrices(forkInv, s.matrixWorld);
    return s.geometry.parameters.shapes.getPoints(1).map((p) => { const v = new THREE.Vector3(p.x, p.y, 0).applyMatrix4(m); return [v.x, v.y]; });
  }).sort((a, b) => a[0][0] - b[0][0]);   // by locking-corner x: [0] is the −x stone
  const frames = [];
  for (let k = 0; k <= N; k++) {
    const s = k / N;                                   // fraction of the impulse window
    const ph = s * L.IMPULSE_WIDTH;
    clock.setPose({ tau: ph * beatT, crownPullT: 0, leverEngage: 0, tension: 1 }); clock.scene.updateMatrixWorld(true);
    const inv = new THREE.Matrix4().copy(forkG.matrixWorld).invert();
    const m = new THREE.Matrix4().multiplyMatrices(inv, prof.matrixWorld);
    const poly = poly0.map(([x, y]) => { const v = new THREE.Vector3(x, y, 0).applyMatrix4(m); return [v.x, v.y]; });
    const tips = tipIdx.map((i) => poly[i]);
    frames.push({ s, ph, poly, tips });
  }
  // The rest pose, well inside the lock.
  clock.setPose({ tau: 0.5 * beatT, crownPullT: 0, leverEngage: 0, tension: 1 }); clock.scene.updateMatrixWorld(true);
  { const inv = new THREE.Matrix4().copy(forkG.matrixWorld).invert();
    const m = new THREE.Matrix4().multiplyMatrices(inv, prof.matrixWorld);
    const poly = poly0.map(([x, y]) => { const v = new THREE.Vector3(x, y, 0).applyMatrix4(m); return [v.x, v.y]; });
    frames.push({ s: 'rest', ph: 0.5, poly, tips: tipIdx.map((i) => poly[i]) }); }
  return { radius, reach, stonePolys, frames, tol: I.HANDOFF_TRACK_TOL ?? 0.03, beatDeg: L.BEAT_DEG, recoilFrac: L.RECOIL_FRACTION, sense: L.MOVEMENT_SENSE };
}, N);
await browser.close(); srv.kill();

// ---- 2D geometry ----------------------------------------------------------
const inside = (pt, poly) => { let c = false; for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) { const [xi, yi] = poly[i], [xj, yj] = poly[j]; if (((yi > pt[1]) !== (yj > pt[1])) && (pt[0] < (xj - xi) * (pt[1] - yi) / (yj - yi) + xi)) c = !c; } return c; };
const segD = (p, a, b) => { const dx = b[0] - a[0], dy = b[1] - a[1]; const t = Math.max(0, Math.min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / (dx * dx + dy * dy || 1))); return Math.hypot(p[0] - a[0] - t * dx, p[1] - a[1] - t * dy); };
const bd = (p, poly) => { let m = Infinity; for (let i = 0; i < poly.length; i++) m = Math.min(m, segD(p, poly[i], poly[(i + 1) % poly.length])); return m; };
const dense = (poly, n) => { const o = []; for (let i = 0; i < poly.length; i++) { const a = poly[i], b = poly[(i + 1) % poly.length]; for (let k = 0; k < n; k++) o.push([a[0] + (b[0] - a[0]) * k / n, a[1] + (b[1] - a[1]) * k / n]); } return o; };
const depth = (A, B) => { let d = 0; for (const p of dense(A, 6)) if (inside(p, B)) d = Math.max(d, bd(p, B)); for (const p of dense(B, 24)) if (inside(p, A)) d = Math.max(d, bd(p, A)); return d; };
const nearestTip = (tips, c) => tips.reduce((b, t) => (Math.hypot(t[0] - c[0], t[1] - c[1]) < Math.hypot(b[0] - c[0], b[1] - c[1]) ? t : b));
// Position of a point along the impulse face: 0 at the locking corner, 1 at
// the let-off corner; and its offset off the face's line.
const alongFace = (p, st) => { const a = st[0], b = st[1]; const dx = b[0] - a[0], dy = b[1] - a[1], L2 = dx * dx + dy * dy; const t = ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / L2; const off = Math.abs((p[0] - a[0]) * dy - (p[1] - a[1]) * dx) / Math.sqrt(L2); return { t, off }; };

const { radius, reach, stonePolys, frames, tol, beatDeg, recoilFrac } = out;
const fails = [];
const say = (ok, msg) => { console.log(`${ok ? 'PASS' : 'FAIL'}  ${msg}`); if (!ok) fails.push(msg); };

console.log(`TODO 131 — escapement slide, ${N + 1} samples over the impulse window, tol ${tol}`);
say(Math.abs(reach - radius) <= 1e-5, `wheel metal reaches ${reach.toFixed(6)} in its body band; authored tooth circle ${radius}`);

// Which stone is the tooth leaving? The one whose locking corner a tip sits on at s = 0.
const f0 = frames[0];
const dist0 = stonePolys.map((st) => bd(nearestTip(f0.tips, st[0]), [st[0], st[0]]));
const from = dist0[0] < dist0[1] ? 0 : 1, to = 1 - from;
const onto = stonePolys[from], catcher = stonePolys[to];
say(dist0[from] <= tol, `at lock the tip rests on the ${from ? '+x' : '−x'} stone's locking corner (${dist0[from].toFixed(4)})`);

// Ride: from the end of the recoil dip to the let-off, the tip is on the
// face between its corners; after it passes t = 1 it is free. THE TIP IS
// TRACKED BY INDEX from s = 0 — re-picking "the tip nearest the corner" each
// frame swaps to the upstream tooth once the riding tip has travelled half a
// pitch, and read 0.85 off the face on a stone the tip was riding perfectly.
const tipK = f0.tips.findIndex((t) => t === nearestTip(f0.tips, onto[0]));
let rideRows = 0, offMax = 0, sLetOff = null, worstDepth = 0, worstAt = null;
for (const f of frames) {
  for (const st of stonePolys) { const d = depth(f.poly, st); if (d > worstDepth) { worstDepth = d; worstAt = f.s; } }
  if (f.s === 'rest' || f.s < recoilFrac) continue;
  const tip = f.tips[tipK];
  const { t, off } = alongFace(tip, onto);
  if (t <= 1 + 1e-9) { rideRows++; offMax = Math.max(offMax, off); }
  else if (sLetOff === null) sLetOff = f.s;
}
say(rideRows >= 4 && offMax <= tol, `tip rides the impulse face for ${rideRows} samples after the recoil dip, at most ${offMax.toFixed(4)} off the face`);
say(sLetOff !== null && sLetOff < 1, `tip passes the let-off corner at s = ${sLetOff}`);
const dropDeg = sLetOff === null ? NaN : beatDeg * (1 - sLetOff);
say(dropDeg > 0 && dropDeg < 3, `drop ≈ ${dropDeg.toFixed(2)}° of wheel (window-sampled; ${beatDeg}° per beat)`);
const fEnd = frames[frames.length - 2];
const dEnd = bd(nearestTip(fEnd.tips, catcher[0]), [catcher[0], catcher[0]]);
say(dEnd <= tol, `at the end of the window a tip rests on the ${to ? '+x' : '−x'} stone's locking corner (${dEnd.toFixed(4)})`);
say(worstDepth <= tol, `worst outline-vs-outline overlap ${worstDepth.toFixed(4)} at s = ${worstAt}`);

// Controls.
const rest = frames[frames.length - 1];
const restOnto = stonePolys.findIndex((st) => bd(nearestTip(rest.tips, st[0]), [st[0], st[0]]) <= tol);
say(restOnto >= 0, `control: at rest a tip sits on a locking corner (stone ${restOnto})`);
const other = stonePolys[1 - restOnto] ?? stonePolys[0];
let miss = Infinity; for (const p of dense(other, 24)) miss = Math.min(miss, bd(p, rest.poly));
say(miss > 0.1, `control (must-miss): the other stone stands ${miss.toFixed(4)} clear at rest`);
// Must-hit: the whole tooth outline translated a known distance PERPENDICULAR
// to the locking face, into the body (the side the let-off corner is on). A
// shove along the locking face slides the tip and reads nothing (the first
// draft of this control). And the reading is NOT the shove: the tip sits in
// the wedge between the locking face and the impulse face, so a point `d` in
// from the locking face stands only d·sin(incline) from the impulse face,
// with `incline` the angle the impulse face makes with the locking face's
// normal — read off the same polygon. So the control PREDICTS its reading
// and holds the instrument to it within 10%, which is what makes it a
// control rather than a threshold.
const c = stonePolys[restOnto] ?? stonePolys[0];
const face = [c[3][0] - c[0][0], c[3][1] - c[0][1]]; const fl = Math.hypot(...face);
let nrm = [-face[1] / fl, face[0] / fl];
const imp = [c[1][0] - c[0][0], c[1][1] - c[0][1]]; const il = Math.hypot(...imp);
if (imp[0] * nrm[0] + imp[1] * nrm[1] < 0) nrm = [-nrm[0], -nrm[1]];
const cosInc = (imp[0] * nrm[0] + imp[1] * nrm[1]) / il;
const SHOVE = 0.3;
const expected = SHOVE * Math.sqrt(1 - cosInc * cosInc);
const shoved = rest.poly.map(([x, y]) => [x + SHOVE * nrm[0], y + SHOVE * nrm[1]]);
const hit = depth(shoved, c);
say(Math.abs(hit - expected) <= 0.1 * expected,
  `control (must-hit): the tooth shoved ${SHOVE} through the locking face reads ${hit.toFixed(4)}, predicted ${expected.toFixed(4)} (incline ${(Math.acos(cosInc) * 180 / Math.PI).toFixed(1)}° off the face normal)`);
say(bootWarns.length === 0, `boot silent (${bootWarns.length} warning(s))${bootWarns.length ? '\n  ' + bootWarns.join('\n  ') : ''}`);

console.log(fails.length ? `\n${fails.length} FAILURE(S)` : '\nALL PASS');
process.exit(fails.length ? 1 : 0);
