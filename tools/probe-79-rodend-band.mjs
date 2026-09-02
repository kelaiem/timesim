// TODO 79 — IS THERE ROOM FOR A HANGER AT THE LAY SHAFT'S ROD END? The scan
// §68 never ran past t 24.
//
// The alarm link's lay shaft runs in two hanger bushes at chord t 2.45 and 22,
// sited by §68's pose-swept column scan, whose honest bands were t 2.25–2.6 and
// 16.75–24 — and the chord has grown since (§112, ≈ 9 u) while those literals
// did not travel. So the shaft's ROD-END overhang is 12.49 u at λₑ 127.6 and
// k 36 N/m, and TODO 82 measured that overhang carrying 72.4% of the whole
// arming chain's compliance: the reason the pusher→ring stall reads 1.58 mN
// against a 5–50 mN detent band. A third hanger near the rod end is the fix
// TODO 79 names, and nobody has measured whether one fits: §68's scan stopped
// at t 24 and the rod end is at t ≈ 34.7.
//
// This walks the chord from the rod end inboard, stands a candidate COLUMN at
// each station — the hanger's own solid: the bush's outer radius (bore + wall,
// read off the built bushes) from the back plate's underside (z −2) down past
// the shaft — and measures its clearance to every mesh OUTSIDE the link unit,
// over the pose net (every axis at SAMPLES points, plus rest). The wall at
// each station is named. Same-unit metal is excluded (the rod, the crank rim
// and the shaft itself all stand at the rod end, and the hanger is theirs);
// the back plate is not a labelled unit and is what the hanger hangs from.
//
// THE TARGET is arithmetic on the row, not a preference: λ ≤ SLENDER_TARGET
// on an overhang means L ≤ SLENDER_TARGET · 2r / SLENDER_OVERHANG_K, which at
// the shipped r 0.1233 is 2.64 u — a station within that of the rod end
// retires the row; a station farther in shortens the overhang without
// retiring it, and the probe prints both readings so the trade is visible.
//
// TWO CONTROLS, because a column scan that finds "room everywhere" and one
// that measures nothing look alike:
//   · EXACT — the battery's own `clearances` row publishes `Alarm lock ⇄
//     Alarm striking wheel min 0.1572 at alarmStrike f=0.1743, meshes
//     alarmLockPad ⇄ alarmLockCollar` (probe-section-headroom's control,
//     reused verbatim): posed there, this probe's distance call and pose
//     entry must return that number. §68's "measured room 2.77" at station
//     two was tried first and could NOT be reproduced (this reads 7.74 to
//     the axis there, the alarm setting idler) — §68 does not say what its
//     column was or what it excluded, so that figure is not an exactness
//     control, and the note beside station two is worth re-reading with this
//     table in hand.
//   · CONTACT — the column moved to STRADDLE the surface of the nearest wall
//     found at the rod end (the OBJECT, not its name: the dial holds a dozen
//     unnamed cylinders; and straddling, not centred — a column wholly
//     inside a fatter post reads its surface distance, 0.3073 here, because
//     the parity verdict only arbitrates near-zeros) must read ≤ 0: a 0 that
//     cannot be produced is a scan that cannot see a wall.
//
// A FLOOR IS NOT A WALL, and the two are reported apart. The column's foot
// stands a constant distance over the dial's sheets at every station (the
// dial is flat under the whole dial-side works), so a scan that ranks one
// nearest neighbour reads that constant everywhere and sees no in-plane wall
// at all — which is exactly how this probe's first two runs came back: 0.5384
// then 1.5939 at forty-nine stations, both controls failing, first the dial
// plate and then its printed face. The rule is GEOMETRIC, not a name: an
// obstacle lying entirely below the column's foot is a FLOOR, one lying
// entirely above the back plate's underside is a CEILING (the plate stands
// between it and any hanger), and only what crosses the column's own band is
// a WALL. Walls are ranked per station; floor and ceiling are printed once.
// The EXACT control converts conventions before comparing: §68's 2.77 was
// room to the column's AXIS, this measures to its surface, so the bush's
// outer radius is added back.
//
// A REPORT (§40): prints and exits 0; the battery is the acceptance for any
// hanger that lands. Usage: node probe-79-rodend-band.mjs [out.json]
// (from tools/; needs npm ci + Playwright Chromium). SAMPLES= sets the
// per-axis density (default 5); ROOT= serves a different tree.
import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import { writeFileSync } from 'node:fs';

