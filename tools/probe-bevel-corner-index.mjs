// WHERE IS EACH MEMBER OF A BEVEL CORNER'S TOOTH, RELATIVE TO THE PAIR'S LINE
// OF CONTACT? ACCEPTANCE, and the instrument TODO 139 needed after three
// hypotheses about the same 0.13 of a pitch were each refuted by measurement.
//
// A crossed-axis pair meshes only if, on the contact ray, one member presents
// a TOOTH and the other a GAP. `bevelCornerSpin` in src/main.js COMPUTES that
// index; this measures where the tooth actually ENDED UP, in world space, off
// the built mesh — so no frame, no base constant and no tick spin enters the
// reading, and a solve done in the wrong frame cannot agree with it by
// construction.
//
// IT IS NOT probe-crossed-axis-mesh (which measures BURIAL — how deep two
// cuts drive through each other, and answers "is there a good index" by
// sweeping one knob) and NOT probe-138-coupling (which measures the corner's
// RATIO, ω_B/ω_A, and is blind to phase). A pair can read ratio -1, floor
// 0.0000 somewhere in its sweep, and still ship out of index: that was
// exactly TODO 136's two keyless corners.
//
// THE METHOD: sweep the contact ray about each member's own axis through one
// pitch and ask that member's declared apex-cone solid, point by point, metal
// or void, AT THE PITCH CONE. A tooth is one metal RUN and the index is its
// centre, taken from the run's two edges rather than from any sample.
//   · the apex is the two axis LINES' intersection, and its miss is printed —
//     axes that do not meet are not a corner;
//   · the ray is the TRUE contact line (γ from member A's axis), not the
//     bisector, and the printed ray·uA / ray·uB must come back as the two
//     pitch angles;
//   · the metal side is the mesh's LOCAL +Z, because `makeConicalGear` cuts
//     every ring at positive z. Deriving it instead — sign((meshOrigin −
//     apex)·axis) — reads sign of a quantity that is zero by construction, and
//     float noise sent three of six members to the far side of their own apex
//     and read 0% metal at the pitch cone of a gear that has teeth.
//
// CONTROLS, because a scan that resolves nothing reads 0.0000 as happily as a
// correct corner does:
//   · COVERAGE — one pitch must carry exactly ONE metal run, at a duty near
//     half. Zero runs or two is a refusal, not a reading;
//   · MUST-HIT — a known quarter pitch injected into one member must move that
//     member's reading by exactly 0.25;
//   · MUST-MISS — the same scan at a cone distance outside the band must read
//     0% duty;
//   · THE BUILDER'S OWN CONVENTION — each gear's tooth 0 is scanned against
//     its own local +X as well, which `bevelOutline` puts it at. That is the
//     half of the index the mount cannot explain, and measuring it is what
//     cleared `cycloidalToothPath` of the second refuted hypothesis.
//
// WHAT IT FOUND (TODO 139). Both keyless corners shipped out of index, one
// member each, by a different amount per corner — which is why no single
// systematic offset had described it:
//
//   windingPinion   0.3736 of a pitch from the ray, wanting 0.500
//   clutchRim       0.3674                          wanting 0.500
//   crownWheel      0.0000 — exact          settingBevel 0.0000 — exact
//
// The plate-side member of each corner was EXACT and the stem-side member was
// not, which is the shape of the cause: `bevelCornerSpin` read its mount
// through `updateMatrixWorld(true)`, which recomputes from `parent.matrixWorld`
// as it stands and never walks UP, and both stem-side mounts hang under a
// group carrying the stem's own azimuth. After the fix the same scan reads
// 0.0000 / 0.5000 on the winding corner and 0.0000 / 0.4938 on the setting
// one, the 0.0062 being the clutch's deliberate 0.005 rad seat clocking.
//
// The ALARM corner still reads 0.3750, and that is TODO 140: its index is
// solved with `alarmRotor.rotation.z` at 0 and the movement's rest pose puts it
// at -2.90597, which wraps to exactly that.
//
// WHY THIS IS A PROBE AND NOT A BOOT ASSERT, which cost a CI cycle to learn. A
// boot guard doing exactly this shipped on the branch and was removed: a
// corner's index is a property of a POSE, and boot has none. `main.js` carries
// a top-level `await loadState()`, so a SAVED barrelWindTurns lands in the wind
// variables and `tick(0)` then applies it, spinning every stem-side member
// about the stem -- so a guard after it measures what the last session saved
// (silent on a fresh profile, half a pitch out after a reload, which is how CI
// caught it). And moving it BEFORE that tick does not save it: measured, at the
// build pose the ALARM corner reads 0.0000/0.0000 while the WINDING corner's
// crown wheel reads 0.0556 out, because `crownWheel.rotation.z` is only posed
// from its base by the tick. The two poses satisfy different subsets and there
// is no third. A claim that needs a posed movement belongs where poses are
// controlled -- here, after `resetInputs()`, which is why every battery check
// is shaped the same way.
//
// Burial, measured by probe-crossed-axis-mesh on the same trees, is the same
// finding from the other side: the winding corner fell 0.2653 -> 0.0760 and the
// setting one reads 0.0831 against a row that had been naming the wrong mate
// and reporting 0.0000 at every phase. Both now FLOOR at phase 0.000 — the
// shipped index — so what is left on them, about 9% of a tooth height, is not
// an index error at all.
//
// The two MOTION-WORKS corners are reported and not judged, and are TODO 140's
// second half. They never adopted `bevelCornerSpin`: `addBevelCorner` seeds a
// bare half pitch, so the absolute condition above is false on all four
// members. What survives is the RELATIVE one — and it lands on the DIFFERENCE
// in Drop (0.5007) and the SUM in Rise (-0.5000), because those two corners
// are built with opposite handedness, so the triple (u_A, u_B, u_A x u_B)
// flips between them. Two accidents half a pitch apart to four figures, not a
// solve. Both are registered with the boot guard WAIVED to that item.
//
// cd tools && node probe-bevel-corner-index.mjs
import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
const ROOT = process.env.ROOT || join(dirname(fileURLToPath(import.meta.url)), '..');
const PORT = Number(process.env.PORT || 8575);
// A PRIVATE TMPDIR, ci-battery's idiom: dev_server.py keeps /__state there, so
// a run neither reads nor clobbers a developer's own saved pose.
const STATE = mkdtempSync(join(tmpdir(), 'corner-index-'));
const srv = spawn('python3', [join(ROOT, 'dev_server.py'), String(PORT)], { cwd: ROOT, env: { ...process.env, TMPDIR: STATE }, stdio: 'ignore' });
process.on('exit', () => srv.kill());
await new Promise((r) => setTimeout(r, 2500));
const browser = await chromium.launch({ args: ['--disable-background-timer-throttling','--disable-backgrounding-occluded-windows','--disable-renderer-backgrounding'] });
const page = await browser.newPage();
const bootWarnings = [];
page.on('pageerror', (e) => { console.log('PAGEERROR', String(e)); bootWarnings.push(String(e)); });
// BOOT IS SILENT (standing rule 6) and this probe's whole subject is a boot
// guard, so a warning here is a failure. The renderer's own SwiftShader and
// saved-state chatter is not the app's.
page.on('console', (m) => {
  if (m.type() !== 'warning' && m.type() !== 'error') return;
  const t = m.text();
  if (/SwiftShader|GroupMarkerNotSet|no saved state|GL Driver Message|Failed to load resource/.test(t)) return;
  bootWarnings.push(t);
});
await page.goto(`http://127.0.0.1:${PORT}/index.html`, { waitUntil: 'load', timeout: 180000 });
await page.waitForFunction(() => !!window.__clock, null, { timeout: 180000 });

