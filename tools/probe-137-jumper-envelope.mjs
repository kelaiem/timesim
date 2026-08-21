#!/usr/bin/env node
// §137 / TODO 16 — THE MINUTE JUMPER'S SWEPT ENVELOPE ALONG THE SHAFT.
//
// TODO 16's named prerequisite, verbatim: "measure the minute jumper's swept
// envelope along the shaft's stations from a virgin boot with the crown
// pulled — only then is there a number to size against. Guessing costs a
// 15-minute CI run per iteration, and has now cost two." Both shaft
// thickenings (uniform 0.447 and the stepped 0.373) were rejected by CI on
// Alarm link ⇄ Minute jumper at overlaps 0.312/0.310 — RADIUS-INSENSITIVE,
// which is this probe's second question: the offender may not be the shaft
// body at all, so every alarm-link member is measured against the sweep, not
// just the arbor.
//
// Method: virgin boot (a fresh browser context IS the virgin state — the
// trap that cost the two CI runs was a saved pose with the crown home, so
// the jumper sat OUT of the star), pull the crown through step(dt) (the pull
// is eased; setPose cannot move it — CLAUDE.md trap 1), then sweep the
// setting across MORE than one star pitch and let the jumper's snap settle
// at each sample. Two tables out:
//   stations — per 0.5 u bucket along the shaft's own axis (read off the
//              built alarmLinkShaft mesh, no second copy of the chord), the
//              minimum radial distance any swept jumper vertex reaches:
//              the ALLOWANCE a stepped arbor is sized from (section radius
//              ≤ allowance − CLEAR_MARGIN per station).
//   members  — per alarm-link mesh, the minimum clearance to the swept
//              jumper (BVH closest-point over every sampled pose): names
//              the actual offender the CI rejections never localized.
import { chromium } from 'playwright';
import { spawn } from 'node:child_process';

const port = '8541';
const srv = spawn('python3', ['-m', 'http.server', port, '--bind', '127.0.0.1'],
  { cwd: new URL('..', import.meta.url).pathname, stdio: 'ignore' });
await new Promise((r) => setTimeout(r, 900));
const browser = await chromium.launch();
const page = await browser.newPage();
const errs = [];
page.on('pageerror', (e) => errs.push(String(e)));
await page.goto(`http://127.0.0.1:${port}/index.html`, { waitUntil: 'load', timeout: 150000 });
await page.waitForFunction(() => !!window.__clock, null, { timeout: 120000 });

