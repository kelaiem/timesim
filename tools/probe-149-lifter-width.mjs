// TODO 149 — HOW WIDE CAN THE MINUTE JUMPER'S LIFTER LINK GET, AND ON WHICH
// SIDE? A REPORT.
//
// §54 read the lifter at λ 52.9 (29.10 u of span on a 0.55 u width) and the
// row was waived against TODO 149, whose triage called the section SHORT. The
// ceiling wants the width at L/30 = 0.970, i.e. +0.420 across. The question
// this answers is whether the movement HAS that 0.420 anywhere, and it is a
// DIFFERENT question from the one that triage measured.
//
// WHAT IT FOUND, and what the item did with it: BOTH faces saturate the 6 u
// search — 2.27 mm of free in-plane corridor per side, against 0.420 u
// wanted. The triage had been wrong, and wrong for a reason worth keeping:
// two of the three gaps it ranked cannot be closed by WIDTH at all (see
// below). The bar is 1.1495 u wide now, solved from the ceiling rather than
// from the corridor, and this probe is what says the corridor never had an
// opinion. Re-run it if the jumper's station or the setting lever's stroke
// moves; the numbers in the item are this file's output.
//
// WHICH PROBES THIS IS NOT.
//   · `probe-section-headroom.mjs` (TODO 109 step 2) ranks each over-ceiling
//     bar's nearest cross-unit metal over the pose net and prints the gap. It
//     is ISOTROPIC by construction — it reports `growth per side` as half the
//     total because it cannot tell one side from the other, and its own header
//     says it reports arithmetic rather than intent. For the lifter it named
//     `Case / caseMiddle` at 0.2953 (spare 0.1453 against 0.2101 wanted) and
//     called the row SHORT. That verdict assumes the bar grows symmetrically.
//     A flat bar in a plane has two sides and they are not the same side.
//   · `probe-234-stem-ceiling.mjs` and `probe-234-shaft-body-corridor.mjs`
//     price a ROUND shaft's free RADIUS — one number per station, because a
//     cylinder has no sides. This bar is flat and its two faces answer
//     separately.
//   · `probe-171-corridor.mjs` scans where a riser may STAND (a position), not
//     how far a member's face may move (a section).
//
// WHAT IT MEASURES. The lifter is cut at unit length and stretched onto its
// span each frame (`scale.x`), so its local frame is: +x along the bar, +y the
// in-plane width, +z the plane normal. This grows the +y and −y faces
// INDEPENDENTLY and binary-searches each one's limit, over the pose net, for
// the largest growth at which the grown solid still clears every mesh outside
// the Minute jumper unit by CLEAR_MARGIN. It names the binding neighbour at
// each limit, and prints the whole neighbour table rather than the winner.
//
// WHAT COUNTS AS A WALL, DERIVED RATHER THAN ASSERTED. The bar's slot rides
// the setting lever's tail post, which measures 0.0000 to it by design — the
// ground-is-not-an-obstacle trap, and excluding "the Setting lever" wholesale
// would also excuse the lever BODY, which is a real wall. So a mesh is treated
// as a JOINT only if it already measures within JOINT_EPS of the SHIPPED bar
// at that pose; every one is printed, so the exclusion is checkable.
//
// THE PROXY, AND THE CONTROL THAT MAKES IT EVIDENCE. Growth is measured on a
// proxy box carrying the shipped bar's own `matrixWorld` (which already holds
// the span in `scale.x`), not on the bar itself — patching the tree would cost
// a 25 s boot per candidate. A proxy is only worth what its control is:
//   · IDENTITY (the load-bearing one) — at the SHIPPED offsets the proxy must
//     reproduce the real `jumperLifter`'s clearance to every neighbour, at
//     every pose, to 1e-4. If the frame or the scale were wrong the numbers
//     would part, and a headroom table built on a misplaced proxy reads
//     exactly like a correct one.
//   · MUST-HIT — grown past the whole movement (MUSTHIT_G u per side, wider
//     than the case) the proxy must reach 0 clearance against something. A
//     predicate that can never fail has not measured a limit. It is a
//     SEPARATE growth from the search's bound on purpose: the first draft of
//     this probe reused the bound (12 u) and the control FAILED at 0.0890 —
//     not because the apparatus was broken but because 12 u of sideways
//     growth genuinely touches nothing here, which is the finding. A control
//     that has to be satisfied by the answer is not a control.
//   · MONOTONE — clearance to the binding neighbour must not RISE as that side
//     grows. If it does, the growth is not going where the frame says it is.
//
// A REPORT (§40): it prints and exits 0. The verdict is the reader's.
// (INDEX.md's `kind` column says acceptance because the classifier keys on
// `process.exit`, and this exits only when the bar it measures is not in the
// scene at all — the §234 probes carry the same label for the same reason.)
//
// Usage: cd tools && node probe-149-lifter-width.mjs [out.json]
//        SAMPLES=5 node probe-149-lifter-width.mjs
import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import { writeFileSync } from 'node:fs';

