#!/usr/bin/env node
// §338 landing 12 — THE NATIVE SWEEP ENGINE IS THE JS SWEEP: acceptance.
//
//   node --import ./tools/native/loader.mjs tools/native-sweep/probe.mjs [--axes a,b] [--out FILE]
//
// Runs each check the engine answers both ways in one process, on the same boot, over
// the same axes: the native engine (tools/native-sweep/run.mjs, built by build.mjs)
// and inspect.js' own sweep — `inspection` (runInspection), `clearances`
// (checkClearances), `expectedContacts` (checkExpectedContacts) and
// `undeclaredClearance` (checkUndeclaredClearance). Each pair of payloads must be leaf-identical under
// tools/report-diff.mjs (every finding, row, pose, surface, the summaries and the
// census; only timing leaves are excluded, by name). `--out` keeps the native
// payloads, for the cross-architecture comparison in .github/workflows/native-host.yml.
//
// Its CONTROLS: the engine handed a contact threshold of 0.05 instead of 1e-4, on one
// axis, must read an inspection payload that differs from the JS sweep's (a comparison
// that cannot see a threshold five hundred times wider has measured nothing); and
// `clearances` must be held where the engine ASKS JS its one question, meshClearance's
// containment witness: the shipped budgets never come within 0.05 (0 asked), so the
// control sweeps every EXPECTED contact pair the inspection found, on one axis, and
// requires both that the witness was asked and that the payloads agree; and the same
// for `undeclaredClearance`, with those pairs LIFTED into its population.
import { writeFileSync, mkdtempSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { join, dirname, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const opt = (k) => { const i = process.argv.indexOf(k); return i > 0 ? process.argv[i + 1] : null; };
const { bootNative } = await import(join(ROOT, 'tools/native/host.mjs'));
const { runNativeInspection, runNativeClearances, runNativeExpectedContacts, runNativeUndeclared } = await import(join(ROOT, 'tools/native-sweep/run.mjs'));
const { clock } = await bootNative({ query: '' });
const I = await import(join(ROOT, 'src/inspect.js'));
clock.beginSweepHold();
const axes = opt('--axes') ? opt('--axes').split(',') : undefined;
const dir = mkdtempSync(join(tmpdir(), 'native-sweep-'));
const wrap = (r, check = 'inspection') => JSON.stringify({ checks: { [check]: { result: r } } });
const fails = [];
const line = (ok, msg) => { console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${msg}`); if (!ok) fails.push(msg); };
const diff = (a, b) => { try { return { same: true, out: execFileSync(process.execPath, [join(ROOT, 'tools/report-diff.mjs'), a, b], { encoding: 'utf8' }) }; } catch (e) { return { same: false, out: String(e.stdout || '') }; } };

let t = performance.now();
const { payload, stats } = await runNativeInspection(clock, I, { axes });
const nativeS = (performance.now() - t) / 1000;
t = performance.now();
const js = await I.runInspection(clock, { axes, includeExcluded: true });
const jsS = (performance.now() - t) / 1000;
const fn = join(dir, 'native.json'), fj = join(dir, 'js.json');
writeFileSync(fn, wrap(payload)); writeFileSync(fj, wrap(js));
const outInspection = payload;
const d = diff(fj, fn);
const summary = (d.out.match(/^(PASS|FAIL) — .*$/m) || [''])[0];
line(d.same, `inspection, native and JS, leaf for leaf over ${payload.axes.length} axes (${stats.poses} poses, ${payload.report.length} contacting pairs, ${payload.report.filter((r) => r.class === 'FORBIDDEN').length} FORBIDDEN): ${summary}`);
console.log(`  REPORT native ${nativeS.toFixed(1)} s (streamed ${stats.sent} mesh states, ${stats.geometries} geometries), JS ${jsS.toFixed(1)} s`);

const cAxis = [(axes || I.AXES.map((a) => a.name))[0]];
const ctlN = await runNativeInspection(clock, I, { axes: cAxis, touch: 0.05 });
const ctlJ = await I.runInspection(clock, { axes: cAxis, includeExcluded: true });
writeFileSync(fn, wrap(ctlN.payload)); writeFileSync(fj, wrap(ctlJ));
const dc = diff(fj, fn);
line(!dc.same, `control: the engine handed a contact threshold of 0.05 on '${cAxis[0]}' reads a different payload (${(dc.out.match(/(\d+) difference\(s\)/) || ['', '?'])[1]} difference(s))`);

// clearances, both ways
t = performance.now();
const nc = await runNativeClearances(clock, I, { axes });
const ncS = (performance.now() - t) / 1000;
t = performance.now();
const jc = await I.checkClearances(clock, { axes });
const jcS = (performance.now() - t) / 1000;
writeFileSync(fn, wrap(nc.payload, 'clearances')); writeFileSync(fj, wrap(jc, 'clearances'));
const dcl = diff(fj, fn);
line(dcl.same, `clearances, native and JS, leaf for leaf over ${nc.payload.results.length} budgets (${nc.stats.poses} poses visited, ${nc.payload.violations.length} violations): ${(dcl.out.match(/^(PASS|FAIL) — .*$/m) || [''])[0]}`);
console.log(`  REPORT native ${ncS.toFixed(1)} s (${nc.stats.verdicts} containment witnesses asked of JS), JS ${jcS.toFixed(1)} s`);

// the witness control: every EXPECTED contact pair as a budget, on one axis
const budgets = payload.report.filter((r) => r.class === 'EXPECTED').map((r) => { const [a, b] = r.pair.split(' ⇄ '); return { a, b, min: 0.15 }; });
const vn = await runNativeClearances(clock, I, { axes: cAxis, budgets });
const vj = await I.checkClearances(clock, { axes: cAxis, budgets });
writeFileSync(fn, wrap(vn.payload, 'clearances')); writeFileSync(fj, wrap(vj, 'clearances'));
const dv = diff(fj, fn);
line(dv.same && vn.stats.verdicts > 0, `control: ${budgets.length} EXPECTED contact pairs as budgets on '${cAxis[0]}' ask the witness ${vn.stats.verdicts} time(s) (${vn.payload.census.verdictCalls} logical, JS ${vj.census.verdictCalls}) and agree leaf for leaf: ${(dv.out.match(/^(PASS|FAIL) — .*$/m) || [''])[0]}`);

// expectedContacts and undeclaredClearance, both ways
const kept = { inspection: outInspection, clearances: nc.payload };
for (const [check, nat, js] of [
  ['expectedContacts', () => runNativeExpectedContacts(clock, I, { axes }), () => I.checkExpectedContacts(clock, { axes })],
  ['undeclaredClearance', () => runNativeUndeclared(clock, I, { axes }), () => I.checkUndeclaredClearance(clock, { axes })],
]) {
  t = performance.now();
  const n = await nat();
  const nS = (performance.now() - t) / 1000;
  t = performance.now();
  const j = await js();
  const jS = (performance.now() - t) / 1000;
  writeFileSync(fn, wrap(n.payload, check)); writeFileSync(fj, wrap(j, check));
  const dd = diff(fj, fn);
  const what = check === 'undeclaredClearance' ? `${n.payload.population} pairs, ${n.payload.rows.length} under the margin, control ${n.payload.control}` : `${n.payload.results.length} rows, ${n.payload.violations.length} violations`;
  line(dd.same, `${check}, native and JS, leaf for leaf (${what}): ${(dd.out.match(/^(PASS|FAIL) — .*$/m) || [''])[0]}`);
  console.log(`  REPORT native ${nS.toFixed(1)} s (${n.stats.verdicts} witnesses${check === 'undeclaredClearance' ? `, ${n.stats.prunes} box prunes` : ''} asked of JS), JS ${jS.toFixed(1)} s`);
  kept[check] = n.payload;
}
// the same witness through undeclaredClearance: its shipped population never comes
// within 0.05 (that would already be a violation), so the control LIFTS the EXPECTED
// contact pairs into it, which puts touching parts in reach of the witness
const lift = budgets.map((b) => [b.a, b.b]);
const un = await runNativeUndeclared(clock, I, { axes: cAxis, lift });
const uj = await I.checkUndeclaredClearance(clock, { axes: cAxis, lift });
writeFileSync(fn, wrap(un.payload, 'undeclaredClearance')); writeFileSync(fj, wrap(uj, 'undeclaredClearance'));
const du = diff(fj, fn);
line(du.same && un.stats.verdicts > 0, `control: undeclaredClearance with the ${lift.length} EXPECTED contact pairs lifted on '${cAxis[0]}' asks the witness ${un.stats.verdicts} time(s) and agrees leaf for leaf (${un.payload.rows.length} rows under the margin): ${(du.out.match(/^(PASS|FAIL) — .*$/m) || [''])[0]}`);

if (opt('--out')) writeFileSync(opt('--out'), JSON.stringify({ checks: Object.fromEntries(Object.entries(kept).map(([k, v]) => [k, { result: v }])) }));
console.log(`\n${fails.length ? `FAIL — ${fails.length} gate(s)` : 'PASS — the native sweep engine answers inspection, clearances, expectedContacts and undeclaredClearance exactly as the JS sweeps do'}`);
process.exit(fails.length ? 1 : 0);
