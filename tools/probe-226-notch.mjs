// TODO 226 step 3b — is the pin on the RIGHT wall? The battery's
// `escapementHandoff` holds the impulse pin within HANDOFF_TRACK_TOL of the
// notch's metal through the passage, and that is all it can hold: the notch is
// closed to the pin plus a shake, and the shake IS that tolerance, so a pin
// centred in the slot, or on the wrong wall, reads "contact" there too. This
// reads the side. In the fork blank's own frame, off the blank's published
// METAL outline and the jewel's published D (`pinOutline`), placed by the
// built groups' world transforms, it measures the pin's gap to EACH wall:
//
//   · through the unlock the pin pushes the wall ahead of it, so it must touch
//     that wall (≤ TOUCH) and stand the whole play (2·shake, less TOUCH) off
//     the other; through the impulse and the run, the wall behind it;
//   · across the crossing (`pinNotch.crossing`) the fork moves from one wall to
//     the other without passing back through the pin: the pin stays inside
//     the slot (both gaps ≥ −TOUCH) and the fraction across never decreases;
//   · past the banking the pin leaves with the play it sat in: its nearest
//     approach to the slot's far wall is 2·shake (the D's flat is solved to
//     exactly that), and nothing of the pin enters the blank;
//   · and the jewel is a D: its flat stands `flatF` off its centre, under the
//     round, and every working contact is on the round (`offRound`, reported).
//
// CONTROLS, which must FAIL the side test (or the test measures nothing): the
// fork re-posed at the pin's BEARING (the step-1 law: the pin centred, a shake
// off both walls), and the fork posed with lead and lag SWAPPED (the pin on
// the wrong wall).
//
// ACCEPTANCE: exits non-zero if any row or either control fails.
import { chromium } from 'playwright';
import { spawn } from 'node:child_process';

const PORT = Number(process.env.PORT || 8482);
const TOUCH = 0.005;   // the tessellation's reach: 5° chords on the jewel (0.0005) and the wall's vertex pitch (≤ shake/10)
const srv = spawn('python3', ['-m', 'http.server', String(PORT), '--bind', '127.0.0.1'],
  { cwd: new URL('..', import.meta.url).pathname, stdio: 'ignore' });
await new Promise((r) => setTimeout(r, 900));
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1100, height: 800 } });
page.setDefaultTimeout(600000);
page.on('pageerror', (e) => console.log('PAGEERROR', String(e)));
await page.goto(`http://127.0.0.1:${PORT}/index.html?schematic=0`, { waitUntil: 'load', timeout: 60000 });
await page.waitForFunction(() => !!window.__clock && window.__clock.boot?.done !== false, null, { timeout: 240000 });
await new Promise((r) => setTimeout(r, 1500));

