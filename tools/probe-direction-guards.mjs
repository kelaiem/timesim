// WHICH REVERSALS WOULD THE BUILD CATCH? — the safety net TODO 115 needs.
//
// TODO 115 would reverse the going train's sense, and the two censuses before
// this one established WHAT has to be reversed: nine handed cuts
// (`probe-handedness.mjs`) and three wound parts (`probe-wound-sense.mjs`),
// each direction-committed, each needing its own edit. The danger is not the
// edit. It is a reversal that lands INCOMPLETELY and looks fine — one cut left
// facing the old way, in a movement whose every collision gate is green
// because nothing in this repository measures a direction.
//
// The item states the exposure as "of which boot asserts exactly ONE (§47's)".
// That is a claim about the build, so this measures it, and it is wrong: the
// escapement's own draw sense is asserted too, at `geometry.js` — see the
// table this prints.
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
//     itself. It must apply (so the patch machinery is exercised) and boot
//     SILENT. Without it, a harness that reported CAUGHT for everything —
//     because the copied tree was broken, or a stray warning rode along —
//     would look like excellent news.
//
// IT IS NOT `probe-handedness.mjs` (which cuts are handed) and NOT
// `probe-wound-sense.mjs` (which way each wind winds). Those two say what must
// be reversed. This says what would notice if it were not.
//
// ACCEPTANCE on its CONTROLS only. Whether an unguarded commitment is
// acceptable is TODO 115's decision, not this file's — the table is the
// product, and gating it before the reversal is planned would only freeze
// today's exposure in place.
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
    find: 'const drawRad = THREE.MathUtils.degToRad(DRAW_DEG);',
    to:   'const drawRad = THREE.MathUtils.degToRad(-DRAW_DEG);',
    note: 'the tooth would torque the fork OUT of lock — the escapement stops' },
  { kind: 'control-miss', name: 'identity (rewrite a line to itself)', file: 'src/geometry.js',
    find: 'const DRAW_DEG = 12;',
    to:   'const DRAW_DEG = 12;',
    identity: true,
    note: 'must apply and must boot silent, or every SILENT row below is noise' },

  { kind: 'subject', name: 'escape wheel club-tooth lead', file: 'src/geometry.js',
    find: 'const T = P(radius, c + 0.22 * pitch);',
    to:   'const T = P(radius, c - 0.22 * pitch);',
    note: 'the club leads backward; the impulse face is on the wrong flank' },
  { kind: 'subject', name: 'the going train\'s absolute sense', file: 'src/main.js',
    find: '  return (n * BEAT_DEG + escapeDeltaDeg(p)) * DEG2RAD;',
    to:   '  return -(n * BEAT_DEG + escapeDeltaDeg(p)) * DEG2RAD;',
    note: 'the whole train runs backwards — TODO 115\'s own first half' },
  { kind: 'subject', name: 'the mainspring winds\' hand', file: 'src/geometry.js',
    find: '      const ang = A - a;                  // clockwise outward — the handedness note above',
    to:   '      const ang = a - A;                  // clockwise outward — the handedness note above',
    note: 'the morph path\'s own hand — ArchimedeanSpiral is only makeBarrel\'s non-morph fallback and moves no shipped metal' },
  { kind: 'subject', name: 'every ratchet/saw tooth hand', file: 'src/geometry.js',
    find: '  if (reverse) { for (const p of outline) p[1] = -p[1]; outline.reverse(); }',
    to:   '  if (!reverse) { for (const p of outline) p[1] = -p[1]; outline.reverse(); }',
    note: 'makeRatchetAndClick already HAS the flag; this inverts its default for all five saws' },
  { kind: 'subject', name: 'the fusee groove\'s hand', file: 'src/geometry.js',
    find: '    const a = t * grooveTurns * Math.PI * 2;',
    to:   '    const a = -t * grooveTurns * Math.PI * 2;',
    note: 'the chain would have to wrap the other way to sit in it' },
];

const ROOT = process.env.ROOT || '..';
const results = [];
let port = 8540;

// A cheap, order-stable hash over every mesh's world geometry. Enough to say
// "the metal moved", which is all this needs — the battery's fingerprint is
// the authority on what the metal IS.
const GEO_HASH = `(() => {
  let h = 2166136261 >>> 0;
  const acc = (v) => { h ^= (Math.round(v * 4096) | 0) >>> 0; h = Math.imul(h, 16777619) >>> 0; };
  const objs = [];
  window.__clock.scene.traverse((o) => { if (o.isMesh && o.geometry?.attributes?.position) objs.push(o); });
  objs.sort((a, b) => (a.name || '').localeCompare(b.name || '') || a.id - b.id);
  for (const o of objs) {
    const p = o.geometry.attributes.position;
    acc(p.count);
    for (let i = 0; i < p.count; i += Math.max(1, Math.floor(p.count / 64))) { acc(p.getX(i)); acc(p.getY(i)); acc(p.getZ(i)); }
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
const baseHash = results.find((r) => r.kind === 'baseline')?.geoHash ?? null;
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
  : r.warns.length ? 'CAUGHT'
  : (!r.identity && baseHash != null && r.geoHash === baseHash) ? 'NO-OP (no metal moved, nothing complained)'
  : 'SILENT';

console.log('\nCONTROLS — the harness, before any subject is read\n');
console.log(`  metal reference hash: ${baseHash ?? 'FAILED TO BOOT'}`);
if (baseHash == null) bad++;
for (const r of results.filter((x) => x.kind.startsWith('control'))) {
  const v = verdict(r);
  const want = r.kind === 'control-hit' ? 'CAUGHT' : 'SILENT';
  const ok = r.err ? false : (want === 'CAUGHT' ? v.startsWith('CAUGHT') : v === 'SILENT');
  if (!ok) bad++;
  console.log(`  ${ok ? 'ok  ' : 'FAIL'} ${r.kind === 'control-hit' ? 'must-hit ' : 'must-miss'}  ${r.name.padEnd(38)} ${v}`);
  if (r.err) console.log(`         ERROR: ${r.err}`);
  for (const w of r.warns.slice(0, 2)) console.log(`         ${w.slice(0, 130)}`);
}
if (bad) console.log('\n  Control failure — read nothing below as a finding.');

console.log('\nDIRECTION COMMITMENTS — reverse one sign, boot, see if anything complains\n');
for (const r of results.filter((x) => x.kind === 'subject')) {
  const v = verdict(r);
  console.log(`  ${v.padEnd(6)}  ${r.name.padEnd(36)} ${r.file}`);
  console.log(`          ${r.note}`);
  if (r.err) { console.log(`          ERROR: ${r.err}`); bad++; }
  for (const w of r.warns.slice(0, 3)) console.log(`          → ${w.slice(0, 130)}`);
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
console.log('  Every collision gate in the battery stays green through all of them: nothing there');
console.log('  measures a direction. That is the exposure a staged reversal has to close FIRST,');
console.log('  because the failure it produces — a movement half-reversed and confidently green —');
console.log('  is indistinguishable from a healthy one by every instrument this repository owns.');

console.log(`\n${bad === 0 ? 'PASS — the controls hold, so the table above is readable' : `FAIL — ${bad} control problem(s)`}`);
process.exit(bad === 0 ? 0 : 1);
