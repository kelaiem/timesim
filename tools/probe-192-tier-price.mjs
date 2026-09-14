// THE STRIKE TIER, PRICED — every above-plate member's height over the
// three-quarter plate's top face (build and swept over the alarm axes),
// the tower's segment ladder measured face to face, and the §187 glass
// arithmetic that turns a tower drop into cased height.
//
// ACCEPTANCE. Written for §192's scoping half (roadmap): the deliverable
// there is a per-member PRICE table for re-stationing the tier downward,
// and a price is only honest if the heights it prices are measured, not
// quoted. Three facts this instrument holds:
//  · THE DROP IS 1:1. The §187 stepped glass derives its raised step one
//    CLEAR_MARGIN over the envelope's global max, so every unit the tall
//    towers come down, the cased back comes down with them — asserted
//    here as zStepUnder = (link tail build top + its declared swept
//    allowance) + CLEAR_MARGIN, the same relation main.js derives, read
//    from __clock.backGlass/backEnvelope rather than restated.
//  · ONLY TWO BINS PAY. The column tower (alarmColCastellations) and the
//    link tower (alarmLinkBeakTail, the global max) force the step; the
//    gong/hammer/cam members already sit under the outer pane, whose
//    plane is pinned by the pusher-side region row — lowering them buys
//    nothing at the back.
//  · THE LADDER IS THE PRICE LIST. The tower's height decomposes into
//    measured faces (plate top → driver band → the §169 pawl-coil
//    stratum → skirt band → base disc → castellation band → link bar →
//    tail), and each rung is priced by the constraint that put it there —
//    the §192 entry carries the constraint column; this file carries the
//    measured one, so the two cannot drift apart silently.
//
// Controls (asserted, exit 2): the global swept maximum belongs to the
// alarm link (the §187 allowance row's own story); the glass relation
// above holds to float noise; EVERY declared swept-region row covers its
// own unit's measured top inside its own r-band and does not overshoot it
// past the authoring rounding (§226 — this read `alarmColCastellations` by
// name against the one 'Alarm switch' row, which was the second-tallest
// member of its band even in §192's tree, and left a sibling row unwatched
// while it went stale); and the ladder is monotonic (each rung's bottom at
// or above the previous rung's top — interleaved rungs mean the scan
// grabbed the wrong meshes).
//
// Run: node tools/probe-192-tier-price.mjs   (ROOT= for another worktree)
import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
const ROOT = process.env.ROOT || join(dirname(fileURLToPath(import.meta.url)), '..');
const srv = spawn('python3', ['-m', 'http.server', '8514', '--bind', '127.0.0.1'], { cwd: ROOT, stdio: 'ignore' });
await new Promise((r) => setTimeout(r, 1200));
const browser = await chromium.launch();
const page = await browser.newPage();
page.on('pageerror', (e) => console.log('PAGEERROR', String(e)));
await page.goto('http://127.0.0.1:8514/index.html', { waitUntil: 'load', timeout: 120000 });
await page.waitForFunction(() => !!window.__clock, null, { timeout: 120000 });

