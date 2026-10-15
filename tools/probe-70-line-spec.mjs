// DOES THE LINE-SPEC GATE FIRE? — `lineSpec` (§70 steps 1–2, scoped by §261
// step 4) booted on copied trees whose switch is built wrong on purpose, so
// the gate is one somebody has seen fire rather than a comment.
//
// ACCEPTANCE. The check measures the alarm switch's drive line off the posed
// metal and compares each row with its value derived from the reference
// (LINE_SPECS in src/inspect.js). A gate that passes on the shipped tree has
// proved only that it does not fail; this proves it fails, and fails on the
// RIGHT rows, which is what makes its silence on the shipped tree mean
// something. Twenty-eight boots, each a copied tree (height-ledger's mutantTree),
// over the six references — the switch's drive line, the lock that reads it,
// the link that carries it to the ring, (TODO 236) the release run from the
// crown's collar to the sleeve's helices, (§278) the strike from the cam to
// the gong, and (§278 landing 4) the detector from the hour to the feeler's
// rock — and the link's fork:
//
//   1. identity — 0 violations, every control PASS.
//   2. the wheel grown, ALARM_COL_BASE_R 5.7 → 5.8 — a fold that resized the
//      wheel without declaring a fork. The drive's radii and its derived chain
//      fail (baseR, rootR, tipR, colInner, travel, offset), and columns, teeth,
//      step, straddle, straight and carry must NOT, because the build still
//      derives its own pin from its own wheel: the mechanism is coherent, it is
//      just no longer the one specified. The LOCK fails too, through `inherits`
//      and nothing else (nose, read radius, post stand-off, arm, chamfer — its
//      lever, finger and stop wheel stay green), and so does the LINK: its nose
//      lands further out, and since TODO 240 the bar's line and the nose's
//      half-width along the lever derive from the wheel's radii too, while the
//      site keeps its run, so the ratio and both arms stay on the fork. Since TODO 222 the drive radius moves too
//      (and the turn and helix it sets): r_eff is the roller's line of push
//      from the ring's axis, so it reads wherever the chord and the fork land,
//      and with this wheel they land 0.136 nearer the ring's axis. The axial
//      drive's pin rows could not see a move like that.
//   3. the offset hand-tuned, ALARM_DRIVE_OFFSET × 1.02 — §163's history, a
//      moment arm "that looked right" in place of the coupling's derivation.
//      offset AND step must fail: a pin at the wrong offset sweeps the driver
//      2·atan(h/d') ≠ one step (§163 measured 29.34° of 30° for its own wrong
//      offset; this one reads 29.44°). carry must NOT fail, and that is the
//      finding worth keeping: the click banks the wheel the rest of the way, so
//      the wheel's whole-actuation carry reads one exact step while the driver
//      under-delivers — the driver's sweep is the row that sees a mis-set
//      coupling, and the first draft of this probe predicted otherwise.
//   4. the lock lever lengthened, ALARM_LOCK_L 5.0 → 5.2 — the lever's own
//      triangle. lockL, lift and rCham fail, and the finger's seat and release
//      must NOT: the build re-solves both angles from the stop wheel's radii.
//      Since TODO 222 it re-sited the link (rod 9 → 8). On the TODO 240 lever
//      the site keeps its run, and only the tab and the chord re-solve: the
//      drive radius and its two rows fail through the site, not through any
//      law, and the run and its three seat rows stay on the fork.
//   5. the rocker post thickened past the ceiling, ALARM_ROCKER_POST_R
//      0.22 → 0.40 — the ENVELOPE firing: the chamfer the longer Thales arm
//      owes crosses the 0.268 the §35 link beak's landing leaves.
//   6. TODO 222's throw law corrupted, 2r·sin(S/2) → 2r·sin(S) — the law the
//      arm's budget solve reads AND the reference states. The arm moves with
//      it and still agrees with itself; the throw the law states no longer
//      matches the chord the pin sweeps, so throw, turn and helixTan fail. The
//      drive radius does NOT: the roller's dead-centre point moves along the
//      vertical, square to its own line of push, so the arm does not move it.
//   7. the arm hand-tuned past its budget, × 1.02 — the law right and the metal
//      not: the arm fails, and the throw, the turn and the helix it sets
//      follow it.
//
// §70 step 3 — the FORK. In each of the six trees below the metal is the
// shipped link and only the declaration moves:
//
//   8. the fork deleted — the fold, undeclared. Exactly the seven rows the fork
//      carries fail: its two inputs (the run, the drive radius) and the five
//      rows the laws derive from them (ratio, both arms; the turn, the helix).
//   9. the run mis-declared, 6 → 6.5 — the input and the three rows the seat
//      law derives from it fail; the drive's side does not.
//   10. the run forked to the reference's own 11.345 — the same four fail, and
//      the fork is reported STALE: a fork that no longer forks.
// (TODO 240: the link's reference is 'alarm link tangential' — the re-aimed
// lever, its run a TANGENTIAL distance; the radial 'alarm link' is retired.)
//   11–13. a fork of a LAW (the ratio), of an ENVELOPE (the stall floor §35
//      failed), and one with no forcing constraint — each MALFORMED on the row
//      named, and none of them moves a value the metal is held to.
//
// TODO 236 — the fourth reference, 'alarm release run', and three more trees:
//   14. the lifter's pad arm hand-tuned (× 1.02) — the arm the scrub law
//      solves, cut longer: padArm fails and nothing else, because the lifter's
//      output arm is derived as a RATIO of it (the link's throw over the
//      rise), so the link, the crank and the sleeve all move exactly as before.
//   15. the first helix station's rollers cut off their radius (+0.05) — the
//      roller rides outboard of the helix the law is cut at: helixR fails and
//      helixTan with it (its rise over the turn is read at the roller's own
//      radius), while the travel and the turn, which the chain sets, do not.
//   16. the lifter's delivered force collapsed (its §137 row × 0.1) — the
//      ENVELOPE firing: 'deliver' no longer covers the 50 mN top of the
//      detent band.
//
// §278 landing 1 — the fifth reference, 'alarm strike' (cam → lifting lever
// → hammer tail → hammer → gong), and five more trees:
//   17. the lever's far arm cut long (its tip's outline at 1.02 × the arm the
//      contact solve is written on) — the metal and the solve parted: the far
//      arm fails, the ratio with it, and the tip's tangent point slides along
//      the anti-parallel tail, so the tail's contact arm fails too. The stand-
//      off does NOT (the slide is along the tail), and neither does anything
//      the solve poses: the lever's turn, the cam, the hammer.
//   18. the rotor's inertia hand-tuned (ALARM_HAMMER_I × 0.98) — a fall law
//      written on a rotor that is not the metal: I fails against the rotor's
//      own tally, and k with it (W²·I off the posed fall and the true rotor is
//      k/0.98). W and the fall do NOT: they follow the law from the stated I,
//      which is exactly what the motion does.
//   19. the fall slowed past its window (ALARM_HAMMER_W × 0.01) — the ENVELOPE
//      firing: a 153 ms fall against the 138.5 ms the cam leaves free at full
//      wind. W, the fall and k fail beside it. The first run of this tree
//      read a fall that FIT — the reader posed the fall at full wind, where a
//      153 ms fall lands on the next lobe's rise, and measured the rise; it
//      poses at the empty wind's wider swing now, and says NaN for a fall even
//      that cannot hold.
//   20. the rest gap opened past the swing (HAMMER_HEAD_GAP 0.4 → 0.7) — the
//      gong-contact ENVELOPE firing: the swing carries the face 0.655 and the
//      wire stands 0.7 away, so the hammer falls short. The gap fails beside
//      it; the arm does not, because §24's arm is laid out from the gap and
//      moves with it on both sides.
//   21. the cam's base cut two margins down instead of one — the base radius
//      fails and nothing else: the flank, the tip and the lift are generated
//      from the law and stand where they were.
//
// §278 landing 4 — the sixth reference, 'alarm detector' (the hour-carried
// reader, the set-carried disc's notch, the collar, the feeler's rock), and
// seven more trees:
//   22. the notch cut narrow by hand (ALARM_NOTCH_W 0.14 → 0.12) — the notch
//      fails, and the plateau and the window the pin turns through with it,
//      and (TODO 261) the floor's lead with them: the lead is half the plateau,
//      and the reference's plateau is the 0.14's. The admit envelope does NOT
//      (0.12 still passes the pin's 0.0918 arc), and neither does the ring
//      on the hand: the notch is narrower and still led by its own half-plateau.
//   23. the feeler's pivot carried out (ALARM_FEELER_PIVOT_R 5.5 → 5.7) — a
//      longer read arm: the pivot (found as the lever's rock axis), the arm,
//      the rock and the stop's gap fail. The read point does NOT: the tip
//      still ends at the pin's radius, so the take-off stays 1:1.
//   24. the reader's pin off its take-off radius (+0.05) — the take-off radius
//      fails and nothing else: the track, the tip and the trip are cut and
//      posed from the constant, and the pin's azimuth does not move.
//   25. the notch cut shallow (ALARM_TRACK_H = drop + margin/2) — the track's
//      height and the dropped pin's clearance over the body's face fail.
//   26. the bias blade's dropped seat collapsed (its §137 row × 0.1) — the
//      seat-hold ENVELOPE firing: the lever no longer seats on the collar at
//      the trip with the detent band's 5 mN.
//   27. the collar posed off its pin (its lift × 1.5) — the drop, the dropped
//      pin over the floor and the collar over the track fail; the plateau and
//      the window do NOT (the reader finds the edges on the collar's own full
//      travel), and neither does the lever's rock, which the drop law poses.
//   28. the set transfer geared 1.1:1 (the disc posed at 1.1 × its law) — the
//      topology row the satellite fold's idler must keep: setCarry fails and
//      nothing else, because the trip is searched at the setting where both
//      read zero.
//   29. the notch's lead taken off (ALARM_NOTCH_AHEAD → 0, TODO 261) — the
//      floor is centred on the hand again, so the lead fails and so does the
//      ring on the hand: the alarm rings half a plateau early, as it did.
//   30. the entry ramp cut as long as the exit (TODO 261) — the entry's run
//      fails (the reference derives it from the exit's slope) and the window
//      the pin turns through with it; the ramps are cut to the same law the
//      tick poses, so the pin still touches them.
//
// What it is NOT: probe-261-height-cap.mjs fires the height ratchet; this
// fires the mechanism reference. The check's own controls (a known shift of
// the pin's line moving the measured offset by exactly that much; the rocker's
// post, the link's selector rod and the strike's lever tip each carried a
// known distance and the reading following it) hold the READERS; this holds
// the GATE, and its trees 8–13 hold the FORK SCHEMA.
//
// Run from tools/: node probe-70-line-spec.mjs
import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import { mutantTree } from './height-ledger.mjs';

