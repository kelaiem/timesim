// THE LUGS, READ OFF THE METAL — the derived radial chain held to layout.js's
// declaration, and the §190 wrap gap measured off the analytic bar surface.
//
// ACCEPTANCE (exit 2 on failure). §190 moved the whole lug/bar stock into
// layout.js (CASE_LUG_T/ROOT, CASE_SPRING_BAR_D, CASE_STRAP_CLEAR →
// CASE_BAR_REACH → CASE_LUG_REACH, and since §280 caseLugPlan), so this probe imports that one
// declaration instead of hand-copying it — the pre-§190 copy (`1.7 mm`) is
// exactly the drift this file existed to tripwire, and now cannot drift
// because it does not exist. What is still held: the METAL must present the
// declaration (a builder literal reintroduced beside the constants would
// part them again).
//
// Reads and their controls:
// 1. Across-the-tips: a CALLIPER read along the pair axis (NOT 2×max vertex
//    radius — the lug corners reach ~5 u further; this probe's first cut
//    made that error and the comment at the read keeps the warning), vs
//    2×(CASE_WIDTH_MAX + CASE_LUG_REACH).
// 2. Interior lug distance (the strap purchase dimension) vs the 20 mm
//    the owner's strap width (STRAP_MM_DEFAULT; 2026-08-31's 20 mm sat ON CASE_LUG_SPAN_MAX, the 2026-11-01 19 mm stands under it).
// 3. §190 WRAP GAP: minimum distance from each bar's ANALYTIC surface (axis
//    segment + radius) to every case mesh that is not a lug, held to
//    CASE_STRAP_CLEAR. The bar side must be analytic because a cylinder's
//    vertices sit only on its end rings — the vertex list's nearest sample
//    reads 60.5 u where the true near surface is 54.5 u (the instruments
//    skill's "vertices mistaken for the surface" trap, measured live in
//    this probe's own old per-bar rMin). The case side is triangles, exact
//    for the flat faces and conservative-by-sagitta for the faceted band.
//    CONTROL (§280): the same machinery pointed at the LUGS along the tip
//    pin's own axis, inside its drilled hole, must read the hole wall one
//    CLEAR_MARGIN off the pin — the clearance it is drilled to. (§190's
//    control read the bar body's abutment at ≈ −bar radius; a drilled lug
//    puts air on the axis there.) The bar is a hollow TUBE and the tip pins
//    are their own meshes (caseSpringBarTip) in its bore, read about the
//    tube's fitted axis: two per bar. The axis and circle fit take the tube's
//    OUTER ring only (a closed lathe profile repeats a point, so its two
//    ends do not share a seam bias), and the segment is centred on the axial
//    extent, not the centroid.
// 4. §280 THE BACK PLANE: the lug's lowest metal at or above the case back's
//    face — §261's ratchet measures the case WITH its lugs — and the bar's
//    height above that plane, the number the downturn exists to lower.
// 5. §280 THE SECTION off the metal: T across the strap and W across the
//    end's centre, against layout.js's caseLugPlan (read off the case's own
//    userData, so the probe holds the metal to the plan the build used).
// 6. §280 THE LOAD ROWS: root bending, tear-out behind the pin and bearing
//    in the hole, each held under its yield. Since TODO 262 the root is held
//    under EVERY alloy the case may be cut from (CASE_ALLOY_SIGMA_Y — the lug
//    is sized to the weakest, since the alloy is a finish and cannot move
//    geometry), and printed against steel's guaranteed minimum too.
//
// What this is NOT: no other instrument touches the lugs at all.
//
// Run: node tools/probe-lug-geom.mjs   (ROOT= for another worktree — note
// the layout constants come from the checkout BESIDE this probe, so point
// ROOT elsewhere only to compare that build's metal against THIS tree's
// declaration.)
import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { UNIT_MM, CASE_WIDTH_MAX, CASE_LUG_SPAN_MAX, STRAP_MM_DEFAULT, CASE_LUG_REACH,
         CASE_STRAP_CLEAR, CASE_SPRING_BAR_D, CASE_LUG_T, CASE_LUG_EDGE_R,
         CASE_LUG_HOLE_D, CASE_SPRING_BAR_TIP_D, CLEAR_MARGIN, caseLugPlan } from '../src/layout.js';
