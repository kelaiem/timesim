#!/usr/bin/env node
// §337, TODO 294 — THE GEARED BUILD'S INVARIANT, AT EVERY RESERVE THE KEY CUTS METAL FOR. ACCEPTANCE (exits non-zero on a failure).
//
// `GEARED_BUILT` is `SPEC.arrest === 'geared'` (src/layout.js), with none of the sited-hours gate `STOPWORK_SITED_HOURS`
// puts on §329's direct stop-work, so ?arrest=geared cuts metal at every reserve the spec offers while docs/built/0337.md
// records two. Two probes already read parts of that:
//   · tools/probe-337-geared-geneva.mjs holds the LINE at all thirteen — the pair, its cuttability, the Geneva's floors,
//     the pin and stud at yield, the orbit's minimality — off src/geared-geneva.js, which is pure and needs no fold;
//   · tools/probe-337-record.mjs holds the RECORD's measured block to a boot, and so holds exactly the two reserves the
//     record quotes, because it holds the table it parses.
// What NEITHER reads is the two members that only exist once the line is FOLDED into the movement: the branch arm the
// studs hang from, and the cock's stall with their reactions in it. Both are computed at every geared boot and compared
// to a yield there, and both only `console.warn` — and a geared boot already carries 6 to 38 warnings of the reserve's
// own standing debt, so silence at that level cannot be read as a pass by anyone.
//
// So this holds them as an INVARIANT, not as a table. No figure from the record is quoted here and none is frozen as a
// literal (standing rule 1: the derivation stays the source): every rule is a RELATION the build must satisfy at EVERY
// reserve, which is what lets a reserve nobody has ever looked at be gated on the same terms as the two recorded ones.
// That is TODO 294's option 6, and it is deliberately NOT built on tools/probe-337-bulge.mjs, which boots the DEFAULT
// build and re-derives the site and the arm in the probe: gating that would gate the probe's own arithmetic, the second-
// copy trap `lockR1Min`'s comment names in src/geared-geneva.js. Everything below is read off the build's own publication.
//
//   B  BUILT: every reserve the key touches publishes windArrest.stopwork with `built`, and the set is the whole spec
//      (an empty or short set compares nothing and would otherwise read clean);
//   D  DIRECT WHERE IT IS SITED: a reserve publishes EITHER a geared line (a pair) or a direct one (no pair, no `geared`),
//      and a direct one must be a reserve STOPWORK_SITED_HOURS sites — so the key cuts no UNRECORDED metal at 30 h, whose
//      chosen line is ratio one. The set of sited hours is imported, not written here;
//   P  THE PAIR IS CUTTABLE: both counts are whole, neither is under PINION_LEAVES_MIN, and the published ratio IS the
//      two counts' quotient (a ratio alone does not name a pair);
//   A  THE ARM IS SOLVED: a finite positive root width, carrying finite positive stud reactions. The widest of them is
//      named, because WHICH reserve governs the cock bar's own sizing is TODO 294 step 2's open question;
//   S  THE STALL STANDS: every member the cock's stall reads — the bar, its root, the leg, the post, the steady pins —
//      is at or under its own yield on the STATICS reading, at every geared reserve. Held twice: by this probe's own
//      comparison against the published yields, and against the build's own `stallWaiver.staticsOver`. The two must
//      AGREE: a reader that has drifted is a failure here even when both readings are green, which is
//      tools/probe-power-budget.mjs's rule a few items over;
//   M  WITHIN WHAT IT WAS CUT FOR: the stall's root moment stands under the moment the cock's bar was sized to;
//   R  ONE READING EVERYWHERE: the gating reading is `statics` at every geared reserve. A reserve that quietly gated on
//      something else would be a different instrument wearing this one's name.
// The ADDED reading is REPORTED per reserve and gates nothing: §337's waiver is the owner's call, recorded and audited in
// the build itself, and a reserve that stops needing it is an improvement, not a regression.
//
// Controls: every rule is re-run against a deliberately broken copy of each reserve's own reading and must REFUSE it —
// a member one part over its yield, a root moment one part over the design moment, a pair one leaf under the floor, a
// ratio off in the twelfth place, a direct line published at a reserve that is not sited, and the two readers disagreeing.
// A rule that passes its own broken copy has measured nothing, and says so instead of printing PASS.
//
// Cost, measured on an M2 Max (8 performance cores), 2026-11-08: a geared boot is 25-37 s, thirteen at 8 lanes two waves,
// about 80 s of wall. On ubuntu-latest's 4 vCPUs at the 2-lane default, budget 4-8 min (boot-pool.mjs's own bench table).
//   node tools/probe-337-geared-invariant.mjs [--par N]
import { bootMany } from './boot-pool.mjs';
import { STOPWORK_SITED_HOURS, PINION_LEAVES_MIN } from '../src/layout.js';

