// TODO 90 finding 5 — WHERE CAN THE LOCK BEAK STAND SO THE COLUMN CAN DRIVE IT?
//
// Finding 5 measured the defect: the lock lever's beak reads the castellations
// from a station ON the line between its pivot and the wheel's centre, and a
// lever moves its beak PERPENDICULAR to the arm — so at that one station the
// perpendicular IS the tangent and the radial excursion is 0.00114, 0.08% of
// the tier it is declared to read. The column cannot block the lever; the pose
// law does.
//
// The repair is position-space, and this is its SEARCH. The beak's station is
// swept as an angle φ about the WHEEL (φ = 0 is today's, on the pivot line),
// and every row prints the four quantities that decide it together, because a
// station chosen against one of them is wrong from outside it (§173 did that
// twice):
//
//   · RADIAL GAIN — |component of the beak's motion along the wheel radius|.
//     0 today. This is the whole defect, as one number.
//   · BEAK REACH from the pivot — what the tail costs in the corridor.
//   · REQUIRED CHAMFER — the pillars' outer edge must ramp by exactly the
//     radial travel the beak makes, or the column's square azimuthal end hits
//     a dropped beak instead of camming it out. = LIFT · reach · gain.
//   · CORRIDOR — the nearest mesh to the RISER and to the NOSE at that
//     station, over the whole toggle, excluding the two units that are
//     supposed to touch.
//
// THE RISER IS PART OF THE ANSWER, NOT AN AFTERTHOUGHT. It carries the beak
// from the castellation band down to the tail below the skirt, so it crosses
// the saw's z band wherever it stands, and §171's rule fixes its radius from
// the wheel axis at ALARM_COL_TIP_R + CLEAR_MARGIN + its own r = 6.674. The
// nose then overhangs INWARD to the castellations' outer wall — §171's own
// anatomy, reused rather than reinvented.
//
// WHICH PROBE THIS IS NOT. probe-90-lockhold measures the other END of this
// lever (the finger against the stop wheel) and is finding 4's; this one never
// looks at the pad. probe-171-corridor scanned a radius for ONE rod at a fixed
// azimuth; this sweeps AZIMUTH for a two-member assembly and prints the gain
// that azimuth buys, which is the quantity §171 had no reason to ask about.
//
// CONTROLS. Must-hit: at φ = 0 the computed gain must reproduce the measured
// 0.00114 / LIFT — the geometry of today's build, recovered from the search's
// own arithmetic. Must-miss: a probe body parked at the movement's centre must
// find the corridor occupied. A search whose controls fail has found nothing.
import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
const srv = spawn('python3', ['-m', 'http.server', '8497', '--bind', '127.0.0.1'], { cwd: '..', stdio: 'ignore' });
await new Promise((r) => setTimeout(r, 900));
const b = await chromium.launch(); const p = await b.newPage();
p.on('pageerror', (e) => console.log('PAGEERROR', String(e)));
await p.goto('http://127.0.0.1:8497/index.html?hud=0&sync=0', { waitUntil: 'load', timeout: 90000 });
await p.waitForFunction(() => !!window.__clock, null, { timeout: 90000 });