const ROOT = process.env.ROOT || join(dirname(fileURLToPath(import.meta.url)), '..');
const srv = spawn('python3', ['-m', 'http.server', '8516', '--bind', '127.0.0.1'], { cwd: ROOT, stdio: 'ignore' });
await new Promise((r) => setTimeout(r, 1200));
const browser = await chromium.launch();
const page = await browser.newPage();
page.on('pageerror', (e) => console.log('PAGEERROR', String(e)));
await page.goto('http://127.0.0.1:8516/index.html', { waitUntil: 'load', timeout: 120000 });
await page.waitForFunction(() => !!window.__clock, null, { timeout: 120000 });

const res = await page.evaluate(async ({ T, rc }) => {
  const THREE = await import('three');
  const clock = window.__clock;
  const v = new THREE.Vector3();
  const lugs = [], bars = [], tips = [], caseMeshes = [];
  clock.scene.traverse((o) => {
    if (o.name === 'caseLug') lugs.push(o);
    else if (o.name === 'caseSpringBar') bars.push(o);
    else if (o.name === 'caseSpringBarTip') tips.push(o);
    else if (o.isMesh && o.userData.casePart) caseMeshes.push(o);
  });
  const ext = (o) => {
    o.updateWorldMatrix(true, true);
    const p = o.geometry.attributes.position;
    let rMin = Infinity, rMax = 0, zMin = Infinity, zMax = -Infinity;
    const pts = [];
    for (let i = 0; i < p.count; i++) {
      o.localToWorld(v.fromBufferAttribute(p, i));
      const r = Math.hypot(v.x, v.y);
      rMin = Math.min(rMin, r); rMax = Math.max(rMax, r);
      zMin = Math.min(zMin, v.z); zMax = Math.max(zMax, v.z);
      pts.push([v.x, v.y, v.z]);
    }
    return { rMin, rMax, zMin, zMax, pts };
  };
  const L = lugs.map(ext), B = bars.map(ext);
  // Across-the-tips is a CALLIPER read: the span ALONG the lug pair's own
  // axis, jaws flat on the two tip faces. It is NOT 2×max radius — the lug is
  // a box standing off its pair axis by the strap half-span, so its outer
  // CORNERS reach further radially than the tip FACES sit along the axis;
  // the first cut of this probe read the corner and disagreed with the old
  // assert by 11.5 u, which was this probe's error and is why this comment
  // exists. Recover the pair axis from the metal: the two lugs of a pair
  // stand at ±(strap half-span) across it, so the MEAN of their centroids
  // cancels the offsets and points along the axis.
  const centroid = (l) => {
    let x = 0, y = 0;
    for (const [px, py] of l.pts) { x += px; y += py; }
    return [x / l.pts.length, y / l.pts.length];
  };
  const cs = L.map(centroid);
  let ax = 0, ay = 0;
  for (const [x, y] of cs) { const s = (x * cs[0][0] + y * cs[0][1]) >= 0 ? 1 : -1; ax += s * x; ay += s * y; }
  const n = Math.hypot(ax, ay); ax /= n; ay /= n;
  let tipsAcross = 0;
  for (const l of L) for (const [px, py] of l.pts) tipsAcross = Math.max(tipsAcross, Math.abs(px * ax + py * ay));
  tipsAcross *= 2;
  // INTERIOR distance per pair: project each lug's vertices onto the STRAP
  // axis (the pair axis's perpendicular — the direction the spring bar
  // runs); the interior is the gap between the two facing extremes. The
  // same read of the metal a strap maker's calliper takes.
  const sxA = -ay, syA = ax;
  const interiors = [];
  for (const sign of [1, -1]) {
    const pair = [];
    for (let i = 0; i < L.length; i++)
      if ((cs[i][0] * ax + cs[i][1] * ay) * sign > 0) pair.push(i);
    if (pair.length !== 2) { interiors.push({ error: `pair of ${pair.length}` }); continue; }
    const proj = (i) => L[pair[i]].pts.map(([px, py]) => px * sxA + py * syA);
    const [pa, pb] = [proj(0), proj(1)];
    const [pos, neg] = (cs[pair[0]][0] * sxA + cs[pair[0]][1] * syA) > 0 ? [pa, pb] : [pb, pa];
    interiors.push({ inner: Math.min(...pos) - Math.max(...neg) });
  }

  // §190 WRAP GAP — the bar as its ANALYTIC surface. Recover each bar's
  // axis segment and radius from its vertices (safe for the AXIS: the end
  // rings define the line exactly; it is only the near SURFACE the vertex
  // list cannot present), then hold min(distance(axis, case triangles)) −
  // radius. Distances are sampled along the axis at a pitch far under the
  // gap being judged, so the sampling error is second-order.
  const V = (a) => new THREE.Vector3(a[0], a[1], a[2]);
  const barAnalytic = (b) => {
    const c = new THREE.Vector3();
    for (const p of b.pts) c.add(V(p));
    c.multiplyScalar(1 / b.pts.length);
    // Axis DIRECTION: the difference of the two end-cluster centroids. A
    // folded vector sum is BIASED here — CylinderGeometry's UV seam
    // duplicates one azimuth, so each ring's radial parts do not cancel;
    // but the seam offset is identical at both ends (same ring,
    // translated), so it cancels in cA − cB exactly. Seeded by the
    // farthest-vertex direction, which only has to get the SPLIT right.
    const seed = b.pts.reduce((best, p) => {
      const d = V(p).sub(c);
      return d.lengthSq() > best.lengthSq() ? d : best;
    }, new THREE.Vector3()).normalize();
    const cA = new THREE.Vector3(), cB = new THREE.Vector3();
    let nA = 0, nB = 0;
    for (const p of b.pts) {
      const d = V(p).sub(c);
      if (d.dot(seed) >= 0) { cA.add(V(p)); nA++; } else { cB.add(V(p)); nB++; }
    }
    cA.multiplyScalar(1 / nA); cB.multiplyScalar(1 / nB);
    let axis = cA.clone().sub(cB).normalize();
    // §280: the bar is a TUBE now, a lathe whose closed profile repeats a
    // point at one end, so the two ends carry different vertex mixes and the
    // seam bias no longer cancels in cA − cB: the axis read tilted, every
    // radius about it 0.005 u long. Re-take the direction from the OUTER
    // ring's vertices alone, which are the same ring at both ends.
    {
      const radial = (p) => { const d = V(p).sub(c); const t = d.dot(axis); return Math.sqrt(Math.max(d.lengthSq() - t * t, 0)); };
      const rOut = Math.max(...b.pts.map(radial));
      const outer = b.pts.filter((p) => radial(p) > 0.8 * rOut);
      const oA = new THREE.Vector3(), oB = new THREE.Vector3();
      let mA = 0, mB = 0;
      for (const p of outer) {
        if (V(p).sub(c).dot(axis) >= 0) { oA.add(V(p)); mA++; } else { oB.add(V(p)); mB++; }
      }
      if (mA && mB) axis = oA.multiplyScalar(1 / mA).sub(oB.multiplyScalar(1 / mB)).normalize();
    }
    // Axis POINT: the vertex centroid carries the same seam bias (measured
    // 0.104 u off-axis — the first cut of this read used it and recovered
    // r = 2.083 for a 1.979 bar), so the centre comes from a Kåsa circle
    // fit of the ring vertices' perpendicular projections instead — exact
    // for on-circle data; the on-axis cap-centre vertices are excluded by
    // rough radius.
    const u1 = (Math.abs(axis.x) < 0.9 ? new THREE.Vector3(1, 0, 0) : new THREE.Vector3(0, 1, 0));
    u1.addScaledVector(axis, -u1.dot(axis)).normalize();
    const u2 = axis.clone().cross(u1);
    const proj = b.pts.map((p) => {
      const d = V(p).sub(c);
      return { t: d.dot(axis), a: d.dot(u1), b: d.dot(u2) };
    });
    const rRough = Math.max(...proj.map((p) => Math.hypot(p.a, p.b)));
    // The OUTER ring only: since §280 the bar is a TUBE, and a Kåsa fit over
    // two concentric rings is biased by the lathe's duplicated seam column
    // (exact for one circle, not for two) — it read the wrap gap 0.007 mm
    // short and the hole control 0.04 u off. The bore sits at 0.61 of the
    // outer radius.
    const ring = proj.filter((p) => Math.hypot(p.a, p.b) > 0.8 * rRough);
    let Saa = 0, Sab = 0, Sa = 0, Sbb = 0, Sb = 0, N = 0, Sar = 0, Sbr = 0, Sr = 0;
    for (const { a, b: bb } of ring) {
      const r2 = a * a + bb * bb;
      Saa += a * a; Sab += a * bb; Sa += a; Sbb += bb * bb; Sb += bb; N++;
      Sar += a * r2; Sbr += bb * r2; Sr += r2;
    }
    const M = [[Saa, Sab, Sa], [Sab, Sbb, Sb], [Sa, Sb, N]], rhs = [-Sar, -Sbr, -Sr];
    for (let i = 0; i < 3; i++) for (let j = i + 1; j < 3; j++) {
      const f = M[j][i] / M[i][i];
      for (let k = i; k < 3; k++) M[j][k] -= f * M[i][k];
      rhs[j] -= f * rhs[i];
    }
    const sol = [0, 0, 0];
    for (let i = 2; i >= 0; i--) {
      let s = rhs[i];
      for (let k = i + 1; k < 3; k++) s -= M[i][k] * sol[k];
      sol[i] = s / M[i][i];
    }
    const cx = -sol[0] / 2, cy = -sol[1] / 2;
    const centre = c.clone().addScaledVector(u1, cx).addScaledVector(u2, cy);
    // The segment is centred on the vertices' AXIAL EXTENT, not their
    // centroid: since §280 the bar is a lathe whose closed profile repeats a
    // point, so its vertices crowd one end and the centroid sat 5.28 u along
    // the axis — measured from there, the read segment ran 10.6 u past the
    // tube's far end, into the lug.
    let tLo = Infinity, tHi = -Infinity, r = 0;
    for (const p of b.pts) {
      const d = V(p).sub(centre);
      const t = d.dot(axis);
      tLo = Math.min(tLo, t); tHi = Math.max(tHi, t);
      r = Math.max(r, Math.sqrt(Math.max(d.lengthSq() - t * t, 0)));
    }
    centre.addScaledVector(axis, (tLo + tHi) / 2);
    const h = (tHi - tLo) / 2;
    // §280: the tip pins are their own meshes, on the bar's axis past each
    // end — their radius read about the BAR's fitted axis, which is what
    // makes "the pin is coaxial with the tube" part of the read.
    let rTip = 0, nTip = 0;
    for (const tm of tips) {
      tm.updateWorldMatrix(true, true);
      const tp = tm.geometry.attributes.position;
      let near = false; const loc = [];
      for (let i = 0; i < tp.count; i++) {
        const d = tm.localToWorld(new THREE.Vector3().fromBufferAttribute(tp, i)).sub(centre);
        const t = d.dot(axis);
        const rr = Math.sqrt(Math.max(d.lengthSq() - t * t, 0));
        if (rr < 2 * r) near = true;
        loc.push(rr);
      }
      if (!near) continue;
      nTip++; rTip = Math.max(rTip, ...loc);
    }
    return { c: centre, axis, h, r, rTip, nTip };
  };
  // Closest point on triangle (Ericson, Real-Time Collision Detection).
  const closestOnTri = (p, a, b, c, out) => {
    const ab = b.clone().sub(a), ac = c.clone().sub(a), ap = p.clone().sub(a);
    const d1 = ab.dot(ap), d2 = ac.dot(ap);
    if (d1 <= 0 && d2 <= 0) return out.copy(a);
    const bp = p.clone().sub(b), d3 = ab.dot(bp), d4 = ac.dot(bp);
    if (d3 >= 0 && d4 <= d3) return out.copy(b);
    const vc = d1 * d4 - d3 * d2;
    if (vc <= 0 && d1 >= 0 && d3 <= 0) return out.copy(a).addScaledVector(ab, d1 / (d1 - d3));
    const cp = p.clone().sub(c), d5 = ab.dot(cp), d6 = ac.dot(cp);
    if (d6 >= 0 && d5 <= d6) return out.copy(c);
    const vb = d5 * d2 - d1 * d6;
    if (vb <= 0 && d2 >= 0 && d6 <= 0) return out.copy(a).addScaledVector(ac, d2 / (d2 - d6));
    const va = d3 * d6 - d5 * d4;
    if (va <= 0 && (d4 - d3) >= 0 && (d5 - d6) >= 0)
      return out.copy(b).addScaledVector(c.clone().sub(b), (d4 - d3) / ((d4 - d3) + (d5 - d6)));
    const denom = 1 / (va + vb + vc);
    return out.copy(a).addScaledVector(ab, vb * denom).addScaledVector(ac, vc * denom);
  };
  // min distance from an axis segment (SAMPLES points along it) to a mesh
  // set's triangles; a vertex prepass bounds which triangles matter.
  const segToMeshes = (bar, meshes, samples = 256) => {
    const pts = [];
    for (let i = 0; i <= samples; i++)
      pts.push(bar.c.clone().addScaledVector(bar.axis, -bar.h + (2 * bar.h * i) / samples));
    let best = Infinity, bestMesh = null;
    const q = new THREE.Vector3(), out = new THREE.Vector3();
    const ta = new THREE.Vector3(), tb = new THREE.Vector3(), tc = new THREE.Vector3();
    for (const m of meshes) {
      m.updateWorldMatrix(true, true);
      const pos = m.geometry.attributes.position;
      const idx = m.geometry.index;
      // vertex prepass: nearest vertex to any sample = upper bound; then
      // only triangles carrying a vertex within (bound + slack) are tested.
      const world = [];
      let ub = Infinity;
      for (let i = 0; i < pos.count; i++) {
        m.localToWorld(q.fromBufferAttribute(pos, i));
        world.push(q.clone());
        for (const p of pts) ub = Math.min(ub, p.distanceTo(q));
      }
      const slack = ub + 3;
      const near = world.map((w) => {
        for (const p of pts) if (p.distanceTo(w) < slack) return true;
        return false;
      });
      const triCount = idx ? idx.count / 3 : pos.count / 3;
      for (let t = 0; t < triCount; t++) {
        const i0 = idx ? idx.getX(3 * t) : 3 * t;
        const i1 = idx ? idx.getX(3 * t + 1) : 3 * t + 1;
        const i2 = idx ? idx.getX(3 * t + 2) : 3 * t + 2;
        if (!near[i0] && !near[i1] && !near[i2]) continue;
        ta.copy(world[i0]); tb.copy(world[i1]); tc.copy(world[i2]);
        for (const p of pts) {
          const d = p.distanceTo(closestOnTri(p, ta, tb, tc, out));
          if (d < best) { best = d; bestMesh = m.name; }
        }
      }
    }
    return { dist: best, mesh: bestMesh };
  };
  const wrap = bars.map((_, i) => {
    const bar = barAnalytic(B[i]);
    const toCase = segToMeshes(bar, caseMeshes);
    // CONTROL (§280) — the same machinery pointed at the LUGS, along the tip
    // pin's own axis where it runs in its drilled hole (clear of the edge
    // breaks at both faces): it must read the hole wall one CLEAR_MARGIN off
    // the pin, which is the clearance the hole is drilled to. A read that
    // cannot see that wall is not measuring distance. (Pre-§280 the control
    // read the body's abutment, ≈ −barR; a drilled lug puts air on the axis
    // there.)
    const tipSeg = { c: bar.c.clone().addScaledVector(bar.axis, bar.h + T / 2), axis: bar.axis, h: T / 2 - rc - 0.05 };
    const toHole = segToMeshes(tipSeg, lugs, 64);
    return {
      barR: bar.r, tipR: bar.rTip, nTip: bar.nTip, barZ: bar.c.z,
      gap: toCase.dist - bar.r, governs: toCase.mesh,
      holeGap: toHole.dist - bar.rTip,
    };
  });
  // The SECTION read off the metal (§280): the lug's height W across its
  // end's centre (the plan's uC), and its thickness T along the strap axis.
  // A section read at the end and the declared T across the whole body are
  // what the outline law promises are constant along the path.
  let backMax = -Infinity;
  for (const m of caseMeshes) if (m.name === 'caseBack') {
    const bb = new THREE.Box3().setFromObject(m); backMax = Math.max(backMax, bb.max.z);
  }
  const sections = L.map((l) => {
    const along = l.pts.map(([px, py, pz]) => [Math.abs(px * ax + py * ay), pz, px * -ay + py * ax]);
    const uMax = Math.max(...along.map((q) => q[0]));
    const thick = Math.max(...along.map((q) => q[2])) - Math.min(...along.map((q) => q[2]));
    return { uMax, thick, zMax: l.zMax, along };
  });
  let caseG = null; clock.scene.traverse((o) => { if (o.name === 'case') caseG = o; });
  const plans = (caseG?.userData.lugPlans ?? []).map((pl) => ({ W: pl.W, uC: pl.uC, zB: pl.zB, zR: pl.zR, alpha: pl.alpha, rows: pl.rows, warn: pl.warn }));
  return {
    plans, backMax,
    sectionPts: sections.map((sx) => ({ thick: sx.thick, zMax: sx.zMax, pts: sx.along.map((q) => [q[0], q[1]]) })),
    nLugs: lugs.length, nBars: bars.length, nCase: caseMeshes.length,
    caseNames: [...new Set(caseMeshes.map((m) => m.name))],
    lugR: L.map((l) => ({ rMin: +l.rMin.toFixed(4), rMax: +l.rMax.toFixed(4), zMin: +l.zMin.toFixed(3), zMax: +l.zMax.toFixed(3) })),
    barR: B.map((b) => ({ rMin: +b.rMin.toFixed(4), rMax: +b.rMax.toFixed(4), zMin: +b.zMin.toFixed(3), zMax: +b.zMax.toFixed(3) })),
    tipsAcross, interiors, wrap,
  };
}, { T: CASE_LUG_T, rc: CASE_LUG_EDGE_R });