const out = await page.evaluate(async (TOUCH) => {
  const THREE = await import('three');
  const c = window.__clock, N = c.pinNotch, D = Math.PI / 180;
  c.resetInputs();
  const ent = (n) => c.labelEntries.find((e) => e.name === n).obj;
  const forkG = ent('Pallet fork'), balG = ent('Balance');
  let pin = null;
  balG.traverse((m) => { if (m.name === 'balanceImpulsePin') pin = m; });
  const blank = forkG.children.find((x) => x.userData?.blankOutline);
  const metal = blank.userData.blankMetalOutline;
  const pinOutline = balG.userData?.pinOutline ?? balG.children.map((g) => g.userData?.pinOutline).find(Boolean);
  let D_out = pinOutline;
  if (!D_out) balG.traverse((o) => { if (!D_out && o.userData?.pinOutline) D_out = o.userData.pinOutline; });
  // the slot's two walls: the metal outline's edges within the slot's reach
  const edges = [];
  for (let i = 0, j = metal.length - 1; i < metal.length; j = i++) edges.push([metal[j], metal[i]]);
  const segDist = (p, [a, b]) => {
    const ex = b[0] - a[0], ey = b[1] - a[1], L2 = ex * ex + ey * ey;
    const t = L2 > 0 ? Math.max(0, Math.min(1, ((p[0] - a[0]) * ex + (p[1] - a[1]) * ey) / L2)) : 0;
    return Math.hypot(p[0] - a[0] - t * ex, p[1] - a[1] - t * ey);
  };
  const inside = (p, poly) => {
    let inn = false;
    for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
      const [ax, ay] = poly[j], [bx, by] = poly[i];
      if ((ay > p[1]) !== (by > p[1]) && p[0] < (bx - ax) * (p[1] - ay) / (by - ay) + ax) inn = !inn;
    }
    return inn;
  };
  const wallEdges = (side) => edges.filter(([a, b]) => side * a[0] > 0 && side * b[0] > 0 && Math.abs(a[0]) < N.W + 0.05 && Math.abs(b[0]) < N.W + 0.05
    && -a[1] < N.yBand + 0.01 && -b[1] < N.yBand + 0.01);
  const walls = { [+1]: wallEdges(+1), [-1]: wallEdges(-1) };
  // the pin's D in blank-local 2-D, as posed
  const pinPoly = () => {
    c.scene.updateMatrixWorld(true);
    const M = new THREE.Matrix4().copy(blank.matrixWorld).invert().multiply(pin.matrixWorld);
    const v = new THREE.Vector3();
    return D_out.map(([x, y]) => { v.set(x, y, 0).applyMatrix4(M); return [v.x, v.y]; });
  };
  const gaps = (P) => {
    const g = {};
    for (const s of [+1, -1]) {
      let m = Infinity;
      for (const p of P) for (const e of walls[s]) m = Math.min(m, segDist(p, e));
      g[s] = m;
    }
    // a pin point inside the metal is a burial, its depth the distance to the
    // outline: a support vertex ON the wall lands a float's width either side
    let depth = 0;
    for (const p of P) if (inside(p, metal)) { let m = Infinity; for (const e of edges) m = Math.min(m, segDist(p, e)); depth = Math.max(depth, m); }
    const buried = depth > 1e-6;
    return { plus: g[+1], minus: g[-1], buried, depth };
  };
  const pose = (th, dir, position = 'CU') => c.setPose({ tau: N.tauAt(th, dir), crownPullT: 0, leverEngage: 0, tension: 1, position });
  // re-pose the fork alone: rotation.z = forkBaseAngle − swing, the base read
  // back off the pose the clock just set
  const poseFork = (th, dir, swing) => { forkG.rotation.z = forkG.rotation.z + N.swingAt(th, dir) - swing; };
  // the side the law puts the pin on: unlock (θ < unlockHalf) → the −x wall
  // for a +θ swing, the +x wall after; mirrored for −θ
  const expectSide = (th, dir) => (dir > 0 ? (th <= N.unlockHalf ? -1 : +1) : (-th <= N.unlockHalf ? +1 : -1));
  const rows = [];
  const sideRows = (law, label) => {
    let worstTouch = 0, worstFree = Infinity, n = 0, buried = 0, worstAt = null, maxDepth = 0;
    for (const position of ['CU', 'DU']) {
      for (const dir of [1, -1]) {
        for (let i = 0; i <= 120; i++) {
          const thp = -N.entryHalf * 0.999 + (2 * N.entryHalf * 0.999) * (i / 120);
          if (thp > N.unlockHalf && thp < N.crossing.endHalf) continue;   // the crossing: its own row
          const th = dir * thp;
          pose(th, dir, position);
          if (law) poseFork(th, dir, law(th, dir));
          const g = gaps(pinPoly());
          const side = expectSide(th, dir);
          const touch = side > 0 ? g.plus : g.minus, free = side > 0 ? g.minus : g.plus;
          if (Math.abs(touch) > worstTouch) { worstTouch = Math.abs(touch); worstAt = { th: th / D, dir, position, g }; }
          worstFree = Math.min(worstFree, free);
          if (g.buried) buried++;
          maxDepth = Math.max(maxDepth, g.depth);
          n++;
        }
      }
    }
    return { label, n, worstTouch, worstFree, buried, worstAt, maxDepth };
  };
  const live = sideRows(null, 'the law as posed');
  const centred = sideRows((th) => Math.atan2(N.r * Math.sin(th), N.d - N.r * Math.cos(th)), 'CONTROL: fork at the pin\'s bearing');
  const swapped = sideRows((th, dir) => (dir > 0 ? (th <= N.unlockHalf ? N.lead(th) : N.lag(th)) : (-th <= N.unlockHalf ? -N.lead(-th) : -N.lag(-th))), 'CONTROL: lead and lag swapped');
  // the crossing: inside the slot, monotone
  let crossMinGap = Infinity, crossMono = true, prevU = -Infinity;
  for (let i = 0; i <= 60; i++) {
    const th = N.unlockHalf + (N.crossing.endHalf - N.unlockHalf) * (i / 60);
    pose(th, 1);
    const g = gaps(pinPoly());
    crossMinGap = Math.min(crossMinGap, g.plus, g.minus);
    const sw = N.swingAt(th, 1), u = (sw - N.lag(th)) / (N.lead(th) - N.lag(th));
    if (u < prevU - 1e-9) crossMono = false;
    prevU = u;
  }
  // the exit: banked, the pin climbing out, never nearer the far wall than the play
  let exitMin = Infinity, exitAt = null, exitBuried = false, exitP = null;
  for (let i = 1; i <= 400; i++) {
    const th = N.entryHalf + (85 * D - N.entryHalf) * (i / 400);
    pose(th, 1);
    const P = pinPoly();
    for (const p of P) if (inside(p, metal)) { let m = Infinity; for (const e of edges) m = Math.min(m, segDist(p, e)); if (m > 1e-6) exitBuried = true; }
    let m = Infinity;
    for (const p of P) for (const e of edges) if (e[0][0] < 0 || e[1][0] < 0) m = Math.min(m, segDist(p, e));
    if (m < exitMin) { exitMin = m; exitAt = th / D; exitP = P.reduce((a, b) => (b[0] < a[0] ? b : a)); }
  }
  return { N: { flatF: N.flatF, pinR: N.pinR, shake: N.shake, W: N.W, bank0: N.bank0 / D, bank: N.bank / D, liftHalf: N.liftHalf / D,
      entryHalf: N.entryHalf / D, unlockHalf: N.unlockHalf / D, exitGap: N.exitGap, offRound: N.offRound,
      crossing: { endHalf: N.crossing.endHalf / D, ms: N.crossing.ms, sweptDeg: N.crossing.sweptDeg, I_fork: N.crossing.I_fork, I_wheel: N.crossing.I_wheel, torque: N.crossing.torque } },
    exitP, live, centred, swapped, crossMinGap, crossMono, exitMin, exitAt, exitBuried, wallEdges: [walls[1].length, walls[-1].length] };
}, TOUCH);

