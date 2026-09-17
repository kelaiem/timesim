// §233 — CAN THE MOVEMENT'S MEMBERS ACTUALLY BE MADE?
//
// The repo has two floors on a section and NEITHER of them asks this. §50's
// STOCK_FLOORS are a MATERIAL fact — "below this a solid is not thin metal but
// broken geometry", and its horological tier says what stock a watchmaker draws.
// §54's SLENDER_MAX is a STRUCTURAL fact — a member this slender bends. A part
// can satisfy both and still be a thing no process on earth will produce, and
// the owner found one by eye: the alarm link's lay shaft is 12.65 mm long at
// 0.188 mm across, λ 27 (passes §54) and over §50's floor (passes stockFloor),
// and its L/D is 67. That is not a shaft anyone turns. It is wire.
//
// This is the REPORT tier of §36's convention — REPORT → TRIAGE → DECLARE →
// GATE. It gates nothing ABOUT THE MOVEMENT and declares nothing; it prints
// what each process would refuse, so the population can be triaged before a
// floor is promoted into layout.js and held. A report saying "0 violations"
// has not passed anything, and this one will not say that.
//
// IT DOES GATE ITS OWN RULER, and exits non-zero when a control fails, which
// is why it is filed as an acceptance test. Both of this probe's rulers were
// wrong once — the feature tier measured markings and hairsprings as if
// somebody milled them, and the turning tier read an unrelated field for
// roundness and then assumed an axis the vertices do not have. Each was
// plausible in print and each answered a question nobody asked. A report whose
// ruler nobody checks is worse than no report, because its numbers get quoted.
//
// THE THRESHOLDS ARE CITED, NOT CHOSEN. They live here rather than in
// layout.js on purpose: a constant in layout.js is one the BUILD derives from,
// and nothing derives from these yet. Promote them when the tier is triaged.
//
//   · Metal laser powder-bed (DMLS/SLM), min free-standing feature 0.40 mm.
//     Vendors quote 0.3–0.5 mm for a feature that survives depowdering and
//     handling; 0.4 is the conservative middle. Below it a feature prints but
//     does not survive.
//   · Resin SLA/DLP, min free-standing feature 0.25 mm. Printable finer, but a
//     free-standing rod thinner than this sags under its own green strength
//     before cure.
//   · 3-axis milling, min feature 0.30 mm — a 0.3 mm end mill is the practical
//     small end, and the feature cannot be finer than the tool that cuts it.
//   · TURNING is not a feature-size limit but a SLENDERNESS one, because a
//     slender bar deflects away from the tool and chatters: L/D ≤ 10
//     unsupported, ≤ 20 with a follower rest or between centres. This is the
//     limit that bites hardest here and the one §50 and §54 between them do not
//     express — §54's λ is about the member bending IN SERVICE, this is about
//     it bending UNDER THE TOOL, and they are different lengths (λ measures a
//     free length between bearings; turning sees the whole bar).
//
// WHAT IT MEASURES, and the two honest limits of it:
//   1. The thinnest dimension per mesh, from `stockCensus` — the same ruler
//      stockFloor uses, so the two tiers are comparable by construction.
//   2. The TURNING ratio, measured from the metal on its own axis — and the
//      first cut of this read the census's `via` field, which does not mean
//      what the name suggests. `via` is 'axial'/'radial' only for a §36
//      REGISTRY REVOLVE, and being a revolve in the registry means the part
//      SPINS IN THE MOVEMENT, which has nothing to do with whether it is
//      turned on a lathe. Read that way the tier called an ExtrudeGeometry
//      round, missed every static cylinder in the watch — §232's lay shaft,
//      a `CylinderGeometry`, among them — and answered "4 of 168" for a
//      question it had not asked. A body of revolution is one BY
//      CONSTRUCTION, so the test is the geometry's type, and the ratio is
//      measured off the vertices: bin them along the local axis, take the
//      OUTER radius per bin (max, so a solid's r = 0 cap centre cannot lower
//      it — the census's own trap), and the governing diameter is the
//      narrowest of those bins. That reads a stepped bar at its thin step and
//      a bush at its OD, which is what the tool sees in each case.
//   3. And the same ratio for the BAR, not just the mesh. A turned member
//      built from several coaxial meshes is one piece of stock on the lathe:
//      §232's lay shaft is a body between two necks, three meshes, and each
//      one alone passes. Round meshes of one unit sharing an axis LINE are
//      measured as the single bar they are.
// IT ASKS THE KIND FIRST, and the first cut of it did not — which is how a
// report comes back ALARMING while measuring the wrong population, the mirror
// of the skill's clean-but-empty failure. Run without kinds it answered "79% of
// members are under the metal-printing floor" and led with `alarmIndexLine` at
// 0.0076 mm. That is a registration MARKING — §34 declares it `'marking'` and
// it is PRINTED on the disc's face. Nobody mills it, so it cannot fail a
// milling floor. Neither can a hairspring (drawn wire, coiled), a mainspring
// ribbon, or a hand (stamped from sheet). §50 already declares what every mesh
// IS, in STOCK_KIND_BY_MESH / STOCK_KIND_BY_PART, so this reads the same table
// rather than inventing a second opinion — and reports per kind, because the
// answer to "can it be made" depends entirely on which process makes it:
//
//   MACHINED   wheel, pivot, ring — turned, milled, wire-EDM'd or printed from
//              bar or plate. THESE are what a feature floor governs, and they
//              are the headline.
//   FORMED     spring — drawn wire and strip, coiled or bent. A 0.05 mm blade
//              is ordinary spring stock and a milling floor says nothing.
//   STAMPED    hand — blanked from sheet; fine in-plane detail is free, and the
//              thickness is the sheet's.
//   APPLIED    marking — printed, engraved or lacquered ONTO a face. Not a
//              member at all; excluded from every count rather than waived.
//
//   · The FEATURE tier cannot see assemblies — a part made of three meshes is
//     judged as three features, which is right for "can this feature be made"
//     and wrong for "can this part be handled". The turning tier does see them
//     (item 3), but only where the members are coaxial; a bent or jointed
//     member is still judged piecewise.
//   · It cannot see PROCESS CHOICE. A member under the milling floor may be
//     stamped or wire-EDM'd in reality, and a real caliber uses both. The
//     report is "which processes are refused", never "this cannot exist".
//
// Usage: cd tools && node probe-233-manufacturability.mjs [out.json]
import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import { writeFileSync } from 'node:fs';

