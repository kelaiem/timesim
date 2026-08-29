// WHAT OCCUPIES THE CANDIDATE RIM-LEDGE ANNULUS — the redesign's mounting
// band, scanned over the pose net.
//
// REPORT. Written for the case-redesign scope (roadmap): the owner's chosen
// architecture seats the base plate on a narrow LEDGE at the midcase's inner
// wall and clamps it with case screws from the back. The ledge and the clamp
// heads live in the annulus outboard of the plate's rim, in the plate's own
// z-band and just behind it — exactly where the dial-side keyless works and
// the low linkage already swing (the shipped seat is INTERRUPTED for them,
// TODO 91/§3). This measures what stands in that annulus, per azimuth, over
// the pose net, so the entry can say where ledge lands and screw stations
// can exist at all.
//
// What this is NOT: `probe-case-relief.mjs` judges the SHIPPED band bodies
// against the movement (an acceptance about metal that exists);
// `probe-91-relief.mjs` reports the shipped seat band's occupants. This one
// scans a CANDIDATE annulus — [plate real reach .. plate reach + 3 mm] over
// z [plate front face − 2 mm .. plate back face + 2 mm] — metal that exists
// nowhere yet, so nothing gates it; it is a survey for a design.
//
// Controls: the keyless works MUST appear (the winding stem crosses the
// annulus radially at az ≈145°) and so must the alarm switch (its stem and
// pusher cross near az 0°) — both are cylinders whose vertices sit on end
// caps OUTSIDE the annulus, so finding them at all is the edge walk working;
// a vertex scan reports the annulus empty. The dial feet are deliberately
// NOT a control: they stand at r 41.6..42.8, INBOARD of the plate's real rim
// (43.2664), so they never enter this annulus — the first cut of this probe
// used them as a must-hit and the control failed against a correct scan,
// the skill's own "pick a pair that genuinely overlaps" trap. That inboard
// fact is itself a finding: a rim ledge outboard of the plate dodges the
// feet entirely, where the shipped seat (r 40.28+) had to be interrupted
// around theirs.
//
// Run: node tools/probe-ledge-occupancy.mjs   (ROOT= for another worktree)
import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
const ROOT = process.env.ROOT || join(dirname(fileURLToPath(import.meta.url)), '..');
const srv = spawn('python3', ['-m', 'http.server', '8514', '--bind', '127.0.0.1'], { cwd: ROOT, stdio: 'ignore' });
await new Promise((r) => setTimeout(r, 1200));
const browser = await chromium.launch();
const page = await browser.newPage();
page.on('pageerror', (e) => console.log('PAGEERROR', String(e)));
await page.goto('http://127.0.0.1:8514/index.html', { waitUntil: 'load', timeout: 120000 });
await page.waitForFunction(() => !!window.__clock, null, { timeout: 120000 });

