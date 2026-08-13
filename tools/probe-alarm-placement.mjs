// THE PLACEMENT GATE: does the alarm striking module FIT under the
// three-quarter plate once the mainspring drum's side departs?
//
// probe-alarm-under-plate answered "not where it stands"; probe-drum-azimuth
// found the drum a second legal station (40..62 deg). This instrument closes
// the loop: with drum + chain + set-up work departed to a candidate station
// and THE FUSEE KEPT (it is gear-meshed to the centre pinion — it does not
// move), search every module rotation for a placement whose every mesh
// clears every obstacle. Three things make the answer honest:
//
//  · Occupancy is Z-INTERVALS per cell, not a max-top map. The fourth wheel
//    (6.50..7.40) and the hairspring (6.81..7.50) are high planes a
//    floor-standing module passes UNDER; a max-top map calls that sector
//    full and would refuse placements that are actually clear.
//  · The module moves the way the movement already moves it: ?alarmmod=
//    rotates the whole striking complex about the movement centre (§33), so
//    the search variable is that rotation, 1-degree steps, with the descent
//    a rigid translation onto the base plate's top face (studs keep their
//    planted-0.5 embed; every internal offset is translation-invariant).
//  · Boxes are read PRECISELY (Box3.setFromObject's second argument) — the
//    cheap read reports the AABB of a rotated AABB (see
//    probe-alarm-under-plate) — and each module mesh is rasterized as its
//    box ROTATED with the module, except the gong arc, which is rasterized
//    from its vertex cloud: a 90-degree torus arc's box claims the whole
//    quarter-sector its chord subtends, and that overclaim alone could fail
//    the gate.
//
// Pillars are EXCLUDED from the gate and reported separately: their seats
// are solved at boot around whatever stands under the plate (seatClearance
// reads the built groups), so a pillar standing in a candidate pocket today
// is a pillar that re-seats itself, not a refusal.
//
// Run: cd tools && node probe-alarm-placement.mjs
import { chromium } from 'playwright';
import { spawn } from 'node:child_process';

const srv = spawn('python3', ['-m', 'http.server', '8443', '--bind', '127.0.0.1'], { cwd: '..', stdio: 'ignore' });
await new Promise((r) => setTimeout(r, 800));
const browser = await chromium.launch();
const page = await browser.newPage();
page.on('pageerror', (e) => console.log('PAGEERROR', String(e)));
await page.goto('http://127.0.0.1:8443/index.html', { waitUntil: 'load', timeout: 60000 });
await page.waitForFunction(() => !!window.__clock, null, { timeout: 60000 });

