// TODO 151 — DOES THE SETTING CAP STAND ON THE MINUTE WHEEL'S PLANE, AND IS
// THE LEG THAT CARRIES IT THERE THE ONE ITS SOLVE SAYS IT CUT?
//
// Before TODO 151's (d) landing this probe asked whether the cap could be
// moved onto `mwMinuteWheel`'s plane AT ALL in the §234 fold's topology, by
// mutating the built metal: option (a) the cap raised alone, (b) the rise
// corner's outboard mount flipped onto +Z, (c) the setting plane moved, (d) a
// fourth corner. (a)–(c) measured geometrically impossible or mechanically
// broken and (d) was taken; the numbers are recorded in TODO 151, and the
// probe that took them is this file at 0c3b8e5. None of those options has a
// meaning on the landed geometry (the cap no longer stands on B's axis), so
// the sections that measured them are gone rather than left printing numbers
// about a topology that no longer exists.
//
// WHAT IT MEASURES NOW:
//   §1  vertex-precise world z-bands (Box3 inflates a rotated mesh — the
//       "−0.912" this item first quoted was Box3's answer, the vertex top
//       −1.308) of the cap, the wheel's rim, the new corners' blanks and the
//       star, and the cap's axis against the mesh's centre distance;
//   §7  the base plate's presented face, raycast at the wheel's axis, and the
//       wheel's, the cannon pinion's and the cap's clearances against it —
//       the cap's top lands ON the margin by construction (Z_SETTING_CAP);
//   §8  THE CAP LEG AS SOLVED. main.js's `solveCapLeg` picks the rise's tilt
//       φ and the stub's length L for the shipped B on each blank's SWEPT
//       envelope (`G.bevelBlankEnvelope`, a certified bound). This reads the
//       answer back (`__clock.settingFold.capLeg`) and holds it to the cut
//       metal:
//         a. IDENTITY — the corners' apexes and shaft angles read off the
//            built mounts are the solve's, Σ_E = 90° + φ, and the cap stands
//            the plan chord Dz·tanφ + L from B;
//         b. CLEAR — every blank of one of the three new corners (B, E, D)
//            against every blank of another, cut meshes, `meshClearance`,
//            over the setting input's turn: ≥ CLEAR_MARGIN between blanks that
//            turn as different bodies, and apart (> 0) where one rod carries
//            both — the solve's own rule;
//         c. CONTROL, and the load-bearing one — the envelope's certified
//            lower bound, taken on the mounts' own frames and the gears' own
//            cut specs, never exceeds what `meshClearance` measures on the
//            cut blanks at any sample. A bound that overshoots once is not a
//            bound, and the solve would have been judging on a fiction;
//            and the must-fail half: asked for more than it measured, the
//            envelope must say no;
//         d. LEAST (a report) — the binding pair's CERTIFIED clearance at the
//            solved φ and L (the largest target the envelope signs for), which
//            the solve's bisection leaves within its resolution of the margin.
//
// Gates exit non-zero (b, c, and §1/§7's plane and plate rows); §8d reports.
// Run from tools/ with a Playwright Chromium: `node probe-151-cap-plane.mjs`.
import { chromium } from 'playwright';
import { spawn } from 'node:child_process';

const port = process.env.PORT || '8503';
const root = process.env.ROOT || '..';
const srv = spawn('python3', ['-m', 'http.server', port, '--bind', '127.0.0.1'], { cwd: root, stdio: 'ignore' });
await new Promise((r) => setTimeout(r, 900));
const browser = await chromium.launch();
const page = await browser.newPage();
page.on('pageerror', (e) => console.log('PAGEERROR', String(e)));
await page.goto(`http://127.0.0.1:${port}/index.html?schematic=0`, { waitUntil: 'load', timeout: 90000 });
await page.waitForFunction(() => !!window.__clock, null, { timeout: 180000 });
await page.waitForTimeout(1500);

