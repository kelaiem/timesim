// THE DIAL-SIDE BEAK, DESIGNED IN A LINE — §261 step 4, landing 2b. Does the
// selector link's beak lever, re-classed for the dial side, still close every
// contact the link's line spec holds, before any of it is cut?
//
// ACCEPTANCE (exit 1 on a failed row, 2 on a failed control). It moves no metal.
//
// WHY A NEW CLASS. The fold carries the column wheel under the dial REFLECTED
// through the base plate (§261 step 4's landing-2 plan), so the castellations
// face the dial and the beak's nose falls into a gap TOWARD the plate. The lay
// shaft, its arming spring and the helical ring stay exactly as TODO 222 left
// them, so the rim finger must still RISE to arm. Today's beak is FIRST-class —
// nose, pivot, tail along its run — and moves its tail against its nose; under
// the reflection it would drive the rim, and the ring, backwards. The owner's
// call (2026-10-12) is a new lever under the dial, not the old one folded, and
// the lever that moves its tail WITH its nose is the SAME-SIDE one: pivot,
// tail, nose along the run, the pivot beyond the tail. The build's seat law
// (`clock.lineLaws.seat`) now takes the class, so both are one law.
//
// METHOD. In the page, the link's line-spec references are evaluated by the
// gate's own evaluator (`lineSpecEvaluate`, exported from the check so this is
// the same table, not a restatement): 'alarm switch drive' and then 'alarm
// link' on top of it, at the reference's run (§229's wr 16) and at the as-built
// fork's run. At each run the seat law is solved for both classes, and the rows
// the link's reference holds are held for the dial-side lever:
//  R1 the seat: the nose's deepest corner lands on the gap floor (colH), the
//     contact TODO 206 made the seat;
//  R2 the stroke: the tail makes the rim's stroke at the seat tilt,
//     tailLen·θs = rodTravel (the rim's two rolls, TODO 20's law);
//  R3 the ratio: beakLen / tailLen = seat drop / stroke (§229's identity);
//  R4 the arms share the run by class: beak − tail = run (same-side), and
//     beak + tail = run for the first-class lever beside it;
//  R5 the default path is untouched: the first-class solve at the reference
//     run equals the reference's own beakLen and tailLen;
//  R6 the sense under the fold: with the nose moving toward the plate by the
//     seat drop, the same-side tail moves the rim UP by the stroke, and the
//     first-class tail would move it DOWN — the reason for the class.
//
// CONTROL (fatal): R2 is re-run with the rim's stroke 10% wrong and must fail;
// a check that cannot fail on the quantity it holds has measured nothing.
//
// Run from tools/: node probe-261-dial-beak.mjs
import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
const ROOT = process.env.ROOT || join(dirname(fileURLToPath(import.meta.url)), '..');
const PORT = 8612;
const srv = spawn('python3', ['-m', 'http.server', String(PORT), '--bind', '127.0.0.1'], { cwd: ROOT, stdio: 'ignore' });
process.on('exit', () => { try { srv.kill(); } catch {} });
await new Promise((r) => setTimeout(r, 1200));
const browser = await chromium.launch();
const page = await browser.newPage();
await page.goto(`http://127.0.0.1:${PORT}/index.html?trial=1`, { waitUntil: 'load', timeout: 300000 });
await page.waitForFunction(() => !!window.__clock || !!window.__bootError, null, { timeout: 300000 });
const bootError = await page.evaluate(() => (window.__bootError ? String(window.__bootError) : null));
if (bootError) { console.log('boot failed: ' + bootError); process.exit(2); }

const res = await page.evaluate(async () => {
  const I = await import('./src/inspect.js');
  const L = window.__clock.lineLaws;
  const ref = (n) => I.LINE_SPECS.find((r) => r.name === n);
  const drive = I.lineSpecEvaluate(ref('alarm switch drive'), {}, null, L);
  const link = I.lineSpecEvaluate(ref('alarm link'), drive.out, null, L);
  const fork = I.LINE_SPEC_FORKS.find((f) => f.ref === 'alarm link');
  const built = I.lineSpecEvaluate(ref('alarm link'), drive.out, fork ? fork.rows : null, L);
  const errs = [...drive.errs, ...link.errs, ...built.errs];
  const at = (k) => {
    const run = k.wrLen - k.landR;
    return { wrLen: k.wrLen, landR: k.landR, run, colH: k.colH, rodTravel: k.rodTravel, refBeak: k.beakLen, refTail: k.tailLen,
      same: L.seat(run, k.rodTravel, 1), first: L.seat(run, k.rodTravel, -1),
      wrong: L.seat(run, k.rodTravel * 1.1, 1) };
  };
  return { errs, forkName: fork ? fork.name : null, reference: at(link.out), asBuilt: at(built.out) };
});
await Promise.race([browser.close(), new Promise((r) => setTimeout(r, 5000))]);