const out = await page.evaluate(async () => {
  const THREE = await import('three');
  const C = window.__clock;
  const L = [];
  if (C.resetInputs) C.resetInputs();
  C.scene.updateMatrixWorld(true);
  // SKIP THE SCHEMATIC TIER. Its proxies carry the rotor's name and its own
  // pose, and taking the first match put alarmStemBevel's "apex" 5.000 from the
  // real one and read 0% metal at the pitch cone of a gear that has teeth.
  const byName = (n) => { let f = null;
    C.scene.traverse((o) => { if (f || o.name !== n || o.userData.schematic) return;
      let has = false; o.traverse((m) => { if (m.isMesh && m.userData && m.userData.solid && m.userData.solid.kind === 'apexCone' && !m.userData.schematic) has = true; });
      if (has) f = o; });
    return f; };
  const coneMesh = (g) => { let s = null; g.traverse((o) => { if (!s && o.isMesh && o.userData && o.userData.solid && o.userData.solid.kind === 'apexCone') s = o; }); return s; };
  const inRing = (ring, x, y) => { let hit = false;
    for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
      const [xi, yi] = ring[i], [xj, yj] = ring[j];
      if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) hit = !hit; }
    return hit; };
  // point-in-band, in the mesh's OWN local frame (the web is a different region
  // and is deliberately not tested — this scan lives on the pitch cone)
  const inBand = (sc, p) => {
    const rho = p.length(); if (rho < sc.rhoLo || rho > sc.rhoHi) return false;
    const th = Math.atan2(Math.hypot(p.x, p.y), p.z), phi = Math.atan2(p.y, p.x);
    const r = sc.backR + sc.coneR * Math.tan(th - sc.gamma);
    return inRing(sc.ringPoly, r * Math.cos(phi), r * Math.sin(phi));
  };

  const scan = (g, axis, apex, ray, teeth, rhoF, steps) => {
    const m = coneMesh(g), sc = m.userData.solid;
    const inv = new THREE.Matrix4().copy(m.matrixWorld).invert();
    const rho = sc.rhoLo + (sc.rhoHi - sc.rhoLo) * rhoF;
    const pitch = 2 * Math.PI / teeth;
    const hits = [];
    const p = new THREE.Vector3();
    for (let i = 0; i < steps; i++) {
      const a = (i / steps) * pitch;
      const d = ray.clone().applyAxisAngle(axis, a);
      p.copy(apex).addScaledVector(d, rho).applyMatrix4(inv);
      hits.push(inBand(sc, p));
    }
    // metal RUNS on the circle of one pitch (wrapping): every rising edge,
    // walked forward. A circle that is ALL metal has no rising edge, so that
    // case is named rather than reported as zero runs.
    const runs = [];
    for (let i = 0; i < steps; i++) {
      if (hits[i] && !hits[(i - 1 + steps) % steps]) {
        let len = 0, j = i;
        while (hits[j] && len < steps) { len++; j = (j + 1) % steps; }
        runs.push([i, len]);
      }
    }
    if (runs.length === 0 && hits[0]) runs.push([0, steps]);   // solid all the way round
    const n = hits.filter(Boolean).length;
    return { hits, runs, dutyF: n / steps, pitch, steps, rho,
      band: `${sc.rhoLo.toFixed(3)}..${sc.rhoHi.toFixed(3)}` };
  };
  // ONE run's centre, as a fraction of a pitch from the ray. Computed from the
  // run's two EDGES so the answer is the tooth's midline, not a sample.
  const centreOf = (r) => {
    if (r.runs.length !== 1) return null;
    const [s, len] = r.runs[0];
    const mid = (s + (len - 1) / 2) % r.steps;
    let f = mid / r.steps;
    if (f > 0.5) f -= 1;
    return f;
  };

  const corner = (label, aName, bName, rhoF = 0.5, steps = 720) => {
    const A = byName(aName), B = byName(bName);
    if (!A || !B) { L.push(`${label}: MISSING ${!A ? aName : bName}`); return null; }
    const mA = coneMesh(A), mB = coneMesh(B);
    if (!mA || !mB) { L.push(`${label}: NO apexCone solid on ${!mA ? aName : bName}`); return null; }
    const qA = A.parent.getWorldQuaternion(new THREE.Quaternion());
    const qB = B.parent.getWorldQuaternion(new THREE.Quaternion());
    const axA = new THREE.Vector3(0, 0, 1).applyQuaternion(qA).normalize();
    const axB = new THREE.Vector3(0, 0, 1).applyQuaternion(qB).normalize();
    const oA = A.parent.getWorldPosition(new THREE.Vector3());
    const oB = B.parent.getWorldPosition(new THREE.Vector3());
    const w = oA.clone().sub(oB);
    const a = 1, b = axA.dot(axB), c = 1, d = axA.dot(w), e = axB.dot(w);
    const den = a * c - b * b;
    const s = (b * e - c * d) / den, t = (a * e - b * d) / den;
    const pA = oA.clone().addScaledVector(axA, s), pB = oB.clone().addScaledVector(axB, t);
    const apex = pA.clone().add(pB).multiplyScalar(0.5), miss = pA.distanceTo(pB);
    // THE BLANK'S OWN SIDE IS NOT A GUESS. `makeConicalGear` cuts every ring at
    // POSITIVE z from the mesh's own origin, so the metal lies along the mesh's
    // local +Z and the pitch cone opens about it. Deriving the side instead —
    // sign((meshOrigin - apex).axis) — reads sign(~0), because that origin IS
    // the apex: measured, float noise sent windingPinion, alarmStemBevel and
    // the disc's mate to the far side of their own apex and the scan found 0%
    // metal at the pitch cone of a gear that has teeth. A quantity that is zero
    // by construction cannot carry a sign.
    const uA = new THREE.Vector3(0, 0, 1).transformDirection(mA.matrixWorld).normalize();
    const uB = new THREE.Vector3(0, 0, 1).transformDirection(mB.matrixWorld).normalize();
    // …and the apex is the mesh's own origin, which is a CLAIM about the build,
    // so it is measured rather than assumed.
    const apexA = mA.getWorldPosition(new THREE.Vector3()).distanceTo(apex);
    const apexB = mB.getWorldPosition(new THREE.Vector3()).distanceTo(apex);
    const gA = mA.userData.solid.gamma, gB = mB.userData.solid.gamma;
    const inPl = uB.clone().addScaledVector(uA, -uB.dot(uA)).normalize();
    const ray = uA.clone().multiplyScalar(Math.cos(gA)).addScaledVector(inPl, Math.sin(gA)).normalize();
    const tA = A.userData.teeth || (A.children[0] && A.children[0].userData.teeth);
    const tB = B.userData.teeth || (B.children[0] && B.children[0].userData.teeth);
    L.push(`\n${label}`);
    L.push(`  apex miss ${miss.toFixed(6)} (A origin ${apexA.toFixed(6)}, B origin ${apexB.toFixed(6)} off it)   axes dot ${uA.dot(uB).toFixed(6)}   γ ${(gA*180/Math.PI).toFixed(3)}+${(gB*180/Math.PI).toFixed(3)}=${((gA+gB)*180/Math.PI).toFixed(3)}°`
      + `   ray·uA ${(Math.acos(ray.dot(uA))*180/Math.PI).toFixed(3)}°  ray·uB ${(Math.acos(ray.dot(uB))*180/Math.PI).toFixed(3)}°`);
    const res = [];
    // WHERE IS TOOTH 0 IN THE GEAR'S OWN FRAME? The same scan with the ray
    // replaced by the gear's local +X. `bevelOutline` centres tooth i at
    // azimuth i·2π/z, so this must read 0.0000 — and `bevelCornerSpin` assumes
    // it does. Measured here rather than assumed, because it is the half of the
    // index the mount cannot explain.
    for (const [g, ax, tt, nm] of [[A, uA, tA, aName], [B, uB, tB, bName]]) {
      const m = coneMesh(g);
      const ownX = new THREE.Vector3(1, 0, 0).transformDirection(m.matrixWorld).normalize();
      // …taken at the pitch cone, so it is the same feature the ray scan reads
      const gam = m.userData.solid.gamma;
      const d0 = ax.clone().multiplyScalar(Math.cos(gam)).addScaledVector(ownX.clone().addScaledVector(ax, -ownX.dot(ax)).normalize(), Math.sin(gam)).normalize();
      const r0 = scan(g, ax, apex, d0, tt, rhoF, steps);
      const c0 = centreOf(r0);
      L.push(`  ${nm}: tooth 0 sits ${c0 === null ? 'UNRESOLVED (' + r0.runs.length + ' runs)' : c0.toFixed(4) + ' pitch'} from its OWN +X   (the builder's convention says 0.0000)`);
    }
    for (const [g, ax, tt, nm, want] of [[A, uA, tA, aName, 'TOOTH on the ray'], [B, uB, tB, bName, 'GAP on the ray']]) {
      const r = scan(g, ax, apex, ray, tt, rhoF, steps);
      const ctr = centreOf(r);
      res.push({ nm, tt, r, ctr, waived: label.startsWith('ALARM') || label.startsWith('CONTROL') });
      L.push(`  ${nm}: ${tt}t  band ρ ${r.band}  scanned at ρ ${r.rho.toFixed(3)}  duty ${(r.dutyF*100).toFixed(1)}%  runs ${r.runs.length}`
        + (r.runs.length === 1 ? '' : '   <-- COVERAGE FAIL: one pitch must carry exactly one tooth'));
      if (ctr !== null) L.push(`      tooth centre ${ctr.toFixed(4)} pitch from the ray   (wants ${want === 'TOOTH on the ray' ? '0.000' : '±0.500'})`);
    }
    return res;
  };

  const rows = [];
  rows.push(['WINDING', corner('WINDING  crownWheel ⇄ windingPinion', 'crownWheel', 'windingPinion')]);
  rows.push(['SETTING', corner('SETTING  settingBevel ⇄ clutchRim', 'settingBevel', 'clutchRim')]);
  rows.push(['ALARM', corner('ALARM    alarmDiscBevel ⇄ alarmStemBevel', 'alarmDiscBevel', 'alarmStemBevel')]);
  rows.push(['CTRL-DROP', corner('CONTROL  mwCornerDropIn ⇄ mwCornerDropOut', 'mwCornerDropIn', 'mwCornerDropOut')]);
  rows.push(['CTRL-RISE', corner('CONTROL  mwCornerRiseIn ⇄ mwCornerRiseOut', 'mwCornerRiseIn', 'mwCornerRiseOut')]);

  L.push('\nMUST-HIT — inject +0.25 pitch into alarmDiscBevel; the reading must move by exactly 0.25');
  const D = byName('alarmDiscBevel'); const z0 = D.rotation.z;
  D.rotation.z = z0 + 0.25 * (2 * Math.PI / 10);
  C.scene.updateMatrixWorld(true);
  const hit = corner('ALARM +0.25', 'alarmDiscBevel', 'alarmStemBevel');
  D.rotation.z = z0; C.scene.updateMatrixWorld(true);

  L.push('\nMUST-MISS — the same scan at ρ just OUTSIDE the band must read 0% duty');
  const miss = corner('ALARM (rhoF 1.4, outside the blank)', 'alarmDiscBevel', 'alarmStemBevel', 1.4);
  return { log: L, rows: Object.fromEntries(rows.filter((r) => r[1]).map(([k, v]) => [k, v])), hit, miss };
});
console.log(out.log.join('\n'));
await browser.close();

