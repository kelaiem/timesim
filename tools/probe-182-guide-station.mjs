// §182 (TODO 104 tier A) — WHERE IS THE PUSHER'S GUIDE BOSS, RELATIVE TO THE
// STEM IT IS SUPPOSED TO BEAR?
//
// `INTRA_UNIT_CONTACTS` declares `alarmPusherStem ⇄ alarmPusherGuide` as "the
// pusher stem running in its guide boss — a sliding bearing at
// PIVOT_BORE_CLEAR". The tier-A audit measures the pair 4.0979 apart over the
// whole pose net, so the declaration is describing a bearing that is not
// there — §169's shape exactly. This says WHICH WAY it is not there, because
// "4.1 apart" is compatible with three different defects and they are not
// fixed the same way:
//
//   - the boss is off the stem's LINE (a bearing beside its shaft),
//   - the boss is on the line but outboard/inboard of the stem's SPAN
//     (a bearing the shaft never reaches), or
//   - the two are at different HEIGHTS.
//
// Everything is read off the built metal in world space, resolved into the
// stem's own frame: s runs along the stem's axis (outward positive), the
// other two are the perpendicular miss in the case-band plane and in z. The
// stem's span comes from its own bounding box projected on that axis, not
// from the constants that built it — a probe that recomputes the build
// arithmetic cannot disagree with it.
//
// REPORT, not an acceptance test: what the numbers mean for the mechanism is
// TODO 104's business, not this file's.
import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
const srv = spawn('python3', ['-m', 'http.server', '8487', '--bind', '127.0.0.1'], { cwd: '..', stdio: 'ignore' });
await new Promise((r) => setTimeout(r, 900));
const b = await chromium.launch(); const p = await b.newPage();
p.on('pageerror', (e) => console.log('PAGEERROR', String(e)));
await p.goto('http://127.0.0.1:8487/index.html?hud=0&sync=0', { waitUntil: 'load', timeout: 90000 });
await p.waitForFunction(() => !!window.__clock, null, { timeout: 90000 });

const out = await p.evaluate(async () => {
  const THREE = await import('./vendor/three.module.js');
  const clock = window.__clock;
  const find = (n) => { let r = null; clock.scene.traverse((o) => { if (o.name === n) r = o; }); return r; };
  const rows = [];
  // Across the press stroke: a station the stem reaches only when pressed is
  // still a bearing, and sampling rest alone would miss it. The key is
  // `alarmPressCycle` — the alarmPress axis's own, spanning both halves of the
  // stroke, 0 → 1 being the inward half. The first cut of this probe wrote
  // `alarmPressT`, which no pose reads: setPose assigns only the keys a pose
  // names, so it posed REST three times and printed three identical rows that
  // read exactly like a stroke-invariant result.
  for (const t of [0, 0.5, 1]) {
    clock.resetInputs();
    clock.setPose({ tau: 0.13, crownPullT: 0, leverEngage: 0, tension: 1, alarmPressCycle: t });
    clock.scene.updateMatrixWorld(true);
    const stem = find('alarmPusherStem'), boss = find('alarmPusherGuide');
    if (!stem || !boss) return { err: 'stem or boss not found' };
    // the stem's axis, from its own rotation (CylinderGeometry runs on +Y)
    const ax = new THREE.Vector3(0, 1, 0)
      .applyQuaternion(stem.getWorldQuaternion(new THREE.Quaternion())).normalize();
    const S = stem.getWorldPosition(new THREE.Vector3());
    // outward positive: the stem sits outboard of the movement's centre
    const sign = Math.sign(S.x * ax.x + S.y * ax.y) || 1;
    const u = ax.clone().multiplyScalar(sign);
    const perp = new THREE.Vector3(-u.y, u.x, 0).normalize();
    // the stem's SPAN on its own axis, read from the metal
    const pos = stem.geometry.attributes.position;
    let sMin = Infinity, sMax = -Infinity;
    const v = new THREE.Vector3();
    for (let i = 0; i < pos.count; i++) {
      v.fromBufferAttribute(pos, i).applyMatrix4(stem.matrixWorld);
      const s = v.dot(u);
      if (s < sMin) sMin = s;
      if (s > sMax) sMax = s;
    }
    const B = new THREE.Box3().setFromObject(boss).getCenter(new THREE.Vector3());
    const sB = B.dot(u);
    rows.push({
      pressCycle: t,
      stemSpan: [+sMin.toFixed(4), +sMax.toFixed(4)],
      bossAt: +sB.toFixed(4),
      pastStemEndBy: +(sB - sMax).toFixed(4),
      perpMiss: +Math.abs((B.x - S.x) * perp.x + (B.y - S.y) * perp.y).toFixed(4),
      zMiss: +(B.z - S.z).toFixed(4),
      plateR: +clock.plateR.toFixed(4),
      bossR: +Math.hypot(B.x, B.y).toFixed(4),
      stemOuterR: +Math.hypot(S.x + u.x * (sMax - S.dot(u)), S.y + u.y * (sMax - S.dot(u))).toFixed(4),
    });
  }
  return { rows };
});
console.log(JSON.stringify(out, null, 2));
await b.close(); srv.kill();
