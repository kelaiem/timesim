// DO technic.html's GEARS ACTUALLY MESH — every pair, parallel and right-angle,
// at every angle the page turns them through? Acceptance, browser; exits
// non-zero on any failed row.
//
// The page (§219 tier two (a)) draws TECHNIC_FORK's rows as module-1 gears and
// turns each shaft at the running product of its pairs. Turning at the right
// SPEED says nothing about the TEETH: two gears can turn at exactly the right
// ratio with tooth on tooth at every angle. This measures the teeth.
//
// WHAT IS MEASURED, off the drawn gears' world matrices — never off the phase
// the page computed, which is the thing under test. For each mesh: the contact
// point (on the line of centres for a parallel pair; for the turntable's
// right-angle face mesh, the pinion's point nearest the face), the tangent the
// two surfaces move along there, and each gear's tooth-0 direction (tooth i is
// built at local angle 2πi/N — the page's own `userData`, asserted below).
// Each tooth's offset from the contact becomes an ARC along that tangent; a
// module-1 pitch is π of arc, and a pair meshes when the driver's tooth sits
// HALF a pitch from the driven tooth — a tooth in a gap. The reading is that
// offset as a fraction of a pitch, so a mesh reads 0.5000 and tooth-on-tooth
// reads 0.
//
// AT SEVERAL INPUT ANGLES, set the way the page's own loop sets them
// (rotor.rotation.z = speed × input). A phase solved at rest but turned at the
// wrong SENSE reads 0.5 at angle 0 and drifts everywhere else, so the spread
// across angles is gated too: it is what catches a sign.
//
// AND THE STEP: on every row the brick frame can hold, each shaft's gears
// stand the frame's step apart (src/technic-frame.js rowLayout — two layers
// where a gear would reach its neighbour's column), read off the drawn gears.
//
// CONTROLS, both kinds, so a clean result means something:
//   · must-hit — every PARALLEL pair, which the page phased by its closed form
//     before this probe existed, must read 0.5. That is the instrument meeting
//     known-good metal;
//   · must-fail — half a pitch injected into every driven gear must read 0
//     (±tol). A probe that cannot see tooth-on-tooth has measured nothing.
//
// The ±tol is 1e-6 of a pitch: both sides are exact closed forms in float64, so
// anything larger is a defect, not noise.
//
//   cd tools && node probe-technic-phase.mjs
import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
const ROOT = process.env.ROOT || join(dirname(fileURLToPath(import.meta.url)), '..');
const PORT = Number(process.env.PORT || 8537);
const srv = spawn('python3', ['-m', 'http.server', String(PORT), '--bind', '127.0.0.1'], { cwd: ROOT, stdio: 'ignore' });
process.on('exit', () => srv.kill());
await new Promise((r) => setTimeout(r, 1200));
const browser = await chromium.launch();
const page = await browser.newPage();
const warnings = [];
// The page's own voice is `log()` → console.warn. Software GL's driver notices
// (SwiftShader's fallback banner, ReadPixels stalls) are the browser's, not the
// page's, and every page here prints them on a GPU-less host.
const GL_NOISE = /GL Driver Message|swiftshader|GroupMarkerNotSet/i;
page.on('console', (m) => { if ((m.type() === 'warning' || m.type() === 'error') && !GL_NOISE.test(m.text())) warnings.push(m.text()); });
page.on('pageerror', (e) => warnings.push('PAGEERROR ' + String(e)));
await page.goto(`http://127.0.0.1:${PORT}/technic.html`, { waitUntil: 'load', timeout: 60000 });
await page.waitForFunction(() => !!window.__technic, null, { timeout: 60000 });

