// WHAT EACH HEIGHT LEVER BUYS — the compaction levers of the private roadmap's
// §261, each built as a copied tree with one constant moved, measured off the
// metal for what it does to the cased depth, which member governs after it, and
// which boot asserts it trips (its cost). Combinations are measured too, beside
// the superposition of their singles, because the back is governed jointly and
// a lever bought alone is not the lever bought with its neighbours.
//
// REPORT (exit 0 with the table; exit 2 only when a CONTROL says the harness
// measured nothing). Step 1 of §261. Prices are what the build DID, not what a
// lever is worth: a lever sized here by an arbitrary delta is a sensitivity,
// and its row says so; the design value of each lever is the roadmap's to set.
//
// What this is NOT: probe-261-height-ledger.mjs is the acceptance that the
// ledger reproduces the build and predicts its mutants; this file USES that
// ledger (one law, imported from height-ledger.mjs) to price moves it has not
// been told about. probe-192-tier-price.mjs prices the strike tower's ladder
// against the glass step, which since §192 is not what sets the cased depth.
//
// Two kinds of row:
//   BUILT — a copied tree with the constant moved, booted and measured. The
//     depth column is metal; the "ledger said" column is what the unmutated
//     ledger predicts where it CAN (a lever acting through the case chain or
//     the envelope); a lever that moves the movement itself (the plate, the
//     hairspring plane) has no ledger prediction and is measured only.
//   ARITHMETIC — a lever that is not one constant (the swept skirt-annulus
//     ceiling, which needs TODO 111's construction pose fixed, not a number
//     edited), priced by the ledger on the base boot's own envelope bins. The
//     ledger's bin arithmetic is what probe-261-height-ledger's mutation tier
//     holds to 1e-5, which is the warrant for using it here.
//
// CONTROLS (exit 2): an identity copy reproduces the direct boot face for face;
// the FRONT lever (the crystal's clearance) is the one whose price is known in
// closed form, 1:1 at the front, and must measure exactly that.
//
// Run: cd tools && node probe-261-lever-prices.mjs   (ROOT= for another tree)
import { rmSync } from 'node:fs';
import { ROOT, boot, mutantTree, ledger, backChain, backMost, foldEnvelope, setPortBase } from './height-ledger.mjs';

setPortBase(8571);
const EPS = 1e-5;
const f4 = (x) => (x === null || x === undefined || !Number.isFinite(x)) ? String(x) : x.toFixed(4);

// Every face the price table reads, off one boot.
function faces(m) {
  const L = ledger(m);
  return {
    front: L.frontCase, movFront: m.front.z, midBack: m.glass.paneInner,
    ring: m.caseParts.caseBack.zMax, keys: m.caseParts.caseBackKey?.zMax ?? -Infinity,
    stepTop: m.caseParts.caseBackCrystal?.zMax ?? -Infinity, stepUnder: m.glass.zStepUnder,
    back: L.bm.top.z, depth: L.depth, governor: L.bm.top.by, slack: L.bm.slack, L,
  };
}

console.log('§261 lever prices — booting the tree under test…');
const base = await boot(ROOT);
const U = base.L.UNIT_MM, mm = (u) => (u * U).toFixed(3) + ' mm';
const B = faces(base);
console.log(`base: cased depth ${f4(B.depth)} u = ${mm(B.depth)}; back governed by ${B.governor} (${mm(B.slack)} over the next)`);
if (base.warns.length) console.log(`NOTE: the base boot is not silent (${base.warns.length}) — every lever's warning count below is net of these`);
const baseWarn = new Set(base.warns);

