// §254 — DOES THE CHAIN BEND ONLY ABOUT ITS PINS? Acceptance.
//
// A chain joint turns about its rivet and nothing else. Two links that meet at
// a joint may therefore differ in heading, but their PIN AXES must stay
// parallel to within what the running fit lets the inner pair rock:
// CHAIN_RIVET_FIT of radial clearance across the CHAIN_PIN_LEN stack,
// 2·fit/stack ≈ 0.079 rad ≈ 4.5° per joint. Anything beyond that is not
// articulation, it is a stamp posed where no force could put it — TODO 76's
// declared fiction, TODO 208's layout finding.
//
// Each link's pin axis is FITTED from its own triangles, not read off the
// builder's frame: the area-weighted normal tensor Σ A·n·nᵀ of a plate's
// faces has its largest eigenvector along the plate's normal, which is the
// pin. That is what makes this a measurement of the metal and not of the law
// that laid it (the law could be wrong in a way its own frames cannot see —
// TODO 76 re-measured this way and found the 0.238 rivet row was spacing, not
// twist).
//
// Two controls, because a tensor fit can be wrong in the safe direction:
//  · the free SPAN is straight, so its joints must read ~0°; a method that
//    reads degrees there is reading noise or an end cap, not twist;
//  · the drum COIL bends about the drum's axis with its pins parallel to it,
//    so its joints must read ~0° too — the very property the wrap is held to.
// The wrap is then judged on the same instrument: every joint whose two
// links both lie on the cone (radius inside the wrap annulus, z inside the
// groove band) is held under the allowance at every tension sampled.
//
// Usage: node tools/probe-254-chain-twist.mjs    (from the repo; needs
//        tools/ npm ci + Playwright Chromium). Exits non-zero when a wrap
//        joint exceeds the allowance or a control fails.
import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const PORT = process.env.PORT || 8491;
const srv = spawn('python3', ['-m', 'http.server', String(PORT), '--bind', '127.0.0.1'], { cwd: ROOT, stdio: 'ignore' });
await new Promise((r) => setTimeout(r, 900));
const browser = await chromium.launch();
const page = await browser.newPage();
page.on('pageerror', (e) => console.error('PAGEERROR', String(e)));
await page.goto(`http://127.0.0.1:${PORT}/index.html`, { waitUntil: 'load', timeout: 120000 });
await page.waitForFunction(() => !!window.__clock, null, { timeout: 120000 });

