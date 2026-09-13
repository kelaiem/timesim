// DO THE TEETH OF A CROSSED-AXIS MESH INTERLEAVE, OR DRIVE THROUGH EACH OTHER?
//
// The §194 registry cannot ask this. `meshCandidates` enumerates a pair only
// when its axes are PARALLEL and its centre distance closes on the pitch-radius
// sum — so every bevel and crown-wheel mesh is out of scope by construction,
// and "0 undeclared meshes in the metal" is silent about all of them. Two of
// them carry the whole keyless works: `crownWheel ⇄ windingPinion` (engaged
// while WINDING) and `clutchRim ⇄ settingWheel` (engaged while SETTING THE
// HANDS). Neither has a phase solve, a ratio check or a centre-distance check,
// and their teeth sit where a half-pitch seed put them.
//
// Worse, neither appears even in probe-194-mesh-population's out-of-scope
// COUNT: at 90° the pitch-sum criterion is meaningless, so the pairs that land
// in that count are the ones whose numbers happen to fall near a metric that
// does not apply to them, not the real bevel population. Measured here:
// crownWheel ⇄ windingPinion stands at centre 4.1480 against rA+rB 4.7600 —
// 12.86% "off" by a rule that does not govern it. A bevel pair's pitch cones
// share an APEX; the sum of pitch radii is not the constraint.
//
// So this asks the question geometrically instead, of the metal: sweep the two
// members through their relative phase and measure how deep one solid goes into
// the other. A correct mesh is TANGENT — surfaces meet and do not cross. Teeth
// on teeth drive a tooth-height deep.
//
// IT IS NOT probe-194-mesh-population (which ENUMERATES parallel candidates and
// is the thing that cannot see these), NOT probe-train-mesh-phase or
// meshPhase/`measureMeshNow` (anti-phase on a LINE OF CENTRES, which two
// crossed axes do not have), and NOT probe-95-interpenetration, whose witness
// this borrows wholesale: that one asks whether ONE claimed overlap survives a
// valid parity test at the build pose; this sweeps a mesh's whole engagement
// and asks whether the overlap is a contact or a collision.
//
// THE WITNESS IS probe-95's, unchanged and for its reasons: parity needs a
// CLOSED surface, so boundary edges are counted first (keyed by POSITION, since
// three.js duplicates vertices per face) and a pair with no valid witness is
// REFUSED rather than guessed at. Points are taken on the SURFACE — a
// barycentric grid over every triangle — never on vertices, because a
// vertex-only span once read 5.260 where the surface reached 1.216.
//
// CONTROLS, both kinds, on a pair that is NOT the subject — a solved,
// parallel, battery-green mesh, so the measure is bracketed on known metal:
//   · must-miss — third wheel ⇄ fourth pinion, as built, must read TANGENT
//     (no sample deeper than a fraction of a tooth);
//   · must-hit  — the same pair with a HALF PITCH injected into one member must
//     read DEEP, near a tooth height. Without this a probe that samples the
//     wrong meshes, or whose parity is broken, reports every pair tangent and
//     looks like good news.
// A run whose must-hit does not fire has measured nothing, and says so.
//
// REPORT. It prints depths and leaves the judgement to a reader: what counts as
// too deep for a bevel tooth is a question this repo has not settled, and a
// gate that guessed the threshold would be a number nobody derived.
//
// AS OF THIS WRITING IT REFUSES EVERY PAIR, CONTROLS INCLUDED, AND THAT IS THE
// FINDING. The parity witness needs a closed surface and the movement's gear
// bodies are not closed: measured, `thirdWheel` carries 4 boundary edges,
// `windingPinion` and `clutchRim` 4, `fourthPinion` 70, `crownWheel` and
// `settingWheel` 150 each. They are not seam artifacts — the counts are
// INVARIANT as the position weld is loosened from 1e-5 to 1e-2, four orders of
// magnitude, so they are genuine holes rather than duplicated vertices (the
// signed-zero case probe-95's header records). CLAUDE.md's own trap list has
// the consequence: an open mesh reads as a colliding one, so a parity answer
// here would be worth nothing whichever way it came out.
//
// The controls are what make that a finding instead of a clean run: a probe
// without them would have printed "0 penetration" for all five pairs and read
// as good news. Keep them at the front of whatever replaces the witness.
//
// WHAT WOULD WORK, for whoever picks this up: outline against outline in the
// plane that contains BOTH AXES — the bevel's own line-of-centres plane, which
// is how such a mesh is drawn. `ExtrudeGeometry` keeps `parameters.shapes`
// (TODO 100 leans on exactly that, and weldGeometry carries the reference
// through), so the authored tooth profile is readable without touching the
// triangle soup, and probe-131-escapement-slide is the worked example of
// outline-vs-outline depth in this repo. That route needs no closed solid.
//
// cd tools && node probe-crossed-axis-mesh.mjs
import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
const ROOT = process.env.ROOT || join(dirname(fileURLToPath(import.meta.url)), '..');
const PORT = Number(process.env.PORT || 8513);
const srv = spawn('python3', ['-m', 'http.server', String(PORT), '--bind', '127.0.0.1'], { cwd: ROOT, stdio: 'ignore' });
process.on('exit', () => srv.kill());
await new Promise((r) => setTimeout(r, 1200));
const browser = await chromium.launch();
const page = await browser.newPage();
page.on('pageerror', (e) => console.log('PAGEERROR', String(e)));
await page.goto(`http://127.0.0.1:${PORT}/index.html`, { waitUntil: 'load', timeout: 90000 });
await page.waitForFunction(() => !!window.__clock, null, { timeout: 90000 });

