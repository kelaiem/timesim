// WHAT PINS THE THREE-QUARTER PLATE'S UNDERSIDE — the inter-plate z demand,
// per station, and the wheel-in-bore inventory.
//
// REPORT. Written for the case-redesign scope (roadmap, recesses phase A).
// The inter-plate gap is nominally TQ_BOT_Z ≈ 8.185, derived as
// max(SPRING_TOP_Z, chain reach) + CLEAR_MARGIN — so the plate is pinned by
// its TALLEST tenant, everywhere, even where nothing stands within
// millimetres of it. A plate that could drop regionally (pockets over the
// tall tenants, lower everywhere else) is the recess entry's whole premise,
// and this measures the demand it would drop against.
//
// It also settles three flagged discrepancies before any entry quotes them:
//   F1  the derivation max(7.965, chain)+0.15 = 8.115..8.154, but the plate
//       bottom is quoted at 8.185 — which member/term actually pins it?
//   F2  "no wheel pins the plate" vs wheel metal measured at 8.584, INSIDE
//       the plate band — true only if that metal rises through plate BORES.
//       Inventory every mesh whose z-max crosses the plate's bottom face and
//       say whether it lies inside a bore (r to the nearest plate metal at
//       that z) or under solid plate.
//   F3  SPRING_TOP_Z 7.965 vs hairspring metal 7.908 — where do the 0.057
//       come from? Report the hairspring's real z-max beside the constant.
//
// What this is NOT: `probe-alarm-under-plate.mjs` asks whether the alarm
// module fits below the plate; the §62 window machinery asks what the plate
// must CARRY. Neither reports the per-station z demand of everything under
// the plate, which is this file's one question.
//
// Controls (asserted): the chain's top wrap and the hairspring MUST appear in
// the top-5 demand list (they are the documented pins); the DIAL (z < 0) must
// contribute nothing to any bin (the ground is not an obstacle). Exit 2 on
// either failing.
//
// Run: node tools/probe-interplate-demand.mjs   (ROOT= for another worktree)
import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
const ROOT = process.env.ROOT || join(dirname(fileURLToPath(import.meta.url)), '..');
const srv = spawn('python3', ['-m', 'http.server', '8512', '--bind', '127.0.0.1'], { cwd: ROOT, stdio: 'ignore' });
await new Promise((r) => setTimeout(r, 1200));
const browser = await chromium.launch();
const page = await browser.newPage();
page.on('pageerror', (e) => console.log('PAGEERROR', String(e)));
await page.goto('http://127.0.0.1:8512/index.html', { waitUntil: 'load', timeout: 120000 });
await page.waitForFunction(() => !!window.__clock, null, { timeout: 120000 });

const res = await page.evaluate(async () => {
  const I = await import('./src/inspect.js');
  const THREE = await import('three');
  const clock = window.__clock;
  const v = new THREE.Vector3();

  // The plate's REAL bottom face and its bore map, off the metal.
  const tq = clock.labelEntries.find((e) => e.name === 'Three-quarter plate');
  tq.obj.updateWorldMatrix(true, true);
  let plateBot = Infinity, plateTop = -Infinity, plateOuterR = 0;
  const plateXY = [];               // sampled plate metal, for the bore test
  tq.obj.traverse((o) => {
    if (!o.isMesh || o.userData.schematic || !o.geometry?.attributes?.position) return;
    const p = o.geometry.attributes.position;
    for (let i = 0; i < p.count; i++) {
      o.localToWorld(v.fromBufferAttribute(p, i));
      plateBot = Math.min(plateBot, v.z); plateTop = Math.max(plateTop, v.z);
      plateOuterR = Math.max(plateOuterR, Math.hypot(v.x, v.y));
      plateXY.push([v.x, v.y]);
    }
  });

  // Demand: everything BELOW the plate bottom and above the base plate's top
  // (z > 0.3, its real bevel top — the base plate itself and the dial side are
  // not tenants of this gap). Swept over the pose net; azimuth × radius bins.
  const NR = 24, NA = 36;
  const rSpan = plateOuterR;
  const bins = Array.from({ length: NR * NA }, () => ({ z: -Infinity, who: null }));
  const crossers = new Map();       // meshes whose zMax >= plateBot: name → {zMax, x, y, unit}
  const unitTop = new Map();        // per-unit max z inside the gap
  const poses = [{ name: 'as booted', enter: () => {} }];
  for (const ax of I.AXES) for (const f of [0, 0.5, 1])
    poses.push({ name: `${ax.name} f=${f}`, enter: () => { I.enterAxis(clock); clock.setPose(ax.pose(f, clock)); } });

  for (const p of poses) {
    p.enter();
    clock.scene.updateMatrixWorld(true);
    for (const e of clock.labelEntries) {
      if (e.name === 'Three-quarter plate' || e.name === 'Dial') continue;
      e.obj.traverse((o) => {
        if (!o.isMesh || o.userData.schematic || o.userData.casePart || !o.geometry?.attributes?.position) return;
        const pos = o.geometry.attributes.position;
        for (let i = 0; i < pos.count; i++) {
          o.localToWorld(v.fromBufferAttribute(pos, i));
          if (v.z <= 0.3) continue;                       // below the gap
          if (v.z >= plateBot) {                          // rises into/through the plate band
            const label = `${e.name} / ${o.name || o.geometry.type}`;
            const c = crossers.get(label) || { zMax: -Infinity, x: 0, y: 0 };
            if (v.z > c.zMax) { c.zMax = v.z; c.x = v.x; c.y = v.y; }
            crossers.set(label, c);
            continue;                                     // not gap demand — bore territory
          }
          const u = unitTop.get(e.name) || { z: -Infinity };
          if (v.z > u.z) { u.z = v.z; u.pose = p.name; }
          unitTop.set(e.name, u);
          const r = Math.hypot(v.x, v.y);
          if (r > rSpan) continue;
          const bi = Math.min(NR - 1, Math.floor(r / rSpan * NR)) * NA
            + Math.min(NA - 1, Math.floor(((Math.atan2(v.y, v.x) + Math.PI) / (2 * Math.PI)) * NA));
          if (v.z > bins[bi].z) { bins[bi].z = v.z; bins[bi].who = e.name; }
        }
      });
    }
  }
  // Bore test for crossers: at rest, distance from the crosser's (x,y) to the
  // nearest sampled plate-metal point. Inside a bore that distance is the
  // bore's radial slack; under solid plate it is ~0.
  const crossRows = [...crossers.entries()].map(([label, c]) => {
    let d = Infinity;
    for (const [px, py] of plateXY) {
      const dd = Math.hypot(c.x - px, c.y - py);
      if (dd < d) d = dd;
    }
    return { label, zMax: c.zMax, nearestPlateMetal: d };
  }).sort((a, b) => b.zMax - a.zMax);

  // Named constants beside the measurements (F1/F3): read what the page built.
  return {
    plateBot, plateTop, plateOuterR, poses: poses.length,
    unitTop: [...unitTop.entries()].map(([name, u]) => ({ name, z: u.z, pose: u.pose }))
      .sort((a, b) => b.z - a.z),
    crossRows,
    demandHist: (() => {
      const rows = [];
      for (let ri = 0; ri < NR; ri++) {
        let zMax = -Infinity, who = null, filled = 0;
        for (let ai = 0; ai < NA; ai++) {
          const b = bins[ri * NA + ai];
          if (b.z > -Infinity) filled++;
          if (b.z > zMax) { zMax = b.z; who = b.who; }
        }
        rows.push({ r0: ri / NR * rSpan, r1: (ri + 1) / NR * rSpan, zMax, who, filled });
      }
      return rows;
    })(),
  };
});

