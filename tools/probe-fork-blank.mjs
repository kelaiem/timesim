// TODO 98 — is the pallet fork ONE piece of metal, and is it one thickness?
// A Swiss lever is a single blank: boss, both pallet arms, the lever and the
// fork end are cut in one outline and lapped to one thickness, with only the
// ruby stones and the guard dart separate. This REPORTS what the movement
// actually builds — the unit's steel members, the z-height of each, the joint
// steps between them, the two arms' symmetry, and the one thing the eye cannot
// see: whether `L_BALANCE`'s stated derivation (`L_FORK + FORK_T/2` as "fork
// body top") matches the fork's real reach.
//
// ACCEPTANCE since TODO 98 landed: it exits non-zero if the fork stops being
// one blank of one thickness, or if `FORK_HALF_Z` stops describing it. It was
// a REPORT while the item was open and the numbers it printed are what the
// item was written from; the four conditions below are what the fix has to
// keep true, so they are checked rather than printed.
import { chromium } from 'playwright';
import { spawn } from 'node:child_process';

const PORT = Number(process.env.PORT || 8479);
const srv = spawn('python3', ['-m', 'http.server', String(PORT), '--bind', '127.0.0.1'],
  { cwd: new URL('..', import.meta.url).pathname, stdio: 'ignore' });
await new Promise((r) => setTimeout(r, 900));
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1100, height: 800 } });
page.setDefaultTimeout(180000);
page.on('pageerror', (e) => console.log('PAGEERROR', String(e)));
await page.goto(`http://127.0.0.1:${PORT}/index.html?schematic=0`, { waitUntil: 'load', timeout: 60000 });
await page.waitForFunction(() => !!window.__clock, null, { timeout: 60000 });
await new Promise((r) => setTimeout(r, 2500));

const out = await page.evaluate(async () => {
  const THREE = await import('three');
  const I = await import('./src/inspect.js');
  const L = await import('./src/layout.js');
  const clock = window.__clock;
  clock.resetInputs();
  const meshesOf = (name) => {
    const o = [];
    clock.labelEntries.find((e) => e.name === name).obj.traverse((x) => { if (x.isMesh) o.push(x); });
    return o;
  };
  const fork = meshesOf('Pallet fork');
  const rows = fork.map((m, i) => {
    m.updateWorldMatrix(true, false);
    const wb = new THREE.Box3().setFromObject(m);
    m.geometry.computeBoundingBox();
    const lb = m.geometry.boundingBox;
    // The RUBY stones are found by material colour, exactly as the inspector's
    // penetration budget finds them (geometry.js says so in place).
    const hex = m.material?.color?.getHexString?.() ?? '';
    return {
      i, type: m.geometry.type, verts: m.geometry.attributes.position.count,
      ruby: hex === 'b01326',
      // NOT rounded: the z figures below are compared against layout.js's own
      // arithmetic, so rounding them here would manufacture a disagreement at
      // the fifth decimal and fail a part that is exactly right.
      h: +(wb.max.z - wb.min.z).toFixed(6),
      zmin: wb.min.z, zmax: wb.max.z,
      len: +(lb.max.y - lb.min.y).toFixed(4),
    };
  });
  // Pairwise clearance INSIDE the unit — the sweeps' documented blind spot
  // (TODO 5), and where "abutting solids" shows up as a number.
  const pairs = [];
  for (let a = 0; a < fork.length; a++) for (let b = a + 1; b < fork.length; b++) {
    let d = NaN;
    try { d = I.meshClearance(fork[a], fork[b], Infinity); } catch { /* report as NaN */ }
    pairs.push({ a, b, d: +Number(d).toFixed(4) });
  }
  // The two stones, read off the built meshes: seat and lean. This is what
  // says the two arms come from ONE rule — the seats mirror about the lever's
  // axis, and the leans differ from that mirror by exactly 2·DRAW_DEG,
  // because draw rotates both stones in the wheel's sense rather than
  // mirroring them. Read from the meshes rather than from a userData export,
  // so it measures the metal.
  const forkObj = clock.labelEntries.find((e) => e.name === 'Pallet fork').obj;
  forkObj.updateWorldMatrix(true, true);
  const inv = new THREE.Matrix4().copy(forkObj.matrixWorld).invert();
  const rubies = fork.filter((m) => m.material?.color?.getHexString?.() === 'b01326');
  const stones = rubies.map((m) => {
    const p = new THREE.Vector3().setFromMatrixPosition(m.matrixWorld).applyMatrix4(inv);
    // The stone's lean in the fork's own frame: its local +Y is the lean axis,
    // and the builder sets rotation.z = thetaTau − 90°.
    const lean = THREE.MathUtils.radToDeg(m.rotation.z) + 90;
    return { x: p.x, y: p.y, lean };
  }).sort((a, b) => a.x - b.x);

  // The pivot boss against the balance — the lateral separation that is, today,
  // the only thing keeping finding 2's negative z-margin from being a contact.
  // Swept, not sampled: the balance turns, so a single pose reads whatever
  // phase the page happened to be at — one earlier reading of this same
  // number came back 0.73 and another 0.60 for exactly that reason.
  // The blank is the fork's one steel body that is not the guard dart: the
  // largest mesh by vertex count. Before TODO 98 this picked the body extrude
  // out of six steel solids; now there is only one to pick.
  const boss = fork.filter((m) => m.geometry.type === 'ExtrudeGeometry'
    && !(m.material?.color?.getHexString?.() === 'b01326'))
    .sort((a, b) => b.geometry.attributes.position.count - a.geometry.attributes.position.count)[0];
  let bossToBalance = Infinity;
  const N = 48;
  for (let k = 0; k < N; k++) {
    clock.setPose({ tau: k / N * 3600, crownPullT: 0, leverEngage: 0, tension: 1, windAccumTurns: 0 });
    for (const m of meshesOf('Balance')) {
      let d = Infinity;
      try { d = I.meshClearance(boss, m, Infinity); } catch { continue; }
      if (d < bossToBalance) bossToBalance = d;
    }
  }
  clock.resetInputs();
  return {
    rows, pairs,
    bossToBalance: +bossToBalance.toFixed(4),
    L_FORK: L.L_FORK, FORK_T: L.FORK_T, L_BALANCE: L.L_BALANCE,
    CLEAR_MARGIN: L.CLEAR_MARGIN, RIM_H: L.RIM_H, FORK_HALF_Z: L.FORK_HALF_Z,
    stones,
  };
});
await browser.close(); srv.kill();

