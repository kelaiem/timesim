// §221 — THE PHYSICAL SWING, ACCEPTED: does the balance perform the designed
// amplitude, does the escapement it drives still close, and what does the
// safety action do now that it is exercised? ACCEPTANCE: exits non-zero unless
//   · the balance's posed swing is ±AMPLITUDE_POSED_DEG, measured off the
//     mesh over one oscillation (not read back from the constant);
//   · the swing is the SAME at every state of wind — over the `reserve` axis
//     (tension 1 → 0) and over a full run of the arbor — because a fusee
//     delivers level torque (§104), so nothing may sag it;
//   · the pin's travel across the impulse window is the cited LIFT_DEG and
//     the fork's measured swing is the bank the arc-length identity gives,
//     both printed beside their derivations (the entry asked for them at
//     boot; rule 6 keeps boot silent, so they are printed HERE);
//   · the impulse pin stands ON the notch's centreline (to 1e-6), between its
//     walls and reaching past its mouth, at both ends of the impulse window —
//     which is what the bank's derivation is for. (Its first draft matched
//     arcs at the notch FLOOR; this row measured the pin slipping 0.646
//     across the notch and is why the bank is now the pin's own bearing.)
// It REPORTS (TODO 105, never a gate here) the guard pin's clearance to the
// safety roller's own outline over a whole oscillation, sampled finely: at the
// old ±45° the roller's crescent never left the pin, and this is the first
// pose net in which its solid rim passes the pin with the fork at its bank.
//
// Controls: the identity is re-read off the posed meshes, so a window or bank
// that parted from the metal fails here even when both constants agree with
// each other; and the clearance reading is checked on a pose where the answer
// is known — the guard centre placed ON the roller's rim reads −guardR.
//
// Run from tools/:  node probe-221-amplitude.mjs
import { chromium } from 'playwright';
import { spawn } from 'node:child_process';

const ROOT = process.env.ROOT || '..';
const PORT = Number(process.env.PORT || 8541);
const srv = spawn('python3', ['-m', 'http.server', String(PORT), '--bind', '127.0.0.1'],
  { cwd: new URL(ROOT + '/', import.meta.url).pathname, stdio: 'ignore' });
process.on('exit', () => { try { srv.kill(); } catch { /* already gone */ } });
await new Promise((r) => setTimeout(r, 900));
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 900, height: 700 } });
page.setDefaultTimeout(180000);
const bootWarns = [];
page.on('console', (m) => { if (m.type() === 'warning' && !/WebGL|GroupMarker|GL Driver/.test(m.text())) bootWarns.push(m.text()); });
page.on('pageerror', (e) => bootWarns.push('PAGEERROR ' + String(e)));
await page.goto(`http://127.0.0.1:${PORT}/index.html?schematic=0&sync=0`, { waitUntil: 'load', timeout: 120000 });
await page.waitForFunction(() => !!window.__clock, null, { timeout: 180000 });
await new Promise((r) => setTimeout(r, 1000));

