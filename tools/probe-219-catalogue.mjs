// §219 tier one — CAN THE MOVEMENT'S INVARIANTS BE RE-TOOTHED TO A PARTS
// CATALOGUE, EXACTLY, AND WHAT DOES THE CATALOGUE REFUSE? Acceptance. The
// fork §219 proposes is a named copy of the reference spec whose changed rows
// each re-derive from the constraint that forced them — here LEGO Technic's
// module-1 catalogue and the stud lattice. This probe is that table, computed
// rather than written: it reads the steel counts off src/layout.js (never a
// copy), solves each invariant over the catalogue as an EXACT rational, and
// prints the §70 row format (key, steel, technic, derivedFrom, kind).
//
// It gates four claims:
//   1. every invariant row solves EXACTLY under technic_2026 — a ratio within
//      a tolerance is a different mechanism, so `null` is the only alternative
//      to an exact chain and a null invariant row is a failure;
//   2. every pair in every returned chain is MESH-COMPATIBLE, and every
//      parallel-axis pair's centre distance lands on the lattice. This is the
//      conjunct the entry was filed without, and its absence is what let the
//      original control through (see claim 4);
//   3. RATE_TABLE's own law reproduces the SHIPPED row from its counts — the
//      law is read off layout.js, so this is the control that says the
//      technic escape row was derived from the same law and not invented;
//   4. a CONTROL target comes back refused under BOTH generations. §219 filed
//      120:7 as that control on the grounds that it has no exact catalogue
//      product. It has one. The probe holds 120:7 as a documented NON-refusal
//      so the correction cannot silently revert, and names a real control from
//      the candidate table instead.
//
// CONTROLS, both directions, per .claude/skills/instruments — a solver that
// only ever succeeds proves nothing, and neither does one that only refuses.
// MUST-HIT: the four invariant rows, and RATE_TABLE's law reproducing the
// shipped count (claim 3) — if the law were misread, every technic escape row
// would be confidently wrong in the same direction. MUST-MISS: the named
// control (claim 4), asserted refused under both generations. The control is
// SEARCHED from the candidate table, not hard-coded: add a 22T to the
// catalogue and 11:1 becomes reachable, at which point the probe names 13:1
// instead. That is the difference between a refusal and a hard-coded `null`.
//
//   5. the reserve reduction DERIVES from the indicator's scale and the tooth
//      counts reproduce it. This is TODO 18's assert restated on the fork's
//      side, and it is here because the note got this row wrong: it carries
//      4.2, which main.js names in its own comment as the superseded
//      150°-arc pair. The shipped movement sweeps 300° since §152
//      (2026-08-21), three weeks before the note was filed. A row read off a
//      scale cannot go stale without this assert firing.
//   cd tools && node probe-219-catalogue.mjs      (exit 1 on any gated claim)
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const L = await import(join(ROOT, 'src/layout.js'));

// --- exact rationals. Floats are banned here on purpose: a 4.2 that is
// --- 4.1997 is a different mechanism, and that is the whole entry.
const gcd = (a, b) => (b ? gcd(b, a % b) : a < 0n ? -a : a);
const F = (n, d = 1n) => { n = BigInt(n); d = BigInt(d); const g = gcd(n, d) || 1n; return { n: n / g, d: d / g }; };
const mul = (a, b) => F(a.n * b.n, a.d * b.d);
const div = (a, b) => F(a.n * b.d, a.d * b.n);
const eq = (a, b) => a.n === b.n && a.d === b.d;
const key = (r) => `${r.n}/${r.d}`;
const show = (r) => (r.d === 1n ? String(r.n) : `${r.n}/${r.d}`);