const PORT = process.env.PORT || 8536;
const SAMPLES = +(process.env.SAMPLES || 5);
const srv = spawn('python3', ['-m', 'http.server', String(PORT), '--bind', '127.0.0.1'], { cwd: '..', stdio: 'ignore' });
process.on('exit', () => { try { srv.kill(); } catch { /* already gone */ } });
await new Promise((r) => setTimeout(r, 900));
const browser = await chromium.launch();
const page = await browser.newPage();
page.on('pageerror', (e) => console.error('PAGEERROR', String(e)));
await page.goto(`http://127.0.0.1:${PORT}/index.html?hud=0&sync=0`, { waitUntil: 'load', timeout: 120000 });
await page.waitForFunction(() => !!window.__clock, null, { timeout: 120000 });

const V = await page.evaluate(async ({ SAMPLES }) => {
  const THREE = await import('./vendor/three.module.js');
  const I = await import('./src/inspect.js');
  const { CLEAR_MARGIN, UNIT_MM, SLENDER_MAX } = await import('./src/layout.js');
  const clock = window.__clock;

  const UNIT = 'Minute jumper';
  const BAR = 'jumperLifter';
  const SEARCH = 3.0;      // u — beyond this nothing can become a wall at any width this row wants
  const GROSS = 6.0;       // u — the search's bound: ~14x the growth the ceiling asks for. A limit
                           // that reaches it is reported SATURATED rather than quoted, because the
                           // claim this probe owes is "at least this much", not a number to build to
  const MUSTHIT_G = 80.0;  // u — wider than the case: this growth MUST touch, or the predicate is blind
  const JOINT_EPS = 1e-3;  // a mesh already touching the shipped bar is a joint, not a wall
  const TOL = 1e-4;        // the identity control's agreement

  // ---- the census: every mesh, attributed to its nearest labelled ancestor
  // (§40's rule; without it a mesh inside two labelled subtrees is counted
  // twice and the second row names a part that does not move), schematic
  // subtrees pruned (§71).
  const unitObj = new Map(clock.labelEntries.map((e) => [e.name, e.obj]));
  const hops = (mesh, name) => { const t = unitObj.get(name); let n = 0;
    for (let o = mesh; o; o = o.parent, n++) if (o === t) return n; return Infinity; };
  const byMesh = new Map();
  const walk = (o, unitName) => {
    if (o.userData && o.userData.schematic) return;
    if (o.isMesh && o.geometry?.attributes?.position) {
      const prev = byMesh.get(o);
      if (!prev || hops(o, unitName) < hops(o, prev.unit)) byMesh.set(o, { unit: unitName, mesh: o });
    }
    for (const c of o.children) walk(c, unitName);
  };
  for (const e of clock.labelEntries) walk(e.obj, e.name);
  const all = [...byMesh.values()];

  let bar = null;
  for (const e of all) if (e.unit === UNIT && e.mesh.name === BAR) bar = e.mesh;
  if (!bar) return { fatal: `no mesh named ${BAR} in unit ${UNIT} — the bar was renamed or re-parented` };
  const P = bar.geometry.parameters;            // the CUT section, read from the construction
  const W0 = P.height, T0 = P.depth;            // 0.55 in-plane, JMP_LIFTER_T through
  const others = all.filter((e) => e.unit !== UNIT);

  // ---- the proxy. Its geometry is the bar's box with the two y faces moved
  // to yLo/yHi; its world matrix IS the bar's, which already carries the span
  // in scale.x, so x is untouched and only the width changes.
  const _m = new THREE.Matrix4();
  let _proxy = null;
  const proxyAt = (yLo, yHi) => {
    if (_proxy) { _proxy.geometry.dispose(); }
    const g = new THREE.BoxGeometry(1, yHi - yLo, T0);
    g.translate(0, (yHi + yLo) / 2, 0);
    if (!_proxy) { _proxy = new THREE.Mesh(g); _proxy.matrixAutoUpdate = false; }
    else _proxy.geometry = g;
    _proxy.matrix.copy(_m);
    _proxy.matrixWorld.copy(_m);
    return _proxy;
  };
  const syncFrame = () => { _m.copy(bar.matrixWorld); };

  // ---- the pose net, entered canonically (TODO 54) so a pose cannot inherit
  // the tail of the axis declared above it.
  const axes = I.resolveAxes();
  const poses = [];
  for (const ax of axes) for (let i = 0; i < SAMPLES; i++)
    poses.push({ axis: ax.name, f: SAMPLES === 1 ? 0 : i / (SAMPLES - 1), ax });

  // ---- per pose: the near set, the joints, and each side's limit.
  const _bA = new THREE.Box3(), _bB = new THREE.Box3();
  const perPose = [];
  const identity = [];        // the control: proxy-at-shipped vs the real bar
  let monotoneFails = 0, monotoneTested = 0;
  let mustHit = null;
  const neighbourWorst = new Map();   // label -> { d, pose } over the whole net, at the shipped width

  for (const p of poses) {
    I.enterAxis(clock);
    clock.setPose(p.ax.pose(p.f));
    clock.scene.updateMatrixWorld(true);
    syncFrame();

    // Prune to what can matter: anything whose box is within SEARCH of the
    // bar's box GROWN by the gross amount (a mesh 2 u to the side is not near
    // the shipped bar but is very much a wall for a grown one).
    _bA.setFromObject(bar).expandByScalar(SEARCH + GROSS);
    const near = [];
    for (const c of others) {
      _bB.setFromObject(c.mesh);
      if (_bA.intersectsBox(_bB)) near.push(c);
    }

    // Joints and the identity control, both read at the SHIPPED offsets.
    const shipped = proxyAt(-W0 / 2, W0 / 2);
    const joints = [], walls = [];
    for (const c of near) {
      const dProxy = I.meshClearance(shipped, c.mesh, SEARCH);
      const dReal = I.meshClearance(bar, c.mesh, SEARCH);
      const label = `${c.unit} / ${c.mesh.name || '(unnamed)'}`;
      if (Math.abs(dProxy - dReal) > TOL)
        identity.push({ pose: `${p.axis} f=${p.f}`, neighbour: label, proxy: +dProxy.toFixed(5), real: +dReal.toFixed(5) });
      const prev = neighbourWorst.get(label);
      if (!prev || dReal < prev.d) neighbourWorst.set(label, { d: dReal, pose: `${p.axis} f=${p.f}` });
      (dReal <= JOINT_EPS ? joints : walls).push({ c, label, d: dReal });
    }

    // The must-hit control, once: grown past the case the proxy must touch.
    if (mustHit === null && walls.length) {
      const gross = proxyAt(-W0 / 2 - MUSTHIT_G, W0 / 2 + MUSTHIT_G);
      let d = Infinity, who = null;
      for (const w of walls) { const x = I.meshClearance(gross, w.c.mesh, SEARCH); if (x < d) { d = x; who = w.label; } }
      mustHit = { ok: d <= 1e-6, measured: +d.toFixed(5), neighbour: who, grownBy: MUSTHIT_G,
        why: `a proxy grown ${MUSTHIT_G} u per side is wider than the case and must reach 0 against something` };
    }

    // Each side's limit, independently: the largest growth at which every wall
    // still clears by CLEAR_MARGIN. The other face is held at the shipped
    // offset, so the two numbers are the two sides and not one blended number.
    const clearAt = (yLo, yHi) => {
      const q = proxyAt(yLo, yHi);
      let d = Infinity, who = null;
      for (const w of walls) { const x = I.meshClearance(q, w.c.mesh, SEARCH); if (x < d) { d = x; who = w.label; } }
      return { d, who };
    };
    const limit = (sign) => {
      const at = (g) => sign > 0 ? clearAt(-W0 / 2, W0 / 2 + g) : clearAt(-W0 / 2 - g, W0 / 2);
      if (at(0).d < CLEAR_MARGIN - 1e-9) return { g: 0, binding: at(0).who, note: 'the shipped bar is already inside the margin here' };
      let lo = 0, hi = GROSS;
      if (at(hi).d >= CLEAR_MARGIN) return { g: hi, binding: null, saturated: true, note: `SATURATED — no wall within ${GROSS} u of growth on this side` };
      for (let i = 0; i < 22; i++) { const mid = (lo + hi) / 2; if (at(mid).d >= CLEAR_MARGIN) lo = mid; else hi = mid; }
      const b = at(Math.min(hi, GROSS));
      // MONOTONE: growing further must not open the gap to the binding wall.
      monotoneTested++;
      const dNear = at(lo).d, dFar = at(Math.min(lo + 0.25, GROSS)).d;
      if (dFar > dNear + 1e-6) monotoneFails++;
      return { g: lo, binding: b.who, saturated: false, note: null };
    };
    const pos = limit(+1), neg = limit(-1);
    perPose.push({ pose: `${p.axis} f=${+p.f.toFixed(3)}`, span: +bar.scale.x.toFixed(4),
      plus: { g: +pos.g.toFixed(4), binding: pos.binding, saturated: !!pos.saturated, note: pos.note },
      minus: { g: +neg.g.toFixed(4), binding: neg.binding, saturated: !!neg.saturated, note: neg.note },
      joints: joints.map((j) => j.label), walls: walls.length });
  }

  // ---- the net's verdict: each side's limit is the MINIMUM over the poses.
  const worst = (side) => perPose.reduce((a, b) => (b[side].g < a[side].g ? b : a));
  const wp = worst('plus'), wm = worst('minus');
  const spans = perPose.map((r) => r.span);
  const spanMax = Math.max(...spans);
  const wanted = spanMax / SLENDER_MAX;           // the width the ceiling asks for at the LONGEST span

  return {
    clearMargin: CLEAR_MARGIN, unitMm: UNIT_MM, slenderMax: SLENDER_MAX,
    axes: axes.length, samplesPerAxis: SAMPLES, poses: poses.length,
    bar: { unit: UNIT, mesh: BAR, width_u: W0, thick_u: T0,
      spanMin_u: +Math.min(...spans).toFixed(4), spanMax_u: +spanMax.toFixed(4),
      lambdaNow: +(spanMax / W0).toFixed(1) },
    wanted: { width_u: +wanted.toFixed(4), width_mm: +(wanted * UNIT_MM).toFixed(4),
      growTotal_u: +(wanted - W0).toFixed(4) },
    limits: {
      plus: { g: wp.plus.g, binding: wp.plus.binding, atPose: wp.pose, saturated: wp.plus.saturated },
      minus: { g: wm.minus.g, binding: wm.minus.binding, atPose: wm.pose, saturated: wm.minus.saturated },
      totalAvailable_u: +(wp.plus.g + wm.minus.g).toFixed(4),
      searchBound_u: GROSS,
    },
    neighbours: [...neighbourWorst.entries()].sort((a, b) => a[1].d - b[1].d)
      .map(([label, v]) => ({ neighbour: label, closest_u: +v.d.toFixed(4), atPose: v.pose,
        joint: v.d <= JOINT_EPS })),
    controls: {
      identity: { ok: identity.length === 0, disagreements: identity.length, worst: identity.slice(0, 4),
        why: 'the proxy at the shipped offsets must reproduce the real bar\'s clearance to every neighbour at every pose' },
      mustHit, monotone: { ok: monotoneFails === 0, tested: monotoneTested, failed: monotoneFails,
        why: 'clearance to the binding wall must not rise as that side grows' },
    },
    perPose,
  };
}, { SAMPLES });

