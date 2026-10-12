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
//   7. (TODO 134) every reachable reserve has an exact, whole-tooth train —
//      see claim 7 below.
//   6. the fork rows DECLARED in src/layout.js (TECHNIC_FORK) are exactly the
//      solver's chains, per generation. layout.js boot-asserts each declared
//      chain exact and admissible but cannot afford the search that says it is
//      the BEST chain, so the declaration's optimality lives here.
//
// Since §219 tier one the catalogue, the mesh rule and solveRatio are
// layout.js's exports; this probe imports them and keeps no copy.
//   cd tools && node probe-219-catalogue.mjs      (exit 1 on any gated claim)
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const L = await import(join(ROOT, 'src/layout.js'));

// --- exact rationals, the catalogue, the mesh rule and the solver: all
// IMPORTED from src/layout.js since §219 tier one moved them there. This probe
// used to carry its own copies; a second copy is the one that drifts.
const F = L.ratQ, mul = L.ratMul, eq = L.ratEq, show = L.ratStr;
const CATALOGUES = L.CATALOGUES;
const CLASSIC = CATALOGUES.technic_classic.counts;
const solveRatio = L.solveRatio;

const chainStr = (c) => c.chain.map((p) => `${p.a.teeth}:${p.b.teeth}`).join(' × ');
const cdStr = (c) => c.chain.map((p) => (p.cd == null ? '90°' : `${p.cd}mm`)).join(' ');
const kindStr = (c) => [...new Set(c.chain.map((p) => p.class))].join('+');

// ---------------------------------------------------------------------------
// THE INVARIANTS, derived from the shipped movement rather than transcribed.
const T = L.TRAIN;
const steelCentreToFourth = mul(F(T.center.teeth, T.center.pinion), F(T.third.teeth, T.third.pinion));
const steelMotion = mul(F(L.MW_MINUTE_TEETH, L.cannonPinionTeeth), F(L.MW_HOUR_TEETH, L.MW_PINION_TEETH));
const steelGreatWheel = F(T.barrel.teeth, T.barrel.pinion);

// The reduction is not a number, it is a consequence of the SCALE. p0 turns
// RESERVE_BARREL_TURNS = h·pinion/teeth lock-to-lock (the slip coupling makes
// it the arbor's own turns), the hand sweeps RESERVE_SWEEP_DEG, so
// R = turns · 360/sweep. Both inputs are read, not copied: the sweep out of
// main.js (which cannot be imported here — it pulls three), the turns out of
// TRAIN and SPEC.
const mainSrc = readFileSync(join(ROOT, 'src/main.js'), 'utf8');
const swm = mainSrc.match(/const\s+RESERVE_SWEEP_DEG\s*=\s*(\d+)\s*;/);
if (!swm) { console.error('FAIL: RESERVE_SWEEP_DEG is no longer a literal in main.js — this probe must be re-read against it.'); process.exit(1); }
const sweepDeg = Number(swm[1]);
const barrelTurns = F(L.SPEC.reserveHours * T.barrel.pinion, T.barrel.teeth);
const reserveFromScale = mul(barrelTurns, F(360, sweepDeg));

