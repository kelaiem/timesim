// THE LUGS, READ OFF THE METAL — the derived radial chain held to layout.js's
// declaration, and the §190 wrap gap measured off the analytic bar surface.
//
// ACCEPTANCE (exit 2 on failure). §190 moved the whole lug/bar stock into
// layout.js (CASE_LUG_T/W/ROOT/Z_OFF, CASE_SPRING_BAR_D, CASE_STRAP_CLEAR →
// CASE_BAR_REACH → CASE_LUG_REACH), so this probe imports that one
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
//    CASE_LUG_SPAN_MAX the owner's 2026-08-31 spec sits ON.
// 3. §190 WRAP GAP: minimum distance from each bar's ANALYTIC surface (axis
//    segment + radius) to every case mesh that is not a lug, held to
//    CASE_STRAP_CLEAR. The bar side must be analytic because a cylinder's
//    vertices sit only on its end rings — the vertex list's nearest sample
//    reads 60.5 u where the true near surface is 54.5 u (the instruments
//    skill's "vertices mistaken for the surface" trap, measured live in
//    this probe's own old per-bar rMin). The case side is triangles, exact
//    for the flat faces and conservative-by-sagitta for the faceted band.
//    CONTROL: the same machinery pointed at the EXCLUDED lugs must read
//    ≈ −bar radius (the bar's ends abut the lug facing walls — a read that
//    cannot see that contact is not measuring distance).
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
import { UNIT_MM, CASE_WIDTH_MAX, CASE_LUG_SPAN_MAX, CASE_LUG_REACH,
         CASE_STRAP_CLEAR, CASE_SPRING_BAR_D } from '../src/layout.js';
const ROOT = process.env.ROOT || join(dirname(fileURLToPath(import.meta.url)), '..');
const srv = spawn('python3', ['-m', 'http.server', '8516', '--bind', '127.0.0.1'], { cwd: ROOT, stdio: 'ignore' });
await new Promise((r) => setTimeout(r, 1200));
const browser = await chromium.launch();
const page = await browser.newPage();
page.on('pageerror', (e) => console.log('PAGEERROR', String(e)));
await page.goto('http://127.0.0.1:8516/index.html', { waitUntil: 'load', timeout: 120000 });
await page.waitForFunction(() => !!window.__clock, null, { timeout: 120000 });

const res = await page.evaluate(async () => {
  const THREE = await import('three');
  const clock = window.__clock;
  const v = new THREE.Vector3();
  const lugs = [], bars = [], caseMeshes = [];
  clock.scene.traverse((o) => {
    if (o.name === 'caseLug') lugs.push(o);
    else if (o.name === 'caseSpringBar') bars.push(o);
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
    const axis = cA.clone().sub(cB).normalize();
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
    const ring = proj.filter((p) => Math.hypot(p.a, p.b) > 0.5 * rRough);
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
    let h = 0, r = 0;
    for (const p of b.pts) {
      const d = V(p).sub(centre);
      const t = d.dot(axis);
      h = Math.max(h, Math.abs(t));
      r = Math.max(r, Math.sqrt(Math.max(d.lengthSq() - t * t, 0)));
    }
    return { c: centre, axis, h, r };
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
    const toLugs = segToMeshes(bar, lugs);       // CONTROL — must read the abutment
    return {
      barR: bar.r,
      gap: toCase.dist - bar.r, governs: toCase.mesh,
      lugGap: toLugs.dist - bar.r,
    };
  });
  return {
    nLugs: lugs.length, nBars: bars.length, nCase: caseMeshes.length,
    caseNames: [...new Set(caseMeshes.map((m) => m.name))],
    lugR: L.map((l) => ({ rMin: +l.rMin.toFixed(4), rMax: +l.rMax.toFixed(4), zMin: +l.zMin.toFixed(3), zMax: +l.zMax.toFixed(3) })),
    barR: B.map((b) => ({ rMin: +b.rMin.toFixed(4), rMax: +b.rMax.toFixed(4), zMin: +b.zMin.toFixed(3), zMax: +b.zMax.toFixed(3) })),
    tipsAcross, interiors, wrap,
  };
});

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

// 2. Interior lug distance vs the spec the owner's strap width sits ON.
for (const it of res.interiors) {
  if (it.error) { ok = false; console.log(`INTERIOR FAIL: ${it.error} — could not pair the lugs`); continue; }
  const d = Math.abs(it.inner - CASE_LUG_SPAN_MAX);
  console.log(`interior lug distance MEASURED: ${it.inner.toFixed(4)} u = ${(it.inner * MM).toFixed(3)} mm  (spec ${(CASE_LUG_SPAN_MAX * MM).toFixed(0)} mm, drift ${d.toFixed(4)} u)`);
  if (d > 0.02) { ok = false; console.log(`INTERIOR FAIL: the metal does not present the ${(CASE_LUG_SPAN_MAX * MM).toFixed(0)} mm strap spec`); }
}

// 3. §190 wrap gap, off the analytic bar surface, vs CASE_STRAP_CLEAR.
const barRDecl = CASE_SPRING_BAR_D / 2;
for (const w of res.wrap) {
  console.log(`\nwrap gap MEASURED: ${w.gap.toFixed(4)} u = ${(w.gap * MM).toFixed(3)} mm  (spec ≥ ${(CASE_STRAP_CLEAR * MM).toFixed(1)} mm, governed by ${w.governs})`);
  if (Math.abs(w.barR - barRDecl) > 0.02) { ok = false; console.log(`WRAP FAIL: recovered bar radius ${w.barR.toFixed(4)} u does not match CASE_SPRING_BAR_D/2 = ${barRDecl.toFixed(4)} u — the axis fit read something that is not the bar`); }
  if (w.gap < CASE_STRAP_CLEAR - 0.02) { ok = false; console.log(`WRAP FAIL: a strap thicker than ${(w.gap * MM).toFixed(2)} mm cannot wrap this bar — the case metal is inside the ${(CASE_STRAP_CLEAR * MM).toFixed(1)} mm envelope`); }
  // CONTROL: the excluded lugs ABUT the bar's ends, so the same machinery
  // pointed at them must read ≈ −barR (contact at the axis endpoints). A
  // clean wrap number with a dead control is a probe reading nothing.
  if (Math.abs(w.lugGap + w.barR) > 0.1) { ok = false; console.log(`WRAP CONTROL FAIL: lug abutment read ${w.lugGap.toFixed(4)} u, expected ≈ ${(-w.barR).toFixed(4)} — the distance machinery is not seeing contact that exists`); }
  else console.log(`wrap CONTROL PASS: lug abutment reads ${w.lugGap.toFixed(4)} u (≈ −barR = ${(-w.barR).toFixed(4)})`);
}
if (res.nCase < 3) { ok = false; console.log(`WRAP CONTROL FAIL: only ${res.nCase} case meshes enrolled (${res.caseNames.join(', ')}) — the gap was measured against too little metal`); }

await browser.close(); srv.kill();
process.exit(ok ? 0 : 2);
