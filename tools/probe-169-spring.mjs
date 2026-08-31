// §169 — THE ACCEPTANCE TEST for both defects this section closes, taken on the
// built tree rather than argued from the source.
//
// 1. THE SPRING'S ANCHOR STANDS ON METAL. §163's blade was anchored on a stud
//    at r 11.378 from the arbor against a driver whose outline reaches 7.550 —
//    4.347 clear of it in 3D, and a raycast straight down its axis hit the
//    driver ZERO times. The measurement here is that raycast, with the pawl's
//    own post (which was always right) as the positive control: both must hit.
// 2. THE PAWL IS NOT FLUSH WITH THE WHEEL. The ratchet skirt used to be
//    extruded at the same STOCK_MIN_U the pawl is cut at, so the pawl's top
//    face was coplanar with the base disc's underside and measured 0.000 over
//    the whole area it sweeps under it. `clearances` is cross-unit and cannot
//    see it; `intraUnit` gates on intersectsGeometry and two solids sharing a
//    plane do not intersect. So it is measured here, over the real press axis
//    at both parities, with meshClearance.
//
// PASSES when the anchor and the post both hit the driver, and when the only
// zero against the wheel is the declared seat (nose ⇄ skirt).
//
// §192 re-formed the spring: the torsion coil and its anchor pin left, an
// in-plane blade clamped to a stud on the driver's THIRD ARM returned — so
// the anchor this measures is `alarmColPawlSpringStud`, standing at r ≈ 11.6
// on metal cut to reach it. The measurement is the same raycast, and it now
// guards the very claim §163's stud falsified.
//
// Run: cd tools && node probe-169-spring.mjs
import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
const srv = spawn('python3', ['-m', 'http.server', '8484', '--bind', '127.0.0.1'], { cwd: '..', stdio: 'ignore' });
await new Promise((r) => setTimeout(r, 900));
const b = await chromium.launch(); const p = await b.newPage();
const boot = [];
p.on('console', (m) => { if (m.type() === 'warning' || m.type() === 'error') boot.push(m.text()); });
p.on('pageerror', (e) => boot.push('PAGEERROR ' + String(e)));
await p.goto('http://127.0.0.1:8484/index.html?hud=0&sync=0', { waitUntil: 'load', timeout: 90000 });
await p.waitForFunction(() => !!window.__clock, null, { timeout: 90000 });
const noise = /WebGL|GroupMarker|404|swiftshader|ReadPixels/i;
const warns = boot.filter((m) => !noise.test(m));

const out = await p.evaluate(async () => {
  const THREE = await import('./vendor/three.module.js');
  const I = await import('./src/inspect.js');
  const clock = window.__clock;
  const find = (n) => { let r = null; clock.scene.traverse((o) => { if (o.name === n) r = o; }); return r; };
  clock.resetInputs(); clock.scene.updateMatrixWorld(true);

  // ---- 1. does it stand on the driver?
  const drv = find('alarmColDriver');
  const ray = new THREE.Raycaster();
  const stands = (name) => {
    const o = find(name); if (!o) return { name, err: 'missing' };
    const w = o.getWorldPosition(new THREE.Vector3());
    const local = drv.worldToLocal(w.clone());
    ray.set(new THREE.Vector3(w.x, w.y, w.z + 5), new THREE.Vector3(0, 0, -1));
    const hits = ray.intersectObject(drv, false).length;          // FrontSide: 1 = the top face
    return { name, r: +Math.hypot(local.x, local.y).toFixed(4), hits };
  };
  let drvMaxR = 0;
  { const pos = drv.geometry.getAttribute('position');
    for (let i = 0; i < pos.count; i++) drvMaxR = Math.max(drvMaxR, Math.hypot(pos.getX(i), pos.getY(i))); }

  // ---- 2. the pawl against the wheel, over the real press axis
  const PAWL = ['alarmColPawl', 'alarmColPawlTail', 'alarmColPawlBoss', 'alarmColPawlNose',
                'alarmColPawlPost', 'alarmColPawlSpring', 'alarmColPawlSpringStud'];
  const WHEEL = ['alarmColBase', 'alarmColCastellations', 'alarmColSkirt'];
  const rows = {};
  const N = 33;
  for (const alarmOn of [0, 1]) for (let i = 0; i < N; i++) {
    const f = i / (N - 1);
    I.enterAxis(clock);
    clock.setPose({ tau: 0.13, crownPullT: 0, leverEngage: 0, tension: 1, windAccumTurns: 0,
                    alarmOn, alarmPressCycle: f * 2 });
    clock.scene.updateMatrixWorld(true);
    for (const an of PAWL) { const a = find(an); if (!a) continue;
      for (const bn of WHEEL) { const bo = find(bn); if (!bo) continue;
        const c = I.meshClearance(a, bo), k = an + ' ⇄ ' + bn;
        if (!rows[k] || c < rows[k].c) rows[k] = { c, alarmOn, cycle: +(f * 2).toFixed(3) }; } }
  }
  clock.resetInputs(); clock.scene.updateMatrixWorld(true);
  const bands = {};
  for (const n of ['alarmColDriver', 'alarmColPawlSpringStud', 'alarmColPawlSpring',
                   'alarmColSkirt', 'alarmColPawl', 'alarmColBase', 'alarmColCastellations']) {
    const o = find(n); if (!o) continue;
    const x = new THREE.Box3().setFromObject(o);
    bands[n] = [+x.min.z.toFixed(4), +x.max.z.toFixed(4)];
  }
  let drive = null;
  clock.scene.traverse((o) => { if (o.userData && o.userData.drive) drive = o.userData.drive; });
  const nan = [];
  clock.scene.traverse((o) => { if (!o.geometry) return;
    const a = o.geometry.getAttribute('position'); if (!a) return;
    for (let i = 0; i < a.array.length; i++) if (!Number.isFinite(a.array[i])) { nan.push(o.name || o.geometry.type); break; } });
  return {
    drvMaxR: +drvMaxR.toFixed(4),
    anchors: [stands('alarmColPawlPost'), stands('alarmColPawlSpringStud')],
    pairs: Object.entries(rows).map(([k, v]) => ({ pair: k, min: +v.c.toFixed(4), alarmOn: v.alarmOn, cycle: v.cycle }))
      .sort((x, y) => x.min - y.min),
    bands, spring: drive && drive.spring, nan,
  };
});