const out = await page.evaluate(async () => {
  const C = window.__clock;
  const THREE = await import('/vendor/three.module.js');
  const I = await import('/src/inspect.js');
  const L = await import('/src/layout.js');
  const G = await import('/src/geometry.js');
  window.requestAnimationFrame = () => 0;
  C.resetInputs();
  C.setPose({});
  C.scene.updateMatrixWorld(true);
  const CM = L.CLEAR_MARGIN;
  const F = C.settingFold, leg = F && F.capLeg;
  if (!leg) return { missing: ['__clock.settingFold.capLeg'] };

  const unschem = (o) => { for (let q = o; q; q = q.parent) if (q.userData && q.userData.schematic) return false; return true; };
  const named = (n) => { let r = null; C.scene.traverse((o) => { if (!r && o.name === n) r = o; }); return r; };
  const meshesOf = (n) => { const r = named(n); const l = []; if (r) r.traverse((o) => { if (o.isMesh && unschem(o)) l.push(o); }); return l; };
  const V = new THREE.Vector3();
  const zBand = (list) => {
    let lo = Infinity, hi = -Infinity;
    for (const o of list) {
      const pos = o.geometry.attributes.position;
      for (let i = 0; i < pos.count; i++) { V.fromBufferAttribute(pos, i).applyMatrix4(o.matrixWorld); lo = Math.min(lo, V.z); hi = Math.max(hi, V.z); }
    }
    return [lo, hi];
  };
  const TAGS = ['Rise', 'Foot', 'Cap'];
  const NAMES = ['settingCap', 'mwMinuteWheel', 'star', 'cannonPinion', ...TAGS.flatMap((t) => [`mwCorner${t}In`, `mwCorner${t}Out`])];
  const missing = NAMES.filter((n) => !meshesOf(n).length);
  if (missing.length) return { missing };

  // §1 — the bands, and the cap's axis against the mesh's centre distance
  const bands = Object.fromEntries(NAMES.map((n) => [n, zBand(meshesOf(n))]));
  const wheelAxis = named('mwMinuteWheel').getWorldPosition(new THREE.Vector3());
  const capAxis = named('settingCap').getWorldPosition(new THREE.Vector3());
  const centreD = Math.hypot(capAxis.x - wheelAxis.x, capAxis.y - wheelAxis.y);
  const centreWant = L.MW_MODULE_1 * (L.SETTING_CAP_TEETH + L.MW_MINUTE_TEETH) / 2;

  // §7 — the plate's presented face at the wheel's axis, and the clearances
  const plateMeshes = []; C.scene.traverse((o) => { if (o.isMesh && o.name === 'backPlate' && unschem(o)) plateMeshes.push(o); });
  const ray = new THREE.Raycaster(new THREE.Vector3(wheelAxis.x, wheelAxis.y, -50), new THREE.Vector3(0, 0, 1), 0, 100);
  let faceZ = null;
  for (const pm of plateMeshes) { const h = ray.intersectObject(pm, false); if (h.length) faceZ = h[0].point.z; }
  const toPlate = (n) => { let m = Infinity; for (const a of meshesOf(n)) for (const b of plateMeshes) m = Math.min(m, I.meshClearance(a, b)); return m; };
  const plate = { mwMinuteWheel: toPlate('mwMinuteWheel'), cannonPinion: toPlate('cannonPinion'), settingCap: toPlate('settingCap') };

  // §8a — IDENTITY: the mounts are the solve's
  const gear = (n) => named(n);                                   // the conical gear's GROUP (its userData.cone is the cut spec)
  const frameOf = (n) => {
    const mount = gear(n).parent;
    const o = mount.getWorldPosition(new THREE.Vector3());
    const a = new THREE.Vector3(0, 0, 1).applyQuaternion(mount.getWorldQuaternion(new THREE.Quaternion()));
    return { o: o.toArray(), a: a.toArray(), v: { o, a } };
  };
  const fr = Object.fromEntries(TAGS.flatMap((t) => [`mwCorner${t}In`, `mwCorner${t}Out`]).map((n) => [n, frameOf(n)]));
  const deg = (u, v) => Math.acos(Math.max(-1, Math.min(1, u.dot(v)))) * 180 / Math.PI;
  const B = fr.mwCornerRiseIn.v.o, E = fr.mwCornerFootIn.v.o, D = fr.mwCornerCapIn.v.o;
  const ident = {
    E: E.distanceTo(new THREE.Vector3(...leg.E)), D: D.distanceTo(new THREE.Vector3(...leg.D)),
    sigmaB: deg(fr.mwCornerRiseIn.v.a, fr.mwCornerRiseOut.v.a) - leg.sigmaBDeg,
    sigmaE: deg(fr.mwCornerFootIn.v.a, fr.mwCornerFootOut.v.a) - leg.sigmaEDeg,
    sigmaEvsPhi: leg.sigmaEDeg - (90 + leg.phiDeg),
    chord: Math.hypot(capAxis.x - B.x, capAxis.y - B.y) - ((B.z - leg.zCapCorner) * Math.tan(leg.phiDeg * Math.PI / 180) + leg.stub),
    capOverD: Math.hypot(capAxis.x - D.x, capAxis.y - D.y),
    phiOffVertical: deg(fr.mwCornerRiseOut.v.a, new THREE.Vector3(0, 0, -1)) - leg.phiDeg,
  };

  // §8b/c — every cross-corner blank pair, cut meshes against the envelope,
  // over the setting input's turn (the blanks turn; the envelope does not)
  const envOf = (n) => G.bevelBlankEnvelope(gear(n).userData.cone);
  const blanks = TAGS.flatMap((t) => [`mwCorner${t}In`, `mwCorner${t}Out`]);
  const pairs = [];
  for (let i = 0; i < blanks.length; i++) for (let j = i + 1; j < blanks.length; j++) {
    const ti = blanks[i].replace(/^mwCorner|In$|Out$/g, ''), tj = blanks[j].replace(/^mwCorner|In$|Out$/g, '');
    if (ti !== tj) pairs.push([blanks[i], blanks[j]]);
  }
  // the rigid body each blank turns with: two keyed to one rod are one body,
  // held only to not running into each other (target 0), as the solve holds them
  const BODY = { mwCornerRiseIn: 'leg2', mwCornerRiseOut: 'rise', mwCornerFootIn: 'rise', mwCornerFootOut: 'stub',
    mwCornerCapIn: 'stub', mwCornerCapOut: 'cap' };
  const SET = [0, 0.41, 0.97, 1.63, 2.2, 2.9, 3.5, 4.4, 5.3, 6.1];
  const rows = {};
  let controlBad = [], mustFailBad = [];
  for (const sp of SET) {
    C.resetInputs(); C.setPose({ crownPullT: 0, setPathRot: sp }); C.scene.updateMatrixWorld(true);
    for (const [a, b] of pairs) {
      let meas = Infinity;
      for (const x of meshesOf(a)) for (const y of meshesOf(b)) meas = Math.min(meas, I.meshClearance(x, y));
      const fa = frameOf(a), fb = frameOf(b);
      // the envelope's CERTIFIED clearance: the largest target it will sign
      // for, bisected to a tenth of its own finest resolution (a `lb` from a
      // single call is valid but loose — a far sample settles on its sphere
      // bound — so the tight figure is asked for, not read off)
      const certifies = (t) => G.revolvedBlanksClearance(envOf(a), fa, envOf(b), fb, t).ok;
      let cLo = 0, cHi = meas + 0.05;
      if (!certifies(cLo)) cHi = cLo = -Infinity;
      else while (cHi - cLo > G.ENVELOPE_DELTA_FINE / 10) { const m = (cLo + cHi) / 2; if (certifies(m)) cLo = m; else cHi = m; }
      const k = `${a}|${b}`;
      const r = rows[k] || (rows[k] = { meas: Infinity, lb: Infinity, target: BODY[a] === BODY[b] ? 0 : CM });
      r.meas = Math.min(r.meas, meas);
      r.lb = Math.min(r.lb, cLo);
      if (cLo > meas + 1e-9) controlBad.push(`${k} at setPathRot ${sp}: certified ${cLo.toFixed(5)} > measured ${meas.toFixed(5)}`);
      // must-fail: asked to certify more than the metal has, it must refuse
      if (isFinite(meas) && G.revolvedBlanksClearance(envOf(a), fa, envOf(b), fb, meas + 0.02).ok)
        mustFailBad.push(`${k} at setPathRot ${sp}: certified ${(meas + 0.02).toFixed(4)} against a measured ${meas.toFixed(4)}`);
    }
  }
  C.resetInputs(); C.setPose({}); C.scene.updateMatrixWorld(true);
  return { CM, bands, centreD, centreWant, faceZ, plate, leg, ident, rows, controlBad, mustFailBad, samples: SET.length,
    deltaFine: G.ENVELOPE_DELTA_FINE };
});

