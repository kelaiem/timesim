// TODO 115 — DO THE PARTS THAT SHARE A SHAFT TURN THE SAME WAY?
//
// Issue #327: "the seconds sweeps in the opposite direction of the fourth
// wheel". Measured here rather than eyeballed. The claim under test is the
// weakest one a movement can make: two parts keyed (or friction-coupled) to
// ONE arbor are ONE rigid body, so their rotation about the WORLD z axis is
// the same number — not the negation of it, whichever side a viewer stands
// on. A viewer's side changes what the rotation LOOKS like; it cannot change
// what the parts do.
//
// This is NOT probe-60-reach.mjs, the nearest miss in the index. That one asks
// whether every rotor has an arbor in its bore — do these parts share an AXIS.
// This asks whether the parts on a shared axis share a DIRECTION. A pair can
// pass that one and fail this one, and on this tree three do.
//
// HOW IT MEASURES. For each part, take the world image of its own local +X
// basis vector — a MATERIAL direction scribed on the metal — and accumulate
// its azimuth in the world XY plane across a fine tau sweep, wrapping each
// step. Nothing here reasons about frames: the dialFace group is turned 180°
// about Y, so a dial-side part's `rotation.z` is not its world rotation, and
// every hand-reasoned sign in this area has been wrong at least once. The
// azimuth of a material direction is frame-free by construction.
//
// CONTROLS, BOTH KINDS, because a probe that reads "everything agrees" has to
// be able to read disagreement:
//   · must-differ — Third ⇄ Fourth are ONE mesh apart and must counter-rotate;
//   · must-agree  — Centre ⇄ Fourth are TWO meshes apart and must co-rotate,
//     and Small seconds ⇄ Hour wheel are two dial-side displays that must both
//     run clockwise on the same dial.
// The two must-agree controls sit one on each side of the frame seam, so a
// method that only worked in the movement frame would fail one of them.
//
// GUARDS against the clean-but-empty result (see .claude/skills/instruments):
//   · a part whose spin axis is not world z would make the azimuth reading
//     meaningless — |ẑ_local · ẑ| is asserted per part and printed;
//   · a part that does not MOVE across the sweep cannot be judged — the
//     accumulated turn is asserted non-zero and printed, so a row can never
//     pass by standing still. (setPose ticks with zero dt, so only closed-form
//     angle laws move under it; every part here has one.)
//
// The dial's own reading sense is MEASURED too, not assumed: which world spin
// looks clockwise depends on which side the dial faces, so the visible face is
// found from the built scene (dial vs three-quarter plate in z) and reported.
// That is what says WHICH half of a failing pair is the one the dial pins.
//
// ACCEPTANCE — exits non-zero. It is RED on the tree that shipped it, on
// purpose: TODO 115 is the finding, and this is the gate its fix turns green.
// Run from tools/ with a Playwright Chromium: `node probe-coaxial-sense.mjs`.
import { chromium } from 'playwright';
import { spawn } from 'node:child_process';

const port = process.env.PORT || '8487';
const root = process.env.ROOT || '..';
const srv = spawn('python3', ['-m', 'http.server', port, '--bind', '127.0.0.1'], { cwd: root, stdio: 'ignore' });
await new Promise((r) => setTimeout(r, 900));
const browser = await chromium.launch();
const page = await browser.newPage();
page.on('pageerror', (e) => console.log('PAGEERROR', String(e)));
await page.goto(`http://127.0.0.1:${port}/index.html`, { waitUntil: 'load', timeout: 90000 });
await page.waitForFunction(() => !!window.__clock, null, { timeout: 90000 });

