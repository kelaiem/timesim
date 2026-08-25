// TODO 90 — does the alarm pusher's stem pass through the case wall?
//
// Item 90 currently says no, citing `inspection` "clear at all 65 alarmPress
// poses". Neither half of that is usable on THIS base:
//
//   1. There is no `alarmPress` axis here. It exists on main; case-schematic
//      (this branch's base) has 13 axes and none is it — `probe-92-standoff`
//      throws on the undefined axis, `probe-92-pose` prints NO SUCH AXIS. That
//      sentence was measured against another tree.
//   2. `meshClearance` guards BVH near-zeros with a PARITY raycast, which
//      assumes a closed SIMPLE solid. The seat step's profile doubles back and
//      touches itself, so parity near the band is unreliable here regardless.
//
// So this probe asks neither, and needs no press axis: the stem stands where
// it stands at rest. It casts the stem's TRUE axis at the case wall from
// outside all case metal, collects every surface crossing, pairs them into
// metal spans, and reports how much metal the stem's own extent overlaps.
//
// Two things this gets right that a quicker version does not:
//   * The axis comes from CylinderGeometry.parameters through matrixWorld, NOT
//     from innermost/outermost vertices. The pusher is CHORD-mounted, so its
//     closest approach to the movement's centre is at the perpendicular foot
//     MID-BODY — the min-radius vertices are not an end cap and the line
//     through them is not the axis.
//   * It tests the SURFACE. CLAUDE.md's caveat: a cylinder's vertices sit on
//     its end caps, so a pin crossing a band carries no vertex inside it and
//     every vertex-sampling test calls it clear.
import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = process.env.ROOT || join(dirname(fileURLToPath(import.meta.url)), '..');
const PORT = Number(process.env.PORT || 8461);
const srv = spawn('python3', ['-m', 'http.server', String(PORT), '--bind', '127.0.0.1'],
  { cwd: ROOT, stdio: 'ignore' });
await new Promise((r) => setTimeout(r, 1200));
const browser = await chromium.launch();
const page = await browser.newPage();
page.on('pageerror', (e) => console.log('PAGEERROR', String(e)));
await page.goto(`http://127.0.0.1:${PORT}/index.html`, { waitUntil: 'load', timeout: 90000 });
await page.waitForFunction(() => !!window.__clock, null, { timeout: 90000 });

const res = await page.evaluate(async () => {
  const THREE = await import('three');
  const I = await import('./src/inspect.js');
  const clock = window.__clock;
  const out = [];
  clock.resetInputs();

  const unit = (n) => clock.labelEntries.find((x) => x.name === n);
  const meshesOf = (e) => {
    const m = [];
    e.obj.traverse((o) => {
      if (o.isMesh && !o.userData.schematic && o.geometry?.attributes?.position) m.push(o);
    });
    return m;
  };
  const mid = meshesOf(unit('Case')).find((m) => m.name === 'caseMiddle');
  {
    const p = mid.geometry.attributes.position; let a = Infinity, b = -Infinity;
    for (let i = 0; i < p.count; i++) {
      const v = new THREE.Vector3().fromBufferAttribute(p, i); mid.localToWorld(v);
      const r = Math.hypot(v.x, v.y); if (r < a) a = r; if (r > b) b = r;
    }
    out.push(`caseMiddle  bore ${a.toFixed(3)}  outer ${b.toFixed(3)}`);
  }
  out.push('');

  const ray = new THREE.Raycaster(); ray.far = Infinity;
  for (const s of meshesOf(unit('Alarm switch'))) {
    const g = s.geometry;
    if (!/Cylinder/.test(g.type) || !g.parameters) continue;
    const h = g.parameters.height, rad = Math.max(g.parameters.radiusTop, g.parameters.radiusBottom);
    s.updateWorldMatrix(true, false);
    // CylinderGeometry's local axis is +Y. Take it through the world matrix.
    const axis = new THREE.Vector3(0, 1, 0)
      .transformDirection(s.matrixWorld).normalize();
    const centre = new THREE.Vector3().setFromMatrixPosition(s.matrixWorld);
    const A = centre.clone().addScaledVector(axis, -h / 2);
    const B = centre.clone().addScaledVector(axis, +h / 2);
    const rA = Math.hypot(A.x, A.y), rB = Math.hypot(B.x, B.y);
    // Perpendicular foot: how far the axis's line stands off the movement centre.
    const foot = centre.clone().addScaledVector(axis, -centre.dot(axis));
    const off = Math.hypot(foot.x, foot.y);

    // Cast from well outside all case metal, along the axis, and collect every
    // crossing. Pairs of crossings bound metal.
    // Raycaster HONOURS material.side, and the case is FrontSide — so a naive
    // cast returns only the front-facing half of the crossings (2 where a chord
    // through an annulus must give 4) and the pairing silently becomes fiction.
    // Force DoubleSide for the cast and put it back.
    const BIG = 200;
    const origin = centre.clone().addScaledVector(axis, -BIG);
    ray.set(origin, axis);
    const sideWas = mid.material.side;
    mid.material.side = THREE.DoubleSide;
    const hits = ray.intersectObject(mid, false).map((x) => x.distance).sort((a, b) => a - b);
    mid.material.side = sideWas;
    const t0 = BIG - h / 2, t1 = BIG + h / 2;   // the stem's own span on this ray

    out.push(`${s.name || `(unnamed ${g.type})`}  Ø${(rad * 2).toFixed(3)} u  len ${h.toFixed(3)}`);
    out.push(`  ends r ${rA.toFixed(2)} → ${rB.toFixed(2)}   axis stands off centre by ${off.toFixed(3)} u`);
    if (hits.length % 2) out.push(`  ! odd crossing count (${hits.length}) — surface may be open; treat with suspicion`);
    let pierced = 0; const spans = [];
    for (let i = 0; i + 1 < hits.length; i += 2) {
      const lo = Math.max(hits[i], t0), hi = Math.min(hits[i + 1], t1);
      const p0 = origin.clone().addScaledVector(axis, hits[i]);
      const p1 = origin.clone().addScaledVector(axis, hits[i + 1]);
      spans.push(`metal r ${Math.hypot(p0.x, p0.y).toFixed(2)}→${Math.hypot(p1.x, p1.y).toFixed(2)} `
        + `z ${p0.z.toFixed(2)}..${p1.z.toFixed(2)}` + (hi > lo ? `  OVERLAP ${(hi - lo).toFixed(3)} u` : '  (clear of stem)'));
      if (hi > lo) pierced += hi - lo;
    }
    for (const l of spans) out.push(`    ${l}`);
    out.push(pierced > 0
      ? `  → PIERCES ${pierced.toFixed(3)} u of case metal`
      : `  → clear of the case`);
    // Put the battery's own instrument beside the ray, on the same two meshes.
    // If they disagree, the disagreement is the finding — a gate that reports
    // clear through 1 mm of band is not a gate anyone can spend.
    try {
      const d = I.meshClearance(mid, s, Infinity);
      out.push(`  meshClearance(caseMiddle, this) = ${d.toFixed(4)}`
        + (pierced > 0 && d > 0.001 ? '   ← DISAGREES with the ray' : ''));
    } catch (e) { out.push(`  meshClearance threw: ${e && e.message}`); }
    out.push('');
  }
  return out;
});
console.log(res.join('\n'));
await browser.close();
srv.kill();
