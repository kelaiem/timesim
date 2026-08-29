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

  // 200 steps of 0.1 s. The fastest part measured here is the escape-driven
  // fourth arbor at 1 rev/min, so no step comes near the ±π the wrap needs;
  // the slowest (hour wheel) still turns 2.9e-3 rad over the span, three
  // orders above the 1e-6 float noise a zero-dt pose carries.
  const STEPS = 200, DT = 0.1;
  const pose = (tau) => C.setPose({ tau, crownPullT: 0, leverEngage: 0, tension: 1 });
  C.resetInputs();
  pose(0);
  const acc = {}, first = {}, axis = {}, planar = {};
  for (const [k, o] of Object.entries(PARTS)) {
    if (!o) continue;
    const r = read(o); acc[k] = 0; first[k] = r.az; axis[k] = r.axis; planar[k] = r.planar;
  }
  let prev = { ...first };
  for (let i = 1; i <= STEPS; i++) {
    pose(i * DT);
    for (const [k, o] of Object.entries(PARTS)) {
      if (!o) continue;
      const a = read(o).az;
      acc[k] += wrap(a - prev[k]);
      prev[k] = a;
      axis[k] = Math.min(axis[k], read(o).axis);
    }
  }

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

  return { missing, acc, axis, planar, dialZ, tqZ, dialFacesMinusZ, steps: STEPS, dt: DT };
});

const f = (x, n = 6) => (x >= 0 ? ' ' : '') + x.toFixed(n);
let bad = 0;

if (out.missing.length) { console.log(`FAIL — no handle for: ${out.missing.join(', ')}`); bad++; }

console.log(`\nSPIN, accumulated over ${out.steps} poses × ${out.dt} s  (radians about world +z; + = counter-clockwise in world XY)\n`);
console.log('  part                    turn (rad)   |z·ẑ|    |x_xy|');
for (const [k, v] of Object.entries(out.acc)) {
  console.log(`  ${k.padEnd(22)} ${f(v)}   ${out.axis[k].toFixed(4)}   ${out.planar[k].toFixed(4)}`);
  // A spin axis off world z, or a local +X with no XY projection, makes the
  // azimuth reading above something other than this part's rotation.
  if (out.axis[k] < 0.999) { console.log(`    FAIL — spin axis is not world z (|z·ẑ| = ${out.axis[k].toFixed(4)}); the azimuth reading is not this part's rotation`); bad++; }
  if (out.planar[k] < 0.999) { console.log(`    FAIL — local +X does not lie in the XY plane (|x_xy| = ${out.planar[k].toFixed(4)})`); bad++; }
  // A part that stands still cannot be judged, and would pass every row below.
  if (Math.abs(v) < 1e-3) { console.log(`    FAIL — did not move over the sweep (${v}); this row measures nothing`); bad++; }
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