const out = await page.evaluate(async () => {
  const c = window.__clock;
  const I = await import('./src/inspect.js');
  const THREE = await import('three');

  // The shaft's own axis, read off the built mesh — one source, no drift.
  const linkEntry = c.labelEntries.find((e) => e.name === 'Alarm link');
  const jumperEntry = c.labelEntries.find((e) => e.name === 'Minute jumper');
  if (!linkEntry || !jumperEntry) return { error: 'units not found' };
  let shaftMesh = null;
  const linkMeshes = [];
  linkEntry.obj.traverse((o) => {
    if (!o.isMesh) return;
    linkMeshes.push(o);
    if (o.name === 'alarmLinkShaft') shaftMesh = o;
  });
  if (!shaftMesh) return { error: 'alarmLinkShaft not found' };
  c.scene.updateMatrixWorld(true);
  const axisDir = new THREE.Vector3(0, 1, 0)
    .applyQuaternion(shaftMesh.getWorldQuaternion(new THREE.Quaternion())).normalize();
  const axisMid = shaftMesh.getWorldPosition(new THREE.Vector3());
  const halfLen = shaftMesh.geometry.parameters.height / 2;
  const axisA = axisMid.clone().addScaledVector(axisDir, -halfLen);

  // Virgin boot, crown PULLED — the pull is eased, so step() it home.
  c.setPose({ crownPullT: 1 });
  for (let i = 0; i < 240; i++) c.step(1 / 60);

  // Sweep the setting across ≥ one star pitch: advance the displayed time by
  // a bit over two minutes in fine steps, letting the snap settle each time.
  // The jumper's whole cycle — riding a star tip, falling into the next gap,
  // the snap — is inside one displayed minute, so two minutes covers the
  // cycle twice from both flanks.
  const t0 = c.displayTime;
  const perStep = 0.005;                // crown radians per sample (~1.33 star pitches of display)
  const stations = new Map();           // bucket (0.5 u along axis) -> min radial
  const memberMin = new Map(linkMeshes.map((m) => [m.name || '(unnamed)', Infinity]));
  // BVHs on the link's meshes (inspect.js's import installed the prototype;
  // §81 welded/indexed every mesh at boot, so these are real indices).
  for (const m of linkMeshes) if (!m.geometry.boundsTree) m.geometry.computeBoundsTree();
  const vTmp = new THREE.Vector3(), rel = new THREE.Vector3(), local = new THREE.Vector3(), target = {};
  const inv = new Map(linkMeshes.map((m) => [m, m.matrixWorld.clone().invert()]));
  // Coarse prune: the link's world AABB grown by the query ceiling — a jumper
  // vertex outside it cannot set any member minimum under 3 u.
  const linkBox = new THREE.Box3().setFromObject(linkEntry.obj).expandByScalar(3);
  const pos = [];
  jumperEntry.obj.traverse((o) => { if (o.isMesh) pos.push(o); });
  let samples = 0;
  let rot = c.crownRotation;
  // 250 samples at ~1.33 star pitches each: the phases mod one pitch
  // distribute densely, so the snap's whole cycle is sampled from both
  // flanks many times over.
  while (samples < 250) {
    rot += perStep;
    c.setCrownRotation(rot);
    for (let i = 0; i < 10; i++) c.step(1 / 60);        // let the snap settle
    c.scene.updateMatrixWorld(true);
    for (const mesh of pos) {
      const p = mesh.geometry.attributes.position;
      for (let i = 0; i < p.count; i++) {
        vTmp.set(p.getX(i), p.getY(i), p.getZ(i)).applyMatrix4(mesh.matrixWorld);
        // station table: radial distance to the shaft axis, bucketed along it
        rel.copy(vTmp).sub(axisA);
        const t = rel.dot(axisDir);
        if (t > -1 && t < 2 * halfLen + 1) {
          const radial = rel.addScaledVector(axisDir, -t).length();
          if (radial < 6) {
            const bucket = Math.round(t / 0.5) * 0.5;
            if (!(stations.has(bucket)) || radial < stations.get(bucket)) stations.set(bucket, radial);
          }
        }
        // member table: BVH closest point, pruned to the near field
        if (!linkBox.containsPoint(vTmp)) continue;
        for (const m of linkMeshes) {
          local.copy(vTmp).applyMatrix4(inv.get(m));
          const hit = m.geometry.boundsTree.closestPointToPoint(local, target, 0, 3);
          if (hit) {
            const key = m.name || '(unnamed)';
            if (hit.distance < memberMin.get(key)) memberMin.set(key, hit.distance);
          }
        }
      }
    }
    samples++;
  }
  const stationRows = [...stations.entries()].sort((a, b) => a[0] - b[0])
    .map(([t, r]) => ({ t_u: t, allowance_u: +r.toFixed(4) }));
  const memberRows = [...memberMin.entries()].filter(([, d]) => d < Infinity)
    .sort((a, b) => a[1] - b[1]).map(([m, d]) => ({ mesh: m, minClear_u: +d.toFixed(4) }));

  // Part two — THE ALLOWANCE AGAINST THE WHOLE MOVEMENT. The jumper table
  // above answers TODO 16's literal question; this answers the one a
  // re-section actually needs: at each station along the chord, how fat may
  // the shaft be before it enters ANY unit's swept volume? The §36 registry
  // is exactly this instrument — pose-net-wide hulls (the jumper's setting
  // sweep included by construction, since the handSet/crown axes drive it) —
  // queried at growing clearance with the link itself excluded (§36's own
  // rule: the linkage being re-sectioned cannot block itself). yieldEvery
  // raised per CLAUDE.md's automation trap.
  c.resetInputs();
  const reg = await I.buildSweptRegistry(c, { yieldEvery: 64 });
  const exclude = new Set(['Alarm link']);
  const allowanceAt = (pt) => {
    let lo = 0, hi = 3;                       // beyond 3 u nothing here cares
    if (I.routeOccupantAt(reg, pt, hi, exclude) === null) return hi;
    for (let i = 0; i < 12; i++) {
      const mid = (lo + hi) / 2;
      if (I.routeOccupantAt(reg, pt, mid, exclude)) hi = mid; else lo = mid;
    }
    return lo;
  };
  const corridor = [];
  for (let t = 0; t <= 2 * halfLen + 1e-6; t += 0.5) {
    const pt = axisA.clone().addScaledVector(axisDir, t);
    const a = allowanceAt([pt.x, pt.y, pt.z]);
    const occ = I.routeOccupantAt(reg, [pt.x, pt.y, pt.z], Math.min(3, a + 0.05), exclude);
    corridor.push({ t_u: +t.toFixed(2), allowance_u: +a.toFixed(3),
      binds: occ ? occ.unit + (occ.mesh ? '/' + occ.mesh : '') : null });
  }
  const minRow = corridor.reduce((a, r) => (r.allowance_u < a.allowance_u ? r : a), corridor[0]);
  return {
    samples, sweptDisplaySeconds: +(c.displayTime - t0).toFixed(1),
    shaft: { mid: axisMid.toArray().map((v) => +v.toFixed(3)), halfLen_u: +halfLen.toFixed(3) },
    stations: stationRows, members: memberRows,
    corridor,
    verdict: {
      jumperEverNearShaft: stationRows.length > 0 || memberRows.length > 0,
      minAllowance: minRow,
      note: stationRows.length === 0
        ? 'the minute jumper never enters the shaft\'s neighbourhood on the current tree — '
          + 'the CI-rejection story is historical; the corridor profile above is what a re-section is sized against'
        : 'jumper envelope measured — see stations',
    },
  };
});

console.log(JSON.stringify(out, null, 1));
if (errs.length) { console.error('PAGE ERRORS:'); errs.slice(0, 5).forEach((e) => console.error('  ' + e)); }
await browser.close();
srv.kill();
process.exit(errs.length ? 1 : 0);