let port = 8611;
async function lineSpecOn(dir) {
  const p0 = port++;
  const srv = spawn('python3', ['-m', 'http.server', String(p0), '--bind', '127.0.0.1'], { cwd: dir, stdio: 'ignore' });
  await new Promise((r) => setTimeout(r, 1200));
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage();
    const warns = [];
    page.on('console', (m) => { if (m.type() === 'warning' && !/WebGL|GPU stall|GroupMarker/.test(m.text())) warns.push(m.text()); });
    await page.goto(`http://127.0.0.1:${p0}/index.html`, { waitUntil: 'load', timeout: 300000 });
    await page.waitForFunction(() => !!window.__clock || !!window.__bootError, null, { timeout: 300000 });
    const err = await page.evaluate(() => (window.__bootError ? String(window.__bootError) : null));
    if (err) throw new Error('boot failed: ' + err);
    await page.evaluate(async () => { const I = await import('./src/inspect.js'); window.__I = I; I.start(window.__clock, 'lineSpec'); });
    await page.waitForFunction(() => window.__I.status('lineSpec').state !== 'running', null, { timeout: 300000, polling: 500 });
    const st = await page.evaluate(() => window.__I.status('lineSpec'));
    if (st.state !== 'done') throw new Error('lineSpec ' + st.state + ': ' + st.error);
    return { r: st.result, warns };
  } finally {
    // browser.close() can wedge in this container; never let it hold the probe
    await Promise.race([browser.close(), new Promise((r) => setTimeout(r, 5000))]);
    srv.kill();
  }
}