const out = await p.evaluate(async () => {
  const THREE = await import('./vendor/three.module.js');
  const I = await import('./src/inspect.js');
  const clock = window.__clock;
  const find = (n) => { let r = null; clock.scene.traverse((o) => { if (o.name === n) r = o; }); return r; };
  const world = (o) => o.getWorldPosition(new THREE.Vector3());

  const pad = find('alarmLockPad'), beak = find('alarmLockBeak'), riser = find('alarmLockBeakRiser');
  const cols = find('alarmColCastellations'), skirt = find('alarmColSkirt');
  const linkBeak = find('alarmLinkBeak');
  const lever = pad.parent, wheel = cols.parent;

  clock.setPose({ tau: 0.13, crownPullT: 0, leverEngage: 0, tension: 1,
                  windAccumTurns: 0, alarmOn: 0, alarmPressCycle: 0 });
  clock.scene.updateMatrixWorld(true);

  const P = new THREE.Vector3(lever.position.x, lever.position.y, lever.position.z);
  const W = world(wheel);
  const D = Math.hypot(W.x - P.x, W.y - P.y);
  const beakZ = world(beak).z, riserR = riser.geometry.parameters.radiusTop;

  // The castellation ring's radial extent, in the wheel's own frame.
  const ringR = (() => {
    const a = cols.geometry.attributes.position, v = new THREE.Vector3();
    let lo = Infinity, hi = -Infinity;
    for (let i = 0; i < a.count; i++) { v.fromBufferAttribute(a, i);
      const r = Math.hypot(v.x, v.y); lo = Math.min(lo, r); hi = Math.max(hi, r); }
    return [lo, hi];
  })();
  const readR = ringR[1];              // the outer wall the beak reads

  // WHERE THE OTHER RIDER SITS, because the chamfer may not reach it. The link
  // beak rides the column TOPS; its radial span from the WHEEL axis bounds how
  // much outer metal the chamfer is allowed to take.
  const linkSpan = (() => {
    if (!linkBeak) return null;
    const box = new THREE.Box3().setFromObject(linkBeak);
    const pts = [[box.min.x, box.min.y], [box.min.x, box.max.y], [box.max.x, box.min.y], [box.max.x, box.max.y]];
    let lo = Infinity, hi = -Infinity;
    for (const [x, y] of pts) { const r = Math.hypot(x - W.x, y - W.y); lo = Math.min(lo, r); hi = Math.max(hi, r); }
    return [lo, hi];
  })();

  // The lever's own travel, read off the build rather than restated.
  const LIFT = (() => {
    const a0 = (() => { clock.setPose({ tau: 0.13, crownPullT: 0, leverEngage: 0, tension: 1,
      windAccumTurns: 0, alarmOn: 0, alarmPressCycle: 0 }); return lever.rotation.z; })();
    const a1 = (() => { clock.setPose({ tau: 0.13, crownPullT: 0, leverEngage: 0, tension: 1,
      windAccumTurns: 0, alarmOn: 0, alarmPressCycle: 1 }); return lever.rotation.z; })();
    return Math.abs(a1 - a0);
  })();

  // A probe body standing in for a member at a candidate station, swept over
  // the toggle against everything that is NOT supposed to touch it.
  // UNIT ATTRIBUTION comes from the label registry, walking each mesh's parent
  // chain to the nearest registered group. The first cut of this probe invented
  // a `userData.labelName` that does not exist, so every mesh attributed to
  // `?`, the exclusion never fired, and the corridor column faithfully reported
  // the COLUMN WHEEL as the obstacle — the part the beak exists to touch. The
  // skill's "the ground is not an obstacle" trap, arrived at through a typo.
  // WHAT THE BEAK IS ALLOWED TO BE NEAR. Excluding whole UNITS was too coarse:
  // the wheel's three bodies are what the beak exists to touch, but the OTHER
  // RIDERS in the same unit — the driver pawl and the sautoir — are ordinary
  // obstacles, and they are the ones that actually bind a new station. They are
  // also a cross-unit EXPECTED pair away from being invisible to the battery
  // (TODO 6's residue), so if this probe does not look at them nothing does.
  const EXCLUDE_MESH = new Set(['alarmColBase', 'alarmColSkirt', 'alarmColCastellations']);
  const EXCLUDE = new Set(['Alarm lock']);
  const entries = clock.labelEntries;      // [{ name, obj }]
  const unitOf = (mesh) => {
    let u = mesh;
    while (u) { const e = entries.find((x) => x.obj === u); if (e) return e.name; u = u.parent; }
    return null;
  };
  const others = [];
  clock.scene.traverse((o) => {
    if (!o.isMesh || o.userData.schematic) return;
    others.push({ mesh: o, unit: unitOf(o) });
  });

  // TWO PROBES, NOT ONE, and the first cut of this search got it wrong by using
  // one. The RISER crosses every band from the tail to the castellations, so it
  // must clear the saw and whatever works it. The NOSE lives only in the
  // castellation band — and the driver pawl works the SAW, a band the nose
  // never enters. Scanning both with one full-height body reported the pawl as
  // an obstacle to the nose, which it cannot be, and that false reading is what
  // made the two parity-legal stations look blocked.
  const noseBand = (() => { const bb = new THREE.Box3().setFromObject(beak); return bb.max.z - bb.min.z; })();
  const riserBody = new THREE.Mesh(new THREE.CylinderGeometry(riserR, riserR, 3.66, 10), new THREE.MeshBasicMaterial());
  const noseBody = new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.25, noseBand, 10), new THREE.MeshBasicMaterial());
  riserBody.rotation.x = Math.PI / 2; noseBody.rotation.x = Math.PI / 2;
  clock.scene.add(riserBody); clock.scene.add(noseBody);
  // Park the idle body far away rather than leaving a stale one in the scene:
  // an unused probe still answers meshClearance, and the first cut of this
  // refactor left the CONTROL measuring whichever body happened to be current.
  const park = (m) => { m.position.set(0, 0, -900); m.updateMatrixWorld(true); };

  const scanAt = (probe, x, y, z) => {
    park(probe === riserBody ? noseBody : riserBody);
    probe.position.set(x, y, z);
    probe.updateMatrixWorld(true);
    let best = Infinity, who = null;
    for (const o of others) {
      if (EXCLUDE.has(o.unit) || EXCLUDE_MESH.has(o.mesh.name)) continue;
      const bb = new THREE.Box3().setFromObject(o.mesh);
      // prune only by the probe's OWN swept envelope, generously — a prune
      // tighter than the body it stands in for hides real obstacles
      const halfH = (probe === riserBody ? 3.66 : noseBand) / 2 + 0.05;
      if (bb.min.z > z + halfH || bb.max.z < z - halfH) continue;
      const near = Math.max(0, Math.max(bb.min.x - x, x - bb.max.x))
                 + Math.max(0, Math.max(bb.min.y - y, y - bb.max.y));
      if (near > 6) continue;
      const c = I.meshClearance(probe, o.mesh);
      if (c !== null && c < best) { best = c; who = (o.unit || '?') + '/' + (o.mesh.name || o.mesh.geometry.type); }
    }
    return { best, who };
  };

  // The sweep. φ is measured at the WHEEL, from the direction pointing back at
  // the lever's pivot, so φ = 0 is exactly today's station.
  const uWP = { x: (P.x - W.x) / D, y: (P.y - W.y) / D };
  const perp = { x: -uWP.y, y: uWP.x };
  const at = (phi, r) => ({
    x: W.x + (uWP.x * Math.cos(phi) + perp.x * Math.sin(phi)) * r,
    y: W.y + (uWP.y * Math.cos(phi) + perp.y * Math.sin(phi)) * r,
  });
  const RISER_R_WHEEL = 6.674;         // §171's rule, quoted from the build

  const rows = [];
  for (const deg of [0, 10, 20, 30, 40, 44.57, 50, 55, 60, 65, -60, -50, -44.57, -30]) {
    const phi = deg * Math.PI / 180;
    const B = at(phi, readR), R = at(phi, RISER_R_WHEEL);
    const reach = Math.hypot(B.x - P.x, B.y - P.y);
    // motion of the beak = perpendicular to (B - P); radial dir = (W - B)/|..|
    const m = { x: -(B.y - P.y) / reach, y: (B.x - P.x) / reach };
    const ur = { x: (W.x - B.x) / readR, y: (W.y - B.y) / readR };
    const gain = Math.abs(m.x * ur.x + m.y * ur.y);
    const cham = LIFT * reach * gain;
    // Over the WHOLE press, not one pose: the pawl and the sautoir move, and a
    // station cleared at rest is not cleared.
    let cR = { best: Infinity, who: null }, cB = { best: Infinity, who: null };
    for (const cyc of [0, 0.5, 1, 1.5]) {
      clock.setPose({ tau: 0.13, crownPullT: 0, leverEngage: 0, tension: 1,
                      windAccumTurns: 0, alarmOn: 0, alarmPressCycle: cyc });
      clock.scene.updateMatrixWorld(true);
      const a = scanAt(riserBody, R.x, R.y, beakZ);
      const c = scanAt(noseBody, B.x, B.y, beakZ);
      if (a.best < cR.best) cR = a;
      if (c.best < cB.best) cB = c;
    }
    rows.push({ deg: +Number(deg).toFixed(2), reach: +reach.toFixed(4), riserReach: +Math.hypot(R.x - P.x, R.y - P.y).toFixed(4),
                gain: +gain.toFixed(4), cham: +cham.toFixed(4),
                riserClear: +cR.best.toFixed(4), riserWho: cR.who,
                noseClear: +cB.best.toFixed(4), noseWho: cB.who });
  }

  // WHO ELSE STANDS AROUND THIS WHEEL. The corridor to other UNITS turns out to
  // be wide open at this z — the alarm cluster is its own island — so what
  // actually binds a new station is the other RIDERS, which live in the two
  // units the corridor scan excludes. Their azimuths about the wheel (measured
  // from the same φ = 0 the sweep uses) are the real fold constraint, and a
  // search that only looked outward would have missed every one of them.
  const riders = [];
  for (const nm of ['alarmLinkBeakPost', 'alarmLinkBeak', 'alarmLinkBeakBar',
                    'alarmJumperArm', 'alarmJumperStud', 'alarmColPawlNose',
                    'alarmColPawlPost', 'alarmLockSpringStud', 'alarmLockPivotPost']) {
    const o = find(nm); if (!o) continue;
    const w = world(o);
    const dx = w.x - W.x, dy = w.y - W.y;
    // express in the same frame the sweep uses: φ from the wheel→pivot ray
    const ax = dx * uWP.x + dy * uWP.y, ay = dx * perp.x + dy * perp.y;
    riders.push({ name: nm, r: +Math.hypot(dx, dy).toFixed(4),
                  phiDeg: +(Math.atan2(ay, ax) * 180 / Math.PI).toFixed(1) });
  }

  // CONTROL — must-HIT the obstacle set: parked on a body that is neither
  // excluded unit, the scan must report ~0. The centre of the movement was the
  // first choice and it was a bad one: at the beak's z there is genuinely
  // nothing there, so "far from everything" was the correct answer to a
  // question that tested nothing.
  const gongMesh = (() => { let m = null; clock.scene.traverse((o) => {
    if (!m && o.isMesh && unitOf(o) === 'Alarm gong') m = o; }); return m; })();
  const gp = gongMesh ? world(gongMesh) : null;
  // The RISER body, because it is the tall one and the gong shares its band.
  const ctlCentre = gp ? scanAt(riserBody, gp.x, gp.y, gp.z) : { best: NaN, who: 'no gong' };
  // And a must-MISS beside it: the same body far outside the movement.
  const ctlFar = scanAt(riserBody, 200, 200, gp ? gp.z : beakZ);
  clock.scene.remove(riserBody); clock.scene.remove(noseBody);
  return { D, readR, ringR, linkSpan, LIFT, beakZ, riserR, rows, riders,
           ctlCentre: { best: +ctlCentre.best.toFixed(4), who: ctlCentre.who },
           ctlFar: { best: ctlFar.best, who: ctlFar.who } };
});
await b.close(); srv.kill();