// ---------------------------------------------------------------------------
// THE CATALOGUE. Read from BrickLink's `Technic, Gear` category (catString
// 136) on 2026-09-12 — see docs/LEGO_FEASIBILITY.md F1, which carries the
// part number for every row and is the source this table must not drift from.
//
// A count is a ROW, not a number. `part` is what a BOM orders, so tier three
// is a print rather than a lookup. `kind` decides whether a centre distance
// means anything: only parallel-axis kinds mesh at the half-sum distance, and
// a catalogue without kinds admits meshes that cannot be built.
//   spur          — plain parallel-axis gear
//   doubleBevel   — bevelled both sides; DOES mesh on parallel axes, which is
//                   what double bevel is for. 28 and 36 exist only this way.
//   turntable     — parallel-axis, but mounts on its own frame, so its centre
//                   distance is not a lattice quantity (F1 says so of 8:60)
//   turntableBevel— the 60T top (18938) is a BEVEL: a 90° mesh, never parallel
// `slips: true` marks a clutch gear. It slips above a torque threshold, so it
// is barred from a going train — a train that slips does not keep time. That
// exclusion is DERIVED, which is why it is a flag and not an omission.
const CLASSIC = [
  { teeth: 8,  part: '3647',  kind: 'spur' },
  { teeth: 12, part: '69778', kind: 'spur' },
  { teeth: 16, part: '4019',  kind: 'spur' },
  { teeth: 20, part: '69779', kind: 'spur' },
  { teeth: 24, part: '3648',  kind: 'spur' },
  { teeth: 28, part: '46372', kind: 'doubleBevel' },  // no plain 28T spur exists
  { teeth: 36, part: '32498', kind: 'doubleBevel' },  // no plain 36T spur exists
  { teeth: 40, part: '3649',  kind: 'spur' },
  { teeth: 56, part: '2855',  kind: 'turntable' },
  { teeth: 60, part: '18938', kind: 'turntableBevel' },
];
// The 2026 wave, all four read with their year: the Icons Road Bike (11380)
// and its siblings. 14T and 18T were absent from the note's first draft.
const TWENTY_SIX = [
  { teeth: 14, part: '7785', kind: 'spur' },
  { teeth: 18, part: '7786', kind: 'spur', slips: true },   // clutch on both sides
  { teeth: 64, part: '7861', kind: 'spur' },
];
const CATALOGUES = {
  technic_classic: { module_mm: 1, lattice_mm: 4, counts: CLASSIC },
  technic_2026:    { module_mm: 1, lattice_mm: 4, counts: [...CLASSIC, ...TWENTY_SIX] },
};

// Mesh admissibility. PARALLEL pairs sit at half the sum of their counts and
// that distance must land on the lattice — whole studs (8 mm), half studs with
// an offset beam (4 mm). A turntable rides its own frame, so it is exempt.
// A RIGHT-ANGLE pair needs exactly one bevel-class member driven by a
// parallel-class one (a spur turning a bevel turntable top, the standard
// idiom); two bevel-class members meshing is not a thing this catalogue does.
const PARALLEL = new Set(['spur', 'doubleBevel', 'turntable']);
const BEVEL = new Set(['bevel', 'turntableBevel']);
const EXEMPT = new Set(['turntable', 'turntableBevel']);

function mesh(a, b, cat, { goingTrain = true } = {}) {
  if (goingTrain && (a.slips || b.slips)) return null;      // a clutch cannot hold a going train
  const bevels = (BEVEL.has(a.kind) ? 1 : 0) + (BEVEL.has(b.kind) ? 1 : 0);
  if (bevels === 2) return null;
  if (bevels === 1) {
    const other = BEVEL.has(a.kind) ? b : a;
    if (!PARALLEL.has(other.kind)) return null;
    return { class: 'right-angle', cd: null };              // not a lattice quantity
  }
  const cd = (a.teeth + b.teeth) / 2;
  if (EXEMPT.has(a.kind) || EXEMPT.has(b.kind)) return { class: 'parallel-exempt', cd };
  if (!Number.isInteger(cd) || cd % cat.lattice_mm !== 0) return null;
  return { class: 'parallel', cd };
}

