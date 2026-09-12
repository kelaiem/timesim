// DOES THE MOTION WORKS COUNTER-ROTATE? — TODO 124's gate, and its diagnosis.
//
// The claim under test is the weakest one a gear pair can make: two wheels in
// MESH turn opposite ways, at the ratio their tooth counts fix. Measured, the
// movement's headline 12:1 does not: both motion-works meshes read the right
// ratio MAGNITUDE with the sign INVERTED (+0.333333, +0.250000), which is
// tooth tip meeting tooth tip rather than tooth entering gap — `meshPhase`
// reads the same defect from the other side as 50.00% of a pitch, the worst
// value that measure can take.
//
// This is NOT probe-coaxial-sense.mjs, the nearest relative, whose azimuth
// method this borrows wholesale and whose posture it copies. That one asks
// whether parts sharing ONE ARBOR turn together; this asks whether parts
// sharing a MESH turn oppositely. A tree can pass that one and fail this one.
// It is also not probe-train-mesh-phase.mjs (the going train's phase while it
// runs) or probe-mesh-transmission.mjs (every declared mesh's ratio at the
// registry level): this one is the motion works close up, with the cause
// attached.
//
// WHAT IT FOUND, AND WHY TODO 124's FIRST DIAGNOSIS WAS WRONG. That item
// concluded "the angles are computed from the ratio rather than arriving
// through the teeth". They are not: MW_RATIO_1/2 are ALREADY signed
// tooth-count quotients (`-(cannonPinionTeeth / MW_MINUTE_TEETH)`), so the
// ratio carries the minus sign and cannot produce a positive reading. The
// item's exclusion of the dialFace mirror is sound — all three members ARE in
// that one frame — but the defect is the frame SEAM, not the mirror:
// `cannonPinion`, `motionWorks` (hence `mwArbor`) and `hourWheelGroup` are all
// dialFace children, and of the movement's six dial-side rotation writes
// `mwArbor` is the ONLY one missing TODO 115's negation, sitting between two
// members that both carry it. That is TODO 129's class of defect (an
// incomplete enumeration of dial-side parts keyed to a going-train quantity),
// not a missing-causality one.
//
// HOW IT MEASURES — frame-free, because every hand-reasoned sign in this area
// has been wrong at least once (probe-coaxial-sense's own warning, earned).
// For each part take the world image of its local +X basis — a MATERIAL
// direction scribed on the metal — and accumulate its azimuth in the world XY
// plane across a fine tau sweep. Nothing here reasons about frames, so the
// dialFace Y-flip cannot touch the reading.
//
// CONTROLS, both kinds, on the going train — a pair independently solved and
// known good, so the method is bracketed on metal that is NOT the subject:
//   · must-hit  — Third -> Fourth are ONE mesh apart and must read NEGATIVE;
//   · must-miss — the same pair with a negation injected into one member must
//     read POSITIVE, which proves the method can SEE a co-rotation rather than
//     only ever agreeing with the tree.
// GUARDS against the clean-but-empty result (.claude/skills/instruments): each
// part's spin axis is asserted parallel to world z (else the azimuth means
// nothing) and each part's accumulated turn asserted non-zero, so no row can
// pass by standing still.
//
// THE COUNTERFACTUAL, printed beside the verdict: the same sweep with
// `mwArbor.rotation.z` negated in place — exactly the edit the diagnosis
// proposes. Before the fix it names the cause; after the fix it is a must-miss
// on the subject itself, since re-negating must break what the fix repaired.
//
// ACCEPTANCE — exits non-zero. It shipped RED on purpose (the posture
// probe-coaxial-sense.mjs established for TODO 115: the finding lands first and
// its fix turns the gate green) and it is GREEN now, holding the sense TODO 124
// restored. Keep it: the defect it catches is a one-character edit away at all
// times, and nothing else in the battery can see it — two wheels whose angles
// are written with the wrong relative sign sweep exactly the same volumes as
// two that are geared, which is why this went unnoticed until §220's sapphire
// dial made the works visible from the front.
//
// It is deliberately INDEPENDENT of the phase clocking that closed the item's
// other half. Sense and phase are different quantities: a correctly clocked
// pair can still co-rotate, and this measures the ratio, not the residual.
// meshPhase gates the clocking; this gates the sense.
// Run from tools/ with a Playwright Chromium: `node probe-124-motionworks-sense.mjs`.
import { chromium } from 'playwright';
import { spawn } from 'node:child_process';

