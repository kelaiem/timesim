// TODO 236 — THE RELEASE SLEEVE'S GUIDES AND ITS LOAD, PRICED. An ACCEPTANCE
// test: it exits non-zero when a row fails or a control does not fire.
//
// What it answers. §45 built the release as a sleeve sliding on three eyes and
// pushed AXIALLY at one tab on its rim, and TODO 236 measured that it locked
// under its own drive with no load at all. TODO 236 rebuilt it as TODO 222's
// tripod: three rollers in helical slots, the sleeve turned by a crank pushing
// TANGENTIALLY at a fork on its rim, the lift a consequence of the helices.
// This probe prices that construction the way the build sized it, and proves
// the pricing can tell a jam from a run:
//
//   1. GUIDE FRICTION, three corners. The sleeve's own law (`releaseRun.peak`,
//      the function the build's helix solve calls — read from __clock, never
//      restated) at the cut helix and hand, at FRICTION.muPlain's favourable,
//      nominal and adverse corners: the peak drive, the throw, their product
//      W, and the work factor (drive work over the cone's own axial work).
//      Every corner must CONVERGE — a sleeve that locks has no drive force —
//      and the adverse figure must BE the build's (the §137 crank row and the
//      sizes downstream rest on it): the same law at the same inputs, so they
//      agree to float noise or one of them is not what it says.
//   2. ROW 2, the lifter, re-derived. The §137 row 'alarm release: lifter
//      (collar → link)' states the link's pull, the pad's push and the crown's
//      pull. Each is recomputed here from the sleeve's peak and the arms the
//      build cut — the link's pull is F·a_so/a_si (work through the crank),
//      the pad's F·throw/rise (work through the whole line), the crown's that
//      push through the collar's ramp, a shallow wedge at MU_STEEL — and must
//      equal the row; the link's pull must COVER the 5–50 mN detent band.
//   3. The cone, row 1. The plain wedge identity on the row's own numbers.
//
// THE CONTROLS, each a different way this could come back clean measuring
// nothing:
//   · FRICTIONLESS — every μ 0 and the paddle off, the drive's work must be
//     the cone's axial work exactly (work factor 1 at every load): a law that
//     invented or lost work would read otherwise.
//   · THE OTHER HAND LOCKS — at this drive station the helix solve found the
//     opposite hand locking at every angle in 15–60°; the probe must see the
//     law refuse it at the cut angle (no converged drive). A lock detector
//     that never fires is a comment.
//   · THE EYES RESTORED (the sabotage) — §45's construction, re-posed from
//     its own constants: three eyes ℓ 0.4567 long on posts at 105°/250°/350°,
//     r 5.15, pushed axially at one tab at r 4.90. Its drive-only lock index
//     2μ|D − G|/ℓ (TODO 222's equal-share form: a load at distance d from the
//     drive line tilts the ring against the eye couples) must reach 1 at the
//     adverse corner — the probe must call the old guide LOCKED, or it cannot
//     be believed when it calls the new one free.
//
// Usage: cd tools && node probe-236-release-run.mjs [out.json]
//        ROOT= serves a different tree.
import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import { writeFileSync } from 'node:fs';

const PORT = process.env.PORT || 8473;
const ROOT = process.env.ROOT || '..';
const srv = spawn('python3', ['-m', 'http.server', String(PORT), '--bind', '127.0.0.1'], { cwd: ROOT, stdio: 'ignore' });
await new Promise((r) => setTimeout(r, 800));
const browser = await chromium.launch({ args: ['--disable-background-timer-throttling', '--disable-backgrounding-occluded-windows', '--disable-renderer-backgrounding'] });
const page = await browser.newPage();
page.on('pageerror', (e) => console.error('PAGEERROR', String(e)));
await page.route('**/__state', (r) => r.fulfill({ status: 404, body: '' }));
await page.goto(`http://127.0.0.1:${PORT}/index.html`, { waitUntil: 'load', timeout: 120000 });
await page.waitForFunction(() => !!window.__clock || !!window.__bootError, null, { timeout: 300000 });