const MM = (x) => `${x} / UNIT_MM`;
// Each lever: the patches, its size in units, and what the ledger predicts for
// the depth where it can. Anchors are the source text exactly; a stale anchor
// throws rather than booting an unmutated tree.
const LEVERS = [
  { key: 'identity', name: 'identity — the tree copied unchanged (control)', patches: [], delta: 0, predict: () => B.depth },
  { key: 'front', name: 'L7 front: CASE_CRYSTAL_CLEAR 0.3 → 0.2 mm (the crystal stands closer to the minute pipe)',
    patches: [{ file: 'src/layout.js', find: 'export const CASE_CRYSTAL_CLEAR = 0.3 / UNIT_MM;', to: 'export const CASE_CRYSTAL_CLEAR = 0.2 / UNIT_MM;' }],
    delta: 0.1 / U, predict: () => B.depth - 0.1 / U },
  { key: 'keys', name: 'L1b keys: the ring\'s wrench keys 0.15 → 0.05 mm tall',
    patches: [{ file: 'src/geometry.js', find: '    const keyT = 0.15 / UNIT_MM;', to: '    const keyT = 0.05 / UNIT_MM;' }],
    delta: 0.1 / U, predict: null },
  { key: 'thread', name: 'L1 ring chain: the back ring\'s thread engagement CASE_CLAMP_ENG 0.7 → 0.5 mm',
    patches: [{ file: 'src/main.js', find: 'const CASE_CLAMP_ENG = 0.7 / UNIT_MM;', to: 'const CASE_CLAMP_ENG = 0.5 / UNIT_MM;' }],
    delta: 0.2 / U,
    // Through the ledger: the skirt arm drops 0.2 mm until the pane floor binds; the ring and keys ride it.
    predict: () => { const L = B.L; const ch = backChain(base, base.env.bins, L.eng - 0.2 / U, L.ringRise, L.keyRise);
      return backMost(base, ch, base).top.z - L.frontCase; } },
  { key: 'tower', name: 'L4 tower: the three-quarter plate TQ_T − 0.3 u (sensitivity — everything above the plate rides it)',
    patches: [{ file: 'src/main.js', find: 'const TQ_T = PLATE_SCREW_HEAD_T + STOCK_MIN_U;', to: 'const TQ_T = PLATE_SCREW_HEAD_T + STOCK_MIN_U - 0.3;' }],
    delta: 0.3, predict: null },
  { key: 'spring', name: 'L5 oscillator: L_HAIRSPRING = L_BALANCE + 1.2 → + 1.0 (sensitivity — the plate floor rides the spring)',
    patches: [{ file: 'src/layout.js', find: 'export const L_HAIRSPRING = L_BALANCE + 1.2;', to: 'export const L_HAIRSPRING = L_BALANCE + 1.0;' }],
    delta: 0.2, predict: null },
];
const COMBOS = [
  { key: 'ring', of: ['keys', 'thread'], name: 'the ring chain whole: keys + thread engagement' },
  { key: 'ring+tower', of: ['keys', 'thread', 'tower'], name: 'the ring chain + the tower' },
];

const runs = {};
async function run(key, name, patches) {
  let dir = null;
  try {
    dir = mutantTree(patches);
    const m = await boot(dir);
    runs[key] = { name, F: faces(m), warns: m.warns.filter((w) => !baseWarn.has(w)) };
  } catch (e) { runs[key] = { name, err: String(e.message || e) }; }
  finally { if (dir) rmSync(dir, { recursive: true, force: true }); }
}
for (const Lv of LEVERS) await run(Lv.key, Lv.name, Lv.patches);
for (const C of COMBOS) await run(C.key, C.name, C.of.flatMap((k) => LEVERS.find((l) => l.key === k).patches));

// --- controls --------------------------------------------------------------
const ctl = [];
const id = runs.identity;
if (id.err) ctl.push(`identity copy failed to boot: ${id.err}`);
else for (const k of ['front', 'midBack', 'keys', 'stepTop', 'back', 'depth'])
  if (Math.abs(id.F[k] - B[k]) > EPS) ctl.push(`identity copy moved ${k}: ${f4(B[k])} → ${f4(id.F[k])}`);
const fr = runs.front, frPred = LEVERS.find((l) => l.key === 'front').predict();
if (fr.err) ctl.push(`front lever failed to boot: ${fr.err}`);
else if (Math.abs(fr.F.depth - frPred) > EPS) ctl.push(`front lever moved the depth to ${f4(fr.F.depth)}, closed form says ${f4(frPred)} — the front chain is not 1:1 or the scan read the wrong face`);

// --- the table -------------------------------------------------------------
console.log('\nBUILT — one constant moved per row (Δ is the lever\'s size; bought = base depth − lever depth)');
console.log('  lever'.padEnd(64) + 'Δ (mm)   bought (mm)   per mm of Δ   ledger said   governor after / new warnings');
const rowOf = (key, name, delta, pred) => {
  const r = runs[key];
  if (r.err) { console.log(`  ${name}\n      FAILED: ${r.err}`); return; }
  const bought = B.depth - r.F.depth;
  const per = delta > 0 ? (bought / delta).toFixed(3) : '—';
  const ps = pred === null ? 'n/a' : `${((B.depth - pred) * U).toFixed(3)}${Math.abs(pred - r.F.depth) <= EPS ? ' ✓' : ' ✗'}`;
  console.log(`  ${name}`);
  console.log(`      ${(delta * U).toFixed(3).padStart(6)}   ${(bought * U).toFixed(3).padStart(11)}   ${per.padStart(11)}   ${ps.padStart(11)}   ${r.F.governor} (+${mm(r.F.slack)} over the next)`);
  const moved = ['front', 'midBack', 'keys', 'stepTop'].map((k) => `${k} ${(r.F[k] - B[k] >= 0 ? '+' : '')}${f4(r.F[k] - B[k])}`).join(', ');
  console.log(`      faces moved (u): ${moved}`);
  if (r.warns.length) console.log(`      COST — ${r.warns.length} new boot warning(s): ${r.warns.slice(0, 3).map((w) => w.slice(0, 160)).join(' | ')}`);
};
for (const Lv of LEVERS) rowOf(Lv.key, Lv.name, Lv.delta, Lv.predict ? Lv.predict() : null);

