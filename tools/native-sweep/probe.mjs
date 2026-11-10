#!/usr/bin/env node
// §338 landing 12 — THE NATIVE SWEEP ENGINE IS THE JS SWEEP: acceptance.
//
//   node --import ./tools/native/loader.mjs tools/native-sweep/probe.mjs [--axes a,b] [--out FILE]
//
// Runs `inspection` both ways in one process, on the same boot, over the same axes:
// the native engine (tools/native-sweep/run.mjs, built by build.mjs) and inspect.js'
// runInspection. The two payloads must be leaf-identical under tools/report-diff.mjs
// (every finding, every pose, the summaries and the census; only timing leaves are
// excluded, by name). `--out` keeps the native payload, for the cross-architecture
// comparison in .github/workflows/native-host.yml.
//
// Its CONTROL: the engine handed a contact threshold of 0.05 instead of 1e-4, on one
// axis, must read a payload that differs from the JS sweep's. A comparison that cannot
// see a threshold five hundred times wider has measured nothing.
import { writeFileSync, mkdtempSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { join, dirname, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const opt = (k) => { const i = process.argv.indexOf(k); return i > 0 ? process.argv[i + 1] : null; };
const { bootNative } = await import(join(ROOT, 'tools/native/host.mjs'));
const { runNativeInspection } = await import(join(ROOT, 'tools/native-sweep/run.mjs'));
const { clock } = await bootNative({ query: '' });
const I = await import(join(ROOT, 'src/inspect.js'));
clock.beginSweepHold();
const axes = opt('--axes') ? opt('--axes').split(',') : undefined;
const dir = mkdtempSync(join(tmpdir(), 'native-sweep-'));
const wrap = (r) => JSON.stringify({ checks: { inspection: { result: r } } });
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
if (opt('--out')) writeFileSync(opt('--out'), wrap(payload));
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

console.log(`\n${fails.length ? `FAIL — ${fails.length} gate(s)` : 'PASS — the native sweep engine answers inspection exactly as the JS sweep does'}`);
process.exit(fails.length ? 1 : 0);