const pivots = out.rows.filter((r) => r.h > 2 || (r.type === 'CylinderGeometry' && r.h > 1.6));
const pivotIdx = new Set(pivots.map((r) => r.i));
const blank = out.rows.filter((r) => !r.ruby && !pivotIdx.has(r.i));

console.log('PALLET FORK — members as built\n');
console.log('  #   geometry            verts   z-height   world z span        role');
for (const r of out.rows) {
  const role = r.ruby ? 'ruby stone' : pivotIdx.has(r.i) ? 'pivot / guard pin' : 'BLANK (should be one solid)';
  console.log(`  ${String(r.i).padStart(2)}  ${r.type.padEnd(18)} ${String(r.verts).padStart(5)}   `
    + `${r.h.toFixed(4).padStart(8)}   ${r.zmin.toFixed(4)} .. ${r.zmax.toFixed(4)}   ${role}`);
}

const heights = [...new Set(blank.map((r) => r.h))].sort((a, b) => a - b);
console.log(`\nONE BLANK? ${blank.length} steel solid(s) carrying the lever's own metal.`);
console.log(`ONE THICKNESS? ${heights.length} distinct z-height(s): ${heights.join(' / ')}`);
if (heights.length > 1) {
  const steps = [];
  for (let i = 1; i < heights.length; i++) steps.push(+(heights[i] - heights[0]).toFixed(4));
  console.log(`  joint steps against the thinnest member: ${steps.join(', ')}`
    + `  (CLEAR_MARGIN = ${out.CLEAR_MARGIN})`);
}

const top = Math.max(...blank.map((r) => r.zmax));
const declared = out.L_FORK + out.FORK_HALF_Z;
const rimUnder = out.L_BALANCE - out.RIM_H / 2;
const margin = rimUnder - top;
console.log(`\nL_BALANCE's derivation, against the metal:`);
console.log(`  blank's top as DECLARED (L_FORK + FORK_HALF_Z)  ${declared.toFixed(4)}`);
console.log(`  blank's top as BUILT                            ${top.toFixed(4)}   overshoot ${(top - declared).toFixed(4)}`);
console.log(`  balance rim underside (L_BALANCE - RIM_H/2)     ${rimUnder.toFixed(4)}`);
console.log(`  z margin actually left                          ${margin.toFixed(4)}   `
  + `(reserved: ${out.CLEAR_MARGIN})`);
