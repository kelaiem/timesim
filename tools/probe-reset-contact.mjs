// The seconds-reset contact, measured rather than assumed.
//
// The reported defect: "the heart cam moves too soon before the reset hammer
// strikes it". The cam's angle used to be a time-constant ease gated on
// `leverEngage > 0.001`, so it started turning on the first frame of the
// crown's travel — with the roller still most of a stroke clear of the metal.
//
// This probe pairs the cam's motion with an INDEPENDENT gap: the roller's
// centre is read from the hammer's own world matrix, and the heart's outline
// from its mesh VERTICES, so nothing here goes through the tick law's own
// heartFreeAngleAt. The claim under test is one line — the cam does not move
// while that gap is open — plus the two ends of the stroke: the seat drives
// the display to zero, and lifting the hammer leaves the cam where it stood.
//
// Run from tools/ with a Playwright Chromium: `node probe-reset-contact.mjs`.
import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
const port = process.env.PORT || '8473';
const root = process.env.ROOT || '..';
const srv = spawn('python3', ['-m', 'http.server', port, '--bind', '127.0.0.1'], { cwd: root, stdio: 'ignore' });
await new Promise((r) => setTimeout(r, 900));
const browser = await chromium.launch();
const page = await browser.newPage();
page.on('pageerror', (e) => console.log('PAGEERROR', String(e)));
await page.goto(`http://127.0.0.1:${port}/index.html`, { waitUntil: 'load', timeout: 90000 });
await page.waitForFunction(() => !!window.__clock, null, { timeout: 90000 });

const runs = await page.evaluate(async () => {
  const C = window.__clock;
  const find = (n) => C.labelEntries.find((e) => e.name === n)?.obj ?? null;
  const camUnit = find('Heart cam (seconds reset)');
  const hamUnit = find('Reset hammer');

  // The roller: the hammer's cylinder standing off the pivot. Picked by shape
  // and distance rather than by name, so this does not depend on the builder's
  // child order.
  let roller = null;
  hamUnit.traverse((o) => {
    if (!o.isMesh || o.geometry.type !== 'CylinderGeometry') return;
    if (!roller || Math.hypot(o.position.x, o.position.y) > Math.hypot(roller.position.x, roller.position.y)) roller = o;
  });
  const rollerR = roller.geometry.parameters.radiusTop;
  // The heart's outline, as vertices in ITS OWN frame (the arbor's rotation is
  // what we are measuring, so the sample must not carry it).
  const heartMeshes = [];
  camUnit.traverse((o) => { if (o.isMesh) heartMeshes.push(o); });

  // FACETING BAND. Both bodies are polygons: the roller is a 14-sided prism
  // inscribed in its radius, the heart a 96-segment outline whose chords lie
  // inside the cut curve. So a gap taken as "distance to a heart VERTEX minus
  // the roller's nominal radius" reads up to this much tighter than the two
  // meshes really are, and a tangent contact reads as a small overlap. It is
  // the resolution of the measurement, not a finding — quoted with every row.
  const rollerSeg = roller.geometry.parameters.radialSegments;
  const TOL = rollerR * (1 - Math.cos(Math.PI / rollerSeg));
  const worldOf = (o) => {
    o.updateWorldMatrix(true, false);
    const m = o.matrixWorld.elements;
    return { x: m[12], y: m[13] };
  };
  // Min planar distance from a world point to the heart's surface, taken over
  // the heart's own vertices pushed through its current world matrix.
  const gapNow = () => {
    const rc = worldOf(roller);
    let best = Infinity;
    for (const m of heartMeshes) {
      m.updateWorldMatrix(true, false);
      const e = m.matrixWorld.elements;
      const p = m.geometry.attributes.position;
      for (let i = 0; i < p.count; i++) {
        const x = p.getX(i), y = p.getY(i), z = p.getZ(i);
        const wx = e[0] * x + e[4] * y + e[8] * z + e[12];
        const wy = e[1] * x + e[5] * y + e[9] * z + e[13];
        const d = Math.hypot(wx - rc.x, wy - rc.y);
        if (d < best) best = d;
      }
    }
    return best - rollerR;
  };

  const out = [];
  for (const startTau of [3, 11, 19, 27, 41, 53]) {   // six cam phases round the turn
    C.resetInputs();
    C.setPose({ tau: 0, crownPullT: 0, leverEngage: 0, tension: 1 });
    for (let i = 0; i < Math.round(startTau * 10); i++) C.step(0.1);
    // THE QUANTITY IS THE ZERO REFERENCE, NOT THE CAM'S ANGLE. The heart is
    // friction-coupled to the fourth wheel, so it turns with the train
    // whether or not anything touches it — comparing rotation.z against zero
    // would flag the watch simply running. secondsZeroRef is how far the
    // hammer has SHIFTED it, and that is what may not move while the roller
    // is clear of the metal.
    const refBefore = C.secondsZeroRef;
    const rows = [];
    document.getElementById('btn-crown').click();          // pull: the shipped eased path
    for (let i = 0; i < 90; i++) {
      C.step(1 / 60);
      rows.push({ gap: gapNow(), ref: C.secondsZeroRef });
    }
    // The SMALL SECONDS hand, not `displayTime`: the heart rides a slip-
    // coupled display arbor, so the reset moves that hand and deliberately
    // leaves the real train's time alone.
    const handSec = () => {
      let a = (C.fourthAngle - C.secondsZeroRef) % (2 * Math.PI);
      if (a > Math.PI) a -= 2 * Math.PI;
      if (a < -Math.PI) a += 2 * Math.PI;
      return (a / (2 * Math.PI)) * 60;
    };
    const secAtSeat = handSec();
    const refSeated = C.secondsZeroRef;
    // …then push the crown back in: the reference must stay exactly where the
    // hammer left it, and the hand resume counting up from there.
    document.getElementById('btn-crown').click();
    for (let i = 0; i < 90; i++) C.step(1 / 60);
    const refAfterLift = C.secondsZeroRef;

    let movedWhileClear = 0, firstMoveGap = null, prev = refBefore;
    for (const r of rows) {
      const d = Math.abs(r.ref - prev);
      if (d > 1e-9 && firstMoveGap === null) firstMoveGap = r.gap;
      if (r.gap > TOL && d > movedWhileClear) movedWhileClear = d;
      prev = r.ref;
    }
    out.push({
      startTau,
      refBefore: +refBefore.toFixed(5),
      refSeated: +refSeated.toFixed(5),
      refAfterLift: +refAfterLift.toFixed(5),
      minGap: +Math.min(...rows.map((r) => r.gap)).toFixed(5),
      buried: +Math.max(0, -Math.min(...rows.map((r) => r.gap)) - TOL).toFixed(5),
      firstMoveGap: firstMoveGap === null ? null : +firstMoveGap.toFixed(5),
      movedWhileClear: +movedWhileClear.toFixed(9),
      secAtSeat: +secAtSeat.toFixed(4),
      tol: +TOL.toFixed(5),
    });
  }
  return out;
});

