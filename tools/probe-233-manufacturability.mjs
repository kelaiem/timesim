// §233 — CAN THE MOVEMENT'S MEMBERS ACTUALLY BE MADE?
//
// The repo has two floors on a section and NEITHER of them asks this. §50's
// STOCK_FLOORS are a MATERIAL fact — "below this a solid is not thin metal but
// broken geometry", and its horological tier says what stock a watchmaker draws.
// §54's SLENDER_MAX is a STRUCTURAL fact — a member this slender bends. A part
// can satisfy both and still be a thing no process on earth will produce, and
// the owner found one by eye: the alarm link's lay shaft is 12.65 mm long at
// 0.188 mm across, λ 27 (passes §54) and over §50's floor (passes stockFloor),
// and its L/D is 67. That is not a shaft anyone turns. It is wire.
//
// ITS TWO TIERS SIT ON OPPOSITE SIDES OF §36's convention — REPORT → TRIAGE →
// DECLARE → GATE — and that split is the thing to understand before reading
// either number.
//
// The TURNING tier has been all the way round. It is triaged, its ceiling is
// declared in layout.js as TURN_LD_MAX, and the `turning` check gates it in
// the battery with its twelve failing bars waived against TODO 145. What
// prints here is a READING of the same rows, not a second opinion: this calls
// `turnedBars`, the check's own measurement. One law, two readers.
//
// The FEATURE tier is still a report, and stays one until somebody triages it.
// Its thresholds live in this file rather than in layout.js on purpose: a
// constant in layout.js is one the BUILD derives from, and nothing derives
// from these. They are also the less useful half — 57% of machined members
// fall under the finest of them, which is mostly a statement about SCALE (a
// real caliber's parts ARE 0.1-0.3 mm) rather than about this design.
// Slenderness discriminates where feature size does not, which is why that is
// the half that got promoted.
//
// A report saying "0 violations" has not passed anything, and this one will
// not say that. It exits non-zero only on the shared ruler's own control —
// both of this instrument's rulers were wrong once (the feature tier measured
// markings and hairsprings as if somebody milled them; the turning tier read
// an unrelated field for roundness and then assumed an axis the vertices do
// not have), each was plausible in print, and each answered a question nobody
// asked.
//
//   · Metal laser powder-bed (DMLS/SLM), min free-standing feature 0.40 mm.
//     Vendors quote 0.3–0.5 mm for a feature that survives depowdering and
//     handling; 0.4 is the conservative middle. Below it a feature prints but
//     does not survive.
//   · Resin SLA/DLP, min free-standing feature 0.25 mm. Printable finer, but a
//     free-standing rod thinner than this sags under its own green strength
//     before cure.
//   · 3-axis milling, min feature 0.30 mm — a 0.3 mm end mill is the practical
//     small end, and the feature cannot be finer than the tool that cuts it.
//   · TURNING is not a feature-size limit but a SLENDERNESS one, because a
//     slender bar deflects away from the tool and chatters: L/D ≤ 10
//     unsupported, ≤ 20 with a follower rest or between centres. This is the
//     limit that bites hardest here and the one §50 and §54 between them do not
//     express — §54's λ is about the member bending IN SERVICE, this is about
//     it bending UNDER THE TOOL, and they are different lengths (λ measures a
//     free length between bearings; turning sees the whole bar).
//
// WHAT IT MEASURES, and the two honest limits of it:
//   1. The thinnest dimension per mesh, from `stockCensus` — the same ruler
//      stockFloor uses, so the two tiers are comparable by construction.
//   2. The TURNING ratio, from `turnedBars` in inspect.js — the SAME
//      measurement the `turning` battery check gates, called rather than
//      copied. That is not tidiness: this repo's recurring defect is one law
//      written down twice (the chain's frame law is the worked example), and
//      a report that agreed with the gate only by coincidence would be worse
//      than no report. What lives here is the READING of those rows against
//      cited process thresholds; what lives there is how a bar is found and
//      measured, and why each obvious way of doing it was wrong.
//   3. The bar tier is likewise the check's. A turned member built from
//      several coaxial meshes is one piece of stock, and §232's lay shaft is
//      the case in point: three meshes, each of which passes alone.
// IT ASKS THE KIND FIRST, and the first cut of it did not — which is how a
// report comes back ALARMING while measuring the wrong population, the mirror
// of the skill's clean-but-empty failure. Run without kinds it answered "79% of
// members are under the metal-printing floor" and led with `alarmIndexLine` at
// 0.0076 mm. That is a registration MARKING — §34 declares it `'marking'` and
// it is PRINTED on the disc's face. Nobody mills it, so it cannot fail a
// milling floor. Neither can a hairspring (drawn wire, coiled), a mainspring
// ribbon, or a hand (stamped from sheet). §50 already declares what every mesh
// IS, in STOCK_KIND_BY_MESH / STOCK_KIND_BY_PART, so this reads the same table
// rather than inventing a second opinion — and reports per kind, because the
// answer to "can it be made" depends entirely on which process makes it:
//
//   MACHINED   wheel, pivot, ring — turned, milled, wire-EDM'd or printed from
//              bar or plate. THESE are what a feature floor governs, and they
//              are the headline.
//   FORMED     spring — drawn wire and strip, coiled or bent. A 0.05 mm blade
//              is ordinary spring stock and a milling floor says nothing.
//   STAMPED    hand — blanked from sheet; fine in-plane detail is free, and the
//              thickness is the sheet's.
//   APPLIED    marking — printed, engraved or lacquered ONTO a face. Not a
//              member at all; excluded from every count rather than waived.
//
//   · The FEATURE tier cannot see assemblies — a part made of three meshes is
//     judged as three features, which is right for "can this feature be made"
//     and wrong for "can this part be handled". The turning tier does see them
//     (item 3), but only where the members are coaxial; a bent or jointed
//     member is still judged piecewise.
//   · It cannot see PROCESS CHOICE. A member under the milling floor may be
//     stamped or wire-EDM'd in reality, and a real caliber uses both. The
//     report is "which processes are refused", never "this cannot exist".
//
// Usage: cd tools && node probe-233-manufacturability.mjs [out.json]
import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import { writeFileSync } from 'node:fs';

