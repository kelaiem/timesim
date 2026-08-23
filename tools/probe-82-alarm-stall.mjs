// TODO 82 — THE ALARM TRANSFER'S STALL, COMPUTED INSTEAD OF QUOTED.
//
// The pusher→ring force budget has been written down four times (TODO 16's
// 1.5 mN, TODO 63's 1.6 mN, §137 Landing 2's 48 mN, TODO 79's 3.3 mN) and
// never once computed. It lives as one prose paragraph in src/main.js
// (`WHAT THE CHAIN STALLS AT`). Two things are wrong with it:
//
// 1. THE STROKE IS A DELETED CONSTANT. Every one of those figures multiplies
//    a stiffness by "the rod's 0.158 mm travel" = 0.42 u = ALARM_LINK_ROD_TRAVEL,
//    which src/main.js itself deleted: "defined for the life of §35,
//    referenced nowhere, and WRONG (the tick moved the rod 0.19). The rod's
//    travel is now a registration-solve OUTPUT." The 0.19 in that parenthesis
//    is itself pre-TODO-20 (posed, not solved). So the stroke is not
//    determinable from source at all — it has to be measured off the tree.
//
// 2. "IN SERIES" IS IMPLEMENTED AS A MINIMUM. The paragraph takes each
//    member's k × its OWN stroke at its OWN point and picks the smallest,
//    with no lever ratio referring them to a common point. Nothing in the
//    repo computes 1/k_eff = Σ 1/k_i. That is why the shaft's ROD-END
//    overhang is absent from every figure: there was no series for it to be
//    absent from.
//
// WHAT THIS COMPUTES, and the constraint each step derives from:
//
// · The stroke, TWICE. setPose ticks with zero dt so an eased input cannot
//   move under it (CLAUDE.md's first trap), and the registration solve's
//   solveEnv is a bisection seeded from the previous state — a jump straight
//   to the far end is how a branch-tracked solve reports a travel nobody's
//   watch performs. So it is taken by pose AND by a real step(dt) run driven
//   from pressAlarmPusher (the button is the only public door to it), and the
//   two must AGREE. probe-137-elbow's rule: agreement is the evidence, either
//   number alone is a claim.
//
// · REFLECTED compliance, not a minimum. For a member whose working point
//   moves n_i = δ_i/δ_ring per unit of ring travel, force scales as 1/n_i, so
//   its compliance seen AT THE RING is n_i²/k_i. Sum those and invert. Every
//   n_i is MEASURED between the two poses rather than derived from arm
//   lengths — "angles travel the gears" applied to displacements.
//
// · One section model throughout: CIRCULAR, I = πr⁴/4, because the shaft is
//   round and §137's own 2807 N/m is circular. checkSlenderness's column is
//   RECTANGULAR (ac³/12) and reads 64/12π = 1.6977× stiffer for a round bar;
//   TODO 79's table mixed the two and is corrected by this landing.
//
// Usage: node probe-82-alarm-stall.mjs [out.json]   (from tools/; needs
// npm ci + Playwright Chromium). ROOT= serves a different tree.
import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import { writeFileSync } from 'node:fs';

const PORT = process.env.PORT || 8464;
const ROOT = process.env.ROOT || '..';
const srv = spawn('python3', ['-m', 'http.server', String(PORT), '--bind', '127.0.0.1'], { cwd: ROOT, stdio: 'ignore' });
await new Promise((r) => setTimeout(r, 800));
const browser = await chromium.launch();
const page = await browser.newPage();
page.on('pageerror', (e) => console.error('PAGEERROR', String(e)));
await page.goto(`http://127.0.0.1:${PORT}/index.html`, { waitUntil: 'load', timeout: 60000 });
await page.waitForFunction(() => !!window.__clock, null, { timeout: 60000 });

