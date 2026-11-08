#!/usr/bin/env node
// §337 landing 2b, stage 3 — THE RECORD'S MEASURED BLOCK, HELD TO THE BUILD. ACCEPTANCE (exits non-zero on a failure).
//
// docs/built/0337.md quotes eleven figures per built reserve - the gear pair, the derived pressure-angle bound and the angle
// the worst section fell at, the cock's four utilisations, its root moment of the design moment, and in prose the bar's worst
// station and the width it is cut there. Every one is read off a BOOT of ?arrest=geared, and until this probe nothing read
// them again. That is the same shape of debt as rule M: probe-337-geared-geneva's rule M was stale from landing 2b's lock fix
// until stage 3 because nothing ran it, and these figures can go stale the same way - a solve moves, the record keeps the old
// number, and no gate anywhere disagrees. tools/probe-337-geared-checks.mjs PRINTS them and judges nothing (it says so in its
// own first line), so it cannot be that gate however often it is run.
//
// So this reads the RECORD as the claim and the BUILD as the truth, which is tools/probe-power-budget.mjs's rule one item
// over: two readers of the same constants must not drift apart in silence. The record's own table is parsed - not a copy of
// its numbers kept here, which would be a third reader to fall behind - and each row is held at THE PRECISION THE RECORD
// QUOTES IT TO (a figure written 0.80 is a claim about two decimals, and rounding the build's reading to the record's own
// dp is what makes "unchanged" mean the same thing to both). Standing rule 1 is why no figure is frozen as a literal here:
// the derivation stays the source, and this only holds the prose to it.
//
// It does NOT re-run the inspector sweeps probe-337-geared-checks also prints. Those cost ~10 min a reserve locally, and
// stage 3 makes no clean-sweep claim on the geared build (the record says so: twelve red rows of the reserve's own standing
// debt). Gating what the record does not claim would be a different landing; this holds what it does.
//
// Controls: each parsed row is perturbed by one unit in its last quoted place and must be REFUSED, so a comparison that
// silently passes everything is itself a failure; and the record must parse to the rows expected, since an empty table
// compares nothing and would otherwise read clean.
//   node tools/probe-337-record.mjs [--par N]
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { bootMany } from './boot-pool.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
const par = args.includes('--par') ? Number(args[args.indexOf('--par') + 1]) : undefined;
let failed = 0;
const pass = (m) => console.log(`PASS  ${m}`);
const fail = (m) => { failed++; console.log(`FAIL  ${m}`); };

// ---- the record, parsed ------------------------------------------------------------------------------------------------
// the minus the record prints is U+2212, not ASCII; bold wrappers and the parenthetical notes ride along and are stripped
const REC = readFileSync(join(ROOT, 'docs/built/0337.md'), 'utf8');
const num = (s) => Number(String(s).replace(/−/g, '-').replace(/[*`°]/g, '').replace(/\s*\(.*$/, '').trim());
const dp = (s) => { const m = /\.(\d+)/.exec(String(s).replace(/−/g, '-').replace(/[*`°]/g, '')); return m ? m[1].length : 0; };
const roundTo = (v, d) => Number(v.toFixed(d));

// the stage-3 measured table: the one whose header row is the two built reserves and whose first column names the figures
const table = (() => {
  const rows = new Map();
  const lines = REC.split('\n');
  const head = lines.findIndex((l) => /^\|\s*\|\s*24 h\s*\|\s*36 h\s*\|\s*$/.test(l));
  if (head < 0) return rows;
  for (let i = head + 2; i < lines.length && lines[i].startsWith('|'); i++) {
    const c = lines[i].split('|').slice(1, -1).map((x) => x.trim());
    if (c.length === 3) rows.set(c[0], { 24: c[1], 36: c[2] });
  }
  return rows;
})();