function pairsOf(cat, opts) {
  const out = [];
  for (const a of cat.counts) for (const b of cat.counts) {
    if (a.teeth === b.teeth) continue;
    const m = mesh(a, b, cat, opts);
    if (m) out.push({ a, b, ratio: F(a.teeth, b.teeth), ...m });  // a drives b: ratio a/b
  }
  return out;
}

// The SHORTEST chain whose product is `target` exactly; ties broken by fewest
// total teeth, because backlash and friction are per mesh (the note's F2).
function solveRatio(target, cat, { maxLen = 6, ...opts } = {}) {
  const P = pairsOf(cat, opts);
  let frontier = new Map([[key(F(1n)), { val: F(1n), teeth: 0, chain: [] }]]);
  for (let depth = 1; depth <= maxLen; depth++) {
    const next = new Map();
    let best = null;
    for (const { val, teeth, chain } of frontier.values()) {
      for (const p of P) {
        const v = mul(val, p.ratio);
        const t = teeth + p.a.teeth + p.b.teeth;
        const ch = [...chain, p];
        if (eq(v, target)) { if (!best || t < best.teeth) best = { teeth: t, chain: ch }; continue; }
        const k = key(v);
        const prev = next.get(k);
        if (!prev || t < prev.teeth) next.set(k, { val: v, teeth: t, chain: ch });
      }
    }
    if (best) return best;
    frontier = next;
  }
  return null;
}

const chainStr = (c) => c.chain.map((p) => `${p.a.teeth}:${p.b.teeth}`).join(' × ');
const cdStr = (c) => c.chain.map((p) => (p.cd == null ? '90°' : `${p.cd}mm`)).join(' ');
const kindStr = (c) => [...new Set(c.chain.map((p) => p.class))].join('+');

// ---------------------------------------------------------------------------
// THE INVARIANTS, derived from the shipped movement rather than transcribed.
const T = L.TRAIN;
const steelCentreToFourth = mul(F(T.center.teeth, T.center.pinion), F(T.third.teeth, T.third.pinion));
const steelMotion = mul(F(L.MW_MINUTE_TEETH, L.cannonPinionTeeth), F(L.MW_HOUR_TEETH, L.MW_PINION_TEETH));
const steelGreatWheel = F(T.barrel.teeth, T.barrel.pinion);

// rsvTeethW2 is declared in main.js, which cannot be imported here (it pulls
// three). Read the EXPRESSION out of the source and evaluate it against SPEC,
// so this stays a reading and never becomes a second copy of the number.
const mainSrc = readFileSync(join(ROOT, 'src/main.js'), 'utf8');
const w2m = mainSrc.match(/const\s+rsvTeethW2\s*=\s*SPEC\.reserveHours\s*\/\s*(\d+)\s*;/);
if (!w2m) { console.error('FAIL: rsvTeethW2 is no longer `SPEC.reserveHours / <n>` in main.js — this probe must be re-read against it.'); process.exit(1); }
const rsvTeethW2 = L.SPEC.reserveHours / Number(w2m[1]);
const steelReserve = mul(F(L.rsvTeethW1, L.rsvTeethP0), F(rsvTeethW2, L.rsvTeethP1));

// The reduction is not a number, it is a consequence of the SCALE. p0 turns
// RESERVE_BARREL_TURNS = h·pinion/teeth lock-to-lock (the slip coupling makes
// it the arbor's own turns), the hand sweeps RESERVE_SWEEP_DEG, so
// R = turns · 360/sweep. Both inputs are read, not copied: the sweep out of
// main.js, the turns out of TRAIN and SPEC.
const swm = mainSrc.match(/const\s+RESERVE_SWEEP_DEG\s*=\s*(\d+)\s*;/);
if (!swm) { console.error('FAIL: RESERVE_SWEEP_DEG is no longer a literal in main.js — this probe must be re-read against it.'); process.exit(1); }
const sweepDeg = Number(swm[1]);
const barrelTurns = F(L.SPEC.reserveHours * T.barrel.pinion, T.barrel.teeth);
const reserveFromScale = mul(barrelTurns, F(360, sweepDeg));