const res = await page.evaluate(async () => {
  const I = await import('./src/inspect.js');
  const THREE = await import('three');
  const clock = window.__clock;
  const v = new THREE.Vector3(), a = new THREE.Vector3(), b = new THREE.Vector3();
  const MMu = 1 / 0.378947;

  // The base plate's REAL rim (the §3 lesson: metal, not the drawing).
  const bp = clock.labelEntries.find((e) => e.name === 'plate' || e.name === 'Plate')
    || { obj: null };
  let plate = null; clock.scene.traverse((o) => { if (o.name === 'backPlate' && !plate) plate = o; });
  plate.updateWorldMatrix(true, true);
  let reach = 0, zFront = Infinity, zBack = -Infinity;
  {
    const p = plate.geometry.attributes.position;
    for (let i = 0; i < p.count; i++) {
      plate.localToWorld(v.fromBufferAttribute(p, i));
      reach = Math.max(reach, Math.hypot(v.x, v.y));
      zFront = Math.min(zFront, v.z); zBack = Math.max(zBack, v.z);
    }
  }
  // Candidate annulus: r ∈ [reach, reach + 3 mm], z ∈ [zFront − 2 mm, zBack + 2 mm].
  const r0 = reach, r1 = reach + 3 * MMu, z0 = zFront - 2 * MMu, z1 = zBack + 2 * MMu;

  const NA = 72;                    // 5° azimuth bins
  const hit = Array.from({ length: NA }, () => new Map());   // az-bin → name → {rMin,rMax,zMin,zMax,n}
  const poses = [{ name: 'as booted', enter: () => {} }];
  for (const ax of I.AXES) for (const f of [0, 0.5, 1])
    poses.push({ name: `${ax.name} f=${f}`, enter: () => { I.enterAxis(clock); clock.setPose(ax.pose(f, clock)); } });

  const take = (q, name) => {
    if (q.z < z0 || q.z > z1) return;
    const r = Math.hypot(q.x, q.y);
    if (r < r0 || r > r1) return;
    const ai = Math.min(NA - 1, Math.floor(((Math.atan2(q.y, q.x) + Math.PI) / (2 * Math.PI)) * NA));
    const m = hit[ai];
    const rec = m.get(name) || { rMin: Infinity, rMax: -Infinity, zMin: Infinity, zMax: -Infinity, n: 0 };
    rec.rMin = Math.min(rec.rMin, r); rec.rMax = Math.max(rec.rMax, r);
    rec.zMin = Math.min(rec.zMin, q.z); rec.zMax = Math.max(rec.zMax, q.z);
    rec.n++;
    m.set(name, rec);
  };

  for (const p of poses) {
    p.enter();
    clock.scene.updateMatrixWorld(true);
    for (const e of clock.labelEntries) {
      e.obj.traverse((o) => {
        if (!o.isMesh || o.userData.schematic || o.userData.casePart || o === plate || !o.geometry?.attributes?.position) return;
        // EDGES, not vertices — CASE_SECTORS' own lesson: the dial feet cross
        // this z-band carrying no vertex inside it.
        const pos = o.geometry.attributes.position, idx = o.geometry.index;
        const n = idx ? idx.count : pos.count;
        for (let t = 0; t < n; t += 3) {
          for (let ei = 0; ei < 3; ei++) {
            const i0 = idx ? idx.getX(t + ei) : t + ei;
            const i1 = idx ? idx.getX(t + (ei + 1) % 3) : t + (ei + 1) % 3;
            a.fromBufferAttribute(pos, i0); o.localToWorld(a);
            b.fromBufferAttribute(pos, i1); o.localToWorld(b);
            take(a, e.name);
            // crossing points at the z faces, and the mid of in-band spans
            for (const zc of [z0, z1]) {
              const d = b.z - a.z;
              if (Math.abs(d) < 1e-12) continue;
              const s = (zc - a.z) / d;
              if (s <= 0 || s >= 1) continue;
              take(v.copy(a).lerp(b, s), e.name);
            }
            if (a.z >= z0 && a.z <= z1 && b.z >= z0 && b.z <= z1) take(v.copy(a).lerp(b, 0.5), e.name);
          }
        }
      });
    }
  }
  // Collapse: per unit, the az arcs it occupies.
  const units = new Map();
  for (let ai = 0; ai < NA; ai++) for (const [name, rec] of hit[ai]) {
    const u = units.get(name) || { bins: [], rMin: Infinity, rMax: -Infinity, zMin: Infinity, zMax: -Infinity };
    u.bins.push(ai);
    u.rMin = Math.min(u.rMin, rec.rMin); u.rMax = Math.max(u.rMax, rec.rMax);
    u.zMin = Math.min(u.zMin, rec.zMin); u.zMax = Math.max(u.zMax, rec.zMax);
    units.set(name, u);
  }
  const freeBins = [];
  for (let ai = 0; ai < NA; ai++) if (hit[ai].size === 0) freeBins.push(ai);
  return {
    reach, zFront, zBack, r0, r1, z0, z1, NA, poses: poses.length,
    units: [...units.entries()].map(([name, u]) => ({
      name, arcs: u.bins.length, rMin: u.rMin, rMax: u.rMax, zMin: u.zMin, zMax: u.zMax,
      azDeg: u.bins.map((x) => Math.round((x + 0.5) / NA * 360 - 180)),
    })).sort((x, y) => y.arcs - x.arcs),
    freeBins: freeBins.map((x) => Math.round((x + 0.5) / NA * 360 - 180)),
  };
});

const MM = 0.378947;
console.log(`base plate REAL rim r ${res.reach.toFixed(4)}, z ${res.zFront.toFixed(3)}..${res.zBack.toFixed(3)}`);
console.log(`candidate ledge annulus r ${res.r0.toFixed(2)}..${res.r1.toFixed(2)} (+3 mm), z ${res.z0.toFixed(2)}..${res.z1.toFixed(2)} (±2 mm), ${res.NA} az bins × ${res.poses} poses\n`);
console.log('OCCUPANTS of the candidate annulus (unit, bins of 5°, extents):');
for (const u of res.units)
  console.log(`  ${u.name.padEnd(24)} ${String(u.arcs).padStart(2)} bins (${(u.arcs * 5)}°)  r ${u.rMin.toFixed(2)}..${u.rMax.toFixed(2)}  z ${u.zMin.toFixed(2)}..${u.zMax.toFixed(2)}  az° ${u.azDeg.slice(0, 12).join(',')}${u.azDeg.length > 12 ? '…' : ''}`);
console.log(`\nFREE azimuth: ${res.freeBins.length}/${res.NA} bins (${(res.freeBins.length * 5)}° of ${360}°) — candidate screw/land stations`);
console.log(`free az° (bin centres): ${res.freeBins.join(', ')}`);

let ok = true;
if (!res.units.some((u) => u.name === 'Keyless works')) { ok = false; console.log('\nCONTROL FAIL: the keyless works do not appear — the scan missed the annulus the shipped seat is interrupted FOR'); }
else console.log('\nCONTROL PASS: keyless works found in the annulus');
if (!res.units.some((u) => u.name === 'Alarm switch')) { ok = false; console.log('CONTROL FAIL: the alarm switch (stem/pusher crossers near az 0°) did not appear — the edge walk is not finding radial cylinders'); }
else console.log('CONTROL PASS: alarm switch found in the annulus (edge walk sees radial crossers)');
await browser.close(); srv.kill();
process.exit(ok ? 0 : 2);