const PORT = process.env.PORT || 8681;
const ROOT = process.env.ROOT || '..';
const srv = spawn('python3', ['-m', 'http.server', String(PORT), '--bind', '127.0.0.1'], { cwd: ROOT, stdio: 'ignore' });
process.on('exit', () => srv.kill());
await new Promise((r) => setTimeout(r, 900));
const browser = await chromium.launch();
const page = await browser.newPage();
page.on('pageerror', (e) => console.error('PAGEERROR', String(e)));
await page.goto(`http://127.0.0.1:${PORT}/index.html`, { waitUntil: 'load', timeout: 60000 });
await page.waitForFunction(() => !!window.__clock, null, { timeout: 60000 });

const R = await page.evaluate(async () => {
  const I = await import('./src/inspect.js');
  const L = await import('./src/layout.js');
  const { UNIT_MM } = L;
  const clock = window.__clock;
  const c = await I.stockCensus(clock, { yieldEvery: 64 });
  // the SAME table stockFloor resolves through — one declaration, two readers
  const kindOf = (mesh, part) => I.STOCK_KIND_BY_MESH[mesh] || I.STOCK_KIND_BY_PART[part] || 'wheel';

  // ---- the turning tier IS the battery's, called here rather than copied
  const t = await I.turnedBars(clock, { yieldEvery: 64 });

  return { rows: c.thinnestFirst.map((r) => ({ ...r, kind: kindOf(r.mesh, r.part) })),
           unmeasured: c.unmeasured || [], UNIT_MM,
           bars: t.bars, ambiguous: t.ambiguous, control: t.control,
           roundMeshes: t.roundMeshes, allMeshes: t.meshesConsidered,
           TURN_LD_MAX: L.TURN_LD_MAX, TURN_LD_UNSUPPORTED: L.TURN_LD_UNSUPPORTED };
});

const MIN = { dmls: 0.40, sla: 0.25, mill: 0.30 };

// which process makes a member of this kind, and so which floor may judge it
const PROCESS_OF = { wheel: 'MACHINED', pivot: 'MACHINED', ring: 'MACHINED',
                     spring: 'FORMED', hand: 'STAMPED', marking: 'APPLIED' };
