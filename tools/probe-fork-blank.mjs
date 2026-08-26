// TODO 91 — is the pallet fork ONE piece of metal, and is it one thickness?
// A Swiss lever is a single blank: boss, both pallet arms, the lever and the
// fork end are cut in one outline and lapped to one thickness, with only the
// ruby stones and the guard dart separate. This REPORTS what the movement
// actually builds — the unit's steel members, the z-height of each, the joint
// steps between them, the two arms' symmetry, and the one thing the eye cannot
// see: whether `L_BALANCE`'s stated derivation (`L_FORK + FORK_T/2` as "fork
// body top") matches the fork's real reach.
//
// A REPORT, not an acceptance test — it exits 0 whatever it finds. The
// acceptance test belongs with the fix (see TODO 91's Acceptance section);
// this is the measurement the item was written from.
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
      h: +(wb.max.z - wb.min.z).toFixed(4),
      zmin: +wb.min.z.toFixed(4), zmax: +wb.max.z.toFixed(4),
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
  // The pivot boss against the balance — the lateral separation that is, today,
  // the only thing keeping finding 2's negative z-margin from being a contact.
  // Swept, not sampled: the balance turns, so a single pose reads whatever
  // phase the page happened to be at — one earlier reading of this same
  // number came back 0.73 and another 0.60 for exactly that reason.
  const boss = fork.find((m) => m.geometry.type === 'CylinderGeometry'
    && m.geometry.attributes.position.count === 124);
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
    CLEAR_MARGIN: L.CLEAR_MARGIN, RIM_H: L.RIM_H,
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
const assumed = out.L_FORK + out.FORK_T / 2;
const rimUnder = out.L_BALANCE - out.RIM_H / 2;
console.log(`\nL_BALANCE's derivation, against the metal:`);
console.log(`  "fork body top" as derived (L_FORK + FORK_T/2)  ${assumed.toFixed(4)}`);
console.log(`  fork blank's real top                           ${top.toFixed(4)}   overshoot ${(top - assumed).toFixed(4)}`);
console.log(`  balance rim underside (L_BALANCE - RIM_H/2)     ${rimUnder.toFixed(4)}`);
console.log(`  z margin actually left                          ${(rimUnder - top).toFixed(4)}   `
  + `(reserved: ${out.CLEAR_MARGIN})`);
console.log(`  pivot boss -> nearest balance mesh, swept        ${out.bossToBalance}   `
  + `<- the separation nothing derives`);

// The two arms: bar lengths, and how each head's block relates to the body.
const bars = blank.filter((r) => r.type === 'BoxGeometry');
const blocks = blank.filter((r) => r.type === 'ExtrudeGeometry' && r.verts === 126);
const body = blank.find((r) => r.type === 'ExtrudeGeometry' && r.verts > 400);
if (bars.length === 2) {
  const [p, q] = bars.map((r) => r.len);
  console.log(`\nARM SYMMETRY:`);
  console.log(`  bar lengths ${p} and ${q}  -> ${(Math.abs(p - q) / Math.max(p, q) * 100).toFixed(1)}% apart`);
}
if (body && blocks.length === 2) {
  const clr = blocks.map((b) => out.pairs.find((x) => (x.a === body.i && x.b === b.i) || (x.a === b.i && x.b === body.i))?.d);
  console.log(`  arm block -> body clearance: ${clr.join(' and ')}  `
    + `<- the same member related to the body two ways`);
}
