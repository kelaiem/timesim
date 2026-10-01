// TODO 186 B1 — THE SILENT SPEC POINTS, SWEPT, and kept swept incrementally.
//
// TODO 158 tier A marks every build whose configuration key is not in
// src/validated-configs.js. Until this, that set held the identity alone,
// because no spec point other than the default had ever been collision-swept:
// the spec-boot tier asserts LIVENESS, and a moved station that boots is not
// a moved station that clears. This module is the sweep that lets a point
// join, and the sweep that keeps it joined.
//
// THE CLAIM IS §152's, USED TWICE. A sweep's verdict is f(geometry, pose net,
// check code), and the per-unit key measures the first. So a pair neither of
// whose units changed between two builds may inherit the other build's row,
// and only the pairs touching a changed unit are measured (`pairsTouching`,
// unioned back by battery-union.mjs with `point: true`). The two builds are:
//
//   FULL         the point against THIS run's DEFAULT build. Every push and
//                dispatch run, and any PR run that cannot go incremental.
//                Measured: 0.06–0.56× the default's own three sweeps per
//                point (see TODO 186's closure for the table).
//   INCREMENTAL  the point against ITS OWN stored whole payload from the
//                baseline (the push run's points file). A PR re-sweeps only
//                the units its own change moved in that point's build — on a
//                typical PR, Chain alone (DIGEST_ALWAYS_CHANGED).
//
// Every uncertainty resolves towards FULL and says so (decidePointMode): no
// stored file, an unreadable or misshapen one, a moved check-code digest, no
// entry for the point, a stored entry with no whole payload. A PR's point tier is then held under a WALL CEILING
// (POINT_PR_BUDGET_MS in ci-battery.mjs): a point that cannot finish inside it
// is SKIPPED, which is a verdict of its own — unverified this run, named in
// the log — and never reads as clean.
//
// WHICH POINTS. Only spec rows declaring `sweep: true`: the non-identity
// points that boot SILENT. A warning point already says it is out of its
// window, and recording those as expected-red is B2's (it needs the §127
// matrix). `reconf=1` boots silent too, but its key IS the default's.
//
// WHICH CHECKS. `inspection`, `clearances`, `undeclaredClearance` — between
// them every unit pair is classified. The STOP CONDITION is TODO 186's: a
// point that reports FORBIDDEN, a clearance violation or an undeclared pair is
// a FINDING. It does not join the validated set (validated-configs.mjs takes
// only clean rows), and if it is already listed, gate 3 fails.
//
// NO SHAPE QUANTUM. TODO 186 allowed one (hash the shape half at the place
// quantum, so float-noise re-cuts stop reading as changes), on the suspicion
// that `balstep=60`'s three-quarter plate — the point's whole 2,500 s — was
// noise. Measured, it is not: 88 coordinates of the plate's 168,117 vertices
// move, by up to 0.0065 at its rim (x ≈ 41), so the plate IS re-cut and the
// raw key is right to sweep it. A quantum would have bought nothing here, so
// point digests are §152's own, unquantised.
//
// DIGESTED FOR POINTS ONLY. What a point stores IS inherited by a later PR,
// so the code that produced it must void the entry when it changes: every
// points file carries ci-battery.mjs's pointsCodeDigest — the four
// CHECK_CODE_FILES plus THIS file — and decidePointMode sends a point FULL
// when it moved. This file is not on CHECK_CODE_FILES itself, because it
// cannot reach a default row. Split out of ci-battery.mjs because that file
// runs at module scope, and tools/probe-186-points.mjs must call the same
// judge the harness calls rather than a copy of it.
import { BATTERY, prepPage, runCheck, virginBoot } from './battery-checks.mjs';
import { unionCheck } from './battery-union.mjs';

export const POINT_CHECKS = Object.freeze(['inspection', 'clearances', 'undeclaredClearance']);
// Bump when the points file changes shape — an older file then falls out of
// the incremental path (REPORT_FORMAT_VERSION's rule, for this file).
export const POINTS_FORMAT_VERSION = 1;

// A stored point whose verdict produced WHOLE payloads may be a union base.
const WHOLE = new Set(['clean', 'finding']);

