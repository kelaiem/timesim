// TODO 90 question 1 — IS THE SUPPRESSOR'S HOLD REAL?
//
// The alarm's brake is a lever whose ruby pad bears on `alarmLockCollar`, a
// smooth 3.2 collar on the striking rotor. §25 B calls it "the hold that
// alarmReleased has embodied as a flag since §24", and §102's note beside the
// return blade says "the HOLD when braked is the column's, not the spring's".
// Neither statement is a measurement. This is the measurement.
//
// A brake holds when mu*N*r >= the torque arriving at the braked member. So
// three numbers decide it, and this probe takes all three off the BUILT tree:
//
//   1. N — the normal force at the pad. A rigid lever positioned by a cam
//      generates a contact force only if the cam drives it PAST tangency, so
//      the sign of (pad centre distance - collar r - pad r) is the whole
//      question. Positive is daylight, zero is a kiss that carries nothing,
//      negative is an interference the compliance turns into force.
//   2. The torque to hold — the alarm barrel's moment reflected through the
//      44/11 wall-to-pinion mesh onto the rotor the collar rides.
//   3. mu — 0.2, the repo's own steel-on-steel figure, taken from
//      `sawCouplingSpec`'s default rather than invented here.
//
// WHICH PROBE THIS IS NOT. `probe-lockriser-depth.mjs` measures the same
// lever's RISER against the saw — how deep a rod sits in cut metal, a
// clearance question. This one never looks at the riser: it asks whether the
// pad at the other end of the same lever can carry a load. `probe-90-click`
// measures the sautoir's restoring torque on the wheel; this measures the
// brake's holding torque on the striking train, one rider over.
//
// KIND: it exits non-zero, but only on its own CONTROLS. The mechanism verdict
// is a REPORT and must stay one — the numbers below describe what the metal is
// today, and fixing the idiom is supposed to change them. Gating on the finding
// would turn "the brake cannot hold" into a claim the repo defends. What it
// does defend is that the measurement measured something.
//
// THE MUST-HIT CONTROL IS ANALYTIC, which is the strongest kind available
// here. Over a gap the lever stands at ALARM_LOCK_LIFT past engaged, and
// §102 DERIVED that constant as (CLEAR_MARGIN + 0.01) / ALARM_LOCK_L — so the
// lifted pad gap must reproduce 0.16 exactly. A measurement that cannot
// recover a number the source computes has not measured the lever. The
// must-miss control is the pad against a far body, which must read large.
import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
const srv = spawn('python3', ['-m', 'http.server', '8491', '--bind', '127.0.0.1'], { cwd: '..', stdio: 'ignore' });
await new Promise((r) => setTimeout(r, 900));
const b = await chromium.launch(); const p = await b.newPage();
p.on('pageerror', (e) => console.log('PAGEERROR', String(e)));
await p.goto('http://127.0.0.1:8491/index.html?hud=0&sync=0', { waitUntil: 'load', timeout: 90000 });
await p.waitForFunction(() => !!window.__clock, null, { timeout: 90000 });

