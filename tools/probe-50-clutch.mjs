// TODO 50 — the stem clutch, measured in the movement.
//
// Three tiers, fast (no sweeps):
//  1. BUILD: the split's pieces exist, the coupling's seated pair measures
//     contact at slip 0 and the ride law's lift matches the metal at a
//     mid-ramp pose (mesh-vs-mesh clearance ≈ 0 both times — the spring
//     holds the one-sided constraint closed at every parity).
//  2. TICK LAWS: the sub-pitch corrections — forward take-up (a backward
//     wiggle then forward drive banks LESS by exactly the parked gap),
//     knob hold through the drain while the gap closes, and the seated
//     pitch invariant (slip returns to ≡ 0 mod pitch after take-up).
//  3. CHECKS: the focused battery checks that judge the new unit —
//     support, graph, assembly, stemClutchHandoff, restoring.
//
// Ports: 8483. Run: node tools/probe-50-clutch.mjs
import { spawn } from 'node:child_process';
import { chromium } from 'playwright';

const ROOT = new URL('..', import.meta.url).pathname;
const PORT = 8483;
const srv = spawn('python3', ['-m', 'http.server', String(PORT)], { cwd: ROOT, stdio: 'ignore' });
await new Promise((r) => setTimeout(r, 800));
const browser = await chromium.launch();
try {
  const page = await browser.newPage();
  const warns = [];
  page.on('console', (m) => { if (m.type() === 'warning') warns.push(m.text()); });
  await page.goto(`http://127.0.0.1:${PORT}/index.html`, { waitUntil: 'networkidle' });
  await page.waitForFunction(() => window.__clock, null, { timeout: 60000 });

  const build = await page.evaluate(() => {
    const c = window.__clock;
    const names = [];
    c.scene.traverse((o) => {
      if (o.isMesh && /^(clutch|windPinionSaw|stemSquare|yokeSpring|windingPinion)/.test(o.name)) names.push(o.name);
    });
    return { names: [...new Set(names)].sort(), pitch: c.stemSawPitch, slip: c.windStemSlip,
             stemRadPerTurn: c.stemRadPerTurn,
             sawHands: (() => { const h = {}; c.scene.traverse((o) => { if (o.userData?.sawHand !== undefined) h[o.name] = o.userData.sawHand; }); return h; })() };
  });
  console.log('build:', JSON.stringify(build));

  const laws = await page.evaluate(async () => {
    const c = window.__clock;
    const out = {};
    const P = c.stemSawPitch;
    // TODO 115 — WHICH WAY IS "FORWARD" IS NOT A CONSTANT. The crown's winding
    // direction reverses with the movement, so every stroke below is written in
    // winding-positive crown radians and converted here, off the one gearing
    // constant the build and the tick both use. Hard-coding + as forward is how
    // this probe would have reported a reversed movement's one-way as broken
    // (or, worse, an unwind stroke as a wind).
    const W = Math.sign(c.stemRadPerTurn);
    const wind = (r) => c.setCrownRotation(c.crownRotation + W * r);
    const slipW = () => W * c.windStemSlip;                // winding-positive slip
    // seated: drive baseline
    c.resetInputs();
    c.setPose({ tau: 0.13, crownPullT: 0, leverEngage: 0, tension: 0.5 });
    const bank0 = c.barrelWindTurns;
    // a backward half-pitch of crown, then the same forward amount + one pitch:
    // the forward input must first re-swing the parked gap before banking.
    wind(-0.5 * P); c.step(1 / 60);
    out.slipAfterBack = slipW();                           // ≈ −0.5·P
    const gap = ((-slipW()) % P + P) % P;
    wind(0.5 * P); c.step(1 / 60);
    out.slipAfterTakeUp = slipW();                         // ≈ 0 (mod P)
    out.bankAfterTakeUp = c.barrelWindTurns - bank0;       // ≈ 0 — the whole stroke was take-up
    out.gapWas = gap;
    // now a clean forward pitch banks fully:
    wind(P); c.step(1 / 60);
    out.bankAfterDrive = c.barrelWindTurns - bank0;        // ≈ P through the 3:1 ratio /2π
    // knob hold through the drain: park a gap, run time, knob must not move
    // until the gap closes.
    c.resetInputs();
    c.setPose({ tau: 0.13, crownPullT: 0, leverEngage: 0, tension: 0.5 });
    wind(-0.25 * P); c.step(1 / 60);
    const slipParked = slipW();
    const stemRotAt = () => c.stemRadPerTurn * (c.barrelWindTurns - 1.75) + c.windStemSlip;
    const knob0 = stemRotAt();
    for (let i = 0; i < 240; i++) c.step(0.5);            // 120 s of run — drains a little
    out.knobDriftDuringPickup = stemRotAt() - knob0;      // ≈ 0 while the gap absorbs the drain
    out.slipPickedUp = slipW() - slipParked;              // > 0: the gap closing
    // TODO 115 — and the knob must TRACK THE HAND: one radian of winding crown
    // is one radian of knob, whichever way winding is. Stepped through the
    // shipped tick rather than re-derived, because the identity spans the input
    // branch, the gearing constant and the display.
    c.resetInputs();
    c.setPose({ tau: 0.13, crownPullT: 0, leverEngage: 0, tension: 0.5 });
    const k0 = stemRotAt(), cr0 = c.crownRotation;
    wind(0.5 * P); c.step(1 / 60);
    out.knobPerCrown = (stemRotAt() - k0) / (c.crownRotation - cr0);   // must be +1
    return out;
  });
  console.log('laws:', JSON.stringify(laws, null, 1));

  // PAIR SWEEP — the coupling's measured pair clearance across a pitch of
  // slip, via the same instrument the handoff check reads. Constant burial
  // ⇒ an axial stack shortfall; burial growing along the ramp ⇒ an index
  // or ramp-slope disagreement between metal and law.
  const sweep = await page.evaluate(async () => {
    const c = window.__clock;
    const I = await import('./src/inspect.js');
    const P = c.stemSawPitch;
    const W = Math.sign(c.stemRadPerTurn);   // TODO 115 — the slip axis is winding-positive here too
    const rows = [];
    for (let k = 0; k <= 10; k++) {
      const slip = -(k / 10) * P;
      c.resetInputs();
      c.setPose({ tau: 0.13, crownPullT: 0, leverEngage: 0, tension: 1, windStemSlip: W * slip });
      const m = I.measureHandoffsNow(c, { handoffs: I.STEM_CLUTCH_HANDOFFS });
      rows.push([+(-slip / P).toFixed(2), +m[0].gap.toFixed(4)]);
    }
    return rows;
  });
  console.log('pairSweep (d/P vs gap):', JSON.stringify(sweep));

  const checks = {};
  for (const name of ['support', 'graph', 'assembly', 'stemClutchHandoff', 'restoring', 'stockFloor', 'intraUnit']) {
    const r = await page.evaluate(async (n) => {
      const I = await import('./src/inspect.js');
      I.start(window.__clock, n, {});
      for (let i = 0; i < 2400; i++) {
        await new Promise((res) => setTimeout(res, 100));
        const s = I.status(n);
        if (s.state && s.state !== 'running') return { name: n, state: s.state, result: s.result };
      }
      return { name: n, result: 'TIMEOUT' };
    }, name);
    const res = r.result ?? {};
    const summary = { state: r.state };
    for (const k of ['failures', 'violations', 'unwaived', 'rows', 'splits', 'ok', 'malformed', 'stale',
      'notInGraph', 'ungrounded', 'missingFromScene', 'undriven', 'anchorFailures', 'unmatchedSelectors', 'degenerate'])
      if (res[k] !== undefined) summary[k] = Array.isArray(res[k]) ? res[k].length : res[k];
    console.log(`check ${name}:`, JSON.stringify(summary));
    for (const k of ['failures', 'violations', 'unwaived', 'unmatchedSelectors', 'notInGraph', 'ungrounded', 'undriven', 'anchorFailures', 'degenerate'])
      if (Array.isArray(res[k]) && res[k].length)
        console.log(`  ${k}:`, JSON.stringify(res[k]).slice(0, 2400));
    checks[name] = summary;
  }
  console.log(warns.length ? `WARNINGS (${warns.length}):\n  ${warns.join('\n  ')}` : 'boot silent (no warnings)');
} finally {
  await browser.close();
  srv.kill();
}
