// §264/§265 FANNED OUT — DO THE HAND-OFF FILES PUT BACK TOGETHER AS THE WHOLE
// OF EACH TIER, AND IS EVERY OTHER SHAPE OF HAND-OFF REFUSED? Acceptance:
// exits non-zero on any failed row.
//
// The push's tiers are measured by two sibling jobs, `battery spec` and
// `battery points`, each writing one file that names its PART; the battery
// takes each part from the one file that proves it (tools/battery-tiers.mjs:
// acceptTiers), and the spec tier may still be SPLIT with the battery by a
// stride (0 since the fan-out: the battery keeps none). The tiers' promise is
// unchanged — one row per declared spec point, in declared order, and the
// whole point tier from this point code — so this holds the functions that
// keep it, never a copy of them:
//
//   PURE (always, milliseconds):
//   1  THE RULE PARTITIONS: at the shipped stride (0) nothing is kept and all
//      36 are handed; at the control stride 12 kept and handed are disjoint,
//      cover every point and keep 3; a list too short for a stride keeps none.
//   2  THE MERGE IS THE UNSPLIT TIER, at both strides.
//   3  EVERY BAD HALF IS REFUSED, each by its own reason, at both strides. The
//      CONTROL is the good half returning null — a refusal that fired on
//      everything would pass row 3 alone.
//   4  THE MERGE THROWS on a gap, a double across the halves and a foreign row.
//   5  EVERY BAD FILE IS REFUSED (acceptTiers), its tier left for this run:
//      a wrong format (the format-2 one-file shape), a wrong or unnameable
//      tree, a part that does not exist, a file carrying the other part too,
//      the same part in two files, a part no file carries, a fetcher that
//      gave up, other point code, a point not swept full. CONTROLS: the two
//      good files are both taken, a refusal of one part leaves the other
//      taken, and --spec-only asks for no point tier.
//
//   REAL (--real, ~4 × 36 boots; needs a CLEAN tree, as the hand-off does):
//   6  The harness end to end with --spec-only: an unsplit run, then
//      --tiers-only --tiers-part spec (the sibling's 36) and --tiers-from
//      (taking it). The spec gate lines and every booted row's line (liveness,
//      warn count, non-finite meshes) must be identical; the split run must
//      say it TOOK the file. Then the file with one row duplicated must be
//      REFUSED, and a file that never arrives (its .failed written, as the
//      fetcher writes it) must fall back: each judging run boots the tier
//      itself and still matches.
//
//   node tools/probe-tiers-spec-hand.mjs [--real]
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { isDeepStrictEqual } from 'node:util';
import { SPEC_HAND_STRIDE, TIERS_FORMAT, acceptTiers, mergeSpecHalves, specHandRefusal, specHandedPoints, specKeptHere, tiersFile } from './battery-tiers.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const failures = [];
const row = (ok, what) => { console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${what}`); if (!ok) failures.push(what); };

// ---- PURE ------------------------------------------------------------------
console.log(`pure — battery-tiers.mjs (shipped stride ${SPEC_HAND_STRIDE}, control stride 12)`);
const declared = Array.from({ length: 36 }, (_, i) => ({ name: `p${i}`, q: `p=${i}` }));
const booted = (p) => ({ ...p, alive: true, warns: [`w${p.name}`], errors: [] });
const unsplit = declared.map(booted);

// 1
row(SPEC_HAND_STRIDE === 0, `the shipped stride is 0 (the fan-out's derivation: the battery keeps none)`);
row(specKeptHere(declared).size === 0 && specHandedPoints(declared).length === 36, 'stride 0: kept none, handed all 36');
const kept12 = specKeptHere(declared, 12);
const handed12 = specHandedPoints(declared, 12);
row(kept12.size === 3 && [...kept12].join() === 'p11,p23,p35', `stride 12: 36 declared → kept [${[...kept12]}] (the last of each run of 12)`);
row(handed12.length + kept12.size === declared.length && handed12.every((p) => !kept12.has(p.name)),
  `stride 12: handed ${handed12.length} + kept ${kept12.size} = ${declared.length}, disjoint`);
row(specKeptHere(declared.slice(0, 11), 12).size === 0, 'a list shorter than the stride keeps nothing (all handed)');

// 2, 3 and 4 at both strides
const throws = (fn) => { try { fn(); return null; } catch (e) { return e.message; } };
for (const stride of [SPEC_HAND_STRIDE, 12]) {
  const kept = specKeptHere(declared, stride);
  const handed = { rows: unsplit.filter((r) => !kept.has(r.name)), ms: 400 };
  const local = { rows: unsplit.filter((r) => kept.has(r.name)), ms: 30 };
  row(specHandRefusal(declared, handed, stride) === null, `stride ${stride}: CONTROL — the good half is accepted`);
  const merged = mergeSpecHalves(declared, handed, local);
  row(isDeepStrictEqual(merged.rows, unsplit) && merged.ms === 400, `stride ${stride}: merged halves deep-equal the unsplit rows, in declared order; ms is the larger wall`);
  const h = handed.rows;
  const bad = {
    'a missing row': { rows: h.slice(1), ms: 1 },
    'a duplicated row': { rows: [...h.slice(0, 5), h[4], ...h.slice(5)], ms: 1 },
    'a duplicated row in place of another': { rows: [...h.slice(0, 5), h[4], ...h.slice(6)], ms: 1 },
    'two rows swapped': { rows: [h[1], h[0], ...h.slice(2)], ms: 1 },
    'a foreign row in place of one': { rows: [{ name: 'nope' }, ...h.slice(1)], ms: 1 },
    'a foreign row added': { rows: [...h, { name: 'nope' }], ms: 1 },
    'no spec tier': null,
    'no ms': { rows: h },
    ...(stride ? {
      'a kept point in the file': { rows: [...h, unsplit[11]], ms: 1 },
      'a kept point in place of a handed one': { rows: [unsplit[11], ...h.slice(1)], ms: 1 },
      'the whole unsplit tier': { rows: unsplit, ms: 1 },
    } : {}),
  };
  for (const [what, spec] of Object.entries(bad)) {
    const why = specHandRefusal(declared, spec, stride);
    row(typeof why === 'string', `stride ${stride}: refused — ${what}${why ? `: "${why}"` : ' (ACCEPTED)'}`);
  }
  for (const [what, fn] of Object.entries({
    'a gap (the sibling\'s half short)': () => mergeSpecHalves(declared, { rows: h.slice(1), ms: 0 }, local),
    'a double across the halves': () => mergeSpecHalves(declared, handed, { rows: [...local.rows, h[0]], ms: 0 }),
    'a foreign row': () => mergeSpecHalves(declared, handed, { rows: [...local.rows, { name: 'nope' }], ms: 0 }),
  })) {
    const m = throws(fn);
    row(m !== null, `stride ${stride}: merge throws — ${what}${m ? `: "${m}"` : ' (DID NOT THROW)'}`);
  }
}

// 5 — the files
console.log('\npure — acceptTiers (which file each tier is taken from)');
const TREE = 'a'.repeat(40);
const CODE = { points: 'digest-1' };
const swept = ['s0', 's1', 's2'];
const pointsTier = { got: Object.fromEntries(swept.map((n) => [n, { changed: [] }])), plan: swept.map((name) => ({ name, mode: 'full' })), pr: false, ms: 448000 };
const specTier = { rows: unsplit, ms: 456000 };
const specF = () => ({ path: 'spec.json', f: tiersFile({ part: 'spec', tree: TREE, checkCode: CODE, tier: specTier }) });
const pointsF = () => ({ path: 'points.json', f: tiersFile({ part: 'points', tree: TREE, checkCode: CODE, tier: pointsTier }) });
const take = (files, extra = {}) => acceptTiers({ files, tree: TREE, checkCode: CODE, declared, swept, ...extra });
const said = (r) => r.lines.join(' | ');
{
  const r = take([specF(), pointsF()]);
  row(r.spec === specTier && r.points === pointsTier && r.lines.every((l) => / taken from /.test(l)),
    `CONTROL: the two good files — both tiers taken (${said(r)})`);
  const rev = take([pointsF(), specF()]);
  row(rev.spec === specTier && rev.points === pointsTier, 'CONTROL: the files in either order');
  const so = take([specF()], { specOnly: true });
  row(so.spec === specTier && so.points === null && so.lines.length === 1, `CONTROL: --spec-only takes the spec file and asks for no point tier (${said(so)})`);
  row(specF().f.tiersFormat === TIERS_FORMAT && specF().f.part === 'spec' && !('points' in specF().f), `tiersFile writes format ${TIERS_FORMAT}, its part, and no other tier`);
  row(throws(() => tiersFile({ part: 'both', tree: TREE, checkCode: CODE, tier: {} })) !== null, 'tiersFile refuses a part that does not exist');
}
const edit = (x, fn) => { const y = structuredClone(x); fn(y.f); return y; };
const cases = {
  // [files, which tier must be refused ('spec' | 'points' | 'both'), extra]
  'the format-2 one-file shape (both tiers, no part)': [[{ path: 'tiers.json', f: { tiersFormat: 2, tree: TREE, checkCode: CODE, spec: specTier, points: pointsTier } }], 'both'],
  'a spec file at the wrong format': [[edit(specF(), (f) => { f.tiersFormat = 2; }), pointsF()], 'spec'],
  'a spec file from another tree': [[edit(specF(), (f) => { f.tree = 'b'.repeat(40); }), pointsF()], 'spec'],
  'a points file from another tree': [[specF(), edit(pointsF(), (f) => { f.tree = 'b'.repeat(40); })], 'points'],
  'both files when this run cannot name its tree': [[specF(), pointsF()], 'both', { tree: null }],
  'a foreign part ("alarm")': [[edit(specF(), (f) => { f.part = 'alarm'; f.alarm = f.spec; delete f.spec; }), pointsF()], 'spec'],
  'a file with no part': [[edit(specF(), (f) => { delete f.part; }), pointsF()], 'spec'],
  'a spec file carrying the point tier too': [[edit(specF(), (f) => { f.points = pointsTier; }), pointsF()], 'spec'],
  'the spec part in two files (a duplicated half)': [[specF(), { ...specF(), path: 'spec2.json' }, pointsF()], 'spec'],
  'the points part in two files': [[specF(), pointsF(), { ...pointsF(), path: 'points2.json' }], 'points'],
  'no points file at all (a half that never came)': [[specF()], 'points'],
  'the spec fetcher gave up (a dead sibling)': [[{ path: 'spec.json', f: null, why: 'the fetcher gave up: the \'battery spec\' job ended (completed:failure) without uploading the tier' }, pointsF()], 'spec'],
  'nothing arrived from either sibling': [[{ path: 'spec.json', f: null, why: 'nothing arrived within 840 s' }, { path: 'points.json', f: null, why: 'nothing arrived within 840 s' }], 'both'],
  'a spec half with a duplicated row': [[edit(specF(), (f) => { f.spec.rows.splice(5, 0, f.spec.rows[4]); }), pointsF()], 'spec'],
  'a points file measured by other point code': [[specF(), edit(pointsF(), (f) => { f.checkCode = { points: 'digest-2' }; })], 'points'],
  'a points file with a point swept incrementally': [[specF(), edit(pointsF(), (f) => { f.points.plan[1].mode = 'incremental'; })], 'points'],
  'a points file missing a swept point': [[specF(), edit(pointsF(), (f) => { f.points.plan.pop(); delete f.points.got.s2; })], 'points'],
  'a PR\'s points file': [[specF(), edit(pointsF(), (f) => { f.points.pr = true; })], 'points'],
};
for (const [what, [files, refused, extra]] of Object.entries(cases)) {
  const r = take(files, extra);
  const specOk = refused === 'spec' || refused === 'both' ? r.spec === null : r.spec !== null;
  const pointsOk = refused === 'points' || refused === 'both' ? r.points === null : r.points !== null;
  const reasoned = r.lines.some((l) => /NOT tak/.test(l));
  row(specOk && pointsOk && reasoned, `refused (${refused}) — ${what}: ${said(r)}`);
}

// ---- REAL ------------------------------------------------------------------
if (process.argv.includes('--real')) {
  console.log('\nreal — ci-battery.mjs --spec-only, unsplit against the handed file');
  const dirty = execFileSync('git', ['status', '--porcelain', '--untracked-files=no'], { cwd: ROOT, encoding: 'utf8' }).trim();
  if (dirty) { console.log('  the working tree is dirty: the hand-off refuses an unnamed tree, so --real cannot run'); process.exit(2); }
  const out = mkdtempSync(join(tmpdir(), 'tiers-hand-'));
  const run = (args) => {
    console.log(`  $ node tools/ci-battery.mjs ${args.join(' ')}`);
    try { return execFileSync('node', ['tools/ci-battery.mjs', ...args], { cwd: ROOT, encoding: 'utf8', maxBuffer: 1 << 26 }); } catch (e) { return `${e.stdout}\nEXIT ${e.status}`; }
  };
  // What a spec row and a spec gate say in the log, timings stripped.
  const rowsOf = (log) => log.split('\n').filter((l) => /^ {2}[·✗] \S+ +(builds|DEAD|WEDGED)/.test(l)).map((l) => l.trim().replace(/\s+/g, ' ')).sort();
  const gatesOf = (log) => log.split('\n').filter((l) => /gate (PASS|FAIL)/.test(l) && /spec|config|identity|finite|silent/i.test(l)).map((l) => l.replace(/ · [\d.]+s\b.*$/, '').trim());
  try {
    const A = run(['--spec-only']);
    const T = join(out, 'spec.json');
    const B1 = run(['--spec-only', '--tiers-only', '--tiers-part', 'spec', '--tiers-out', T]);
    const B2 = run(['--spec-only', '--tiers-from', T, '--tiers-wait-s', '60']);
    const rowsA = rowsOf(A), rowsB = rowsOf(B1 + B2);
    row(rowsA.length === 36, `the unsplit run booted ${rowsA.length} of 36`);
    row(isDeepStrictEqual(rowsA, rowsB), `every booted row identical, unsplit vs handed (${rowsB.length} rows, ${rowsOf(B2).length} booted by the judging run)`);
    row(/spec tier: taken from/.test(B2), 'the judging run TOOK the sibling\'s file');
    const gA = gatesOf(A), gB = gatesOf(B2);
    row(gA.length > 0 && isDeepStrictEqual(gA, gB), `the spec gate lines identical (${gA.length}): ${gA.map((g) => g.replace(/^.*gate /, '')).join(' | ')}`);
    // The tampered hand-off: one row duplicated in the file.
    const f = JSON.parse(readFileSync(T, 'utf8'));
    f.spec.rows.splice(5, 0, f.spec.rows[4]);
    const Tbad = join(out, 'spec-dup.json');
    writeFileSync(Tbad, JSON.stringify(f));
    const C = run(['--spec-only', '--tiers-from', Tbad, '--tiers-wait-s', '60']);
    const refused = C.match(/spec tier: NOT taken from [^\n]*/);
    row(!!refused, `a duplicated row is REFUSED: ${refused ? refused[0].replace(/^.*\(/, '(') : 'TAKEN'}`);
    row(isDeepStrictEqual(gatesOf(C), gA) && rowsOf(C).length === 36,
      'the refused run booted the tier itself and its gates still match the unsplit run');
    // The half that never arrives: the fetcher's verdict, as it writes it.
    const Tnone = join(out, 'never.json');
    writeFileSync(`${Tnone}.failed`, "the 'battery spec' job ended (completed:failure) without uploading the tier\n");
    const D = run(['--spec-only', '--tiers-from', Tnone, '--tiers-wait-s', '60']);
    const fell = D.match(/tiers: NOT taking [^\n]*/);
    row(!!fell && /fetcher gave up/.test(fell[0]) && /spec tier: NOT taken \(no file carries it\)/.test(D), `a file that never arrives falls back: ${fell ? fell[0] : 'NOT SAID'}`);
    row(isDeepStrictEqual(gatesOf(D), gA) && rowsOf(D).length === 36,
      'the fallen-back run booted the tier itself and its gates still match the unsplit run');
  } finally {
    rmSync(out, { recursive: true, force: true });
  }
}

console.log(failures.length ? `\nFAIL — ${failures.length} row(s)` : '\nPASS — each tier comes back whole from exactly one file, and every bad hand-off is refused');
process.exit(failures.length ? 1 : 0);
