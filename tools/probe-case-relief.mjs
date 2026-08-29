// DOES ANYTHING STAND IN THE BAND'S METAL — AT ANY POSE THE MOVEMENT REACHES?
// Acceptance, and since §186 it rides the battery workflow (TODO 111 option 1:
// this is the gate that holds the ANALYTIC sectors honest over the net). The
// band's openings (the two crown bores, the pusher bore) are a DERIVATION now
// — CASE_SECTORS cuts them from the three declared, pose-invariant bore lines
// and nothing else, on the claim that the §186 case has no metal inboard of
// CASE_R_IN at any pose. Boot holds that claim at ONE pose (the rule-5 reach
// assert and the build-pose tripwire beside the sectors); this holds it over
// the POSE NET: every axis at f ∈ {0, 0.5, 1}, entered canonically
// (inspect.js's own enterAxis, so an axis cannot inherit the tail of the one
// before it), plus the pose the page boots in. Any contact is a failure,
// named on both sides.
//
// The history that shaped it: the pre-§186 seat stood at plateR − 1 mm, in
// among the dial-side works, and its relief was SCANNED at build pose —
// measured, `hackRodPin` sat clear of that seat as the case was built and
// half a unit inside it in 33 of the 42 poses the battery visits. The relief
// was derived correctly and was still a claim about one pose. §186 moved the
// bearing outboard of every mover; this probe is what says "every mover"
// stays true.
//
// Its subject is the BAND and what is pressed into it — not the whole case. The
// crystals and the back close the case in z and have no openings to get wrong,
// and leaving them out is most of what makes this cheap enough to run between
// cuts. The battery's `inspection` and `sweptOverlap` judge every Case pair over
// a far denser net and are the gate; this names the MESH on both sides, which is
// what tells you which opening is in the wrong place.
//
// Run: node tools/probe-case-relief.mjs   (ROOT= to measure a different worktree)
import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
const ROOT = process.env.ROOT || join(dirname(fileURLToPath(import.meta.url)), '..');
const srv = spawn('python3', ['-m', 'http.server', '8456', '--bind', '127.0.0.1'], { cwd: ROOT, stdio: 'ignore' });
await new Promise((r) => setTimeout(r, 1200));
const browser = await chromium.launch();
const page = await browser.newPage();
page.on('pageerror', (e) => console.log('PAGEERROR', String(e)));
page.on('console', (m) => { if (m.text().startsWith('pose ')) process.stdout.write('.'); });
await page.goto('http://127.0.0.1:8456/index.html', { waitUntil: 'load', timeout: 120000 });
await page.waitForFunction(() => !!window.__clock, null, { timeout: 120000 });

