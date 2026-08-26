// TODO 93/94 — an interpenetration witness that trusts NEITHER side.
//
// Two earlier witnesses are both disqualified for this job:
//   · the vendor's tri-tri distance emits FALSE ZEROS (BUILT §82). Measured on
//     main at one pose, it reports 0.0000 for pairs `meshClearance` puts 8–10
//     units apart. So `raw ≈ 0` is not evidence of contact, and any validation
//     resting on it — including this session's first pass — proves nothing.
//   · `segmentPierces`, the TODO 93 fix, cannot be used to validate its own
//     rows without circularity.
//
// This one samples SPACE. Take the two meshes' AABB intersection, grid it, and
// ask whether any point is inside BOTH solids. Containment is decided by parity
// raycast along several independent directions and majority-voted, because a
// single fixed ray grazes coaxial walls (§122 measured that lying up to 13 u
// outside a mesh). A point inside both bodies is interpenetration by
// definition — no distance query, no triangle-pair test, no edge crossing.
//
// It is a ONE-SIDED instrument and that is deliberate: finding a shared point
// PROVES contact; finding none proves only that the grid missed, which for a
// thin sliver it easily may. Use it to confirm, never to clear.
import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = process.env.ROOT || join(dirname(fileURLToPath(import.meta.url)), '..');
const PORT = Number(process.env.PORT || 8465);
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
  // MUST mirror collectUnits() in inspect.js exactly, or index-based labels
  // like `BoxGeometry#3` name a DIFFERENT mesh here than in a battery report.
  // The difference that bites: collectUnits PRUNES a schematic subtree (early
  // return before recursing), whereas Object3D.traverse skips only the flagged
  // node and still descends into its children — so an unflagged mesh under a
  // flagged parent is collected by traverse and not by collectUnits, and every
  // index after it shifts.
  const meshesOf = (e) => {
    const m = [];
    const walk = (o) => {
      if (o.userData && o.userData.schematic) return;
      if (o.isMesh && o.geometry && o.geometry.attributes.position) m.push(o);
      for (const c of o.children) walk(c);
    };
    walk(e.obj);
    return m;
  };
  const byName = (u, nm) => {
    const list = meshesOf(unit(u));
    return list.find((m) => (m.name || `${m.geometry.type}#${list.indexOf(m)}`) === nm);
  };

  // Several oblique directions; a majority vote survives one grazing ray.
  const DIRS = [
    new THREE.Vector3(0.317, 0.591, 0.741), new THREE.Vector3(-0.771, 0.322, 0.549),
    new THREE.Vector3(0.483, -0.809, 0.336), new THREE.Vector3(0.269, 0.443, -0.855),
    new THREE.Vector3(-0.556, -0.662, -0.503),
  ].map((v) => v.normalize());
  const ray = new THREE.Ray();
  const insideMesh = (mesh, pWorld) => {
    const tree = mesh.geometry.boundsTree;
    if (!tree) return false;
    const p = pWorld.clone().applyMatrix4(new THREE.Matrix4().copy(mesh.matrixWorld).invert());
    let odd = 0;
    for (const d of DIRS) {
      ray.origin.copy(p); ray.direction.copy(d);
      const hits = tree.raycast(ray, THREE.DoubleSide);
      let n = 0, last = -Infinity;
      for (const h of hits) { if (h.distance > 1e-9 && h.distance - last > 1e-7) { last = h.distance; n++; } }
      if (n % 2 === 1) odd++;
    }
    return odd > DIRS.length / 2;
  };

  const PAIRS = [
    ['Alarm switch', 'CylinderGeometry#9', 'Case', 'caseMiddle'],
    ['Case', 'caseMiddle', 'Dial', 'CylinderGeometry#0'],
    ['Alarm disc', 'ExtrudeGeometry#20', 'Hour wheel', 'hourTube'],
    ['Alarm selector', 'alarmSelRing', 'Alarm selector', 'BoxGeometry#1'],
    ['Alarm winding arrest', 'genevaFingerDisc', 'Alarm winding arrest', 'alarmArrestFingerArbor'],
    // Controls: two pairs main's scanner flags that are certainly NOT touching.
  ];
  for (const [ua, na, ub, nb] of PAIRS) {
    const A = byName(ua, na), B = byName(ub, nb);
    if (!A || !B) { out.push(`${ua}/${na} ⇄ ${ub}/${nb}: mesh not found`); continue; }
    I.meshClearance(A, B, Infinity);   // ensure both bounds trees exist
    const boxA = new THREE.Box3().setFromObject(A), boxB = new THREE.Box3().setFromObject(B);
    const ov = boxA.clone().intersect(boxB);
    if (ov.isEmpty()) { out.push(`${na} ⇄ ${nb}: AABBs do not overlap — apart`); continue; }
    const size = ov.getSize(new THREE.Vector3());
    const N = 26;
    let shared = 0, first = null, tested = 0;
    const p = new THREE.Vector3();
    for (let i = 0; i <= N; i++) for (let j = 0; j <= N; j++) for (let k = 0; k <= N; k++) {
      p.set(ov.min.x + size.x * i / N, ov.min.y + size.y * j / N, ov.min.z + size.z * k / N);
      tested++;
      if (!insideMesh(A, p)) continue;
      if (!insideMesh(B, p)) continue;
      shared++; if (!first) first = p.clone();
    }
    out.push(`${na} ⇄ ${nb}`);
    out.push(`  overlap box ${size.x.toFixed(2)} × ${size.y.toFixed(2)} × ${size.z.toFixed(2)}, ${tested} grid points`);
    out.push(shared
      ? `  → ${shared} point(s) inside BOTH — INTERPENETRATION PROVEN. first at r ${Math.hypot(first.x, first.y).toFixed(3)} z ${first.z.toFixed(3)}`
      : `  → no shared point found (does NOT clear the pair — the grid can miss a sliver)`);
    out.push('');
  }
  return out;
});
console.log(res.join('\n'));
await browser.close();
srv.kill();
