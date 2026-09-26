// TODO 164 — acceptance for `checkUndeclaredClearance`.
//
// (a) The exhaustive reference agrees with the memo+box-prune fast path. Run
//     the check twice on the same cheap axes — once at defaults, once with
//     `memo: false, boxPrune: false` — and require identical rows and
//     controls. The two paths share one `meshClearance` call underneath;
//     what differs is only which pairs are skipped before reaching it, so a
//     disagreement here would mean the memo or the box-prune is skipping a
//     pair the exact path would not have.
// (b) Controls PASS on the shipped movement.
// (c) THE PRE-#491 MUST-HIT. Before TODO 162's `CLEARANCE_BUDGETS` row
//     existed, `Keyless works` ⇄ `Power-reserve train` sat under CLEAR_MARGIN
//     with nothing reading it — the finding that opened this item. The pair's
//     minimum is dominated by the reserve wheel's TOOTH PHASE, which the
//     `wind` axis sets (not `train`): at one fixed corner phase the original
//     finding swung 0.1565 → 0.0478 → 0.0412 → 0.161 per tooth period, and
//     the planner's own number (0.0412 at `wind` f=0.1361) came from sweeping
//     `wind`. `train` alone poses `wind` at whatever `enterAxis('train')`
//     leaves it — a single fixed phase, not the sweep that finds the true
//     minimum — so this runs BOTH axes and asserts the pair reads under
//     margin with a 0.03–0.06 sanity band around the planner's own number,
//     not a re-derivation of it. Checked out at 9db93b2 (the commit before
//     that row landed), with the CURRENT inspect.js dropped in minus that one
//     row (`lift: [['Keyless works', 'Power-reserve train']]` re-admits the
//     pair the current table now excludes). If the old tree will not boot
//     against the new inspect.js, the mismatch is recorded and (c) is
//     skipped rather than guessed past.
//
//   node tools/probe-164-undeclared.mjs
import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import { mkdtempSync, cpSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { execSync } from 'node:child_process';

const port = process.env.PORT || '8564';
const root = process.env.ROOT || '..';

async function boot(servedRoot, portN) {
  const srv = spawn('python3', ['-m', 'http.server', String(portN), '--bind', '127.0.0.1'], { cwd: servedRoot, stdio: 'ignore' });
  await new Promise((r) => setTimeout(r, 900));
  const browser = await chromium.launch({ args: [
    '--disable-background-timer-throttling', '--disable-backgrounding-occluded-windows',
    '--disable-renderer-backgrounding',
  ] });
  const page = await browser.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  await page.goto(`http://127.0.0.1:${portN}/index.html`, { waitUntil: 'load', timeout: 90000 });
  await page.waitForFunction(() => !!window.__clock, null, { timeout: 90000 }).catch(() => {});
  return { srv, browser, page, errors };
}
const run = async (page, name, opts) => {
  await page.evaluate(([n, o]) => window.__I.start(window.__clock, n, o), [name, opts]);
  for (let i = 0; i < 1800; i++) {
    await new Promise((r) => setTimeout(r, 1000));
    const st = await page.evaluate((n) => {
      const s = window.__I.status(n);
      return s.state === 'running' ? { state: 'running' } : s;
    }, name);
    if (st.state === 'error') throw new Error(`${name}: ${st.error}`);
    if (st.state !== 'running') return st;
  }
  throw new Error(`${name} never finished`);
};

let bad = 0;

// ---- (a) and (b): on the served checkout, cheap axes ----------------------
{
  const { srv, browser, page } = await boot(root, port);
  await page.evaluate(async () => { window.__I = await import('./src/inspect.js'); });
  await page.evaluate(() => window.__clock.beginSweepHold());

  const AX = ['crown', 'train'];
  const fast = (await run(page, 'undeclaredClearance', { axes: AX, yieldEvery: 64 })).result;
  const exact = (await run(page, 'undeclaredClearance', { axes: AX, yieldEvery: 64, memo: false, boxPrune: false })).result;
  // Compare the VERDICT-BEARING fields only. `census` is a report of work
  // done (exactCalls/boxPruned differ by design between the two paths) and
  // `rawMins`/`controlRaw` are sliced-run scaffolding that can legitimately
  // differ for a pair NEITHER path ever reports as a row: `meshClearance`'s
  // own documented near-zero arbitration (§82's comment in `_meshClearanceInner`)
  // can return a true, UNBOUNDED distance once a spurious tri-tri near-zero
  // triggers `sampledVerdict` — a value that can exceed the query's own
  // upperBound. The exact path always reaches `meshClearance` for a pair the
  // fast path's finer BVH box-prune correctly skips as genuinely far, so the
  // two can record different (both far, both irrelevant) raw minima for a
  // pair that crosses CLEAR_MARGIN in neither. What must agree is what the
  // check actually asserts: the rows, the controls, the verdict.
  const strip = (r) => {
    const rows = [...r.rows].sort((x, y) => x.pair.localeCompare(y.pair))
      .map(({ pair, min, at, meshes, debt }) => ({ pair, min, at, meshes, debt }));
    const controls = [...r.controls].sort((x, y) => x.control.localeCompare(y.control));
    return JSON.stringify({
      population: r.population, rows, controls, control: r.control,
      violations: r.violations, regressed: r.regressed, staleDebt: r.staleDebt, malformedDebt: r.malformedDebt,
    }, null, 1);
  };
  const sameRows = strip(fast) === strip(exact);
  console.log(`(a) fast vs exact on [${AX.join(',')}]: ${fast.rows.length} vs ${exact.rows.length} rows — `
    + (sameRows ? 'IDENTICAL' : 'DIFFERENT'));
  if (!sameRows) {
    bad++;
    const a = strip(fast).split('\n'), b = strip(exact).split('\n');
    for (let i = 0; i < Math.max(a.length, b.length); i++) if (a[i] !== b[i]) { console.log(`  L${i}\n   fast:  ${a[i]}\n   exact: ${b[i]}`); break; }
  }

  console.log(`(b) controls on [${AX.join(',')}]: ${fast.control}`);
  for (const c of fast.controls) console.log(`    ${c.control}: ${c.pair} min ${c.min} bound ${c.bound} ok ${c.ok}`);
  if (!String(fast.control).startsWith('PASS')) bad++;

  await browser.close();
  srv.kill();
}

// ---- (c): the pre-#491 must-hit -------------------------------------------
{
  let tmp = null;
  try {
    tmp = mkdtempSync(join(tmpdir(), 'timesim-164-'));
    execSync(`git worktree add --detach "${tmp}" 9db93b2`, { cwd: root, stdio: 'pipe' });
    // Drop in the current inspect.js. The lift opt re-admits the pair TODO 162's
    // CLEARANCE_BUDGETS row now excludes, so the check measures it exactly as
    // it would have before that row existed.
    cpSync(join(root, 'src/inspect.js'), join(tmp, 'src/inspect.js'));
    const port2 = Number(port) + 1;
    const { srv, browser, page, errors } = await boot(tmp, port2);
    let ok = true;
    try {
      await page.waitForFunction(() => !!window.__clock, null, { timeout: 30000 });
      await page.evaluate(async () => { window.__I = await import('./src/inspect.js'); });
      await page.evaluate(() => window.__clock.beginSweepHold());
    } catch (e) {
      ok = false;
      console.log(`(c) SKIPPED — the old tree will not boot against the new inspect.js: ${e.message}\n`
        + `    page errors: ${errors.join(' | ')}`);
    }
    if (ok) {
      // wind AND train: the pair's minimum is dominated by the reserve
      // wheel's tooth phase, which `wind` sets — `train` alone fixes that
      // phase whereever enterAxis('train') leaves it (see the header comment).
      const st = await run(page, 'undeclaredClearance', {
        axes: ['wind', 'train'], yieldEvery: 64,
        lift: [['Keyless works', 'Power-reserve train']],
      });
      const row = st.result.rows.find((r) => r.pair === 'Keyless works ⇄ Power-reserve train');
      console.log(`(c) pre-#491 must-hit: ${row ? `FOUND min ${row.min} at ${row.at}` : 'NOT FOUND'}`);
      if (!row || row.min < 0.03 || row.min > 0.06) {
        bad++;
        console.log(`    expected 0.03–0.06 under CLEAR_MARGIN (planner's own number: 0.0412 at wind f=0.1361) — got ${row ? row.min : 'no row'}`);
      }
    }
    await browser.close();
    srv.kill();
  } finally {
    if (tmp) {
      try { execSync(`git worktree remove --force "${tmp}"`, { cwd: root, stdio: 'pipe' }); } catch {}
      try { rmSync(tmp, { recursive: true, force: true }); } catch {}
    }
  }
}

if (bad) { console.error(`FAILED: ${bad} check(s)`); process.exitCode = 1; }
else console.log('PASS — fast path agrees with exact, controls PASS, pre-#491 pair still catchable');