const res = await page.evaluate(async () => {
  const I = await import('./src/inspect.js');
  const THREE = await import('three');
  const L = await import('./src/layout.js');
  const clock = window.__clock;
  const v = new THREE.Vector3();

  // The plate's top face, off the metal (the §112 blind spot's lesson: the
  // plate is not a swept unit, so nothing else measures against it).
  const tq = clock.labelEntries.find((e) => e.name === 'Three-quarter plate');
  clock.scene.updateMatrixWorld(true);
  let plateTop = -Infinity;
  tq.obj.traverse((o) => {
    if (!o.isMesh || o.userData.schematic || !o.geometry?.attributes?.position) return;
    const p = o.geometry.attributes.position;
    for (let i = 0; i < p.count; i++) { o.localToWorld(v.fromBufferAttribute(p, i)); plateTop = Math.max(plateTop, v.z); }
  });

  // Per-mesh z bands of everything above the plate top, at build and swept
  // over the alarm-side axes (the strike work's own inputs; the going side
  // does not move this tier).
  const bands = new Map(); // 'unit / mesh' → { b0, b1, s0, s1, sPose }
  // ...and, beside them, what the declared swept REGION rows' own units reach
  // INSIDE their own r-bands. A whole-mesh z band cannot answer that: a row is
  // a claim about a radial window, so a control built on unit-wide maxima can
  // demand that a row cover metal standing outside the band it declares. §226
  // — the same scoping the boot assert in BACK_ENVELOPE uses, swept here
  // rather than at build pose, which is the stronger half.
  const regionTop = (clock.backEnvelope?.regions || []).map((R) => ({ ...R, z_measured: -Infinity, who: '' }));
  const scan = (poseName, isBuild) => {
    clock.scene.updateMatrixWorld(true);
    for (const e of clock.labelEntries) {
      if (e.name === 'Three-quarter plate') continue;
      e.obj.traverse((o) => {
        if (!o.isMesh || o.userData.schematic || o.userData.casePart || !o.geometry?.attributes?.position) return;
        const pos = o.geometry.attributes.position;
        let zMin = Infinity, zMax = -Infinity;
        for (let i = 0; i < pos.count; i++) {
          o.localToWorld(v.fromBufferAttribute(pos, i));
          zMin = Math.min(zMin, v.z); zMax = Math.max(zMax, v.z);
          const r = Math.hypot(v.x, v.y);
          for (const R of regionTop)
            if (R.unit === e.name && r >= R.r0 && r <= R.r1 && v.z > R.z_measured) {
              R.z_measured = v.z; R.who = o.name || o.geometry.type;
            }
        }
        if (zMax < plateTop - 0.05) return;
        const key = `${e.name} / ${o.name || o.geometry.type}`;
        const b = bands.get(key) || { b0: Infinity, b1: -Infinity, s0: Infinity, s1: -Infinity, sPose: '' };
        if (isBuild) { b.b0 = Math.min(b.b0, zMin); b.b1 = Math.max(b.b1, zMax); }
        if (zMax > b.s1) { b.s1 = zMax; b.sPose = poseName; }
        b.s0 = Math.min(b.s0, zMin);
        bands.set(key, b);
      });
    }
  };
  scan('as booted', true);
  for (const ax of I.AXES) {
    if (!/alarm|strike|press/i.test(ax.name)) continue;
    for (const f of [0, 0.5, 1]) { I.enterAxis(clock); clock.setPose(ax.pose(f, clock)); scan(`${ax.name} f=${f}`, false); }
  }
  I.enterAxis(clock);

  const g = clock.backGlass;
  const env = clock.backEnvelope;
  const envMaxAll = Math.max(...env.bins.filter((b) => b.z !== null).map((b) => b.z));
  const linkAllow = (env.allowances.find((a) => a.unit === 'Alarm link') || {}).extra ?? null;
  const switchRegion = env.regions.filter((r) => r.unit === 'Alarm switch').sort((a, b) => b.z - a.z)[0] || null;
  return {
    plateTop, CM: L.CLEAR_MARGIN,
    bands: [...bands.entries()].map(([key, b]) => ({ key, ...b })).sort((a, b) => b.s1 - a.s1),
    glass: { zStepUnder: g.zStepUnder, paneInner: g.paneInner, rStep: g.rStep },
    envMaxAll, linkAllow, switchRegionZ: switchRegion ? switchRegion.z : null,
    regionTop: regionTop.map((R) => ({ unit: R.unit, r0: R.r0, r1: R.r1, z: R.z,
      measured: R.z_measured === -Infinity ? null : R.z_measured, who: R.who })),
  };
});

const MM = 0.378947;
const D = (z) => (z - res.plateTop).toFixed(3);
console.log(`plate top face MEASURED ${res.plateTop.toFixed(4)}; CLEAR_MARGIN ${res.CM}\n`);
console.log('ABOVE-PLATE MEMBERS (Δ over the plate top; build → swept, worst alarm-side pose):');
for (const b of res.bands.slice(0, 24))
  console.log(`  ${b.key.padEnd(46)} Δtop ${D(b.b1 === -Infinity ? b.s1 : b.b1).padStart(7)} → ${D(b.s1).padStart(7)}${b.s1 > (b.b1 === -Infinity ? -Infinity : b.b1) + 1e-6 ? `  @ ${b.sPose}` : ''}`);