// RATE_TABLE's law: the fourth wheel turns 1 rev/min, the escape pinion steps
// it up, and each escape tooth is two beats. vph = 60 · (fourthTeeth/escPinion)
// · N · 2. The technic escape row is the SAME law at the catalogue's own
// escapement — an 8-tooth wheel on a 1 Hz balance — not the steel row retuned.
const SHIPPED_ESCAPE_TEETH = 15;   // the club-tooth wheel the 18,000 row runs
const lawRatio = (vph, N) => F(vph, 120 * N);
const shippedLaw = lawRatio(L.SPEC.vph, SHIPPED_ESCAPE_TEETH);
const steelFourthToEscape = F(T.fourth.teeth, T.fourth.pinion);
const TECHNIC_VPH = 7200, TECHNIC_ESCAPE_TEETH = 8;   // 1 Hz knife-edge balance, 8T wheel

const INVARIANTS = [
  { key: 'centre→fourth',    target: steelCentreToFourth, steel: `${T.center.teeth}:${T.center.pinion} × ${T.third.teeth}:${T.third.pinion}`, derivedFrom: 'fourth wheel 1 rev/min under a centre wheel at 1 rev/h' },
  { key: 'fourth→escape',    target: lawRatio(TECHNIC_VPH, TECHNIC_ESCAPE_TEETH), steel: `${T.fourth.teeth}:${T.fourth.pinion}`, derivedFrom: `RATE_TABLE's law at ${TECHNIC_VPH} vph on an ${TECHNIC_ESCAPE_TEETH}T wheel` },
  { key: 'motion works',     target: steelMotion, steel: `${L.MW_MINUTE_TEETH}:${L.cannonPinionTeeth} × ${L.MW_HOUR_TEETH}:${L.MW_PINION_TEETH}`, derivedFrom: '12 hours to the hour hand’s one turn' },
  { key: 'reserve reduction',target: steelReserve, steel: `${L.rsvTeethW1}:${L.rsvTeethP0} × ${rsvTeethW2}:${L.rsvTeethP1}`, derivedFrom: 'the hand’s sweep over the barrel’s usable turns' },
];

// Candidate controls, in the order the probe will try them. A control's job is
// to prove the solver REFUSES rather than approximates, so each one is here
// with the reason it should be unreachable — and 120:7 leads, because §219
// filed it as the control and it is not one.
const CONTROLS = [
  { key: 'great wheel 120:7', target: steelGreatWheel, why: "§219's FILED control. It has no invariant of its own in a LEGO build — but it does have an exact catalogue product, which is the correction of 2026-09-12" },
  { key: '11:1',              target: F(11n),  why: '11 is prime and divides no count in the catalogue, so no product of pairs can carry it' },
  { key: '13:1',              target: F(13n),  why: '13 is prime and divides no count in the catalogue' },
];

// ---------------------------------------------------------------------------
const fails = [];
const fail = (m) => { fails.push(m); console.log(`  FAIL  ${m}`); };

console.log('§219 tier one — the technic fork, solved rather than written\n');
console.log(`catalogue read 2026-09-12 from BrickLink category 136 (see docs/LEGO_FEASIBILITY.md F1)`);
console.log(`  technic_classic ${CLASSIC.length} counts · technic_2026 ${CATALOGUES.technic_2026.counts.length} counts`
          + ` (+14T 7785, 18T 7786 clutch, 64T 7861)\n`);

