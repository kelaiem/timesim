// §104 — boot probe: page errors, boot warnings, the governor's record, and
// the anchor corner's measured clearances at a few strike poses.
import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
const srv = spawn('python3', ['-m', 'http.server', '8447', '--bind', '127.0.0.1'], { cwd: '..', stdio: 'ignore' });
await new Promise((r) => setTimeout(r, 800));
const browser = await chromium.launch();
const page = await browser.newPage();
page.on('pageerror', (e) => console.log('PAGEERROR', String(e)));
page.on('console', (m) => { if (m.type() === 'warning' && !/GroupMarker|GL Driver|SwiftShader|WebGL/.test(m.text())) console.log('BOOTWARN', m.text()); });
await page.goto('http://127.0.0.1:8447/index.html', { waitUntil: 'load', timeout: 60000 });
await page.waitForFunction(() => !!window.__clock, null, { timeout: 60000 }).catch(() => console.log('NO __clock — boot died'));
const res = await page.evaluate(async () => {
  const THREE = await import('three');
  const clock = window.__clock;
  if (!clock) return ['no clock'];
  const out = [];
  const E = clock.equalisation;
  out.push(`alarm k ${E.alarm.k_Nm_per_rad.toExponential(4)}, setup ${E.alarm.setup.clicks}/${E.alarm.setup.teeth} quantised=${E.alarm.setup.quantised}`);
  out.push(`windRange ${E.alarm.windRangeRad.map((x) => x.toFixed(4)).join('..')} rad, M ${E.alarm.momentRange_Nmm.map((x) => x.toFixed(4)).join('..')} N·mm`);
  out.push(`total ${E.alarm.totalWindTurns.toFixed(4)} turns ≤ ${E.alarm.usableCeilingTurns}, capacityLeft ${E.alarm.capacityLeft.toFixed(4)}`);
  const c = E.alarm.cadence;
  out.push(`gap design ${c.gapAtDesign_s.toFixed(6)} (target ${c.designGap_s}), full ${c.gapFull_s.toFixed(4)}, empty ${c.gapEmpty_s.toFixed(4)}, ring ${c.ringSeconds.toFixed(3)} s`);
  out.push(`I_a ${c.I_kgm2.toExponential(4)} kg·m², ring r ${c.ring.r_mm.toFixed(3)} mm section ${c.ring.section_mm.toFixed(4)} mm inStock=${c.ring.inStock}`);
  out.push(`hammer window free ${c.hammerWindow.freeAtFastest_s.toFixed(4)} vs fall ${c.hammerWindow.fall_s.toFixed(4)} ok=${c.hammerWindow.ok}`);
  // measured strike rate via step(): full and near-empty
  const gapBy = (phase) => {
    clock.resetInputs();
    clock.setPose({ tau: 0.13, crownPullT: 0, leverEngage: 0, tension: 1, windAccumTurns: 0,
      alarmStrikePhase: phase, alarmOn: 1, alarmReleased: 1 });
    const p0 = clock.alarmStrikePhase ?? null;
    let t = 0;
    for (let i = 0; i < 100; i++) { clock.step(0.001); t += 0.001; }
    return null; // fallback if no phase getter
  };
  void gapBy;
  // the unit's meshes and their AABBs at rest
  const gov = clock.labelEntries.find((e) => e.name === 'Alarm governor');
  if (!gov) { out.push('NO Alarm governor unit'); return out; }
  clock.setPose({ tau: 0.13, crownPullT: 0, leverEngage: 0, tension: 1, windAccumTurns: 0 });
  gov.obj.updateWorldMatrix(true, true);
  gov.obj.traverse((o) => {
    if (!o.isMesh || o.userData.schematic) return;
    const bb = new THREE.Box3().setFromObject(o);
    const s = bb.getSize(new THREE.Vector3());
    out.push(`  ${o.name || o.geometry.type}: z ${bb.min.z.toFixed(2)}..${bb.max.z.toFixed(2)}, xy size ${s.x.toFixed(2)}×${s.y.toFixed(2)}`);
  });
  // clearance of governor unit vs the striking wheel's new parts and vs barrel arbor
  const I = await import('./src/inspect.js');
  const sw = clock.labelEntries.find((e) => e.name === 'Alarm striking wheel');
  const bar = clock.labelEntries.find((e) => e.name === 'Alarm barrel');
  const meshByName = (entry, name) => { let m = null; entry.obj.traverse((o) => { if (!m && o.isMesh && o.name === name) m = o; }); return m; };
  const pairs = [
    [meshByName(sw, 'alarmGovWheel'), meshByName(gov, 'alarmGovPinion'), 'wheel ⇄ pinion (mesh)'],
    [meshByName(sw, 'alarmGovWheel'), meshByName(bar, 'alarmBarrelArbor'), 'wheel ⇄ barrel arbor'],
    [meshByName(gov, 'alarmGovSaw'), meshByName(gov, 'alarmGovPallet'), 'saw ⇄ pallet A (intra)'],
    [meshByName(gov, 'alarmGovRing'), meshByName(gov, 'alarmGovStud'), 'ring ⇄ governor stud'],
  ];
  for (const [a, b, label] of pairs) {
    if (!a || !b) { out.push(`${label}: MISSING mesh (${!!a}/${!!b})`); continue; }
    const d = I.meshClearance(a, b, Infinity);
    out.push(`${label}: clearance ${d === Infinity ? 'Inf' : d.toFixed(4)}`);
  }
  return out;
});
console.log(res.join('\n'));
await browser.close(); srv.kill();