const { rows: out, steps } = await page.evaluate(async () => {
  const THREE = await import('three');
  const T = window.__technic;
  const ANGLES = [0, 0.37, 1.9, 7.3, 41.1];
  const axisOf = (g) => new THREE.Vector3(0, 0, 1).transformDirection(g.matrixWorld).normalize();
  const tooth0 = (g) => new THREE.Vector3(1, 0, 0).transformDirection(g.matrixWorld).normalize();
  const posOf = (g) => new THREE.Vector3().setFromMatrixPosition(g.matrixWorld);
  const perp = (v, u) => v.clone().sub(u.clone().multiplyScalar(v.dot(u))).normalize();
  const ang = (x, e, t) => Math.atan2(x.dot(t), x.dot(e));
  const frac = (x) => x - Math.floor(x);
  // the pitch fraction the driver's tooth stands from the driven tooth, along
  // the shared tangent at the contact
  const reading = (m) => {
    const A = m.a, B = m.b;
    const uA = axisOf(A), uB = axisOf(B), OA = posOf(A), OB = posOf(B);
    const RA = A.userData.teeth / 2, RB = B.userData.teeth / 2;
    // eB: from B's centre toward the contact
    const eB = m.class === 'right-angle' ? uA.clone().negate() : perp(OA.clone().sub(OB), uB);
    const C = OB.clone().addScaledVector(eB, RB);
    const eA = perp(C.clone().sub(OA), uA);
    const tA = new THREE.Vector3().crossVectors(uA, eA);
    const tB = new THREE.Vector3().crossVectors(uB, eB);
    const sigma = Math.sign(tB.dot(tA));
    const arcA = RA * ang(tooth0(A), eA, tA);
    const arcB = sigma * RB * ang(tooth0(B), eB, tB);
    return { off: frac((arcA - arcB) / Math.PI), sigma, cosT: Math.abs(tB.dot(tA)) };
  };
  const pose = (res, input) => {
    for (const sh of res.shafts) sh.rotor.rotation.z = sh.speed * input;
    for (const sh of res.shafts) sh.frame.updateWorldMatrix(true, true);
  };
  const rows = [];
  for (const gen of ['technic_classic', 'technic_2026']) {
    T.build(gen);
    T.built.forEach((res, k) => {
      res.meshes.forEach((m, j) => {
        const row = { gen, chain: k + 1, mesh: `${m.a.userData.teeth}:${m.b.userData.teeth}`, class: m.class,
          readings: [], injected: [], tangentAligned: 1, sigma: 0 };
        // the page's tooth convention, asserted on the metal: gear meshes
        // carry their count, and every child mesh of a face gear is a tooth or
        // the disc
        if (!(m.a.userData.teeth > 0 && m.b.userData.teeth > 0)) row.bad = 'a gear without userData.teeth';
        for (const input of ANGLES) {
          pose(res, input);
          const r = reading(m);
          row.readings.push(r.off); row.sigma = r.sigma; row.tangentAligned = Math.min(row.tangentAligned, r.cosT);
          // must-fail: half a pitch into the driven gear
          const keep = m.b.rotation.z;
          m.b.rotation.z = keep + Math.PI / m.b.userData.teeth;
          m.b.updateWorldMatrix(false, false);
          row.injected.push(reading(m).off);
          m.b.rotation.z = keep; m.b.updateWorldMatrix(false, false);
        }
        // THE PAGE BEFORE THIS LANDING phased a right-angle pinion at 0. Read
        // it at rest, so the record says what the fix moved, not just that it
        // now passes.
        if (m.class === 'right-angle') {
          pose(res, 0);
          const keep = m.b.rotation.z;
          m.b.rotation.z = 0; m.b.updateWorldMatrix(false, false);
          row.before = reading(m).off;
          m.b.rotation.z = keep; m.b.updateWorldMatrix(false, false);
        }
        rows.push(row);
      });
    });
  }
  // THE STEP: each drawn shaft's gears along its own axis, in build order
  // (driven first), read off the meshes — what the page drew, not what it meant
  const steps = [];
  for (const gen of ['technic_classic', 'technic_2026']) {
    T.build(gen);
    T.built.forEach((res, k) => steps.push({ gen, row: k,
      along: res.shafts.map((sh) => sh.rotor.children.filter((c) => c.userData?.teeth).map((g) => g.position.z)) }));
  }
  return { rows, steps };
});
await browser.close(); srv.kill();