const args = process.argv.slice(2);
const par = args.includes('--par') ? Number(args[args.indexOf('--par') + 1]) : undefined;
let failed = 0;
const pass = (m) => console.log(`PASS  ${m}`);
const fail = (m) => { failed++; console.log(`FAIL  ${m}`); };
const f3 = (v) => (Number.isFinite(v) ? v.toFixed(3) : String(v));

// the reserves the spec offers, same construction as probe-337-geared-geneva.mjs's: 12 h to 48 h on 3 h steps
const HOURS = Array.from({ length: 13 }, (_, i) => 12 + 3 * i);

// the four members the BUILD's own `over()` lists, so the agreement rule compares like with like; the bar's root is held
// by this probe (rule S) and by rule M, and is deliberately absent from the build's list, so it is not compared there
const BUILT_MEMBERS = [['bar', 'bar_Pa', 'yield_Pa'], ['leg', 'leg_Pa', 'yield_Pa'], ['post', 'post_Pa', 'yield_Pa'],
  ['steady pins', 'pinShear_Pa', 'pinShearYield_Pa']];
const MEMBERS = [...BUILT_MEMBERS, ["bar's root", 'barRoot_Pa', 'yield_Pa']];

const EXPR = `(() => {
  const w = window.__clock.windArrest, s = w && w.stopwork;
  if (!s) return null;
  const c = s.cockStall || {};
  return { built: s.built === true, geared: s.geared === true, n: s.n, m: s.m, ratio: s.ratio,
    zCone: s.zCone ?? null, zFinger: s.zFinger ?? null, branchW: s.branchW ?? null, pairForce: s.pairForce ?? null,
    yield_Pa: c.yield_Pa ?? null, pinShearYield_Pa: c.pinShearYield_Pa ?? null, designMoment_Nu: c.designMoment_Nu ?? null,
    statics: c.statics ?? null, waiver: s.stallWaiver ?? null };
})()`;

// ---- the rules, as functions over ONE reserve's reading, so a broken copy can be put through the same ones ------------
// each returns the complaints it has; no complaint is a pass. `geared` rows take P/A/S/M/R, a `direct` row takes D.
const isGeared = (r) => r.geared === true;

const ruleP = (r) => {
  const out = [];
  for (const [what, z] of [['the cone wheel', r.zCone], ['the finger pinion', r.zFinger]]) {
    if (!Number.isInteger(z)) out.push(`${what} is ${z}, not a whole count`);
    else if (z < PINION_LEAVES_MIN) out.push(`${what} has ${z} teeth, under the movement's ${PINION_LEAVES_MIN}-leaf floor`);
  }
  if (Number.isInteger(r.zCone) && Number.isInteger(r.zFinger)) {
    const q = r.zCone / r.zFinger;
    if (!(Math.abs(r.ratio - q) <= 1e-9 * Math.max(1, Math.abs(q)))) out.push(`the published ratio ${r.ratio} is not ${r.zCone}/${r.zFinger} = ${q}`);
  }
  return out;
};

const ruleA = (r) => {
  const out = [];
  if (!(Number.isFinite(r.branchW) && r.branchW > 0)) out.push(`the branch arm's root width is ${r.branchW}`);
  for (const [what, F] of [['the finger', r.pairForce?.Ff], ['the star', r.pairForce?.Fs]])
    if (!(Number.isFinite(F) && F > 0)) out.push(`${what}'s stud carries ${F}`);
  return out;
};

