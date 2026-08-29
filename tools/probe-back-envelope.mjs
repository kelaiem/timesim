// WHAT STANDS ABOVE THE THREE-QUARTER PLATE — the back envelope, per member
// and per station, SWEPT over the pose net.
//
// REPORT. Written for the case-redesign scope (roadmap): the caseback's glass
// wants to hug the movement, and the number it hugs is not a constant — it is
// whatever the tallest metal is, wherever it is, at its worst POSE (the alarm
// hammer swings; the link lever rocks). A rest-pose survey already lied once
// at scale: three records name the alarm barrel as the back-most metal, and
// §112 moved it under the plate (TODO 114).
//
// What this is NOT: `probe-104.mjs` surveys the striking corner's XY
// footprint at rest for a siting decision; `probe-alarm-under-plate.mjs` asks
// whether the module fits BELOW the plate. Neither sweeps poses nor reports
// the z-envelope the caseback must clear, which is this file's one question.
//
// Three products:
//   1. per-UNIT z-max over the whole net, with the pose that set it — the
//      caseback's floor, and E7's (strike-tier sinking) price list;
//   2. a radial histogram of the envelope (max z per r-bin over all poses) —
//      what a stepped or domed glass could hug at each radius;
//   3. the daylight ledger over the three-quarter plate: envelope minus
//      plate-top, per r-bin.
//
// Controls (both directions, asserted): the alarm link tower MUST appear
// above the plate (rest measurement 13.877); the alarm barrel MUST NOT
// (§112 put it at ≈5.4). A run failing either exits 2 — the scan measured
// the wrong thing.
//
// Run: node tools/probe-back-envelope.mjs   (ROOT= for another worktree)
import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
const ROOT = process.env.ROOT || join(dirname(fileURLToPath(import.meta.url)), '..');
const srv = spawn('python3', ['-m', 'http.server', '8511', '--bind', '127.0.0.1'], { cwd: ROOT, stdio: 'ignore' });
await new Promise((r) => setTimeout(r, 1200));
const browser = await chromium.launch();
const page = await browser.newPage();
page.on('pageerror', (e) => console.log('PAGEERROR', String(e)));
await page.goto('http://127.0.0.1:8511/index.html', { waitUntil: 'load', timeout: 120000 });
await page.waitForFunction(() => !!window.__clock, null, { timeout: 120000 });

const res = await page.evaluate(async () => {
  const I = await import('./src/inspect.js');
  const THREE = await import('three');
  const clock = window.__clock;
  // The plate's own top face, read off its metal rather than restated: the
  // three-quarter plate mesh's max z. (TQ_TOP_Z is a nominal; the §182-era
  // rule is to measure the face you budget against.)
  const tq = clock.labelEntries.find((e) => e.name === 'Three-quarter plate');
  let plateTop = -Infinity, plateR = 0;
  {
    const v = new THREE.Vector3();
    tq.obj.updateWorldMatrix(true, true);
    tq.obj.traverse((o) => {
      if (!o.isMesh || o.userData.schematic || !o.geometry?.attributes?.position) return;
      const p = o.geometry.attributes.position;
      for (let i = 0; i < p.count; i++) {
        o.localToWorld(v.fromBufferAttribute(p, i));
        plateTop = Math.max(plateTop, v.z);
        plateR = Math.max(plateR, Math.hypot(v.x, v.y));
      }
    });
  }
  const NBIN = 60;                 // r-bins across [0, plateR·1.15]
  const rSpan = plateR * 1.15;
  const bins = new Array(NBIN).fill(-Infinity);
  const binOwner = new Array(NBIN).fill(null);
  const units = new Map();         // name → { zMax, pose }
  const poses = [{ name: 'as booted', enter: () => {} }];
  for (const ax of I.AXES) for (const f of [0, 0.5, 1])
    poses.push({ name: `${ax.name} f=${f}`, enter: () => { I.enterAxis(clock); clock.setPose(ax.pose(f, clock)); } });

  const v = new THREE.Vector3();
  for (const p of poses) {
    p.enter();
    clock.scene.updateMatrixWorld(true);
    for (const e of clock.labelEntries) {
      if (e.name === 'Three-quarter plate') continue;   // the datum, not a tenant
      e.obj.traverse((o) => {
        if (!o.isMesh || o.userData.schematic || o.userData.casePart || !o.geometry?.attributes?.position) return;
        const pos = o.geometry.attributes.position;
        for (let i = 0; i < pos.count; i++) {
          o.localToWorld(v.fromBufferAttribute(pos, i));
          if (v.z <= plateTop) continue;                // only what stands ABOVE the plate top
          const u = units.get(e.name) || { zMax: -Infinity, pose: '' };
          if (v.z > u.zMax) { u.zMax = v.z; u.pose = p.name; }
          units.set(e.name, u);
          const b = Math.min(NBIN - 1, Math.floor(Math.hypot(v.x, v.y) / rSpan * NBIN));
          if (v.z > bins[b]) { bins[b] = v.z; binOwner[b] = e.name; }
        }
      });
    }
  }
  return {
    plateTop, plateR, rSpan, poses: poses.length,
    units: [...units.entries()].map(([name, u]) => ({ name, zMax: u.zMax, pose: u.pose }))
      .sort((a, b) => b.zMax - a.zMax),
    bins: bins.map((z, i) => ({ r0: i / NBIN * rSpan, r1: (i + 1) / NBIN * rSpan, zMax: z, owner: binOwner[i] })),
  };
});

const MM = 0.378947;
console.log(`plate top MEASURED z ${res.plateTop.toFixed(4)} (r ${res.plateR.toFixed(3)}), ${res.poses} poses swept\n`);
console.log('UNIT z-max ABOVE the plate top (u / mm proud), worst pose:');
for (const u of res.units.slice(0, 20))
  console.log(`  ${u.name.padEnd(28)} ${u.zMax.toFixed(3).padStart(8)}  +${((u.zMax - res.plateTop) * MM).toFixed(2)} mm  @ ${u.pose}`);
console.log('\nRADIAL ENVELOPE (r-bin → max z over all poses, owner):');
for (const b of res.bins) {
  if (b.zMax === -Infinity) continue;
  console.log(`  r ${b.r0.toFixed(1).padStart(5)}..${b.r1.toFixed(1).padEnd(5)}  z ${b.zMax.toFixed(3).padStart(7)}  daylight-over-plate ${((b.zMax - res.plateTop) * MM).toFixed(2).padStart(5)} mm  ${b.owner}`);
}

// CONTROLS — both directions.
const tower = res.units.find((u) => u.name === 'Alarm link');
const barrel = res.units.find((u) => u.name === 'Alarm barrel');
let ok = true;
if (!tower || tower.zMax < 13.0) { ok = false; console.log(`\nCONTROL FAIL: the alarm link tower (rest 13.877) was not found above the plate — the scan measured the wrong thing (got ${tower ? tower.zMax.toFixed(3) : 'nothing'})`); }
else console.log(`\nCONTROL PASS: alarm link tower found at ${tower.zMax.toFixed(3)}`);
if (barrel) { ok = false; console.log(`CONTROL FAIL: the alarm barrel appears ABOVE the plate at ${barrel.zMax.toFixed(3)} — §112 put it below; the scan or the tree is wrong`); }
else console.log('CONTROL PASS: the alarm barrel is not above the plate (§112 holds)');
await browser.close(); srv.kill();
process.exit(ok ? 0 : 2);
