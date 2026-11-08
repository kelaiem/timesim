#!/usr/bin/env node
// §338 landing 2 — IS THE METAL THE SAME ON EVERY MACHINE THAT BUILT IT?
//
// Acceptance (exits non-zero on a difference). Reads two or more files written
// by `tools/probe-338-native-boot.mjs --json` on different machines (in CI,
// native-host.yml's ubuntu-latest x64 and ubuntu-24.04-arm legs) and requires,
// per spec, every host on every machine to agree: the §52 fingerprint, and each
// unit's §152 SHAPE (the vertex bits and the triangle set) and PLACE (the
// quantised world matrices at every digest pose). Each file already holds its
// own machine's two hosts equal; this is the line across machines that
// §227 measured only at summary granularity and refused to call portability.
//
// It names how much it compared, so a comparison of nothing cannot pass for a
// clean one: the number of (spec, host, machine) builds and of unit digests.
// Its control: the two specs it compares differ from each other in the first
// file, so equality is something this reader can fail to find.
//
//   node tools/compare-338-hosts.mjs a.json b.json [...]
import { readFileSync } from 'node:fs';

const files = process.argv.slice(2);
if (files.length < 2) { console.error('usage: compare-338-hosts.mjs a.json b.json [...]'); process.exit(2); }
const runs = files.map((f) => ({ f, ...JSON.parse(readFileSync(f, 'utf8')) }));
for (const r of runs) if (r.format !== 1) { console.error(`${r.f}: format ${r.format}, expected 1`); process.exit(2); }

const fails = [];
let builds = 0, digests = 0;
const specs = Object.keys(runs[0].specs);
console.log(`machines: ${runs.map((r) => `${r.platform} (node ${r.node}, V8 ${r.v8})`).join(' · ')}`);
for (const q of specs) {
  const all = [];
  for (const r of runs) {
    if (!r.specs[q]) { fails.push(`${r.f} lacks spec '${q}'`); continue; }
    for (const host of ['chromium', 'native']) all.push({ who: `${r.platform}/${host}`, b: r.specs[q][host] });
  }
  builds += all.length;
  const ref = all[0];
  const units = Object.keys(ref.b.units).sort();
  const bad = [];
  for (const { who, b } of all.slice(1)) {
    if (b.fingerprint !== ref.b.fingerprint) bad.push(`${who} fingerprint ${b.fingerprint} ≠ ${ref.b.fingerprint}`);
    const names = new Set([...units, ...Object.keys(b.units)]);
    for (const n of names) {
      digests++;
      const x = ref.b.units[n], y = b.units[n];
      if (!x || !y) { bad.push(`${who}: unit ${n} present on one side only`); continue; }
      if (x.shape !== y.shape) bad.push(`${who}: ${n} SHAPE`);
      if (x.place !== y.place) bad.push(`${who}: ${n} PLACE`);
    }
    if (!b.detMath?.installed || b.detMath.failed.length) bad.push(`${who}: deterministic maths ${b.detMath ? `failed ${b.detMath.failed.join(', ')}` : 'absent'}`);
  }
  const name = q || 'identity';
  if (bad.length) { fails.push(...bad.map((x) => `${name}: ${x}`)); console.log(`  FAIL  ${name}: ${bad.length} difference(s) against ${ref.who}: ${bad.slice(0, 8).join('; ')}${bad.length > 8 ? '; …' : ''}`); }
  else console.log(`  PASS  ${name}: ${all.length} builds (${all.map((a) => a.who).join(', ')}) agree — fingerprint ${ref.b.fingerprint}, ${units.length} units' SHAPE and PLACE`);
}
if (specs.length >= 2) {
  const [a, b] = specs.map((q) => runs[0].specs[q].native);
  const differs = a.fingerprint !== b.fingerprint || Object.keys(a.units).some((n) => a.units[n].shape !== b.units[n]?.shape || a.units[n].place !== b.units[n]?.place);
  console.log(`  ${differs ? 'PASS' : 'FAIL'}  control: '${specs[0] || 'identity'}' and '${specs[1]}' differ in ${runs[0].platform}'s native build, so equality can fail to be found`);
  if (!differs) fails.push('control');
} else fails.push('control: fewer than two specs to compare');
console.log(fails.length ? `\nFAIL — ${fails.length} difference(s) across ${runs.length} machines` : `\nPASS — ${builds} builds on ${runs.length} machines, ${digests} unit digests compared: one movement`);
process.exit(fails.length ? 1 : 0);