const PORT = process.env.PORT || 8479;
const ROOT = process.env.ROOT || '..';
const SAMPLES = +(process.env.SAMPLES || 5);
const srv = spawn('python3', ['-m', 'http.server', String(PORT), '--bind', '127.0.0.1'], { cwd: ROOT, stdio: 'ignore' });
await new Promise((r) => setTimeout(r, 800));
const browser = await chromium.launch();
const page = await browser.newPage();
page.on('pageerror', (e) => console.error('PAGEERROR', String(e)));
await page.goto(`http://127.0.0.1:${PORT}/index.html`, { waitUntil: 'load', timeout: 90000 });
await page.waitForFunction(() => !!window.__clock, null, { timeout: 90000 });

const V = await page.evaluate(async ({ SAMPLES }) => {
  const THREE = await import('./vendor/three.module.js');
  const I = await import('./src/inspect.js');
  const L = await import('./src/layout.js');
  const { CLEAR_MARGIN, SLENDER_TARGET, SLENDER_OVERHANG_K } = L;
  const clock = window.__clock;
  I.enterAxis(clock);
  clock.scene.updateMatrixWorld(true);
  const unitObj = new Map(clock.labelEntries.map((e) => [e.name, e.obj]));
  const link = unitObj.get('Alarm link');
  const find = (root, pred) => { const out = []; root.traverse((o) => { if (o.isMesh && pred(o)) out.push(o); }); return out; };
  const shaft = find(link, (o) => o.name === 'alarmLinkShaft')[0];
  const rod = find(link, (o) => o.name === 'alarmLinkRod')[0];
  if (!shaft || !rod) return { error: 'alarmLinkShaft / alarmLinkRod not found' };
  // The two hanger bushes: the lathe rings at the shaft's own z (§68's
  // stations), read off the tree rather than the source literals.
  const shaftZ = new THREE.Vector3().setFromMatrixPosition(shaft.matrixWorld).z;
  const bushes = find(link, (o) => o.geometry.type === 'LatheGeometry' || o.geometry.type === 'ExtrudeGeometry')
    .map((o) => { const p = new THREE.Vector3().setFromMatrixPosition(o.matrixWorld); return { o, p }; })
    .filter(({ p }) => Math.abs(p.z - shaftZ) < 0.05)
    .filter(({ o }) => { o.geometry.computeBoundingBox(); const b = o.geometry.boundingBox; return (b.max.x - b.min.x) < 1 && (b.max.y - b.min.y) < 1; });
  if (bushes.length !== 2) return { error: `expected 2 hanger bushes at the shaft's z, found ${bushes.length}` };
  const rodXY = new THREE.Vector3().setFromMatrixPosition(rod.matrixWorld);
  bushes.sort((a, b) => Math.hypot(b.p.x - rodXY.x, b.p.y - rodXY.y) - Math.hypot(a.p.x - rodXY.x, a.p.y - rodXY.y)); // [t 2.45 (far), t 22 (near)]
  const B1 = bushes[0].p, B2 = bushes[1].p;
  const u = { x: B2.x - B1.x, y: B2.y - B1.y }; const uL = Math.hypot(u.x, u.y); u.x /= uL; u.y /= uL;
  const T1 = 2.45, T2 = T1 + uL;                       // chord t of each bush (t 2.45 is §68's own datum)
  const inner = { x: B1.x - u.x * T1, y: B1.y - u.y * T1 };
  const tRod = (rodXY.x - inner.x) * u.x + (rodXY.y - inner.y) * u.y;
  const offRod = Math.abs(-(rodXY.x - inner.x) * u.y + (rodXY.y - inner.y) * u.x);
  // the bush's outer radius, from its own box (bore + wall, whatever they are)
  bushes[1].o.geometry.computeBoundingBox();
  const bb = bushes[1].o.geometry.boundingBox;
  const bushOuter = Math.max(bb.max.y - bb.min.y, bb.max.z - bb.min.z) / 2;
  shaft.geometry.computeBoundingBox();
  const sb = shaft.geometry.boundingBox;
  const shaftR = Math.min(sb.max.x - sb.min.x, sb.max.z - sb.min.z) / 2;
  const target = SLENDER_TARGET * 2 * shaftR / SLENDER_OVERHANG_K;
  // shaft metal ends: its box along its long axis, in world
  const shaftBox = new THREE.Box3().setFromObject(shaft);
  const ends = [new THREE.Vector3(shaftBox.min.x, shaftBox.min.y, shaftZ), new THREE.Vector3(shaftBox.max.x, shaftBox.max.y, shaftZ)];
  const tOf = (p) => (p.x - inner.x) * u.x + (p.y - inner.y) * u.y;
  // the metal's rod-end: whichever box corner projects farthest along u
  const corners = [];
  for (const x of [shaftBox.min.x, shaftBox.max.x]) for (const y of [shaftBox.min.y, shaftBox.max.y]) corners.push(tOf({ x, y }));
  const tMetalEnd = Math.max(...corners), tMetalStart = Math.min(...corners);
  const overhangNow = tMetalEnd - T2;

  // obstacles: every mesh outside the link unit
  const obstacles = [];
  for (const e of clock.labelEntries) {
    if (e.name === 'Alarm link') continue;
    e.obj.traverse((o) => { if (o.isMesh && o.geometry?.attributes?.position && !o.userData?.schematic && !o.userData?.casePart) obstacles.push({ o, unit: e.name }); });
  }
  // the column: the hanger's own solid, plate underside to below the shaft
  const zTop = -2, zBot = shaftZ - bushOuter;
  const col = new THREE.Mesh(new THREE.CylinderGeometry(bushOuter, bushOuter, zTop - zBot, 16), new THREE.MeshBasicMaterial());
  col.rotation.x = Math.PI / 2;
  clock.scene.add(col);
  const place = (x, y) => { col.position.set(x, y, (zTop + zBot) / 2); col.updateMatrixWorld(true); };
  const box = new THREE.Box3();
  const classify = (o) => { box.setFromObject(o); return box.max.z <= zBot + 1e-6 ? 'floor' : box.min.z >= zTop - 1e-6 ? 'ceiling' : 'wall'; };
  const measure = (x, y, poseLabel) => {
    place(x, y);
    let best = Infinity, who = null, floor = Infinity, ceiling = Infinity;
    const cb = new THREE.Box3().setFromObject(col);
    for (const { o, unit } of obstacles) {
      const cls = classify(o);   // sets `box` as a side effect
      const cur = cls === 'floor' ? floor : cls === 'ceiling' ? ceiling : best;
      // cheap bound first: box-to-box distance
      const dx = Math.max(box.min.x - cb.max.x, cb.min.x - box.max.x, 0);
      const dy = Math.max(box.min.y - cb.max.y, cb.min.y - box.max.y, 0);
      const dz = Math.max(box.min.z - cb.max.z, cb.min.z - box.max.z, 0);
      const lb = Math.hypot(dx, dy, dz);
      if (lb >= cur) continue;
      const d = I.meshClearance(col, o, cur);
      if (cls === 'floor') { floor = Math.min(floor, d); continue; }
      if (cls === 'ceiling') { ceiling = Math.min(ceiling, d); continue; }
      if (d < best) { best = d; who = { unit, mesh: o.name || o.geometry.type, pose: poseLabel, o }; }
    }
    return { d: best, who, floor, ceiling };
  };
  const axes = I.resolveAxes();
  const poses = [{ label: 'rest', enter: () => { I.enterAxis(clock); } }];
  for (const ax of axes) for (let i = 0; i <= SAMPLES; i++) {
    const f = i / SAMPLES;
    poses.push({ label: `${ax.name} f=${f.toFixed(2)}`, enter: () => { I.enterAxis(clock); clock.setPose(ax.pose(f)); } });
  }
  const stations = [];
  for (let s = 0.5; s <= 12.5; s += 0.25) stations.push(+s.toFixed(2));
  const rows = stations.map((s) => ({ s, t: +(tMetalEnd - s).toFixed(3), d: Infinity, who: null, floor: Infinity }));
  const control = { exact: null, contact: null };
  for (const pose of poses) {
    pose.enter(); clock.scene.updateMatrixWorld(true);
    for (const r of rows) {
      const t = tMetalEnd - r.s;
      const m = measure(inner.x + u.x * t, inner.y + u.y * t, pose.label);
      if (m.d < r.d) { r.d = m.d; r.who = m.who; }
      r.floor = Math.min(r.floor, m.floor);
      r.ceiling = Math.min(r.ceiling ?? Infinity, m.ceiling);
    }
  }
  // station two's own room, for the record (see the header on why it is not a control)
  I.enterAxis(clock); clock.scene.updateMatrixWorld(true);
  const two = measure(B2.x, B2.y, 'rest');
  control.stationTwo = { d: +two.d.toFixed(4), who: two.who && { unit: two.who.unit, mesh: two.who.mesh } };
  // EXACT control: the published battery row, reproduced with the same distance call
  {
    const findMesh = (unit, name) => { const root = unitObj.get(unit); let hit = null; root?.traverse((o) => { if (!hit && o.isMesh && o.name === name) hit = o; }); return hit; };
    const a = findMesh('Alarm lock', 'alarmLockPad'), b = findMesh('Alarm striking wheel', 'alarmLockCollar');
    const ax = axes.find((x) => x.name === 'alarmStrike');
    if (a && b && ax) {
      I.enterAxis(clock); clock.setPose(ax.pose(0.1743)); clock.scene.updateMatrixWorld(true);
      const d = I.meshClearance(a, b, Infinity);
      control.exact = { measured: +d.toFixed(4), published: 0.1572, ok: Math.abs(d - 0.1572) <= 5e-4 };
    } else control.exact = { ok: false, why: 'control meshes or the alarmStrike axis not found' };
  }
  I.enterAxis(clock); clock.scene.updateMatrixWorld(true);
  // contact control: the column stood ON the nearest in-plane wall found at
  // the rod end's own station — its axis at that mesh's box centre. A wall
  // that crosses the column's band must then read ≤ 0.
  {
    const near = rows[0].who;
    const target = near && near.o;
    if (target) {
      // STRADDLE the wall's surface rather than standing inside it: a column
      // wholly inside a fatter post reads its surface distance (the parity
      // verdict only arbitrates near-zeros), which is exactly the reading a
      // contact control must not accept as contact. Half a column radius
      // inside the box's face puts one surface through the other.
      const tb = new THREE.Box3().setFromObject(target);
      const c = tb.getCenter(new THREE.Vector3());
      c.x = tb.max.x - bushOuter / 2;
      const m = measure(c.x, c.y, 'rest');
      const cb = new THREE.Box3().setFromObject(col);
      control.contact = { d: m.d, on: `${near.unit} / ${near.mesh}`,
        targetBox: [tb.min.toArray().map((v) => +v.toFixed(3)), tb.max.toArray().map((v) => +v.toFixed(3))],
        columnBox: [cb.min.toArray().map((v) => +v.toFixed(3)), cb.max.toArray().map((v) => +v.toFixed(3))],
        direct: +I.meshClearance(col, target, Infinity).toFixed(4), nearestAtCentre: m.who && `${m.who.unit} / ${m.who.mesh}` };
    }
  }
  clock.scene.remove(col);
  return {
    CLEAR_MARGIN, SLENDER_TARGET, SLENDER_OVERHANG_K, shaftR: +shaftR.toFixed(4), bushOuter: +bushOuter.toFixed(4),
    need: +(bushOuter + CLEAR_MARGIN).toFixed(4), target: +target.toFixed(3),
    chord: { inner: [+inner.x.toFixed(3), +inner.y.toFixed(3)], u: [+u.x.toFixed(4), +u.y.toFixed(4)], T1, T2: +T2.toFixed(3), tRod: +tRod.toFixed(3), offRod: +offRod.toFixed(4), tMetalStart: +tMetalStart.toFixed(3), tMetalEnd: +tMetalEnd.toFixed(3), overhangNow: +overhangNow.toFixed(3) },
    rows: rows.map((r) => ({ ...r, who: r.who && { unit: r.who.unit, mesh: r.who.mesh, pose: r.who.pose }, d: +r.d.toFixed(4), floor: +r.floor.toFixed(4), ceiling: +r.ceiling.toFixed(4) })), control, poses: poses.length,
  };
}, { SAMPLES });