const out = await p.evaluate(async () => {
  const THREE = await import('./vendor/three.module.js');
  const I = await import('./src/inspect.js');
  const clock = window.__clock;
  const find = (n) => { let r = null; clock.scene.traverse((o) => { if (o.name === n) r = o; }); return r; };
  const world = (o) => o.getWorldPosition(new THREE.Vector3());

  const pad = find('alarmLockPad'), collar = find('alarmLockCollar');
  const beak = find('alarmLockBeak'), cols = find('alarmColCastellations');
  const spring = find('alarmLockSpring');
  const missing = [['alarmLockPad', pad], ['alarmLockCollar', collar],
                   ['alarmLockBeak', beak], ['alarmColCastellations', cols]]
    .filter(([, o]) => !o).map(([n]) => n);
  if (missing.length) return { err: 'missing member(s): ' + missing.join(', ') };

  // The collar's AXIS is the striking rotor's, not the collar mesh's centre:
  // read the rotor group's world origin so a moved collar cannot fake this.
  const rotor = collar.parent;
  const collarR = collar.geometry.parameters.radiusTop;
  const padR = pad.geometry.parameters.radiusTop;

  const MEAS = (alarmOn, cycle) => {
    clock.setPose({ tau: 0.13, crownPullT: 0, leverEngage: 0, tension: 1,
                    windAccumTurns: 0, alarmOn, alarmPressCycle: cycle });
    clock.scene.updateMatrixWorld(true);
    const ax = world(rotor), pc = world(pad);
    const d = Math.hypot(pc.x - ax.x, pc.y - ax.y);
    // The BEAK at the other end, against the column wheel's own axis. The
    // wheel's centre lies ON the tail's line, so a pivoted beak there moves
    // TANGENTIALLY to the wheel and its radial change is second order — which
    // is worth a number, since the lever's whole travel is justified as a
    // radial read of the castellations.
    const bc = world(beak), cax = world(cols.parent);
    const beakR = Math.hypot(bc.x - cax.x, bc.y - cax.y);
    return { colBlock: clock.alarmDebug.profNow, padGap: d - collarR - padR, padDist: d, beakR };
  };

  // Sweep the whole toggle at both parities; keep the extremes of padGap.
  const rows = [];
  for (const alarmOn of [0, 1]) for (let i = 0; i <= 48; i++) {
    const cycle = (i / 48) * 2;
    const m = MEAS(alarmOn, cycle);
    rows.push({ alarmOn, cycle: +cycle.toFixed(4), ...m });
  }
  const engaged = rows.reduce((a, r) => (r.colBlock > (a === null ? -1 : a.colBlock) ? r : a), null);
  const lifted  = rows.reduce((a, r) => (r.colBlock < (a === null ?  2 : a.colBlock) ? r : a), null);
  const minGap  = rows.reduce((a, r) => (r.padGap < (a === null ? Infinity : a.padGap) ? r : a), null);

  // CONTROL 1, must-hit — the exact construction, not a first-order stand-in.
  // §102 sizes the lift as an ARC (CLEAR_MARGIN + 0.01)/ALARM_LOCK_L, but the
  // pad gap is RADIAL from the strike axis, and the two differ by the angle
  // between them. So the control cannot assert 0.16; it asserts the closed
  // form the lever's own triangle gives, from D and L measured off this tree
  // and the lever's own rotation. If the pipeline cannot reproduce that to
  // float noise, nothing else printed here is worth reading.
  clock.setPose({ tau: 0.13, crownPullT: 0, leverEngage: 0, tension: 1,
                  windAccumTurns: 0, alarmOn: 0, alarmPressCycle: 0 });
  clock.scene.updateMatrixWorld(true);
  const lever = pad.parent;
  const axW = world(rotor), pivW = new THREE.Vector3(lever.position.x, lever.position.y, lever.position.z);
  const D = Math.hypot(pivW.x - axW.x, pivW.y - axW.y);
  const L = Math.hypot(pad.position.x, pad.position.y);
  const azAxis = Math.atan2(axW.y - pivW.y, axW.x - pivW.x);
  // pad distance to the axis at lever rotation `rot`, in closed form
  const padDistAt = (rot) => Math.hypot(D - L * Math.cos(rot - azAxis), L * Math.sin(rot - azAxis));
  const ctlHitRows = [];
  for (const [alarmOn, cycle] of [[0, 0], [0, 0.542], [1, 0], [1, 0.542]]) {
    const m = MEAS(alarmOn, cycle);
    ctlHitRows.push({ alarmOn, cycle, measured: m.padDist, closed: padDistAt(lever.rotation.z),
                      err: Math.abs(m.padDist - padDistAt(lever.rotation.z)) });
  }

  // CONTROL 2, must-miss — a body on the other side of the movement.
  const far = find('chainRun') || find('fuseeTopShaft');
  let ctlMiss = null, ctlMissName = null;
  if (far) {
    clock.setPose({ tau: 0.13, crownPullT: 0, leverEngage: 0, tension: 1,
                    windAccumTurns: 0, alarmOn: 0, alarmPressCycle: 0 });
    clock.scene.updateMatrixWorld(true);
    const a = world(pad), c = world(far);
    ctlMiss = Math.hypot(a.x - c.x, a.y - c.y, a.z - c.z); ctlMissName = far.name;
  }

  // The torque the brake would have to hold, from the page's own numbers.
  const E = clock.equalisation.alarm;
  return {
    collarR, padR, rows, engaged, lifted, minGap,
    D, L, ctlHitRows,
    ctlMissDist: ctlMiss, ctlMissName,
    springPresent: !!spring,
    momentRange_Nmm: E.momentRange_Nmm,
    totalWindTurns: E.totalWindTurns,
    // The build comment justifies the smooth collar with "the
    // stop-lever-on-balance-rim precedent". A hack lever brakes a balance
    // against its HAIRSPRING, so the precedent is only sound if the two
    // torques are comparable. Take the hairspring's, and let the ratio say.
    hairspringK_Nm_per_rad: clock.oscillator.k_Nm_per_rad,
    beakSpan: { min: Math.min(...rows.map((r) => r.beakR)), max: Math.max(...rows.map((r) => r.beakR)) },
    // The castellation ring's own radial extent, in the wheel's frame, so the
    // beak's station can be read against the metal rather than against a
    // constant. Vertices are enough here: this ring is an extruded profile, so
    // its extremes ARE vertices (MODELING.md rule 5's exception, stated).
    ringR: (() => {
      const pos = cols.geometry.attributes.position, v = new THREE.Vector3();
      let lo = Infinity, hi = -Infinity;
      for (let i = 0; i < pos.count; i++) { v.fromBufferAttribute(pos, i);
        const r = Math.hypot(v.x, v.y); lo = Math.min(lo, r); hi = Math.max(hi, r); }
      return [lo, hi];
    })(),
    beakClear: (() => {
      const r = [];
      for (const alarmOn of [0, 1]) for (const cycle of [0, 1]) {
        MEAS(alarmOn, cycle);
        r.push({ alarmOn, cycle, colBlock: clock.alarmDebug.profNow,
                 clear: I.meshClearance(beak, cols) });
      }
      return r;
    })(),
  };
});
await b.close(); srv.kill();
if (out.err) { console.log('ERR', out.err); process.exit(1); }

