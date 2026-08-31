// WHAT MESHES ARE IN THE METAL, AND WHICH OF THEM DOES A ROW DECLARE?
//
// §194 gates two questions over the DECLARED mesh registry. This asks the
// question the registry cannot ask about itself: what does the geometry say a
// mesh is, and does every one of those have a row? It is roadmap §135's
// remaining item 4 as a REPORT — the numbers §194's records quote ("85 rotors
// across 26 units, 21 meshes") come from here, so they are re-checkable rather
// than remembered. §194's own entry claimed 81/29/32 with no instrument behind
// it, which is exactly the failure this file exists to stop repeating.
//
// It is NOT `probe-60-reach` (does every rotor have an arbor in its bore) and
// NOT `probe-mesh-transmission` / `probe-train-mesh-phase`, which measure
// declared pairs. This one ENUMERATES, and it is the only thing here that can
// find a mesh nobody declared.
//
// A CANDIDATE is two rotors with:
//   · parallel axes (a bevel pair meets at 90°, so bevels are OUT OF SCOPE by
//     construction and are reported as such rather than silently missing);
//   · a centre distance that closes on the pitch-radius sum;
//   · rims that OVERLAP along the shared axis, so contact is geometrically
//     possible. Without this a coaxial stack reads as a mesh with everything
//     at its own radius.
//
// THE TOLERANCE IS THE POINT OF THE OUTPUT, not a setting to tune. Rows are
// printed in bands rather than filtered to one cut, because the interesting
// ones live just outside any cut you would pick: the two keyless pairs sit at
// 1.34% because layout.js adds a bare +0.1 to their centre distance (TODO
// 125), and a probe that reported only a tight band would have hidden the
// finding it exists to surface. A "candidate" here is a question, not a
// verdict — some pairs sit at the pitch sum without meshing.
//
// REPORT. It prints and leaves the judgement to a reader; nothing here exits
// non-zero. Run from tools/ with a Playwright Chromium.
import { chromium } from 'playwright';
import { spawn } from 'node:child_process';

const port = process.env.PORT || '8496';
const srv = spawn('python3', ['-m', 'http.server', port, '--bind', '127.0.0.1'],
  { cwd: process.env.ROOT || '..', stdio: 'ignore' });
await new Promise((r) => setTimeout(r, 900));
const browser = await chromium.launch({ args: [
  '--disable-background-timer-throttling', '--disable-backgrounding-occluded-windows',
  '--disable-renderer-backgrounding',
] });
const page = await browser.newPage();
page.on('pageerror', (e) => console.log('PAGEERROR', String(e)));
await page.goto(`http://127.0.0.1:${port}/index.html`, { waitUntil: 'load', timeout: 90000 });
await page.waitForFunction(() => !!window.__clock, null, { timeout: 90000 });

const out = await page.evaluate(async () => {
  const THREE = await import('three');
  const C = window.__clock;
  const owner = new Map();
  for (const e of C.labelEntries) e.obj.traverse((o) => { if (!owner.has(o)) owner.set(o, e.name); });

  const rotors = [];
  const pos = new THREE.Vector3(), q = new THREE.Quaternion(), sc = new THREE.Vector3(), ax = new THREE.Vector3();
  C.scene.traverse((o) => {
    const r = o.userData && o.userData.r;
    if (typeof r !== 'number' || !(r > 0)) return;
    if (o.userData.schematic) return;              // §66 display, never metal
    o.updateWorldMatrix(true, false);
    o.matrixWorld.decompose(pos, q, sc);
    ax.set(0, 0, 1).applyQuaternion(q).normalize();
    const box = new THREE.Box3().setFromObject(o);
    rotors.push({ name: o.name || '', unit: owner.get(o) || '(no unit)', r,
      x: pos.x, y: pos.y, z: pos.z, ax: ax.x, ay: ax.y, az: ax.z,
      lo: box.min.z, hi: box.max.z, teeth: o.userData.teeth ?? null });
  });

  const cands = [], skewed = [];
  for (let i = 0; i < rotors.length; i++) for (let j = i + 1; j < rotors.length; j++) {
    const a = rotors[i], b = rotors[j];
    const dot = Math.abs(a.ax * b.ax + a.ay * b.ay + a.az * b.az);
    const dx = b.x - a.x, dy = b.y - a.y, dz = b.z - a.z;
    const along = dx * a.ax + dy * a.ay + dz * a.az;
    const px = dx - along * a.ax, py = dy - along * a.ay, pz = dz - along * a.az;
    const d = Math.hypot(px, py, pz), sum = a.r + b.r;
    if (d < 1e-6 || sum <= 0) continue;
    const miss = Math.abs(d - sum) / sum;
    if (dot < 0.999) { if (miss <= 0.05 && dot < 0.9) skewed.push({ a: a.name, b: b.name }); continue; }
    if (miss > 0.05) continue;
    cands.push({ a: a.name || '(unnamed)', aUnit: a.unit, b: b.name || '(unnamed)', bUnit: b.unit,
      d: +d.toFixed(4), sum: +sum.toFixed(4), miss: +(miss * 100).toFixed(2),
      ov: +(Math.min(a.hi, b.hi) - Math.max(a.lo, b.lo)).toFixed(3) });
  }
  const declared = (C.meshes ? C.meshes.rows : []).map((r) => ({ site: r.site, a: r.a, b: r.b }));
  return { rotors, cands, skewed, declared,
    nUnits: new Set(rotors.map((r) => r.unit)).size,
    named: rotors.filter((r) => r.name).length };
});