const f = (x, n = 4) => (x === null || x === undefined ? 'n/a' : Number(x).toFixed(n));
console.log('\nTODO 90 finding 5 — where the lock beak can stand\n');
console.log(`pivot -> wheel ${f(out.D)}   castellation ring r ${f(out.ringR[0])}..${f(out.ringR[1])}   read wall ${f(out.readR)}`);
console.log(`lever travel (measured off the build) ${f(out.LIFT, 5)} rad   riser r ${f(out.riserR)}`);
if (out.linkSpan) console.log(`the OTHER rider (link beak) spans r ${f(out.linkSpan[0])}..${f(out.linkSpan[1])} from the wheel axis`);
console.log('\n  φ°   beak    riser   radial   chamfer |  riser corridor            nose corridor');
console.log('       reach   reach   gain     needed  |');
for (const r of out.rows)
  console.log(`  ${String(r.deg).padStart(6)}  ${f(r.reach, 3).padStart(6)}  ${f(r.riserReach, 3).padStart(6)}  `
    + `${f(r.gain).padStart(6)}   ${f(r.cham).padStart(6)}  | ${f(r.riserClear).padStart(7)} ${String(r.riserWho).slice(0, 24).padEnd(25)} `
    + `${f(r.noseClear).padStart(7)} ${String(r.noseWho).slice(0, 22)}`);

console.log(`\ncontrol  must-hit : the probe parked on the gong finds ${f(out.ctlCentre.best)} (${out.ctlCentre.who})`
  + `  -> ${out.ctlCentre.best <= 0.001 ? 'PASS' : 'FAIL'}`);
console.log(`control  must-miss: the same body 200 away finds ${out.ctlFar.best === Infinity ? 'nothing' : f(out.ctlFar.best)}`
  + `  -> ${out.ctlFar.best === Infinity || out.ctlFar.best > 50 ? 'PASS' : 'FAIL'}`);
console.log(`control  must-hit : φ=0 gain ${f(out.rows[0].gain, 6)} — today's station, which is the defect`
  + `  -> ${out.rows[0].gain < 0.01 ? 'PASS' : 'FAIL'}`);
console.log('\nwho else stands around this wheel (φ in the sweep\'s own frame)');
for (const r of out.riders)
  console.log(`   ${r.name.padEnd(22)} r ${f(r.r, 3).padStart(7)}   φ ${String(r.phiDeg).padStart(7)}°`);
console.log('\n(rows are the product — the losers are printed so the choice can be re-checked)');