const f = (x, n = 4) => (x === null || x === undefined ? 'n/a' : Number(x).toFixed(n));
console.log('\nTODO 90 Q1 — the suppressor\'s hold, measured\n');
console.log(`collar r ${f(out.collarR)}   pad r ${f(out.padR)}   tangency at pad-centre distance ${f(out.collarR + out.padR)}\n`);

console.log('pad gap  = (pad centre -> strike axis) - collar r - pad r');
console.log('           positive = daylight, 0 = a kiss carrying nothing, negative = preload\n');
for (const [name, r] of [['most ENGAGED (colBlock max)', out.engaged],
                         ['most LIFTED  (colBlock min)', out.lifted],
                         ['minimum pad gap over sweep ', out.minGap]]) {
  console.log(`  ${name}  colBlock ${f(r.colBlock)}  padGap ${f(r.padGap)}  (alarmOn=${r.alarmOn} cycle ${f(r.cycle, 3)})`);
}

// CONTROLS, asserted.
const worstErr = Math.max(...out.ctlHitRows.map((r) => r.err));
const ctlHit = worstErr < 1e-6;
const ctlMiss = out.ctlMissDist === null ? null : out.ctlMissDist > 5;
console.log(`\ncontrols   (lever triangle measured off the tree: D ${f(out.D)}, L ${f(out.L)})`);
console.log(`  must-hit : pad distance vs the closed form, worst error ${worstErr.toExponential(2)} over 4 poses  -> ${ctlHit ? 'PASS' : 'FAIL'}`);
console.log(`  must-miss: pad to ${out.ctlMissName || '(none found)'} ${f(out.ctlMissDist)}  -> ${ctlMiss === null ? 'SKIP' : ctlMiss ? 'PASS' : 'FAIL'}`);

// §102's own arithmetic, checked rather than quoted.
const ARC = 0.15 + 0.01;   // (CLEAR_MARGIN + 0.01), the constant's numerator
console.log(`\n§102's lift, intended vs achieved`);
console.log(`  arc the constant buys   ${f(ARC)}   = (CLEAR_MARGIN + 0.01)`);
console.log(`  radial clearance got    ${f(out.lifted.padGap)}   = ${f(out.lifted.padGap / ARC * 100, 2)}% of it`);
console.log(`  float-bind allowance    ${f(out.lifted.padGap - 0.15)} of the 0.01 the constant added on purpose`);

// The arithmetic.
const MU = 0.2;                      // sawCouplingSpec's default, steel on steel
const UNIT_MM = 0.72 / 1.9;          // layout.js: CHAIN_PITCH_MM / CHAIN_PITCH
const STRIKE_RATIO = 44 / 11;        // ALARM_BARREL_TEETH / ALARM_STRIKE_PINION_TEETH
const MESH_EFF = 0.9;                // one mesh, the alarm train's own figure
const rCollar_mm = out.collarR * UNIT_MM;
const [mLo, mHi] = out.momentRange_Nmm;
const tqLo = mLo * MESH_EFF / STRIKE_RATIO, tqHi = mHi * MESH_EFF / STRIKE_RATIO;
console.log('\nwhat the brake must hold  (barrel moment -> rotor, x meshEff / strike ratio)');
console.log(`  barrel moment      ${f(mLo, 5)} .. ${f(mHi, 5)} N·mm   over ${f(out.totalWindTurns, 3)} turns`);
console.log(`  at the lock collar ${f(tqLo, 5)} .. ${f(tqHi, 5)} N·mm   (ratio ${STRIKE_RATIO}:1, meshEff ${MESH_EFF})`);
console.log(`  collar radius      ${f(rCollar_mm)} mm`);
const nNeed_mN = (tqHi / (MU * rCollar_mm)) * 1000;
console.log(`\n  normal force needed at the pad, mu ${MU}:  N >= ${f(nNeed_mN, 3)} mN  (at full wind)`);
console.log(`  normal force the geometry supplies:        N  = ${out.engaged.padGap >= -1e-9
  ? '0 mN  (the pad never reaches interference at any toggle state)'
  : 'preloaded — compute from the compliance'}`);