const ruleS = (r) => {
  const out = [];
  if (!r.statics) return ['the build published no statics reading for the stall'];
  for (const [member, key, yKey] of MEMBERS) {
    const v = r.statics[key], y = r[yKey];
    if (!(Number.isFinite(v) && Number.isFinite(y) && y > 0)) { out.push(`${member} reads ${v} against a yield of ${y}`); continue; }
    if (v > y) out.push(`${member} stands at ${(v / y).toFixed(3)} of its yield`);
  }
  // the two readers: mine against the build's own list of what it finds over on statics
  const mine = MEMBERS.filter(([, key, yKey]) => r.statics[key] > r[yKey]).map(([member]) => member)
    .filter((member) => BUILT_MEMBERS.some(([b]) => b === member));
  const theirs = (r.waiver?.staticsOver ?? []).map(([member]) => member);
  if (mine.sort().join(',') !== theirs.slice().sort().join(','))
    out.push(`the two readers disagree: this probe finds [${mine}] over on statics, the build's own staticsOver says [${theirs}]`);
  return out;
};

const ruleM = (r) => {
  const Mr = r.statics?.rootMoment_Nu, Md = r.designMoment_Nu;
  if (!(Number.isFinite(Mr) && Number.isFinite(Md) && Md > 0)) return [`the root moment reads ${Mr} against a design moment of ${Md}`];
  return Mr > Md ? [`the stall's root moment is ${f3(Mr)}, over the ${f3(Md)} the bar was cut for`] : [];
};

const ruleR = (r) => (r.waiver?.reading === 'statics' ? [] : [`the gating reading is '${r.waiver?.reading}', not statics`]);

const ruleD = (r, hours) => {
  const out = [];
  if (r.zCone !== null || r.zFinger !== null) out.push(`it publishes a pair ${r.zCone} : ${r.zFinger} but not the geared flag`);
  if (!STOPWORK_SITED_HOURS.includes(hours)) out.push(`${hours} h is not a reserve STOPWORK_SITED_HOURS sites, so a direct stop-work here is metal §329 does not record either`);
  return out;
};

const RULES = { P: ruleP, A: ruleA, S: ruleS, M: ruleM, R: ruleR };

// ---- the boots -------------------------------------------------------------------------------------------------------
const boots = await bootMany(HOURS.map((h) => `arrest=geared&reserveh=${h}`), EXPR, { concurrency: par });

const rows = [];
for (const [i, hours] of HOURS.entries()) {
  const b = boots[i];
  if (b.bootError) { fail(`B ${hours} h: ${b.bootError}`); continue; }
  if (!b.extra) { fail(`B ${hours} h: ?arrest=geared published no windArrest.stopwork — the key cut metal nobody can read`); continue; }
  if (b.extra.built !== true) { fail(`B ${hours} h: windArrest.stopwork is published but not built`); continue; }
  rows.push({ hours, r: b.extra, warnings: b.warnings.length, ms: b.ms });
}
if (rows.length === HOURS.length) pass(`B all ${HOURS.length} reserves the key touches publish a built stop-work`);
else fail(`B ${rows.length} of ${HOURS.length} reserves published a built stop-work — the rules below ran on a short set`);

const geared = rows.filter(({ r }) => isGeared(r));
const direct = rows.filter(({ r }) => !isGeared(r));
if (!geared.length) fail('B no reserve built a GEARED stop-work — an empty set satisfies every rule below and would read clean');

console.log(`\n== the set ==  ${geared.length} geared, ${direct.length} direct, of ${HOURS.length} reserves`);
for (const { hours, r, warnings, ms } of rows) {
  const what = isGeared(r)
    ? `${String(r.zCone).padStart(2)} : ${String(r.zFinger).padEnd(2)} n${r.n}m${r.m}  arm ${f3(r.branchW)}`
      + `  bar ${f3(r.statics.bar_Pa / r.yield_Pa)}  root M ${f3(r.statics.rootMoment_Nu / r.designMoment_Nu)}`
      + `  ADDED over [${(r.waiver.addedOver ?? []).map((x) => `${x[0]} ${x[1]}`).join(', ')}]`
    : `direct   n${r.n}m${r.m}`;
  console.log(`  ${String(hours).padStart(2)} h  ${what}   boot ${(ms / 1000).toFixed(1)} s, ${warnings} warning(s)`);
}