const out = await page.evaluate(async () => {
  const THREE = await import('three');
  const L = await import('./src/layout.js');
  const C = window.__clock;
  C.resetInputs();
  const find = (name, key) => { let o = null; C.labelEntries.find((e) => e.name === name).obj.traverse((x) => { if (!o && x.userData?.[key]) o = x; }); return o; };
  const bal = find('Balance', 'safety'), fork = find('Pallet fork', 'safety');
  const balG = C.labelEntries.find((e) => e.name === 'Balance').obj;   // the group the swing is written to
  const BS = bal.userData.safety, FS = fork.userData.safety;
  const beatT = 1 / (2 * L.F_BALANCE), period = 2 * beatT;
  const base = { crownPullT: 0, leverEngage: 0, tension: 1 };
  const pose = (p) => { C.setPose({ ...base, ...p }); C.scene.updateMatrixWorld(true); };
  // the balance's swing angle, read off the mesh: the impulse pin's azimuth
  // about the staff in the balance's PARENT frame, unwrapped
  const pinAz = () => {
    const w = BS.pin.getWorldPosition(new THREE.Vector3());
    const c = balG.getWorldPosition(new THREE.Vector3());
    const inv = new THREE.Matrix4().copy(balG.parent.matrixWorld).invert();
    const a = w.clone().applyMatrix4(inv), b = c.clone().applyMatrix4(inv);
    return Math.atan2(a.y - b.y, a.x - b.x);
  };
  const unwrap = (xs) => { const o = [xs[0]]; for (let i = 1; i < xs.length; i++) { let d = xs[i] - xs[i - 1]; d = Math.atan2(Math.sin(d), Math.cos(d)); o.push(o[i - 1] + d); } return o; };
  const swing = (extra) => {
    const N = 720, az = [];
    for (let i = 0; i < N; i++) { pose({ tau: (i / N) * period, ...extra }); az.push(pinAz()); }
    const u = unwrap(az), mid = (Math.max(...u) + Math.min(...u)) / 2;
    return { half: (Math.max(...u) - Math.min(...u)) / 2, mid, u };
  };
  const ref = swing({});
  const reserve = [1, 0.75, 0.5, 0.25, 0].map((tension) => ({ tension, half: swing({ tension }).half }));
  const winds = [0, 0.5, 1, 2].map((windAccumTurns) => ({ windAccumTurns, half: swing({ windAccumTurns }).half }));

  // the fork's measured swing and the pin's travel across the window
  const forkAng = () => { const q = fork.getWorldQuaternion(new THREE.Quaternion()); return new THREE.Euler().setFromQuaternion(q, 'XYZ').z; };
  let fMin = Infinity, fMax = -Infinity;
  for (let i = 0; i <= 400; i++) { pose({ tau: (i / 400) * period }); const a = forkAng(); fMin = Math.min(fMin, a); fMax = Math.max(fMax, a); }
  const balAt = (tau) => { pose({ tau }); return pinAz(); };
  const w0 = 0, w1 = L.IMPULSE_WIDTH * beatT;
  let liftRad = balAt(w1) - balAt(w0); liftRad = Math.abs(Math.atan2(Math.sin(liftRad), Math.cos(liftRad)));

  // the pin in the notch, in the fork's own frame
  const pinInFork = (tau) => {
    pose({ tau });
    const p = BS.pin.getWorldPosition(new THREE.Vector3()).applyMatrix4(new THREE.Matrix4().copy(fork.matrixWorld).invert());
    const { halfW, floorY, mouthY } = FS.notch;
    // ON the centreline is what the bank is derived for; between the walls and
    // reaching past the mouth is what being in the notch means for the metal
    return { tau, x: p.x, y: p.y, halfW, floorY, mouthY, pinR: BS.pinR,
             onLine: Math.abs(p.x) < 1e-6, between: Math.abs(p.x) + BS.pinR <= halfW, reaches: p.y - BS.pinR < mouthY && p.y >= mouthY - BS.pinR };
  };
  const notch = [pinInFork(w0 + 1e-9), pinInFork(w1 - 1e-9), pinInFork(beatT + w0 + 1e-9), pinInFork(beatT + w1 - 1e-9)];

  // the guard pin against the safety roller's outline, in the balance frame
  const poly = BS.outline;
  const segDist = (px, py) => {
    let d = Infinity, inside = false;
    for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
      const [ax, ay] = poly[j], [bx, by] = poly[i];
      const vx = bx - ax, vy = by - ay, t = Math.max(0, Math.min(1, ((px - ax) * vx + (py - ay) * vy) / (vx * vx + vy * vy || 1)));
      d = Math.min(d, Math.hypot(px - ax - t * vx, py - ay - t * vy));
      if ((ay > py) !== (by > py) && px < ax + ((py - ay) * (bx - ax)) / (by - ay)) inside = !inside;
    }
    return inside ? -d : d;
  };
  const rollerBox = new THREE.Box3().setFromObject(BS.roller), guardBox = new THREE.Box3().setFromObject(FS.guard);
  const zOverlap = guardBox.max.z > rollerBox.min.z && guardBox.min.z < rollerBox.max.z;
  const clearance = (tau) => {
    pose({ tau });
    const g = FS.guard.getWorldPosition(new THREE.Vector3()).applyMatrix4(new THREE.Matrix4().copy(BS.roller.matrixWorld).invert());
    return segDist(g.x, g.y) - FS.guardR;
  };
  const rows = []; let worst = { c: Infinity };
  const NG = 2000;
  for (let i = 0; i < NG; i++) {
    const tau = (i / NG) * period, c = clearance(tau);
    if (c < worst.c) worst = { c, tau, deg: (ref.u[Math.round((i / NG) * 720) % 720] - ref.mid) * 180 / Math.PI };
    rows.push(c);
  }
  // control: a point ON the outline reads exactly −guardR
  const [cx, cy] = poly[Math.floor(poly.length / 3)];
  const control = segDist(cx, cy) - FS.guardR;
  C.resetInputs();
  return {
    A: L.AMPLITUDE_POSED_DEG, LIFT: L.LIFT_DEG, IW: L.IMPULSE_WIDTH,
    halfDeg: ref.half * 180 / Math.PI, reserve: reserve.map((r) => ({ ...r, deg: r.half * 180 / Math.PI })), winds: winds.map((r) => ({ ...r, deg: r.half * 180 / Math.PI })),
    bankMeasDeg: (fMax - fMin) / 2 * 180 / Math.PI, liftMeasDeg: liftRad * 180 / Math.PI,
    rollerR: bal.userData.rollerR, notch,
    guard: { zOverlap, min: worst.c, at: worst, max: Math.max(...rows), control, guardR: FS.guardR },
  };
});
await browser.close();