const out = await page.evaluate(async () => {
  const THREE = await import('./vendor/three.module.js');
  const L = await import('./src/layout.js');
  const clock = window.__clock;
  const unit = (n) => clock.labelEntries.find((e) => e.name === n);
  const fusUnit = unit('Fusee & great wheel');
  let groove = null, coneGroup = null;
  fusUnit.obj.traverse((o) => { if (!groove && o.userData && o.userData.groove) { groove = o.userData.groove; coneGroup = o; } });
  const fx = clock.P.barrel.x, fy = clock.P.barrel.y;
  const drumC = new THREE.Vector3();
  unit('Mainspring drum').obj.getWorldPosition(drumC);
  // The joint's play: the INNER pair turns on the pin with CHAIN_RIVET_FIT of
  // radial clearance, and rocks about an axis across the pin by that
  // clearance over its own stack along the pin (two leaves and the gap
  // between them); the outer pair is riveted and has none. The relative
  // twist two neighbouring links can take is that rock.
  const innerStack = 2 * L.CHAIN_PLATE_T + L.CHAIN_LEAF_GAP;
  const allow = 2 * L.CHAIN_RIVET_FIT / innerStack;   // rad
  const envR = (f) => groove.envAt(f);
  const d = 1 / 2048;
  const slopeAt = (f) => (envR(Math.max(0, f - d)) - envR(Math.min(1, f + d))) / ((Math.min(1, f + d) - Math.max(0, f - d)) * groove.bandSpan);
  const rHi = envR(0) + groove.grooveD + 0.3, rLo = envR(1) - groove.grooveD - 0.3;
  const zLo = (() => { const v = new THREE.Vector3(0, 0, groove.bandZ0 - groove.grooveW); return coneGroup.localToWorld(v).z; })();
  const zHi = (() => { const v = new THREE.Vector3(0, 0, groove.bandZ0 + groove.bandSpan + groove.grooveW); return coneGroup.localToWorld(v).z; })();

  // Largest eigenvector of a symmetric 3×3 by power iteration (the plate
  // normal dominates a link's tensor by the two big faces' area).
  const topEig = (T) => {
    let v = [1, 0.3, 0.2];
    for (let it = 0; it < 64; it++) {
      const w = [
        T[0] * v[0] + T[1] * v[1] + T[2] * v[2],
        T[1] * v[0] + T[3] * v[1] + T[4] * v[2],
        T[2] * v[0] + T[4] * v[1] + T[5] * v[2],
      ];
      const n = Math.hypot(w[0], w[1], w[2]) || 1;
      v = [w[0] / n, w[1] / n, w[2] / n];
    }
    return v;
  };
  const rows = [];
  for (const t of [0.02, 0.07, 0.2, 0.5, 0.85, 1.0]) {
    clock.setPose({ tension: t, tau: 0, crownPullT: 0, leverEngage: 0, windAccumTurns: t * clock.fuseeWrapTurns });
    clock.scene.updateMatrixWorld(true);
    const chain = clock.scene.getObjectByName('chainRun');
    chain.updateWorldMatrix(true, false);
    const geo = chain.geometry;
    const pos = geo.attributes.position;
    const idx = geo.userData.subBodyIndex || geo.index.array;
    const bodies = geo.userData.subBodies.filter((b) => b.name.startsWith('link#'));
    const a = new THREE.Vector3(), b = new THREE.Vector3(), c = new THREE.Vector3(), n = new THREE.Vector3(), mid = new THREE.Vector3();
    const links = bodies.map((body) => {
      const T = [0, 0, 0, 0, 0, 0];
      mid.set(0, 0, 0); let cnt = 0;
      for (let tri = body.triStart; tri < body.triStart + body.triCount; tri++) {
        a.fromBufferAttribute(pos, idx[3 * tri]).applyMatrix4(chain.matrixWorld);
        b.fromBufferAttribute(pos, idx[3 * tri + 1]).applyMatrix4(chain.matrixWorld);
        c.fromBufferAttribute(pos, idx[3 * tri + 2]).applyMatrix4(chain.matrixWorld);
        n.subVectors(b, a).cross(c.clone().sub(a));   // |n| = 2·area, so n·nᵀ is area²-weighted — fine for a direction
        T[0] += n.x * n.x; T[1] += n.x * n.y; T[2] += n.x * n.z; T[3] += n.y * n.y; T[4] += n.y * n.z; T[5] += n.z * n.z;
        mid.add(a); cnt++;
      }
      mid.multiplyScalar(1 / cnt);
      const pin = topEig(T);
      const r = Math.hypot(mid.x - fx, mid.y - fy);
      const onCone = r < rHi && r > rLo && mid.z > zLo && mid.z < zHi;
      const onDrum = Math.hypot(mid.x - drumC.x, mid.y - drumC.y) < (L.DRUM_R_ACTUAL ?? 10.7) + 2 * L.CHAIN_END_R_OUT + 0.3;
      return { i: Number(body.name.slice(5)), pin, onCone, onDrum, z: mid.z };
    });
    links.sort((p, q) => p.i - q.i);
    let wrapMax = 0, wrapAt = -1, spanMax = 0, coilMax = 0, wrapJoints = 0, spanJoints = 0, coilJoints = 0;
    // The coil control skips the two joints at each of its ends: there the
    // climbing span meets the level coil, and the pin of a link that climbs
    // leans off the drum's axis by the span's own climb angle — the small
    // lean a real chain sheds through exactly this play. The wrap is judged
    // whole, hook to departure.
    const coilIdx = links.map((l, i) => (l.onDrum ? i : -1)).filter((i) => i >= 0);
    const coilInner = new Set(coilIdx.slice(2, Math.max(2, coilIdx.length - 2)));
    for (let i = 0; i + 1 < links.length; i++) {
      const p = links[i].pin, q = links[i + 1].pin;
      const dot = Math.min(1, Math.abs(p[0] * q[0] + p[1] * q[1] + p[2] * q[2]));
      const tw = Math.acos(dot);
      if (links[i].onCone && links[i + 1].onCone) { wrapJoints++; if (tw > wrapMax) { wrapMax = tw; wrapAt = i; } }
      else if (coilInner.has(i) && coilInner.has(i + 1)) { coilJoints++; coilMax = Math.max(coilMax, tw); }
      else if (!links[i].onCone && !links[i + 1].onCone && !links[i].onDrum && !links[i + 1].onDrum) { spanJoints++; spanMax = Math.max(spanMax, tw); }
    }
    rows.push({ t, N: links.length, wrapJoints, wrapMaxDeg: wrapMax * 180 / Math.PI, wrapAt, spanJoints, spanMaxDeg: spanMax * 180 / Math.PI, coilJoints, coilMaxDeg: coilMax * 180 / Math.PI });
  }
  return {
    allowDeg: allow * 180 / Math.PI,
    baseSlope: slopeAt(0), slopeQuarter: slopeAt(0.25), slopeHalf: slopeAt(0.5),
    oneWallSlope: groove.grooveD / (L.CHAIN_PIN_LEN / 2),
    tiltAt: groove.tiltAt ? groove.tiltAt(0) * 180 / Math.PI : null,
    bandSpan: groove.bandSpan, pitch: groove.bandSpan / 2,
    rows,
  };
});
await browser.close();
srv.kill();