// THE LADDER — the tower's measured faces, bottom to top. Each rung's
// constraint column lives in the §192 entry; here only the metal speaks.
const rung = (label) => res.bands.find((b) => b.key.endsWith(`/ ${label}`));
// The tail is NOT a rung: §172 stations the arm by the BAR's underside and
// the tail grows UPWARD ONLY from that same plane ("underside unmoved"), so
// bar and tail are siblings sharing a base — the tail gets its own identity
// check below instead of a place in the stack.
const LADDER = ['alarmColDriver', 'alarmColSkirt', 'alarmColBase', 'alarmColCastellations', 'alarmLinkBeakBar'];
console.log('\nTHE TOWER LADDER (measured z bands at build; the tail rides the bar\'s own plane):');
let prevTop = res.plateTop, monotonic = true;
for (const name of LADDER) {
  const b = rung(name);
  if (!b) { monotonic = false; console.log(`  ${name.padEnd(24)} MISSING`); continue; }
  const gap = b.b0 - prevTop;
  if (gap < -1e-6 && name !== 'alarmColBase') monotonic = false; // base meets skirt at a shared face (one turned part)
  console.log(`  ${name.padEnd(24)} z ${b.b0.toFixed(3)}..${b.b1.toFixed(3)}  (Δ ${D(b.b0)}..${D(b.b1)})  gap-under ${gap.toFixed(3)}`);
  prevTop = Math.max(prevTop, b.b1);
}

// THE GLASS ARITHMETIC — what a tower drop buys, measured.
const tail = rung('alarmLinkBeakTail');
console.log(`\nGLASS: zStepUnder ${res.glass.zStepUnder.toFixed(3)}, pane inner ${res.glass.paneInner.toFixed(3)}, rStep ${res.glass.rStep.toFixed(2)}`);
console.log(`  envelope global max (bins, allowances folded) ${res.envMaxAll.toFixed(3)}; link allowance ${res.linkAllow}`);
const flatDrop = res.envMaxAll - (res.glass.paneInner - res.CM);
console.log(`  drop → back is 1:1 (step face = envMax + CLEAR_MARGIN); FLAT BACK at a tower drop of ${flatDrop.toFixed(3)} u = ${(flatDrop * MM).toFixed(2)} mm`);
console.log(`  step currently stands ${(res.glass.zStepUnder - res.glass.paneInner).toFixed(3)} u = ${((res.glass.zStepUnder - res.glass.paneInner) * MM).toFixed(2)} mm proud of the pane plane`);