const MM = UNIT_MM;
let ok = true;
console.log(`lugs ${res.nLugs}, spring bars ${res.nBars}, case meshes ${res.nCase}`);
for (const l of res.lugR) console.log(`  lug  r ${l.rMin}..${l.rMax}  z ${l.zMin}..${l.zMax}`);
for (const b of res.barR) console.log(`  bar  r ${b.rMin}..${b.rMax}  z ${b.zMin}..${b.zMax}`);

// 1. Across-the-tips vs the DECLARED chain (one source: layout.js).
const declaredTips = 2 * (CASE_WIDTH_MAX + CASE_LUG_REACH);
console.log(`\nacross the lug tips MEASURED: ${res.tipsAcross.toFixed(4)} u = ${(res.tipsAcross * MM).toFixed(3)} mm`);
console.log(`declared (2×(CASE_WIDTH_MAX + CASE_LUG_REACH)): ${declaredTips.toFixed(4)} u = ${(declaredTips * MM).toFixed(3)} mm`);
const drift = Math.abs(res.tipsAcross - declaredTips);
if (drift > 0.02) { ok = false; console.log(`CONTROL FAIL: the metal and layout.js's chain disagree by ${drift.toFixed(4)} u — a builder literal has parted from the declaration`); }
else console.log(`CONTROL PASS: the metal presents the declared chain (drift ${drift.toFixed(4)} u)`);