const out = await page.evaluate(async () => {
  const THREE = await import('three');
  const I = await import('./src/inspect.js');
  const C = window.__clock;
  const log = [];

  // ---- probe-95's witness, lifted verbatim in method ----------------------
  const boundary = (g) => {
    const pos = g.attributes.position, idx = g.index;
    const n = idx ? idx.count : pos.count, at = (t) => (idx ? idx.getX(t) : t);
    const q = (v) => { const r = Math.round(v * 1e5); return r === 0 ? 0 : r; };
    const key = (i) => `${q(pos.getX(i))}_${q(pos.getY(i))}_${q(pos.getZ(i))}`;
    const e = new Map();
    for (let t = 0; t + 2 < n; t += 3) {
      const k = [key(at(t)), key(at(t + 1)), key(at(t + 2))];
      for (let m = 0; m < 3; m++) {
        const a = k[m], b = k[(m + 1) % 3];
        if (a === b) continue;
        const kk = a < b ? `${a}|${b}` : `${b}|${a}`;
        e.set(kk, (e.get(kk) || 0) + 1);
      }
    }
    let bad = 0; for (const v of e.values()) if (v !== 2) bad++;
    return bad;
  };
  const surf = (mesh, N) => {
    const g = mesh.geometry, pos = g.attributes.position, idx = g.index;
    const n = idx ? idx.count : pos.count, res = [];
    const a = new THREE.Vector3(), b = new THREE.Vector3(), c = new THREE.Vector3();
    for (let t = 0; t + 2 < n; t += 3) {
      const i0 = idx ? idx.getX(t) : t, i1 = idx ? idx.getX(t + 1) : t + 1, i2 = idx ? idx.getX(t + 2) : t + 2;
      a.fromBufferAttribute(pos, i0); b.fromBufferAttribute(pos, i1); c.fromBufferAttribute(pos, i2);
      for (let u = 0; u <= N; u++) for (let v = 0; u + v <= N; v++) {
        const w = N - u - v;
        res.push(new THREE.Vector3((a.x * w + b.x * u + c.x * v) / N, (a.y * w + b.y * u + c.y * v) / N, (a.z * w + b.z * u + c.z * v) / N));
      }
    }
    return res;
  };
  const DIRS = [[0.317, 0.591, 0.741], [0.803, -0.271, 0.530], [-0.436, 0.712, 0.550],
    [0.601, 0.499, -0.624], [-0.259, -0.487, 0.834]].map((d) => new THREE.Vector3(...d).normalize());
  const ray = new THREE.Ray();
  const insideTree = (tree, box, v) => {
    if (box.distanceToPoint(v) !== 0) return false;
    let yes = 0;
    for (const d of DIRS) {
      ray.origin.copy(v); ray.direction.copy(d);
      const hs = tree.raycast(ray, THREE.DoubleSide);
      let k = 0; for (const h of hs) if (h.distance > 1e-9) k++;
      if (k % 2 === 1) yes++;
    }
    return yes >= 3;
  };

  // rotor index: name -> the object carrying the pitch radius and tooth count
  const rotors = [];
  C.scene.updateMatrixWorld(true);
  C.scene.traverse((o) => {
    if (!(o.userData && typeof o.userData.r === 'number' && o.userData.r > 0) || o.userData.schematic) return;
    rotors.push(o);
  });
  const rotorByName = (n) => rotors.find((o) => o.name === n) || null;
  // the solid(s) under a rotor — a makeGear group holds its body as a child mesh
  const solidOf = (o) => {
    let best = null;
    o.traverse((m) => {
      if (!m.isMesh || !m.geometry || !m.geometry.attributes.position) return;
      const n = m.geometry.attributes.position.count;
      if (!best || n > best.geometry.attributes.position.count) best = m;
    });
    return best;
  };

  // DEPTH of A's surface inside B's solid, at the current pose. Returns null
  // when no parity witness is valid on this pair (probe-95's refusal).
  const depthNow = (A, B, grid) => {
    const ba = boundary(A.geometry), bb = boundary(B.geometry);
    if (ba && bb) return { refused: 'both open' };
    const runs = ba ? [[A, B]] : bb ? [[B, A]] : [[A, B], [B, A]];
    let deepest = 0, inside = 0;
    for (const [src, dst] of runs) {
      I.meshClearance(src, dst, Infinity);          // side effect: builds the trees
      const tree = dst.geometry.boundsTree;
      if (!tree) continue;
      const box = tree.getBoundingBox(new THREE.Box3());
      const m = new THREE.Matrix4().copy(dst.matrixWorld).invert().multiply(src.matrixWorld);
      const hit = {};
      for (const qp of grid.get(src)) {
        const v = qp.clone().applyMatrix4(m);
        if (!insideTree(tree, box, v)) continue;
        inside++;
        tree.closestPointToPoint(v, hit);
        if (hit.distance > deepest) deepest = hit.distance;
      }
    }
    return { deepest, inside, openA: ba, openB: bb };
  };

  // One subject: sweep the DRIVER through `span` of its own pitch and report
  // the worst depth. Rotating a member is the same injection measureMeshNow's
  // controls use — the question is about relative phase, so phase is what moves.
  const sweep = (label, aName, bName, { steps = 24, span = 1.5, inject = 0 } = {}) => {
    const A = rotorByName(aName), B = rotorByName(bName);
    if (!A || !B) { log.push(`  ${label}: NO ROTOR ${!A ? aName : bName}`); return null; }
    const sa = solidOf(A), sb = solidOf(B);
    if (!sa || !sb) { log.push(`  ${label}: no solid under ${!sa ? aName : bName}`); return null; }
    const grid = new Map([[sa, surf(sa, 3)], [sb, surf(sb, 3)]]);
    const pitch = (Math.PI * 2) / (A.userData.teeth || 1);
    const z0 = A.rotation.z;
    let worst = { deepest: -1 }, refused = null, minClear = Infinity;
    for (let i = 0; i < steps; i++) {
      A.rotation.z = z0 + inject * pitch + (i / steps) * span * pitch;
      C.scene.updateMatrixWorld(true);
      minClear = Math.min(minClear, I.meshClearance(sa, sb, Infinity));
      const d = depthNow(sa, sb, grid);
      if (d.refused) { refused = d.refused; break; }
      if (d.deepest > worst.deepest) worst = { ...d, at: +(i / steps * span).toFixed(3) };
    }
    A.rotation.z = z0;
    C.scene.updateMatrixWorld(true);
    const toothH = 2.25 * (A.userData.module || 0.34);
    if (refused) { log.push(`  ${label}: REFUSED — ${refused}; no valid parity witness`); return null; }
    log.push(`  ${label}`);
    log.push(`      solids ${sa.name || sa.geometry.type} ⇄ ${sb.name || sb.geometry.type}   ${worst.openA || worst.openB ? `(open: A ${worst.openA} B ${worst.openB})` : '(both closed)'}`);
    log.push(`      min surface gap over the sweep  ${minClear.toFixed(4)}`);
    log.push(`      DEEPEST penetration             ${worst.deepest.toFixed(4)}   (${(worst.deepest / toothH * 100).toFixed(0)}% of a ${toothH.toFixed(3)} tooth height, ${worst.inside} sample pts inside, at ${worst.at} pitch)`);
    return worst.deepest;
  };

  I.enterAxis(C);
  C.setPose({ tau: 0.05, crownPullT: 0, leverEngage: 0, tension: 1 });
  C.scene.updateMatrixWorld(true);

  log.push('CONTROLS — a solved, parallel, battery-green mesh, measured the same way');
  const ctrlGood = sweep('must-miss  thirdWheel ⇄ fourthPinion, as built', 'thirdWheel', 'fourthPinion');
  const ctrlBad = sweep('must-hit   the same pair, HALF A PITCH injected', 'thirdWheel', 'fourthPinion', { inject: 0.5, span: 0.02, steps: 3 });

  log.push('\nSUBJECTS — the crossed-axis meshes, which no registry check can reach');
  const subjects = [
    ['crownWheel ⇄ windingPinion   (engaged while WINDING)', 'crownWheel', 'windingPinion'],
    ['clutchRim ⇄ settingWheel     (engaged while SETTING THE HANDS)', 'clutchRim', 'settingWheel'],
    ['alarmSetIdler2 ⇄ alarmStemBevel', 'alarmSetIdler2', 'alarmStemBevel'],
  ];
  const res = [];
  for (const [label, a, b] of subjects) res.push([label, sweep(label, a, b)]);

  return { log: log.join('\n'), ctrlGood, ctrlBad, res };
});
await browser.close(); srv.kill();

console.log(out.log);
console.log('\n--- controls');
const missOk = out.ctrlGood !== null && out.ctrlGood < 0.2;
const hitOk = out.ctrlBad !== null && out.ctrlBad > 0.2;
console.log(`  must-miss (as built, should be tangent): ${out.ctrlGood === null ? 'NOT MEASURED' : out.ctrlGood.toFixed(4)}  ${missOk ? 'OK' : 'CONTROL FAILED'}`);
console.log(`  must-hit  (half pitch, should be deep):  ${out.ctrlBad === null ? 'NOT MEASURED' : out.ctrlBad.toFixed(4)}  ${hitOk ? 'OK' : 'CONTROL FAILED'}`);
if (!(missOk && hitOk)) console.log('\n  CONTROLS DID NOT BRACKET THE MEASURE — the subject readings above mean nothing.');