// CONTROLS.
let ok = true;
const maxKey = res.bands[0] ? res.bands[0].key : '';
if (!/Alarm link/.test(maxKey)) { ok = false; console.log(`\nCONTROL FAIL: swept maximum is '${maxKey}', not the alarm link — the tier's roof moved or the scan is wrong`); }
else console.log(`\nCONTROL PASS: the swept maximum is the alarm link (${maxKey}, Δ ${D(res.bands[0].s1)})`);
if (tail && res.linkAllow !== null) {
  const expect = tail.b1 + res.linkAllow + res.CM;
  if (Math.abs(res.glass.zStepUnder - expect) > 1e-6) { ok = false; console.log(`CONTROL FAIL: zStepUnder ${res.glass.zStepUnder.toFixed(4)} ≠ link tail build top ${tail.b1.toFixed(4)} + allowance ${res.linkAllow} + CLEAR_MARGIN — the glass derivation and this probe disagree about what pins the step`); }
  else console.log(`CONTROL PASS: zStepUnder = link tail build top + declared allowance + CLEAR_MARGIN (the 1:1 relation holds)`);
} else { ok = false; console.log('CONTROL FAIL: link tail band or its declared allowance not found'); }
// EVERY declared swept-region row, each judged in its own r-band, against its
// own unit, swept. §192's version looked `alarmColCastellations` up BY NAME
// and compared it against the one 'Alarm switch' row, and §226 found three
// things wrong with that at once: the name had stopped being the unit's
// tallest member (§173's sautoir passed it by 0.043 — measured in §192's own
// tree, so the control was never right), the row had drifted 0.5609 under its
// unit besides, and a SECOND row — 'Alarm striking wheel' — was stale by the
// same cause with nothing watching it at all. A control that names one member
// of one row can only ever confirm the sentence it was written from.
//
// Both directions are held. UNDER its unit means the row has stopped being
// that unit's swept maximum. OVER it past the authoring rounding means the row
// is buying back-envelope for metal nobody stands in, which costs cased height
// silently — the failure §192's whole landing was spent undoing.
// A ROW THIS PROBE'S POSES CANNOT REACH IS REPORTED, NOT FAILED — and the
// distinction is not defensive, it is the third row's whole reason for
// existing. This probe scans the tree AS BOOTED and then sweeps the
// alarm-side axes; `BACK_ENVELOPE` measures during CONSTRUCTION, before the
// first tick. For every row but one those are the same pose (TODO 111's
// measurement). The `Alarm switch` r 48.3–49.6 row is the documented
// exception — the pusher-side linkage parks inside that band at construction
// and has left it by the time any pose in this probe's set is entered, so
// measured over construction + canonical reset + all 42 axis poses, THIS
// probe finds nothing there and would call a load-bearing row empty.
// Neutering it proves it is load-bearing: the pane plane drops 12.077 →
// 10.303, rStep 38.85 → 47.65 past its own aperture, and four case asserts
// fire. The instrument that CAN judge that row is the boot assert in
// BACK_ENVELOPE, which runs in the same walk as the bins and therefore at the
// same pose — so it is named here rather than approximated.
if (!res.regionTop.length) { ok = false; console.log('CONTROL FAIL: the tree declares no swept-region rows — BACK_SWEPT_REGIONS is missing or unexposed'); }
for (const R of res.regionTop) {
  const where = `'${R.unit}' r ${R.r0}–${R.r1}`;
  if (R.measured === null) { console.log(`  report: ${where} declares ${R.z} — no metal of that unit stands in its band at any pose THIS probe sweeps (construction, canonical reset, the alarm axes), so this control cannot judge it; BACK_ENVELOPE's own boot assert measures it at the pose it is declared for`); continue; }
  if (R.z + 1e-9 < R.measured) { ok = false; console.log(`CONTROL FAIL: ${where} declares ${R.z} against ${R.measured.toFixed(3)} its own unit reaches there (${R.who}) — the row is under its unit, so it is no longer that unit's swept maximum (BACK_SWEPT_REGIONS is authored, not derived; re-author it on any move)`); }
  else if (R.z - R.measured > 0.011) { ok = false; console.log(`CONTROL FAIL: ${where} declares ${R.z}, ${(R.z - R.measured).toFixed(3)} over the ${R.measured.toFixed(3)} its unit reaches there (${R.who}) — past the authoring rounding, so the row buys envelope nothing stands in`); }
  else console.log(`CONTROL PASS: ${where} declares ${R.z} over its unit's measured ${R.measured.toFixed(3)} (${R.who}) — within its rounding`);
}
if (!monotonic) { ok = false; console.log('CONTROL FAIL: the ladder interleaves — the scan grabbed the wrong meshes for a rung'); }
else console.log('CONTROL PASS: the ladder is monotonic');
const bar = rung('alarmLinkBeakBar');
if (!bar || !tail || Math.abs(tail.b0 - bar.b0) > 1e-6) { ok = false; console.log(`CONTROL FAIL: the tail's underside ${tail ? tail.b0.toFixed(4) : '—'} parted from the bar's ${bar ? bar.b0.toFixed(4) : '—'} — §172's "underside unmoved" identity broke, or the scan grabbed the wrong meshes`); }
else console.log(`CONTROL PASS: tail underside = bar underside (§172's plane, shared exactly)`);
await browser.close(); srv.kill();
process.exit(ok ? 0 : 2);
