#!/usr/bin/env node
// §343 — IS THE 14,400 ROW'S BALANCE THE LARGEST THE CASE ADMITS, and is it the
// case (not the spring) that stops it? Acceptance. Boots the row as declared
// (r 11.5, rim 0.345) and the same row one BAL_R_STEP larger (r 11.75 on rim
// 0.33, the heaviest that still reaches the target there), each in its own
// native process, and holds:
//   1. the declared build: no case-cap warning and (since §343 landing 1e) no
//      warning at all, the amplitude target met and the rim tight
//      (equalisation's own record), 2 Hz, the hairspring in stock;
//   2. one step larger: the case-cap warning fires (the wall), and the target is
//      still met and started (so the spring was not what stopped it);
//   3. the control: the patch must take (the larger build reports r 11.75), or
//      2 would be a reading of the declared build.
// The shipped 18,000 build is booted too, for the inertia ratio the record
// quotes (reported, not gated).
//   node tools/probe-343-chronometer.mjs          (exit 1 on any claim)
import { spawnSync } from 'node:child_process';
import { register } from 'node:module';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const ROW = 'balanceR: 11.5, rimF: 0.345';

if (process.argv[2] === '--child') {
  register('./native/source-patch.mjs', import.meta.url);
  const { bootNative } = await import('./native/host.mjs');
  const r = await bootNative({ query: process.argv[3] });
  const c = r.clock, o = c.oscillator, t = c.equalisation.going.energy.amplitude.target;
  process.stdout.write('\n@@' + JSON.stringify({ warns: r.warns, plateR: c.plateR, hz: o.fImpliedHz, I: o.I_kgm2,
    ribbon: o.spring.h_mm, inStock: o.spring.inStock, radius: t.radius, rimF: t.rimF, met: t.met, tight: t.tight,
    deg: t.nominalVertical, starts: t.starts }) + '\n');
  process.exit(0);
}

const boot = (query, patch) => {
  const p = spawnSync(process.execPath, ['--import', './tools/native/loader.mjs', fileURLToPath(import.meta.url), '--child', query],
    { cwd: ROOT, encoding: 'utf8', maxBuffer: 1 << 26, env: { ...process.env, TIMESIM_PATCH: JSON.stringify(patch ?? []) } });
  const line = (p.stdout || '').split('\n').find((l) => l.startsWith('@@'));
  if (!line) { console.error(p.stderr); throw new Error(`boot ${query} failed`); }
  return JSON.parse(line.slice(2));
};
const cap = (b) => b.warns.filter((w) => /40 mm owner cap/.test(w));

const declared = boot('vph=14400');
const larger = boot('vph=14400', [{ file: 'src/layout.js', from: ROW, to: 'balanceR: 11.75, rimF: 0.33' }]);
const shipped = boot('');
const fails = [];
const say = (ok, what) => { console.log(`${ok ? 'PASS' : 'FAIL'}  ${what}`); if (!ok) fails.push(what); };

console.log(`declared  r ${declared.radius} rim ${declared.rimF}: plateR ${declared.plateR.toFixed(2)}, ${declared.deg.toFixed(2)}° nominal vertical, ${declared.hz} Hz, ribbon ${declared.ribbon.toFixed(4)} mm, I ${declared.I.toExponential(3)}`);
console.log(`larger    r ${larger.radius} rim ${larger.rimF}: plateR ${larger.plateR.toFixed(2)}, ${larger.deg.toFixed(2)}°, ${cap(larger)[0] ?? 'no case warning'}`);
console.log(`shipped   r ${shipped.radius} at 18,000: I ${shipped.I.toExponential(3)} — the 14,400 wheel is ${(declared.I / shipped.I).toFixed(2)}× its inertia`);
say(cap(declared).length === 0, 'the declared balance fits the 40 mm case');
say(declared.warns.length === 0, `the declared build boots silent (§343 landings 1b–1e close it)${declared.warns.length ? `: ${declared.warns[0].slice(0, 120)}` : ''}`);
say(declared.met && declared.tight, 'the declared rim is the heaviest that reaches the target and starts');
say(Math.abs(declared.hz - 2) < 1e-6 && declared.inStock, 'the hairspring beats 2 Hz inside real stock');
say(larger.radius === 11.75, 'control: the patch took (the larger build is r 11.75)');
say(cap(larger).length === 1, 'one BAL_R_STEP larger breaks the 40 mm case (the wall)');
say(larger.met && larger.starts, 'one step larger still reaches the target and starts (the spring is not the wall)');
process.exit(fails.length ? 1 : 0);