// --- claim 3, first: the law, so the escape row has standing -----------------
console.log('THE LAW (claim 3) — RATE_TABLE reproduces the shipped row from its own counts');
console.log(`  vph ${L.SPEC.vph} on a ${SHIPPED_ESCAPE_TEETH}T wheel  →  law says ${show(shippedLaw)}   TRAIN.fourth says ${show(steelFourthToEscape)}`);
if (!eq(shippedLaw, steelFourthToEscape)) fail(`the law does not reproduce the shipped fourth→escape row — ${show(shippedLaw)} vs ${show(steelFourthToEscape)}`);
else console.log('  OK — the technic escape row below is that law at the catalogue’s own escapement, not the steel row retuned\n');

// --- claims 1 and 2: the fork table ------------------------------------------
for (const gen of ['technic_classic', 'technic_2026']) {
  const cat = CATALOGUES[gen];
  console.log(`FORK TABLE — ${gen}`);
  console.log('  key                 steel                 technic                          meshes  centres              kind');
  for (const inv of INVARIANTS) {
    const sol = solveRatio(inv.target, cat);
    if (!sol) {
      console.log(`  ${inv.key.padEnd(19)} ${inv.steel.padEnd(21)} ${'REFUSED'.padEnd(32)} —`);
      if (gen === 'technic_2026') fail(`invariant "${inv.key}" (${show(inv.target)}) has no exact chain under ${gen} — an invariant row may not be refused`);
      continue;
    }
    console.log(`  ${inv.key.padEnd(19)} ${inv.steel.padEnd(21)} ${chainStr(sol).padEnd(32)} ${String(sol.chain.length).padEnd(7)} ${cdStr(sol).padEnd(20)} ${kindStr(sol)}`);
    for (const p of sol.chain) {
      if (p.class === 'parallel' && (!Number.isInteger(p.cd) || p.cd % cat.lattice_mm !== 0))
        fail(`"${inv.key}" pair ${p.a.teeth}:${p.b.teeth} sits at ${p.cd} mm, off the ${cat.lattice_mm} mm lattice`);
      if (p.a.slips || p.b.slips)
        fail(`"${inv.key}" pair ${p.a.teeth}:${p.b.teeth} uses a clutch gear, which slips — not admissible in a going train`);
    }
    const product = sol.chain.reduce((acc, p) => mul(acc, p.ratio), F(1n));
    if (!eq(product, inv.target)) fail(`"${inv.key}" chain multiplies to ${show(product)}, not ${show(inv.target)} — the solve is not exact`);
  }
  console.log(`  derivedFrom: ${INVARIANTS.map((i) => `${i.key} ← ${i.derivedFrom}`).join('; ')}\n`);
}

// --- claim 4: the control -----------------------------------------------------
console.log('THE CONTROL (claim 4) — a target the catalogue must refuse under BOTH generations');
let control = null;
for (const c of CONTROLS) {
  const perGen = {};
  for (const gen of ['technic_classic', 'technic_2026']) perGen[gen] = solveRatio(c.target, CATALOGUES[gen]);
  const refusedBoth = !perGen.technic_classic && !perGen.technic_2026;
  const verdict = refusedBoth ? 'REFUSED under both' : 'SOLVED';
  console.log(`  ${c.key.padEnd(19)} ${show(c.target).padEnd(9)} ${verdict}`);
  for (const gen of ['technic_classic', 'technic_2026']) {
    const s = perGen[gen];
    console.log(`      ${gen.padEnd(16)} ${s ? `${s.chain.length} mesh  ${chainStr(s)}   ${cdStr(s)}` : 'no exact chain to depth 6'}`);
  }
  console.log(`      why: ${c.why}`);
  if (c.key === 'great wheel 120:7') {
    // §219 filed this as the control. It is not one, and the entry is corrected
    // to say so — this assert holds the correction rather than the old claim.
    if (refusedBoth) fail('120:7 came back REFUSED. §219 was corrected on 2026-09-12 to record that it is NOT — if the catalogue or the mesh rules have changed so that it is refused again, that correction and this probe both need re-deriving, deliberately.');
    else console.log('      → the documented NON-refusal holds: §219’s filed control is not a control');
  } else if (refusedBoth && !control) control = c;
  console.log('');
}
if (!control) fail('no candidate came back refused under both generations — §219 has no control, and a solver that never refuses proves nothing');
else console.log(`  CONTROL NAMED: ${control.key} (${show(control.target)}) — refused under both generations\n`);

