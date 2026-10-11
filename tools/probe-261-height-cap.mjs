// THE HEIGHT CAP FIRES BOTH WAYS — §261 step 5's CASE_HEIGHT_MAX_MM, mutated and
// booted, so the ratchet is a guard someone has seen fire rather than a comment.
//
// ACCEPTANCE. The cap (layout.js) is a RATCHET: main.js warns when the cased
// depth exceeds it (the case GREW, on any build) and when the DEFAULT build
// stands more than CASE_HEIGHT_STEP_MM under it (the cap went STALE — a landing
// bought depth and did not lower the cap, so the depth was never held). Four
// boots, each a copied tree:
//   1. identity        — the shipped cap: no §261 line (and the ledger's depth
//                        rounds up to exactly the cap, so it is tight).
//   2. cap − 2 steps   — the default build is now "deeper than the cap": the
//                        GREW line must fire, and the stale line must not.
//   3. cap + 2 steps   — the default build stands two steps under: STALE fires.
//   4. cap + 2 steps, booted reconfigured (?studr=4.71, a listed point that
//      boots silent) — STALE must NOT fire, because a reconfigured build owes
//      the cap nothing. This is the control on the config gate: without it a
//      stale line on every reconfigured boot would read exactly like case 3.
// It reads the warnings the page actually printed, through height-ledger's boot.
//
// What it is NOT: probe-261-height-ledger.mjs measures the depth and its
// chains; this holds the assert that guards the number the ledger measured.
//
// Run from tools/: node probe-261-height-cap.mjs
import { boot, mutantTree, ROOT, setPortBase } from './height-ledger.mjs';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

setPortBase(8571);
const LAYOUT = 'src/layout.js';
const src = readFileSync(join(ROOT, LAYOUT), 'utf8');
const m = src.match(/export const CASE_HEIGHT_MAX_MM = ([0-9.]+);/);
const st = src.match(/export const CASE_HEIGHT_STEP_MM = ([0-9.]+);/);
if (!m || !st) { console.log('FAIL: CASE_HEIGHT_MAX_MM / CASE_HEIGHT_STEP_MM not found in layout.js'); process.exit(2); }
const CAP = Number(m[1]), STEP = Number(st[1]);
const capLine = m[0];
const withCap = (v) => mutantTree([{ file: LAYOUT, find: capLine, to: `export const CASE_HEIGHT_MAX_MM = ${v.toFixed(3)};` }]);

const lines = (w) => ({ grew: w.filter((x) => /^§261: .*over CASE_HEIGHT_MAX_MM/.test(x)), stale: w.filter((x) => /^§261: .*under CASE_HEIGHT_MAX_MM/.test(x)), other261: w.filter((x) => /^§261:/.test(x) && !/CASE_HEIGHT_MAX_MM/.test(x)), all: w });
const cases = [
  { name: 'identity', dir: () => mutantTree([]), query: '', want: { grew: 0, stale: 0 } },
  { name: `cap − 2 steps (${(CAP - 2 * STEP).toFixed(3)})`, dir: () => withCap(CAP - 2 * STEP), query: '', want: { grew: 1, stale: 0 } },
  { name: `cap + 2 steps (${(CAP + 2 * STEP).toFixed(3)})`, dir: () => withCap(CAP + 2 * STEP), query: '', want: { grew: 0, stale: 1 } },
  { name: `cap + 2 steps, reconfigured ?studr=4.71`, dir: () => withCap(CAP + 2 * STEP), query: 'studr=4.71', want: { grew: 0, stale: 0 } },
];
let ok = true;
for (const c of cases) {
  const r = await boot(c.dir(), c.query);
  const l = lines(r.warns);
  const good = l.grew.length === c.want.grew && l.stale.length === c.want.stale && l.other261.length === 0;
  if (!good) ok = false;
  console.log(`${good ? 'PASS' : 'FAIL'}  ${c.name}: grew ${l.grew.length}/${c.want.grew}, stale ${l.stale.length}/${c.want.stale}${l.other261.length ? `, other §261 lines ${l.other261.length}` : ''}`);
  for (const x of [...l.grew, ...l.stale, ...l.other261]) console.log(`      ${x}`);
  if (c.name === 'identity' && r.warns.length) { ok = false; console.log(`      the identity boot is not silent (${r.warns.length}): ${r.warns.slice(0, 3).join(' | ')}`); }
}
console.log(ok ? `\nPASS — CASE_HEIGHT_MAX_MM ${CAP} fires on growth and on staleness, and the stale half reads the default config only`
  : '\nFAIL — the height cap does not fire as declared');
process.exit(ok ? 0 : 2);
