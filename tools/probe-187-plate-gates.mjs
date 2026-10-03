// TODO 187 — DOES THE BATTERY NOW SEE THE BASE PLATE IT CUTS? The plate is not a
// labelled unit, so until TODO 187 only `support` read it: `outlines`,
// `meshIntegrity`, the §152 digests and the fingerprint walked the labels and
// never reached it. TODO 172's first pocket draft — the setting cap's pocket
// cut as a SECOND ring across the rise corner's bore — opened the slab (76 open
// edges, two rings crossing) through every gate. TODO 187 holds the plate by
// name (`HELD_FIXTURES` in inspect.js) in those four readers, gates its
// closure and its cross-ring crossings, and this proves the gates FIRE, by
// re-cutting that draft.
//
// Acceptance, two virgin boots driven through the battery's own protocol
// (`virginBoot`, `runCheck`, and each check's `fails` from BATTERY — the gate
// the battery applies, not a re-statement of it):
//   CONTROL — the shipped tree:
//     1. boot silent (standing rule 6);
//     2. `outlines` passes its battery gate, with the base plate READ (at
//        least one mesh of it carries an authored shape — TODO 200's rivet
//        lands are lathes and never had one, which the gate counts rather
//        than fails, and every EXTRUDE of it is read or the gate fails on
//        noShape) and 0 cross-ring rows on it;
//     3. `meshIntegrity` passes its battery gate, the plate's meshes CLOSED;
//     4. the digest payload carries a 'Base plate' row and names it `held`,
//        and the fingerprint carries its box at every pose.
//   MUTANT — a temp copy whose makeBackPlate cuts the cap's pocket and the
//   rise bore as two rings (TODO 172's draft; one condition in geometry.js):
//     5. the patch moved the file (a patch that matched nothing would boot the
//        shipped tree and read as "the gate stayed green");
//     6. `outlines` FAILS its gate on a cross-ring row on the base plate;
//     7. `meshIntegrity` FAILS its gate on an open edge count on the base plate;
//     8. the 'Base plate' digest MOVES and no unit's does — the changed set is
//        the plate (plus `DIGEST_ALWAYS_CHANGED`), and `resolvePairsTouching`
//        accepts it without throwing;
//     9. no labelled unit carries a cross-ring row in either boot (the tier
//        gates them since TODO 198) — the mutation is the plate's alone.
// Reported, not gated: whether the mutant boots silent (it did when TODO 172
// measured it — the point of the item), and whether the FINGERPRINT moved. A
// box hash cannot see a hole, so it is not expected to; the plate's box row is
// there for its extent and station, and the digest is what reads its cut.
//
// Run from tools/ with a Playwright Chromium: `node probe-187-plate-gates.mjs`
// (exit 1 on any claim). About two minutes: two boots and two copies of the tree.
import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import { mkdtempSync, cpSync, readFileSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve, relative } from 'node:path';
import { BATTERY, virginBoot, prepPage, runCheck } from './battery-checks.mjs';

const ROOT = resolve(process.env.ROOT || '..');
const PORT0 = Number(process.env.PORT || 8571);
const BOOT_MS = 240000, CHECK_MS = 300000;

// TODO 172's draft, restored at the one place the shipped cut differs from it:
// the pocket and its through-bore are cut as ONE ring only when the condition
// holds, and as two separate rings otherwise. Forcing the second branch is the
// draft exactly — the floor (a crescent) and every other opening untouched.
const MUTATION = {
  file: 'src/geometry.js',
  find: 'if (B && Math.hypot(B.x - A.x, B.y - A.y) < A.r + B.r) p.setFromPoints(discUnionRing(A, B).reverse());',
  to: 'if (B && false) p.setFromPoints(discUnionRing(A, B).reverse());',
};
const HELD = 'Base plate';

const copyTree = () => {
  const dir = mkdtempSync(join(tmpdir(), 'plate187-'));
  cpSync(ROOT, dir, { recursive: true, dereference: true,
    // Matched against the path INSIDE the tree: a checkout living under a
    // `.claude/worktrees/` directory would otherwise filter out every file.
    filter: (s) => !/(^|[\\/])(\.git|node_modules|\.battery-out|\.claude|timelapse)([\\/]|$)/.test(relative(ROOT, s)) });
  return dir;
};

