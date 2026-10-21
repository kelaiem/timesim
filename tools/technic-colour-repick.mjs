#!/usr/bin/env node
// WHAT THE COLOUR RE-PICK CHANGES (BUILT §303): re-runs repickColours from the §300 table, prints the table
// it derives, whether src/technic-ldraw.js' LDRAW_COLOUR equals it, each role that moved, each pair of
// roles it MERGED (two roles that share a build and a part, or only a build, and had different colours
// before and have one now), and the per-build line counts BrickLink lists nothing for, before and after.
// A REPORT (prints, exits non-zero only when the shipped table differs from the derivation); the gate is
// tools/probe-technic-bom.mjs. `--write` prints the LDRAW_COLOUR rows to paste.
//
//   node tools/technic-colour-repick.mjs [--write]
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseLibrary } from '../src/ldraw.js';
import { LDRAW_COLOUR } from '../src/technic-ldraw.js';
import { repickColours, colourOf, COLOUR_BASELINE_300, partKey } from '../src/technic-colour.js';
import * as B from '../src/technic-bom.js';

const lib = parseLibrary(readFileSync(join(dirname(fileURLToPath(import.meta.url)), '../vendor/ldraw/technic-parts.mpd'), 'utf8'));
const listedIn = B.isListed;
export const BASE = [0, 1, 2, 4, 14, 15, 19, 25, 71, 72], EXTRA = [321];
const units = B.colourUnits(lib);
const r = repickColours({ units, listed: listedIn, base: BASE, extra: EXTRA, current: COLOUR_BASELINE_300 });
const name = (c) => B.COLOUR_INFO[c]?.name ?? c;
console.log(`derived table: ${Object.keys(r.table).length} rows, ${r.exceptions.length} exceptions (${r.exceptions.join(', ')}), extended: ${r.extended.join(', ') || 'none'}`);
const same = JSON.stringify(Object.entries(r.table).sort()) === JSON.stringify(Object.entries(LDRAW_COLOUR).sort());
console.log(`shipped LDRAW_COLOUR ${same ? 'EQUALS' : 'DIFFERS FROM'} the derivation`);
if (process.argv.includes('--write')) console.log(Object.entries(r.table).map(([k, v]) => `${/\W/.test(k) ? `'${k}'` : k}: ${v}`).join(', '));
console.log('\nROLES THAT MOVED');
for (const u of units) {
  const k = partKey(u.role, u.part), before = colourOf(COLOUR_BASELINE_300, u.role, u.part), after = colourOf(r.table, u.role, u.part);
  if (before !== after) console.log(`  ${k.padEnd(18)} ${name(before).padEnd(18)} -> ${name(after).padEnd(18)} ${listedIn(u.part, before) ? '' : '(was unlisted)'}`);
}
console.log('\nMERGES (roles sharing a build; same part marked *)');
const seen = new Set();
for (const a of units) for (const b of units) {
  if (a.role >= b.role) continue;
  const bs = a.builds.filter((x) => b.builds.includes(x));
  if (!bs.length) continue;
  const ba = colourOf(COLOUR_BASELINE_300, a.role, a.part), bb = colourOf(COLOUR_BASELINE_300, b.role, b.part), na = colourOf(r.table, a.role, a.part), nb = colourOf(r.table, b.role, b.part);
  if (ba !== bb && na === nb) { const k = `${a.role}/${a.part} + ${b.role}/${b.part}`; if (!seen.has(k)) { seen.add(k); console.log(`  ${a.part === b.part ? '*' : ' '} ${k.padEnd(34)} now both ${name(na)} (were ${name(ba)} / ${name(bb)}) in ${bs.length} build(s)`); } }
}
console.log('\nUNLISTED LINES PER BUILD (2026 / classic), before -> after');
let tb = 0, ta = 0, tl = 0;
for (const gen of B.GENERATIONS) for (const cell of B.cellIds()) {
  const build = B.buildOf(lib, gen, cell).build; if (!build) continue;
  const count = (colours) => { const b = B.bomOf(build, lib, { colours }); return [b.lines.filter((l) => !l.bricklink?.listed).length, b.lines.length]; };
  const [ub, lb] = count(COLOUR_BASELINE_300), [ua, la] = count(LDRAW_COLOUR);
  console.log(`  ${gen.slice(7).padEnd(8)} ${cell.padEnd(11)} lines ${String(lb).padStart(2)} -> ${String(la).padStart(2)}   unlisted ${ub} -> ${ua}`);
  if (gen === B.GENERATIONS[0]) { tb += ub; ta += ua; tl += lb; }
}
console.log(`  2026 total: ${tl} lines before, unlisted ${tb} -> ${ta}`);
process.exit(same ? 0 : 1);