const V = await page.evaluate(async () => {
  const THREE = await import('./vendor/three.module.js');
  const L = await import('./src/layout.js');
  const clock = window.__clock;
  const fail = [];

  const byName = (n) => clock.scene.getObjectByName(n);
  const need = (n) => { const o = byName(n); if (!o) throw new Error(`${n} is not in the scene`); return o; };
  const rod = need('alarmLinkRod');
  const shaftMesh = need('alarmLinkShaft');
  const shaft = shaftMesh.parent;                 // the keyed group the tick rolls
  const ring = need('alarmSelRing');
  const pin = need('alarmLinkCentrePin');
  const rimCrank = need('alarmLinkCrankRim');
  const tail = need('alarmLinkBeakTail');

  const wpos = (o) => new THREE.Vector3().setFromMatrixPosition(o.matrixWorld);
  const snap = () => {
    clock.scene.updateMatrixWorld(true);
    return {
      rodZ: rod.position.z,
      shaftRoll: shaft.rotation.x,
      ringW: wpos(ring).toArray(),
      pinW: wpos(pin).toArray(),
      rimW: wpos(rimCrank).toArray(),
      tailW: wpos(tail).toArray(),   // the mesh CENTRE, so it reads half the tip's travel — informational only; the blade is loaded at its TIP, which moves with the rod
      alarmOn: clock.alarmDebug.alarmOn,
      colSteps: clock.alarmDebug.alarmColShownA,
    };
  };
  const dist = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);

  // ---- A. POSED. The exact form: setPose lands the column's parity and its
  // click station directly, so no pusher pulse and no ease is involved.
  const BASE = { tau: 0.13, crownPullT: 0, leverEngage: 0, tension: 1, alarmCrownPullT: 0 };
  clock.resetInputs();
  clock.setPose({ ...BASE, alarmOn: 0 });
  const posedOff = snap();
  clock.setPose({ ...BASE, alarmOn: 1 });
  const posedOn = snap();
  if (posedOff.alarmOn === posedOn.alarmOn) fail.push('the two posed states report the same alarmOn — the pose did not take');

  // ---- B. STEPPED. Driven from the pusher, through the real tick and its
  // ease, exactly as a finger would. The button is the public door to
  // pressAlarmPusher(); setAlarm presses only if the parity disagrees.
  clock.resetInputs();
  clock.setPose({ ...BASE, alarmOn: 0 });
  // Settle first: the pose lands the click station, but the eased display
  // angles need ticks to converge before a delta means anything.
  for (let i = 0; i < 400; i++) clock.step(1 / 120);
  const stepOff = snap();
  document.getElementById('btn-alarm').click();
  // Step until the column's shown angle stops moving AND the parity has
  // flipped — a fixed tick count would measure whatever the ease happened
  // to have reached.
  let settled = 0, prevA = stepOff.colSteps;
  for (let i = 0; i < 4000 && settled < 120; i++) {
    clock.step(1 / 120);
    const a = clock.alarmDebug.alarmColShownA;
    settled = Math.abs(a - prevA) < 1e-9 ? settled + 1 : 0;
    prevA = a;
  }
  const stepOn = snap();
  if (stepOn.alarmOn === stepOff.alarmOn) fail.push('the pusher press did not flip the parity within 4000 ticks');

  // ---- The travels, both ways.
  const posed = {
    rod: Math.abs(posedOn.rodZ - posedOff.rodZ),
    roll: Math.abs(posedOn.shaftRoll - posedOff.shaftRoll),
    ring: dist(posedOn.ringW, posedOff.ringW),
    pin: dist(posedOn.pinW, posedOff.pinW),
    rim: dist(posedOn.rimW, posedOff.rimW),
    tailMeshCentre: dist(posedOn.tailW, posedOff.tailW),
  };
  const stepped = {
    rod: Math.abs(stepOn.rodZ - stepOff.rodZ),
    roll: Math.abs(stepOn.shaftRoll - stepOff.shaftRoll),
    ring: dist(stepOn.ringW, stepOff.ringW),
    pin: dist(stepOn.pinW, stepOff.pinW),
    rim: dist(stepOn.rimW, stepOff.rimW),
    tailMeshCentre: dist(stepOn.tailW, stepOff.tailW),
  };
  // AGREEMENT IS THE EVIDENCE. Tolerance is a tenth of the smallest travel
  // either way, floored at float noise — not a number chosen to pass.
  const agreeTol = Math.max(1e-6, 0.10 * Math.min(posed.rod, stepped.rod));
  const agree = Math.abs(posed.rod - stepped.rod) <= agreeTol;
  if (!agree) fail.push(`the two stroke measurements disagree: posed ${posed.rod.toFixed(5)} vs stepped ${stepped.rod.toFixed(5)} u (tol ${agreeTol.toFixed(5)})`);

  // ---- The compliant members, one section model (circular).
  const E = 200e9, MM = L.UNIT_MM;
  const mm = (u) => u * MM * 1e-3;                       // units → metres
  const kBend = (rU, L_u, coeff) => coeff * E * (Math.PI * mm(rU) ** 4 / 4) / mm(L_u) ** 3;
  const kRect = (aU, cU, L_u, coeff) => coeff * E * (mm(aU) * mm(cU) ** 3 / 12) / mm(L_u) ** 3;

  // Shaft geometry, read off the mesh rather than the source.
  shaftMesh.geometry.computeBoundingBox();
  const sb = shaftMesh.geometry.boundingBox;
  const ext = { x: sb.max.x - sb.min.x, y: sb.max.y - sb.min.y, z: sb.max.z - sb.min.z };
  const stock = Math.max(ext.x, ext.y, ext.z);
  const shaftR = shaftMesh.geometry.parameters ? shaftMesh.geometry.parameters.radiusTop : Math.min(ext.x, ext.y, ext.z) / 2;
  const stations = (shaftMesh.userData.bearings || {}).stations || [];
  const cuts = [-stock / 2, ...stations, stock / 2].sort((a, b) => a - b);
  const seg = [];
  for (let i = 0; i < cuts.length - 1; i++) {
    const Lg = cuts[i + 1] - cuts[i];
    if (Lg <= 1e-9) continue;
    seg.push({ kind: (i === 0 || i === cuts.length - 2) ? 'overhang' : 'span', L_u: Lg });
  }
  seg.sort((a, b) => b.L_u - a.L_u);
  const rodEnd = seg.find((s) => s.kind === 'overhang' && s.L_u > 5) || null;
  const forkEnd = seg.filter((s) => s.kind === 'overhang').sort((a, b) => a.L_u - b.L_u)[0] || null;
  const span = seg.find((s) => s.kind === 'span') || null;

  // THE ROD END IS COUPLED, NOT A FIXED CANTILEVER. SLENDER_OVERHANG_K's own
  // comment: a cantilever past a real back span deflects Pa²(L+a)/3EI at its
  // tip, not Pa³/3EI, because the back span ROTATES. In stiffness space that
  // is a factor (L+a)/a — the λ-space cube root ≈1.4 is NOT the stiffness
  // factor, which is the mistake this line exists to avoid.
  const coupling = rodEnd && span ? (span.L_u + rodEnd.L_u) / rodEnd.L_u : 1;

  // Tail blade section, read off its own mesh.
  tail.geometry.computeBoundingBox();
  const tb = tail.geometry.boundingBox;
  const td = [tb.max.x - tb.min.x, tb.max.y - tb.min.y, tb.max.z - tb.min.z].sort((a, b) => a - b);

  const ringTravel = posed.ring;
  const n = (d) => (ringTravel > 1e-9 ? d / ringTravel : NaN);   // δ_member per unit ring travel

  const members = [];
  const add = (name, k, ratio, note) => members.push({
    name, k_N_per_m: +k.toFixed(2), n: +ratio.toFixed(4),
    reflectedCompliance: ratio * ratio / k, note,
  });
  add('beak tail blade', kRect(td[0], td[1], td[2], 3), n(posed.rod),
    'flat blade, rectangular by construction; loaded at the tail tip by the rod reaction');
  if (rodEnd) add('shaft, rod-end overhang', kBend(shaftR, rodEnd.L_u, 3) / coupling, n(posed.rod),
    `coupled by (L+a)/a = ${coupling.toFixed(3)}; ABSENT from every previously published figure`);
  if (forkEnd) add('shaft, fork-end overhang', kBend(shaftR, forkEnd.L_u, 3), n(posed.pin),
    'the only one §137 Landing 2 sized the section against');
  if (span) add('shaft, bush-to-bush span', kBend(shaftR, span.L_u, 48), n(posed.pin),
    'simply supported, load at midspan');

  const C = members.reduce((s, m) => s + m.reflectedCompliance, 0);
  const kEff = 1 / C;
  const stall_mN = kEff * mm(ringTravel) * 1000;

  // The old construction, reproduced so the two can be compared directly.
  const legacyMin = members.map((m) => ({ name: m.name, stall_mN: m.k_N_per_m * mm(m.n * ringTravel) * 1000 }))
    .sort((a, b) => a.stall_mN - b.stall_mN);

  return {
    unitMm: MM, sectionModel: 'circular I = πr⁴/4 (the shaft is round; §137 is circular)',
    shaft: { stock_u: +stock.toFixed(4), r_u: +shaftR.toFixed(4), stations: stations.map((s) => +s.toFixed(4)),
      segments: seg.map((s) => ({ kind: s.kind, L_u: +s.L_u.toFixed(4) })), coupling: +coupling.toFixed(4) },
    stroke: {
      posed_u: +posed.rod.toFixed(5), stepped_u: +stepped.rod.toFixed(5),
      posed_mm: +(posed.rod * MM).toFixed(5), agreeTol_u: +agreeTol.toFixed(5), agree,
      deadConstant: { ALARM_LINK_ROD_TRAVEL: 0.42, mm: +(0.42 * MM).toFixed(4),
        note: 'deleted in src/main.js as "referenced nowhere, and wrong"; still the multiplier behind every published stall' },
    },
    travels: { posed, stepped },
    ringTravel_u: +ringTravel.toFixed(5), ringTravel_mm: +(ringTravel * MM).toFixed(5),
    members, kEff_N_per_m: +kEff.toFixed(2), stall_mN: +stall_mN.toFixed(2),
    legacyMinConstruction: legacyMin.map((x) => ({ ...x, stall_mN: +x.stall_mN.toFixed(2) })),
    detentBand_mN: [5, 50],
    failures: fail,
  };
});