// P1 — what force the group could EVER put on this pad, so the impossibility
// is arithmetic rather than an aside. The lock's return blade is the only
// elastic member in the lever, and even at its own yield it is the ceiling on
// any preload someone might add to close the gap above.
const E_PA = 200e9, SIGMA_Y_PA = 800e6;      // layout.js STEEL_E_PA / SPRING_SIGMA_Y_PA
const bw_mm = 0.05, bt_mm = 0.2 * UNIT_MM, bL_mm = 1.5 * UNIT_MM;  // SPRING_FLAT_U section, 0.2 thick, free 1.5
const I_m4 = (bw_mm * 1e-3) * (bt_mm * 1e-3) ** 3 / 12;
const k_Npm = 3 * E_PA * I_m4 / (bL_mm * 1e-3) ** 3;
const dMax_mm = SIGMA_Y_PA * (bL_mm * 1e-3) ** 2 / (1.5 * E_PA * (bt_mm * 1e-3)) * 1e3;  // tip travel at yield
const fMax_mN = k_Npm * (dMax_mm * 1e-3) * 1000;
console.log('\nthe only elastic member in the lever — the §102 return blade');
console.log(`  section ${bw_mm} x ${f(bt_mm, 4)} mm, free length ${f(bL_mm, 4)} mm`);
console.log(`  stiffness ${f(k_Npm, 2)} N/m; tip force at its own YIELD ${f(fMax_mN, 3)} mN`);
console.log(`  the brake needs ${f(nNeed_mN, 1)} mN -> ${f(nNeed_mN / fMax_mN, 1)}x the blade's absolute ceiling`);

// The BEAK end — how much of the lever's travel is a radial read.
const bs = out.beakSpan;
console.log('\nthe beak end — is the castellation read radial?');
console.log(`  beak -> column-wheel axis over the whole sweep: ${f(bs.min)} .. ${f(bs.max)}`);
console.log(`  radial excursion ${f(bs.max - bs.min, 5)}   against ALARM_COL_H (the tier the beak reads) 1.4000`);
console.log(`  = ${f((bs.max - bs.min) / 1.4 * 100, 2)}% of the column's height`);
console.log(`  castellation ring spans r ${f(out.ringR[0])} .. ${f(out.ringR[1])} in the wheel's frame`);
console.log(`  the beak's inward face stands at ${f(bs.min - 0.5570)} — flush on the ring's outer wall, and LIFT carries it OUTWARD`);
console.log('  clearance beak -> castellations, by state:');
for (const r of out.beakClear)
  console.log(`    alarmOn=${r.alarmOn} cycle ${r.cycle}  colBlock ${f(r.colBlock)}  clear ${f(r.clear, 6)}`);

// The precedent the build comment leans on, tested.
const AMP_RAD = 270 * Math.PI / 180;                       // a normal amplitude
const balTq_Nmm = out.hairspringK_Nm_per_rad * AMP_RAD * 1000;
console.log('\nthe precedent the collar cites — "the stop-lever-on-balance-rim"');
console.log(`  a hack lever holds the balance against its hairspring: ${balTq_Nmm.toExponential(3)} N·mm at ${AMP_RAD.toFixed(2)} rad`);
console.log(`  this pad holds a MAINSPRING-fed train:                 ${f(tqHi, 5)} N·mm`);
console.log(`  ratio ${f(tqHi / balTq_Nmm, 1)}x — the idiom was borrowed from a member carrying that much less`);

const verdict = ctlHit && (ctlMiss !== false) && out.engaged.padGap >= -1e-9;
console.log(`\nVERDICT: ${verdict ? 'the pad carries NO normal force at any toggle state — the hold is a flag'
  : 'inconclusive, or the pad IS preloaded; read the rows above'}`);
process.exit(ctlHit && ctlMiss !== false ? 0 : 1);