const PORT = process.env.PORT || 8681;
const ROOT = process.env.ROOT || '..';
const srv = spawn('python3', ['-m', 'http.server', String(PORT), '--bind', '127.0.0.1'], { cwd: ROOT, stdio: 'ignore' });
process.on('exit', () => srv.kill());
await new Promise((r) => setTimeout(r, 900));
const browser = await chromium.launch();
const page = await browser.newPage();
page.on('pageerror', (e) => console.error('PAGEERROR', String(e)));
await page.goto(`http://127.0.0.1:${PORT}/index.html`, { waitUntil: 'load', timeout: 60000 });
await page.waitForFunction(() => !!window.__clock, null, { timeout: 60000 });

const R = await page.evaluate(async () => {
  const I = await import('./src/inspect.js');
  const { UNIT_MM } = await import('./src/layout.js');
  const clock = window.__clock;
  const c = await I.stockCensus(clock, { yieldEvery: 64 });
  // the SAME table stockFloor resolves through — one declaration, two readers
  const kindOf = (mesh, part) => I.STOCK_KIND_BY_MESH[mesh] || I.STOCK_KIND_BY_PART[part] || 'wheel';

  // ---- the turning tier reads the METAL, on the population the census counts.
  // Same registry, same nearest-ancestor dedupe, so the two tiers cannot
  // disagree about which meshes exist or what unit owns them.
  const reg = await I.buildSweptRegistry(clock, { yieldEvery: 64 });
  const unitObj = new Map(clock.labelEntries.map((e) => [e.name, e.obj]));
  const hops = (mesh, name) => {
    const target = unitObj.get(name);
    let n = 0;
    for (let o = mesh; o; o = o.parent, n++) if (o === target) return n;
    return Infinity;
  };
  const byMesh = new Map();
  for (const v of reg._volumes) {
    const prev = byMesh.get(v.mesh);
    if (!prev || hops(v.mesh, v.unit) < hops(v.mesh, prev.unit)) byMesh.set(v.mesh, v);
  }
  // `whereOf`'s format, reproduced so a turning row joins to its census row by
  // eye — the census does not export it and this must not fork its meaning.
  const whereOf = (mesh) => {
    const g = mesh.geometry, pr = g.parameters || {};
    const args = Object.entries(pr).filter(([, x]) => typeof x === 'number')
      .map(([k, x]) => `${k} ${+x.toFixed(4)}`);
    const at = mesh.position;
    return `${g.type}(${args.join(', ')}) at local `
      + `${[at.x, at.y, at.z].map((q) => +q.toFixed(3)).join(', ')}`;
  };
  // A BODY OF REVOLUTION IS ONE BY CONSTRUCTION — the TYPE says so, and nothing
  // else here is allowed to claim it. But its AXIS is not known from the type:
  // three.js builds both about local +Y, and this repo routinely bakes a
  // quarter turn into the vertices (`geo.rotateX`) to lay a bar along another
  // axis, after which local +Y is across the bar. Assuming +Y read the CASE
  // SPRING BAR's ⌀ as 20.00 mm — which is its LENGTH, because with the axis
  // across the bar the "radius" it measured was half the span. Every rotated
  // member read the same way and the L/D table was nonsense in the safe
  // direction (a fat short bar), which is why it needed a control to see.
  //
  // So the axis is FOUND, by the property that defines one: about the true
  // axis a body of revolution is as narrow as it can be, because every vertex
  // sits at its profile radius, and about any other axis the span enters the
  // radius. Minimising the max radius over DIRECTION finds it.
  //
  // Searching only the three local axes is not enough, and one mesh proved it
  // — a fusee washer whose baked rotation is not a quarter turn, so no local
  // axis is its axis and the nearest one mixed span into radius: measured ⌀
  // 0.125 mm against a constructed 1.450. It was the last row C1 rejected, and
  // the reason to refine rather than waive it is that nothing in the geometry
  // marks which members are baked square and which are not.
  //
  // The REFUSAL is the same property read the other way. A direction is the
  // axis only if tilting away from it makes the body wider; where it does not,
  // the body is as narrow in two directions at once — a disc, not a bar — and
  // this says so instead of quoting a ratio. Cost: nothing for turning, since
  // a disc's L/D is far under any limit; what it protects is the bar tier,
  // where a disc admitted on a mis-fitted axis would drag a cluster's
  // governing diameter to half its own thickness.
  const REVOLVE = new Set(['CylinderGeometry', 'LatheGeometry']);
  const mul = (m, x, y, z, w) => [
    m[0] * x + m[4] * y + m[8] * z + m[12] * w,
    m[1] * x + m[5] * y + m[9] * z + m[13] * w,
    m[2] * x + m[6] * y + m[10] * z + m[14] * w,
  ];
  const norm = (v) => { const L = Math.hypot(...v); return [v[0] / L, v[1] / L, v[2] / L]; };
  const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
  const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];

  const round = [], ambiguous = [];
  for (const v of byMesh.values()) {
    const g = v.mesh.geometry;
    if (!REVOLVE.has(g.type)) continue;
    const pos = g.attributes && g.attributes.position;
    if (!pos || !pos.count) continue;
    // TODO 139's trap: this is a WORLD quantity, so walk UP. updateMatrixWorld
    // recomputes from the parent's matrix exactly as it stands.
    v.mesh.updateWorldMatrix(true, false);
    const m = v.mesh.matrixWorld.elements;
    const origin = mul(m, 0, 0, 0, 1);
    const pts = [];
    for (let i = 0; i < pos.count; i++) pts.push(mul(m, pos.getX(i), pos.getY(i), pos.getZ(i), 1));
    const maxRadius = (a) => {
      let maxR = 0;
      for (const p of pts) {
        const d = sub(p, origin), t = dot(d, a);
        const r = Math.hypot(d[0] - t * a[0], d[1] - t * a[1], d[2] - t * a[2]);
        if (r > maxR) maxR = r;
      }
      return maxR;
    };
    // seed from the best of the three local axes, then descend on direction
    const tangents = (a) => {
      const up = Math.abs(a[1]) < 0.9 ? [0, 1, 0] : [1, 0, 0];
      const u = norm([a[1] * up[2] - a[2] * up[1], a[2] * up[0] - a[0] * up[2], a[0] * up[1] - a[1] * up[0]]);
      return [u, [a[1] * u[2] - a[2] * u[1], a[2] * u[0] - a[0] * u[2], a[0] * u[1] - a[1] * u[0]]];
    };
    const tilt = (a, t, ang) => norm([a[0] + t[0] * Math.tan(ang), a[1] + t[1] * Math.tan(ang), a[2] + t[2] * Math.tan(ang)]);
    let axis = [[1, 0, 0], [0, 1, 0], [0, 0, 1]]
      .map((e) => norm(mul(m, e[0], e[1], e[2], 0)))
      .reduce((best, a) => (maxRadius(a) < maxRadius(best) ? a : best));
    let best = maxRadius(axis);
    for (let step = 0.35; step > 1e-4; step *= 0.6) {
      let moved = true;
      while (moved) {
        moved = false;
        for (const t of tangents(axis)) for (const sgn of [1, -1]) {
          const a = tilt(axis, t, sgn * step), r = maxRadius(a);
          if (r < best * (1 - 1e-9)) { axis = a; best = r; moved = true; }
        }
      }
    }
    // tilting away from a true axis must WIDEN the body; where it does not,
    // the body is not a bar and this refuses rather than quotes a ratio
    const AMBIG_TILT = 0.15;                                   // 8.6°
    const widen = tangents(axis).flatMap((t) => [1, -1].map((sgn) => maxRadius(tilt(axis, t, sgn * AMBIG_TILT)) / best));
    if (Math.min(...widen) < 1.02) { ambiguous.push(v.mesh.name || '(unnamed)'); continue; }
    // and the world SCALE across the axis, so a constructed radius compares
    const perp = tangents(axis).map((t) => {
      // pull each world tangent back to local and read how far the matrix takes it
      const inv = v.mesh.matrixWorld.clone().invert().elements;
      const l = norm([inv[0] * t[0] + inv[4] * t[1] + inv[8] * t[2],
                      inv[1] * t[0] + inv[5] * t[1] + inv[9] * t[2],
                      inv[2] * t[0] + inv[6] * t[1] + inv[10] * t[2]]);
      return Math.hypot(...mul(m, l[0], l[1], l[2], 0));
    });
    round.push({ part: v.unit, mesh: v.mesh.name || '(unnamed)', where: whereOf(v.mesh),
      type: g.type, kind: kindOf(v.mesh.name, v.unit), axis, origin, pts,
      radialScale: Math.max(...perp), radialScaleMin: Math.min(...perp),
      paramR: g.parameters && g.parameters.radiusTop === g.parameters.radiusBottom
        ? g.parameters.radiusTop : null });
  }

  // Span along the axis, and the OUTER radius per bin — max, so a solid's
  // r = 0 cap centre cannot lower it (the census's own documented trap). The
  // governing diameter is the narrowest bin: a stepped bar reads at its thin
  // step, a bush at its OD.
  const BINS = 64;
  const measure = (axis, origin, groups) => {
    let tMin = Infinity, tMax = -Infinity;
    const all = [];
    for (const pts of groups) for (const p of pts) {
      const d = sub(p, origin);
      const t = dot(d, axis);
      const perp = Math.hypot(d[0] - t * axis[0], d[1] - t * axis[1], d[2] - t * axis[2]);
      all.push([t, perp]);
      if (t < tMin) tMin = t;
      if (t > tMax) tMax = t;
    }
    const span = tMax - tMin;
    if (!(span > 1e-6)) return null;
    const outer = new Array(BINS).fill(-1);
    for (const [t, r] of all) {
      let b = Math.floor((t - tMin) / span * BINS);
      if (b >= BINS) b = BINS - 1;
      if (r > outer[b]) outer[b] = r;
    }
    const gov = Math.min(...outer.filter((r) => r >= 0));
    if (!(gov > 1e-6)) return null;
    return { len_u: span, dia_u: 2 * gov };
  };

  const perMesh = [];
  for (const r of round) {
    const mm = measure(r.axis, r.origin, [r.pts]);
    if (!mm) continue;
    perMesh.push({ part: r.part, mesh: r.mesh, where: r.where, type: r.type, kind: r.kind,
      len_mm: mm.len_u * UNIT_MM, dia_mm: mm.dia_u * UNIT_MM, LD: mm.len_u / mm.dia_u,
      // the CONSTRUCTED diameter as it stands in the world — the parameter is
      // local, so a scaled ancestor moves it and C1 would read that as error
      paramDia_mm: r.paramR !== null && isFinite(r.paramR)
        ? 2 * r.paramR * r.radialScale * UNIT_MM : null,
      squashed: r.radialScale > r.radialScaleMin * 1.01 });
  }

  // ---- BARS. Coaxial round meshes of one unit are one piece of stock: same
  // axis DIRECTION and the same axis LINE (the perpendicular offset between
  // the two lines is zero), not merely parallel.
  const bars = [];
  const byUnit = new Map();
  for (const r of round) (byUnit.get(r.part) || byUnit.set(r.part, []).get(r.part)).push(r);
  for (const [unit, members] of byUnit) {
    const used = new Set();
    for (let i = 0; i < members.length; i++) {
      if (used.has(i)) continue;
      const a = members[i];
      const cluster = [a];
      used.add(i);
      for (let j = i + 1; j < members.length; j++) {
        if (used.has(j)) continue;
        const b = members[j];
        if (Math.abs(dot(a.axis, b.axis)) < 1 - 1e-4) continue;
        const d = sub(b.origin, a.origin);
        const t = dot(d, a.axis);
        const off = Math.hypot(d[0] - t * a.axis[0], d[1] - t * a.axis[1], d[2] - t * a.axis[2]);
        if (off > 0.01) continue;             // 0.01 u ≈ 3.8 µm — one line, not two
        cluster.push(b);
        used.add(j);
      }
      if (cluster.length < 2) continue;        // a bar of one is already perMesh
      const mm = measure(a.axis, a.origin, cluster.map((x) => x.pts));
      if (!mm) continue;
      bars.push({ part: unit, meshes: cluster.map((x) => x.mesh),
        kind: cluster[0].kind,
        len_mm: mm.len_u * UNIT_MM, dia_mm: mm.dia_u * UNIT_MM, LD: mm.len_u / mm.dia_u });
    }
  }

  return { rows: c.thinnestFirst.map((r) => ({ ...r, kind: kindOf(r.mesh, r.part) })),
           unmeasured: c.unmeasured || [], UNIT_MM,
           perMesh, bars, roundMeshes: round.length, allMeshes: byMesh.size, ambiguous };
});

