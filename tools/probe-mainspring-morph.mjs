// THE GOING MAINSPRING WINDS AND RUNS DOWN — does its ribbon change shape with
// the wind, or only turn with the drum? ACCEPTANCE.
//
// TODO 115 reversed the going train (MOVEMENT_SENSE −1) and put the sense on
// `drumRotAt`, but tick() went on passing the drum's SIGNED angle to the
// ribbon's `setWind` as the travel the drum had paid out. On the reversed
// movement that angle is ≤ 0, so `sweepFull − angle` read as more than full
// wind and setWind clamped to the wound frame at EVERY tension: the ribbon
// stood frozen and turned rigidly with the drum through the whole reserve, while
// every gate stayed green (a frozen ribbon is a valid, clear piece of metal).
// This probe boots the default build and §339's spur-driven barrel
// (`barrels=2`, whose ribbon is cut to the other hand) and holds, per build:
//   1. the ribbon's frame at full wind is the wound frame (0) and at run-down
//      the run-down frame (the last);
//   2. the frame never moves toward wound as tension falls (monotone over a
//      dense tension sweep), and it visits a spread of frames, not two;
//   3. the geometry the mesh WEARS changes between full and empty (a frame
//      index nobody installs would pass 1–2);
//   4. a CONTROL: the pre-fix expression, `setWind(sweepFull − signed angle)`,
//      applied at run-down must land on the wound frame in the default build —
//      the probe has to be able to see the defect it was written for.
//
// Run from the repository root:
//   node --import ./tools/native/loader.mjs tools/probe-mainspring-morph.mjs
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

// One native host per process (main.js evaluates once), so the driver runs each
// build in a child of its own and gates on their exits.
const bi = process.argv.indexOf('--build');
if (bi < 0) {
  let bad = 0;
  for (const q of ['', 'barrels=2']) {
    const r = spawnSync(process.execPath, ['--import', new URL('./native/loader.mjs', import.meta.url).href, fileURLToPath(import.meta.url), '--build', q], { stdio: 'inherit', env: { ...process.env, __TIMESIM_NATIVE_LOADER__: '' } });   // the loader registers once per process, keyed on this
    if (r.status !== 0) bad++;
  }
  console.log(bad ? `FAIL — ${bad} build(s) failed` : 'PASS — the going ribbon winds and runs down with the drum, both builds, control PASS');
  process.exit(bad ? 1 : 0);
}
const { bootNative } = await import('./native/host.mjs');

const fails = [];
const ok = (cond, what, detail) => { if (!cond) fails.push({ what, detail }); return !!cond; };
const N = 40;   // tension samples: the default ribbon has 69 frames, so ≥ 1 frame per sample on average is not asked — monotone and spread are

for (const query of [process.argv[bi + 1] ?? '']) {
  const tag = query || 'default';
  const { clock: C } = await bootNative({ query });
  const springs = [];
  C.scene.traverse((o) => { if (o.name === 'spring' && o.userData.mainspring) springs.push(o); });
  const going = springs.find((s) => s.parent && /^(barrel|goingBarrel)$/.test(s.parent.name));
  if (!ok(going, `${tag}: the going mainspring is found`, springs.map((s) => s.parent?.name))) continue;
  const ms = going.userData.mainspring;
  const ribbon = going.getObjectByName('mainspringRibbon');
  const last = ms.frames - 1;
  const at = (t) => { C.setPose({ tension: t }); return { frame: ribbon.userData.spiralFrame, geo: ribbon.geometry }; };

  const seq = [];
  for (let i = 0; i <= N; i++) seq.push(at(1 - i / N).frame);   // full → empty
  const full = at(1), empty = at(0);
  ok(full.frame === 0, `${tag}: full wind wears the wound frame`, { frame: full.frame });
  ok(empty.frame === last, `${tag}: run-down wears the run-down frame`, { frame: empty.frame, last });
  const back = seq.findIndex((f, i) => i > 0 && f < seq[i - 1]);
  ok(back < 0, `${tag}: the frame never moves toward wound as tension falls`, { at: back, seq });
  const distinct = new Set(seq).size;
  ok(distinct >= Math.min(N, last) / 2, `${tag}: the sweep visits a spread of frames`, { distinct, of: ms.frames });
  ok(full.geo !== empty.geo, `${tag}: the mesh's geometry changes between full and empty`);

  if (!query) {
    // CONTROL — the pre-fix law: the drum group's signed angle read as travel.
    C.setPose({ tension: 0 });
    const drum = going.parent.parent;   // drumGroup: the barrel hangs under it
    ms.setWind(ms.sweepFull - drum.rotation.z);
    ok(ribbon.userData.spiralFrame === 0, 'control: the pre-fix law freezes the ribbon wound at run-down',
      { frame: ribbon.userData.spiralFrame, drumRot: drum.rotation.z });
    C.setPose({ tension: 1 });
  }
  console.log(`${tag}: ${ms.frames} frames; full → empty visits ${distinct} (${seq[0]} … ${seq[seq.length - 1]})`);
}

if (fails.length) {
  for (const f of fails) console.error('FAIL', f.what, f.detail ? JSON.stringify(f.detail) : '');
  process.exit(1);
}
console.log(`  ok (${process.argv[bi + 1] || 'default'})`);
process.exit(0);