// FULL or INCREMENTAL, decided from the stored file before anything boots.
// `stored` is the parsed points file or null; `incremental` is false on every
// run that writes a baseline (push, dispatch, a local full run).
export function decidePointMode({ name, stored, checkCode, incremental }) {
  if (!incremental) return { mode: 'full', why: 'not an incremental run — a full point sweep, the kind a baseline is written from' };
  if (!stored) return { mode: 'full', why: 'no stored points baseline' };
  if (stored.formatVersion !== POINTS_FORMAT_VERSION) {
    return { mode: 'full', why: `stored points file at format v${stored.formatVersion ?? 'unversioned'}, this harness writes v${POINTS_FORMAT_VERSION}` };
  }
  // §152's rule that a baseline must be a whole verdict, for points: a file a
  // PR wrote holds incremental entries unioned against an older baseline (and
  // a restricted default's run unions against inherited rows), so inheriting
  // from it would chain one key error forward through every PR.
  if (stored.whole !== true) return { mode: 'full', why: 'the stored points file was not written by a whole run (a PR, or one unioned against a restricted default)' };
  if (JSON.stringify(stored.checkCode) !== JSON.stringify(checkCode)) return { mode: 'full', why: 'CHECK CODE moved since the stored sweep — its rows are void' };
  const e = stored.points?.[name];
  if (!e) return { mode: 'full', why: 'no stored entry for this point' };
  if (!WHOLE.has(e.verdict) || !e.digests || POINT_CHECKS.some((c) => !e.result?.[c])) {
    return { mode: 'full', why: `the stored entry carries no whole payload (verdict ${e.verdict ?? 'none'})` };
  }
  return { mode: 'incremental', why: 'stored whole payload at a matching check-code digest', entry: e };
}

// The default's digests for a FULL point to be compared against: one virgin
// boot. (A run with --digests already took the same key on its §152
// preflight; this boot is kept separate so the tier does not depend on which
// flags the run was given.)
export async function defaultPointDigests({ browser, base, bootInTurn, bootTimeoutMs }) {
  const D = await bootInTurn(() => virginBoot(browser, base, bootTimeoutMs));
  try {
    return await D.page.evaluate(() => window.__I.unitDigests(window.__clock));
  } finally {
    await D.context.close().catch(() => {});
  }
}

// The browser half. Boots the point (?trial=1: it neither reads nor writes
// /__state), takes its per-unit key, computes the changed set against the
// union base (`against`: the default's digests for FULL, the stored entry's
// for INCREMENTAL), and runs the three sweeps restricted to it — WHOLE, never
// per axis. `deadline` (ms since epoch, or null) is the PR ceiling: a sweep
// still running then is abandoned and the point is SKIPPED.
//
// Never throws: a point that dies is a row with an `error`, so one bad point
// cannot take the rest of the tier with it.
export async function sweepPoint({ browser, base, point, mode, against, bootInTurn, bootTimeoutMs, checkTimeoutMs, deadline = null, opts = {}, mutate = null }) {
  const t0 = Date.now();
  let context = null;
  const left = () => (deadline === null ? checkTimeoutMs : Math.min(checkTimeoutMs, deadline - Date.now()));
  try {
    if (left() <= 0) return { q: point.q, mode, skipped: 'the PR ceiling was spent before this point started', ms: 0 };
    const P = await bootInTurn(() => virginBoot(browser, base, bootTimeoutMs, `?trial=1&${point.q}`));
    context = P.context;
    const page = P.page;
    const warns = await prepPage(page);
    const config = await page.evaluate(() => window.__clock.config ?? null);
    const digests = await page.evaluate(() => window.__I.unitDigests(window.__clock));
    // inspect.js's own digestChangedUnits — one definition of "changed",
    // Chain always in it, a unit missing from either side counted.
    const changed = await page.evaluate(([b, h]) => window.__I.digestChangedUnits(b, h), [against, digests]);
    // A unit the base has and this build does not cannot be named to
    // pairsTouching (it throws on unknown names, deliberately); it has no
    // pairs here, and the union still drops the base's rows for it.
    const known = new Set(await page.evaluate(() => window.__clock.labelEntries.map((e) => e.name)));
    const touching = changed.filter((n) => known.has(n));
    // The probe's broken-point control: corrupt the metal AFTER the key was
    // taken, the way a real defect in a changed unit would read.
    if (mutate) await page.evaluate(mutate);
    const checks = {};
    for (const name of POINT_CHECKS) {
      if (left() <= 0) return { q: point.q, mode, skipped: `the PR ceiling ran out before ${name}`, changed, ms: Date.now() - t0 };
      const entry = BATTERY.find((e) => e.name === name);
      try {
        checks[name] = await runCheck(page, name, { ...entry.opts, ...opts, pairsTouching: touching }, left());
      } catch (err) {
        if (deadline !== null && Date.now() >= deadline - 1000) {
          return { q: point.q, mode, skipped: `the PR ceiling ran out during ${name}`, changed, ms: Date.now() - t0 };
        }
        throw err;
      }
    }
    return { q: point.q, mode, warns, config, digests, changed, absentHere: changed.filter((n) => !known.has(n)), checks, ms: Date.now() - t0 };
  } catch (err) {
    return { q: point.q, mode, error: String(err.message), ms: Date.now() - t0 };
  } finally {
    await context?.close().catch(() => {});
  }
}

