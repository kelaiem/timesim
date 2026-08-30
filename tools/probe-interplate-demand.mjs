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
// §191 STAGE 1 — the scan became FOOTPRINT- and RIDER-AWARE, because its
// first cut polluted the demand map in both directions and the pollution
// was about to size real metal:
//  · OPEN SKY IS NOT DEMAND. The plate is a THREE-QUARTER plate: the
//    balance, hairspring and cock stand in its cutaway, and the stop
//    lever's crank stands in the cut's open wedge (layout.js: "a SEE-SAW
//    CRANK standing in the plate cut's open wedge") — no plate above any
//    of them. The old r-ring table collapsed azimuth, so the stop lever
//    read as 0.006 mm from an underside that does not exist at its
//    azimuth. The footprint is now measured by RAYCAST from below the
//    plate at every cell of a fine (r × az) grid (the §173 lesson: cast
//    from OUTSIDE the solid), and a vertex is discounted as open-sky only
//    when its whole 3×3 cell neighbourhood is plate-free — bores and
//    small openings cannot fake a sky, so the error runs toward COUNTING
//    demand, never toward silence.
//  · RIDERS ARE NOT TENANTS. The pillars (makePillar({ height: TQ_BOT_Z }),
//    seated ON the underside) and the winding arrest (BRK_BOT = TQ_BOT_Z −
//    BRK_T, boot-asserted flush on the underside) DESCEND WITH the plate,
//    so their z is not a constraint on the drop — it is a consequence of
//    it. They are excluded by a declared roster asserted against the
//    scene (a stale name fails, the stale-selector convention) and
//    reported in their own table; their own clearances (arrest ⇄ chain /
//    fusee floors) are the battery's to re-hold after any drop.
//    NOT on the roster, deliberately: the balance cock and fork cock look
//    like riders and are not — the cock stands on base-plate legs at
//    COCK_MID_Z (from SPRING_TOP_Z), the fork cock is footed on the back
//    plate — they simply live in the open sky the footprint now sees.
//
// Controls (asserted): the chain's top wrap MUST appear in the top-5 of
// the MERGED below-plate population (demand ∪ sky — with the footprint in
// place its wrap classifies under the fusee's §62 window, which is an
// opening, not underside; losing it from both tables means the scan lost
// the tallest documented tenant); the hairspring/balance MUST top the
// OPEN-SKY table (they moved there when the footprint arrived); the DIAL
// (z < 0) must contribute nothing anywhere (the ground is not an
// obstacle); and every rider-roster name must exist in the scene. Exit 2
// on any failing. The stop lever's classification is PRINTED, not gated —
// it is §191's triage question and the answer belongs to the reader.
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

  // §191 — THE PLATE'S FOOTPRINT, measured by raycast. The plate is a
  // fixture, so one scan at boot pose stands for every pose. A fine grid
  // (finer than the demand bins, so bores cannot alias into sky) of cell
  // centres, each asked "is there plate metal above you" by a ray cast
  // from BELOW the whole plate going +z — the §173 lesson (a ray cast
  // from inside a solid measures nothing; this origin is outside by a
  // whole unit) — against the plate's own non-schematic meshes only.
  const NRF = 48, NAF = 96;
  const tqMeshes = [];
  tq.obj.traverse((o) => { if (o.isMesh && !o.userData.schematic && o.geometry?.attributes?.position) tqMeshes.push(o); });
  const rSpan = plateOuterR;
  const plateFree = new Uint8Array(NRF * NAF); // 1 = no plate above this cell centre
  {
    const ray = new THREE.Raycaster();
    const dirUp = new THREE.Vector3(0, 0, 1);
    const org = new THREE.Vector3();
    for (let ri = 0; ri < NRF; ri++) for (let ai = 0; ai < NAF; ai++) {
      const r = (ri + 0.5) / NRF * rSpan;
      const a = (ai + 0.5) / NAF * 2 * Math.PI - Math.PI;
      org.set(r * Math.cos(a), r * Math.sin(a), plateBot - 1);
      ray.set(org, dirUp);
      if (ray.intersectObjects(tqMeshes, false).length === 0) plateFree[ri * NAF + ai] = 1;
    }
  }
  const freeCell = (ri, ai) => plateFree[Math.max(0, Math.min(NRF - 1, ri)) * NAF + (((ai % NAF) + NAF) % NAF)];
  // EDGE REFINEMENT, bounded at setup. A cell whose 3×3 neighbourhood is
  // mixed sits on an edge — the cut wedge's fence, the cutaway boundary, a
  // window rim — and its single centre ray cannot speak for the whole
  // cell. Each such cell gets a 4×4 SUBGRID of rays, cast once here, and
  // classification below is pure lookups: sky where the (sub)cell's own
  // ray missed. Bores stay demand by resolution (a bore cannot clear a
  // whole coarse cell, and its subcells resolve its rim), and the fence
  // stations are honest at cell/4 — the first cut of a plain 3×3 rule
  // read the stop lever's mast as under-plate and reproduced the very
  // 0.006 mm artifact the footprint exists to kill; a per-vertex exact
  // ray fixed that and cost an hour of wall clock (no BVH in a plain
  // Raycaster), which is why the refinement is a GRID, counted and
  // finite, not a per-vertex escape hatch.
  const SUB = 4;
  const subCells = new Map(); // coarse index → Uint8Array(SUB*SUB), 1 = plate above
  {
    const ray = new THREE.Raycaster();
    const dirUp = new THREE.Vector3(0, 0, 1);
    const org = new THREE.Vector3();
    for (let ri = 0; ri < NRF; ri++) for (let ai = 0; ai < NAF; ai++) {
      let mixed = false;
      const own = freeCell(ri, ai);
      for (let dr = -1; dr <= 1 && !mixed; dr++) for (let da = -1; da <= 1; da++)
        if (freeCell(ri + dr, ai + da) !== own) { mixed = true; break; }
      if (!mixed) continue;
      const sub = new Uint8Array(SUB * SUB);
      for (let sr = 0; sr < SUB; sr++) for (let sa = 0; sa < SUB; sa++) {
        const r = (ri + (sr + 0.5) / SUB) / NRF * rSpan;
        const a = (ai + (sa + 0.5) / SUB) / NAF * 2 * Math.PI - Math.PI;
        org.set(r * Math.cos(a), r * Math.sin(a), plateBot - 1);
        ray.set(org, dirUp);
        if (ray.intersectObjects(tqMeshes, false).length > 0) sub[sr * SUB + sa] = 1;
      }
      subCells.set(ri * NAF + ai, sub);
    }
  }
  const openAbove = (x, y) => {
    const r = Math.hypot(x, y);
    if (r >= rSpan) return true;
    const ri = Math.min(NRF - 1, Math.floor(r / rSpan * NRF));
    const ai = Math.floor(((Math.atan2(y, x) + Math.PI) / (2 * Math.PI)) * NAF);
    const sub = subCells.get(ri * NAF + ai);
    if (!sub) return !!plateFree[ri * NAF + ai];           // uniform neighbourhood — the centre ray speaks for the cell
    const fr = r / rSpan * NRF - ri, fa = ((Math.atan2(y, x) + Math.PI) / (2 * Math.PI)) * NAF - ai;
    const sr = Math.min(SUB - 1, Math.floor(fr * SUB)), sa = Math.min(SUB - 1, Math.floor(fa * SUB));
    return sub[sr * SUB + sa] === 0;
  };
  const exactRays = subCells.size * SUB * SUB;             // reported: the refinement's whole cost

  // §191 — the RIDER roster: units seated ON the plate's underside, whose z
  // derives from TQ_BOT_Z and therefore descends with any drop. Each name
  // cites its coupling; the roster is asserted against the scene below.
  const RIDERS = new Map([
    ['pillars', 'makePillar({ height: TQ_BOT_Z }), seated at TQ_BOT_Z/2 — height AND cap radius derive from the underside'],
    ['Winding arrest', 'BRK_BOT = TQ_BOT_Z − BRK_T; the bracket top is boot-asserted flush on the plate underside'],
  ]);
  const staleRiders = [...RIDERS.keys()].filter((n) => !clock.labelEntries.some((e) => e.name === n));

  // Demand: everything BELOW the plate bottom and above the base plate's top
  // (z > 0.3, its real bevel top — the base plate itself and the dial side are
  // not tenants of this gap). Swept over the pose net; azimuth × radius bins.
  const NR = 24, NA = 36;
  const bins = Array.from({ length: NR * NA }, () => ({ z: -Infinity, who: null }));
  const crossers = new Map();       // meshes whose zMax >= plateBot: name → {zMax, x, y, unit}
  const unitTop = new Map();        // per-unit max z inside the gap, UNDER PLATE
  const skyTop = new Map();         // per-unit max z under OPEN SKY (reported, not demand)
  const riderTop = new Map();       // per-unit max z of roster riders (reported, not demand)
  const poses = [{ name: 'as booted', enter: () => {} }];
  for (const ax of I.AXES) for (const f of [0, 0.5, 1])
    poses.push({ name: `${ax.name} f=${f}`, enter: () => { I.enterAxis(clock); clock.setPose(ax.pose(f, clock)); } });

  for (const p of poses) {
    p.enter();
    clock.scene.updateMatrixWorld(true);
    for (const e of clock.labelEntries) {
      if (e.name === 'Three-quarter plate' || e.name === 'Dial') continue;
      const isRider = RIDERS.has(e.name);
      e.obj.traverse((o) => {
        if (!o.isMesh || o.userData.schematic || o.userData.casePart || !o.geometry?.attributes?.position) return;
        const pos = o.geometry.attributes.position;
        for (let i = 0; i < pos.count; i++) {
          o.localToWorld(v.fromBufferAttribute(pos, i));
          if (v.z <= 0.3) continue;                       // below the gap
          if (isRider) {                                  // descends with the plate — consequence, not constraint
            const t = riderTop.get(e.name) || { z: -Infinity };
            if (v.z > t.z) { t.z = v.z; t.pose = p.name; }
            riderTop.set(e.name, t);
            continue;
          }
          if (v.z >= plateBot) {                          // rises into/through the plate band
            const label = `${e.name} / ${o.name || o.geometry.type}`;
            const c = crossers.get(label) || { zMax: -Infinity, x: 0, y: 0 };
            if (v.z > c.zMax) { c.zMax = v.z; c.x = v.x; c.y = v.y; }
            crossers.set(label, c);
            continue;                                     // not gap demand — bore territory
          }
          if (openAbove(v.x, v.y)) {                      // no plate above — the cutaway, the wedge
            const t = skyTop.get(e.name) || { z: -Infinity };
            if (v.z > t.z) { t.z = v.z; t.pose = p.name; }
            skyTop.set(e.name, t);
            continue;
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
    skyTop: [...skyTop.entries()].map(([name, u]) => ({ name, z: u.z, pose: u.pose }))
      .sort((a, b) => b.z - a.z),
    riderTop: [...riderTop.entries()].map(([name, u]) => ({ name, z: u.z, pose: u.pose, why: RIDERS.get(name) }))
      .sort((a, b) => b.z - a.z),
    staleRiders,
    skyCells: plateFree.reduce((s, x) => s + x, 0), footCells: NRF * NAF, exactRays,
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
console.log(`plate band MEASURED z ${res.plateBot.toFixed(4)}..${res.plateTop.toFixed(4)}, outer r ${res.plateOuterR.toFixed(3)}; ${res.poses} poses`);
console.log(`footprint: ${res.footCells - res.skyCells}/${res.footCells} cells under plate, ${res.skyCells} open sky (the cutaway + the cut wedge); ${res.exactRays} edge-refinement subcell rays\n`);
console.log('GAP DEMAND per unit — UNDER PLATE METAL only (max z below the plate bottom, worst pose):');
for (const u of res.unitTop.slice(0, 14))
  console.log(`  ${u.name.padEnd(28)} ${u.z.toFixed(3).padStart(8)}  headroom-to-plate ${((res.plateBot - u.z) * MM).toFixed(3).padStart(6)} mm  @ ${u.pose}`);
console.log('\nOPEN SKY (no plate above — the balance cutaway and the cut wedge; NOT demand):');
for (const u of res.skyTop.slice(0, 8))
  console.log(`  ${u.name.padEnd(28)} ${u.z.toFixed(3).padStart(8)}  (would have read ${((res.plateBot - u.z) * MM).toFixed(3)} mm against a face that is not there)  @ ${u.pose}`);
console.log('\nRIDERS (seated on the underside — they descend WITH a drop; their own clearances re-hold in the battery):');
for (const u of res.riderTop)
  console.log(`  ${u.name.padEnd(28)} ${u.z.toFixed(3).padStart(8)}  — ${u.why}`);
console.log('\nRADIAL DEMAND (max z per r-ring over all az/poses — what a dropped plate hits first):');
for (const r of res.demandHist) {
  if (r.zMax === -Infinity) { console.log(`  r ${r.r0.toFixed(1).padStart(5)}..${r.r1.toFixed(1).padEnd(5)}  EMPTY`); continue; }
  console.log(`  r ${r.r0.toFixed(1).padStart(5)}..${r.r1.toFixed(1).padEnd(5)}  z ${r.zMax.toFixed(3).padStart(7)}  drop-room ${((res.plateBot - r.zMax) * MM).toFixed(3).padStart(6)} mm  az-bins ${String(r.filled).padStart(2)}/36  ${r.who}`);
}
console.log('\nBORE CROSSERS (metal rising to/through the plate band; nearest plate metal in XY):');
for (const c of res.crossRows.slice(0, 20))
  console.log(`  ${c.label.padEnd(44)} zMax ${c.zMax.toFixed(3).padStart(7)}  plate-metal ${c.nearestPlateMetal.toFixed(3)} away ${c.nearestPlateMetal > 0.3 ? '(in a bore/opening)' : '(UNDER SOLID PLATE)'}`);

// The §191 triage question, printed where the reader looks: where does the
// stop lever's metal classify, split by footprint? (Not gated — the answer
// is the deliverable.) A unit can appear in BOTH tables: the mast in the
// wedge and the low crank arms under the plate proper are different metal.
{
  const inDemand = res.unitTop.find((u) => u.name === 'Stop lever');
  const inSky = res.skyTop.find((u) => u.name === 'Stop lever');
  const d = inDemand ? `under-plate metal tops at z ${inDemand.z.toFixed(3)} (${((res.plateBot - inDemand.z) * MM).toFixed(3)} mm headroom)` : 'no metal under plate';
  const s = inSky ? `open-sky metal tops at z ${inSky.z.toFixed(3)} (the mast, in the cut wedge)` : 'no metal in the sky';
  console.log(`\nSTOP LEVER: ${s}; ${d}.`);
  if (inSky && (!inDemand || inSky.z > inDemand.z + 0.5))
    console.log(`  → the first cut's 0.006 mm was the azimuth collapse charging the underside for the mast's wedge station; the metal actually under plate is not the binder`);
  else if (inDemand && res.plateBot - inDemand.z < 0.4)
    console.log(`  → real near-fit under plate — a drop must pocket or re-station it`);
}

// CONTROLS.
let ok = true;
// The chain's top wrap runs under the fusee's §62 WINDOW, so with the
// footprint in place it is not UNDERSIDE demand — for a drop it becomes a
// crosser-into-the-opening, exactly like the wheel tops. The control that
// still catches a broken scan is the MERGED below-plate population: lose
// the chain from demand ∪ sky and the scan lost the tallest documented
// tenant, wherever it classified.
const merged = [...res.unitTop, ...res.skyTop].sort((a, b) => b.z - a.z).slice(0, 5).map((u) => u.name);
if (!merged.some((n) => /Chain|Fusee/.test(n))) {
  ok = false;
  console.log(`\nCONTROL FAIL: chain/fusee not in the top-5 of the merged below-plate population [${merged.join(', ')}] — the scan measured the wrong thing`);
} else console.log(`\nCONTROL PASS: chain/fusee found in the top-5 merged below-plate population`);
// The hairspring moved homes when the footprint arrived: it stands in the
// three-quarter cutaway, so it is the OPEN-SKY table's job to hold it — a
// scan that loses it there measured the wrong thing just as surely.
const sky3 = res.skyTop.slice(0, 3).map((u) => u.name);
if (!sky3.some((n) => /Hairspring|Balance/.test(n))) {
  ok = false;
  console.log(`CONTROL FAIL: hairspring/balance not atop the open-sky table [${sky3.join(', ')}] — the footprint classified the cutaway wrong`);
} else console.log(`CONTROL PASS: hairspring/balance atop the open-sky table (the cutaway reads as sky)`);
if (res.unitTop.some((u) => u.name === 'Dial') || res.skyTop.some((u) => u.name === 'Dial')) { ok = false; console.log('CONTROL FAIL: the Dial contributed to gap demand — the ground got counted'); }
else console.log('CONTROL PASS: the dial contributed nothing (ground excluded)');
if (res.staleRiders.length) { ok = false; console.log(`CONTROL FAIL: rider roster names not in the scene: ${res.staleRiders.join(', ')} — a stale selector buys silent inclusion`); }
else console.log('CONTROL PASS: every rider-roster name exists in the scene');
if (res.skyCells === 0 || res.skyCells === res.footCells) { ok = false; console.log(`CONTROL FAIL: footprint degenerate (${res.skyCells}/${res.footCells} sky) — the raycast measured nothing`); }
else console.log(`CONTROL PASS: footprint non-degenerate (${res.skyCells}/${res.footCells} cells sky)`);
await browser.close(); srv.kill();
process.exit(ok ? 0 : 2);