const res = await page.evaluate(async () => {
  const THREE = await import('three');
  const clock = window.__clock;
  clock.resetInputs();
  clock.setPose({ tau: 0.13, crownPullT: 0, leverEngage: 0, tension: 1, windAccumTurns: 0 });
  clock.render();
  const out = [];
  const f = (n) => n.toFixed(2);
  const MARGIN = 0.15;

  const plate = clock.labelEntries.find((e) => e.name === 'Three-quarter plate');
  const plateBox = new THREE.Box3().setFromObject(plate.obj);
  const TQ_BOT = plateBox.min.z, TQ_TOP = plateBox.max.z;
  const plateR = clock.plateR;

  const MODULE = ['Alarm gong', 'Alarm hammer', 'Alarm striking wheel', 'Alarm barrel',
    'Alarm governor', 'Alarm governor anchor', 'Alarm click', 'Alarm lock'];
  // Spanning members re-solve in the descent itself (their z is set at both
  // ends); the DEPARTING three stand at a candidate station instead.
  const SPANNING = ['Alarm switch', 'Alarm link', 'Alarm winding train'];
  const DEPARTING = ['Mainspring drum', 'Chain', 'Set-up work'];

  const all = [];
  for (const e of clock.labelEntries) {
    e.obj.traverse((o) => {
      if (!o.isMesh || o.userData.schematic || !o.geometry?.attributes?.position) return;
      const bb = new THREE.Box3().setFromObject(o, true);
      if (!bb.isEmpty()) all.push({ unit: e.name, mesh: o.name || o.geometry.type, bb, obj: o });
    });
  }

  // --- The grid, and the obstacles' per-cell z-intervals -------------------
  const N = 90, step = (2 * plateR) / N;
  const cellsOf = (b) => {
    const i0 = Math.max(0, Math.floor((b.min.x + plateR) / step));
    const i1 = Math.min(N - 1, Math.floor((b.max.x + plateR) / step));
    const j0 = Math.max(0, Math.floor((b.min.y + plateR) / step));
    const j1 = Math.min(N - 1, Math.floor((b.max.y + plateR) / step));
    const cells = [];
    for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) cells.push(j * N + i);
    return cells;
  };
  const buildField = (obstacles) => {
    const field = new Array(N * N).fill(null);
    for (const o of obstacles) {
      if (o.bb.min.z > TQ_BOT - 1e-3 || o.bb.max.z < 0) continue; // outside the band
      const z0 = Math.max(o.bb.min.z, -1), z1 = Math.min(o.bb.max.z, TQ_BOT);
      const tag = o.unit ? `${o.unit}/${o.mesh}` : 'departed drum';
      for (const c of cellsOf(o.bb)) (field[c] ||= []).push([z0, z1, tag]);
    }
    return field;
  };
  const baseObstacles = all.filter((o) => !MODULE.includes(o.unit) && !SPANNING.includes(o.unit)
    && !DEPARTING.includes(o.unit) && o.unit !== 'Three-quarter plate' && o.unit !== 'pillars');
  const pillarField = buildField(all.filter((o) => o.unit === 'pillars'));

  // --- The departed drum at a candidate azimuth, synthesized ---------------
  // Bands and radii read from the built units, so the synthesis cannot drift
  // from the metal; the chain span is a stadium fusee → drum at wire width.
  const P = clock.P;
  const unitBox = (name) => {
    const b = new THREE.Box3();
    clock.labelEntries.find((e) => e.name === name).obj.traverse((o) => {
      if (o.isMesh && !o.userData.schematic) b.union(new THREE.Box3().setFromObject(o, true));
    });
    return b;
  };
  const drumB = unitBox('Mainspring drum'), setupB = unitBox('Set-up work'), chainB = unitBox('Chain');
  const drumC = { x: (drumB.min.x + drumB.max.x) / 2, y: (drumB.min.y + drumB.max.y) / 2 };
  const DRUM_CD = Math.hypot(drumC.x - P.barrel.x, drumC.y - P.barrel.y);
  const DRUM_R = Math.max(drumB.max.x - drumB.min.x, drumB.max.y - drumB.min.y) / 2;
  const SETUP_R = Math.max(setupB.max.x - setupB.min.x, setupB.max.y - setupB.min.y) / 2;
  const departedAt = (azDeg) => {
    const a = azDeg * Math.PI / 180;
    const cx = P.barrel.x + Math.cos(a) * DRUM_CD, cy = P.barrel.y + Math.sin(a) * DRUM_CD;
    const disc = (x, y, r, z0, z1) => ({ bb: { min: { x: x - r, y: y - r, z: z0 }, max: { x: x + r, y: y + r, z: z1 } } });
    const rows = [
      disc(cx, cy, DRUM_R, drumB.min.z, drumB.max.z),
      disc(cx, cy, SETUP_R, Math.max(setupB.min.z, 0), Math.min(setupB.max.z, TQ_BOT)),
    ];
    // chain span corridor, sampled — box-per-sample keeps the field simple
    const wire = 1.2;
    for (let t = 0; t <= 1; t += 0.05)
      rows.push(disc(P.barrel.x + (cx - P.barrel.x) * t, P.barrel.y + (cy - P.barrel.y) * t, wire, chainB.min.z, chainB.max.z));
    return rows;
  };

  // --- The module as rasterizable footprints -------------------------------
  // Each mesh: its translated z-need [z0m, z1m] plus either its box corners
  // (rotated with the module) or, for the gong arc, its vertex cloud.
  const DROP = TQ_TOP - 0; // the descent: plate top face -> base plate top face
  const modMeshes = all.filter((m) => MODULE.includes(m.unit) && m.bb.min.z > TQ_TOP - 0.6);
  const footprints = modMeshes.map((m) => {
    const z0 = m.bb.min.z - DROP, z1 = m.bb.max.z - DROP;
    if (m.unit === 'Alarm gong' && /Torus/.test(m.mesh)) {
      const pos = m.obj.geometry.attributes.position;
      const v = new THREE.Vector3();
      const pts = [];
      for (let i = 0; i < pos.count; i += 4) {
        v.fromBufferAttribute(pos, i).applyMatrix4(m.obj.matrixWorld);
        pts.push([v.x, v.y]);
      }
      return { unit: m.unit, mesh: m.mesh, z0, z1, pts };
    }
    return {
      unit: m.unit, mesh: m.mesh, z0, z1,
      corners: [[m.bb.min.x, m.bb.min.y], [m.bb.max.x, m.bb.min.y], [m.bb.max.x, m.bb.max.y], [m.bb.min.x, m.bb.max.y]],
    };
  });

  const rotPt = (p, c, s) => [p[0] * c - p[1] * s, p[0] * s + p[1] * c];
  // cells covered by a convex quadrilateral, via its own bounding box + a
  // point-in-quad test at each cell centre (cells are small vs the quads)
  const quadCells = (q) => {
    const xs = q.map((p) => p[0]), ys = q.map((p) => p[1]);
    const i0 = Math.max(0, Math.floor((Math.min(...xs) + plateR) / step));
    const i1 = Math.min(N - 1, Math.floor((Math.max(...xs) + plateR) / step));
    const j0 = Math.max(0, Math.floor((Math.min(...ys) + plateR) / step));
    const j1 = Math.min(N - 1, Math.floor((Math.max(...ys) + plateR) / step));
    const inside = (x, y) => {
      let sgn = 0;
      for (let k = 0; k < 4; k++) {
        const a = q[k], b = q[(k + 1) % 4];
        const cr = (b[0] - a[0]) * (y - a[1]) - (b[1] - a[1]) * (x - a[0]);
        if (cr !== 0) { if (sgn === 0) sgn = Math.sign(cr); else if (Math.sign(cr) !== sgn) return false; }
      }
      return true;
    };
    const cells = [];
    for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) {
      const cx = -plateR + (i + 0.5) * step, cy = -plateR + (j + 0.5) * step;
      // cover the cell if its centre OR the quad's own box corner falls in it;
      // half-cell dilation keeps thin quads from slipping between centres
      if (inside(cx, cy) || inside(cx + step / 2, cy) || inside(cx - step / 2, cy)
        || inside(cx, cy + step / 2) || inside(cx, cy - step / 2)) cells.push(j * N + i);
    }
    return cells;
  };

  // --- The search ----------------------------------------------------------
  // TWO placement variables, both position-space:
  //  · rot — the §33 module rotation about the movement centre;
  //  · h   — a LIFT: the plate-grounded studs lengthen downward and the whole
  //    works rides h above its planted pose. The under-plate volume is busy
  //    at the FLOOR (rods and keyless, 0..~1.9) and at the CEILING (the
  //    fourth wheel and hairspring planes, 6.5..7.5) and free between, and
  //    the stack has TQ_BOT − MARGIN − stackTop of ceiling slack — so the
  //    lift is where a fit lives if one exists. Stud meshes (the members
  //    whose bottoms are the planted embeds) keep z0 = 0 at any lift: they
  //    run floor-to-top by construction.
  const overlaps = (ints, z0, z1) => {
    if (!ints) return null;
    for (const [a, b, tag] of ints) if (a < z1 + MARGIN && b > z0 - MARGIN) return tag || 'hit';
    return null;
  };
  const isStud = (fp) => fp.z0 < 0; // planted embed: bottom below the old face
  const stackTop = Math.max(...footprints.map((fp) => fp.z1));
  const H_MAX = TQ_BOT - MARGIN - stackTop;
  const rasterize = (rotDeg) => {
    const c = Math.cos(rotDeg * Math.PI / 180), s = Math.sin(rotDeg * Math.PI / 180);
    return footprints.map((fp) => {
      let cells;
      if (fp.pts) {
        const set = new Set();
        for (const p of fp.pts) {
          const r = rotPt(p, c, s);
          const i = Math.floor((r[0] + plateR) / step), j = Math.floor((r[1] + plateR) / step);
          if (i >= 0 && i < N && j >= 0 && j < N) set.add(j * N + i);
        }
        cells = [...set];
      } else {
        cells = quadCells(fp.corners.map((p) => rotPt(p, c, s)));
      }
      return { fp, cells };
    });
  };
  const tryLift = (field, raster, h, collect) => {
    const hits = [];
    let pillarHit = false;
    for (const { fp, cells } of raster) {
      const z0 = isStud(fp) ? 0 : fp.z0 + h;
      const z1 = fp.z1 + h;
      for (const cell of cells) {
        const i = cell % N, j = (cell - i) / N;
        const cx = -plateR + (i + 0.5) * step, cy = -plateR + (j + 0.5) * step;
        if (Math.hypot(cx, cy) > plateR - MARGIN) { hits.push(`${fp.unit}/${fp.mesh} off the rim`); return { ok: false, hits }; }
        const tag = overlaps(field[cell], z0, z1);
        if (tag) {
          hits.push(`${fp.unit}/${fp.mesh} z ${f(z0)}..${f(z1)} vs ${tag} at (${f(cx)}, ${f(cy)})`);
          if (!collect || hits.length > 3) return { ok: false, hits };
        }
        if (!pillarHit && overlaps(pillarField[cell], z0, z1)) pillarHit = true;
      }
    }
    return { ok: hits.length === 0, hits, pillarHit };
  };

  out.push(`plate band ${f(TQ_BOT)}..${f(TQ_TOP)}; drop ${f(DROP)}; module meshes ${footprints.length}; grid ${N} (cell ${f(step)})`);
  out.push(`stack top after drop ${f(stackTop)}; ceiling ${f(TQ_BOT - MARGIN)}; lift range 0..${f(H_MAX)}`);
  out.push(`drum synthesized at CD ${f(DRUM_CD)} r ${f(DRUM_R)}; set-up r ${f(SETUP_R)}`);
  const H_STEP = 0.05;
  for (const drumAz of [45, 51, 56]) {
    const field = buildField([...baseObstacles, ...departedAt(drumAz)]);
    const feasible = [];  // { rot, h0, h1, pillar } — the lift window per rotation
    for (let rot = 0; rot < 360; rot += 1) {
      const raster = rasterize(rot);
      let h0 = null, h1 = null, pillar = false;
      for (let h = 0; h <= H_MAX + 1e-9; h += H_STEP) {
        const r = tryLift(field, raster, h, false);
        if (r.ok) { if (h0 === null) h0 = h; h1 = h; pillar ||= r.pillarHit; }
      }
      if (h0 !== null) feasible.push({ rot, h0, h1, pillar });
    }
    out.push(`=== drum at ${drumAz} deg: ${feasible.length}/360 module rotations fit at some lift ===`);
    let run = null; const runs = [];
    for (const p of feasible) {
      if (run && p.rot === run.b + 1) { run.b = p.rot; run.h0 = Math.min(run.h0, p.h0); run.h1 = Math.max(run.h1, p.h1); run.pillar ||= p.pillar; }
      else { if (run) runs.push(run); run = { a: p.rot, b: p.rot, h0: p.h0, h1: p.h1, pillar: p.pillar }; }
    }
    if (run) runs.push(run);
    for (const r of runs)
      out.push(`  rot ${String(r.a).padStart(3)}..${String(r.b).padStart(3)}  lift ${f(r.h0)}..${f(r.h1)}${r.pillar ? '  (re-seats a pillar)' : ''}`);
    if (!feasible.length) {
      // the diagnosis: the FIRST blocker at max lift, per rotation, as a
      // histogram — which obstacle owns the refusal around the circle
      const hist = new Map();
      for (let rot = 0; rot < 360; rot += 5) {
        const r = tryLift(field, rasterize(rot), H_MAX, false);
        const key = r.hits[0] ? r.hits[0].replace(/ at \(.*/, '') : 'none';
        hist.set(key, (hist.get(key) || 0) + 1);
      }
      for (const [k, n] of [...hist].sort((a, b) => b[1] - a[1]))
        out.push(`  ${String(n).padStart(3)}/72 rotations first-blocked by: ${k}`);
      // THE FOLD BUDGET. A refusal by lift alone is not yet a refusal by
      // position space: strata are a fold currency (CLAUDE.md, "Design in a
      // line, fold to fit"), so the honest number to leave behind is how
      // much SHORTER the module's stack would have to fold to fit. For each
      // rotation, ignore the ceiling and find the smallest lift at which
      // nothing below binds; the deficit is how far the lifted stack then
      // overshoots the plate's underside. min(deficit) over rotations is
      // the compression a re-fold must find — 0 means lift alone suffices.
      let best = null;
      for (let rot = 0; rot < 360; rot += 1) {
        const raster = rasterize(rot);
        for (let h = 0; h <= 3 + 1e-9; h += H_STEP) {
          const r = tryLift(field, raster, h, false);
          if (r.ok) {
            const deficit = Math.max(0, stackTop + h - (TQ_BOT - MARGIN));
            if (!best || deficit < best.deficit) best = { rot, h, deficit };
            break;
          }
          // hits that a lift can never fix (mid-band and full-height
          // columns) end this rotation: raising further only adds ceiling
          const fixable = r.hits.every((t) => / vs (Hack rod|Reset rod|Keyless works|Setting lever|Alarm crown)\//.test(t));
          if (!fixable) break;
        }
      }
      out.push(best
        ? `  FOLD BUDGET: best rotation ${best.rot} clears everything below at lift ${f(best.h)} — stack overshoots the ceiling by ${f(best.deficit)}; the module must fold ${f(best.deficit)} shorter to fit there`
        : '  FOLD BUDGET: no rotation clears the under-plate band at any lift ≤ 3 — the refusal is in plan, not height');
    }
  }
  return out;
});
console.log(res.join('\n'));
await browser.close();
srv.kill();