console.log(`faceting band (14-gon roller in a ${runs[0].tol > 0 ? 'r=0.7' : '?'} circle): ±${runs[0].tol} — gaps inside it are a tangent contact\n`);
console.log('start τ | zeroRef before →  seated | after lift | min gap | buried | gap at 1st move | ref moved while clear | hand s');
for (const r of runs) {
  console.log(`${String(r.startTau).padStart(6)}  | ${r.refBefore.toFixed(4).padStart(9)} → ${r.refSeated.toFixed(4).padStart(9)} `
    + `| ${r.refAfterLift.toFixed(4).padStart(9)} | ${r.minGap.toFixed(4).padStart(7)} | ${r.buried.toFixed(4).padStart(6)} `
    + `| ${String(r.firstMoveGap).padStart(15)} | ${r.movedWhileClear.toExponential(2).padStart(21)} | ${r.secAtSeat.toFixed(4)}`);
}
const bad = runs.filter((r) => r.movedWhileClear > 1e-9);
const held = runs.filter((r) => Math.abs(r.refAfterLift - r.refSeated) > 1e-9);
const zero = runs.filter((r) => Math.abs(r.secAtSeat) > 0.02);
const deep = runs.filter((r) => r.buried > 1e-4);
console.log(`\nreference moved while the roller was clear: ${bad.length}/${runs.length}`);
console.log(`reference drifted after the hammer lifted:  ${held.length}/${runs.length}`);
console.log(`roller buried past the faceting band:       ${deep.length}/${runs.length}`);
console.log(`seat did not zero the hand (±0.02 s):       ${zero.length}/${runs.length}`);
await browser.close();
srv.kill();
process.exit(bad.length + held.length + zero.length + deep.length ? 1 : 0);
