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
//
// The harness (the boot, the mutant trees and the ledger itself) lives in
// height-ledger.mjs, shared with probe-261-lever-prices.mjs so both read the
// stack with one law.
import { rmSync } from 'node:fs';
import { ROOT, boot, mutantTree, ledger, backChain, backMost } from './height-ledger.mjs';

const DELTA = 0.5;   // units raised by each prediction mutant — large enough to clear float noise by 1e5, small enough to stay inside the case's own asserts
const EPS = 1e-6;

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
    dir = mutantTree(M.find === null ? [] : [{ file: M.file, find: M.find, to: M.to }]);
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