// 2. Interior lug distance vs the owner's strap width (STRAP_MM_DEFAULT, 19 mm since 2026-11-01; it sat ON the 20 mm cap before and
//    now stands under it, which the cap check here holds separately).
const STRAP_SPEC = STRAP_MM_DEFAULT / UNIT_MM;
if (STRAP_SPEC > CASE_LUG_SPAN_MAX + 1e-9) { ok = false; console.log(`CAP FAIL: the default strap ${STRAP_MM_DEFAULT} mm is past the ${(CASE_LUG_SPAN_MAX * MM).toFixed(0)} mm cap`); }
for (const it of res.interiors) {
  if (it.error) { ok = false; console.log(`INTERIOR FAIL: ${it.error} — could not pair the lugs`); continue; }
  const d = Math.abs(it.inner - STRAP_SPEC);
  console.log(`interior lug distance MEASURED: ${it.inner.toFixed(4)} u = ${(it.inner * MM).toFixed(3)} mm  (spec ${(STRAP_SPEC * MM).toFixed(0)} mm, drift ${d.toFixed(4)} u)`);
  if (d > 0.02) { ok = false; console.log(`INTERIOR FAIL: the metal does not present the ${(STRAP_SPEC * MM).toFixed(0)} mm strap spec`); }
}

// 3. §190 wrap gap, off the analytic bar surface, vs CASE_STRAP_CLEAR.
const barRDecl = CASE_SPRING_BAR_D / 2;
for (const w of res.wrap) {
  console.log(`\nwrap gap MEASURED: ${w.gap.toFixed(4)} u = ${(w.gap * MM).toFixed(3)} mm  (spec ≥ ${(CASE_STRAP_CLEAR * MM).toFixed(1)} mm, governed by ${w.governs})`);
  if (Math.abs(w.barR - barRDecl) > 0.02) { ok = false; console.log(`WRAP FAIL: recovered bar radius ${w.barR.toFixed(4)} u does not match CASE_SPRING_BAR_D/2 = ${barRDecl.toFixed(4)} u — the axis fit read something that is not the bar`); }
  if (w.gap < CASE_STRAP_CLEAR - 0.02) { ok = false; console.log(`WRAP FAIL: a strap thicker than ${(w.gap * MM).toFixed(2)} mm cannot wrap this bar — the case metal is inside the ${(CASE_STRAP_CLEAR * MM).toFixed(1)} mm envelope`); }
  // CONTROL (§280): the tip pin in its drilled hole must read the hole wall
  // one CLEAR_MARGIN off (the hole's drilled clearance), to the hole's facet
  // sagitta. A clean wrap number with a dead control is a probe reading nothing.
  const tipRDecl = CASE_SPRING_BAR_TIP_D / 2, holeGapDecl = CASE_LUG_HOLE_D / 2 - tipRDecl;
  if (w.nTip !== 2) { ok = false; console.log(`WRAP FAIL: ${w.nTip} tip pins on this bar's axis (expected 2)`); }
  if (Math.abs(w.tipR - tipRDecl) > 0.02) { ok = false; console.log(`WRAP FAIL: recovered tip radius ${w.tipR.toFixed(4)} u, declared ${tipRDecl.toFixed(4)} u`); }
  if (Math.abs(w.holeGap - holeGapDecl) > 0.02) { ok = false; console.log(`WRAP CONTROL FAIL: the tip pin reads ${w.holeGap.toFixed(4)} u off its hole wall, drilled at ${holeGapDecl.toFixed(4)} — the distance machinery is not seeing the hole that exists`); }
  else console.log(`wrap CONTROL PASS: the tip pin reads ${w.holeGap.toFixed(4)} u off its hole wall (drilled at CLEAR_MARGIN = ${holeGapDecl.toFixed(4)})`);
}
if (res.nCase < 3) { ok = false; console.log(`WRAP CONTROL FAIL: only ${res.nCase} case meshes enrolled (${res.caseNames.join(', ')}) — the gap was measured against too little metal`); }


