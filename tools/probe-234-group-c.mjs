// §234 Landing 1 — CAN TODO 145's GROUP C BE CLOSED BY SECTION ALONE?
//
// TODO 145 filed three bars as "section-only": the two alarm winding arrest
// columns (alarmArrestArbor, subIdlerArbor) and the selector rod
// (alarmLinkRod). This measures the four couplings that decide whether that
// claim is true, on the tree it is pointed at — the shipped tree by default,
// a SCRATCH tree with a candidate section applied via ROOT= (the way probe-82
// is pointed at a tree). A REPORT on the numbers — it prints and the judgement
// is yours — that exits non-zero only when the tree it was pointed at does not
// boot, since a scratch tree that fails rule 6 has no numbers to report.
//
// The four couplings, and what each answered on the shipped tree:
//
//  1. TOOTH COUNTS. Both arrest station solves take their LOWER bound from
//     `minGearTeeth(ALARM_TRAIN_MODULE, ARREST_SPEC.arborR + 0.05, [barrel])`
//     under a `Math.max(8, …)`. Measured 5 at PIVOT_MIN_U and 5 at the
//     turning-derived 0.236, so the 8 governs and the idler stays at its
//     solved 14: no count moves.
//  2. THE GENEVA. `ARREST_SPEC.arborR` is an INPUT to genevaSpec, whose centre
//     distance is max(pitch, web, horn) and whose horn floor is
//     arborR + 0.05 + margin. Measured, the HORN GOVERNS today (d = 4.114 =
//     dFromHorn), so raising the one shared arborR to 0.236 grows the whole
//     stop-work 20% (d -> 4.919, lockR 1.390 -> 1.698). That is a mechanism
//     change, not a section — and it is the finger's coupling, not the two
//     over-ceiling columns', which is why the landing decouples the COLUMN
//     radius from the finger's spec (COLUMN_R= tries a value on a scratch
//     tree; the shipped tree reports the spec at both).
//  3. THE STALL. probe-82's chain has a "rod-end overhang" and it is the lay
//     SHAFT's neck past its last bush, not the rod: the rod is a push rod, out
//     of the compliance sum. Measured byte-identical at rod r 0.553 (81.02 mN).
//     §234's entry said the stall read the rod's section; it does not.
//  4. THE ROD'S SITE. §202 froze the rod's station against a 0.45 footprint and
//     asserts room = colClear + 0.45 − plateBore ≥ CLEAR_MARGIN at boot. At
//     r 0.553 it warns (0.115); at 0.518 it reads 0.150 and still warns by
//     float, so the cap is a hair under 0.518 — L/D 19.2, under the ceiling
//     and over the target. The rod is SITE-limited, and its site is the §112
//     solve's output, which is Landing 3's machinery, not a section.
//
// Usage: cd tools && node probe-234-group-c.mjs              (shipped tree)
//        ROOT=/path/to/scratch node probe-234-group-c.mjs    (a candidate tree)
//        CHECKS=1 …                                          (+ stockFloor,
//                                intraUnit, assembly and inspection on ROOT)
import { chromium } from 'playwright';
import { spawn } from 'node:child_process';

const PORT = process.env.PORT || 8698;
const ROOT = process.env.ROOT || '..';
const CHECKS = !!process.env.CHECKS;
const srv = spawn('python3', ['-m', 'http.server', String(PORT), '--bind', '127.0.0.1'], { cwd: ROOT, stdio: 'ignore' });
process.on('exit', () => srv.kill());
await new Promise((r) => setTimeout(r, 900));
const browser = await chromium.launch();
const page = await browser.newPage();
const warns = [];
page.on('pageerror', (e) => warns.push('PAGEERROR ' + (e.stack || e)));
page.on('console', (m) => { if (m.type() === 'warning' && !/WebGL|GroupMarker|GL Driver|swiftshader/i.test(m.text())) warns.push(m.text()); });
await page.goto(`http://127.0.0.1:${PORT}/index.html`, { waitUntil: 'load', timeout: 60000 });
let up = true;
try { await page.waitForFunction(() => !!window.__clock, null, { timeout: 90000 }); } catch { up = false; }
console.log(`§234 group C — ROOT ${ROOT} — boot ${up ? 'up' : 'FAILED'}, ${warns.length} warning(s) (rule 6 wants 0)`);
for (const w of warns) console.log('  WARN ' + w.slice(0, 400));
if (!up) { await browser.close(); process.exit(1); }
const bootWarnCount = warns.length;

