// TODO 202 step 4 — DOES THE PLATE TIER CATCH A PART BURIED IN THE BASE PLATE?
// For as long as `makeBackPlate` extruded its `thickness` with the bevel stood
// PROUD of both faces, the plate presented 0.3 more metal on each side than
// the movement was solved against, and a dozen parts seated off PLATE_TOP sat
// up to 0.225 inside it under a green board: the plate is a HELD fixture (TODO
// 187), in no sweep's pairs. TODO 202 cut the plate to its finished thickness
// and added `plateSeats`, which holds every labelled mesh within CLEAR_MARGIN
// of the plate to a declared seat or a frozen debt row. This proves that gate
// FIRES on the defect it exists for, by restoring the proud extrude.
//
// Not probe-187-plate-gates.mjs, which proves the plate's OWN cut is read
// (outlines' cross-ring tier, meshIntegrity's closure); this one is about the
// metal AROUND the plate, which no check of the plate's cut can see.
//
// Acceptance, two virgin boots through the battery's own protocol
// (`virginBoot`, `runCheck`, and the BATTERY row's `fails`):
//   CONTROL — the shipped tree:
//     1. boot silent (standing rule 6);
//     2. `plateSeats` passes its battery gate, its control PASS.
//   MUTANT — a temp copy whose makeBackPlate extrudes the full `thickness`
//   with the bevel added outside it, as before TODO 202:
//     3. the patch moved the file (both anchors matched once);
//     4. `plateSeats` FAILS its gate;
//     5. it names, as UNDECLARED CONTACT, parts TODO 202 measured buried that
//        no table excuses — the set-up ratchet and the alarm governor's arbor;
//     6. it names, as REGRESSED DEBT, a part the TODO 209 inventory froze above
//        the plate — the keyless transfer wheel — now in contact;
//     7. its own control still PASSES (the mutant fails on findings, not on an
//        instrument that stopped measuring).
// Reported, not gated: the mutant's boot warns (§234's back-face guard is
// expected to fire — the plate's presented face moved).
//
// Run from tools/ with a Playwright Chromium: `node probe-202-plate-tier.mjs`
// (exit 1 on any claim). About two minutes: two boots and a copy of the tree.
import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import { mkdtempSync, cpSync, readFileSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { BATTERY, virginBoot, prepPage, runCheck } from './battery-checks.mjs';

const ROOT = resolve(process.env.ROOT || '..');
const PORT0 = Number(process.env.PORT || 8581);
const BOOT_MS = 240000, CHECK_MS = 300000;

// The pre-TODO-202 extrude, restored at the two lines that differ: the blank's
// depth and the translate that centres it. The pockets' floors keep the
// finished faces, so the mutant is the slab alone standing proud.
const MUTATIONS = [
  { file: 'src/geometry.js', find: '    depth: thickness - 2 * bevelT,\n', to: '    depth: thickness,\n' },
  { file: 'src/geometry.js', find: '  geo.translate(0, 0, -(thickness - 2 * bevelT) / 2);\n', to: '  geo.translate(0, 0, -thickness / 2);\n' },
];
const MUST_VIOLATE = ['Set-up work / ratchet', 'Alarm governor / alarmGovArbor'];
const MUST_REGRESS = ['Keyless works / transferWheel'];

const copyTree = () => {
  const dir = mkdtempSync(join(tmpdir(), 'plate202-'));
  cpSync(ROOT, dir, { recursive: true, dereference: true,
    filter: (s) => !/(^|[\\/])(\.git|node_modules|\.battery-out|\.claude|timelapse)([\\/]|$)/.test(s) });
  return dir;
};

async function measure(browser, root, port) {
  const srv = spawn('python3', ['-m', 'http.server', String(port), '--bind', '127.0.0.1'], { cwd: root, stdio: 'ignore' });
  await new Promise((r) => setTimeout(r, 900));
  try {
    const { context, page } = await virginBoot(browser, `http://127.0.0.1:${port}`, BOOT_MS);
    await page.waitForFunction(() => window.__clock.boot && window.__clock.boot.done, null, { timeout: BOOT_MS });
    const warns = await prepPage(page);
    const entry = BATTERY.find((e) => e.name === 'plateSeats');
    const { result } = await runCheck(page, 'plateSeats', entry.opts, CHECK_MS);
    await context.close();
    return { warns, result, fails: entry.fails(result) };
  } finally { srv.kill(); }
}

const claims = [];
const claim = (id, ok, what) => { claims.push({ id, ok }); console.log(`${ok ? 'PASS' : 'FAIL'}  ${id}. ${what}`); };

const browser = await chromium.launch();
const mutantDir = copyTree();
let control, mutant, applied = true;
try {
  for (const m of MUTATIONS) {
    const target = join(mutantDir, m.file);
    const before = readFileSync(target, 'utf8');
    if (before.split(m.find).length - 1 !== 1) { applied = false; continue; }
    writeFileSync(target, before.replace(m.find, m.to));
  }
  console.log('CONTROL — the shipped tree');
  control = await measure(browser, ROOT, PORT0);
  console.log('MUTANT — the proud extrude, as before TODO 202');
  mutant = applied ? await measure(browser, mutantDir, PORT0 + 1) : null;
} finally {
  await browser.close();
  rmSync(mutantDir, { recursive: true, force: true });
}

console.log('');
claim(1, control.warns.length === 0, `control boots silent (${control.warns.length} boot warn(s))`);
claim(2, control.fails.length === 0 && String(control.result.control).startsWith('PASS'),
  `control plateSeats gate: ${control.fails.length} fail(s); ${control.result.control}; `
  + `${control.result.rows.length} rows within the margin, ${control.result.seatCount} seats, ${control.result.debtCount} debt`);
claim(3, applied, `the mutation moved ${MUTATIONS[0].file} (both anchors matched once)`);
if (mutant) {
  const r = mutant.result;
  claim(4, mutant.fails.length > 0, `mutant plateSeats gate: ${mutant.fails.length} fail(s) — ${r.violations.length} undeclared, ${r.regressed.length} regressed`);
  const v = new Map(r.violations.map((x) => [x.part, x]));
  claim(5, MUST_VIOLATE.every((k) => v.get(k)?.contact),
    `undeclared contact: ${MUST_VIOLATE.map((k) => `${k} ${v.has(k) ? `min ${v.get(k).min}` : 'NOT NAMED'}`).join('; ')}`);
  const g = new Map(r.regressed.map((x) => [x.debt, x]));
  claim(6, MUST_REGRESS.every((k) => g.has(k) && g.get(k).min <= 0),
    `regressed debt: ${MUST_REGRESS.map((k) => `${k} ${g.has(k) ? `min ${g.get(k).min} under floor ${g.get(k).floor}` : 'NOT NAMED'}`).join('; ')}`);
  claim(7, String(r.control).startsWith('PASS'), `mutant control: ${r.control}`);
  console.log('');
  console.log(`REPORT  mutant undeclared: ${r.violations.map((x) => `${x.part} ${x.min}`).join('; ')}`);
  console.log(`REPORT  mutant boot warns: ${mutant.warns.length}${mutant.warns.length ? ` — ${mutant.warns.slice(0, 2).join(' | ')}` : ''}`);
} else {
  for (const id of [4, 5, 6, 7]) claim(id, false, 'mutant not measured — the patch did not apply');
}

const failed = claims.filter((c) => !c.ok);
console.log(`\n${failed.length ? `FAIL — ${failed.length} claim(s): ${failed.map((c) => c.id).join(', ')}` : `PASS — ${claims.length} claims`}`);
process.exit(failed.length ? 1 : 0);