// ---- the verdict -------------------------------------------------------------
// The two keyless corners are GATED at the convention `bevelCornerSpin` states:
// the plate-side member carries a tooth on the ray, the stem-side member a gap.
// Budget 0.02 of a pitch — a fifth of the boot guard's, because this probe
// measures the metal directly and the setting corner's own 0.005 rad seat
// clocking (0.0064 of a pitch) is the largest thing legitimately in it.
const BUDGET = 0.02;
const fails = [];
const say = (ok, what) => { console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${what}`); if (!ok) fails.push(what); };
console.log('\n--- controls');
const hitA = out.hit && out.hit[0], baseA = out.rows.ALARM && out.rows.ALARM[0];
say(hitA && baseA && Math.abs(((hitA.ctr - baseA.ctr) + 1.5) % 1 - 0.5 - 0.25) < 0.005,
  `must-hit: +0.25 pitch injected into alarmDiscBevel moves its reading by 0.25 `
  + `(${baseA ? baseA.ctr.toFixed(4) : '?'} -> ${hitA ? hitA.ctr.toFixed(4) : '?'})`);
say(out.miss && out.miss.every((r) => r.r.dutyF === 0),
  'must-miss: the scan outside the band reads 0% duty');
say(Object.values(out.rows).every((r) => r.every((m) => m.r.runs.length === 1 || m.waived)),
  'coverage: every judged member resolves exactly one tooth per pitch');
say(bootWarnings.length === 0,
  `boot is silent${bootWarnings.length ? ` — ${bootWarnings.length}: ${bootWarnings[0]}` : ''}`);
console.log('\n--- the corners bevelCornerSpin indexes');
// TODO 140 — CTRL-DROP and CTRL-RISE JOIN THE GATE. They were reported rather
// than gated for as long as `addBevelCorner` seeded a bare half pitch, because
// the absolute condition was false on all four members and only the RELATIVE one
// survived. Both corners take the solve now, so the claim is holdable and is
// held: deleting the exemption is part of the fix, not a follow-up to it.
for (const key of ['WINDING', 'SETTING', 'CTRL-DROP', 'CTRL-RISE']) {
  const r = out.rows[key];
  if (!r) { say(false, `${key}: NOT MEASURED`); continue; }
  say(Math.abs(r[0].ctr) <= BUDGET, `${key} ${r[0].nm} carries a TOOTH on the ray (${r[0].ctr.toFixed(4)})`);
  say(Math.abs(0.5 - Math.abs(r[1].ctr)) <= BUDGET,
    `${key} ${r[1].nm} carries a GAP on the ray (${r[1].ctr.toFixed(4)}, miss ${(0.5 - Math.abs(r[1].ctr)).toFixed(4)})`);
}
console.log('\n--- reported, not gated');
console.log('  ALARM       TODO 140 — the disc is indexed at a pose the movement never occupies,');
console.log('              so its index is re-solved at ENGAGEMENT and cannot be read at rest');
console.log(`\n${fails.length ? `${fails.length} FAILURE(S)` : 'all claims hold'}`);
process.exit(fails.length ? 1 : 0);