// 4. §280 — WHERE THE STRAP LEAVES, and the back plane the lug may not pass.
// The §261 height ratchet measures the case WITH its lugs, so the lug's
// lowest metal at or above the back plane is what keeps the cased depth
// where it is; the bar's height above that plane is the wearability number.
console.log('');
if (!(res.plans.length === 2)) { ok = false; console.log(`PLAN FAIL: ${res.plans.length} lug plans on the case (expected one per pair)`); }
for (const pl of res.plans) for (const w of pl.warn) { ok = false; console.log(`PLAN FAIL: ${w}`); }
const back = res.backMax;
for (const sx of res.sectionPts) {
  if (sx.zMax > back + 1e-6) { ok = false; console.log(`BACK FAIL: a lug reaches ${((sx.zMax - back) * MM).toFixed(4)} mm past the back plane — the cased depth grows`); }
}
console.log(`lowest lug metal ${((back - Math.max(...res.sectionPts.map((s) => s.zMax))) * MM).toFixed(4)} mm above the back plane (≥ 0 holds the §261 ratchet)`);
for (const w of res.wrap)
  console.log(`spring bar centre ${((back - w.barZ) * MM).toFixed(3)} mm above the back plane (§190's flat lug: 4.093) — where the strap leaves the case`);

// 5. §280 — THE SECTION off the metal: T across the strap, W across the
// end's centre, both against the plan. The outline is one band of constant
// width round its centreline, so the end's height and the declared T are
// the section everywhere.
const pl0 = res.plans[0];
for (const sx of res.sectionPts) {
  const dT = Math.abs(sx.thick - CASE_LUG_T);
  const atC = sx.pts.filter(([u]) => Math.abs(u - pl0.uC) < 0.05).map(([, z]) => z);
  const Wm = atC.length ? Math.max(...atC) - Math.min(...atC) : NaN;
  console.log(`section MEASURED: T ${(sx.thick * MM).toFixed(4)} mm (declared ${(CASE_LUG_T * MM).toFixed(4)}), W at the end ${(Wm * MM).toFixed(4)} mm (solved ${(pl0.W * MM).toFixed(4)})`);
  if (dT > 0.01) { ok = false; console.log(`SECTION FAIL: the lug is not CASE_LUG_T thick`); }
  if (!(Math.abs(Wm - pl0.W) < 0.05)) { ok = false; console.log(`SECTION FAIL: the lug's end is not the solved W`); }
}