const out = await page.evaluate(() => {
  const C = window.__clock;
  const unit = (n) => C.labelEntries.find((e) => e.name === n)?.obj ?? null;
  const named = (nm) => { let f = null; C.scene.traverse((o) => { if (o.name === nm) f = o; }); return f; };

  // The rotors, by the handle each one actually turns on.
  const PARTS = {
    'Third wheel': unit('Third wheel'),
    'Fourth wheel': unit('Fourth wheel'),
    'Centre wheel': unit('Center wheel'),
    'Heart cam': unit('Heart cam (seconds reset)'),
    'Hour wheel': unit('Hour wheel'),
    'Small seconds hand': named('smallSecondsHand'),
  };
  const missing = Object.entries(PARTS).filter(([, o]) => !o).map(([k]) => k);

  // The world image of local +X, and how square the spin axis is to world z.
  const read = (o) => {
    o.updateWorldMatrix(true, false);
    const e = o.matrixWorld.elements;
    const xl = Math.hypot(e[0], e[1], e[2]), zl = Math.hypot(e[8], e[9], e[10]);
    return { az: Math.atan2(e[1], e[0]), axis: Math.abs(e[10] / zl), planar: Math.hypot(e[0], e[1]) / xl };
  };
  const wrap = (x) => Math.atan2(Math.sin(x), Math.cos(x));
  const acc = {}, axis = {}, planar = {};

  // Accumulate each part's world spin across a pose walk, wrapping every step
  // so a part that turns many times still reads its true total.
  const sweep = (parts, poses) => {
    C.resetInputs();
    C.setPose(poses[0]);
    const prev = {};
    for (const [k, o] of Object.entries(parts)) {
      if (!o) continue;
      const r = read(o); acc[k] = 0; prev[k] = r.az; axis[k] = r.axis; planar[k] = r.planar;
    }
    for (let i = 1; i < poses.length; i++) {
      C.setPose(poses[i]);
      for (const [k, o] of Object.entries(parts)) {
        if (!o) continue;
        const r = read(o);
        acc[k] += wrap(r.az - prev[k]);
        prev[k] = r.az;
        axis[k] = Math.min(axis[k], r.axis);
        planar[k] = Math.min(planar[k], r.planar);
      }
    }
  };

  // PASS A — the going train, walked in tau. 200 steps of 0.1 s: the fastest
  // part here is the fourth arbor at 1 rev/min, so no step comes near the ±π
  // the wrap needs; the slowest (hour wheel) still turns 2.9e-3 rad over the
  // span, three orders above the 1e-6 float noise a zero-dt pose carries.
  const STEPS = 200, DT = 0.1;
  sweep(PARTS, Array.from({ length: STEPS + 1 },
    (_, i) => ({ tau: i * DT, crownPullT: 0, leverEngage: 0, tension: 1 })));

  // PASS B — THE PART OF THE TREE THAT ALREADY DOES IT RIGHT. The power
  // reserve hand is assigned `-rsvArbor2.rotation.z` (src/main.js:33743) — the
  // negation the turned-around frame actually calls for — so it is the same
  // joint as the three above with the opposite sign convention, and it makes a
  // fourth CONTROL: a cross-frame display that must come back SAME.
  //
  // It does not move in tau (the reserve reads TENSION), so it gets its own
  // walk. And its movement-frame half cannot be picked by name — nothing in
  // `reserveTrain` carries one — so it is SELECTED BY MEASUREMENT: every
  // descendant of the train that turns on the hand's own axis. That set is
  // asserted non-empty and asserted to agree with itself, because a selector
  // that silently matched nothing would leave this control passing vacuously.
  const rsvHandMesh = named('reserveShaft');       // any part of the hand carries the hand's spin
  const rsvBoss = named('reserveBoss');            // …and the boss is centred on its axis
  const rsvTrain = unit('Power-reserve train');
  const rsvParts = {}; let rsvAxisXY = null, rsvCandidates = 0;
  if (rsvHandMesh && rsvBoss && rsvTrain) {
    rsvBoss.updateWorldMatrix(true, false);
    const b = rsvBoss.matrixWorld.elements;
    rsvAxisXY = { x: b[12], y: b[13] };
    rsvParts['Power reserve hand'] = rsvHandMesh;
    rsvTrain.updateWorldMatrix(true, true);
    rsvTrain.traverse((o) => {
      if (o === rsvTrain) return;
      const e = o.matrixWorld.elements;
      if (Math.hypot(e[12] - rsvAxisXY.x, e[13] - rsvAxisXY.y) > 0.05) return;
      rsvParts[`Reserve output #${rsvCandidates++}`] = o;
    });
  }
  const RSV_STEPS = 60;
  if (rsvCandidates) {
    sweep(rsvParts, Array.from({ length: RSV_STEPS + 1 },
      (_, i) => ({ tau: 0, crownPullT: 0, leverEngage: 0, tension: 1 - 0.6 * (i / RSV_STEPS) })));
  }
  // Re-enter the train's own pose so nothing below reads pass B's tension.
  C.resetInputs();

  // WHICH SIDE IS THE FRONT — measured off the built scene, not assumed. The
  // dial's visible face is the far side of the dial from the three-quarter
  // plate, and a viewer there sees INCREASING world azimuth as clockwise when
  // the dial faces −z (and decreasing when it faces +z).
  const zOf = (n) => {
    const o = unit(n); if (!o) return null;
    o.updateWorldMatrix(true, true);
    let lo = Infinity, hi = -Infinity;
    o.traverse((m) => {
      if (!m.isMesh || !m.geometry?.boundingBox) m.geometry?.computeBoundingBox?.();
      if (!m.isMesh) return;
      const b = m.geometry.boundingBox; if (!b) return;
      for (const zz of [b.min.z, b.max.z]) {
        for (const xx of [b.min.x, b.max.x]) for (const yy of [b.min.y, b.max.y]) {
          const v = new (m.position.constructor)(xx, yy, zz).applyMatrix4(m.matrixWorld);
          lo = Math.min(lo, v.z); hi = Math.max(hi, v.z);
        }
      }
    });
    return { lo, hi };
  };
  const dialZ = zOf('Dial'), tqZ = zOf('Three-quarter plate');
  const dialFacesMinusZ = dialZ && tqZ ? (dialZ.lo + dialZ.hi) < (tqZ.lo + tqZ.hi) : null;

  const rsvOutputs = Object.keys(rsvParts).filter((k) => k.startsWith('Reserve output'));
  return { missing, acc, axis, planar, dialZ, tqZ, dialFacesMinusZ, steps: STEPS, dt: DT,
    rsvOutputs, rsvAxisXY, rsvSteps: RSV_STEPS };
});

