// WHAT SETS THE MOVEMENT'S CASED HEIGHT — the front and back chains read off
// the metal, the member that governs each named with its slack to the next,
// and the cased depth reproduced from them. Acceptance, with a mutation tier
// that proves the ledger PREDICTS rather than restates.
//
// ACCEPTANCE (exit 1 on any claim, exit 2 if a control says the harness
// measured nothing). Written for the private roadmap's §261 (height
// compaction, investigated), step 0: before any lever is priced, say what the
// height IS and which member sets each face of it, from the metal.
//
// What this is NOT, and why it is a new file:
//   · probe-back-envelope.mjs gates the back GLASS against swept metal (the
//     pane, step and skirt each one margin clear at every pose). It does not
//     say which of those faces sets the cased depth, or by how much.
//   · probe-hand-stack.mjs holds the FRONT crystal chain shut on the minute
//     pipe and the hand lanes over poses. It does not follow the chain to the
//     bezel or join it to the back.
//   · probe-192-tier-price.mjs prices the STRIKE TOWER's ladder and its 1:1
//     relation to the glass step. Since §192 the step stopped governing the
//     cased depth, and that probe cannot see what took over.
// None of them prints the whole stack with its governor and slack, which is
// this file's one question.
//
// THE LEDGER, both ends off measured metal:
//   FRONT  movement front-most metal → crystal inner face (one
//          CASE_CRYSTAL_CLEAR off it) → crystal outer → bezel (the case's
//          front-most metal).
//   BACK   the skirt annulus's envelope max (or the clamp heads, measured off
//          their own metal) + CLEAR_MARGIN = skirt bottom; the band's back face
//          = max(skirt bottom + thread engagement, the pane floor outboard of
//          the aperture); the ring face, its wrench keys, and the raised glass
//          step (the envelope's global max + CLEAR_MARGIN, one glass thick).
//          The back-most metal is whichever of those stands proudest.
// The skirt bottom, the pane floor and the step are RE-DERIVED here from
// `__clock.backEnvelope`'s bins and asserted against `__clock.backGlass` —
// the expression, not a copy of its result (the transfers-check rule).
//
// CONTROLS:
//   · must-hit: the crystal's inner face measures exactly CASE_CRYSTAL_CLEAR
//     off the movement's front-most metal, and the back glass is exactly
//     CASE_CRYSTAL_T thick at its step. If either fails, the scan read the
//     wrong meshes and every number below is about something else (exit 2).
//   · IDENTITY mutant: the tree copied and booted unchanged through the same
//     harness must reproduce every face of the direct boot. Without it a
//     harness that perturbed the build would make every prediction below
//     look like a ledger error, or worse, like a pass (exit 2).
//   · PREDICTION mutants, the load-bearing tier. Each raises one declared
//     envelope term by DELTA in a copied tree, and the ledger — computed on
//     the UNMUTATED boot — predicts every face of the mutant before it boots.
//     The mutant's metal, measured independently, must agree. One mutant
//     raises the governor's input and must move the cased depth 1:1; the
//     other raises a non-governor and must move it by max(0, DELTA − slack).
//     A ledger that only restated the build could not tell those apart.
//
// REPORT TIER (printed, not gated): every labelled unit's z extent sorted by
// its front face, and the declared datums with the source constant each
// comes from. Boxes, so a unit spanning two strata shows in both; read it as
// a map, not a measurement of any one face.
//
// Run: cd tools && node probe-261-height-ledger.mjs   (ROOT= for another tree)
import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import { mkdtempSync, cpSync, readFileSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = process.env.ROOT || join(dirname(fileURLToPath(import.meta.url)), '..');
const DELTA = 0.5;   // units raised by each prediction mutant — large enough to clear float noise by 1e5, small enough to stay inside the case's own asserts
const EPS = 1e-6;
let port = 8561;
const servers = [];
process.on('exit', () => { for (const s of servers) try { s.kill(); } catch {} });

// ---------------------------------------------------------------------------
// One boot, measured. Everything the ledger needs, and nothing derived yet —
// the derivation runs in Node over these numbers so the mutants are predicted
// by the same code that reads the base.
const MEASURE = async () => {
  const THREE = await import('three');
  const L = await import('./src/layout.js');
  const clock = window.__clock;
  clock.resetInputs?.();
  clock.scene.updateMatrixWorld(true);
  const v = new THREE.Vector3();
  const caseRoot = clock.scene.getObjectByName('case');
  const inCase = (o) => { for (let p = o; p; p = p.parent) if (p === caseRoot) return true; return false; };
  // z extents per mesh NAME over the case, every vertex (the case's lathes
  // carry few vertices, and a face IS a vertex ring on a lathe).
  const caseParts = {};
  caseRoot.traverse((o) => {
    if (!o.isMesh || o.userData.schematic || !o.geometry?.attributes?.position) return;
    const p = o.geometry.attributes.position;
    const e = caseParts[o.name || '(unnamed)'] ??= { zMin: Infinity, zMax: -Infinity, n: 0 };
    e.n++;
    for (let i = 0; i < p.count; i++) {
      o.localToWorld(v.fromBufferAttribute(p, i));
      if (v.z < e.zMin) e.zMin = v.z; if (v.z > e.zMax) e.zMax = v.z;
    }
  });
  // The movement's front-most metal, by mesh, over every labelled unit but
  // the case. Every vertex: a hand's boss is a short cylinder whose front IS
  // its end ring.
  let front = { z: Infinity, mesh: null, unit: null };
  const units = [];
  for (const e of clock.labelEntries) {
    if (inCase(e.obj)) continue;
    let zMin = Infinity, zMax = -Infinity;
    e.obj.traverse((o) => {
      if (!o.isMesh || o.userData.schematic || !o.geometry?.attributes?.position) return;
      const p = o.geometry.attributes.position;
      for (let i = 0; i < p.count; i++) {
        o.localToWorld(v.fromBufferAttribute(p, i));
        if (v.z < zMin) zMin = v.z; if (v.z > zMax) zMax = v.z;
        if (v.z < front.z) front = { z: v.z, mesh: o.name || '(unnamed)', unit: e.name };
      }
    });
    if (zMin < Infinity) units.push({ name: e.name, zMin, zMax });
  }
  // §39's own boxes, reproduced exactly as main.js takes them: the movement
  // is every child of the case's parent but the case and its line tier; the
  // cased box adds the case solid.
  const movBox = new THREE.Box3();
  for (const c of caseRoot.parent.children) if (c !== caseRoot && c.name !== 'caseLines') movBox.expandByObject(c);
  const casedBox = movBox.clone().expandByObject(caseRoot);
  const env = clock.backEnvelope;
  return {
    L: { CLEAR_MARGIN: L.CLEAR_MARGIN, UNIT_MM: L.UNIT_MM, CASE_CRYSTAL_T: L.CASE_CRYSTAL_T,
      CASE_CRYSTAL_CLEAR: L.CASE_CRYSTAL_CLEAR, CASE_WIDTH_MAX: L.CASE_WIDTH_MAX, CASE_BAND_T: L.CASE_BAND_T,
      Z_DIAL: L.Z_DIAL, Z_DIAL_FACE: L.Z_DIAL_FACE, BACK_PLATE_T: L.BACK_PLATE_T, Z_KEYLESS: L.Z_KEYLESS,
      L_BARREL: L.L_BARREL, L_FOURTH: L.L_FOURTH, L_BALANCE: L.L_BALANCE, SPRING_TOP_Z: L.SPRING_TOP_Z,
      COCK_SLAB_TOP: L.COCK_SLAB_TOP },
    caseParts, front, units,
    box39: { mov: [movBox.min.z, movBox.max.z], cased: [casedBox.min.z, casedBox.max.z] },
    env: { bins: env.bins, regions: env.regions, allowances: env.allowances },
    glass: { ...clock.backGlass },
  };
};

async function boot(dir) {
  const p0 = port++;
  const srv = spawn('python3', ['-m', 'http.server', String(p0), '--bind', '127.0.0.1'], { cwd: dir, stdio: 'ignore' });
  servers.push(srv);
  await new Promise((r) => setTimeout(r, 1200));
  const browser = await chromium.launch();
  const warns = [];
  try {
    const page = await browser.newPage();
    page.on('console', (m) => { if (m.type() === 'warning' && !/WebGL|GPU stall|GroupMarker/.test(m.text())) warns.push(m.text()); });
    page.on('pageerror', (e) => warns.push('PAGEERROR ' + String(e)));
    await page.goto(`http://127.0.0.1:${p0}/index.html`, { waitUntil: 'load', timeout: 180000 });
    await page.waitForFunction(() => !!window.__clock || !!window.__bootError, null, { timeout: 180000 });
    const bootError = await page.evaluate(() => window.__bootError ? String(window.__bootError) : null);
    if (bootError) throw new Error('boot failed: ' + bootError);
    const m = await page.evaluate(`(${MEASURE.toString()})()`);
    return { ...m, warns };
  } finally { await browser.close(); srv.kill(); }
}

function mutantTree(file, find, to) {
  const dir = mkdtempSync(join(tmpdir(), 'ledger261-'));
  cpSync(ROOT, dir, { recursive: true, dereference: true,
    filter: (s) => !/(^|[\\/])(\.git|node_modules|\.battery-out|\.claude|timelapse)([\\/]|$)/.test(s) });
  if (find !== null) {
    const target = join(dir, file);
    const before = readFileSync(target, 'utf8');
    const hits = before.split(find).length - 1;
    if (hits !== 1) throw new Error(`mutation anchor matched ${hits} times in ${file}, needs exactly 1 — the patch is stale`);
    const after = before.replace(find, to);
    if (after === before) throw new Error('mutation left the file unchanged — it would have tested nothing');
    writeFileSync(target, after);
  }
  return dir;
}

// ---------------------------------------------------------------------------
// The ledger: a pure function of one boot's measurements (and, for a
// prediction, of an edited copy of its envelope).
function envMaxOver(bins, r0, r1) {
  let z = -Infinity, owner = null;
  for (const b of bins) if (b.z !== null && b.r1 > r0 && b.r0 < r1 && b.z > z) { z = b.z; owner = b.owner; }
  return { z, owner };
}
function backChain(m, bins, eng, ringRise, keyRise) {
  const { CLEAR_MARGIN: CM, CASE_WIDTH_MAX, CASE_BAND_T, CASE_CRYSTAL_T } = m.L;
  const R_BORE_BACK = CASE_WIDTH_MAX - CASE_BAND_T;
  const annulus = envMaxOver(bins, m.glass.skirtID, R_BORE_BACK);
  const clampTop = m.caseParts.caseClampScrew?.zMax ?? -Infinity;
  const skirtBand = annulus.z >= clampTop ? { z: annulus.z, by: `envelope r ${m.glass.skirtID.toFixed(2)}–${R_BORE_BACK.toFixed(2)}: ${annulus.owner}` }
    : { z: clampTop, by: 'the clamp screws\' heads (measured)' };
  const skirtBot = skirtBand.z + CM;
  const outboard = envMaxOver(bins, m.glass.apertureR - 2 * CM, CASE_WIDTH_MAX);
  const paneFloor = outboard.z + CM;
  const skirtArm = skirtBot + eng;
  const midBack = Math.max(skirtArm, paneFloor);
  const all = envMaxOver(bins, 0, CASE_WIDTH_MAX);
  const stepUnder = all.z + CM;
  const z0 = midBack + ringRise;
  return {
    skirtBand, skirtBot, outboard, paneFloor, skirtArm, midBack,
    midBy: skirtArm >= paneFloor ? 'skirt arm (skirt bottom + thread engagement)' : `pane floor (outboard of the aperture: ${outboard.owner})`,
    midSlack: Math.abs(skirtArm - paneFloor),
    stepUnder, stepBy: all.owner, stepTop: stepUnder + CASE_CRYSTAL_T,
    z0, keysTop: z0 + keyRise,
  };
}
// The back-most metal: the faces that ride the chain, and every other case
// part at its own measured top (those do not ride it).
const RIDES = new Set(['caseBack', 'caseBackKey', 'caseBackCrystal', 'caseBackCrystalGasket', 'caseGasket']);
function backMost(m, chain, base) {
  const cands = [
    { by: 'the ring\'s wrench keys (caseBackKey)', z: chain.keysTop },
    { by: 'the raised glass step (caseBackCrystal)', z: chain.stepTop },
    { by: 'the ring face (caseBack)', z: chain.z0 },
  ];
  for (const [name, e] of Object.entries(base.caseParts)) if (!RIDES.has(name)) cands.push({ by: name, z: e.zMax });
  cands.sort((a, b) => b.z - a.z);
  return { top: cands[0], next: cands[1], slack: cands[0].z - cands[1].z };
}
function ledger(m) {
  const g = m.glass;
  const eng = g.paneInner - g.skirtBot;                 // implied; held constant across mutants below
  const ringRise = m.caseParts.caseBack.zMax - g.paneInner;
  const keyRise = (m.caseParts.caseBackKey?.zMax ?? m.caseParts.caseBack.zMax) - m.caseParts.caseBack.zMax;
  const back = backChain(m, m.env.bins, eng, ringRise, keyRise);
  const frontCase = Math.min(...Object.values(m.caseParts).map((e) => e.zMin));
  const frontName = Object.entries(m.caseParts).find(([, e]) => e.zMin === frontCase)[0];
  const bm = backMost(m, back, m);
  return { eng, ringRise, keyRise, back, bm, frontCase, frontName,
    depth: bm.top.z - frontCase };
}

// ---------------------------------------------------------------------------
const fails = [], ctlFails = [];
const near = (a, b, tol = EPS) => Math.abs(a - b) <= tol;
const f4 = (x) => (x === null || x === undefined || !Number.isFinite(x)) ? String(x) : x.toFixed(4);

console.log('§261 height ledger — booting the tree under test…');
const base = await boot(ROOT);
const U = base.L.UNIT_MM, mm = (u) => (u * U).toFixed(3) + ' mm';
if (base.warns.length) fails.push(`boot is not silent: ${base.warns.length} warning(s), first: ${base.warns[0]}`);
const Lb = ledger(base);

// --- FRONT ---------------------------------------------------------------
const cr = base.caseParts.caseCrystal;
console.log('\nFRONT CHAIN (dial side is −z)');
console.log(`  movement front-most metal  z ${f4(base.front.z)}   ${base.front.unit} / ${base.front.mesh}`);
console.log(`  crystal inner face         z ${f4(cr.zMax)}   = front − CASE_CRYSTAL_CLEAR (${f4(base.L.CASE_CRYSTAL_CLEAR)} u = 0.3 mm)`);
console.log(`  crystal outer face         z ${f4(cr.zMin)}   (${mm(cr.zMax - cr.zMin)} of glass)`);
console.log(`  case front-most metal      z ${f4(Lb.frontCase)}   ${Lb.frontName}`);
if (!near(cr.zMax, base.front.z - base.L.CASE_CRYSTAL_CLEAR))
  ctlFails.push(`must-hit: the crystal's inner face ${f4(cr.zMax)} is not CASE_CRYSTAL_CLEAR off the movement's front-most metal ${f4(base.front.z)} — the scan read the wrong meshes, or a member other than the one the crystal is derived from stands front-most`);
if (!near(cr.zMax - cr.zMin, base.L.CASE_CRYSTAL_T))
  ctlFails.push(`must-hit: the front crystal measures ${f4(cr.zMax - cr.zMin)} thick against CASE_CRYSTAL_T ${f4(base.L.CASE_CRYSTAL_T)}`);

// --- BACK ----------------------------------------------------------------
const b = Lb.back, g = base.glass;
console.log('\nBACK CHAIN');
console.log(`  skirt band max             z ${f4(b.skirtBand.z)}   set by ${b.skirtBand.by}`);
console.log(`  clamp heads (measured)     z ${f4(base.caseParts.caseClampScrew?.zMax)}`);
console.log(`  skirt bottom               z ${f4(b.skirtBot)}   (+CLEAR_MARGIN)   built ${f4(g.skirtBot)}`);
console.log(`  skirt arm                  z ${f4(b.skirtArm)}   (+ engagement ${f4(Lb.eng)} u = ${mm(Lb.eng)}, implied)`);
console.log(`  pane floor                 z ${f4(b.paneFloor)}   outboard of the aperture: ${b.outboard.owner} ${f4(b.outboard.z)} + CLEAR_MARGIN`);
console.log(`  band back face             z ${f4(b.midBack)}   set by ${b.midBy}, ${f4(b.midSlack)} u = ${mm(b.midSlack)} over the other arm   built ${f4(g.paneInner)}`);
console.log(`  ring face                  z ${f4(b.z0)}   (+ lip and glass, ${mm(Lb.ringRise)})`);
console.log(`  wrench keys                z ${f4(b.keysTop)}   (+ ${mm(Lb.keyRise)})`);
console.log(`  glass step underside       z ${f4(b.stepUnder)}   = envelope max (${b.stepBy}) + CLEAR_MARGIN   built ${f4(g.zStepUnder)}`);
console.log(`  glass step top             z ${f4(b.stepTop)}   measured ${f4(base.caseParts.caseBackCrystal?.zMax)}`);
console.log(`  BACK-MOST METAL            z ${f4(Lb.bm.top.z)}   ${Lb.bm.top.by}`);
console.log(`     next                    z ${f4(Lb.bm.next.z)}   ${Lb.bm.next.by} — the governor's slack ${f4(Lb.bm.slack)} u = ${mm(Lb.bm.slack)}`);
if (!near(b.skirtBot, g.skirtBot)) fails.push(`skirt bottom re-derived ${f4(b.skirtBot)} ≠ built ${f4(g.skirtBot)} — the ledger does not reproduce the case's own expression`);
if (!near(b.stepUnder, g.zStepUnder)) fails.push(`glass step re-derived ${f4(b.stepUnder)} ≠ built ${f4(g.zStepUnder)}`);
if (!near(Math.max(b.skirtArm, b.paneFloor), g.paneInner)) fails.push(`band back face re-derived ${f4(b.midBack)} ≠ built ${f4(g.paneInner)}`);
const stepTopMeasured = base.caseParts.caseBackCrystal?.zMax;
if (!near(stepTopMeasured, b.stepTop))
  ctlFails.push(`must-hit: the back glass's step top ${f4(stepTopMeasured)} is not CASE_CRYSTAL_T over its underside ${f4(b.stepUnder)}`);
const measuredBack = Math.max(...Object.values(base.caseParts).map((e) => e.zMax));
if (!near(measuredBack, Lb.bm.top.z)) fails.push(`the ledger's back-most ${f4(Lb.bm.top.z)} is not the case's measured back-most ${f4(measuredBack)}`);

// --- DEPTH ---------------------------------------------------------------
const d39 = base.box39.cased[1] - base.box39.cased[0], m39 = base.box39.mov[1] - base.box39.mov[0];
console.log('\nDEPTH');
console.log(`  cased (case metal, front to back)   ${f4(Lb.depth)} u = ${mm(Lb.depth)}`);
console.log(`  §39's cased box (movement ∪ case)   ${f4(d39)} u = ${mm(d39)}`);
console.log(`  §39's movement box                  ${f4(m39)} u = ${mm(m39)}   (z ${f4(base.box39.mov[0])} .. ${f4(base.box39.mov[1])})`);
if (!near(d39, Lb.depth)) console.log(`  NOTE: §39's box and the case metal disagree by ${f4(d39 - Lb.depth)} u — something outside the case stands proud of it`);

// --- MUTANTS -------------------------------------------------------------
// Each is predicted from the UNMUTATED ledger before it boots.
const region = base.env.regions.find((r) => r.unit === 'Alarm switch' && r.r0 === 48.3);
const linkAllow = base.env.allowances.find((a) => a.unit === 'Alarm link');
if (!region || !linkAllow) { console.log('mutation targets missing from __clock.backEnvelope — the declarations moved'); process.exit(2); }
const predict = (editBins) => {
  const bins = base.env.bins.map((x) => ({ ...x }));
  editBins(bins);
  const ch = backChain(base, bins, Lb.eng, Lb.ringRise, Lb.keyRise);
  const bm = backMost(base, ch, base);
  return { ch, bm, depth: bm.top.z - Lb.frontCase };
};
const MUTANTS = [
  { name: 'identity — the tree copied and booted unchanged', identity: true, find: null },
  { name: `the swept row 'Alarm switch' r ${region.r0}–${region.r1} z ${region.z} raised ${DELTA}`,
    file: 'src/main.js',
    find: `{ unit: 'Alarm switch', r0: ${region.r0}, r1: ${region.r1}, z: ${region.z} }`,
    to: `{ unit: 'Alarm switch', r0: ${region.r0}, r1: ${region.r1}, z: ${+(region.z + DELTA).toFixed(6)} }`,
    pred: predict((bins) => { const z = region.z + DELTA; const n = bins.length, rs = base.env.bins[n - 1].r1;
      const sLo = Math.max(0, Math.floor(region.r0 / rs * n)), sHi = Math.min(n - 1, Math.ceil(region.r1 / rs * n) - 1);
      for (let s = sLo; s <= sHi; s++) if (bins[s].z === null || z > bins[s].z) { bins[s].z = z; bins[s].owner = `${region.unit} (declared swept region)`; } }) },
  { name: `the alarm link's swept allowance ${linkAllow.extra} raised ${DELTA}`,
    file: 'src/main.js',
    find: `['Alarm link', ${linkAllow.extra}],`,
    to: `['Alarm link', ${+(linkAllow.extra + DELTA).toFixed(6)}],`,
    // Raising the allowance raises every bin the link already owns; a bin the
    // link was runner-up in could be overtaken too, which this undercounts —
    // so only the GLOBAL max (the link's, asserted) is predicted from it.
    pred: predict((bins) => { for (const x of bins) if (x.owner === 'Alarm link') x.z += DELTA; }) },
];

const rows = [];
for (const M of MUTANTS) {
  let dir = null;
  try {
    dir = mutantTree(M.file, M.find, M.to);
    const mb = await boot(dir);
    const ml = ledger(mb);
    const got = { skirtBot: mb.glass.skirtBot, midBack: mb.glass.paneInner, stepUnder: mb.glass.zStepUnder,
      keys: mb.caseParts.caseBackKey?.zMax, stepTop: mb.caseParts.caseBackCrystal?.zMax,
      back: Math.max(...Object.values(mb.caseParts).map((e) => e.zMax)), depth: ml.depth, eng: ml.eng };
    const want = M.identity
      ? { skirtBot: g.skirtBot, midBack: g.paneInner, stepUnder: g.zStepUnder, keys: base.caseParts.caseBackKey?.zMax,
          stepTop: stepTopMeasured, back: measuredBack, depth: Lb.depth, eng: Lb.eng }
      : { skirtBot: M.pred.ch.skirtBot, midBack: M.pred.ch.midBack, stepUnder: M.pred.ch.stepUnder, keys: M.pred.ch.keysTop,
          stepTop: M.pred.ch.stepTop, back: M.pred.bm.top.z, depth: M.pred.depth, eng: Lb.eng };
    const bad = Object.keys(want).filter((k) => !near(got[k], want[k], 1e-5));
    rows.push({ M, got, want, bad, warns: mb.warns });
  } catch (e) {
    rows.push({ M, err: String(e.message || e) });
  } finally { if (dir) rmSync(dir, { recursive: true, force: true }); }
}
console.log(`\nMUTATION TIER (DELTA ${DELTA} u = ${mm(DELTA)}; each predicted from the unmutated ledger before it booted)`);
for (const r of rows) {
  console.log(`  ${r.M.name}`);
  if (r.err) { console.log(`    ERROR ${r.err}`); (r.M.identity ? ctlFails : fails).push(`${r.M.name}: ${r.err}`); continue; }
  for (const k of Object.keys(r.want))
    console.log(`    ${k.padEnd(9)} predicted ${f4(r.want[k])}   measured ${f4(r.got[k])}   moved ${f4(r.got[k] - (r.M.identity ? r.want[k] : ({ skirtBot: g.skirtBot, midBack: g.paneInner, stepUnder: g.zStepUnder, keys: base.caseParts.caseBackKey?.zMax, stepTop: stepTopMeasured, back: measuredBack, depth: Lb.depth, eng: Lb.eng })[k]))}${r.bad.includes(k) ? '   ✗' : ''}`);
  if (r.warns.length) console.log(`    boot warnings (${r.warns.length}): ${r.warns.slice(0, 3).join(' | ')}`);
  if (r.bad.length) (r.M.identity ? ctlFails : fails).push(`${r.M.name}: ${r.bad.join(', ')} disagree with the ${r.M.identity ? 'direct boot' : 'ledger\'s prediction'}`);
}
// The tier only discriminates if the two prediction mutants moved the depth
// DIFFERENTLY — one at the governor, one through a slack.
const moves = rows.filter((r) => !r.M.identity && !r.err).map((r) => r.got.depth - Lb.depth);
if (moves.length === 2 && near(moves[0], moves[1], 1e-4))
  ctlFails.push(`the two prediction mutants moved the depth by the same ${f4(moves[0])} — the tier cannot tell a governor from a non-governor on this tree; pick another target`);

// --- REPORT: units and datums --------------------------------------------
console.log('\nREPORT — labelled units by front face (z, units; boxes)');
for (const u of [...base.units].sort((a, b2) => a.zMin - b2.zMin))
  console.log(`  ${u.name.padEnd(30)} ${f4(u.zMin).padStart(9)} .. ${f4(u.zMax).padStart(8)}   ${mm(u.zMax - u.zMin)}`);
const Ld = base.L;
console.log('\nREPORT — declared datums (layout.js)');
for (const [k, z] of [['Z_DIAL_FACE (dial front)', Ld.Z_DIAL_FACE], ['Z_DIAL (dial back)', Ld.Z_DIAL],
  ['Z_KEYLESS (stem plane)', Ld.Z_KEYLESS], ['−BACK_PLATE_T (plate dial face)', -Ld.BACK_PLATE_T], ['plate top (z 0)', 0],
  ['L_BARREL', Ld.L_BARREL], ['L_FOURTH', Ld.L_FOURTH], ['L_BALANCE', Ld.L_BALANCE], ['SPRING_TOP_Z', Ld.SPRING_TOP_Z],
  ['COCK_SLAB_TOP', Ld.COCK_SLAB_TOP]])
  console.log(`  ${k.padEnd(34)} ${f4(z).padStart(9)}`);
console.log(`  dial-side band (plate dial face to dial back): ${f4(-Ld.BACK_PLATE_T - Ld.Z_DIAL)} u = ${mm(-Ld.BACK_PLATE_T - Ld.Z_DIAL)}`);

console.log('');
if (ctlFails.length) { for (const f of ctlFails) console.log('CONTROL FAIL  ' + f); console.log('exit 2 — the harness measured the wrong thing; nothing above is a verdict'); process.exit(2); }
if (fails.length) { for (const f of fails) console.log('FAIL  ' + f); process.exit(1); }
console.log(`PASS — cased depth ${mm(Lb.depth)}; back governed by ${Lb.bm.top.by} with ${mm(Lb.bm.slack)} over ${Lb.bm.next.by}; front by ${base.front.unit}; both prediction mutants reproduced`);