const port = process.env.PORT || '8492';
const root = process.env.ROOT || '..';
const srv = spawn('python3', ['-m', 'http.server', port, '--bind', '127.0.0.1'], { cwd: root, stdio: 'ignore' });
await new Promise((r) => setTimeout(r, 1200));
const browser = await chromium.launch();
const page = await browser.newPage();
page.on('pageerror', (e) => console.log('PAGEERROR', String(e)));
await page.goto(`http://127.0.0.1:${port}/index.html`, { waitUntil: 'load', timeout: 90000 });
await page.waitForFunction(() => !!window.__clock, null, { timeout: 90000 });

const out = await page.evaluate(async () => {
  const C = window.__clock;
  // The bars are the signed tooth-count quotients. Read from layout.js, the
  // source the build itself cuts from — never retyped here, and never behind a
  // `??` default, which would let a renamed export pass as a healthy run.
  const L = await import('./src/layout.js');
  for (const k of ['cannonPinionTeeth', 'MW_MINUTE_TEETH', 'MW_PINION_TEETH', 'MW_HOUR_TEETH'])
    if (!Number.isFinite(L[k])) return { fatal: `layout.js exports no numeric ${k} — the bar cannot be derived` };
  const unit = (n) => C.labelEntries.find((e) => e.name === n)?.obj ?? null;
  const named = (nm) => { let f = null; C.scene.traverse((o) => { if (o.name === nm) f = o; }); return f; };

  // `mwArbor` — the compound minute wheel + minute pinion group — carries no
  // name of its own, so reach it through the metal: the minute wheel's topmost
  // ancestor below the 'Motion works' unit. Asserted, not assumed: a miss here
  // would silently mutate the wrong object and report a clean counterfactual.
  const mwUnit = unit('Motion works');
  const minuteWheelMesh = named('mwMinuteWheel');
  if (!mwUnit || !minuteWheelMesh) return { fatal: 'no handle for Motion works / mwMinuteWheel' };
  let mwArbor = minuteWheelMesh;
  while (mwArbor && mwArbor.parent && mwArbor.parent !== mwUnit) mwArbor = mwArbor.parent;
  if (!mwArbor || mwArbor.parent !== mwUnit) return { fatal: 'could not reach mwArbor through the metal' };

  const PARTS = {
    cannonPinion: named('cannonPinion'),
    mwMinuteWheel: minuteWheelMesh,
    mwMinutePinion: named('mwMinutePinion'),
    mwHourWheel: named('mwHourWheel'),
    third: unit('Third wheel'),
    fourth: unit('Fourth wheel'),
  };
  for (const [k, v] of Object.entries(PARTS)) if (!v) return { fatal: `no handle for ${k}` };

  const N = 240, TAU_SPAN = 3600;          // one sim hour, finely stepped

  // The world azimuth of a part's own local +X basis vector (basis column 0).
  const azim = (o) => { const m = o.matrixWorld.elements; return Math.atan2(m[1], m[0]); };
  // |z_local . z_world| — a part whose spin axis is not world z makes the
  // azimuth reading meaningless. Basis column 2, normalized.
  const axisDot = (o) => {
    const m = o.matrixWorld.elements;
    const x = m[8], y = m[9], z = m[10];
    return Math.abs(z / (Math.hypot(x, y, z) || 1));
  };

  // One sweep. `mutate` runs after every pose and before every read, which is
  // how the counterfactual and the must-miss control both inject their edit.
  const sweep = (mutate) => {
    const keys = Object.keys(PARTS);
    const acc = Object.fromEntries(keys.map((k) => [k, 0]));
    const axes = Object.fromEntries(keys.map((k) => [k, 1]));
    const prev = {};
    for (let i = 0; i <= N; i++) {
      C.resetInputs();
      C.setPose({ tau: (i / N) * TAU_SPAN });
      if (mutate) mutate(PARTS, mwArbor);
      C.scene.updateMatrixWorld(true);
      for (const k of keys) {
        const a = azim(PARTS[k]);
        axes[k] = Math.min(axes[k], axisDot(PARTS[k]));
        if (i > 0) {
          let d = a - prev[k];
          while (d > Math.PI) d -= 2 * Math.PI;
          while (d < -Math.PI) d += 2 * Math.PI;
          acc[k] += d;
        }
        prev[k] = a;
      }
    }
    return { acc, axes };
  };

  return {
    asIs: sweep(null),
    negated: sweep((_P, arbor) => { arbor.rotation.z = -arbor.rotation.z; }),
    ctrlBroken: sweep((P) => { P.third.rotation.z = -P.third.rotation.z; }),
    bars: {
      pairA: -L.cannonPinionTeeth / L.MW_MINUTE_TEETH,
      pairB: -L.MW_PINION_TEETH / L.MW_HOUR_TEETH,
    },
    counts: { a: [L.cannonPinionTeeth, L.MW_MINUTE_TEETH], b: [L.MW_PINION_TEETH, L.MW_HOUR_TEETH] },
  };
});
await browser.close(); srv.kill();