await browser.close();
srv.kill();
writeFileSync(process.argv[2] || 'alarm-stall.json', JSON.stringify(V, null, 2));

const f = (n, d = 4) => Number(n).toFixed(d);
console.log(`shaft: stock ${f(V.shaft.stock_u)} u, r ${f(V.shaft.r_u)}, stations ${V.shaft.stations.join(', ')}`);
for (const s of V.shaft.segments) console.log(`  ${s.kind.padEnd(8)} ${f(s.L_u)} u`);
console.log(`\nSTROKE — the number every published stall multiplies by:`);
console.log(`  posed   ${f(V.stroke.posed_u, 5)} u  (${f(V.stroke.posed_mm, 5)} mm)`);
console.log(`  stepped ${f(V.stroke.stepped_u, 5)} u   agree(±${f(V.stroke.agreeTol_u, 5)}): ${V.stroke.agree ? 'YES' : 'NO'}`);
console.log(`  the deleted constant it was taken from: 0.42 u = ${V.stroke.deadConstant.mm} mm`);
console.log(`\nring travel ${f(V.ringTravel_u, 5)} u (${f(V.ringTravel_mm, 5)} mm)`);
console.log(`\nMEMBERS, reflected to the ring (n = δ_member per unit ring travel):`);
for (const m of V.members)
  console.log(`  ${m.name.padEnd(28)} k ${String(m.k_N_per_m).padStart(10)} N/m   n ${String(m.n).padStart(8)}   n²/k ${m.reflectedCompliance.toExponential(3)}`);
console.log(`\n  k_eff = 1/Σ(n²/k) = ${f(V.kEff_N_per_m, 2)} N/m`);
console.log(`  STALL = k_eff × ring travel = ${f(V.stall_mN, 2)} mN   against the ${V.detentBand_mN.join('–')} mN detent band`);
console.log(`\nthe old min-over-members construction, for comparison:`);
for (const x of V.legacyMinConstruction) console.log(`  ${x.name.padEnd(28)} ${f(x.stall_mN, 2)} mN`);
if (V.failures.length) { console.error('\nFAILURES:'); for (const x of V.failures) console.error('  · ' + x); process.exit(1); }
console.log('\nprobe OK');