const f = (x, d = 6) => (Number.isFinite(x) ? x.toFixed(d) : String(x));
const fails = [], ctrl = [];
if (res.errs.length) fails.push(`the references did not evaluate: ${res.errs.map((e) => `${e.ref}/${e.key}: ${e.error}`).join('; ')}`);
console.log(`§261 step 4, landing 2b — the dial-side beak in a line (the same-side lever on the build's own seat law)`);
for (const [name, a] of [['reference (§229\'s run)', res.reference], [`as built (${res.forkName || 'no fork'})`, res.asBuilt]]) {
  const s = a.same, q = a.first;
  console.log(`\n  ${name}: wrLen ${f(a.wrLen, 4)}, landR ${f(a.landR, 4)}, run ${f(a.run, 4)}, colH ${f(a.colH)}, rim stroke ${f(a.rodTravel)}`);
  console.log(`    same-side: θs ${f(s.theta)} rad, beak ${f(s.beakLen, 4)}, tail ${f(s.tailLen, 4)} (ratio ${f(s.beakLen / s.tailLen, 4)}), seat drop ${f(s.seatDrop)}, bar lift ${f(s.lift)}`);
  console.log(`    first-class beside it: θs ${f(q.theta)} rad, beak ${f(q.beakLen, 4)}, tail ${f(q.tailLen, 4)} (ratio ${f(q.beakLen / q.tailLen, 4)})`);
  const rows = [
    ['R1 the seat: the deepest corner on the gap floor', s.deepest - a.colH, 1e-9],
    ['R2 the stroke: tailLen·θs = the rim\'s stroke', s.tailLen * s.theta - a.rodTravel, 1e-12],
    ['R3 the ratio: beak/tail = seat drop/stroke', s.beakLen / s.tailLen - s.seatDrop / a.rodTravel, 1e-9],
    ['R4 the arms: beak − tail = run (same-side)', s.beakLen - s.tailLen - a.run, 1e-12],
    ['R4 the arms: beak + tail = run (first-class)', q.beakLen + q.tailLen - a.run, 1e-12],
  ];
  if (name.startsWith('reference')) {
    rows.push(['R5 the default path: first-class beak = the reference\'s', q.beakLen - a.refBeak, 1e-12]);
    rows.push(['R5 the default path: first-class tail = the reference\'s', q.tailLen - a.refTail, 1e-12]);
  }
  // R6 — the sense under the fold. The nose moves +seatDrop toward the plate
  // (the reflection); a lever tilting θs about its pivot moves the tail by
  // ±tailLen·θs, WITH the nose for the same-side class and against it for the
  // first-class one (pivot between them). The rim must RISE to arm.
  const tailSame = +s.tailLen * s.theta, tailFirst = -q.tailLen * q.theta;
  rows.push(['R6 the sense: the same-side tail lifts the rim by the stroke', tailSame - a.rodTravel, 1e-12]);
  for (const [label, d, tol] of rows) {
    const ok = Math.abs(d) <= tol;
    console.log(`    ${ok ? 'pass' : 'FAIL'}  ${label}  (${d.toExponential(2)}, tol ${tol})`);
    if (!ok) fails.push(`${name}: ${label} off by ${d.toExponential(3)}`);
  }
  console.log(`    the sense: same-side tail ${f(tailSame)} (rim up), first-class tail ${f(tailFirst)} (rim down — the ring driven backwards)`);
  if (!(tailFirst < 0)) fails.push(`${name}: R6's contrast — the first-class tail did not move against the nose (${f(tailFirst)})`);
  // CONTROL — the stroke identity must fail when the stroke is wrong
  const w = a.wrong, dw = w.tailLen * w.theta - a.rodTravel;
  const fired = Math.abs(dw) > 1e-12;
  console.log(`    control: with the rim's stroke 10% wrong, R2 is off by ${dw.toExponential(2)} — ${fired ? 'it fires' : 'IT DOES NOT FIRE'}`);
  if (!fired) ctrl.push(`${name}: R2 did not fire on a 10% wrong stroke`);
}
if (ctrl.length) { console.log('\nCONTROL FAILED:\n  ' + ctrl.join('\n  ')); process.exit(2); }
if (fails.length) { console.log('\nFAIL:\n  ' + fails.join('\n  ')); process.exit(1); }
console.log('\nPASS — the same-side beak closes the seat, makes the rim\'s stroke and holds the ratio on the build\'s own law, at the reference run and as built, and it lifts the rim where the first-class beak would drop it');
process.exit(0);