// Guard the derived fields: an earlier cut of this scan lost `lo`/`hi` to a
// bad edit and printed a confident "0 overlapping" — measuring nothing while
// looking exactly like a clean answer.
const broken = out.cands.filter((c) => !Number.isFinite(c.ov));
if (broken.length) {
  // A REPORT does not get to set an exit code — that is what the index's
  // acceptance/report split means, and a probe that judged itself non-zero
  // while judging its subject not at all would be filed as the wrong kind.
  // So this is a banner instead, and it stops the tables rather than printing
  // numbers derived from a field that is not there.
  console.log(`\n*** SELF-CHECK FAILED: ${broken.length} row(s) carry no axial overlap figure.`);
  console.log(`*** The scan measured nothing usable; the tables below are withheld rather`);
  console.log(`*** than printed as data. (An earlier cut of this file lost lo/hi to a bad`);
  console.log(`*** edit and printed a confident "0 overlapping" — clean is the dangerous`);
  console.log(`*** direction, so this says so loudly instead.)\n`);
  await browser.close(); srv.kill();
} else {

const w = (x, n) => String(x).padEnd(n);
console.log(`\nROTORS  ${out.rotors.length} carrying userData.r, across ${out.nUnits} units`);
console.log(`        named ${out.named}, unnamed ${out.rotors.length - out.named}`);
const ov = out.cands.filter((c) => c.ov > 0);
console.log(`\nCANDIDATES (parallel axes, |d − (rA+rB)| ≤ 5%)   ${out.cands.length}`);
console.log(`  rims overlap along the axis, so contact is possible   ${ov.length}`);
for (const [lo, hi] of [[0, 0.5], [0.5, 2], [2, 5]]) {
  const band = ov.filter((c) => c.miss >= lo && c.miss < hi).sort((x, y) => x.miss - y.miss);
  if (!band.length) continue;
  console.log(`\n  centre distance ${lo}–${hi}% off the pitch sum: ${band.length}`);
  for (const c of band)
    console.log(`    ${w(c.a, 22)} ${w(c.aUnit, 21)} ${w(c.b, 22)} ${w(c.bUnit, 21)} d ${w(c.d, 9)} ${c.miss}%`);
}

// The diff that is §135 item 4: metal against declaration, both directions.
const key = (a, b) => [a, b].sort().join('|');
const dec = new Set(out.declared.map((r) => key(r.a, r.b)));
const met = new Set(ov.map((c) => key(c.a, c.b)));
const undeclared = ov.filter((c) => !dec.has(key(c.a, c.b)));
const unmet = out.declared.filter((r) => !met.has(key(r.a, r.b)));
console.log(`\nDECLARED ${out.declared.length} rows in the §194 registry`);
console.log(`\n  in the metal but in NO ROW: ${undeclared.length}`);
for (const c of undeclared) console.log(`    ${w(c.a, 22)} ⇄ ${w(c.b, 22)} ${c.miss}% off the pitch sum`);
console.log(`\n  declared but not found by this scan: ${unmet.length}`);
for (const r of unmet) console.log(`    ${r.site}`);
console.log(`      (a row here is not automatically wrong — this scan's own`);
console.log(`       tolerance and overlap test are the reason the two keyless`);
console.log(`       rows sit outside it; see TODO 125.)`);
if (out.skewed.length)
  console.log(`\nOUT OF SCOPE: ${out.skewed.length} non-parallel pair(s) near the pitch sum — bevels are a mesh this scan cannot judge.`);
await browser.close(); srv.kill();
}
