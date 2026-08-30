// WHICH REVERSALS WOULD THE BUILD CATCH? — the safety net TODO 115 needed,
// and now the one that keeps its landing honest.
//
// TODO 115 reversed the going train's sense, and the two censuses before this
// one established WHAT had to be reversed: nine handed cuts
// (`probe-handedness.mjs`) and three wound parts (`probe-wound-sense.mjs`),
// each direction-committed, each needing its own edit. The danger was never the
// edit. It is a reversal that lands INCOMPLETELY and looks fine — one cut left
// facing the old way, in a movement whose every collision gate is green
// because nothing in this repository measures a direction. That danger does not
// retire with the landing: a part re-cut is a part that can be re-cut wrongly,
// so the reversal's own new commitments joined the table below — and one of
// them is that there are TWO sense declarations, because the alarm is a second
// motor and reversing the going train must not turn its arbors (layout.js).
//
// The item stated the exposure as "of which boot asserts exactly ONE (§47's)".
// That is a claim about the build, so this measures it, and it was wrong: the
// escapement's own draw sense is asserted too, at `geometry.js` — see the
// table this prints.
//
// EVERY MUTANT NOW NEGATES A SENSE AT ONE SITE rather than flipping a
// hard-coded `+`. That is the same experiment it always was — a sense is one
// declaration and every cut reads one — but it is also the failure the landing
// can actually have: not "somebody wrote the wrong sign", but "somebody flipped
// the declaration and one part did not follow".
//
// HOW IT MEASURES — MUTATION, because a guard that has never fired is not
// known to work. Asserting that an assert EXISTS is a source grep; asserting
// that it CATCHES is an experiment. For each direction commitment, this copies
// the tree, reverses that one sign, boots the copy, and records whether
// anything complained. A commitment nobody guards boots silent, and silence is
// the finding.
//
// THE FAILURE THIS IS BUILT AGAINST is a mutant that boots silent for the
// wrong reason, and it arrives through TWO doors — both closed here, because
// closing only the first is what a careful reading would stop at.
//
//   · The patch matched nothing. It changed not one character, booted clean,
//     and reads exactly like an unguarded commitment. So every patch must
//     move the FILE, and one that does not is a hard error, not a row.
//   · The patch moved the file and the file did not move the METAL. That is
//     not hypothetical: the first draft mutated `ArchimedeanSpiral`, which
//     `makeBarrel` uses only as its NON-MORPH fallback — the shipped
//     mainsprings take the `wind.frames` path and never touch it. The patch
//     applied, the build ignored it, and the row read SILENT as though a real
//     reversal had gone unnoticed. So every mutant's built geometry is HASHED
//     and compared against an unmutated baseline boot: a mutant that leaves
//     the metal identical is reported NO-OP and tests nothing. Verifying the
//     edit is not verifying the experiment.
//
// CONTROLS, both kinds:
//   · must-hit  — the pallet draw sense. Reversing it makes the tooth's push
//     torque the fork OUT of lock instead of deeper in, and `geometry.js`
//     asserts exactly that. It MUST come back CAUGHT; if it does not, the
//     harness is not reading boot warnings and every SILENT row below is
//     meaningless.
//   · must-miss — an IDENTITY mutation: a patch that rewrites a line to
//     itself. It must apply (so the patch machinery is exercised) and add NO
//     warning the unmutated tree did not already carry. Without it, a harness
//     that reported CAUGHT for everything — because the copied tree was broken,
//     or a stray warning rode along — would look like excellent news. SILENT
//     means "added nothing", not "said nothing": the baseline's own warnings
//     are subtracted from every row (see `newWarns`), which matters now that
//     TODO 115 leaves its unlanded region's guard deliberately firing.
//
// IT IS NOT `probe-handedness.mjs` (which cuts are handed) and NOT
// `probe-wound-sense.mjs` (which way each wind winds). Those two say what must
// be reversed. This says what would notice if it were not.
//
// ACCEPTANCE on its controls AND on its subjects, since TODO 115 landed. It
// used to gate the controls only, on the argument that "whether an unguarded
// commitment is acceptable is TODO 115's decision, not this file's" and that
// gating it early "would only freeze today's exposure in place". That argument
// expired with the exposure: every commitment is guarded now, so a SILENT row
// is no longer a standing debt to be weighed — it is a NEW one, introduced by
// whoever is running this. A NO-OP row fails too, and for the sharper reason:
// it means the experiment did not run, so the row is not evidence of anything.
// Run from tools/ with a Playwright Chromium: `node probe-direction-guards.mjs`.
import { chromium } from 'playwright';
import { spawn, execFileSync } from 'node:child_process';
import { mkdtempSync, cpSync, readFileSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

// Each row reverses ONE direction commitment, the way that commitment would
// actually have to be reversed — a sign in the builder, never a transform
// bolted on outside it (see probe-handedness on why a flipped group is a model
// trick). `find` must be unique in its file.
const MUTANTS = [
  { kind: 'baseline', name: 'unmutated tree (the metal reference)', file: 'src/geometry.js',
    find: 'const DRAW_DEG = 12;', to: 'const DRAW_DEG = 12;', identity: true,
    note: 'boots the tree untouched, to hash the metal every mutant is compared against' },
  { kind: 'control-hit', name: 'pallet stone draw sense', file: 'src/geometry.js',
    find: 'THREE.MathUtils.degToRad(MOVEMENT_SENSE * DRAW_DEG)',
    to:   'THREE.MathUtils.degToRad(-MOVEMENT_SENSE * DRAW_DEG)',
    note: 'the tooth would torque the fork OUT of lock — the escapement stops' },
  { kind: 'control-miss', name: 'identity (rewrite a line to itself)', file: 'src/geometry.js',
    find: 'const DRAW_DEG = 12;',
    to:   'const DRAW_DEG = 12;',
    identity: true,
    note: 'must apply and must boot silent, or every SILENT row below is noise' },

  { kind: 'subject', name: 'escape wheel club-tooth lead', file: 'src/geometry.js',
    find: '    const W = MOVEMENT_SENSE;',
    to:   '    const W = -MOVEMENT_SENSE;',
    note: 'the club leads backward; the impulse face is on the wrong flank' },
  { kind: 'subject', name: 'the going train\'s absolute sense', file: 'src/main.js',
    find: '  return MOVEMENT_SENSE * (n * BEAT_DEG + escapeDeltaDeg(p)) * DEG2RAD;',
    to:   '  return -MOVEMENT_SENSE * (n * BEAT_DEG + escapeDeltaDeg(p)) * DEG2RAD;',
    note: 'the whole train runs backwards — TODO 115\'s own first half' },
  { kind: 'subject', name: 'the mainspring winds\' hand', file: 'src/geometry.js',
    find: '      const ang = sense * (A - a);',
    to:   '      const ang = -sense * (A - a);',
    note: 'both ribbons at once — ArchimedeanSpiral is only makeBarrel\'s non-morph fallback and moves no shipped metal' },
  { kind: 'subject', name: 'every ratchet/saw tooth hand', file: 'src/geometry.js',
    find: '  if (reverse !== (sense < 0))',
    to:   '  if (reverse === (sense < 0))',
    note: 'makeRatchetAndClick already HAS the flag; this inverts its default for all five saws' },
  { kind: 'subject', name: 'the alarm motor\'s own hand', file: 'src/layout.js',
    find: 'export const ALARM_SENSE = +1;',
    to:   'export const ALARM_SENSE = -1;',
    note: 'the alarm is a second motor with its own direction (layout.js) — this reverses IT while the going train stands still' },
  { kind: 'subject', name: 'the fusee groove\'s hand', file: 'src/geometry.js',
    find: '    const a = MOVEMENT_SENSE * t * grooveTurns * Math.PI * 2;',
    to:   '    const a = -MOVEMENT_SENSE * t * grooveTurns * Math.PI * 2;',
    note: 'the chain would have to wrap the other way to sit in it' },

  // The commitments the LANDING itself added. A reversal that re-cuts a
  // part is a part that can be re-cut wrongly, so each one joins the table it
  // was measured by — the same rule that put the five above here.
  { kind: 'subject', name: 'the pallet stones\' body side', file: 'src/geometry.js',
    find: '  const mirrored = MOVEMENT_SENSE < 0;',
    to:   '  const mirrored = MOVEMENT_SENSE > 0;',
    note: 'the ruby, its broached slot and the head cut round it end up on the wrong side of the locking face' },
  { kind: 'subject', name: 'the tooth-motion tangent', file: 'src/geometry.js',
    find: '    const tHat = new THREE.Vector2(-u.y, u.x).multiplyScalar(MOVEMENT_SENSE);',
    to:   '    const tHat = new THREE.Vector2(-u.y, u.x).multiplyScalar(-MOVEMENT_SENSE);',
    note: 'the impulse face is cut from a slide path the tooth does not travel' },
  { kind: 'subject', name: 'the escape wheel\'s tooth phase', file: 'src/main.js',
    find: '  const tipPhase = MOVEMENT_SENSE * 0.22 * pitch;',
    to:   '  const tipPhase = -MOVEMENT_SENSE * 0.22 * pitch;',
    note: 'the wheel is phased to rest its club HEEL on the stone instead of its tip' },
  { kind: 'subject', name: 'the chain\'s pay-out sense', file: 'src/main.js',
    find: '  return MOVEMENT_SENSE * 2 * Math.PI * (RESERVE_BARREL_TURNS - turns)',
    to:   '  return -MOVEMENT_SENSE * 2 * Math.PI * (RESERVE_BARREL_TURNS - turns)',
    note: 'windLocalAt\'s two terms stop cancelling — the cone creeps on its arbor at twice the drain rate, clicking the maintaining work while the watch simply runs' },
  { kind: 'subject', name: 'the maintaining click\'s tooth mapping', file: 'src/main.js',
    find: 'const MAINT_U_SIGN = MOVEMENT_SENSE;',
    to:   'const MAINT_U_SIGN = -MOVEMENT_SENSE;',
    note: 'the pawl is dragged up the steep locking face and slides down the ramp — a one-way device running the wrong way' },
  { kind: 'subject', name: 'the chain\'s wrap hand', file: 'src/main.js',
    find: '    const ang = thetaT - MOVEMENT_SENSE * (wraps - s) * Math.PI * 2;',
    to:   '    const ang = thetaT + MOVEMENT_SENSE * (wraps - s) * Math.PI * 2;',
    note: 'the run climbs the cone against the thread it sits in — it still draws, still measures the right length, and every clearance gate stays green' },
  { kind: 'subject', name: 'the span\'s tangent branch', file: 'src/main.js',
    find: '    - MOVEMENT_SENSE * Math.acos(clamp((coneR - DRUM_WRAP_R) / Math.hypot(dx, dy), -1, 1));',
    to:   '    + MOVEMENT_SENSE * Math.acos(clamp((coneR - DRUM_WRAP_R) / Math.hypot(dx, dy), -1, 1));',
    note: 'the chain peels off the side where the cone\'s surface runs INTO its own wrap' },
  { kind: 'subject', name: 'the mainspring drum\'s rotation', file: 'src/main.js',
    find: 'const drumRotAt = (t) => MOVEMENT_SENSE * (SPRING_WIND_FULL - springWindAt(t));',
    to:   'const drumRotAt = (t) => -MOVEMENT_SENSE * (SPRING_WIND_FULL - springWindAt(t));',
    note: 'drum and cone are joined by a chain on an EXTERNAL tangent, so they must turn together — this has them unwinding each other' },
];

const ROOT = process.env.ROOT || '..';
const results = [];
let port = 8540;

// A cheap, order-stable hash over every mesh's world geometry. Enough to say
// "the metal moved", which is all this needs — the battery's fingerprint is
// the authority on what the metal IS.
// IT HASHES SHAPE AND PLACE, for §152's reason: a shape-only hash cannot see a
// mutation that moves a group. Measured — reversing the escape wheel's tooth
// PHASE turns a group and cuts nothing, so every vertex kept its local
// coordinates and the row came back NO-OP, i.e. "tested nothing", when what it
// had actually established was that the commitment was unguarded. A verdict
// that hides a finding behind "the experiment did not run" is the worst way for
// this file to be wrong, so the world matrix rides in beside the positions.
// THE CHAIN IS EXCLUDED, for the reason `fingerprint` excludes it by name: its
// mesh is re-tessellated lazily and is PATH-DEPENDENT, so two boots of the same
// tree hash differently. Measured here before it was excluded — the reference
// read 3993372851, 2256983692 and 3993372851 across three runs of an unchanged
// tree — which would make NO-OP fire or not fire at random, and NO-OP is the
// verdict that decides whether a row tested anything at all.
const GEO_HASH = `(() => {
  let h = 2166136261 >>> 0;
  const acc = (v) => { h ^= (Math.round(v * 4096) | 0) >>> 0; h = Math.imul(h, 16777619) >>> 0; };
  const skip = new Set();
  for (const e of window.__clock.labelEntries) {
    if (e.name !== 'Chain') continue;
    e.obj?.traverse?.((o) => skip.add(o));
  }
  const objs = [];
  window.__clock.scene.traverse((o) => { if (o.isMesh && !skip.has(o) && o.geometry?.attributes?.position) objs.push(o); });
  objs.sort((a, b) => (a.name || '').localeCompare(b.name || '') || a.id - b.id);
  window.__clock.scene.updateMatrixWorld(true);
  for (const o of objs) {
    const p = o.geometry.attributes.position;
    acc(p.count);
    for (let i = 0; i < p.count; i += Math.max(1, Math.floor(p.count / 64))) { acc(p.getX(i)); acc(p.getY(i)); acc(p.getZ(i)); }
    for (const e of o.matrixWorld.elements) acc(e);   // PLACE, not only shape — see above
  }
  return h;
})()`;

for (const m of MUTANTS) {
  const dir = mkdtempSync(join(tmpdir(), 'dirguard-'));
  let applied = false, warns = [], booted = false, err = null, geoHash = null;
  try {
    // Copy the tree. node_modules and .git are not needed to boot the app and
    // copying them costs minutes.
    cpSync(ROOT, dir, { recursive: true, dereference: true,
      filter: (s) => !/(^|[\\/])(\.git|node_modules|\.battery-out|\.claude)([\\/]|$)/.test(s) });

    const target = join(dir, m.file);
    const before = readFileSync(target, 'utf8');
    const hits = before.split(m.find).length - 1;
    if (hits !== 1) throw new Error(`anchor matched ${hits} times, needs exactly 1 — the patch is stale`);
    const after = before.replace(m.find, m.to);
    writeFileSync(target, after);
    // THE LOAD-BEARING CHECK. An identity mutant is SUPPOSED to leave the file
    // equal; every other mutant that does is a patch that did nothing, and its
    // silent boot would read as an unguarded commitment.
    applied = m.identity ? true : (after !== before);
    if (!applied) throw new Error('patch left the file unchanged — it would have reported a false SILENT');

    const p0 = port++;
    const srv = spawn('python3', ['-m', 'http.server', String(p0), '--bind', '127.0.0.1'],
      { cwd: dir, stdio: 'ignore' });
    await new Promise((r) => setTimeout(r, 900));
    const browser = await chromium.launch();
    const page = await browser.newPage();
    page.on('console', (msg) => { if (msg.type() === 'warning' || msg.type() === 'error') warns.push(msg.text()); });
    page.on('pageerror', (e) => warns.push('PAGEERROR ' + String(e)));
    await page.goto(`http://127.0.0.1:${p0}/index.html`, { waitUntil: 'load', timeout: 90000 });
    try {
      await page.waitForFunction(() => !!window.__clock, null, { timeout: 60000 });
      booted = true;
      geoHash = await page.evaluate(GEO_HASH);
    } catch { booted = false; }
    await browser.close(); srv.kill();
  } catch (e) {
    err = String(e.message || e);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }

  // The environment's own noise is not a build assert. WebGL/driver chatter and
  // a missing favicon are present on an unmutated boot too — filtering them is
  // what makes a real warning legible, and the identity control is what proves
  // the filter has not swallowed everything.
  const real = warns.filter((w) => !/GroupMarkerNotSet|GL Driver Message|software WebGL|Failed to load resource|deprecat/i.test(w));
  results.push({ ...m, applied, booted, err, warns: real, geoHash });
}

// ---- report ---------------------------------------------------------------
let bad = 0;
const base = results.find((r) => r.kind === 'baseline');
const baseHash = base?.geoHash ?? null;
// THE BASELINE'S OWN WARNINGS ARE NOT FINDINGS. This assumed a silent tree,
// which was true until TODO 115 landed three of its four regions and left the
// fourth's guard deliberately firing (the winding train — see the item). A
// standing warning would otherwise ride into EVERY mutant, report the identity
// control as CAUGHT, and make every row below read CAUGHT for the same reason:
// a harness that says "everything is guarded" because one thing is broken.
// Only warnings the MUTATION added count.
const baseWarns = new Set(base?.warns ?? []);
const newWarns = (r) => r.warns.filter((w) => !baseWarns.has(w));
// NO-OP outranks SILENT: a mutant that left the metal identical did not run the
// experiment, and calling that "unguarded" would be the instrument lying.
// A mutant is proven to have HAD AN EFFECT if the metal moved or the build
// complained. Requiring the metal to move was too strong and the run said so:
// `escapeAngle` is a TICK-TIME law, so reversing the train leaves every vertex
// where it was and still trips §47 — that row came back NO-OP and CAUGHT at
// once, which is a contradiction the rule had to lose. NO-OP now means the
// mutant did nothing observable at all, which is the only case that tests
// nothing.
const verdict = (r) => r.err ? 'ERROR'
  : !r.booted ? 'CAUGHT (build failed to boot)'
  : newWarns(r).length ? 'CAUGHT'
  : (!r.identity && baseHash != null && r.geoHash === baseHash) ? 'NO-OP (no metal moved, nothing complained)'
  : 'SILENT';

console.log('\nCONTROLS — the harness, before any subject is read\n');
console.log(`  metal reference hash: ${baseHash ?? 'FAILED TO BOOT'}`);
if (baseWarns.size) {
  console.log(`  the unmutated tree already warns ${baseWarns.size}× — subtracted from every row below:`);
  for (const w of baseWarns) console.log(`     · ${w.slice(0, 120)}`);
}
if (baseHash == null) bad++;
// The must-miss control boots the SAME tree a second time, so its hash must
// equal the reference. If it does not, the hash is unstable and every NO-OP
// verdict below is a coin toss — which is exactly what the Chain's lazy
// re-tessellation was doing before it was excluded.
{
  const idc = results.find((r) => r.kind === 'control-miss');
  const stable = idc && idc.geoHash === baseHash;
  if (!stable) bad++;
  console.log(`  ${stable ? 'ok  ' : 'FAIL'} the hash is REPRODUCIBLE across two boots of one tree  (${baseHash} vs ${idc?.geoHash})`);
}
for (const r of results.filter((x) => x.kind.startsWith('control'))) {
  const v = verdict(r);
  const want = r.kind === 'control-hit' ? 'CAUGHT' : 'SILENT';
  const ok = r.err ? false : (want === 'CAUGHT' ? v.startsWith('CAUGHT') : v === 'SILENT');
  if (!ok) bad++;
  console.log(`  ${ok ? 'ok  ' : 'FAIL'} ${r.kind === 'control-hit' ? 'must-hit ' : 'must-miss'}  ${r.name.padEnd(38)} ${v}`);
  if (r.err) console.log(`         ERROR: ${r.err}`);
  for (const w of newWarns(r).slice(0, 2)) console.log(`         ${w.slice(0, 130)}`);
}
if (bad) console.log('\n  Control failure — read nothing below as a finding.');

console.log('\nDIRECTION COMMITMENTS — reverse one sign, boot, see if anything complains\n');
for (const r of results.filter((x) => x.kind === 'subject')) {
  const v = verdict(r);
  console.log(`  ${v.padEnd(6)}  ${r.name.padEnd(36)} ${r.file}`);
  console.log(`          ${r.note}`);
  if (r.err) { console.log(`          ERROR: ${r.err}`); bad++; }
  for (const w of newWarns(r).slice(0, 3)) console.log(`          → ${w.slice(0, 130)}`);
  if (v === 'SILENT') console.log('          → nothing complained. This reversal would land unnoticed.');
}

const subjects = results.filter((x) => x.kind === 'subject');
const silent = subjects.filter((r) => verdict(r) === 'SILENT');
const noop = subjects.filter((r) => verdict(r).startsWith('NO-OP'));
if (noop.length) {
  console.log(`\n  ${noop.length} mutant(s) came back NO-OP — they changed the source and not the built metal,`);
  console.log('  so they tested nothing and are NOT counted as unguarded. Each needs a different anchor:');
  for (const r of noop) console.log(`    · ${r.name} — ${r.file}`);
}
console.log(`\n  ${silent.length} of ${subjects.length} direction commitments would reverse SILENTLY.`);
// Gated since TODO 115 landed — see the ACCEPTANCE note in the header for why
// this was a report until then and why it stopped being one.
bad += silent.length + noop.length;
if (silent.length) {
  console.log('  Every collision gate in the battery stays green through those: nothing there measures');
  console.log('  a direction. That is exposure a staged reversal has to close FIRST, because the failure');
  console.log('  it produces — a movement half-reversed and confidently green — is indistinguishable');
  console.log('  from a healthy one by every instrument this repository owns.');
} else {
  console.log('  Every one is guarded, so a reversal that lands incompletely now SAYS SO at boot rather');
  console.log('  than passing every collision gate in silence. That is what this file was built to');
  console.log('  establish, and it is the precondition TODO 115\'s reversal was waiting on — not a');
  console.log('  claim that the reversal is correct, only that an incomplete one cannot hide.');
}

console.log(`\n${bad === 0
  ? 'PASS — the controls hold, so the table above is readable, and every commitment is guarded'
  : `FAIL — ${bad} problem(s): control failures, unguarded commitments, or rows that tested nothing`}`);
process.exit(bad === 0 ? 0 : 1);