await browser.close();
srv.kill();

if (V.fatal) { console.error(V.fatal); process.exit(1); }
const out = process.argv[2];
if (out) writeFileSync(out, JSON.stringify(V, null, 2));

const u = (x) => `${x.toFixed(4)} u (${(x * V.unitMm).toFixed(4)} mm)`;
console.log(`${V.bar.unit} / ${V.bar.mesh} — ${V.axes} axes × ${V.samplesPerAxis} samples = ${V.poses} poses; CLEAR_MARGIN ${V.clearMargin} u\n`);
console.log(`  span ${V.bar.spanMin_u} … ${V.bar.spanMax_u} u, width ${V.bar.width_u} u, thickness ${V.bar.thick_u} u → λ ${V.bar.lambdaNow} against ${V.slenderMax}`);
console.log(`  the ceiling wants width ${u(V.wanted.width_u)} at the longest span — ${u(V.wanted.growTotal_u)} more across\n`);
const side = (sd) => `${u(sd.g)}${sd.saturated ? ' (SATURATED \u2014 the search stops here, the corridor does not)' : ''}   binding: ${sd.binding || 'nothing'}  at ${sd.atPose}`;
console.log(`  +y face may grow ${side(V.limits.plus)}`);
console.log(`  \u2212y face may grow ${side(V.limits.minus)}`);
console.log(`  TOTAL available ${u(V.limits.totalAvailable_u)} against ${u(V.wanted.growTotal_u)} wanted → ${V.limits.totalAvailable_u >= V.wanted.growTotal_u ? 'FITS' : 'SHORT by ' + u(V.wanted.growTotal_u - V.limits.totalAvailable_u)}\n`);
console.log('  nearest metal outside the unit, over the whole net (shipped width):');
for (const n of V.neighbours.slice(0, 12))
  console.log(`     ${n.closest_u.toFixed(4)} u  ${n.neighbour.padEnd(44)} ${n.joint ? 'JOINT (touching by design — excluded from the walls)' : ''}  ${n.atPose}`);
console.log('\nCONTROLS:');
const c = V.controls;
console.log(`  identity   ${c.identity.ok ? 'PASS' : 'FAIL'}  ${c.identity.disagreements} disagreement(s) — ${c.identity.why}`);
if (!c.identity.ok) for (const d of c.identity.worst) console.log(`     ${d.pose}  ${d.neighbour}  proxy ${d.proxy} vs real ${d.real}`);
console.log(`  must-hit   ${c.mustHit ? (c.mustHit.ok ? 'PASS' : 'FAIL') : 'NOT RUN'}  ${c.mustHit ? `measured ${c.mustHit.measured} against ${c.mustHit.neighbour}` : ''}`);
console.log(`  monotone   ${c.monotone.ok ? 'PASS' : 'FAIL'}  ${c.monotone.failed} of ${c.monotone.tested} — ${c.monotone.why}`);
if (!c.identity.ok) console.log('\n  The identity control FAILED: nothing above this line is evidence.');
