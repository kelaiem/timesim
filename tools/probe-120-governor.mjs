// §120 — the governor's bearings, read off a real boot.
//
// Three questions, in the order TODO 45's finding three asks them:
//   1. Is the bearing LOCATED now? Measure the post's turned steps against
//      the arbor that runs between them — foot collar, bearing length, head
//      — and report the endshake as a gap, not as an intention.
//   2. What does a STONE cost here? The bore is 0.400 u and the post 0.35;
//      a hole jewel's own wall is what decides whether one fits, and on the
//      governor arbor the answer is settled by the PINION it turns inside.
//   3. What is the DUTY? Wear is rate × time, and the governor's rate is the
//      movement's highest while its time is ~12 s a day.
import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
const port = process.env.PORT || '8474';
const root = process.env.ROOT || '..';
const srv = spawn('python3', ['-m', 'http.server', port, '--bind', '127.0.0.1'], { cwd: root, stdio: 'ignore' });
await new Promise((r) => setTimeout(r, 900));
const browser = await chromium.launch();
const page = await browser.newPage();
const warns = [];
page.on('console', (m) => { if (m.type() === 'warning' || m.type() === 'error') warns.push(m.text()); });
page.on('pageerror', (e) => console.log('PAGEERROR', String(e)));
await page.goto(`http://127.0.0.1:${port}/index.html`, { waitUntil: 'load', timeout: 90000 });
await page.waitForFunction(() => !!window.__clock, null, { timeout: 90000 });

const out = await page.evaluate(async () => {
  const clock = window.__clock;
  const THREE = await import('./vendor/three.module.js');
  const byName = {};
  clock.scene.traverse((o) => {
    if (!o.isMesh || o.userData?.schematic || !o.geometry?.attributes?.position) return;
    (byName[o.name] ??= []).push(o);
  });
  // A mesh's z band and its radial reach about a named axis, in world.
  const band = (name) => {
    const ms = byName[name] || [];
    if (!ms.length) return null;
    let zmin = Infinity, zmax = -Infinity;
    for (const m of ms) {
      m.updateWorldMatrix(true, false);
      m.geometry.computeBoundingBox();
      const b = m.geometry.boundingBox.clone().applyMatrix4(m.matrixWorld);
      zmin = Math.min(zmin, b.min.z); zmax = Math.max(zmax, b.max.z);
    }
    return { n: ms.length, zmin: +zmin.toFixed(4), zmax: +zmax.toFixed(4) };
  };
  // The post's turned profile, read straight off its vertices: the distinct
  // radii present, and the z at which each one starts and stops.
  const profile = (name) => {
    const m = (byName[name] || [])[0];
    if (!m) return null;
    m.updateWorldMatrix(true, false);
    const pos = m.geometry.attributes.position;
    const v = new THREE.Vector3();
    const ax = m.getWorldPosition(new THREE.Vector3());
    const steps = new Map();
    for (let i = 0; i < pos.count; i++) {
      v.fromBufferAttribute(pos, i).applyMatrix4(m.matrixWorld);
      const r = Math.hypot(v.x - ax.x, v.y - ax.y);
      const k = r.toFixed(3);
      const s = steps.get(k) || { r: +k, zmin: Infinity, zmax: -Infinity, n: 0 };
      s.zmin = Math.min(s.zmin, v.z); s.zmax = Math.max(s.zmax, v.z); s.n++;
      steps.set(k, s);
    }
    return [...steps.values()].sort((a, b) => a.r - b.r)
      .map((s) => ({ r: s.r, z: [+s.zmin.toFixed(4), +s.zmax.toFixed(4)], n: s.n }));
  };
  // Closest approach between two named meshes, over their vertices (cheap and
  // conservative: a vertex-to-vertex floor, reported as such).
  const nearest = (a, b) => {
    const A = byName[a] || [], B = byName[b] || [];
    if (!A.length || !B.length) return null;
    const pa = [], pb = [], v = new THREE.Vector3();
    for (const [src, dst] of [[A, pa], [B, pb]]) {
      for (const m of src) {
        m.updateWorldMatrix(true, false);
        const pos = m.geometry.attributes.position;
        const step = Math.max(1, Math.floor(pos.count / 3000));
        for (let i = 0; i < pos.count; i += step) dst.push(v.fromBufferAttribute(pos, i).applyMatrix4(m.matrixWorld).clone());
      }
    }
    let best = Infinity;
    for (const p of pa) for (const q of pb) best = Math.min(best, p.distanceTo(q));
    return +best.toFixed(4);
  };
  return {
    bands: Object.fromEntries(['alarmGovStud', 'alarmGovArbor', 'alarmGovSaw', 'alarmGovPinion',
      'alarmGovAnchorStud', 'alarmGovAnchorArbor', 'alarmGovRing', 'alarmGovAnchor', 'alarmGovWheel',
    ].map((n) => [n, band(n)])),
    posts: { alarmGovStud: profile('alarmGovStud'), alarmGovAnchorStud: profile('alarmGovAnchorStud') },
    near: {
      'ring ⇄ gov post': nearest('alarmGovRing', 'alarmGovStud'),
      'ring arm ⇄ gov post': nearest('alarmGovRingArm', 'alarmGovStud'),
      '64T wheel ⇄ gov post': nearest('alarmGovWheel', 'alarmGovStud'),
      'pinion ⇄ gov post': nearest('alarmGovPinion', 'alarmGovStud'),
      'saw ⇄ anchor post': nearest('alarmGovSaw', 'alarmGovAnchorStud'),
      'anchor hub ⇄ anchor post': nearest('alarmGovAnchor', 'alarmGovAnchorStud'),
    },
    // WHAT A STONE WOULD COST, measured on the metal rather than argued.
    // The governor arbor turns INSIDE its own 8-leaf pinion, so the room a
    // hole jewel's wall would need is bounded by that pinion's root circle:
    // the smallest tooth-outline radius, taken past the bore.
    pinionRoot: (() => {
      const m = (byName['alarmGovPinion'] || [])[0];
      if (!m) return null;
      m.updateWorldMatrix(true, false);
      const ax = m.getWorldPosition(new THREE.Vector3());
      const pos = m.geometry.attributes.position, v = new THREE.Vector3();
      let bore = Infinity, root = Infinity;
      for (let i = 0; i < pos.count; i++) {
        v.fromBufferAttribute(pos, i).applyMatrix4(m.matrixWorld);
        const r = Math.hypot(v.x - ax.x, v.y - ax.y);
        bore = Math.min(bore, r);
        if (r > 0.5) root = Math.min(root, r);
      }
      return { bore: +bore.toFixed(4), root: +root.toFixed(4) };
    })(),
    // z reach of each governor unit, for the under-plate band's headroom
    units: Object.fromEntries(['Alarm governor', 'Alarm governor anchor'].map((n) => {
      const u = clock.labelEntries.find((e) => e.name === n);
      if (!u) return [n, null];
      const b = new THREE.Box3().setFromObject(u.obj);
      return [n, [+b.min.z.toFixed(3), +b.max.z.toFixed(3)]];
    })),
  };
});