// ---- the rules, applied ----------------------------------------------------------------------------------------------
console.log('');
for (const [name, rule] of Object.entries(RULES)) {
  const bad = [];
  for (const { hours, r } of geared) for (const c of rule(r)) bad.push(`${hours} h: ${c}`);
  if (bad.length) for (const c of bad) fail(`${name} ${c}`);
  else pass(`${name} holds at all ${geared.length} geared reserves`);
}
{
  const bad = [];
  for (const { hours, r } of direct) for (const c of ruleD(r, hours)) bad.push(`${hours} h: ${c}`);
  if (bad.length) for (const c of bad) fail(`D ${c}`);
  else pass(`D the ${direct.length} direct reserve(s) publish no pair and are sited by STOPWORK_SITED_HOURS [${STOPWORK_SITED_HOURS.join(', ')}]`);
}

// which reserve governs the cock bar's own sizing — TODO 294 step 2's open question, named rather than assumed
if (geared.length) {
  const widest = geared.reduce((a, b) => (b.r.branchW > a.r.branchW ? b : a));
  console.log(`\n  the widest branch arm of the ${geared.length} is ${widest.hours} h at ${f3(widest.r.branchW)} u`
    + ` (the narrowest ${f3(Math.min(...geared.map(({ r }) => r.branchW)))}); the cock's stall there reads`
    + ` ${f3(widest.r.statics.bar_Pa / widest.r.yield_Pa)} of yield at the bar`);
  const noWaiver = geared.filter(({ r }) => !(r.waiver.addedOver ?? []).length);
  if (noWaiver.length) console.log(`  the statics waiver is no longer load-bearing at ${noWaiver.map(({ hours }) => `${hours} h`).join(', ')} — the build warns there that it should be retired`);
}

// ---- the controls ----------------------------------------------------------------------------------------------------
// each rule, re-run against a copy of each reserve's own reading with one thing deliberately wrong. A rule that accepts
// its broken copy measured nothing, however green it just printed.
console.log('');
const clone = (r) => JSON.parse(JSON.stringify(r));
const over = (x) => x * (1 + 1e-6) + Number.EPSILON;
const CONTROLS = [];
for (const [member, key, yKey] of MEMBERS) CONTROLS.push([`S ${member} one part over its yield`, 'S',
  (r) => { const c = clone(r); c.statics[key] = over(c[yKey]); return c; }]);
CONTROLS.push(['S the build\'s own staticsOver disagreeing with this probe', 'S', (r) => { const c = clone(r); c.waiver.staticsOver = [['bar', 1.01]]; return c; }]);
CONTROLS.push(['M the root moment one part over the design moment', 'M', (r) => { const c = clone(r); c.statics.rootMoment_Nu = over(c.designMoment_Nu); return c; }]);
CONTROLS.push([`P the finger pinion one leaf under the ${PINION_LEAVES_MIN}-leaf floor`, 'P',
  (r) => { const c = clone(r); c.zFinger = PINION_LEAVES_MIN - 1; c.ratio = c.zCone / c.zFinger; return c; }]);
CONTROLS.push(['P the ratio off in its twelfth place', 'P', (r) => { const c = clone(r); c.ratio *= 1 + 1e-7; return c; }]);
CONTROLS.push(['A the branch arm unsolved', 'A', (r) => { const c = clone(r); c.branchW = null; return c; }]);
CONTROLS.push(['A a stud carrying nothing', 'A', (r) => { const c = clone(r); c.pairForce.Fs = 0; return c; }]);
CONTROLS.push(['R the reading quietly changed', 'R', (r) => { const c = clone(r); c.waiver.reading = 'added'; return c; }]);

for (const [what, name, breakIt] of CONTROLS) {
  const accepted = geared.filter(({ r }) => RULES[name](breakIt(r)).length === 0).map(({ hours }) => `${hours} h`);
  if (accepted.length) fail(`control ${what}: rule ${name} still held at ${accepted.join(', ')} — it measured nothing there`);
  else pass(`control ${what}: rule ${name} refuses it at all ${geared.length} reserves`);
}
// and the rule that the SET is not empty: D's siting test must refuse a direct line at a reserve nothing sites
{
  const unsited = HOURS.find((h) => !STOPWORK_SITED_HOURS.includes(h));
  const complaints = ruleD({ zCone: null, zFinger: null }, unsited);
  if (complaints.length) pass(`control D a direct stop-work at ${unsited} h, which nothing sites: refused`);
  else fail(`control D a direct stop-work at ${unsited} h was accepted — D does not test the siting it names`);
}

console.log(failed ? `\n${failed} FAILURE(S)` : '\nall PASS');
process.exit(failed ? 1 : 0);
