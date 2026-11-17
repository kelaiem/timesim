// §339 landing 3h — IS THE STOP-WORK'S STAR HELD THROUGH EVERY DWELL, BY THE PIN OR BY THE LOCK DISC? Acceptance.
//   node --import ./tools/native/loader.mjs tools/probe-339-stopwork-hold.mjs      (exit 1 on any failed row)
// The Geneva stop-work's star is held by the pin while the pin's centre lies between a slot's walls, and by its lock arc on
// the cone's disc everywhere else in the dwell; the build's check (main.js, `starHeld`) reads the dwell for a pose where
// neither holds it, and publishes the unlocked angle (windArrest.stopwork.unlockedDeg). Before landing 3h it credited only
// the disc, so the dwell's first and last samples (the passage's own ends, the pin at the slot's mouth) read "unlocked"
// wherever the relief began one 1° bin past that azimuth: 3.5° on the second barrel's build, whose stall-sized pin is
// larger. Rows, each build its own process:
//   1. the default, alarm=0&barrels=3 and alarm=0&barrels=3&vph=36000 build the stop-work with the star held through the
//      whole dwell (0°) and no §329 warning;
//   2. CONTROL — a real gap: the disc's relief cut 0.3 deeper than its running fit reaches past where the pin leaves the
//      walls, and the check reports the star unlocked (and warns);
//   3. CONTROL — the old law: with the pin's hold taken out, alarm=0&barrels=3 reads the boundary samples unlocked again.
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
if (process.argv[2] === '--child') {
  const { register } = await import('node:module');
  register('./native/source-patch.mjs', import.meta.url);
  const { bootNative } = await import('./native/host.mjs');
  const r = await bootNative({ query: process.argv[3] });
  const sw = r.clock.windArrest?.stopwork ?? null;
  process.stdout.write('\n@@' + JSON.stringify({ built: !!sw?.built, unlockedDeg: sw?.unlockedDeg ?? null, warns: r.warns.filter((w) => w.startsWith('§329')) }) + '\n');
  process.exit(0);
}
const env0 = Object.fromEntries(Object.entries(process.env).filter(([k]) => k !== '__TIMESIM_NATIVE_LOADER__' && k !== 'TIMESIM_PATCH'));
const boot = (q, patch = null) => {
  const p = spawnSync(process.execPath, ['--import', './tools/native/loader.mjs', fileURLToPath(import.meta.url), '--child', q],
    { cwd: ROOT, encoding: 'utf8', maxBuffer: 1 << 26, env: patch ? { ...env0, TIMESIM_PATCH: JSON.stringify(patch) } : env0 });
  const l = (p.stdout || '').split('\n').find((x) => x.startsWith('@@'));
  if (!l) throw new Error(`boot '${q}' failed: ${(p.stderr || '').slice(-400)}`);
  return JSON.parse(l.slice(2));
};
let fail = 0;
const row = (ok, what) => { console.log(`${ok ? 'OK  ' : 'FAIL'} ${what}`); if (!ok) fail++; };
// 1
for (const q of ['', 'alarm=0&barrels=3', 'alarm=0&barrels=3&vph=36000']) {
  const b = boot(q);
  row(b.built && b.unlockedDeg === 0 && b.warns.length === 0, `1. ${q || '(default)'}: the star is held through the whole dwell (unlocked ${b.unlockedDeg}°, §329 warnings ${b.warns.length})`);
}
// 2
const RELIEF = '\n          if (distStar(u, v) < RUN - 1e-9) { hit = true; break; }';
const deep = boot('alarm=0&barrels=3', [{ file: 'src/main.js', from: RELIEF, to: RELIEF.replace('RUN - 1e-9', 'RUN + 0.3') }]);
row(deep.unlockedDeg > 1 && deep.warns.some((w) => w.includes('lets the star go')), `2. control: a relief 0.3 too deep leaves the star unlocked for ${deep.unlockedDeg?.toFixed(1)}° and warns`);
// 3
const HOLD = '\n    const starHeld = (phi, al) => pinHolds(phi) || (sideHeld(al, 1) && sideHeld(al, -1));';
const old = boot('alarm=0&barrels=3', [{ file: 'src/main.js', from: HOLD, to: HOLD.replace('pinHolds(phi) || ', '') }]);
row(old.unlockedDeg > 0, `3. control: without the pin's hold the old law reads ${old.unlockedDeg?.toFixed(1)}° "unlocked" on the passage boundaries`);
process.exit(fail ? 1 : 0);