const MIN = { dmls: 0.40, sla: 0.25, mill: 0.30 };
const TURN_LD = { unsupported: 10, supported: 20 };

// which process makes a member of this kind, and so which floor may judge it
const PROCESS_OF = { wheel: 'MACHINED', pivot: 'MACHINED', ring: 'MACHINED',
                     spring: 'FORMED', hand: 'STAMPED', marking: 'APPLIED' };
const processOf = (kind) => PROCESS_OF[kind] || 'MACHINED';
const all = R.rows.map((r) => ({
  part: r.part, mesh: r.mesh, mm: r.thinnestMM, kind: r.kind,
  process: processOf(r.kind), where: r.where,
}));
const rows = all.filter((r) => r.process === 'MACHINED');
const turned = R.perMesh.filter((r) => processOf(r.kind) === 'MACHINED');
const bars = R.bars.filter((r) => processOf(r.kind) === 'MACHINED');

// ---- CONTROLS. Three, and each one fails loudly rather than quietly reading 0.
// C1 the ruler reads the METAL, not the constructor: every plain cylinder's
//    measured diameter must equal its own parameter × world scale. A tier that
//    echoed `parameters` would pass every check here and see nothing built.
// C2 the tier can say NO: not one member may be judged round that the geometry
//    does not build as a revolve. This is what the `via` reading failed.
// C3 the bar tier ASSEMBLES: §232's lay shaft must come back longer as a bar
//    than its longest single mesh, or the clustering did nothing.
const ctl = [];
{
  // straight cylinders only: a cone's narrow end falls inside a bin, so its
  // measured ⌀ is legitimately a bin wider than its parameter, and a squashed
  // revolve is not round at all and has no single constructed ⌀ to compare
  const plain = R.perMesh.filter((r) => r.type === 'CylinderGeometry' && r.paramDia_mm && !r.squashed);
  const errs = plain.map((r) => ({ e: Math.abs(r.dia_mm - r.paramDia_mm) / r.paramDia_mm, r }));
  const worst = errs.reduce((a, b) => (a.e > b.e ? a : b), { e: 0, r: null });
  ctl.push(['C1 measured ⌀ == constructed ⌀', worst.e < 0.02,
    `${plain.length} cylinders, worst ${(100 * worst.e).toFixed(2)}%`
    + (worst.r ? ` (${worst.r.part} / ${worst.r.mesh})` : '')]);
}
{
  const bad = R.perMesh.filter((r) => !['CylinderGeometry', 'LatheGeometry'].includes(r.type));
  ctl.push(['C2 nothing flat judged round', bad.length === 0,
    `${R.roundMeshes} round of ${R.allMeshes} meshes; ${R.ambiguous.length} revolves refused as axis-ambiguous`]);
}
{
  const bar = R.bars.find((b) => b.meshes.includes('alarmLinkShaft'));
  const solo = R.perMesh.find((r) => r.mesh === 'alarmLinkShaft');
  ctl.push(['C3 bar tier assembles (lay shaft)', !!bar && !!solo && bar.len_mm > solo.len_mm * 1.05,
    bar && solo ? `bar ${bar.len_mm.toFixed(2)} mm of ${bar.meshes.length} vs mesh ${solo.len_mm.toFixed(2)} mm` : 'NOT FOUND']);
}