// 6. §280 — THE LOAD ROWS, re-derived here from the plan's own numbers and
// held: bending at the root, tear-out behind the pin, bearing in the hole.
if (pl0) {
  const r = pl0.rows;
  const mpa = (x) => (x / 1e6).toFixed(1);
  console.log(`root bending ${mpa(r.sigma)} MPa at a ${(r.armU * MM).toFixed(3)} mm arm — sized to ${r.governs} (${mpa(r.sigmaY)} MPa), the weakest alloy the case is cut from (TODO 262)`);
  for (const [k, v] of Object.entries(r.alloys))
    console.log(`  ${k.padEnd(13)} yield ${mpa(v.design)} MPa${v.provisional ? ' (provisional)' : ''}  root at ${v.ratio.toFixed(3)}× its yield`);
  console.log(`  steel's guaranteed minimum ${mpa(r.sigmaYLow)} MPa: root at ${(r.sigma / r.sigmaYLow).toFixed(2)}×`);
  console.log(`tear-out ${mpa(r.tearTau)} MPa (shear yield ${mpa(r.tauY)}); bearing ${mpa(r.bearing)} MPa; S slope ${(pl0.alpha * 180 / Math.PI).toFixed(1)}°, drop ${(r.drop * MM).toFixed(3)} mm; weld feet ${(r.footMargin * MM).toFixed(3)} mm inside the band's wall`);
  for (const [k, v] of Object.entries(r.alloys))
    if (!(v.ratio <= 1 + 1e-9)) { ok = false; console.log(`LOAD FAIL: the root bends past ${k}'s yield`); }
  if (!(r.tearTau <= r.tauY * (1 + 1e-9))) { ok = false; console.log('LOAD FAIL: the tip tears out'); }
  if (!(r.bearing <= r.sigmaY)) { ok = false; console.log('LOAD FAIL: the pin crushes its hole'); }
}

await browser.close(); srv.kill();
process.exit(ok ? 0 : 2);
