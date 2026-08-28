// TODO 95 — find every mesh pair where the WRAPPER disagrees with the LIBRARY.
//
// `_meshClearanceInner` arbitrates a near-zero against `sampledVerdict` with
// `d = v.inside ? Math.min(d, 0) : Math.max(d, v.d)`. That `Math.max` cannot
// tell a FALSE zero (BUILT §82: the vendor's tri-tri test does emit them) from
// a TRUE zero whose witness point sampling missed — and it resolves the
// ambiguity towards CLEARANCE, which is the unsafe direction and silent.
//
// A body passing CLEAN THROUGH another is the case sampling can never witness:
// its vertices and edge midpoints are all in free space, and the wall between
// is thinner than the sample spacing. This probe finds those by asking the two
// sides independently at one pose and printing every disagreement:
//
//   raw   three-mesh-bvh's closestPointToGeometry, unwrapped
//   mc    meshClearance, the wrapper
//
// raw ≈ 0 with mc well above 0 is the signature. Run it before and after a
// change to `sampledVerdict` — after the pass-through witness lands, the
// disagreement list should be empty.
//
// Not case-specific and not pair-specific on purpose: the defect is a class,
// and the whole movement is the population.
import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = process.env.ROOT || join(dirname(fileURLToPath(import.meta.url)), '..');
const PORT = Number(process.env.PORT || 8464);
const TOL = Number(process.env.TOL || 0.01);
const srv = spawn('python3', ['-m', 'http.server', String(PORT), '--bind', '127.0.0.1'],
  { cwd: ROOT, stdio: 'ignore' });
await new Promise((r) => setTimeout(r, 1200));
const browser = await chromium.launch();
const page = await browser.newPage();
page.on('pageerror', (e) => console.log('PAGEERROR', String(e)));
await page.goto(`http://127.0.0.1:${PORT}/index.html`, { waitUntil: 'load', timeout: 90000 });
await page.waitForFunction(() => !!window.__clock, null, { timeout: 90000 });

const res = await page.evaluate(async (TOL) => {
  const THREE = await import('three');
  const I = await import('./src/inspect.js');
  const clock = window.__clock;
  const out = [];
  clock.resetInputs();

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
  const units = clock.labelEntries.map((e) => ({ name: e.name, meshes: meshesOf(e) }));
  const label = (m, list) => m.name || `${m.geometry.type}#${list.indexOf(m)}`;

  const bA = new THREE.Box3(), bB = new THREE.Box3(), mat = new THREE.Matrix4();
  let pairsTested = 0, disagreements = 0;
  const rows = [];
  for (let i = 0; i < units.length; i++) {
    for (let j = i; j < units.length; j++) {
      const U = units[i], V = units[j];
      for (const x of U.meshes) {
        bA.setFromObject(x);
        for (const y of V.meshes) {
          if (x === y) continue;
          bB.setFromObject(y);
          if (!bA.intersectsBox(bB)) continue;   // cheap, exact prefilter
          pairsTested++;
          const mc = I.meshClearance(x, y, Infinity);
          if (mc <= TOL) continue;               // wrapper already says contact
          const tree = x.geometry.boundsTree;
          if (!tree) continue;
          mat.copy(x.matrixWorld).invert().multiply(y.matrixWorld);
          const raw = tree.closestPointToGeometry(y.geometry, mat, {}, {}, 0, Infinity);
          if (!raw || raw.distance > TOL) continue;
          disagreements++;
          rows.push(`${U.name} ⇄ ${V.name}   ${label(x, U.meshes)} ⇄ ${label(y, V.meshes)}   raw ${raw.distance.toFixed(4)}  mc ${mc.toFixed(4)}`);
        }
      }
    }
  }
  out.push(`pose: beat f=0 (resetInputs)   tol ${TOL}`);
  out.push(`mesh pairs with overlapping AABBs: ${pairsTested}`);
  out.push(`disagreements (raw says contact, meshClearance does not): ${disagreements}`);
  out.push('');
  for (const r of rows.slice(0, 60)) out.push('  ' + r);
  if (rows.length > 60) out.push(`  … ${rows.length - 60} more`);
  return out;
}, TOL);
console.log(res.join('\n'));
await browser.close();
srv.kill();
