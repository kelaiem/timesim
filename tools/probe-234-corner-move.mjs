// §234 step 4 — HOW FAR CAN THE ALARM CORNER MOVE OUTBOARD? A REPORT.
// (INDEX.md's `kind` column says acceptance because the classifier keys on
// `process.exit`, and this exits only when a tree will not boot at all —
// `probe-234-group-c.mjs` and `probe-234-step4.mjs` carry the same label for
// the same reason.)
//
// WHY IT EXISTS. `probe-234-step4.mjs` measured that the alarm crown's stem
// cannot reach the turning ceiling as a section change, and offered two
// resolutions: grow the corner's bevels, or MOVE THE CORNER OUTBOARD so the
// stem is short enough that stem stock suffices. The second was put to the
// owner on a PLAN-VIEW clearance — the plate rim has room at r 29.35 — and
// that is not the binding constraint. This measures the constraint that is.
//
// WHAT IT IS NOT. `probe-234-step4.mjs` measures one tree and asks what a
// FATTER STEM costs; this patches MANY trees and asks what a DEEPER CORNER
// costs. `probe-94-corner.mjs`-class work (if you are looking for the corner's
// own interior bounds) is `alarmCornerWarnsAt`, which this exercises rather
// than reimplements — the whole point is to let the SHIPPED asserts speak at
// each candidate instead of writing a second opinion about them.
//
// HOW. `ALARM_CD` is not a knob: it is `solveKeyless`'s own output
// (`alarmCornerR`, §94 tier B). So a candidate is a SCRATCH TREE with that one
// declaration replaced by a literal, booted headless, with every warning its
// own asserts raise collected verbatim. Nothing here judges; the movement
// judges itself and this reports what it said.
//
// WHAT EACH ROW SHOWS:
//   · the stem's span, which trades ONE FOR ONE with the corner's radius
//     (the stem is cut from the corner out to the case);
//   · the L/D that span would read at `STEM_STOCK_R_U`, which is the whole
//     reason to move the corner at all;
//   · every boot warning, which is where the walls appear.
//
// CONTROLS, and the middle one is the load-bearing one:
//   · SILENT — the unpatched tree boots with zero warnings, or the sweep is
//     reading a movement that was already red and every row is noise.
//   · IDENTITY — a tree patched with the solve's OWN answer must reproduce the
//     unpatched tree exactly (same warning count, same stem span). If it does
//     not, the patch is building a different movement and no row below means
//     anything. This is the control that makes a literal substitution legal.
//   · MONOTONE — the stem span must shrink as the corner grows, by the amount
//     the corner grew. If it does not, the stem is not cut from the corner and
//     the premise of the whole exercise is wrong.
//
// Usage: cd tools && node probe-234-corner-move.mjs
//        CDS=18,22,29.35 node probe-234-corner-move.mjs   (pick the candidates)

import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const ANCHOR = 'const ALARM_CD = alarmCornerR;';
const PORT = process.env.PORT || 8497;
const STEM_STOCK_R_U = 0.9236;         // layout.js STEM_STOCK_R_U (tap 7, ⌀0.70 mm)
const KNOB_U = 3.8434;                 // the crown knob the turning census clusters with the stem
const CEIL = 20, TARGET = 18;          // layout.js TURN_LD_MAX / TURN_LD_TARGET
const CANDS = (process.env.CDS ? process.env.CDS.split(',').map(Number) : [18, 19, 19.9, 22, 25.65, 29.35]);

// A scratch COPY of the app, so the checkout is never written to.
const TREE = fs.mkdtempSync(path.join(os.tmpdir(), 'cd-sweep-'));
for (const p of ['index.html', 'src', 'vendor']) fs.cpSync(path.join('..', p), path.join(TREE, p), { recursive: true });
process.on('exit', () => { try { fs.rmSync(TREE, { recursive: true, force: true }); } catch {} });
const ORIG = fs.readFileSync('../src/main.js', 'utf8');
if (!ORIG.includes(ANCHOR)) {
  console.error(`the anchor "${ANCHOR}" is not in src/main.js — the corner's declaration moved, and this probe patches a line that no longer exists`);
  process.exit(1);
}

const srv = spawn('python3', ['-m', 'http.server', String(PORT), '--bind', '127.0.0.1'], { cwd: TREE, stdio: 'ignore' });
process.on('exit', () => srv.kill());
await new Promise((r) => setTimeout(r, 900));
const browser = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader'] });

