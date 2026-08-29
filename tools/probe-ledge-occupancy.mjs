// WHAT OCCUPIES THE RIM-LEDGE ANNULUS — §186's mounting band, scanned over
// the pose net.
//
// REPORT by default, ACCEPTANCE with --accept. Written as the survey that
// scoped §186 (the rim-mounted movement: the base plate's rim drops into the
// back band's bore, rests on a ledge, and three clamp screws hold it), and
// kept as the instrument that says what stands in the annulus OUTBOARD of
// the plate's measured rim — since §186 that is the space the case's own
// mount occupies, and the correct answer is "the three stem crossers and
// nothing else": the two crown stems and the alarm pusher's head, each in
// its own few degrees of azimuth (the stems get rim notches and case bores;
// the pusher passes above the rim in z). --accept gates exactly that: any
// OTHER unit in the annulus, or an allowed one spreading past a stem
// corridor's width, exits non-zero — a new part swinging into the mount's
// space, which every clean unit-pair sweep can only report per unit pair,
// fails here with the annulus named.
//
// What this is NOT: `probe-case-relief.mjs` judges the SHIPPED band bodies
// against the movement over the same net (that one rides the battery
// workflow, TODO 111). This one asks about the ANNULUS as a region —
// [plate real reach .. reach + 3 mm] over z [plate front − 2 mm .. plate
// back + 2 mm], derived from the measured plate, so it follows the rim
// wherever the derivation puts it.
//
// Controls: the keyless works MUST appear (the winding stem crosses the
// annulus radially at az ≈145°) and so must the alarm switch (its stem and
// pusher cross near az 0°) — both are cylinders whose vertices sit on end
// caps OUTSIDE the annulus, so finding them at all is the edge walk working;
// a vertex scan reports the annulus empty. AND THE CONTROLS WERE NOT ENOUGH
// (§186 commit 0): both control members happened to put an edge MIDPOINT
// inside the annulus, while the alarm crown's stem — the same radial-
// cylinder shape — put its endpoints AND its midpoint outside and was
// invisible to the first cut, which sampled only endpoints, z-face
// crossings and in-band midpoints. The scan now also solves each edge's
// exact crossings of both r walls (quadratic per wall), which is the sample
// kind a radial member actually needs; the survey numbers from before this
// fix under-counted the annulus by exactly that class. The dial feet are deliberately
// NOT a control: they stand at r 41.6..42.8, INBOARD of the plate's real rim
// (43.2664), so they never enter this annulus — the first cut of this probe
// used them as a must-hit and the control failed against a correct scan,
// the skill's own "pick a pair that genuinely overlaps" trap. That inboard
// fact is itself a finding: a rim ledge outboard of the plate dodges the
// feet entirely, where the shipped seat (r 40.28+) had to be interrupted
// around theirs.
//
// Run: node tools/probe-ledge-occupancy.mjs   (ROOT= for another worktree)
//   --accept              gate the survey band's §186 expectation (see above)
//                         instead of only reporting; controls still apply.
//   Band overrides (§186 commit 0 — the design's three tight bands are
//   measured with the same scan rather than a second one):
//     --r0 --r1 --z0 --z1   absolute UNITS; any subset; the rest keep the
//                           survey defaults (r from the plate's measured
//                           reach, z from its faces ±2 mm). An override
//                           skips the controls AND --accept: a design band's
//                           expectation is the caller's.
import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
const ROOT = process.env.ROOT || join(dirname(fileURLToPath(import.meta.url)), '..');
const argVal = (k) => {
  const i = process.argv.indexOf(k);
  return i >= 0 && process.argv[i + 1] !== undefined ? Number(process.argv[i + 1]) : null;
};
const BAND = { r0: argVal('--r0'), r1: argVal('--r1'), z0: argVal('--z0'), z1: argVal('--z1') };
const ACCEPT = process.argv.includes('--accept');
const srv = spawn('python3', ['-m', 'http.server', '8514', '--bind', '127.0.0.1'], { cwd: ROOT, stdio: 'ignore' });
await new Promise((r) => setTimeout(r, 1200));
const browser = await chromium.launch();
const page = await browser.newPage();
page.on('pageerror', (e) => console.log('PAGEERROR', String(e)));
await page.goto('http://127.0.0.1:8514/index.html', { waitUntil: 'load', timeout: 120000 });
await page.waitForFunction(() => !!window.__clock, null, { timeout: 120000 });