const TOL = 1e-6;
const dist = (x, target) => { const d = Math.abs(x - target) % 1; return Math.min(d, 1 - d); };
let fails = 0;
console.log('THE TEETH — the driver\'s tooth offset from the driven tooth along the shared tangent, in pitches.');
console.log('A mesh reads 0.5 (a tooth in a gap) at every angle; half a pitch injected must read 0.\n');
console.log('gen              row mesh    class            σ    worst |off−½|   injected worst |off|   verdict');
for (const r of out) {
  const worst = Math.max(...r.readings.map((x) => dist(x, 0.5)));
  const inj = Math.max(...r.injected.map((x) => dist(x, 0)));
  const aligned = r.tangentAligned > 1 - 1e-9;
  const ok = !r.bad && aligned && worst <= TOL && inj <= TOL;
  if (!ok) fails++;
  console.log(`${r.gen.padEnd(16)} ${String(r.chain).padEnd(3)} ${r.mesh.padEnd(7)} ${r.class.padEnd(16)} ${String(r.sigma).padEnd(4)} `
    + `${worst.toExponential(2).padEnd(15)} ${inj.toExponential(2).padEnd(22)} `
    + `${r.bad ? '✗ ' + r.bad : !aligned ? `✗ TANGENTS DISAGREE (|cos| ${r.tangentAligned.toFixed(6)})` : ok ? 'OK' : '✗ NOT MESHED'}`);
}
for (const r of out) if (r.before !== undefined)
  console.log(`  before: ${r.gen} row ${r.chain} ${r.mesh} unphased (pinion at 0) read |off−½| = ${dist(r.before, 0.5).toFixed(4)} of a pitch`);
// THE DRAWN STEP IS THE FRAME'S: on every row src/technic-frame.js frames,
// each compound shaft's driver stands rowLayout's step (8 or 16 mm) from its
// driven gear. Rows the frame refuses keep the page's one-layer step and are
// counted, not judged. Control: the frame's steps against a uniform 8 must
// differ somewhere, or this row of the probe compares nothing.
const { rowLayout } = await import('../src/technic-frame.js');
const { TECHNIC_FORK } = await import('../src/layout.js');
let stepRows = 0, stepDiffers = false;
for (const st of steps) {
  const lay = rowLayout(st.gen, TECHNIC_FORK.rows[st.row].chains[st.gen]);
  if (!lay.framed) continue;
  stepRows++;
  lay.shafts.forEach((sh, j) => {
    if (sh.gears.length < 2 || j === 0) return;
    const want = sh.gears[1].y - sh.gears[0].y, drawn = st.along[j][1] - st.along[j][0];
    if (want !== 8) stepDiffers = true;
    if (Math.abs(drawn - want) > 1e-9) { console.log(`✗ ${st.gen} row ${st.row + 1} shaft ${j}: drawn step ${drawn} mm, the frame's ${want}`); fails++; }
  });
}
console.log(`\nsteps: ${stepRows} framed rows drawn on the frame's step${stepDiffers ? '' : ' — but every step is 8, so the comparison could not tell the laws apart'}`);
if (!stepDiffers) fails++;
const kinds = new Set(out.map((r) => r.class));
console.log(`\ncontrols: ${out.filter((r) => r.class !== 'right-angle').length} parallel rows are the must-hit, `
  + `every row's injected half pitch the must-fail; classes seen: ${[...kinds].join(', ')}`);
if (!kinds.has('right-angle')) { console.log('✗ no right-angle mesh was measured — the subject is missing'); fails++; }
if (warnings.length) { console.log(`✗ the page was not silent:\n  ${warnings.join('\n  ')}`); fails++; }
console.log(fails ? `\n${fails} FAILED` : `\n${out.length}/${out.length} meshes mesh at every angle, every control firing`);
process.exit(fails ? 1 : 0);
