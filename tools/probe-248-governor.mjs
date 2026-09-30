// §248 — IS THE GOVERNOR ANCHOR DRIVEN BOTH WAYS, ON THE BUILT METAL?
// Acceptance: exits non-zero on any failed claim. §113's exit pallet was A's
// MIRROR, which is A's drive run backwards in time: over B's half-swing the
// contact would have had to travel against the wheel, so the anchor was POSED
// back to +h by the law while no tooth pushed it — and every gate stayed green,
// because the cycle sweep asks whether metal overlaps, never whether a contact
// pushes. This probe asks the second question of the cut meshes, not of the
// solve that cut them. Over two tooth periods of the alarmStrike axis:
//   1. boot silent (standing rule 6);
//   2. CONTACT — every sample has a saw tip within TOUCH (0.002) of at most one stone;
//      the samples in contact with A and with B each cover the published drive
//      fraction of the period (±0.05), so both halves of the swing are ridden;
//   3. PUSH — at every contact sample the touching tip moves INTO the stone's
//      body (its velocity against the stone's inward edge normal is positive):
//      the tooth drives the anchor, the anchor does not drive the tooth;
//   4. CLEAN — no tip stands inside either stone deeper than the working-contact
//      grade the boot sweep holds (0.02);
//   (tips are the saw's vertices on its tip circle about the saw's own axis)
//   5. CONTROLS, without which 2–4 are unfounded: (a) the same push test on the
//      time-reversed wheel (tip velocity negated) must FAIL on both stones —
//      that is exactly what §113's mirrored B was; (b) the anchor turned 0.02 rad
//      off its law must read a tip BURIED past the grade.
// cd tools && node probe-248-governor.mjs (exit 1 on any claim)
import { chromium } from 'playwright';
import { spawn } from 'node:child_process';

// TOUCH is a fifth of the tip travel between samples (a pitch of 1.885 u over 200
// samples per period is 0.0094 u), so a tip that has just LEFT a face — the
// first sample of a drop — cannot be mistaken for one riding it.
const PORT = 8495, TOUCH = 0.002, GRADE = 0.02;
const srv = spawn('python3', ['-m', 'http.server', String(PORT), '--bind', '127.0.0.1'], { cwd: '..', stdio: 'ignore' });
await new Promise((r) => setTimeout(r, 900));
const browser = await chromium.launch();
const page = await browser.newPage();
const warns = [];
page.on('pageerror', (e) => warns.push('PAGEERROR ' + String(e)));
await page.goto(`http://127.0.0.1:${PORT}/index.html`, { waitUntil: 'load', timeout: 120000 });
await page.waitForFunction(() => !!window.__clock || !!window.__bootError, null, { timeout: 180000 });

