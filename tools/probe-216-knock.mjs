// TODO 216 — at what swing does the impulse pin KNOCK? A Swiss lever's balance
// carries the pin round past the fork on every swing; when the swing is large
// enough the pin comes all the way round from the far side and strikes the
// OUTSIDE of the fork's horn, which is still lying banked where the last
// impulse left it. Past that angle the balance cannot swing: it banks on the
// horn. This measures that angle on the CUT METAL — the fork blank's published
// METAL outline (`userData.blankMetalOutline`, the authored outline with the
// chamfer's dilation, read off the extruded ring since TODO 226 step 1) and the
// ruby pin's own mesh, placed by the groups' own world transforms — rather than
// quoting the textbook 360° − λ/2.
//
// Also measured, as its control: the LIFT — the balance arc over which the pin
// sits in the notch while the fork swings bank to bank. The build derives the
// bank from that arc (main.js FORK_BANK_DEG), so the pin must be exactly on the
// notch's centre line at ±λ/2 with the fork at ±bank; a probe that disagreed
// with the build there would be reading the frames wrong, and its knock angle
// would mean nothing.
//
// ACCEPTANCE: prints the lift, both knock angles (counter-clockwise exit and
// clockwise exit, which differ only if the blank is not symmetric) and what
// strikes, and exits non-zero if the control fails or the record main.js
// publishes (EQUALISATION.going.energy.knock, ESCAPEMENT_KNOCK) disagrees with
// this reading — the record solves the outline in layout coordinates, this
// reads it through the built groups' world transforms.
import { chromium } from 'playwright';
import { spawn } from 'node:child_process';

const PORT = Number(process.env.PORT || 8481);
const srv = spawn('python3', ['-m', 'http.server', String(PORT), '--bind', '127.0.0.1'],
  { cwd: new URL('..', import.meta.url).pathname, stdio: 'ignore' });
await new Promise((r) => setTimeout(r, 900));
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1100, height: 800 } });
page.setDefaultTimeout(180000);
page.on('pageerror', (e) => console.log('PAGEERROR', String(e)));
await page.goto(`http://127.0.0.1:${PORT}/index.html?schematic=0`, { waitUntil: 'load', timeout: 60000 });
await page.waitForFunction(() => !!window.__clock && window.__clock.boot?.done !== false, null, { timeout: 120000 });
await new Promise((r) => setTimeout(r, 2500));

