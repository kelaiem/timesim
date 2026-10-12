// DOES THE LINE-SPEC GATE FIRE? — `lineSpec` (§70 steps 1–2, scoped by §261
// step 4) booted on copied trees whose switch is built wrong on purpose, so
// the gate is one somebody has seen fire rather than a comment.
//
// ACCEPTANCE. The check measures the alarm switch's drive line off the posed
// metal and compares each row with its value derived from the reference
// (LINE_SPECS in src/inspect.js). A gate that passes on the shipped tree has
// proved only that it does not fail; this proves it fails, and fails on the
// RIGHT rows, which is what makes its silence on the shipped tree mean
// something. Thirteen boots, each a copied tree (height-ledger's mutantTree),
// over the three references — the switch's drive line, the lock that reads it
// and the link that carries it to the ring — and the link's fork:
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
//      lands further out, so the run shortens and the ratio and both arms move,
//      while the rod's site stays. Since TODO 222 the drive radius moves too
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
//      Since TODO 222 it also RE-SITES THE LINK, rod 9 → 8. The feeler's lugs
//      now stand on the plate, in the rod column's band, and with the longer
//      lever the site at 9 no longer scores best. So the run, its three seat
//      rows and the drive radius with its two rows fail through the site, not
//      through any law.
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
//   9. the run mis-declared, 9 → 9.5 — the input and the three rows the seat
//      law derives from it fail; the drive's side does not.
//   10. the run forked to the reference's own 16 — the same four fail, and the
//      fork is reported STALE: a fork that no longer forks.
//   11–13. a fork of a LAW (the ratio), of an ENVELOPE (the stall floor §35
//      failed), and one with no forcing constraint — each MALFORMED on the row
//      named, and none of them moves a value the metal is held to.
//
// What it is NOT: probe-261-height-cap.mjs fires the height ratchet; this
// fires the mechanism reference. The check's own controls (a known shift of
// the pin's line moving the measured offset by exactly that much; the rocker's
// post and the link's selector rod each carried a known distance and the
// reading following it) hold the
// READERS; this holds the GATE, and its last six trees hold the FORK SCHEMA.
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
const DRIVE = (k) => `alarm switch drive/${k}`, LOCK = (k) => `alarm lock/${k}`, LINK = (k) => `alarm link tangential/${k}`;
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
  { name: 'the wheel grown (ALARM_COL_BASE_R 5.7 → 5.8)',
    fail: [...['baseR', 'rootR', 'tipR', 'colInner', 'travel', 'offset', 'straight'].map(DRIVE),
      ...['noseR', 'readR', 'postW', 'arm', 'rCham'].map(LOCK),
      ...['landR', 'wrLen', 'rEff', 'turn', 'helixTan'].map(LINK)],
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
      ...['wrLen', 'ratio', 'beakLen', 'tailLen', 'rEff', 'turn', 'helixTan'].map(LINK), DRIVE('straight')],
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
