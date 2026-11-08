#!/usr/bin/env node
// §329 — WHERE THE STOP-WORK STANDS, HELD TO THE METAL. ACCEPTANCE (exits non-zero on a failure).
//
// The Geneva stop-work is the DEFAULT arrest where layout.js says it stands (since the flip, 2026-11-05; `?arrest=stopwork` is the
// same build): where the LINE reaches the reserve's wind
// (stopworkReaches: a Geneva's travel m + ½ + 1/n equal to reserveHours·pinion/teeth, exact) AND the reserve is in
// STOPWORK_SITED_HOURS, the declared list of reserves whose cone and plate give the star a site. Everywhere else the key folds
// back to §47's stop iron. The list is a MEASUREMENT, and this probe is what measures it: every reserve the spec offers is booted
// with the measurement key `?arrest=stopwork-site`, which runs the stop-work's site search with no fold.
//
//   R1  every reserve the line reaches finds a site exactly when it is listed (a listed reserve with no site would build NO
//       arrest under the key; an unlisted one with a site is a stop-work the fold throws away);
//   R2  no listed reserve is one the line does not reach;
//   R3  the DEFAULT (no key) builds the stop-work at a listed reserve and §47's arrest at every other (the fold);
//   R4  `?arrest=stop-iron` builds §47's arrest at every reserve (the old default, kept buildable).
// Controls: the list with every reached reserve added must fail R1 (45 h finds no site), and an empty list must fail it too (30 h does).
//   node tools/probe-329-stopwork-reserves.mjs [--par N]
import { bootMany } from './boot-pool.mjs';
import { stopworkReaches, STOPWORK_SITED_HOURS } from '../src/layout.js';

const args = process.argv.slice(2);
const par = args.includes('--par') ? Number(args[args.indexOf('--par') + 1]) : undefined;
const HOURS = Array.from({ length: 13 }, (_, i) => 12 + 3 * i);   // the spec's reserves (layout.js: 12–48 h in 3 h steps)
const EXPR = '(() => { const w = window.__clock.windArrest; return { site: !!w?.stopwork?.built, stopIron: !w?.stopwork }; })()';

const reached = HOURS.filter(stopworkReaches);
const site = await bootMany(reached.map((h) => `arrest=stopwork-site&reserveh=${h}`), EXPR, par ? { concurrency: par } : {});
const plain = await bootMany(HOURS.map((h) => `reserveh=${h}`), EXPR, par ? { concurrency: par } : {});
const iron = await bootMany(HOURS.map((h) => `arrest=stop-iron&reserveh=${h}`), EXPR, par ? { concurrency: par } : {});

let failed = 0;
const pass = (m) => console.log(`PASS  ${m}`);
const fail = (m) => { failed++; console.log(`FAIL  ${m}`); };
const sited = (list) => reached.map((h, i) => ({ h, found: !!site[i]?.extra?.site, listed: list.includes(h) }));
const r1 = (list) => sited(list).filter((r) => r.found !== r.listed);

console.log(`the line reaches ${reached.join(', ')} h of ${HOURS.join(', ')}`);
for (const r of sited(STOPWORK_SITED_HOURS)) console.log(`  ${String(r.h).padStart(2)} h  site ${r.found ? 'found' : 'none'}, ${r.listed ? 'listed' : 'not listed'}`);
const bad = r1(STOPWORK_SITED_HOURS);
if (bad.length) fail(`R1 the sited list disagrees with the metal at ${bad.map((r) => `${r.h} h (${r.found ? 'a site, unlisted' : 'listed, no site'})`).join('; ')}`);
else pass(`R1 every reached reserve finds a site exactly when listed (${STOPWORK_SITED_HOURS.join(', ')} h)`);
const unreached = STOPWORK_SITED_HOURS.filter((h) => !stopworkReaches(h));
if (unreached.length) fail(`R2 listed but not reached by the line: ${unreached.join(', ')} h`);
else pass('R2 every listed reserve is one the line reaches');
const wrong = HOURS.map((h, i) => ({ h, r: plain[i]?.extra })).filter(({ h, r }) => !r || (STOPWORK_SITED_HOURS.includes(h) ? !r.site : !r.stopIron));
if (wrong.length) fail(`R3 the default builds the wrong arrest at ${wrong.map((w) => `${w.h} h`).join(', ')}`);
else pass(`R3 the default builds the stop-work at ${STOPWORK_SITED_HOURS.join(', ')} h and §47's stop iron at the other ${HOURS.length - STOPWORK_SITED_HOURS.length}`);
const ironWrong = HOURS.filter((h, i) => !iron[i]?.extra?.stopIron);
if (ironWrong.length) fail(`R4 ?arrest=stop-iron builds the stop-work at ${ironWrong.join(', ')} h`);
else pass(`R4 ?arrest=stop-iron builds §47's stop iron at all ${HOURS.length} reserves`);
// controls: R1 must fire on a list that claims every reached reserve, and on an empty one
const allList = r1(reached), noneList = r1([]);
if (allList.length && noneList.length) pass(`control R1: every reached reserve listed reads ${allList.map((r) => `${r.h} h`).join(', ')} wrong; none listed reads ${noneList.map((r) => `${r.h} h`).join(', ')} wrong`);
else fail('control R1: a wrong list read as right — the probe measured nothing');
console.log(failed ? `${failed} FAILURE(S)` : 'all PASS');
process.exit(failed ? 1 : 0);