// 0 here is the impulse pin standing in the fork's notch — the escapement's
// own working contact, swept over a turn of the balance. It is printed rather
// than gated because the pair is EXPECTED; what the gate holds is the z above.
console.log(`  blank -> nearest balance mesh, swept            ${out.bossToBalance}`
  + `   (0 = the impulse pin in the notch)`);

// The two arms come from ONE rule. What that means precisely, and what it does
// NOT mean: the seats are mirror images about the lever's axis, and the two
// leans differ from that mirror by exactly 2·DRAW_DEG — draw rotates both
// stones in the wheel's own sense, so it is the one thing about the escapement
// that is not mirror-symmetric. Everything the arms inherit, they inherit from
// that; a difference between the two arms is the draw, not an aimed box.
const DRAW_DEG = 12;
let seatSkew = NaN, leanSum = NaN;
if (out.stones.length === 2) {
  const [a, b] = out.stones;   // sorted by fork-local x, so a is the -x stone
  seatSkew = Math.hypot(a.x + b.x, a.y - b.y);   // 0 iff the seats mirror about x = 0
  // A mirror about x = 0 maps an angle to 180° − it, so the two leans sum to
  // 180° under a pure mirror. MODULO 360: `rotation.z` comes back wrapped to
  // (−180°, 180°], so the entry stone's 237° reads as −123° and a raw sum
  // lands a full turn away from the relation it satisfies.
  leanSum = ((a.lean + b.lean) % 360 + 360) % 360;
  console.log(`\nARM SYMMETRY — one rule, and the draw:`);
  console.log(`  seats           (${a.x.toFixed(4)}, ${a.y.toFixed(4)})  and  `
    + `(${b.x.toFixed(4)}, ${b.y.toFixed(4)})`);
  console.log(`  mirror residual ${seatSkew.toFixed(6)}   (0 = the seats are mirror images)`);
  console.log(`  leans           ${a.lean.toFixed(3)}° and ${b.lean.toFixed(3)}°`);
  console.log(`  leans, summed   ${leanSum.toFixed(3)}° (mod 360)`);
  console.log(`  broken mirror   ${(leanSum - 180).toFixed(3)}°   `
    + `(a pure mirror sums to 180°; 2·DRAW_DEG = ${2 * DRAW_DEG}° is the draw)`);
}

// --- the four conditions TODO 98 closed, as a gate ---------------------------
// A report saying `1 steel solid` has not passed anything; these have.
const fails = [];
if (blank.length !== 1)
  fails.push(`the fork's own metal is ${blank.length} solids, not one blank`);
if (heights.length !== 1)
  fails.push(`the blank has ${heights.length} z-heights (${heights.join('/')}), not one`);
// The blank is lapped to FORK_T overall — chamfer included, not on top of it.
if (heights.length === 1 && Math.abs(heights[0] - out.FORK_T) > 1e-6)
  fails.push(`the blank measures ${heights[0]} thick against FORK_T = ${out.FORK_T}`);
if (Math.abs(top - declared) > 1e-6)
  fails.push(`the blank tops out at ${top.toFixed(4)}, but layout.js derives L_BALANCE `
    + `from ${declared.toFixed(4)} (FORK_HALF_Z)`);
// The margin L_BALANCE reserves has to be the margin that is there. Sampling
// slack in the two bounding boxes is float-level, so this is an equality.
if (Math.abs(margin - out.CLEAR_MARGIN) > 1e-6)
  fails.push(`the balance rim clears the blank by ${margin.toFixed(4)}, not the `
    + `reserved CLEAR_MARGIN ${out.CLEAR_MARGIN}`);
// Not float noise: the seats are computed from mirrored inputs, so they agree
// to the last bit or something has stopped being one rule.
if (!(seatSkew < 1e-9))
  fails.push(`the two stone seats are not mirror images — residual ${seatSkew}`);
if (!(Math.abs(leanSum - 180 - 2 * DRAW_DEG) < 1e-9))
  fails.push(`the two leans break the mirror by ${(leanSum - 180).toFixed(4)}°, `
    + `not by 2·DRAW_DEG = ${2 * DRAW_DEG}°`);

console.log('');
if (fails.length) {
  console.log('FAIL — TODO 98:');
  for (const f of fails) console.log('  · ' + f);
  process.exitCode = 1;
} else {
  console.log('PASS — one blank, one thickness, lapped to FORK_T, and the balance\'s '
    + 'elevation derived from the metal.');
}