const out = await page.evaluate(async () => {
  const THREE = await import('three');
  const clock = window.__clock;
  clock.resetInputs();
  const entry = (n) => clock.labelEntries.find((e) => e.name === n).obj;
  const forkG = entry('Pallet fork'), balG = entry('Balance');
  const blank = forkG.children.find((c) => c.userData?.blankOutline);
  const outline = blank.userData.blankMetalOutline;
  let pin = null;
  balG.traverse((m) => { if (m.isMesh && m.material?.color?.getHexString?.() === 'b01326' && !pin) pin = m; });
  pin.geometry.computeBoundingBox();
  const pb = pin.geometry.boundingBox;
  const pinR = (pb.max.x - pb.min.x) / 2;
  const F = forkG.position, B = balG.position;
  const d = Math.hypot(F.x - B.x, F.y - B.y);
  const uX = (B.x - F.x) / d, uY = (B.y - F.y) / d;          // fork → balance
  const forkBase = Math.atan2(uX, -uY);                       // local −y onto u (layout.js)
  const pinAim = Math.atan2(F.y - B.y, F.x - B.x);            // balance-local +x onto the fork (layout.js)
  const save = { f: forkG.rotation.z, b: balG.rotation.z };

  const v = new THREE.Vector3();
  const pinAt = (theta) => {
    balG.rotation.z = pinAim + theta;
    balG.updateWorldMatrix(true, true);
    pin.getWorldPosition(v);
    return { x: v.x, y: v.y, z: v.z };
  };
  const worldOutline = (psi) => {
    forkG.rotation.z = forkBase + psi;
    forkG.updateWorldMatrix(true, true);
    blank.updateWorldMatrix(true, false);
    return outline.map(([x, y]) => { v.set(x, y, 0).applyMatrix4(blank.matrixWorld); return [v.x, v.y]; });
  };
  const segDist = (px, py, ax, ay, bx, by) => {
    const ex = bx - ax, ey = by - ay, L2 = ex * ex + ey * ey;
    const t = L2 > 0 ? Math.max(0, Math.min(1, ((px - ax) * ex + (py - ay) * ey) / L2)) : 0;
    return Math.hypot(px - ax - t * ex, py - ay - t * ey);
  };
  const inside = (px, py, poly) => {
    let c = false;
    for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
      const [xi, yi] = poly[i], [xj, yj] = poly[j];
      if ((yi > py) !== (yj > py) && px < (xj - xi) * (py - yi) / (yj - yi) + xi) c = !c;
    }
    return c;
  };
  // signed clearance from the pin's surface to the blank's metal (2D: the pin
  // stands in the fork's z band — checked below)
  const clear = (p, poly) => {
    let m = Infinity, at = -1;
    for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
      const s = segDist(p.x, p.y, poly[j][0], poly[j][1], poly[i][0], poly[i][1]);
      if (s < m) { m = s; at = i; }
    }
    return { c: (inside(p.x, p.y, poly) ? -m : m) - pinR, at };
  };
  // Fork axis direction (world) at deflection psi: local −y.
  const axisAt = (psi) => { const a = forkBase + psi; return { x: Math.sin(a), y: -Math.cos(a) }; };
  // LIFT: θ at which the pin centre lies on the fork's centre line, for psi.
  const onAxis = (theta, psi) => {
    const p = pinAt(theta), a = axisAt(psi);
    return (p.x - F.x) * a.y - (p.y - F.y) * a.x;              // cross: 0 on the line
  };
  // the fork's bank, read off the shipped pose law: the most frequent
  // deflection over a beat is the locked dwell
  const hist = new Map();
  for (let k = 0; k < 400; k++) {
    clock.setPose({ tau: k / 400 / 2.5 });
    const dv = +((forkG.rotation.z - forkBase + Math.PI * 3) % (2 * Math.PI) - Math.PI).toFixed(6);
    hist.set(dv, (hist.get(dv) || 0) + 1);
  }
  const top = [...hist.entries()].sort((a, b) => b[1] - a[1]).slice(0, 2).map((e) => e[0]);
  const bank = Math.max(...top.map(Math.abs));
  clock.resetInputs();
  const solveTheta = (psi, lo, hi) => {
    let flo = onAxis(lo, psi);
    for (let k = 0; k < 80; k++) {
      const mid = (lo + hi) / 2, fm = onAxis(mid, psi);
      if ((fm > 0) === (flo > 0)) { lo = mid; flo = fm; } else hi = mid;
    }
    return (lo + hi) / 2;
  };
  // the bank at which the pin exits CCW (θ > 0) is the one whose on-axis θ is positive
  const tA = solveTheta(+bank, -0.6, 0.6), tB = solveTheta(-bank, -0.6, 0.6);
  const exitCCW = tA > 0 ? { psi: +bank, theta: tA } : { psi: -bank, theta: tB };
  const exitCW = tA > 0 ? { psi: -bank, theta: tB } : { psi: +bank, theta: tA };
  const lift = exitCCW.theta - exitCW.theta;

  // KNOCK: fork lying at the bank the pin left it on; carry the pin on round
  // until it first meets the blank's metal.
  const knockFrom = (exit, dir) => {
    const poly = worldOutline(exit.psi);
    let th = exit.theta + dir * 0.05, prev = null, hit = null;
    const step = 0.25 * Math.PI / 180;
    for (; Math.abs(th) < 2 * Math.PI; th += dir * step) {
      const c = clear(pinAt(th), poly);
      if (c.c <= 0) { hit = { th, at: c.at }; break; }
      prev = th;
    }
    if (!hit) return null;
    let lo = prev, hi = hit.th;
    for (let k = 0; k < 60; k++) {
      const mid = (lo + hi) / 2;
      if (clear(pinAt(mid), poly).c <= 0) hi = mid; else lo = mid;
    }
    const at = clear(pinAt(hi), poly).at;
    return { deg: Math.abs(hi) * 180 / Math.PI, vertex: at, local: outline[at] };
  };
  const kCCW = knockFrom(exitCCW, +1), kCW = knockFrom(exitCW, -1);
  // z band: the pin must stand in the fork blank's plane for 2D to be the truth
  const fz = new THREE.Box3().setFromObject(blank), pz = new THREE.Box3().setFromObject(pin);
  forkG.rotation.z = save.f; balG.rotation.z = save.b;
  forkG.updateWorldMatrix(true, true); balG.updateWorldMatrix(true, true);
  const rec = clock.equalisation?.going?.energy?.knock ?? null;
  return {
    d, pinR, rollerR: Math.hypot(pin.position.x, pin.position.y), bankDeg: bank * 180 / Math.PI,
    liftDeg: lift * 180 / Math.PI, exitDeg: [exitCCW.theta * 180 / Math.PI, exitCW.theta * 180 / Math.PI],
    knock: { ccw: kCCW, cw: kCW },
    zBand: { fork: [fz.min.z, fz.max.z], pin: [pz.min.z, pz.max.z] },
    record: rec,
  };
});
console.log(JSON.stringify(out, null, 2));
const f = [];
const ex = out.exitDeg;
if (Math.abs(ex[0] + ex[1]) > 0.05) f.push(`exit angles not symmetric about the line of centres: ${ex.map((x) => x.toFixed(3))}`);
if (!(out.zBand.pin[0] < out.zBand.fork[1] && out.zBand.pin[1] > out.zBand.fork[0])) f.push('the pin does not stand in the fork blank\'s z band — 2D does not hold');
if (!out.knock.ccw || !out.knock.cw) f.push('no knock found within a turn');
const k = Math.min(out.knock.ccw?.deg ?? Infinity, out.knock.cw?.deg ?? Infinity);
console.log(`lift ${out.liftDeg.toFixed(3)}° (bank ±${out.bankDeg.toFixed(3)}°, d ${out.d.toFixed(4)}, roller ${out.rollerR.toFixed(4)}, pin r ${out.pinR.toFixed(4)})`);
console.log(`knock at ${k.toFixed(3)}° (ccw ${out.knock.ccw?.deg.toFixed(3)}, cw ${out.knock.cw?.deg.toFixed(3)}); textbook 360 − λ/2 = ${(360 - out.liftDeg / 2).toFixed(3)}°`);
if (out.record) {
  // the record solves the same outline in layout coordinates; this reads the
  // groups' own world transforms — agreement to a thousandth of a degree says
  // the frames, the bank and the outline are the ones the movement is built of
  if (Math.abs(out.record.deg - k) > 1e-3) f.push(`record knock ${out.record.deg} ≠ measured ${k}`);
  if (Math.abs(out.record.liftDeg - out.liftDeg) > 1e-3) f.push(`record lift ${out.record.liftDeg} ≠ measured ${out.liftDeg}`);
  console.log(`record: knock ${out.record.deg.toFixed(4)}°, lift ${out.record.liftDeg.toFixed(4)}° — ${f.length ? 'DISAGREES' : 'AGREES'}`);
} else f.push('no record to hold (going.energy.knock)');
for (const m of f) console.log('FAIL', m);
await browser.close(); srv.kill();
process.exit(f.length ? 1 : 0);