const SRC = 'src/main.js', INS = 'src/inspect.js';
const DRIVE = (k) => `alarm switch drive/${k}`, LOCK = (k) => `alarm lock/${k}`, LINK = (k) => `alarm link tangential/${k}`, REL = (k) => `alarm release run/${k}`, STRIKE = (k) => `alarm strike/${k}`, DET = (k) => `alarm detector/${k}`;
const FORKS_HEAD = 'export const LINE_SPEC_FORKS = [';
const RUN_FORK = "      run: { value: 6,";
const cases = [
  { name: 'identity', patches: [], fail: [] },
  // §261 2c — since the fold the wheel's size moves two more things the drive
  // and the link measure: the pusher linkage is SOLVED onto the reference
  // line's two ends, so a wheel whose line moves bends crank B's arc off the
  // forked sagitta (`straight`); and the link's site is re-solved in the folded
  // world at the same run past a moved landing, so the rod's distance from the
  // wheel (`wrLen`) moves while the arms the run sets stay on the fork.
  // TODO 240 — on the tangential lever the site keeps its run (6) on the grown
  // wheel, so the arms stay on the fork; what moves is what the wheel's radii
  // derive: the landing, the bar's line (baseR + margin + half a tooth) and
  // the nose's half-width along the lever (the flat at the landing).
  { name: 'the wheel grown (ALARM_COL_BASE_R 5.7 → 5.8)',
    fail: [...['baseR', 'rootR', 'tipR', 'colInner', 'travel', 'offset', 'straight'].map(DRIVE),
      ...['noseR', 'readR', 'postW', 'arm', 'rCham'].map(LOCK),
      ...['landR', 'barLineR', 'noseHalf', 'rEff', 'turn', 'helixTan'].map(LINK)],
    patches: [{ file: SRC, find: 'const ALARM_COL_BASE_R = 5.7;', to: 'const ALARM_COL_BASE_R = 5.8;' }] },
  // (§261 2c: and the arc crank B is solved onto moves with the line, so its
  // sagitta leaves the fork's `straight` too)
  { name: 'the offset hand-tuned (ALARM_DRIVE_OFFSET × 1.02)', fail: ['offset', 'step', 'straight'].map(DRIVE),
    patches: [{ file: SRC, find: 'const ALARM_DRIVE_OFFSET = ALARM_PUSH_TRAVEL / (2 * Math.tan(ALARM_COL_STEP / 2));',
      to: 'const ALARM_DRIVE_OFFSET = 1.02 * ALARM_PUSH_TRAVEL / (2 * Math.tan(ALARM_COL_STEP / 2));' }] },
  // (§261 2c: the folded lock is one of the pusher linkage's obstacles, so a
  // longer lever re-solves the linkage — crank B's arc, and the fork's
  // `straight` with it)
  { name: 'the lock lever lengthened (ALARM_LOCK_L 5.0 → 5.2)', fail: [...['lockL', 'lift', 'rCham'].map(LOCK),
      ...['rEff', 'turn', 'helixTan'].map(LINK), DRIVE('straight')],
    patches: [{ file: SRC, find: 'const ALARM_LOCK_L = 5.0;', to: 'const ALARM_LOCK_L = 5.2;' }] },
  { name: 'the rocker post thickened past the ceiling (ALARM_ROCKER_POST_R 0.22 → 0.40)',
    fail: ['postR', 'postW', 'arm', 'rCham', 'chamCeiling'].map(LOCK),
    patches: [{ file: SRC, find: 'const ALARM_ROCKER_POST_R = 0.22;', to: 'const ALARM_ROCKER_POST_R = 0.40;' }] },
  // TODO 222 — the sideways drive's laws, corrupted. The throw law is the one
  // the arm's budget solve reads AND the reference states, so a wrong law moves
  // the metal and the spec together on the arm — and the throw it states then
  // disagrees with the chord the pin actually sweeps, which carries through
  // the turn and the helix (and the drive radius, which the moved arm shifts).
  { name: 'the throw law corrupted (2r·sin(S/2) → 2r·sin(S))',
    fail: ['throw', 'turn', 'helixTan'].map(LINK),
    patches: [{ file: SRC, find: 'ALARM_LINK_LAWS.throw = (arm, span) => 2 * arm * Math.sin(span / 2);', to: 'ALARM_LINK_LAWS.throw = (arm, span) => 2 * arm * Math.sin(span);' }] },
  // …and the arm hand-tuned past its budget: the law is right and the metal
  // is not, so the arm row fails and everything the arm sets follows it.
  { name: 'the arm hand-tuned past the budget (× 1.02)',
    fail: ['arm', 'throw', 'turn', 'helixTan'].map(LINK),
    patches: [{ file: SRC, find: '    ALARM_FORK_PIN_ARM_R = sol.r;', to: '    ALARM_FORK_PIN_ARM_R = 1.02 * sol.r;' }] },
  // §70 step 3 — the FORK. The metal is the shipped link in every case below;
  // only the declaration moves.
  // (§261 2c: the table's two forks go together — the drive's `straight` too)
  { name: 'the link’s fork deleted (the fold, undeclared)',
    fail: [...['run', 'ratio', 'beakLen', 'tailLen', 'rEff', 'turn', 'helixTan'].map(LINK), DRIVE('straight')],
    patches: [{ file: INS, find: FORKS_HEAD, to: 'export const LINE_SPEC_FORKS = [];\nconst _PROBE_DELETED_FORKS = [' }] },
  { name: 'the fork’s run mis-declared (run 6 → 6.5)',
    fail: ['run', 'ratio', 'beakLen', 'tailLen'].map(LINK),
    patches: [{ file: INS, find: RUN_FORK, to: "      run: { value: 6.5," }] },
  { name: 'a stale fork (run forked to the reference’s own 11.345)',
    fail: ['run', 'ratio', 'beakLen', 'tailLen'].map(LINK), stale: ['run'],
    patches: [{ file: INS, find: RUN_FORK, to: "      run: { value: 11.345," }] },
  { name: 'a fork of a LAW (ratio overridden)', fail: [], malformed: ['ratio: a fork moves an INPUT, never a law'],
    patches: [{ file: INS, find: RUN_FORK, to: "      ratio: { value: 5.31, forcedBy: 'the probe forks a law to watch the schema refuse it' },\n" + RUN_FORK }] },
  { name: 'a fork of an ENVELOPE (the stall floor lowered)', fail: [], malformed: ['stall: an envelope is inherited whole'],
    patches: [{ file: INS, find: RUN_FORK, to: "      stall: { value: 1, forcedBy: 'the probe forks the envelope §35 failed, to watch it refused' },\n" + RUN_FORK }] },
  { name: 'a fork with no forcing constraint', fail: [], malformed: ['run: the override does not say what in the movement forced it'],
    patches: [{ file: INS, find: "        forcedBy: 'the §112 rod-site solve, generalised by TODO 240", to: "        forcedBy: '', _was: 'the §112 rod-site solve, generalised by TODO 240" }] },
  // TODO 236 — the release run.
  { name: 'the lifter’s pad arm hand-tuned (× 1.02)', fail: [REL('padArm')],
    patches: [{ file: SRC, find: 'const ALARM_LIFT_ARM_IN = ((ALARM_COLLAR_RISE / 2) ** 2 + ALARM_FORK_CLEAR ** 2) / (2 * ALARM_FORK_CLEAR);',
      to: 'const ALARM_LIFT_ARM_IN = 1.02 * ((ALARM_COLLAR_RISE / 2) ** 2 + ALARM_FORK_CLEAR ** 2) / (2 * ALARM_FORK_CLEAR);' }] },
  { name: 'the first helix station’s rollers cut off their radius (+0.05)', fail: ['helixR', 'helixTan'].map(REL),
    patches: [{ file: SRC, find: 'const ALARM_SLEEVE_GUIDE_R0S = [ALARM_SLEEVE_GUIDE_R0, ',
      to: 'const ALARM_SLEEVE_GUIDE_R0S = [ALARM_SLEEVE_GUIDE_R0 + 0.05, ' }] },
  { name: 'the lifter’s delivered force collapsed (its §137 row × 0.1)', fail: [REL('deliver')],
    patches: [{ file: SRC, find: '    load: { value: R.linkN * 1000, unit: \'mN\',', to: '    load: { value: R.linkN * 100, unit: \'mN\',' }] },
  // §278 landing 1 — the strike.
  { name: 'the lever’s far arm cut long (its tip’s outline at 1.02 × the solved arm)', fail: ['tailLen', 'ratio', 'leverOut'].map(STRIKE),
    patches: [{ file: SRC, find: '  const h = ALARM_LIFT_W / 2, a = ALARM_LIFT_ARM, r = ALARM_LIFT_TIP_R, N = 12;',
      to: '  const h = ALARM_LIFT_W / 2, a = 1.02 * ALARM_LIFT_ARM, r = ALARM_LIFT_TIP_R, N = 12;' }] },
  { name: 'the rotor’s inertia hand-tuned (ALARM_HAMMER_I × 0.98)', fail: ['k', 'I'].map(STRIKE),
    patches: [{ file: SRC, find: 'const ALARM_HAMMER_I = rotorInertiaZ(', to: 'const ALARM_HAMMER_I = 0.98 * rotorInertiaZ(' }] },
  { name: 'the fall slowed past its window (ALARM_HAMMER_W × 0.01)', fail: ['k', 'W', 'fall', 'window'].map(STRIKE),
    patches: [{ file: SRC, find: 'const ALARM_HAMMER_W = Math.sqrt(', to: 'const ALARM_HAMMER_W = 0.01 * Math.sqrt(' }] },
  { name: 'the rest gap opened past the swing (HAMMER_HEAD_GAP 0.4 → 0.7)', fail: ['gap', 'reach'].map(STRIKE),
    patches: [{ file: SRC, find: 'const HAMMER_HEAD_GAP = 0.4;', to: 'const HAMMER_HEAD_GAP = 0.7;' }] },
  { name: 'the cam’s base cut two margins down', fail: [STRIKE('camBaseR')],
    patches: [{ file: SRC, find: 'const ALARM_CAM_BASE_R = alarmCamRadiusAt(-ALARM_STRIKE_AMP) - CLEAR_MARGIN;',
      to: 'const ALARM_CAM_BASE_R = alarmCamRadiusAt(-ALARM_STRIKE_AMP) - 2 * CLEAR_MARGIN;' }] },
  // §278 landing 4 — the detector.
  { name: 'the notch cut narrow by hand (ALARM_NOTCH_W 0.14 → 0.12)', fail: ['notchW', 'plateau', 'window', 'ahead'].map(DET),
    patches: [{ file: SRC, find: 'const ALARM_NOTCH_W = 0.14;', to: 'const ALARM_NOTCH_W = 0.12;' }] },
  { name: 'the feeler’s pivot carried out (ALARM_FEELER_PIVOT_R 5.5 → 5.7)', fail: ['pivotR', 'arm', 'rock', 'stopGap'].map(DET),
    patches: [{ file: SRC, find: 'const ALARM_FEELER_PIVOT_R = 5.5;', to: 'const ALARM_FEELER_PIVOT_R = 5.7;' }] },
  { name: 'the reader’s pin off its take-off radius (+0.05)', fail: [DET('trackR')],
    patches: [{ file: SRC, find: 'pin.position.set(ALARM_TRACK_RMID, 0, READER_RING_Z - READER_RING_T / 2 - READER_PIN_LEN / 2);',
      to: 'pin.position.set(ALARM_TRACK_RMID + 0.05, 0, READER_RING_Z - READER_RING_T / 2 - READER_PIN_LEN / 2);' }] },
  { name: 'the notch cut shallow (ALARM_TRACK_H = drop + margin/2)', fail: ['trackH', 'floorClear'].map(DET),
    patches: [{ file: SRC, find: 'const ALARM_TRACK_H = ALARM_PIN_DROP + CLEAR_MARGIN;', to: 'const ALARM_TRACK_H = ALARM_PIN_DROP + CLEAR_MARGIN / 2;' }] },
  { name: 'the bias blade’s dropped seat collapsed (its §137 row × 0.1)', fail: [DET('seatHold')],
    patches: [{ file: SRC, find: 'pinF_mN_riding: riding * lever, pinF_mN_dropped: dropped * lever,', to: 'pinF_mN_riding: riding * lever, pinF_mN_dropped: dropped * lever * 0.1,' }] },
  { name: 'the collar posed off its pin (its lift × 1.5)', fail: ['drop', 'floorClear', 'ringOverTrack'].map(DET),
    patches: [{ file: SRC, find: 'alarmReaderLift.position.z = -readerDrop;', to: 'alarmReaderLift.position.z = -1.5 * readerDrop;' }] },
  { name: 'the set transfer geared 1.1:1 (the disc posed at 1.1 × its law)', fail: [DET('setCarry')],
    patches: [{ file: SRC, find: '  alarmDiscGroup.rotation.z = alarmHandA();', to: '  alarmDiscGroup.rotation.z = 1.1 * alarmHandA();' }] },
  { name: 'the notch’s lead taken off (ALARM_NOTCH_AHEAD → 0)', fail: ['ahead', 'ringAt'].map(DET),
    patches: [{ file: SRC, find: 'const ALARM_NOTCH_AHEAD = ALARM_READER_SENSE\n  * ', to: 'const ALARM_NOTCH_AHEAD = 0 * ' }] },
  { name: 'the entry ramp cut as long as the exit', fail: ['rampIn', 'window'].map(DET),
    patches: [{ file: SRC, find: 'ALARM_NOTCH_RAMP_IN = ALARM_DETECTOR_LAWS.entryRunOf(ALARM_NOTCH_RAMP, ALARM_PIN_DROP, ALARM_TRACK_RMID);', to: 'ALARM_NOTCH_RAMP_IN = ALARM_NOTCH_RAMP;' }] },
];
let ok = true;
for (const c of cases) {
  const { r } = await lineSpecOn(mutantTree(c.patches));
  const failed = r.rows.filter((x) => !x.pass).map((x) => `${x.ref}/${x.key}`).sort();
  const want = [...c.fail].sort();
  const rowsOk = JSON.stringify(failed) === JSON.stringify(want);
  const ctlOk = String(r.control).startsWith('PASS');
  // malformed and stale are judged by WHAT they name, not only how many: a
  // schema check that fired on the wrong row would otherwise read as working
  const mal = r.malformed.map((x) => `${x.key ?? x.ref ?? x.waiver}: ${x.error}`);
  const malWant = c.malformed || [];
  const malOk = mal.length === malWant.length && malWant.every((w) => mal.some((x) => x.startsWith(w)));
  const stale = (r.staleForks || []).map((x) => x.key).sort();
  const staleOk = JSON.stringify(stale) === JSON.stringify([...(c.stale || [])].sort());
  const good = rowsOk && ctlOk && malOk && staleOk;
  if (!good) ok = false;
  console.log(`${good ? 'PASS' : 'FAIL'}  ${c.name}: failing rows [${failed.join(', ')}], want [${want.join(', ')}]; control ${ctlOk ? 'PASS' : r.control}`
    + `${mal.length || malWant.length ? `; malformed ${JSON.stringify(mal)}, want ${JSON.stringify(malWant)}` : ''}`
    + `${stale.length || (c.stale || []).length ? `; stale forks [${stale.join(', ')}], want [${(c.stale || []).join(', ')}]` : ''}`);
  for (const x of r.rows.filter((y) => !y.pass)) console.log(`      ${(x.ref + '/' + x.key).padEnd(30)} spec ${Number(x.spec).toFixed(6)}  measured ${Number(x.measured).toFixed(6)}`);
}
console.log(ok ? '\nPASS — lineSpec is silent on the shipped mechanism and names exactly the rows (and the malformed or stale forks) each sabotage moved'
  : '\nFAIL — lineSpec does not fire as declared');
process.exit(ok ? 0 : 2);