// TODO 134 — the train's counts are SOLVED from the reserve (layout.js's
// reserveTrainCandidates, cut in main.js), so they are read through the same
// function rather than parsed out of an expression. main.js takes the FIRST
// candidate its metal admits; the probe cannot cut metal, so it reads the first
// candidate, which is the shipped train at 30 h — the boot is what holds that
// the build agrees (the identity fingerprint, and the reserve assert beside
// RESERVE_SWEEP_DEG).
if (!/reserveTrainCandidates\(/.test(mainSrc)) { console.error('FAIL: main.js no longer cuts the reserve train from reserveTrainCandidates — this probe must be re-read against it.'); process.exit(1); }
const RSV = L.reserveTrainCandidates(L.reserveReduction(L.SPEC.reserveHours, sweepDeg))[0];
const steelReserve = mul(F(RSV.w1, RSV.p0), F(RSV.w2, RSV.p1));

// RATE_TABLE's law: the fourth wheel turns 1 rev/min, the escape pinion steps
// it up, and each escape tooth is two beats. vph = 60 · (fourthTeeth/escPinion)
// · N · 2. The technic escape row is the SAME law at the catalogue's own
// escapement — an 8-tooth wheel on a 1 Hz balance — not the steel row retuned.
const SHIPPED_ESCAPE_TEETH = 15;   // the club-tooth wheel the 18,000 row runs
const lawRatio = (vph, N) => F(vph, 120 * N);
const shippedLaw = lawRatio(L.SPEC.vph, SHIPPED_ESCAPE_TEETH);
const steelFourthToEscape = F(T.fourth.teeth, T.fourth.pinion);
const { TECHNIC_VPH, TECHNIC_ESCAPE_TEETH } = L;   // 1 Hz knife-edge balance, 8T wheel — layout.js's, not a copy

const INVARIANTS = [
  { key: 'centre→fourth',    target: steelCentreToFourth, steel: `${T.center.teeth}:${T.center.pinion} × ${T.third.teeth}:${T.third.pinion}`, derivedFrom: 'fourth wheel 1 rev/min under a centre wheel at 1 rev/h' },
  { key: 'fourth→escape',    target: lawRatio(TECHNIC_VPH, TECHNIC_ESCAPE_TEETH), steel: `${T.fourth.teeth}:${T.fourth.pinion}`, derivedFrom: `RATE_TABLE's law at ${TECHNIC_VPH} vph on an ${TECHNIC_ESCAPE_TEETH}T wheel` },
  { key: 'motion works',     target: steelMotion, steel: `${L.MW_MINUTE_TEETH}:${L.cannonPinionTeeth} × ${L.MW_HOUR_TEETH}:${L.MW_PINION_TEETH}`, derivedFrom: '12 hours to the hour hand’s one turn' },
  { key: 'reserve reduction',target: steelReserve, steel: `${RSV.w1}:${RSV.p0} × ${RSV.w2}:${RSV.p1}`, derivedFrom: 'the hand’s sweep over the barrel’s usable turns' },
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

// --- claim 6: the DECLARED fork rows in layout.js are the solver's answers --
// layout.js boot-asserts that each declared chain is exact and admissible; it
// cannot assert that a chain is the BEST one, because that needs the search
// above, which is too slow for a boot. So this holds it: per generation and
// row, the declared pairs must be exactly the chain solveRatio returns.
console.log('THE DECLARED ROWS (claim 6) — TECHNIC_FORK in layout.js against the solver');
{
  const targets = { ...L.technicForkTargets(), 'reserve reduction': steelReserve };
  const pairs = (c) => c.map(([a, b]) => `${a}:${b}`).join(' × ');
  const keys = L.TECHNIC_FORK.rows.map((r) => r.key);
  for (const inv of INVARIANTS) if (!keys.includes(inv.key)) fail(`invariant "${inv.key}" has no TECHNIC_FORK row in layout.js`);
  for (const row of L.TECHNIC_FORK.rows) {
    if (!targets[row.key]) { fail(`TECHNIC_FORK row "${row.key}" has no target this probe derives`); continue; }
    for (const [gen, chain] of Object.entries(row.chains)) {
      for (const e of L.technicChainErrors(gen, row.key, chain, targets[row.key])) fail(e);
      const sol = solveRatio(targets[row.key], CATALOGUES[gen]);
      const solved = sol ? sol.chain.map((p) => [p.a.teeth, p.b.teeth]) : null;
      const same = solved && pairs(solved) === pairs(chain);
      console.log(`  ${row.key.padEnd(19)} ${gen.padEnd(16)} declared ${pairs(chain).padEnd(24)} ${same ? 'OK' : `≠ solver ${solved ? pairs(solved) : 'REFUSED'}`}`);
      if (!same) fail(`TECHNIC_FORK "${row.key}" under ${gen} declares ${pairs(chain)}; the solver returns ${solved ? pairs(solved) : 'nothing'}`);
    }
  }
  console.log('');
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
console.log(`  R from the teeth     = ${RSV.w1}/${RSV.p0} × ${RSV.w2}/${RSV.p1} = ${show(steelReserve)}`);
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

// CLAIM 7 — TODO 134, CLOSED: every reserve the spec can produce has an EXACT
// train in whole teeth. Before TODO 134 the second wheel was h/5 with every
// other count fixed, fractional at ten of the thirteen reachable reserves.
// Gated on the arithmetic the probe can see: the first candidate at every
// reachable h multiplies to the scale exactly, keeps stage one's 36-tooth total
// (so rsvD0, which the setting traverse is sited against, does not move) and
// cuts no member under PINION_LEAVES_MIN. Which candidate the METAL admits (the
// tooth floor, the bores) is the build's call; the boots at each reserve are
// that instrument, and they are recorded with TODO 134.
{
  const reach = [];
  for (let h = 12; h <= 48; h += 3) reach.push(h);   // what the clamp can produce
  console.log('THE RESERVE TRAIN (claim 7) — solved from the reserve, exact at every reachable h');
  const rows = [];
  for (const h of reach) {
    const [n, d] = L.reserveReduction(h, sweepDeg);
    const target = F(n, d);
    const c = L.reserveTrainCandidates([n, d])[0];
    if (!c) { fail(`${h} h: no exact train at all`); continue; }
    const prod = mul(F(c.w1, c.p0), F(c.w2, c.p1));
    if (!eq(prod, target)) fail(`${h} h: ${c.w1}/${c.p0} × ${c.w2}/${c.p1} = ${show(prod)}, the scale needs ${show(target)}`);
    if (c.p0 + c.w1 !== L.RSV_STAGE1_TEETH) fail(`${h} h: stage one ${c.p0}+${c.w1} is not the ${L.RSV_STAGE1_TEETH} teeth rsvD0 holds`);
    if (Math.min(c.p0, c.w1, c.p1, c.w2) < L.PINION_LEAVES_MIN) fail(`${h} h: a member under ${L.PINION_LEAVES_MIN} teeth`);
    rows.push(`${String(h).padStart(2)}h ${c.p0}:${c.w1} × ${c.p1}:${c.w2}`);
  }
  console.log(`  first candidates (the build may take a later one where the metal refuses):\n    ${rows.join('\n    ')}\n`);
}

console.log(fails.length ? `FAILED — ${fails.length} claim(s)` : 'PASS — every gated claim holds');
process.exit(fails.length ? 1 : 0);