const under = (k) => rows.filter((r) => r.mm < MIN[k]);
const turnBad = turned.filter((r) => r.LD > TURN_LD.supported);
const barBad = bars.filter((r) => r.LD > TURN_LD.supported);

const byProcess = {};
for (const r of all) (byProcess[r.process] ||= []).push(r);
console.log(`§233 manufacturability — REPORT over ${all.length} measured members\n`);
console.log('CONTROLS');
for (const [name, ok, note] of ctl) console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${name} — ${note}`);
console.log('');
console.log('POPULATION, by how the member is made (§50\'s own kind table):');
for (const k of ['MACHINED', 'FORMED', 'STAMPED', 'APPLIED'])
  console.log(`  ${k.padEnd(9)} ${String((byProcess[k] || []).length).padStart(3)}`
    + (k === 'MACHINED' ? '   <- the only population a feature floor governs' : ''));
console.log('');
console.log('MINIMUM FEATURE — members under each process floor:');
for (const k of ['sla', 'mill', 'dmls']) {
  const u = under(k);
  console.log(`  ${k.toUpperCase().padEnd(5)} < ${MIN[k].toFixed(2)} mm : ${String(u.length).padStart(3)} of ${rows.length}`
    + `  (${(100 * u.length / rows.length).toFixed(0)}%)`);
}
console.log('\n  the 12 thinnest, which every process refuses:');
for (const r of rows.slice().sort((a, b) => a.mm - b.mm).slice(0, 12))
  console.log(`    ${String(r.mm.toFixed(4)).padStart(7)} mm  ${r.part} / ${r.mesh}`);

console.log(`\nTURNING, per MESH — over L/D ${TURN_LD.supported} (supported); unsupported is ${TURN_LD.unsupported}:`);
console.log(`  ${turnBad.length} of ${turned.length} turned members  (${R.allMeshes - R.roundMeshes} meshes are not bodies of revolution and are not judged)`);
for (const r of turnBad.slice().sort((a, b) => b.LD - a.LD).slice(0, 12))
  console.log(`    L/D ${r.LD.toFixed(1).padStart(6)}   ⌀ ${r.dia_mm.toFixed(4)} × ${r.len_mm.toFixed(2)} mm   ${r.part} / ${r.mesh}`);

console.log(`\nTURNING, per BAR — coaxial members are one piece of stock:`);
console.log(`  ${barBad.length} of ${bars.length} multi-mesh bars over L/D ${TURN_LD.supported}`);
for (const r of barBad.slice().sort((a, b) => b.LD - a.LD).slice(0, 12))
  console.log(`    L/D ${r.LD.toFixed(1).padStart(6)}   ⌀ ${r.dia_mm.toFixed(4)} × ${r.len_mm.toFixed(2)} mm   ${r.part} / ${r.meshes.join(' + ')}`);

const byPart = new Map();
for (const r of under('sla')) byPart.set(r.part, (byPart.get(r.part) || 0) + 1);
console.log('\nBY UNIT — members under even the finest floor (SLA 0.25 mm):');
for (const [p, n] of [...byPart].sort((a, b) => b[1] - a[1]).slice(0, 12))
  console.log(`  ${String(n).padStart(3)}  ${p}`);

const failed = ctl.filter(([, ok]) => !ok);
const out = process.argv[2];
if (out) {
  writeFileSync(out, JSON.stringify({ MIN, TURN_LD, controls: ctl, rows,
    perMesh: R.perMesh, bars: R.bars }, null, 1));
  console.log(`\nwrote ${out}`);
}
await browser.close();
if (failed.length) {
  console.error(`\nFAIL — ${failed.length} control(s): ${failed.map(([n]) => n).join(', ')}.`
    + ' The rows above are NOT readable; the ruler is wrong, not the movement.');
  process.exit(1);
}
process.exit(0);