// the two prose figures beside it: "not its root but 0.90 u out at 24 h and 0.93 u at 36 h, where it is cut 1.64 and 1.38 wide"
const prose = (() => {
  const m = /not its root but ([\d.]+) u out at 24 h and ([\d.]+) u at 36 h, where it is cut ([\d.]+) and ([\d.]+) wide/.exec(REC);
  return m ? { at: { 24: m[1], 36: m[2] }, width: { 24: m[3], 36: m[4] } } : null;
})();

// and the ADDED reading, which is the whole point of the waiver being AUDITED rather than silent: the record carries the number
// the relaxation stands against, so that number is a claim like any other. It drifted with the rest (24 h's bar 2.89 -> 2.99).
const added = (() => {
  const m = /the cock stands \*\*([\d.]+)\u00d7\*\* over yield at 24 h \(the bar; leg ([\d.]+), steady pins ([\d.]+)\) and \*\*([\d.]+)\u00d7\*\* at 36 h \(the leg; bar and pins ([\d.]+)\)/.exec(REC);
  return m ? { 24: { bar: m[1], leg: m[2], 'steady pins': m[3] }, 36: { leg: m[4], bar: m[5], 'steady pins': m[5] } } : null;
})();

const EXPECT = ['the pair built', 'derived φ max', 'the worst fell at', 'bar', "bar's root", 'leg', 'post', 'steady pins',
  'root moment, of the design moment'];
const missing = EXPECT.filter((k) => !table.has(k));
if (missing.length) fail(`the record's measured table did not parse: no row for ${missing.join(', ')} — an unparsed table compares nothing`);
else if (!prose) fail("the record's bar-station sentence did not parse — the two figures beside the table compare nothing");
else if (!added) fail("the record's ADDED sentence did not parse — the numbers the statics waiver stands against compare nothing");
else pass(`the record parsed: ${EXPECT.length} table rows at both reserves, the bar's station and width, and the ADDED reading`);

// ---- what each row is, read off the build -----------------------------------------------------------------------------
// one reading per row, named by the record's own row label, so a row added to the table without a reading here is reported
const READ = {
  'the pair built': (sw) => `${sw.zCone} : ${sw.zFinger}`,
  'derived φ max': (sw) => sw.pressureAngle.maxDeg,
  'the worst fell at': (sw) => sw.pressureAngle.worstDeg,
  bar: (sw) => sw.cockStall.statics.bar_Pa / sw.cockStall.yield_Pa,
  "bar's root": (sw) => sw.cockStall.statics.barRoot_Pa / sw.cockStall.yield_Pa,
  leg: (sw) => sw.cockStall.statics.leg_Pa / sw.cockStall.yield_Pa,
  post: (sw) => sw.cockStall.statics.post_Pa / sw.cockStall.yield_Pa,
  'steady pins': (sw) => sw.cockStall.statics.pinShear_Pa / sw.cockStall.pinShearYield_Pa,
  'root moment, of the design moment': (sw) => [sw.cockStall.statics.rootMoment_Nu, sw.cockStall.designMoment_Nu],
};

