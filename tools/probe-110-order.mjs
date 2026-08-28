// TODO 110 step 1 — WHICH CHECKS CAN OBSERVE WHAT RAN BEFORE THEM?
//
// CLAUDE.md states the harness invariant flatly: "start() calls
// clock.resetInputs() before every check, so no check can observe which ones
// ran before it — if a report ever moves between --shards 1 and --shards 2,
// the check that moved has broken that invariant and is the bug."
//
// For EASED state it was false. `resetInputs()` assigns the state VARIABLES;
// the SCENE follows only on a later tick with real dt, and `start()` runs its
// check in the SAME MICROTASK as the reset. So a check that READS the live
// scene rather than posing it measures the previous check's pose.
//
// This enumerates the exposed class by MEASUREMENT rather than by reading the
// code. For each check: run it from a settled scene, then DIRTY the scene with
// a check that leaves a pose behind, then run it again — and compare the two
// payloads. A check whose payload moves is one that can observe its
// predecessor. That is the same test the invariant is written as, run per
// check instead of per shard schedule.
//
// WHY A PROBE AND NOT A READING OF THE SOURCE. A code-level shortlist tells
// you which checks TOUCH matrixWorld; it cannot tell you whether the pose that
// reaches them differs, which depends on what the dirtying check leaves and on
// whether any of it is eased. And a probe's own `page.evaluate` calls have rAF
// frames between them — the ease relaxes in the gaps — so the disagreement is
// only visible when the two runs happen inside one evaluate, as they do here.
//
// THE POSITIVE CONTROL IS THE POINT. Before TODO 110's fix, `slenderness` MUST
// come back DIFFERENT (the alarm stem's declared bearing lands in air once the
// crown pull has been left set). If it does not, this probe is measuring
// nothing and its silence about the other checks means nothing either.
//
// A REPORT (§40): prints and exits 0. Usage:
//   node probe-110-order.mjs [out.json]        (from tools/)
//   DIRTY=alarmHandoffs node probe-110-order.mjs
import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import { writeFileSync } from 'node:fs';

const PORT = process.env.PORT || 8475;
const ROOT = process.env.ROOT || '..';
const DIRTY = process.env.DIRTY || 'alarmHandoffs';
// The sweeps are minutes each and pose every sample by construction; this runs
// the population that fits in a few minutes and NAMES what it skipped, because
// "not measured" and "measured clean" are different answers.
const SKIP = (process.env.SKIP || 'inspection,clearances,sweptOverlap,penetration,expectedContacts,intraUnit,sweptRegistry,freeAnnulus,focused').split(',');

const srv = spawn('python3', ['-m', 'http.server', String(PORT), '--bind', '127.0.0.1'], { cwd: ROOT, stdio: 'ignore' });
await new Promise((r) => setTimeout(r, 800));
const browser = await chromium.launch();
const page = await browser.newPage();
page.on('pageerror', (e) => console.error('PAGEERROR', String(e)));
await page.goto(`http://127.0.0.1:${PORT}/index.html`, { waitUntil: 'load', timeout: 60000 });
await page.waitForFunction(() => !!window.__clock, null, { timeout: 60000 });

const V = await page.evaluate(async ({ DIRTY, SKIP }) => {
  const I = await import('./src/inspect.js');
  const clock = window.__clock;

  // The whole comparison must happen inside ONE evaluate: between two
  // evaluates the page runs rAF frames, the ease relaxes, and the defect
  // disappears. That is why every probe before this one passed the
  // declaration the battery rejected.
  //
  // start() is the real caller, so use it rather than reproducing it — a
  // second definition of "how a check is invoked" is how this class of bug
  // arrives in the first place.
  const once = (name) => new Promise((resolve) => {
    const r = I.start(clock, name);
    if (typeof r === 'string' && r.startsWith('unknown check')) return resolve({ error: r });
    const poll = () => {
      const job = I.status(name);
      if (job && job.state !== 'running' && job.state !== 'missing') return resolve(job);
      setTimeout(poll, 25);
    };
    poll();
  });

  // A stable digest of a payload: JSON with keys sorted, minus the timing
  // fields the harness itself stamps (ms/startedAt move every run and say
  // nothing about pose).
  const digest = (o) => {
    const drop = new Set(['ms', 'startedAt', 'finishedAt', 'elapsed']);
    const walk = (v) => {
      if (Array.isArray(v)) return v.map(walk);
      if (v && typeof v === 'object') {
        const out = {};
        for (const k of Object.keys(v).sort()) if (!drop.has(k)) out[k] = walk(v[k]);
        return out;
      }
      return typeof v === 'number' ? +v.toFixed(6) : v;
    };
    return JSON.stringify(walk(o));
  };

  const names = I.CHECK_NAMES.filter((n) => !SKIP.includes(n) && n !== DIRTY);
  const rows = [];
  for (const name of names) {
    const a = await once(name);
    if (a.error) { rows.push({ name, verdict: 'UNKNOWN', why: a.error }); continue; }
    await once(DIRTY);                      // leave a pose behind
    const b = await once(name);
    const da = digest(a.result), db = digest(b.result);
    rows.push({ name, verdict: da === db ? 'stable' : 'ORDER-DEPENDENT', bytes: [da.length, db.length] });
  }
  return { dirty: DIRTY, skipped: SKIP, checked: names.length, rows };
}, { DIRTY, SKIP });

await browser.close();
srv.kill();

const out = process.argv[2];
if (out) writeFileSync(out, JSON.stringify(V, null, 2));

const moved = V.rows.filter((r) => r.verdict === 'ORDER-DEPENDENT');
console.log(`dirtied with '${V.dirty}'; ${V.checked} checks compared, ${moved.length} order-dependent\n`);
for (const r of V.rows) console.log(`  ${r.verdict.padEnd(16)} ${r.name}${r.why ? `  (${r.why})` : ''}`);
console.log(`\nskipped (not measured, not clean): ${V.skipped.join(', ')}`);
// THE CONTROL, stated so it reads correctly in both worlds. Before TODO 110's
// fix `slenderness` MUST come back ORDER-DEPENDENT (the alarm stem's declared
// bearing lands in air once the crown pull has been left set); after it, stable.
// A run where it is stable proves the fix ONLY if a run before the fix showed
// it moving — otherwise this probe is measuring nothing and its silence about
// the other checks means nothing either. Measured 2026-08-28: 1 of 17 before,
// 0 of 17 after.
const ctl = V.rows.find((r) => r.name === 'slenderness')?.verdict ?? 'NOT RUN';
console.log(`\nCONTROL — 'slenderness' is ${ctl}: ${ctl === 'ORDER-DEPENDENT'
  ? 'the defect is present, so this run can see it (pre-fix state)'
  : ctl === 'stable'
    ? 'settled — expected AFTER the fix; before it, this reading would mean the probe measured nothing'
    : 'the control did not run, so nothing below is evidence'}`);