async function boot(source, label) {
  fs.writeFileSync(path.join(TREE, 'src', 'main.js'), source);
  const page = await browser.newPage();
  const warns = [];
  page.on('console', (m) => {
    if (m.type() !== 'warning') return;
    const t = m.text();
    if (/WebGL|GroupMarker|GL Driver|swiftshader|Deprecation|coplanar/i.test(t)) return;
    warns.push(t);
  });
  page.on('pageerror', (e) => warns.push('PAGEERROR ' + String(e).slice(0, 240)));
  let ok = true;
  await page.goto(`http://127.0.0.1:${PORT}/index.html?n=${Date.now()}`, { waitUntil: 'load', timeout: 90000 })
    .catch(() => { ok = false; });
  if (ok) await page.waitForFunction(() => !!window.__clock, null, { timeout: 90000 }).catch(() => { ok = false; });
  let m = null;
  if (ok) m = await page.evaluate(() => {
    const c = window.__clock;
    let st = null; c.scene.traverse((o) => { if (!st && o.name === 'alarmStem') st = o; });
    let sp = null; c.scene.traverse((o) => { if (!sp && o.name === 'alarmStem') sp = o.parent; });
    const p = sp ? { x: sp.position.x, y: sp.position.y } : null;
    return { stemLen: st ? st.geometry.parameters.height : null, cornerR: p ? Math.hypot(p.x, p.y) : null };
  }).catch((e) => { warns.push('EVAL ' + String(e).slice(0, 200)); return null; });
  await page.close();
  return { label, ok, warns, ...(m || {}) };
}

const f = (x, n = 4) => (x === null || x === undefined ? '—' : Number(x).toFixed(n));
const ldAt = (span, r) => (span + KNOB_U) / (2 * r);

console.log('\n§234 step 4 — how far can the alarm corner move outboard?\n');

// ---- the reference, and the two controls that make the patch legal
const ref = await boot(ORIG, 'as built (ALARM_CD = solveKeyless output)');
console.log('--- CONTROLS');
console.log(`  SILENT  : the unpatched tree boots with ${ref.warns.length} warning(s)  ${ref.warns.length === 0 ? 'OK' : 'FAILED — the movement is already red, so every row below is noise'}`);
for (const w of ref.warns) console.log('      · ' + w.slice(0, 200));
const ident = await boot(ORIG.replace(ANCHOR, `const ALARM_CD = ${ref.cornerR};   // probe-234-corner-move: the solve's OWN answer`), 'identity');
const identOk = ident.ok && ident.warns.length === ref.warns.length && Math.abs(ident.stemLen - ref.stemLen) < 1e-9;
console.log(`  IDENTITY: patched with the solve's own answer (${f(ref.cornerR, 6)}) → ${ident.warns.length} warning(s), stem ${f(ident.stemLen)}  ${identOk ? 'OK — the substitution builds the same movement' : 'FAILED — the patch builds a DIFFERENT movement and no row below means anything'}`);

const rows = [{ cd: ref.cornerR, ...ref }];
for (const cd of CANDS) rows.push({ cd, ...(await boot(ORIG.replace(ANCHOR, `const ALARM_CD = ${cd};   // probe-234-corner-move scratch`), `ALARM_CD = ${cd}`)) });

const mono = rows.slice(1).every((r) => r.stemLen !== null
  && Math.abs((ref.stemLen - r.stemLen) - (r.cd - ref.cornerR)) < 1e-6);
console.log(`  MONOTONE: the stem shortens by exactly what the corner grew, on every row  ${mono ? 'OK' : 'FAILED — the stem is not cut from the corner, so moving it buys nothing'}`);

console.log('\n--- WHAT EACH CANDIDATE COSTS');
console.log('  the L/D column is the stem+knob bar at stem stock — the reason to move the corner at all.');
console.log(`  (ceiling ${CEIL}, target ${TARGET})\n`);
console.log('  ALARM_CD     stem span    L/D at stock   boot warnings');
for (const r of rows) {
  const ld = r.stemLen === null ? null : ldAt(r.stemLen, STEM_STOCK_R_U);
  const mark = ld === null ? '' : ld <= TARGET ? '  ← meets the target' : ld <= CEIL ? '  ← meets the ceiling' : '';
  console.log(`  ${f(r.cd, 4).padStart(8)}     ${f(r.stemLen).padStart(9)}    ${f(ld, 1).padStart(6)}       ${String(r.warns.length).padStart(3)}${r.ok ? '' : '  DID NOT BOOT'}${mark}`);
}

console.log('\n--- WHAT THE MOVEMENT SAID AT EACH CANDIDATE');
for (const r of rows.slice(1)) {
  console.log(`\n  ${r.label}${r.ok ? '' : '  — DID NOT BOOT'}:`);
  if (!r.warns.length) { console.log('      (silent)'); continue; }
  for (const w of r.warns.slice(0, 8)) console.log('      · ' + w.slice(0, 240));
  if (r.warns.length > 8) console.log(`      … and ${r.warns.length - 8} more`);
}

console.log('\n(REPORT — nothing here passes or fails; read the numbers and the warnings.)\n');
await browser.close(); srv.kill();