async function measure(browser, root, port, against = null) {
  const srv = spawn('python3', ['-m', 'http.server', String(port), '--bind', '127.0.0.1'], { cwd: root, stdio: 'ignore' });
  await new Promise((r) => setTimeout(r, 900));
  const base = `http://127.0.0.1:${port}`;
  try {
    const { context, page } = await virginBoot(browser, base, BOOT_MS);
    await page.waitForFunction(() => window.__clock.boot && window.__clock.boot.done, null, { timeout: BOOT_MS });
    const warns = await prepPage(page);
    const run = async (name) => {
      const entry = BATTERY.find((e) => e.name === name);
      const { result } = await runCheck(page, name, entry.opts, CHECK_MS);
      return { result, fails: entry.fails(result) };
    };
    const outlines = await run('outlines');
    const integrity = await run('meshIntegrity');
    const anchors = await page.evaluate((base) => {
      const I = window.__I, c = window.__clock;
      const fp = I.fingerprintFull(c);
      const digests = I.unitDigests(c);
      // The harness's own two steps on this page (ci-battery.mjs §152): the
      // changed set by inspect.js's definition, then the restriction every
      // sweep would be handed — which THROWS on a name it does not know.
      let changed = null, restrict = null;
      if (base) {
        changed = I.digestChangedUnits(base, digests);
        try { restrict = { ok: true, size: I.resolvePairsTouching(c, changed).size }; }
        catch (e) { restrict = { ok: false, error: String(e.message || e) }; }
      }
      return { digests, changed, restrict, fpHash: I.fingerprint(c).hash,
        fpPlateRows: Object.keys(fp.rows).filter((k) => k.startsWith('Base plate#')).length, fpPoses: fp.poseCount };
    }, against);
    await context.close();
    return { warns, outlines, integrity, ...anchors };
  } finally { srv.kill(); }
}

const claims = [];
const claim = (id, ok, what) => { claims.push({ id, ok }); console.log(`${ok ? 'PASS' : 'FAIL'}  ${id}. ${what}`); };

const browser = await chromium.launch();
const mutantDir = copyTree();
let control, mutant, applied = false;
try {
  const target = join(mutantDir, MUTATION.file);
  const before = readFileSync(target, 'utf8');
  const hits = before.split(MUTATION.find).length - 1;
  if (hits === 1) {
    const after = before.replace(MUTATION.find, MUTATION.to);
    writeFileSync(target, after);
    applied = after !== before;
  }
  console.log('CONTROL — the shipped tree');
  control = await measure(browser, ROOT, PORT0);
  console.log('MUTANT — TODO 172\'s two-ring draft');
  mutant = applied ? await measure(browser, mutantDir, PORT0 + 1, control.digests) : null;
} finally {
  await browser.close();
  rmSync(mutantDir, { recursive: true, force: true });
}

const heldOf = (r) => r.outlines.result.held.find((h) => h.name === HELD);
const closureOf = (r) => r.integrity.result.closure.rows.filter((x) => x.unit === HELD);
const crossOf = (r) => r.outlines.result.crossRing.gated.filter((x) => x.unit === HELD);
const fmtClosure = (rows) => rows.map((x) => `${x.mesh} ${x.tris} tris ${x.open} open / ${x.nonManifold} non-manifold`).join('; ');

console.log('');
claim(1, control.warns.length === 0, `control boots silent (${control.warns.length} boot warn(s))`);
{
  const h = heldOf(control);
  claim(2, control.outlines.fails.length === 0 && h && h.meshes > 0 && h.read > 0 && crossOf(control).length === 0,
    `control outlines gate: ${control.outlines.fails.length} fail(s); base plate read ${h ? `${h.read} of ${h.meshes}` : 'MISSING'} meshes, `
    + `${crossOf(control).length} cross-ring rows on it; ${control.outlines.result.read} of ${control.outlines.result.geometries} geometries read`);
}
{
  const rows = closureOf(control);
  claim(3, control.integrity.fails.length === 0 && rows.length > 0 && rows.every((x) => x.open === 0 && x.nonManifold === 0),
    `control meshIntegrity gate: ${control.integrity.fails.length} fail(s); base plate closure: ${fmtClosure(rows) || 'NO ROWS'}`);
}
claim(4, !!control.digests.units[HELD] && (control.digests.held || []).includes(HELD) && control.fpPlateRows === control.fpPoses,
  `control digests carry '${HELD}' (held: ${JSON.stringify(control.digests.held)}; ${control.digests.unitCount} units), `
  + `fingerprint carries its box at ${control.fpPlateRows} of ${control.fpPoses} poses (hash ${control.fpHash})`);