const res = await page.evaluate(async ([TOUCH]) => {
  const THREE = await import('three');
  const clock = window.__clock;
  if (!clock) return { err: String(window.__bootError) };
  const c = clock.equalisation.alarm.cadence;
  const tps = c.teethPerStrike, driveFrac = c.driveArcRad / (2 * Math.PI / c.escapement.sawTeeth);
  const find = (unit, name) => {
    const out = [];
    clock.labelEntries.find((e) => e.name === unit).obj.traverse((o) => { if (o.isMesh && o.name === name) out.push(o); });
    return out;
  };
  const [saw] = find('Alarm governor', 'alarmGovSaw');
  const stones = find('Alarm governor anchor', 'alarmGovPallet');      // built A then B
  const pivot = stones[0].parent;
  const v = new THREE.Vector3();
  const worldXY = (m) => {
    m.updateWorldMatrix(true, false);
    const p = m.geometry.attributes.position, out = [];
    for (let i = 0; i < p.count; i++) { v.fromBufferAttribute(p, i).applyMatrix4(m.matrixWorld); out.push([v.x, v.y]); }
    return out;
  };
  const hull = (pts) => {                                               // monotone chain, CCW
    const s = [...pts].sort((a, b) => a[0] - b[0] || a[1] - b[1]);
    const cr = (o, a, b) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
    const lo = [], hi = [];
    for (const p of s) { while (lo.length >= 2 && cr(lo[lo.length - 2], lo[lo.length - 1], p) <= 1e-12) lo.pop(); lo.push(p); }
    for (const p of s.reverse()) { while (hi.length >= 2 && cr(hi[hi.length - 2], hi[hi.length - 1], p) <= 1e-12) hi.pop(); hi.push(p); }
    return lo.slice(0, -1).concat(hi.slice(0, -1));
  };
  // signed distance of a point to a CCW convex polygon (negative = inside) and the inward normal of the nearest edge
  const sdist = (q, P) => {
    let best = Infinity, inside = true, nIn = null;
    for (let i = 0; i < P.length; i++) {
      const a = P[i], b = P[(i + 1) % P.length], dx = b[0] - a[0], dy = b[1] - a[1], L = Math.hypot(dx, dy);
      if ((dx * (q[1] - a[1]) - dy * (q[0] - a[0])) < 0) inside = false;
      const t = Math.max(0, Math.min(1, ((q[0] - a[0]) * dx + (q[1] - a[1]) * dy) / (L * L)));
      const d = Math.hypot(q[0] - a[0] - t * dx, q[1] - a[1] - t * dy);
      if (d < best) { best = d; nIn = [-dy / L, dx / L]; }
    }
    return { d: inside ? -best : best, nIn };
  };
  const tipsAt = () => {
    const pts = worldXY(saw);
    saw.parent.getWorldPosition(v);                                      // the saw's own axis, not a vertex average
    const cx = v.x, cy = v.y;
    const rMax = Math.max(...pts.map((p) => Math.hypot(p[0] - cx, p[1] - cy)));
    const tips = pts.filter((p) => Math.hypot(p[0] - cx, p[1] - cy) > rMax - 1e-3);
    return { tips, all: pts };
  };
  const pose = (phase, offset = 0) => {
    clock.setPose({ tau: 0.13, crownPullT: 0, leverEngage: 0, tension: 1, windAccumTurns: 0,
      alarmStrikePhase: phase, alarmOn: 1, alarmReleased: 1 });
    if (offset) pivot.rotation.z += offset;
    pivot.updateWorldMatrix(true, true);
  };
  clock.resetInputs();
  const P0 = 14.2, K = 400, dP = 1e-5 / tps, rows = [];
  let deepest = 0, controlDeepest = 0;
  for (let k = 0; k < K; k++) {
    const phase = P0 + 2 * (k / K) / tps;
    pose(phase);
    const polys = stones.map((m) => hull(worldXY(m)));
    const { tips, all } = tipsAt();
    for (const P of polys) for (const q of all) deepest = Math.max(deepest, -sdist(q, P).d);
    const touch = polys.map((P) => {
      let best = null;
      tips.forEach((q, i) => { const s = sdist(q, P); if (!best || Math.abs(s.d) < Math.abs(best.s.d)) best = { i, q, s }; });
      return best;
    });
    pose(phase + dP);
    const tips2 = tipsAt().tips;
    const row = { k, touching: [] };
    touch.forEach((t, si) => {
      if (Math.abs(t.s.d) > TOUCH) return;
      const q2 = tips2.reduce((b, p) => (!b || Math.hypot(p[0] - t.q[0], p[1] - t.q[1]) < Math.hypot(b[0] - t.q[0], b[1] - t.q[1]) ? p : b), null);
      const vel = [q2[0] - t.q[0], q2[1] - t.q[1]];
      row.touching.push({ stone: si ? 'B' : 'A', push: vel[0] * t.s.nIn[0] + vel[1] * t.s.nIn[1] });
    });
    rows.push(row);
    if (k % 20 === 0) {                                                  // control (b): the anchor off its law
      pose(phase, 0.02);
      const pc = stones.map((m) => hull(worldXY(m)));
      for (const P of pc) for (const q of tipsAt().all) controlDeepest = Math.max(controlDeepest, -sdist(q, P).d);
    }
  }
  clock.resetInputs();
  return { bootWarns: clock.bootWarns, driveFrac, rows, deepest, controlDeepest, esc: c.escapement };
}, [TOUCH]);

let fails = 0;
const claim = (ok, text) => { console.log(`${ok ? 'PASS' : 'FAIL'}  ${text}`); if (!ok) fails++; };
if (res.err) { console.log('boot died:', res.err); process.exit(1); }
claim(res.bootWarns.length === 0 && warns.length === 0, `1. boot silent (${res.bootWarns.length + warns.length} warnings)`);
const n = res.rows.length;
const both = res.rows.filter((r) => r.touching.length > 1).length;
const fracA = res.rows.filter((r) => r.touching.some((t) => t.stone === 'A')).length / n;
const fracB = res.rows.filter((r) => r.touching.some((t) => t.stone === 'B')).length / n;
claim(both === 0, `2a. never both stones touching at once (${both} samples)`);
claim(Math.abs(fracA - res.driveFrac) < 0.05 && Math.abs(fracB - res.driveFrac) < 0.05,
  `2b. each stone ridden for its drive: A ${fracA.toFixed(3)}, B ${fracB.toFixed(3)} of the period vs the published ${res.driveFrac.toFixed(3)}`);
const contacts = res.rows.flatMap((r) => r.touching);
const pulls = { A: 0, B: 0 }, reversedPush = { A: 0, B: 0 }, count = { A: 0, B: 0 };
for (const t of contacts) { count[t.stone]++; if (!(t.push > 0)) pulls[t.stone]++; if (-t.push > 0) reversedPush[t.stone]++; }
claim(pulls.A === 0 && pulls.B === 0, `3. every contact PUSHES into its stone (pulls: A ${pulls.A}/${count.A}, B ${pulls.B}/${count.B})`);
claim(res.deepest <= GRADE, `4. clean: deepest saw point inside a stone ${res.deepest.toFixed(4)} ≤ ${GRADE}`);
claim(reversedPush.A === 0 && reversedPush.B === 0 && count.A > 0 && count.B > 0,
  `5a. control — the time-reversed wheel pushes nowhere (A ${reversedPush.A}, B ${reversedPush.B} pushes): the test tells a drive from a pose`);
claim(res.controlDeepest > GRADE, `5b. control — the anchor 0.02 rad off its law buries a tooth ${res.controlDeepest.toFixed(4)} > ${GRADE}`);
console.log('escapement', JSON.stringify(res.esc));
await browser.close(); srv.kill();
process.exit(fails ? 1 : 0);
