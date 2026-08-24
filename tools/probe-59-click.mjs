// TODO 59 — THE CLICK'S NOSE THROUGH A WHOLE PITCH, measured against the metal.
//
// The old law read `profileAt`'s normalized HEIGHT and spent it as a RADIUS,
// while the pillar's outer wall stands at a constant `ALARM_COL_BASE_R` — the
// chamfer is cut in z only. So mid-flank the nose was driven into a wall that
// had not moved. This sweeps one full column pitch and measures the real
// surface-to-surface clearance between the nose and the wheel at each step,
// under BOTH laws, so the fix is a measurement rather than an argument.
//
// The pose net cannot reach these angles: `setPose` banks `alarmColSteps` to an
// integer multiple of `ALARM_COL_STEP`, so `profileAt` is exactly 1 or exactly
// 0 under every inspector pose and the whole flank is invisible to the battery.
// That is TODO 7's blind spot stated concretely, and it is why the law is
// driven here through `__clock.clickLaw.poseClick`.
//
// Run: cd tools && node probe-59-click.mjs
//      STEPS=180 node tools/probe-59-click.mjs
import { chromium } from 'playwright';
import { spawn } from 'node:child_process';

const port = process.env.PORT || '8533';
const STEPS = Number(process.env.STEPS || 120);
const srv = spawn('python3', ['-m', 'http.server', port, '--bind', '127.0.0.1'],
  { cwd: '..', stdio: 'ignore' });
await new Promise((r) => setTimeout(r, 900));
const browser = await chromium.launch();
const page = await browser.newPage();
page.on('pageerror', (e) => console.log('PAGEERROR', String(e)));
await page.goto(`http://127.0.0.1:${port}/index.html`, { waitUntil: 'load', timeout: 60000 });
await page.waitForFunction(() => !!window.__clock, null, { timeout: 60000 });

const out = await page.evaluate(async (steps) => {
  const I = await import('./src/inspect.js');
  const clock = window.__clock;
  const L = clock.clickLaw;

  // Find the two solids by walking the switch unit: the nose is the only
  // SphereGeometry in it, the pillars are the named column wheel.
  const unit = clock.labelEntries.find((e) => e.name === 'Alarm switch');
  let nose = null; const pillars = [];
  unit.obj.traverse((o) => {
    if (o.userData && o.userData.schematic) return;
    if (!o.isMesh) return;
    if (o.geometry.type === 'SphereGeometry') nose = o;
    if (o.name === 'alarmColCastellations') pillars.push(o);   // TODO 87 step 4 named the wheel's three bodies apart
  });
  if (!nose) return { error: 'no nose sphere found in Alarm switch' };

  // The OLD law, re-implemented here because it no longer exists in source:
  // it put the nose centre at SEAT + (OUT − SEAT)·profileAt(a) — a height
  // fraction spent as a radial chord. Reported as the RADIUS and as the
  // resulting burial, so both laws are compared in the same units. The wheel
  // exposes profileAt on its own userData, so this reads the shipped profile
  // rather than a second copy of it.
  const wheel = pillars[0] ? pillars[0] : null;
  let profileAt = null;
  unit.obj.traverse((o) => { if (o.userData && o.userData.profileAt) profileAt = o.userData.profileAt; });
  void wheel;

  const rows = [];
  const pitch = L.pitch;
  for (let i = 0; i <= steps; i++) {
    const a = (i / steps) * pitch;
    L.poseClick(a);
    clock.scene.updateMatrixWorld(true);
    let gap = Infinity;
    for (const w of pillars) gap = Math.min(gap, I.meshClearance(nose, w));
    // what the old law would have done at this same azimuth
    const oldR = profileAt ? L.seat + (L.out - L.seat) * profileAt(a) : null;
    const oldBury = oldR === null ? null
      // buried only where pillar metal actually stands at the nose's z band
      : (L.colH * profileAt(a) > L.zNose - L.noseRadius
        ? Math.max(0, L.wallR - (oldR - L.noseRadius)) : 0);
    rows.push({ a: +(a * 180 / Math.PI).toFixed(2), gap: +gap.toFixed(4), r: +L.noseR(a).toFixed(4),
      oldR: oldR === null ? null : +oldR.toFixed(4),
      oldBury: oldBury === null ? null : +oldBury.toFixed(4) });
  }

  return {
    seat: L.seat, out: L.out, wallR: L.wallR, noseRadius: L.noseRadius,
    noseHalfDeg: +(L.noseHalf * 180 / Math.PI).toFixed(3),
    zNose: L.zNose, colH: L.colH,
    pitchDeg: +(pitch * 180 / Math.PI).toFixed(2),
    rows,
  };
}, STEPS);

await browser.close();
srv.kill();
if (out.error) { console.error(out.error); process.exit(1); }

console.log(`nose r ${out.noseRadius} at z ${out.zNose} of a ${out.colH} tier; wall at ${out.wallR}`);
console.log(`seat ${out.seat}  out ${out.out}  footprint ±${out.noseHalfDeg}°  pitch ${out.pitchDeg}°\n`);

const worst = out.rows.reduce((m, r) => (r.gap < m.gap ? r : m), out.rows[0]);
const buried = out.rows.filter((r) => r.gap < 0);
const tight = out.rows.filter((r) => r.gap >= 0 && r.gap < 0.15);

console.log('  az°     nose r    clearance   |  old r    old burial');
for (const r of out.rows.filter((_, i) => i % Math.ceil(out.rows.length / 24) === 0))
  console.log(`  ${String(r.a).padStart(6)}  ${String(r.r).padStart(8)}  ${String(r.gap).padStart(9)}`
    + `   |  ${String(r.oldR).padStart(6)}  ${String(r.oldBury).padStart(9)}`
    + (r.oldBury > 0 ? '  ← was BURIED' : ''));

console.log(`\nworst clearance ${worst.gap} at ${worst.a}°`);
console.log(`buried samples: ${buried.length} / ${out.rows.length}`);
console.log(`under CLEAR_MARGIN (0.15) but not buried: ${tight.length}`
  + `   ← a RIDING contact is expected to sit near zero; burial is not`);
const oldWorst = out.rows.reduce((m, r) => ((r.oldBury || 0) > (m.oldBury || 0) ? r : m), out.rows[0]);
const oldBuried = out.rows.filter((r) => (r.oldBury || 0) > 0);
console.log(`\nOLD law, same sweep: ${oldBuried.length} / ${out.rows.length} samples buried, `
  + `worst ${oldWorst.oldBury} at ${oldWorst.a}°`);
process.exit(buried.length ? 1 : 0);