// --- reported, not gated: where the steel side disagrees with the note --------
// The clutch exclusion is enforced in mesh(), so the solver never OFFERS a
// clutch pair; the per-row check above can only fire if mesh() regresses. It
// is a backstop, and saying so is cheaper than implying it is exercised —
// measured: with the exclusion removed, every chain above is unchanged, so no
// invariant needs the 18T. The rule costs nothing here and is kept because it
// is true, not because it is load-bearing.
const usesClutch = INVARIANTS.some((inv) => {
  const sol = solveRatio(inv.target, CATALOGUES.technic_2026);
  return sol && sol.chain.some((p) => p.a.slips || p.b.slips);
});
console.log(`THE CLUTCH RULE — 18T (7786) is barred from a going train because it slips.`);
console.log(`  no invariant chain uses it${usesClutch ? ' — BUT ONE DOES, which contradicts the rule' : '; the exclusion is a rule that currently costs nothing'}\n`);
if (usesClutch) fail('an invariant chain uses a clutch gear — mesh() is not applying the going-train exclusion');

console.log('THE RESERVE SCALE (claim 5) — the reduction is a consequence, not a number');
console.log(`  RESERVE_BARREL_TURNS = ${L.SPEC.reserveHours}h · ${T.barrel.pinion}/${T.barrel.teeth} = ${show(barrelTurns)} turns lock-to-lock`);
console.log(`  RESERVE_SWEEP_DEG    = ${sweepDeg}° (read from src/main.js)`);
console.log(`  R from the scale     = ${show(barrelTurns)} · 360/${sweepDeg} = ${show(reserveFromScale)}`);
console.log(`  R from the teeth     = ${L.rsvTeethW1}/${L.rsvTeethP0} × ${rsvTeethW2}/${L.rsvTeethP1} = ${show(steelReserve)}`);
if (!eq(reserveFromScale, steelReserve)) fail(`the reserve reduction does not follow its own scale — ${show(reserveFromScale)} from the graduation, ${show(steelReserve)} from the counts. This is TODO 18's failure recurring: the display quantity and the gears drifted apart.`);
else console.log(`  OK — they agree, so the technic row above was solved against the SHIPPED scale\n`);

// The history this row has, because it is the row the note got wrong and the
// shape of that error is worth keeping: each state was internally consistent,
// which is exactly why the stale one survived being read.
console.log('  the same reduction through its regraduations — main.js states the first three:');
for (const [label, turns, sweep] of [
  ['120° arc, 3.75-turn arbor (pre-TODO 18)', F(15n, 4n), 120],
  ['150° arc, 3.75-turn arbor (TODO 18)',     F(15n, 4n), 150],
  ['150° arc, 1.75-turn arbor (post-§124)',   F(7n, 4n),  150],
  ['300° arc, 1.75-turn arbor (§152, shipped)', F(7n, 4n), 300],
]) {
  const r = mul(turns, F(360, sweep));
  const here = sweep === sweepDeg && eq(turns, barrelTurns);
  console.log(`    ${label.padEnd(42)} R = ${show(r).padEnd(6)}${here ? '  ← shipped' : ''}${show(r) === '21/5' ? '  ← the figure docs/LEGO_FEASIBILITY.md §3.6 carries' : ''}`);
}
console.log(`  §152 widened the arc on 2026-08-21; the note was filed 2026-09-11, so it was stale on the day it was written.\n`);

console.log(fails.length ? `FAILED — ${fails.length} claim(s)` : 'PASS — every gated claim holds');
process.exit(fails.length ? 1 : 0);