const V = await page.evaluate(async () => {
  const L = await import('./src/layout.js');
  const clock = window.__clock;
  const R = clock.releaseRun;
  if (!R) return { error: 'no releaseRun on __clock — the TODO 236 build is not in this tree' };
  const fail = [];
  const close = (a, b, tol = 1e-9) => Math.abs(a - b) <= tol * Math.max(1, Math.abs(a), Math.abs(b));
  const roll = (mu) => mu * R.guidePinR / R.rollerR;   // a roller on its pin pays μ at the pin's radius
  const alphaCut = R.cut.alpha, hand = R.helix.h;

  // 1. the guides' friction, three corners, at the CUT helix and hand
  const corners = {};
  for (const c of L.FRICTION_CORNERS) {
    const mu = L.FRICTION.muPlain[c];
    const p = R.peak(alphaCut, hand, { mu, muR: roll(mu) });
    corners[c] = { mu, Fmax_mN: p.Fmax * 1000, throw_u: p.throwT, W_mNu: p.W * 1000, workFactor: p.workFactor, conv: p.conv };
    if (!p.conv || !Number.isFinite(p.Fmax)) fail.push(`${c}: the sleeve LOCKS on its cut helix (no converged drive)`);
  }
  // the order is the claim: a kinder corner never costs more
  if (!(corners.favourable.Fmax_mN <= corners.nominal.Fmax_mN && corners.nominal.Fmax_mN <= corners.adverse.Fmax_mN))
    fail.push('the corners are not ordered: favourable ≤ nominal ≤ adverse');
  // the adverse figure at the SOLVED helix is the build's — the same law, the same inputs
  const solved = R.peak(R.helix.alpha, hand, {});
  if (!close(solved.Fmax, R.helix.Fmax)) fail.push(`the law re-run at the solved helix reads ${solved.Fmax} N, the build sized to ${R.helix.Fmax} N`);
  if (Math.abs(alphaCut - R.helix.alpha) > Math.PI / 180) fail.push(`the cut helix ${(alphaCut * 180 / Math.PI).toFixed(3)}° stands more than 1° off the solved ${(R.helix.alpha * 180 / Math.PI).toFixed(3)}°`);

  // 2. row 2, the lifter, re-derived from the sizes the build cut
  const rows = clock.transfers?.rows || [];
  const lifter = rows.find((r) => r.site === 'alarm release: lifter (collar → link)');
  const crank = rows.find((r) => r.site === 'alarm release: crank (link → sleeve fork, tangential)');
  const cone = rows.find((r) => r.site === 'alarm release: sleeve cone (wedge on follower A’s tail pin)');
  const S = R.sized;
  const row2 = {};
  if (!lifter || !crank || !cone) fail.push('a release-run §137 row is missing from the transfer record');
  else {
    const linkN = S.F * S.aSo / S.aSi;                        // the crank in moment balance
    const padN = S.F * S.thr / S.rise;                        // the line's whole work over the collar's rise
    const ramp = lifter.quantities.collarRamp, mu = L.MU_STEEL;
    const crownN = padN * (ramp + mu) / (1 - mu * ramp);     // the collar's ramp, a shallow wedge
    Object.assign(row2, { linkN_mN: linkN * 1000, padN_mN: padN * 1000, crownN, ramp,
      recordLink_mN: lifter.load.value, recordPad_mN: lifter.quantities.padLoad_mN, recordCrown_N: lifter.quantities.crownPull_N,
      recordDrive_mN: crank.load.value, armRatioCrank: crank.quantities.ratio, armRatioLifter: lifter.quantities.ratio,
      // the lifter's arms re-derived: its output over its input is the link's throw over the collar's rise
      lifterRatioWant: S.riseLink / S.rise });
    if (!close(linkN * 1000, lifter.load.value)) fail.push(`row 2's link pull ${lifter.load.value} mN ≠ F·a_so/a_si ${linkN * 1000}`);
    if (!close(padN * 1000, lifter.quantities.padLoad_mN)) fail.push(`row 2's pad load ${lifter.quantities.padLoad_mN} mN ≠ F·throw/rise ${padN * 1000}`);
    if (!close(crownN, lifter.quantities.crownPull_N)) fail.push(`row 2's crown pull ${lifter.quantities.crownPull_N} N ≠ the ramp's wedge ${crownN}`);
    if (!close(S.F * 1000, crank.load.value)) fail.push(`the crank row's drive ${crank.load.value} mN ≠ the sized peak ${S.F * 1000}`);
    if (!close(lifter.quantities.ratio, S.riseLink / S.rise)) fail.push(`row 2's arm ratio ${lifter.quantities.ratio} ≠ the link's throw over the rise ${S.riseLink / S.rise}`);
    if (!(linkN * 1000 >= L.SELECTOR_DETENT_WINDOW_MN[1])) fail.push(`the link's pull ${linkN * 1000} mN does not cover the ${L.SELECTOR_DETENT_WINDOW_MN[1]} mN top of the detent band`);
    // 3. row 1, the cone: the plain wedge on its own numbers
    const q = cone.quantities, t = Math.tan(q.coneAngle_deg * Math.PI / 180);
    row2.coneWant_mN = q.radial_mN * (t + q.mu) / (1 - q.mu * t);
    if (!close(row2.coneWant_mN, q.axial_mN)) fail.push(`the cone row's axial ${q.axial_mN} mN ≠ the wedge's ${row2.coneWant_mN}`);
  }

  // CONTROLS
  const controls = {};
  // · frictionless, the paddle off: the drive's work IS the cone's work
  const free = R.peak(alphaCut, hand, { mu: 0, muR: 0, paddle: false });
  controls.frictionless = free.conv && close(free.workFactor, 1, 1e-9)
    ? `PASS — work factor ${free.workFactor.toFixed(12)} with every μ 0 and the paddle off`
    : `FAIL — frictionless work factor ${free.workFactor} (converged ${free.conv})`;
  // · the other hand locks at the cut angle
  const other = R.peak(alphaCut, -hand, {});
  controls.otherHand = !other.conv
    ? `PASS — the opposite hand at ${(alphaCut * 180 / Math.PI).toFixed(2)}° does not converge (locks), as the build's solve found at every angle`
    : `FAIL — the opposite hand converged (F ${other.Fmax}): the lock detector did not fire`;
  // · the sabotage: §45's eyes and its single axial tab, re-posed from its own constants
  const D2R = Math.PI / 180, ELL = 0.4567, POST_R = 5.15, TAB_R = 4.90, TAB_AZ = 8.0;
  const posts = [105, 250, 350].map((a) => [POST_R * Math.cos(a * D2R), POST_R * Math.sin(a * D2R)]);
  const G = [0, 1].map((i) => posts.reduce((s, p) => s + p[i], 0) / 3);
  const Dt = [TAB_R * Math.cos(TAB_AZ * D2R), TAB_R * Math.sin(TAB_AZ * D2R)];
  const dDG = Math.hypot(Dt[0] - G[0], Dt[1] - G[1]);
  const eyes = {};
  for (const c of L.FRICTION_CORNERS) eyes[c] = 2 * L.FRICTION.muPlain[c] * dDG / ELL;
  controls.eyesRestored = eyes.adverse >= 1
    ? `PASS — §45's three eyes and single tab re-posed: drive-only lock index 2μ|D−G|/ℓ ${eyes.adverse.toFixed(3)} adverse (${eyes.nominal.toFixed(3)} nominal, ${eyes.favourable.toFixed(3)} favourable) — LOCKED with no load, |D−G| ${dDG.toFixed(3)}`
    : `FAIL — the restored eye guide reads index ${eyes.adverse}: the jam detector would not see §45's lock`;
  for (const [k, v] of Object.entries(controls)) if (!v.startsWith('PASS')) fail.push(`control ${k}: ${v}`);

  return {
    alphaCutDeg: alphaCut * 180 / Math.PI, alphaSolvedDeg: R.helix.alpha * 180 / Math.PI, hand, driveAzDeg: R.driveAzDeg, stationsDeg: R.stationsDeg,
    corners, row2, controls, eyesIndex: eyes, fail,
  };
});
await browser.close();
srv.kill();
if (V.error) { console.error(V.error); process.exit(2); }
const f1 = (x) => (Number.isFinite(x) ? x.toFixed(1) : String(x));
console.log(`TODO 236 — the release run, priced. Drive at ${V.driveAzDeg.toFixed(1)}°, plates at ${V.stationsDeg.map((a) => a.toFixed(0)).join('/')}°, helix cut at ${V.alphaCutDeg.toFixed(3)}° (solved ${V.alphaSolvedDeg.toFixed(3)}°), hand ${V.hand > 0 ? '+' : '−'}`);
console.log('  guide friction (FRICTION.muPlain; rollers at μ·r_pin/r_roller):');
for (const [c, r] of Object.entries(V.corners))
  console.log(`    ${c.padEnd(10)} μ ${r.mu.toFixed(2)}  peak drive ${f1(r.Fmax_mN)} mN over ${r.throw_u.toFixed(4)} u  W ${r.W_mNu.toFixed(2)} mN·u  work factor ${r.workFactor.toFixed(3)}  ${r.conv ? 'runs' : 'LOCKS'}`);
const r2 = V.row2;
console.log(`  row 2 (lifter): link ${f1(r2.linkN_mN)} mN (record ${f1(r2.recordLink_mN)}), pad ${f1(r2.padN_mN)} mN (record ${f1(r2.recordPad_mN)}), crown pull ${r2.crownN?.toFixed(4)} N through a ${(100 * r2.ramp).toFixed(2)}% ramp (record ${r2.recordCrown_N?.toFixed(4)}) — against ~1 N at a finger`);
console.log(`  row 1 (cone): wedge ${f1(r2.coneWant_mN)} mN axial (the row's own figure must equal it)`);
for (const [k, v] of Object.entries(V.controls)) console.log(`  control ${k}: ${v}`);
if (process.argv[2]) writeFileSync(process.argv[2], JSON.stringify(V, null, 2));
if (V.fail.length) { console.error('\nFAIL'); for (const f of V.fail) console.error('  ' + f); process.exit(1); }
console.log('\nPASS — every corner runs, the records equal their re-derivations, and every control fires');