const res = await page.evaluate(async (BAND) => {
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
  // Candidate annulus: r ∈ [reach, reach + 3 mm], z ∈ [zFront − 2 mm, zBack + 2 mm]
  // — unless a band override names its own walls (§186 commit 0).
  const r0 = BAND.r0 ?? reach, r1 = BAND.r1 ?? reach + 3 * MMu;
  const z0 = BAND.z0 ?? zFront - 2 * MMu, z1 = BAND.z1 ?? zBack + 2 * MMu;

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
            // ...and the crossing points at the R WALLS, solved exactly. A
            // RADIAL member (the alarm crown's stem) enters and leaves the
            // annulus along one edge: its endpoints sit outside both walls
            // and its midpoint can too, so the samples above see nothing —
            // measured, the alarm stem (r 15.4..54.2 through this band) was
            // invisible to the first cut of this probe while the winding
            // stem was caught only because ITS midpoint happens to land
            // inside. Solve |a + t(b−a)|_xy = rWall (quadratic) per wall and
            // take every in-segment root — with the sample kinds above this
            // covers every way an edge can meet the annulus.
            {
              const dx = b.x - a.x, dy = b.y - a.y;
              const A2 = dx * dx + dy * dy;
              if (A2 > 1e-12) {
                const B2 = 2 * (a.x * dx + a.y * dy);
                for (const rw of [r0, r1]) {
                  const C2 = a.x * a.x + a.y * a.y - rw * rw;
                  const disc = B2 * B2 - 4 * A2 * C2;
                  if (disc <= 0) continue;
                  const sq = Math.sqrt(disc);
                  for (const t of [(-B2 - sq) / (2 * A2), (-B2 + sq) / (2 * A2)]) {
                    if (t <= 0 || t >= 1) continue;
                    // a root sits ON the wall; sample a hair to each side and
                    // let the band filter keep the inside one — no sign
                    // arithmetic about which side is "in"
                    take(v.copy(a).lerp(b, Math.max(0, t - 1e-4)), e.name);
                    take(v.copy(a).lerp(b, Math.min(1, t + 1e-4)), e.name);
                  }
                }
              }
            }
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
}, BAND);

const MM = 0.378947;
console.log(`base plate REAL rim r ${res.reach.toFixed(4)}, z ${res.zFront.toFixed(3)}..${res.zBack.toFixed(3)}`);
console.log(`candidate ledge annulus r ${res.r0.toFixed(2)}..${res.r1.toFixed(2)} (+3 mm), z ${res.z0.toFixed(2)}..${res.z1.toFixed(2)} (±2 mm), ${res.NA} az bins × ${res.poses} poses\n`);
console.log('OCCUPANTS of the candidate annulus (unit, bins of 5°, extents):');
for (const u of res.units)
  console.log(`  ${u.name.padEnd(24)} ${String(u.arcs).padStart(2)} bins (${(u.arcs * 5)}°)  r ${u.rMin.toFixed(2)}..${u.rMax.toFixed(2)}  z ${u.zMin.toFixed(2)}..${u.zMax.toFixed(2)}  az° ${u.azDeg.slice(0, 12).join(',')}${u.azDeg.length > 12 ? '…' : ''}`);
console.log(`\nFREE azimuth: ${res.freeBins.length}/${res.NA} bins (${(res.freeBins.length * 5)}° of ${360}°) — candidate screw/land stations`);
console.log(`free az° (bin centres): ${res.freeBins.join(', ')}`);

let ok = true;
if (Object.values(BAND).some((v) => v !== null)) {
  // An override names a DESIGN band whose expected occupancy the caller
  // knows (often: nothing) — the survey band's must-hit controls do not
  // apply to it, so the run reports and leaves the judgement to the caller.
  console.log('\n(band override: survey controls skipped — judge the occupancy against the design band\'s own expectation)');
} else {
  if (!res.units.some((u) => u.name === 'Keyless works')) { ok = false; console.log('\nCONTROL FAIL: the keyless works do not appear — the scan missed the annulus the shipped seat is interrupted FOR'); }
  else console.log('\nCONTROL PASS: keyless works found in the annulus');
  if (!res.units.some((u) => u.name === 'Alarm switch')) { ok = false; console.log('CONTROL FAIL: the alarm switch (stem/pusher crossers near az 0°) did not appear — the edge walk is not finding radial cylinders'); }
  else console.log('CONTROL PASS: alarm switch found in the annulus (edge walk sees radial crossers)');
  if (ACCEPT) {
    // §186's expectation, gated. The corridor cap is 3 bins (15°): a Ø2 mm
    // sleeve plus margin subtends ~9° at the rim and lands in at most two
    // 5° bins plus one of binning slop — measured, each crosser sits in
    // exactly 2. Azimuths are deliberately NOT pinned here: the notches and
    // bores derive from the same stem angles the metal does, so a moved
    // crown moves its corridor with it and the mount stays right; what
    // cannot be right is a FOURTH occupant, or a crosser smeared wider than
    // a stem's corridor.
    const ALLOWED = new Map([['Alarm crown', 3], ['Keyless works', 3], ['Alarm switch', 3]]);
    let aok = true;
    for (const u of res.units) {
      if (!ALLOWED.has(u.name)) {
        aok = false;
        console.log(`ACCEPT FAIL: ${u.name} stands in the mount's annulus (${u.arcs} bins, az° ${u.azDeg.slice(0, 8).join(',')}) — §186's ledge assumes only the three stem crossers`);
      } else if (u.arcs > ALLOWED.get(u.name)) {
        aok = false;
        console.log(`ACCEPT FAIL: ${u.name} spreads to ${u.arcs} bins — wider than a stem corridor (${ALLOWED.get(u.name)})`);
      }
    }
    if (aok) console.log('ACCEPT PASS: only the three stem crossers, each inside its corridor');
    ok = ok && aok;
  }
}
await browser.close(); srv.kill();
process.exit(ok ? 0 : 2);