// a row holds when the build's reading, rounded to the record's own dp, equals what the record wrote
const holds = (quoted, read) => {
  if (typeof read === 'string') return String(quoted).replace(/[*`]/g, '').trim() === read;
  if (Array.isArray(read)) {                                        // "44.02 of 87.46"
    const q = String(quoted).split(/\s+of\s+/);
    return q.length === 2 && q.every((x, i) => roundTo(read[i], dp(x)) === num(x));
  }
  return roundTo(read, dp(quoted)) === num(quoted);
};

const EXPR = 'window.__clock.windArrest.stopwork';
const boots = await bootMany(['arrest=geared&reserveh=24', 'arrest=geared&reserveh=36'], EXPR, { concurrency: par });

for (const [i, hours] of [24, 36].entries()) {
  const b = boots[i];
  if (b.bootError || !b.extra) { fail(`${hours} h: ${b.bootError ?? 'the build published no windArrest.stopwork'}`); continue; }
  const sw = b.extra;
  console.log(`\n== ${hours} h ==  boot ${(b.ms / 1000).toFixed(1)} s, ${b.warnings.length} warning(s)`);
  if (!sw.geared) { fail(`${hours} h: ?arrest=geared did not build the geared stop-work`); continue; }

  for (const key of EXPECT) {
    const quoted = table.get(key)?.[hours];
    if (quoted === undefined) continue;                             // already reported as a parse failure
    const read = READ[key](sw);
    const shown = Array.isArray(read) ? read.map((x) => x.toFixed(2)).join(' of ') : typeof read === 'string' ? read : read.toFixed(2);
    if (holds(quoted, read)) pass(`${hours} h ${key}: the record says ${quoted}, the build reads ${shown}`);
    else fail(`${hours} h ${key}: the record says ${quoted}, the build reads ${shown} — the record is STALE, or the solve moved and owes a re-reading`);
  }
  if (prose) {
    for (const [what, read] of [['the bar\'s worst station', sw.cockStall.statics.barAt_u], ['the width cut there', sw.cockStall.statics.barWidth_u]]) {
      const quoted = (what === 'the width cut there' ? prose.width : prose.at)[hours];
      if (holds(quoted, read)) pass(`${hours} h ${what}: the record says ${quoted}, the build reads ${read.toFixed(2)}`);
      else fail(`${hours} h ${what}: the record says ${quoted}, the build reads ${read.toFixed(2)} — the record is STALE`);
    }
  }
  // the record's own claim beside the table, and the reading the whole stall waiver stands on
  if (!sw.stallWaiver.staticsOver.length) pass(`${hours} h: nothing reaches the yield on statics (staticsOver empty), as the record states`);
  else fail(`${hours} h: staticsOver is ${JSON.stringify(sw.stallWaiver.staticsOver)} — the record states nothing reaches the yield on statics`);
  if (sw.stallWaiver.reading === 'statics') pass(`${hours} h: the gating reading is statics, the owner's call the record records`);
  else fail(`${hours} h: the gating reading is '${sw.stallWaiver.reading}', not the statics the record records`);

  // the ADDED reading: every member the record names, at the record's own 2 dp, and no member over yield that the record omits
  if (added) {
    const got = new Map(sw.stallWaiver.addedOver);
    for (const [member, quoted] of Object.entries(added[hours])) {
      if (!got.has(member)) { fail(`${hours} h ADDED ${member}: the record says ${quoted}× over yield, the build no longer reads it over at all — the waiver is narrower than the record claims`); continue; }
      if (roundTo(got.get(member), dp(quoted)) === num(quoted)) pass(`${hours} h ADDED ${member}: the record says ${quoted}×, the build reads ${got.get(member)}×`);
      else fail(`${hours} h ADDED ${member}: the record says ${quoted}×, the build reads ${got.get(member)}× — the number the waiver stands against is STALE`);
    }
    const extra = [...got.keys()].filter((k) => !(k in added[hours]));
    if (extra.length) fail(`${hours} h ADDED: the build reads ${extra.join(', ')} over yield too, which the record does not name — the waiver covers more than it says`);
  }

  // CONTROL: one unit in the last quoted place must be refused, per row, or the comparison is passing everything
  if (!b.bootError) {
    const bad = [];
    for (const key of EXPECT) {
      const quoted = table.get(key)?.[hours];
      if (quoted === undefined) continue;
      const read = READ[key](sw);
      const nudged = typeof read === 'string' ? `${read} ` : Array.isArray(read) ? [read[0] + 10 ** -dp(String(quoted).split(/\s+of\s+/)[0]), read[1]]
        : read + 10 ** -dp(quoted);
      if (holds(quoted, nudged)) bad.push(key);
    }
    if (bad.length) fail(`${hours} h controls: a row off by one in its last quoted place still read as holding (${bad.join(', ')}) — this probe measured nothing there`);
    else pass(`${hours} h controls: every one of the ${EXPECT.length} rows is refused one unit off in its last quoted place`);
  }
}

console.log(failed ? `\n${failed} FAILURE(S)` : '\nall PASS');
process.exit(failed ? 1 : 0);