console.log('\nCOMBINATIONS — measured beside the superposition of their singles (the difference is a governor changing hands)');
for (const C of COMBOS) {
  const r = runs[C.key];
  if (r.err) { console.log(`  ${C.name}: FAILED ${r.err}`); continue; }
  const sumSingles = C.of.reduce((s, k) => s + (runs[k].err ? NaN : B.depth - runs[k].F.depth), 0);
  const bought = B.depth - r.F.depth;
  console.log(`  ${C.name}: bought ${mm(bought)}   singles summed ${mm(sumSingles)}   governor after: ${r.F.governor} (+${mm(r.F.slack)})`);
  if (r.warns.length) console.log(`      COST — ${r.warns.length} new boot warning(s): ${r.warns.slice(0, 3).map((w) => w.slice(0, 160)).join(' | ')}`);
}

// --- arithmetic rows -------------------------------------------------------
// Levers that are not one constant, priced by the ledger on envelopes re-folded
// from the per-unit maxima the build's own walk recorded (foldEnvelope). The
// fold must first reproduce the shipped bins, or nothing below is a price.
console.log('\nARITHMETIC — not one constant; priced by the ledger on the base boot\'s re-folded envelope');
if (!base.env.unitBins) ctl.push('this tree exposes no backEnvelope.unitBins — the arithmetic tier cannot fold');
else {
  const refold = foldEnvelope(base.env, []);
  const bad = refold.filter((b, s) => (b.z === null) !== (base.env.bins[s].z === null) || (b.z !== null && Math.abs(b.z - base.env.bins[s].z) > 1e-9));
  if (bad.length) ctl.push(`the per-unit envelope does not re-fold into the shipped bins (${bad.length} bins differ) — it is not the same walk`);
  else console.log(`  fold control PASS: ${refold.length} bins re-folded from ${Object.keys(base.env.unitBins).length} units' own maxima reproduce the shipped envelope exactly`);

  const L = B.L;
  const R_BORE_BACK = base.L.CASE_WIDTH_MAX - base.L.CASE_BAND_T;
  // The skirt annulus is set by the declared row 'Alarm switch' r 48.3–49.6 at
  // 10.08, which stands on the pusher-side linkage's CONSTRUCTION pose (TODO
  // 111); §226 measured no Alarm switch metal above 8.305 there over the pose
  // net. Fixing the construction pose is that lever, not editing the row.
  const SWEPT_CEILING = 8.305;
  const ceil = (bins) => bins.map((x) => (x.z !== null && x.r1 > base.glass.skirtID && x.r0 < R_BORE_BACK && x.z > SWEPT_CEILING)
    ? { ...x, z: SWEPT_CEILING, owner: 'the annulus at its swept ceiling' } : x);
  // The switch group the fold would take out of the tower: the column wheel,
  // its driver, pawl, blade and pusher (all 'Alarm switch'), the lock, and the
  // selector link that runs plate to dial.
  const FOLD = ['Alarm switch', 'Alarm lock', 'Alarm link'];
  const rows = [
    { name: 'L1 the skirt annulus at its swept ceiling (TODO 111\'s construction pose fixed)', bins: ceil(base.env.bins) },
    { name: 'L2 the dial-side fold: Alarm switch, lock and link out of the tower', bins: foldEnvelope(base.env, FOLD) },
    { name: 'L2 + L1', bins: ceil(foldEnvelope(base.env, FOLD)) },
    { name: 'L2 + L1 + keys flush with the ring face (L1b)', bins: ceil(foldEnvelope(base.env, FOLD)), keyRise: 0 },
  ];
  for (const r of rows) {
    const ch = backChain(base, r.bins, L.eng, L.ringRise, r.keyRise ?? L.keyRise);
    const bm = backMost(base, ch, base);
    const d = bm.top.z - L.frontCase;
    console.log(`  ${r.name}`);
    console.log(`      bought ${mm(B.depth - d)}  (cased ${mm(d)});  band back face ${f4(ch.midBack)} set by ${ch.midBy}; glass step ${f4(ch.stepUnder)} under ${ch.stepBy}`);
    console.log(`      back governed by ${bm.top.by} (+${mm(bm.slack)} over ${bm.next.by})`);
  }
}

console.log('');
if (ctl.length) { for (const c of ctl) console.log('CONTROL FAIL  ' + c); console.log('exit 2 — the harness measured the wrong thing; the table above is not a price list'); process.exit(2); }
console.log('controls PASS — the identity copy reproduced the direct boot, and the front lever bought exactly its closed form');