const f = (x, n = 6) => (x >= 0 ? ' ' : '') + x.toFixed(n);
let bad = 0;

if (out.missing.length) { console.log(`FAIL — no handle for: ${out.missing.join(', ')}`); bad++; }

const MOVED = 1e-3;
// `mustMove` marks a part some row DEPENDS on. The frame guards below only
// mean anything for a part whose spin is actually being read, so a candidate
// that stands still is exempt from them — a still part contributes no azimuth
// to misread, and one of the reserve's coaxial parts is a cross-mounted pin.
const row = (k, mustMove) => {
  const v = out.acc[k];
  const turning = Math.abs(v) >= MOVED;
  console.log(`  ${k.padEnd(22)} ${f(v)}   ${out.axis[k].toFixed(4)}   ${out.planar[k].toFixed(4)}${turning ? '' : '   (still)'}`);
  if (turning) {
    // A spin axis off world z, or a local +X with no XY projection, makes the
    // azimuth reading above something other than this part's rotation.
    if (out.axis[k] < 0.999) { console.log(`    FAIL — spin axis is not world z (|z·ẑ| = ${out.axis[k].toFixed(4)}); the azimuth reading is not this part's rotation`); bad++; }
    if (out.planar[k] < 0.999) { console.log(`    FAIL — local +X does not lie in the XY plane (|x_xy| = ${out.planar[k].toFixed(4)})`); bad++; }
  } else if (mustMove) {
    // A part that stands still cannot be judged, and would pass every row below.
    console.log(`    FAIL — did not move over the sweep (${v}); this row measures nothing`); bad++;
  }
};

console.log(`\nPASS A — the going train, walked over ${out.steps} poses × ${out.dt} s in tau`);
console.log('  (radians about world +z; + = counter-clockwise in world XY)\n');
console.log('  part                    turn (rad)   |z·ẑ|    |x_xy|');
const rsvKeys = new Set(['Power reserve hand', ...out.rsvOutputs]);
for (const k of Object.keys(out.acc)) if (!rsvKeys.has(k)) row(k, true);