const processOf = (kind) => PROCESS_OF[kind] || 'MACHINED';
const all = R.rows.map((r) => ({
  part: r.part, mesh: r.mesh, mm: r.thinnestMM, kind: r.kind,
  process: processOf(r.kind), where: r.where,
}));
const rows = all.filter((r) => r.process === 'MACHINED');
const bars = R.bars.filter((r) => processOf(r.kind) === 'MACHINED');

const under = (k) => rows.filter((r) => r.mm < MIN[k]);
const over = bars.filter((r) => r.LD > R.TURN_LD_MAX);
const rest = bars.filter((r) => r.LD > R.TURN_LD_UNSUPPORTED && r.LD <= R.TURN_LD_MAX);

const byProcess = {};
for (const r of all) (byProcess[r.process] ||= []).push(r);
console.log(`§233 manufacturability — REPORT over ${all.length} measured members\n`);
// the shared measurement's own control, printed rather than re-derived — this
// probe and the `turning` gate are one ruler, so they have one control
console.log(`RULER  ${R.control}`);
console.log(`       ${R.roundMeshes} of ${R.allMeshes} meshes are bodies of revolution;`
  + ` ${R.ambiguous.length} refused as axis-ambiguous (a disc, not a bar)\n`);
console.log('POPULATION, by how the member is made (§50\'s own kind table):');
for (const k of ['MACHINED', 'FORMED', 'STAMPED', 'APPLIED'])
  console.log(`  ${k.padEnd(9)} ${String((byProcess[k] || []).length).padStart(3)}`
    + (k === 'MACHINED' ? '   <- the only population a feature floor governs' : ''));
console.log('');
console.log('MINIMUM FEATURE — members under each process floor:');
for (const k of ['sla', 'mill', 'dmls']) {
  const u = under(k);
  console.log(`  ${k.toUpperCase().padEnd(5)} < ${MIN[k].toFixed(2)} mm : ${String(u.length).padStart(3)} of ${rows.length}`
    + `  (${(100 * u.length / rows.length).toFixed(0)}%)`);
}
console.log('\n  the 12 thinnest, which every process refuses:');
for (const r of rows.slice().sort((a, b) => a.mm - b.mm).slice(0, 12))
  console.log(`    ${String(r.mm.toFixed(4)).padStart(7)} mm  ${r.part} / ${r.mesh}`);

console.log(`\nTURNING — bars over L/D ${R.TURN_LD_MAX}, the ceiling the \`turning\` check gates:`);
console.log(`  ${over.length} of ${bars.length} bars`);
for (const r of over.slice(0, 20))
  console.log(`    L/D ${r.LD.toFixed(1).padStart(6)}   ⌀ ${r.diaMM.toFixed(4)} × ${r.lenMM.toFixed(2)} mm   ${r.part} / ${r.meshes.join(' + ')}`);
console.log(`\n  and ${rest.length} between L/D ${R.TURN_LD_UNSUPPORTED} and ${R.TURN_LD_MAX} — turnable, but wanting a follower rest:`);
for (const r of rest.slice(0, 8))
  console.log(`    L/D ${r.LD.toFixed(1).padStart(6)}   ⌀ ${r.diaMM.toFixed(4)} × ${r.lenMM.toFixed(2)} mm   ${r.part} / ${r.meshes.join(' + ')}`);

const byPart = new Map();
for (const r of under('sla')) byPart.set(r.part, (byPart.get(r.part) || 0) + 1);
console.log('\nBY UNIT — members under even the finest floor (SLA 0.25 mm):');
for (const [p, n] of [...byPart].sort((a, b) => b[1] - a[1]).slice(0, 12))
  console.log(`  ${String(n).padStart(3)}  ${p}`);

const out = process.argv[2];
if (out) {
  writeFileSync(out, JSON.stringify({ MIN, control: R.control,
    maxLD: R.TURN_LD_MAX, unsupportedLD: R.TURN_LD_UNSUPPORTED,
    rows, bars: R.bars, ambiguous: R.ambiguous }, null, 1));
  console.log(`\nwrote ${out}`);
}
await browser.close();
if (!String(R.control).startsWith('PASS')) {
  console.error(`\nFAIL — the ruler's control: ${R.control}.`
    + ' The rows above are NOT readable; the ruler is wrong, not the movement.');
  process.exit(1);
}
process.exit(0);