const res = await page.evaluate(async () => {
  const I = await import('./src/inspect.js');
  const THREE = await import('three');
  const clock = window.__clock;
  const scene = clock.scene;

  // The band and what is pressed into it. Named rather than taken off the
  // `casePart` flag, because the question is about the OPENINGS and every one
  // of them is in these bodies. A name that matches nothing THROWS: a stale
  // roster would otherwise report a clean scan of no work — `resolveAxes`'
  // precedent, and the failure this whole file exists to refuse.
  const BAND = ['caseMiddle', 'caseCrownTubeSleeve', 'caseCrownTubeCollar',
    'caseAlarmTubeSleeve', 'caseAlarmTubeCollar', 'casePusherBoreSleeve',
    'caseClampScrew']; // §186 — three heads + three shafts through the rim; six meshes, one name
  const caseMeshes = [], movementMeshes = [];
  scene.traverse((o) => {
    if (!o.isMesh || o.userData.schematic || !o.geometry?.attributes?.position) return;
    if (o.userData.casePart) { if (BAND.includes(o.name)) caseMeshes.push(o); return; }
    movementMeshes.push(o);
  });
  const missing = BAND.filter((n) => !caseMeshes.some((m) => m.name === n));
  if (missing.length) throw new Error(`no such case body: ${missing.join(', ')}`);
  // The case's own bodies are not compared against each other here: that is
  // `intraUnit`'s question, and the case is outside its scope by its own
  // declaration (see makeCase's CSG note).
  const label = (m) => m.name || `${m.geometry.type}#${m.id}`;

  // TWO contacts are the mount doing its job. `['Case', 'plate']` is an
  // EXPECTED pair in inspect.js — since §186 the movement is carried by the
  // band's LEDGE, whose plane is derived FROM the plate rim's measured
  // underside face, so the two are coincident planes and read 0.0000 by
  // construction; and the clamp screws' heads seat on the rim's measured
  // back face (SEAT_EMBED — the press-contact idiom) while their shafts
  // pass its clearance bores at SEAT_FIT. Excused by NAME, not by unit, so
  // each excuse covers exactly its joint and nothing else the band might do
  // to the plate. What this does not check is stated rather than implied: a
  // coincident plane is what a bearing looks like and also what §169's
  // flush-face blind spot looks like, and telling them apart is the plane's
  // own derivation, not this measurement.
  const BEARING = 'caseMiddle ⇄ backPlate';
  const CLAMP = 'caseClampScrew ⇄ backPlate';

  // A box test alone prunes almost nothing: the band's box encloses the whole
  // movement, so every mesh in it "overlaps". Prune on the case's OWN metal
  // instead — each body's minimum vertex radius, MEASURED here rather than
  // restated from layout.js — because a mesh that never reaches that radius
  // cannot touch a body that is an annulus about the same axis. Every body in
  // BAND is one; anything that is not would have minimum ~0 and simply fall
  // back to the box test.
  const minR = caseMeshes.map((m) => {
    const p = m.geometry.attributes.position, v = new THREE.Vector3();
    let r = Infinity;
    for (let i = 0; i < p.count; i++) r = Math.min(r, Math.hypot(...m.localToWorld(v.fromBufferAttribute(p, i))));
    return r;
  });
  const maxCornerR = (b) => {
    let r = 0;
    for (const x of [b.min.x, b.max.x]) for (const y of [b.min.y, b.max.y]) r = Math.max(r, Math.hypot(x, y));
    return r;
  };
  // Only CONTACT is being asked about, so an unbounded closest-point search is
  // work thrown away: the bound lets both trees prune, and it is what makes
  // this minutes rather than the better part of an hour.
  const BOUND = 0.15;                       // CLEAR_MARGIN — past it is not contact

  const hits = new Map();
  const box = new THREE.Box3();
  const poses = [{ name: 'as booted', enter: () => {} }];
  for (const ax of I.AXES) for (const f of [0, 0.5, 1])
    poses.push({ name: `${ax.name} f=${f}`, enter: () => { I.enterAxis(clock); clock.setPose(ax.pose(f, clock)); } });

  let tested = 0, bearingPoses = 0, clampContacts = 0;
  for (const p of poses) {
    p.enter();
    scene.updateMatrixWorld(true);
    console.log(`pose ${p.name}`);
    const cb = caseMeshes.map((m) => new THREE.Box3().setFromObject(m));
    for (const B of movementMeshes) {
      box.setFromObject(B);
      const rB = maxCornerR(box);
      for (let i = 0; i < caseMeshes.length; i++) {
        if (rB < minR[i] || !cb[i].intersectsBox(box)) continue;
        const A = caseMeshes[i];
        tested++;
        // Both directions: meshClearance is not symmetric near zero (the
        // instruments skill's own catalogue), and a one-sided call is how a
        // crossing gets published as clearance — item 93, on this very pair.
        const d = Math.min(I.meshClearance(A, B, BOUND), I.meshClearance(B, A, BOUND));
        if (d > 1e-3) continue;
        const k = `${label(A)} ⇄ ${label(B)}`;
        if (k === BEARING) { bearingPoses++; continue; }
        if (k === CLAMP) { clampContacts++; continue; }
        if (!hits.has(k)) hits.set(k, { pose: p.name, d, n: 0 });
        hits.get(k).n++;
      }
    }
  }
  return {
    poses: poses.length, caseMeshes: caseMeshes.length, movementMeshes: movementMeshes.length, tested,
    bearing: bearingPoses, bearingName: BEARING,
    clamp: clampContacts, clampName: CLAMP,
    rows: [...hits.entries()].map(([k, v]) => ({ pair: k, firstAt: v.pose, poses: v.n, clearance: v.d })),
  };
});

console.log(`\nband bodies ${res.caseMeshes} ⇄ movement meshes ${res.movementMeshes}, `
  + `over ${res.poses} poses — ${res.tested} pairs measured after the radial prune`);
if (!res.tested) console.log('WARNING: the prune left nothing to measure, so this run judged nothing');
console.log(`the ledge bearing (${res.bearingName}) reads shut in ${res.bearing}/${res.poses} poses — `
  + "EXPECTED ['Case', 'plate'], and not counted below");
if (res.bearing !== res.poses)
  console.log('...which is itself a finding: the movement is not sitting on its ledge at every pose');
console.log(`the clamp joints (${res.clampName}) read shut in ${res.clamp} pair-pose(s) — the screws doing their job, not counted below`);
if (!res.clamp)
  console.log('...which is itself a finding: no clamp screw touches the rim it exists to clamp');
if (!res.rows.length) {
  console.log('CLEAR — nothing stands in the band at any pose in the net');
} else {
  console.log(`${res.rows.length} contacting pair(s):`);
  for (const r of res.rows.sort((a, b) => b.poses - a.poses))
    console.log(`  ${r.pair.padEnd(50)} in ${String(r.poses).padStart(2)} pose(s), first at ${r.firstAt}, clearance ${r.clearance.toFixed(4)}`);
}
await browser.close(); srv.kill();
process.exit(res.rows.length || !res.tested ? 1 : 0);