await browser.close(); srv.kill();
const N = out.N;
let fails = 0;
const row = (ok, name, val, need) => { if (!ok) fails++; console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}: ${val}${need ? `  (${need})` : ''}`); };
console.log(`pin r ${N.pinR}, D flat ${N.flatF.toFixed(4)} off its centre (${(N.flatF / N.pinR).toFixed(3)} of r); shake ${N.shake}, walls ±${N.W.toFixed(4)}`);
console.log(`let-off ${N.bank0.toFixed(4)}° at θ ${N.liftHalf.toFixed(4)}°, bank ${N.bank.toFixed(4)}°, the pin meets the banked fork at ±${N.entryHalf.toFixed(4)}°, unlock ends at ${N.unlockHalf.toFixed(4)}°`);
console.log(`crossing: ${N.crossing.ms.toFixed(3)} ms, ${N.crossing.sweptDeg.toFixed(3)}° of balance (to ${N.crossing.endHalf.toFixed(3)}°); fork ${N.crossing.I_fork.toExponential(3)} kg·m², train at the escape arbor ${N.crossing.I_wheel.toExponential(3)}, escape torque ${N.crossing.torque.toExponential(3)} N·m`);
console.log(`walls read: ${out.wallEdges[0]} edges at +x, ${out.wallEdges[1]} at −x`);
const L = out.live;
console.log('worst live pose', JSON.stringify(L.worstAt), 'exit leftmost pin point', JSON.stringify(out.exitP));
row(out.wallEdges[0] > 0 && out.wallEdges[1] > 0, 'the slot has two walls to read', `${out.wallEdges.join(' / ')} edges`);
row(L.worstTouch <= TOUCH && L.buried === 0, `the pin on the DRIVING wall over ${L.n} poses (both ways, hanging and dial-flat)`, `worst ${L.worstTouch.toFixed(4)}, ${L.buried} buried (deepest ${L.maxDepth.toExponential(1)})`, `≤ ${TOUCH}`);
row(L.worstFree >= 2 * N.shake - TOUCH, 'and the play off the other wall', `least ${L.worstFree.toFixed(4)}`, `≥ 2·shake − ${TOUCH} = ${(2 * N.shake - TOUCH).toFixed(3)}`);
row(out.crossMinGap >= -1e-9 && out.crossMono, 'across the crossing the pin stays inside the slot and the fork never comes back', `least gap ${out.crossMinGap.toFixed(4)}, monotone ${out.crossMono}`);
row(!out.exitBuried && Math.abs(out.exitMin - 2 * N.shake) <= TOUCH, 'leaving, the banked pin comes no nearer the far wall than the play it sat in', `${out.exitMin.toFixed(4)} at θ ${out.exitAt.toFixed(2)}°`, `2·shake ${2 * N.shake} ± ${TOUCH}`);
row(Math.abs(N.exitGap - 2 * N.shake) < 1e-6 && N.flatF > 0 && N.flatF < N.pinR, 'the D\'s flat is the solve\'s: exit play 2·shake on the solve', `${N.exitGap.toFixed(6)}`);
console.log(`REPORT  the most a working contact lands off the D's round: ${N.offRound.toFixed(5)} (the law follows the D there)`);
const C1 = out.centred, C2 = out.swapped;
row(C1.worstTouch > TOUCH, 'control (must-miss): fork at the pin\'s bearing reads off the driving wall', `${C1.worstTouch.toFixed(4)}`, `> ${TOUCH}`);
row(C2.worstTouch > TOUCH, 'control (must-miss): lead and lag swapped reads off the driving wall', `${C2.worstTouch.toFixed(4)}`, `> ${TOUCH}`);
console.log(fails ? `\n${fails} FAILED` : '\nALL PASS');
process.exit(fails ? 1 : 0);