console.log('=== boot warnings ===');
const real = warns.filter((w) => !/GL Driver|GroupMarkerNotSet|Failed to load resource|SwiftShader|swiftshader/.test(w));
console.log(real.length ? real.map((w) => '  ' + w).join('\n') : '  (silent)');

console.log('\n=== the turned posts (radii present, and the z each spans) ===');
for (const [name, steps] of Object.entries(out.posts)) {
  console.log(`\n  ${name}`);
  for (const s of steps || []) console.log(`    r ${s.r.toFixed(3)}   z ${s.z[0].toFixed(4)} … ${s.z[1].toFixed(4)}   (${s.n} verts)`);
}

console.log('\n=== z bands ===');
for (const [n, b] of Object.entries(out.bands)) console.log(`  ${n.padEnd(22)} ${b ? `${b.zmin} … ${b.zmax}  (${b.n} mesh)` : '(absent)'}`);

console.log('\n=== nearest approaches (vertex floor) ===');
for (const [k, v] of Object.entries(out.near)) console.log(`  ${k.padEnd(26)} ${v}`);

console.log('\n=== unit z reach ===');
for (const [k, v] of Object.entries(out.units)) console.log(`  ${k.padEnd(24)} ${v ? v.join(' … ') : '—'}`);

console.log('\n=== what a stone would cost on the governor arbor ===');
if (out.pinionRoot) {
  const UNIT_MM = 0.379;
  const bore = 0.4, wall = 0.185;              // ALARM_GOV_ARBOR_BORE, PIVOT_MIN_U
  console.log(`  pinion: bore ${out.pinionRoot.bore}, ROOT circle ${out.pinionRoot.root}`);
  console.log(`  arbor as built: ${(bore + wall).toFixed(3)} — ${(out.pinionRoot.root - bore - wall).toFixed(3)} of pinion body outside it`);
  for (const rubyMM of [0.25, 0.35, 0.45]) {   // real hole-jewel wall, thin end to thick
    const r = bore + rubyMM / UNIT_MM + wall;
    console.log(`  with a ${rubyMM.toFixed(2)} mm ruby wall: arbor ${r.toFixed(3)} — `
      + `${r > out.pinionRoot.root ? `PAST the root circle by ${(r - out.pinionRoot.root).toFixed(3)}` : 'inside the root circle'}`);
  }
}

console.log('\n=== the DUTY, both governor bearings against their jewelled counterparts ===');
{
  const F_BAL = 2.5, strikes = 28, teethPerStrike = 80, sawTeeth = 40;
  const sawRev = strikes * teethPerStrike / sawTeeth;      // saw revolutions per ring
  const anchorRev = strikes * teethPerStrike;              // anchor reversals per ring (one per tooth)
  const balRev = 2 * F_BAL * 86400;                        // balance-staff reversals per day
  const escRev = 86400 / 6;                                // escape wheel revolutions per day (1 rev / 6 s)
  console.log(`  governor saw     ${sawRev} rev per ring   vs escape wheel  ${escRev} rev/day   = ×${(escRev / sawRev).toFixed(0)}`);
  console.log(`  governor anchor  ${anchorRev} reversals per ring vs balance staff ${balRev} reversals/day = ×${(balRev / anchorRev).toFixed(0)}`);
  console.log(`  the ring itself runs ${strikes} strikes — the whole duty is ${(strikes * 0.42).toFixed(1)} s a day`);
}

await browser.close();
srv.kill();