claim(5, applied, `the mutation moved ${MUTATION.file} (anchor matched once and the file changed)`);
if (mutant) {
  const cross = crossOf(mutant);
  const crossings = cross.reduce((n, x) => n + x.crossings, 0);
  claim(6, mutant.outlines.fails.length > 0 && cross.length > 0 && mutant.outlines.fails.some((f) => f.unit === HELD),
    `mutant outlines gate: ${mutant.outlines.fails.length} fail(s); base plate cross-ring: `
    + `${cross.map((x) => `${x.mesh} ${x.rings} ${x.crossings} crossing(s) first at ${x.first}`).join('; ') || 'NONE'} (total ${crossings})`);
  const rows = closureOf(mutant);
  const open = rows.reduce((n, x) => n + x.open + x.nonManifold, 0);
  claim(7, mutant.integrity.fails.some((f) => f.unit === HELD) && open > 0,
    `mutant meshIntegrity gate: ${mutant.integrity.fails.length} fail(s); base plate closure: ${fmtClosure(rows)}`);
  const names = new Set([...Object.keys(control.digests.units), ...Object.keys(mutant.digests.units)]);
  const moved = [...names].filter((n) => control.digests.units[n]?.key !== mutant.digests.units[n]?.key).sort();
  const always = new Set(mutant.digests.alwaysChanged || []);
  const unitMoved = moved.filter((n) => n !== HELD && !always.has(n));
  claim(8, moved.includes(HELD) && unitMoved.length === 0 && (mutant.changed || []).includes(HELD) && mutant.restrict?.ok,
    `digests that moved: ${JSON.stringify(moved)} (the plate ${moved.includes(HELD) ? 'MOVED' : 'did NOT move'}; `
    + `${unitMoved.length} labelled unit(s) moved${unitMoved.length ? `: ${unitMoved.join(', ')}` : ''}); `
    + `digestChangedUnits → ${JSON.stringify(mutant.changed)}, resolvePairsTouching `
    + `${mutant.restrict?.ok ? `accepts it (${mutant.restrict.size} names)` : `THREW: ${mutant.restrict?.error}`}`);
  const unitRows = (r) => r.outlines.result.crossRing.gated.filter((x) => x.unit !== HELD);
  const fmtRows = (rows) => rows.map((x) => `${x.unit} / ${x.mesh} ${x.rings} ${x.crossings}`).join('; ') || 'none';
  claim(9, unitRows(control).length === 0 && unitRows(mutant).length === 0,
    `unit cross-ring rows (gated since TODO 198): control ${fmtRows(unitRows(control))}, mutant ${fmtRows(unitRows(mutant))}`);
  console.log('');
  console.log(`REPORT  mutant boot warns: ${mutant.warns.length}${mutant.warns.length ? ` — ${mutant.warns.slice(0, 3).join(' | ')}` : ' (silent — every boot assert passed the open plate)'}`);
  console.log(`REPORT  fingerprint ${control.fpHash === mutant.fpHash ? 'UNMOVED' : 'MOVED'} (${control.fpHash} → ${mutant.fpHash}) — a box cannot see a hole`);
} else {
  for (const id of [6, 7, 8, 9]) claim(id, false, 'mutant not measured — the patch did not apply');
}

const failed = claims.filter((c) => !c.ok);
console.log(`\n${failed.length ? `FAIL — ${failed.length} claim(s): ${failed.map((c) => c.id).join(', ')}` : `PASS — ${claims.length} claims`}`);
process.exit(failed.length ? 1 : 0);