console.log(`cone: band ${out.bandSpan.toFixed(4)}, base slope |dr/dz| ${out.baseSlope.toFixed(4)} (one-wall bound grooveD/h = ${out.oneWallSlope.toFixed(3)}), at f=0.25 ${out.slopeQuarter.toFixed(4)}, at f=0.5 ${out.slopeHalf.toFixed(4)}`
  + (out.tiltAt !== null ? `; the cut still carries a tilt law (β(0) = ${out.tiltAt.toFixed(2)}°)` : '; no tilt law on the cut'));
console.log(`joint-play allowance: ${out.allowDeg.toFixed(2)}° per joint (2·CHAIN_RIVET_FIT over the inner pair's stack)`);
let bad = 0;
for (const r of out.rows) {
  const flag = r.wrapMaxDeg > out.allowDeg ? '  ✗ over the allowance' : '  ✓';
  if (r.wrapMaxDeg > out.allowDeg) bad++;
  console.log(`t=${r.t.toFixed(2)}  links ${r.N}  wrap joints ${r.wrapJoints}: worst twist ${r.wrapMaxDeg.toFixed(2)}° at joint ${r.wrapAt}${flag}   | controls: span ${r.spanJoints} joints ${r.spanMaxDeg.toFixed(2)}°, coil ${r.coilJoints} joints ${r.coilMaxDeg.toFixed(2)}°`);
}
// Controls: a straight span and a coil whose pins are parallel to its axis
// must both read inside the allowance, or the instrument is reading something
// other than twist.
const ctrlFail = out.rows.filter((r) => (r.spanJoints > 0 && r.spanMaxDeg > out.allowDeg) || (r.coilJoints > 0 && r.coilMaxDeg > out.allowDeg));
if (ctrlFail.length) { console.error(`CONTROL FAILED: span/coil joints read twist over the allowance at t=${ctrlFail.map((r) => r.t).join(', ')}`); process.exit(2); }
if (!out.rows.some((r) => r.wrapJoints > 0)) { console.error('no wrap joints judged at any tension — the window selected nothing'); process.exit(2); }
if (bad) { console.error(`chain twist: wrap joints over the ${out.allowDeg.toFixed(2)}° allowance at ${bad} of ${out.rows.length} tensions`); process.exit(1); }
console.log('chain twist OK — every wrap joint bends inside its running fit at every tension sampled');