if (V.error) {
  // a report, so it says what it could not measure and still exits 0 — the
  // reader decides; nothing gates on this file
  console.log('ERROR', V.error); await browser.close(); srv.kill();
} else {
console.log(`=== TODO 79 — hanger room at the lay shaft's rod end (${V.poses} poses) ===`);
console.log(`shaft r ${V.shaftR}  bush outer ${V.bushOuter}  column need ${V.need} (bush + CLEAR_MARGIN ${V.CLEAR_MARGIN})`);
console.log(`chord: inner (${V.chord.inner.join(', ')}) u (${V.chord.u.join(', ')})  bushes at t ${V.chord.T1} / ${V.chord.T2}  metal t ${V.chord.tMetalStart} … ${V.chord.tMetalEnd}  rod axis at t ${V.chord.tRod} (${V.chord.offRod} off the chord)`);
console.log(`rod-end overhang now ${V.chord.overhangNow} u; λ ≤ SLENDER_TARGET ${V.SLENDER_TARGET} on an overhang wants ≤ ${V.target} u (2r·target/K, K ${V.SLENDER_OVERHANG_K.toFixed(4)})`);
console.log('\n=== controls ===');
const ex = V.control.exact;
console.log(`  EXACT   alarmLockPad ⇄ alarmLockCollar at alarmStrike f=0.1743: ${ex.measured ?? 'n/a'} vs published ${ex.published ?? 0.1572} — ${ex.ok ? 'PASS' : 'FAIL'}${ex.why ? ' (' + ex.why + ')' : ''}`);
const st = V.control.stationTwo;
console.log(`  (record) station two's shipped column reads ${st.d} to its surface = ${(st.d + V.bushOuter).toFixed(4)} to its axis (nearest wall ${st.who?.unit} / ${st.who?.mesh}); §68's note says 2.77 and does not say what it measured`);
const ct = V.control.contact;
console.log(`  CONTACT column on ${ct?.on}: ${ct ? ct.d.toFixed(4) : 'n/a'} — ${ct && ct.d <= 1e-3 ? 'PASS' : 'FAIL'}`);
if (ct) console.log(`          target box ${JSON.stringify(ct.targetBox)}  column box ${JSON.stringify(ct.columnBox)}  direct ${ct.direct}  nearest at centre ${ct.nearestAtCentre}`);
console.log(`\n=== stations, from the rod end inboard (s = distance from the metal's rod end; room = min clearance to a WALL crossing the column's band, over the net; floor ${Math.min(...V.rows.map((r) => r.floor)).toFixed(4)} below the foot, ceiling ${Math.min(...V.rows.map((r) => r.ceiling)).toFixed(4)} above the plate) ===`);
let band = [];
for (const r of V.rows) {
  const ok = r.d >= V.CLEAR_MARGIN;
  if (ok) band.push(r.s);
  console.log(`  s ${r.s.toFixed(2).padStart(5)}  t ${r.t.toFixed(2).padStart(6)}  room ${r.d.toFixed(4).padStart(8)} ${ok ? ' ok ' : 'WALL'}  ${r.who ? `${r.who.unit} / ${r.who.mesh} @ ${r.who.pose}` : ''}`);
}
console.log('\n=== verdict ===');
const inTarget = band.filter((s) => s <= V.target);
if (inTarget.length) console.log(`  a hanger fits within the target: s ∈ {${inTarget.join(', ')}} — the rod-end overhang can meet λ ${V.SLENDER_TARGET}`);
else if (band.length) console.log(`  no station within ${V.target} of the rod end is clear; the nearest clear station is s ${band[0]} (overhang ${band[0]} u, λₑ ≈ ${(band[0] * V.SLENDER_OVERHANG_K / (2 * V.shaftR)).toFixed(1)}) — shortens the overhang without retiring the row`);
else console.log('  no clear station anywhere in the scanned run — the rod end is walled');
if (process.argv[2]) { writeFileSync(process.argv[2], JSON.stringify(V, null, 1)); console.log(`wrote ${process.argv[2]}`); }
await browser.close(); srv.kill();
}