let bad = 0;
const fail = (s) => { bad++; console.log('  FAIL ' + s); };
const ok = (s) => console.log('  ok   ' + s);
if (out.missing) {
  fail('not found: ' + out.missing.join(', ') + ' (nothing measured)');
} else {
  const fmtB = (b) => `[${b[0].toFixed(3)}, ${b[1].toFixed(3)}]`;
  console.log('\n§1 — WORLD Z-BANDS (vertex-precise)');
  for (const [n, b] of Object.entries(out.bands)) console.log(`  ${n.padEnd(16)} z ${fmtB(b)}`);
  const cz = out.bands.settingCap, wz = out.bands.mwMinuteWheel;
  if (cz[0] <= wz[0] && wz[1] <= cz[1]) ok(`the wheel's whole band lies inside the cap's`);
  else fail(`mwMinuteWheel z ${fmtB(wz)} is not inside settingCap z ${fmtB(cz)}`);
  if (Math.abs(out.centreD - out.centreWant) <= 1e-6) ok(`cap ⇄ wheel axes ${out.centreD.toFixed(6)} apart — the pitch-circle sum`);
  else fail(`cap ⇄ wheel axes ${out.centreD.toFixed(6)} apart against ${out.centreWant.toFixed(6)}`);

  console.log('\n§7 — THE PLATE');
  console.log(`  presented face at the wheel's axis z = ${out.faceZ === null ? 'NO HIT' : out.faceZ.toFixed(4)}`);
  for (const [n, c] of Object.entries(out.plate)) {
    // the cap and the cannon pinion land ON the margin by construction: float noise about that tie is not a miss
    if (c < out.CM - 1e-6) fail(`${n} ⇄ backPlate clears ${c.toFixed(6)}`); else ok(`${n} ⇄ backPlate clears ${c.toFixed(6)}`);
  }

  const l = out.leg;
  console.log(`\n§8 — THE CAP LEG AS SOLVED: φ ${l.phiDeg.toFixed(4)}°, stub ${l.stub.toFixed(4)}, chord ${l.chord.toFixed(4)}, `
    + `Σ_B ${l.sigmaBDeg.toFixed(4)}°, Σ_E ${l.sigmaEDeg.toFixed(4)}°, modules ${l.moduleRise} / ${l.moduleFoot}, `
    + `Z_SETTING_CAP ${l.zCap.toFixed(4)}, Z_CAP_CORNER ${l.zCapCorner.toFixed(4)}`);
  console.log('  a. IDENTITY — the built mounts against the solve:');
  for (const [k, v] of Object.entries(out.ident)) {
    if (Math.abs(v) > 1e-6) fail(`${k} off by ${v.toExponential(3)}`); else ok(`${k} ${v.toExponential(2)}`);
  }
  console.log(`  b. CLEAR — cut blanks of different corners, ${out.samples} setting-input samples; c. the envelope's bound beside each:`);
  const sorted = Object.entries(out.rows).sort((a, b) => a[1].meas - b[1].meas);
  for (const [k, r] of sorted) {
    const [a, b] = k.split('|');
    const line = `${a} ⇄ ${b}: measured ${r.meas.toFixed(4)}, envelope certifies ${r.lb.toFixed(4)}`
      + (r.target === 0 ? '  (one rod: held apart, not to the margin)' : '');
    if (r.meas < r.target) fail(line); else ok(line);
  }
  for (const s of out.controlBad) fail(`CONTROL: the envelope overshot — ${s}`);
  if (!out.controlBad.length) ok('CONTROL: the envelope bound never exceeded the cut blanks\' measured clearance');
  for (const s of out.mustFailBad) fail(`MUST-FAIL: ${s}`);
  if (!out.mustFailBad.length) ok('MUST-FAIL: asked for 0.02 more than each pair measures, the envelope refused every time');
  console.log('  d. LEAST (report) — what binds each solve at the answer it settled on:');
  const least = (re) => Object.entries(out.rows).filter(([k, r]) => re.test(k) && r.target > 0).sort((a, b) => a[1].lb - b[1].lb)[0];
  for (const [what, re] of [['the tilt φ (B\'s blanks ⇄ E\'s and D\'s)', /^mwCornerRise/], ['the stub L (E\'s blanks ⇄ D\'s)', /^mwCornerFoot.*\|mwCornerCap/]]) {
    const [k, r] = least(re);
    console.log(`     ${what}: ${k.replace('|', ' ⇄ ')} certified ${r.lb.toFixed(4)} — ${(r.lb - out.CM).toFixed(4)} over the margin (resolution ${out.deltaFine})`);
  }
}
console.log(bad ? `\nFAIL — ${bad} finding(s)` : '\nPASS — the cap stands on the wheel\'s plane, down the leg its solve says it cut');
await browser.close();
srv.kill();
process.exit(bad ? 1 : 0);