if (out.fatal) { console.log('FATAL', out.fatal); process.exit(1); }

let fail = 0;
const F = (m) => { fail++; console.log('FAIL', m); };
const OK = (m) => console.log('OK  ', m);
const R = (s, a, b) => (s.acc[a] === 0 ? NaN : s.acc[b] / s.acc[a]);
const f = (x) => (Number.isFinite(x) ? x.toFixed(6) : String(x));
const HIT = 1e-4;

console.log('GUARDS — accumulated turn (rad) and min |z_local . z_world| per part');
for (const k of Object.keys(out.asIs.acc)) {
  const turn = out.asIs.acc[k], ax = out.asIs.axes[k];
  console.log(`  ${k.padEnd(16)} turn ${turn.toFixed(4).padStart(12)}   axis ${ax.toFixed(6)}`);
  if (Math.abs(turn) < 1e-9) F(`${k} STOOD STILL across the sweep — it cannot be judged`);
  if (ax < 0.999) F(`${k} spin axis is not world z (|dot| ${ax.toFixed(6)}) — the azimuth reading is meaningless`);
}

console.log('\nCONTROLS (going train, independently solved, not the subject)');
const cGood = R(out.asIs, 'third', 'fourth'), cBad = R(out.ctrlBroken, 'third', 'fourth');
console.log(`  must-hit   Third -> Fourth, one mesh apart: ${f(cGood)}`);
console.log(`  must-miss  same pair, negation injected:    ${f(cBad)}`);
if (cGood < 0) OK('must-hit: a known-good mesh reads NEGATIVE — the pair counter-rotates'); else F('must-hit: a known-good mesh does not counter-rotate — the method is not measuring a mesh');
if (cBad > 0) OK('must-miss: the injected negation flips the sign — the method SEES a co-rotation'); else F('must-miss: injecting a negation changed nothing — the mutation never reached the metal');

console.log('\nSUBJECT — the two motion-works meshes');
for (const [nm, a, b, bar, counts] of [
  ['cannon pinion -> minute wheel', 'cannonPinion', 'mwMinuteWheel', out.bars.pairA, out.counts.a],
  ['minute pinion -> hour wheel  ', 'mwMinutePinion', 'mwHourWheel', out.bars.pairB, out.counts.b],
]) {
  const now = R(out.asIs, a, b), cf = R(out.negated, a, b);
  console.log(`  ${nm}   ${counts[0]}/${counts[1]} teeth, bar ${f(bar)}   measured ${f(now)}   [counterfactual, mwArbor negated: ${f(cf)}]`);
  if (Math.abs(now - bar) < HIT) OK(`${nm.trim()}: counter-rotates at its tooth-count ratio`);
  else F(`${nm.trim()}: reads ${f(now)} against a bar of ${f(bar)}` +
    `${Math.abs(now + bar) < HIT ? ' — exact magnitude, INVERTED SIGN: the pair CO-ROTATES' : ''}` +
    `${Math.abs(cf - bar) < HIT ? `; negating mwArbor lands it on the bar (${f(cf)}), which names the cause` : ''}`);
}

console.log(`\n${fail ? `FAIL — ${fail} claim(s)` : 'PASS — both motion-works meshes counter-rotate at their tooth-count ratios'}`);
process.exit(fail ? 1 : 0);