console.log(`\nboot: ${warns.length ? warns.length + ' WARNING(S)' : 'silent'}`);
for (const w of warns) console.log('   ' + w.slice(0, 400));
console.log(`\n1. THE ANCHOR STANDS ON THE DRIVER (outline reaches r ${out.drvMaxR})`);
for (const a of out.anchors)
  console.log(`   ${a.name.padEnd(24)} r ${String(a.r).padStart(8)}   raycast hits ${a.hits}  ${a.hits ? '' : '  ← STANDS ON NOTHING'}`);
console.log('\n2. THE PAWL GROUP AGAINST THE WHEEL, over alarmPressCycle × alarmOn');
for (const r of out.pairs)
  console.log(`   ${String(r.min).padStart(8)}  ${r.pair.padEnd(46)} alarmOn=${r.alarmOn} cycle=${r.cycle}`);
console.log('\n   the z stack:');
for (const [k, v] of Object.entries(out.bands))
  console.log(`   ${k.padEnd(24)} ${v[0].toFixed(4)} .. ${v[1].toFixed(4)}   (${(v[1] - v[0]).toFixed(4)})`);
const s = out.spring;
if (s) {
  // §192 re-formed the spring in-plane: the record is the blade's now.
  console.log('\n3. THE SPRING AS SOLVED');
  console.log(`   blade ${s.bladeT_u.toFixed(5)} × ${s.bladeW_u.toFixed(5)}, free length ${s.freeLen_u.toFixed(4)} against floors  drag ${s.dragFloor_u.toFixed(4)} / strain ${s.strainFloor_u.toFixed(4)}  (${s.governs} governs)`);
  console.log(`   kθ ${s.kTheta_Nm_per_rad.toExponential(4)} N·m/rad · θ ${s.theta_rad.toFixed(4)} rad → nose ${s.noseF_mN.toFixed(3)} mN`);
  console.log(`   drag ${s.dragTq_Nmm.toExponential(3)} N·mm vs sautoir detent ${s.detentTq_Nmm.toExponential(3)} — ${s.headroom.toFixed(2)}× clear`);
  console.log(`   surface strain ${s.strain.toExponential(3)} · anchor stud ${(1 / s.studShare).toFixed(1)}× the blade's rate`);
}
const seat = 'alarmColPawlNose ⇄ alarmColSkirt';
const zeros = out.pairs.filter((r) => r.min <= 1e-4 && r.pair !== seat);
const unsupported = out.anchors.filter((a) => !a.hits);
const ok = !zeros.length && !unsupported.length && !out.nan.length && !warns.length;
if (out.nan.length) console.log('\nNON-FINITE GEOMETRY: ' + out.nan.join(', '));
if (zeros.length) console.log('\nFLUSH/CONTACT pairs that are not the declared seat: ' + zeros.map((z) => z.pair).join(', '));
console.log('\n' + (ok ? 'probe OK' : 'probe FAILED'));
await b.close(); srv.kill();
process.exit(ok ? 0 : 1);