// The assembly half: union each restricted payload with its base and read it
// with the battery's OWN gate predicate (`fails`), so "clean" means exactly
// what it means for the default build.
//
//   'clean'    booted silent, every check unioned, every gate empty
//   'finding'  a gate predicate is non-empty — TODO 186's stop condition
//   'warns'    booted with warnings: not a B1 point this run
//   'skipped'  the PR ceiling ran out — unverified THIS run, never clean
//   'broken'   never ran, errored, or could not be judged; the harness gates it
//
// `defaults` maps check → the default's whole payload from this run (after
// any §152 union); `entry` is the stored point entry an incremental sweep
// unions against. Returns the row and, for a whole verdict, the merged
// payloads a baseline stores.
export function judgePoint(point, got, { defaults, entry }) {
  const row = { name: point.name, q: point.q };
  if (!got) return { row: { ...row, verdict: 'broken', why: 'never ran' } };
  Object.assign(row, { mode: got.mode, ms: got.ms });
  if (got.skipped) return { row: { ...row, verdict: 'skipped', why: got.skipped } };
  if (got.error) return { row: { ...row, verdict: 'broken', why: got.error } };
  Object.assign(row, { key: got.config?.key ?? null, changed: got.changed, absentHere: got.absentHere, warns: got.warns.length, perCheck: {} });
  const changed = new Set(got.changed);
  const merged = {};
  let failing = 0;
  for (const name of POINT_CHECKS) {
    const gate = BATTERY.find((e) => e.name === name);
    const head = got.checks?.[name]?.result;
    const base = got.mode === 'incremental' ? entry?.result?.[name] : defaults[name];
    const broke = (why) => ({ row: { ...row, verdict: 'broken', why: `${name}: ${why}` } });
    if (!head) return broke('no payload');
    if (!head.restriction) return broke('ran without its restriction record');
    if (!base) return broke(got.mode === 'incremental' ? 'the stored entry has no payload' : 'the default\'s own payload is missing, so there is nothing to union against');
    // A base still carrying a restriction record describes only part of the
    // movement (a §152 union that failed upstream) — nothing to stand on.
    if (base.restriction) return broke('its union base is itself a restricted payload, not a whole movement');
    try {
      merged[name] = unionCheck(name, base, head, changed, { point: true });
    } catch (err) {
      return broke(err.message);
    }
    const fails = gate.fails(merged[name]);
    failing += fails.length;
    row.perCheck[name] = { ms: got.checks[name].ms, fails: fails.slice(0, 20), failCount: fails.length, note: gate.note?.(merged[name]) };
  }
  if (row.warns) return { row: { ...row, verdict: 'warns' } };
  if (!row.key) return { row: { ...row, verdict: 'broken', why: 'the point reported no __clock.config key' } };
  return { row: { ...row, verdict: failing ? 'finding' : 'clean' }, merged, digests: got.digests };
}

// The evidence a clean point's validated-configs row carries. Counts that
// move with every landing (pairs, budgets) stay in --report; the row names
// what the sweep covered and what it found.
export function evidenceOf(row) {
  return `battery (TODO 186 B1): full point sweep — inspection, clearances and undeclaredClearance restricted to the `
    + `${row.changed.length} unit(s) this point changes against the default [${row.changed.join(', ')}] over every axis, `
    + 'unioned with the default build\'s full run: 0 FORBIDDEN, 0 clearance violations, 0 undeclared pairs under CLEAR_MARGIN; '
    + 're-verified every run (incrementally on a PR)';
}