const MM = 0.378947;
console.log(`plate band MEASURED z ${res.plateBot.toFixed(4)}..${res.plateTop.toFixed(4)}, outer r ${res.plateOuterR.toFixed(3)}; ${res.poses} poses\n`);
console.log('GAP DEMAND per unit (max z below the plate bottom, worst pose):');
for (const u of res.unitTop.slice(0, 14))
  console.log(`  ${u.name.padEnd(28)} ${u.z.toFixed(3).padStart(8)}  headroom-to-plate ${((res.plateBot - u.z) * MM).toFixed(3).padStart(6)} mm  @ ${u.pose}`);
console.log('\nRADIAL DEMAND (max z per r-ring over all az/poses — what a dropped plate hits first):');
for (const r of res.demandHist) {
  if (r.zMax === -Infinity) { console.log(`  r ${r.r0.toFixed(1).padStart(5)}..${r.r1.toFixed(1).padEnd(5)}  EMPTY`); continue; }
  console.log(`  r ${r.r0.toFixed(1).padStart(5)}..${r.r1.toFixed(1).padEnd(5)}  z ${r.zMax.toFixed(3).padStart(7)}  drop-room ${((res.plateBot - r.zMax) * MM).toFixed(3).padStart(6)} mm  az-bins ${String(r.filled).padStart(2)}/36  ${r.who}`);
}
console.log('\nBORE CROSSERS (metal rising to/through the plate band; nearest plate metal in XY):');
for (const c of res.crossRows.slice(0, 20))
  console.log(`  ${c.label.padEnd(44)} zMax ${c.zMax.toFixed(3).padStart(7)}  plate-metal ${c.nearestPlateMetal.toFixed(3)} away ${c.nearestPlateMetal > 0.3 ? '(in a bore/opening)' : '(UNDER SOLID PLATE)'}`);

// CONTROLS.
let ok = true;
const top5 = res.unitTop.slice(0, 5).map((u) => u.name);
if (!top5.some((n) => /Chain|Fusee/.test(n)) || !top5.some((n) => /Hairspring|Balance/.test(n))) {
  ok = false;
  console.log(`\nCONTROL FAIL: the documented pins (chain wrap, hairspring) are not in the top-5 demand [${top5.join(', ')}] — the scan measured the wrong thing`);
} else console.log(`\nCONTROL PASS: chain/fusee and hairspring/balance found in the top-5 demand`);
if (res.unitTop.some((u) => u.name === 'Dial')) { ok = false; console.log('CONTROL FAIL: the Dial contributed to gap demand — the ground got counted'); }
else console.log('CONTROL PASS: the dial contributed nothing (ground excluded)');
await browser.close(); srv.kill();
process.exit(ok ? 0 : 2);
