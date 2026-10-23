// §264/§265 REBALANCED — DOES THE SPLIT SPEC TIER PUT BACK TOGETHER AS THE
// WHOLE ONE, AND IS EVERY OTHER SHAPE OF HAND-OFF REFUSED? Acceptance: exits
// non-zero on any failed row.
//
// The push's spec tier is split between the `battery tiers` job and the
// battery itself (tools/battery-tiers.mjs: the battery boots every twelfth
// declared point while it would otherwise wait for its sibling). The tier's
// promise is unchanged — one row per declared spec point, in declared order —
// so this holds the three functions that keep it, never a copy of them:
//
//   PURE (always, milliseconds):
//   1  THE RULE PARTITIONS: kept and handed are disjoint, cover every declared
//      point, keep 3 of 36 (the derivation's K), and keep none of a list too
//      short to reach the stride.
//   2  THE MERGE IS THE UNSPLIT TIER: the sibling's half and this run's half,
//      merged, deep-equal the rows an unsplit run would hold, in order.
//   3  EVERY BAD HALF IS REFUSED, each by its own reason: a missing row, a
//      duplicated row, a kept point in the file, two rows swapped, a whole
//      unsplit (format-1-shaped) tier, a foreign row, no tier, no ms. The
//      CONTROL is row 2's good half returning null — a refusal that fired on
//      everything would pass row 3 alone.
//   4  THE MERGE THROWS on a gap, a double across the halves and a foreign row.
//
//   REAL (--real, ~3 × 36 boots; needs a CLEAN tree, as the hand-off does):
//   5  The harness end to end with --spec-only: an unsplit run, then
//      --tiers-only (the sibling's 33) and --tiers-from (this run's 3, merged).
//      The spec gate lines and every booted row's line (liveness, warn count,
//      non-finite meshes) must be identical; the split run must say it TOOK
//      the file. Then the file with one row duplicated must be REFUSED by the
//      judging run, which boots that half itself and still matches.
//
//   node tools/probe-tiers-spec-hand.mjs [--real]
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { isDeepStrictEqual } from 'node:util';
import { SPEC_HAND_STRIDE, mergeSpecHalves, specHandRefusal, specHandedPoints, specKeptHere } from './battery-tiers.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const failures = [];
const row = (ok, what) => { console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${what}`); if (!ok) failures.push(what); };

// ---- PURE ------------------------------------------------------------------
console.log('pure — battery-tiers.mjs');
const declared = Array.from({ length: 36 }, (_, i) => ({ name: `p${i}`, q: `p=${i}` }));
const booted = (p) => ({ ...p, alive: true, warns: [`w${p.name}`], errors: [] });
const unsplit = declared.map(booted);

// 1
const kept = specKeptHere(declared);
const handedPts = specHandedPoints(declared);
row(kept.size === 3 && [...kept].join() === 'p11,p23,p35', `36 declared → kept [${[...kept]}] (every ${SPEC_HAND_STRIDE}th, the last of each run)`);
row(handedPts.length + kept.size === declared.length && handedPts.every((p) => !kept.has(p.name)),
  `handed ${handedPts.length} + kept ${kept.size} = ${declared.length}, disjoint`);
row(specKeptHere(declared.slice(0, SPEC_HAND_STRIDE - 1)).size === 0, `a list shorter than the stride keeps nothing (all handed)`);

// 2
const handed = { rows: unsplit.filter((r) => !kept.has(r.name)), ms: 400 };
const local = { rows: unsplit.filter((r) => kept.has(r.name)), ms: 30 };
row(specHandRefusal(declared, handed) === null, 'CONTROL: the good half is accepted');
const merged = mergeSpecHalves(declared, handed, local);
row(isDeepStrictEqual(merged.rows, unsplit) && merged.ms === 400, 'merged halves deep-equal the unsplit rows, in declared order; ms is the larger wall');
const empty = mergeSpecHalves(declared.slice(0, 5), { rows: unsplit.slice(0, 5), ms: 1 }, { rows: [], ms: 0 });
row(isDeepStrictEqual(empty.rows, unsplit.slice(0, 5)), 'a list with nothing kept merges to the sibling\'s rows alone');

// 3
const h = handed.rows;
const bad = {
  'a missing row': { rows: h.slice(1), ms: 1 },
  'a duplicated row': { rows: [...h.slice(0, 5), h[4], ...h.slice(5)], ms: 1 },
  'a duplicated row in place of another': { rows: [...h.slice(0, 5), h[4], ...h.slice(6)], ms: 1 },
  'a kept point in the file': { rows: [...h, unsplit[11]], ms: 1 },
  'a kept point in place of a handed one': { rows: [unsplit[11], ...h.slice(1)], ms: 1 },
  'two rows swapped': { rows: [h[1], h[0], ...h.slice(2)], ms: 1 },
  'the whole unsplit tier (format 1)': { rows: unsplit, ms: 1 },
  'a foreign row in place of one': { rows: [{ name: 'nope' }, ...h.slice(1)], ms: 1 },
  'no spec tier': null,
  'no ms': { rows: h },
};
for (const [what, spec] of Object.entries(bad)) {
  const why = specHandRefusal(declared, spec);
  row(typeof why === 'string', `refused — ${what}${why ? `: "${why}"` : ' (ACCEPTED)'}`);
}

// 4
const throws = (fn) => { try { fn(); return null; } catch (e) { return e.message; } };
for (const [what, fn] of Object.entries({
  'a gap (this run\'s half short)': () => mergeSpecHalves(declared, handed, { rows: local.rows.slice(1), ms: 0 }),
  'a double across the halves': () => mergeSpecHalves(declared, handed, { rows: [...local.rows, h[0]], ms: 0 }),
  'a foreign row': () => mergeSpecHalves(declared, handed, { rows: [...local.rows, { name: 'nope' }], ms: 0 }),
})) {
  const m = throws(fn);
  row(m !== null, `merge throws — ${what}${m ? `: "${m}"` : ' (DID NOT THROW)'}`);
}

// ---- REAL ------------------------------------------------------------------
if (process.argv.includes('--real')) {
  console.log('\nreal — ci-battery.mjs --spec-only, unsplit against split');
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
    const T = join(out, 'tiers.json');
    const B1 = run(['--spec-only', '--tiers-only', '--tiers-out', T]);
    const B2 = run(['--spec-only', '--tiers-from', T, '--tiers-wait-s', '60']);
    const rowsA = rowsOf(A), rowsB = rowsOf(B1 + B2);
    row(rowsA.length === 36, `the unsplit run booted ${rowsA.length} of 36`);
    row(isDeepStrictEqual(rowsA, rowsB), `every booted row identical, unsplit vs split (${rowsB.length} rows: 33 sibling + 3 here)`);
    row(/spec tier: taken from/.test(B2), 'the split run TOOK the sibling\'s half');
    const gA = gatesOf(A), gB = gatesOf(B2);
    row(gA.length > 0 && isDeepStrictEqual(gA, gB), `the spec gate lines identical (${gA.length}): ${gA.map((g) => g.replace(/^.*gate /, '')).join(' | ')}`);
    // The tampered hand-off: one row duplicated in the file.
    const f = JSON.parse(readFileSync(T, 'utf8'));
    f.spec.rows.splice(5, 0, f.spec.rows[4]);
    const Tbad = join(out, 'tiers-dup.json');
    writeFileSync(Tbad, JSON.stringify(f));
    const C = run(['--spec-only', '--tiers-from', Tbad, '--tiers-wait-s', '60']);
    const refused = C.match(/spec tier: NOT taken from [^\n]*/);
    row(!!refused, `a duplicated row is REFUSED: ${refused ? refused[0].replace(/^.*\(/, '(') : 'TAKEN'}`);
    row(isDeepStrictEqual(gatesOf(C), gA) && rowsOf(C).length === 36,
      'the refused run booted the half itself and its gates still match the unsplit run');
  } finally {
    rmSync(out, { recursive: true, force: true });
  }
}

console.log(failures.length ? `\nFAIL — ${failures.length} row(s)` : '\nPASS — the spec tier splits and merges back whole, and every bad half is refused');
process.exit(failures.length ? 1 : 0);