// PASS B's movement-frame half is selected by measurement, so the selection
// itself is a claim and is checked here: something must have been found, and
// everything found that TURNS has to be one body and agree with itself. A
// coaxial part that stands still (the hand's own arbor pin) is expected and is
// reported rather than failed — it is what a static selector match looks like.
console.log(`\nPASS B — the power reserve, walked over ${out.rsvSteps} poses in tension`);
if (!out.rsvOutputs.length) {
  console.log(`  FAIL — nothing in the reserve train sits on the hand's axis; the selector matched nothing and this control would have passed vacuously`);
  bad++;
} else {
  console.log(`  hand axis at world (${out.rsvAxisXY.x.toFixed(3)}, ${out.rsvAxisXY.y.toFixed(3)}); ${out.rsvOutputs.length} coaxial part(s) in the train\n`);
  console.log('  part                    turn (rad)   |z·ẑ|    |x_xy|');
  row('Power reserve hand', true);
  for (const k of out.rsvOutputs) row(k, false);
  const turning = out.rsvOutputs.filter((k) => Math.abs(out.acc[k]) >= MOVED);
  const still = out.rsvOutputs.length - turning.length;
  if (still) console.log(`  (${still} coaxial part(s) stand still — the hand's arbor pin is train-mounted, not output-mounted)`);
  if (!turning.length) { console.log(`  FAIL — no coaxial part of the train turns; there is no output half to compare the hand against`); bad++; }
  else if (new Set(turning.map((k) => Math.sign(out.acc[k]))).size > 1) {
    console.log(`  FAIL — the coaxial parts that turn disagree in sign; they are not one body and the selection is wrong`); bad++;
  } else out.acc['Reserve output'] = out.acc[turning[0]];
}

const dz = out.dialZ, tz = out.tqZ;
console.log(`\nFRONT, from the built scene: dial z [${dz.lo.toFixed(2)}, ${dz.hi.toFixed(2)}], three-quarter plate z [${tz.lo.toFixed(2)}, ${tz.hi.toFixed(2)}]`);
const cwSign = out.dialFacesMinusZ ? +1 : -1;
console.log(`  the dial faces ${out.dialFacesMinusZ ? '−z' : '+z'}, so a CLOCKWISE reading on it is world spin of sign ${cwSign > 0 ? '+' : '−'}`);
const secSign = Math.sign(out.acc['Small seconds hand']);
console.log(`  seconds hand runs ${secSign === cwSign ? 'CLOCKWISE — the dial reads correctly' : 'COUNTER-CLOCKWISE — the dial itself is wrong'}`);

// Every row is a claim about metal. SAME = one rigid shaft (or a friction
// coupling, which transmits without reversing). DIFF = one external mesh.
const ROWS = [
  ['control', 'DIFF', 'Third wheel', 'Fourth wheel', 'one external mesh — must counter-rotate'],
  ['control', 'SAME', 'Centre wheel', 'Fourth wheel', 'two external meshes — must co-rotate'],
  ['control', 'SAME', 'Small seconds hand', 'Hour wheel', 'two displays on one dial — both run clockwise'],
  ['control', 'SAME', 'Power reserve hand', 'Reserve output', 'the SAME joint as the claims below, with the sign the turned-around frame calls for (src/main.js:33743) — the fix already exists in the tree'],
  ['claim', 'SAME', 'Fourth wheel', 'Small seconds hand', 'the hand rides the fourth arbor through the slip-coupled display arbor'],
  ['claim', 'SAME', 'Fourth wheel', 'Heart cam', 'the display arbor is friction-coupled to the fourth arbor'],
  ['claim', 'SAME', 'Centre wheel', 'Hour wheel', 'cannon pinion on the centre arbor, then the motion works two meshes'],
];
console.log('\nPAIRS\n');
let claimsFailed = 0, controlsFailed = 0;
for (const [kind, want, a, b, why] of ROWS) {
  const va = out.acc[a], vb = out.acc[b];
  const got = Math.sign(va) === Math.sign(vb) ? 'SAME' : 'DIFF';
  const ok = got === want;
  if (!ok) { bad++; if (kind === 'control') controlsFailed++; else claimsFailed++; }
  console.log(`  ${ok ? 'ok  ' : 'FAIL'} ${kind.padEnd(7)} ${a} ⇄ ${b}`);
  console.log(`         want ${want}, got ${got}   (${f(va)} vs ${f(vb)})`);
  console.log(`         ${why}`);
}

if (controlsFailed) console.log(`\n${controlsFailed} CONTROL row(s) failed — the instrument is not measuring what it claims; do not read the claims above as findings.`);
console.log(`\n${bad === 0 ? 'PASS' : `FAIL — ${claimsFailed} claim(s), ${controlsFailed} control(s)`}`);
await browser.close(); srv.kill();
process.exit(bad === 0 ? 0 : 1);