const fails = [];
const row = (name, ok, detail) => { console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? ' — ' + detail : ''}`); if (!ok) fails.push(name); };
console.log(`IMPULSE_WIDTH = (2/π)·asin(LIFT_DEG / 2A) = (2/π)·asin(${out.LIFT} / ${2 * out.A}) = ${out.IW.toFixed(5)} of a beat`);
console.log(`FORK_BANK_DEG = atan(rollerR·sin(LIFT/2) / (D − rollerR·cos(LIFT/2))), measured off the posed fork: ±${out.bankMeasDeg.toFixed(3)}° (lever angle ${(2 * out.bankMeasDeg).toFixed(2)}°)`);
row(`the balance swings ±AMPLITUDE_POSED_DEG, off the mesh`, Math.abs(out.halfDeg - out.A) < 0.05, `±${out.halfDeg.toFixed(3)}° against ${out.A}°`);
const spread = (rs) => Math.max(...rs.map((r) => r.deg)) - Math.min(...rs.map((r) => r.deg));
row('the swing does not sag over the reserve (a fusee is level)', spread(out.reserve) < 1e-6, out.reserve.map((r) => `${r.tension}: ${r.deg.toFixed(4)}°`).join(', '));
row('nor over the arbor\'s run', spread(out.winds) < 1e-6, out.winds.map((r) => `${r.windAccumTurns} turns: ${r.deg.toFixed(4)}°`).join(', '));
row('the pin travels the cited lift across the impulse window', Math.abs(out.liftMeasDeg - out.LIFT) < 0.05, `${out.liftMeasDeg.toFixed(3)}° against LIFT_DEG ${out.LIFT}°`);
for (const n of out.notch)
  row(`impulse pin on the notch's centreline, between its walls and past its mouth, at τ ${n.tau.toFixed(5)}`, n.onLine && n.between && n.reaches,
    `fork-local (${n.x.toExponential(2)}, ${n.y.toFixed(3)}), pin r ${n.pinR.toFixed(3)}; walls ±${n.halfW.toFixed(3)}, mouth ${n.mouthY.toFixed(3)}, floor ${n.floorY.toFixed(3)}`);
const n0 = out.notch[0];
console.log(`report · at the window's edge the pin's centre stands ${(n0.mouthY - n0.y).toFixed(3)} OUTSIDE the notch's mouth, so its body enters ${(n0.pinR - (n0.mouthY - n0.y)).toFixed(3)} of a notch ${(n0.floorY - n0.mouthY).toFixed(3)} deep — it works at the mouth`);
row('control: a point on the roller\'s outline reads −guardR', Math.abs(out.guard.control + out.guard.guardR) < 1e-9, out.guard.control.toFixed(6));
console.log(`report · TODO 105 · guard pin ⇄ safety roller (z bands ${out.guard.zOverlap ? 'OVERLAP — the pin can meet the roller' : 'apart'}): `
  + `min ${out.guard.min.toFixed(4)} at τ ${out.guard.at.tau.toFixed(4)} s (balance at ${out.guard.at.deg.toFixed(1)}°), max ${out.guard.max.toFixed(4)}; was 0.2356–0.7455 over a beat at ±45°`);
row('boot silent', bootWarns.length === 0, bootWarns.join(' | '));
console.log(fails.length ? `\nFAIL — ${fails.length}: ${fails.join('; ')}` : '\nPASS — the balance performs the swing the movement is designed to');
process.exit(fails.length ? 1 : 0);