const R = await page.evaluate(async (CHECKS) => {
  const G = await import('./src/geometry.js');
  const L = await import('./src/layout.js');
  const I = await import('./src/inspect.js');
  const clock = window.__clock;
  const { PIVOT_MIN_U, STOCK_MIN_U, CLEAR_MARGIN, TURN_LD_TARGET, UNIT_MM } = L;
  const o = { yieldEvery: 64 };
  const t = await I.checkTurning(clock, o);
  const all = [...t.violations, ...t.waived, ...t.needRest];
  const rowOf = (key) => { const b = all.find((x) => x.key === key); return b && { LD: b.LD, diaMM: b.diaMM, lenMM: b.lenMM }; };
  const rows = { arrest: rowOf('Alarm winding arrest::alarmArrestArbor'), idler: rowOf('Alarm winding arrest::subIdlerArbor'),
    finger: rowOf('Alarm winding arrest::alarmArrestFingerArbor'), rod: rowOf('Alarm link::alarmLinkRod') };
  // the column radius the turning target asks for, from the BUILT column length
  const colLenU = (rows.arrest ? rows.arrest.lenMM : 0) / UNIT_MM;
  const rNeed = colLenU / (2 * TURN_LD_TARGET);
  // 1. tooth-count floor at both radii (ARREST_STATIONS is 8 — ARREST_TRAVEL_TURNS + 1)
  const teeth = [PIVOT_MIN_U, rNeed].map((r) => ({ arborR: +r.toFixed(4),
    minTeethVsBarrel: G.minGearTeeth(0.3, r + 0.05, [44]), floorInSource: 8 }));
  // 2. the Geneva at both, same inputs as ARREST_SPEC
  const spec = (arborR) => { const s = G.genevaSpec({ N: 8, stockMin: STOCK_MIN_U, pivotMin: PIVOT_MIN_U, margin: CLEAR_MARGIN,
      studR: PIVOT_MIN_U + 0.01 + STOCK_MIN_U, arborR });
    return { arborR: +arborR.toFixed(4), d: +s.d.toFixed(4), lockR: +s.lockR.toFixed(4), horn: +s.horn.toFixed(4),
      governs: Object.entries(s.floors).sort((x, y) => y[1] - x[1])[0][0] }; };
  const geneva = [spec(PIVOT_MIN_U), spec(rNeed)];
  const out = { TURN_LD_TARGET, rNeed: +rNeed.toFixed(4), rows, teeth, geneva,
    turning: { unwaived: t.violations.map((v) => v.key), stale: t.staleWaivers.map((s) => s.key), control: t.control } };
  if (CHECKS) {
    const pick = (r) => ({ ok: r.ok, unwaived: (r.violations || r.unwaived || r.undeclared || r.forbidden || []).length });
    out.stockFloor = pick(await I.checkStockFloor(clock, o));
    out.intraUnit = pick(await I.checkIntraUnit(clock, o));
    out.assembly = pick(await I.checkAssembly(clock, o));
    I.start(clock, 'inspection', { includeExcluded: true, yieldEvery: 64 });
    await new Promise((res) => { const iv = setInterval(() => { const j = window.__checks.inspection; if (j && j.state !== 'running') { clearInterval(iv); res(); } }, 2000); });
    const j = window.__checks.inspection;
    out.inspection = j.state === 'done' ? pick(j.result) : { state: j.state, error: j.error };
  }
  return out;
}, CHECKS);
console.log(JSON.stringify(R, null, 1));
// CHECK-TIME warnings, printed apart from boot's: a warning the pose net
// raises on the shipped tree is the control for one it raises on a scratch
// tree, so the two must be read against each other, never alone. The BVH's
// coplanar-triangle notes are library noise and are counted, not listed.
const later = warns.slice(bootWarnCount);
const noise = later.filter((w) => /intersectsTriangle: Triangles are coplanar/.test(w)).length;
console.log(`check-time warnings: ${later.length} (${noise} BVH coplanar notes)`);
for (const w of later) if (!/intersectsTriangle: Triangles are coplanar/.test(w)) console.log('  WARN ' + w.slice(0, 400));
await browser.close();
process.exit(0);
