// CAN REAL LEGO PARTS MAKE A DEAD-BEAT ESCAPEMENT ON THE SHIPPED KNIFE (A1)? Acceptance, pure Node, no browser, no
// network; exits non-zero on any failed row. BUILT §323 (src/technic-deadbeat.js), landing 1: measured and decided.
// It reads the vendored pack (the pallet candidates, their mount and the survey's controls are vendored for it).
//
//   · MOUNT — the balance turns about the knife's apex line, and the crossbar's axis stands a cross axle's reach above
//     it (ESC_DIM_MM.axleReach, 2.4 mm, held by probe-technic-escapement against 3705): the nearest a lattice arc can
//     be centred on the pivot. The mount, a 2×2 round plate with an axle hole (4032a), carries its axle at the corner
//     of its four studs, measured off the part: so a stud-grid corner of a part on its studs IS the crossbar's axis.
//   · PALLETS — every candidate in DEADBEAT_PALLETS re-reads its arc off the part about the centre the table names:
//     convex or concave, radius, span, ROUND under F2's play, a real wall (a stud's height), and the material behind
//     its face (`thicknessBehind`).
//   · MODEL — the silhouette contact model reads §287's own recoil anchor (its 8T pallets placed where §287 places
//     them) as `escapementModel` does: the same drops, in the same directions, at the same anchor angles to the two
//     grids' own resolution (a silhouette cell over the pallet's lever, a star-profile bin at the wheel's tip), and
//     one tooth a cycle.
//   · DEAD LOCK — a TEXTBOOK Graham drawn as polygons (`drawnGraham`) ESCAPES through the same model and judge, its
//     arcs about the crossbar and about the pivot. CONCENTRICITY (geometry): each lock face's distance from the pivot
//     is one radius when its arc is centred there, and spreads by the eccentricity's projection about the crossbar.
//   · SLENDERNESS (a report) — the widest drawn pallet (material behind its face) that still escapes on the going
//     train's 8T, at 1.5, 2.5 and 3.5 pitches between the locks.
//   · A1 — `solveA1` over every candidate pair, every quarter-turn placement face up or down, every escape-arbor
//     lattice point the pallets' radii reach, both senses, on the 8T: the number that escape, and the CLOSEST (the
//     least overlap the best wheel angle leaves at the worst of −2°, 0, +2°). The VERDICT is this solve's.
//
// CONTROLS, each seen to fail: the 8T anchor read with its pallets turned a tenth of a pitch (the drops must move);
// a drawn Graham one step wider than the widest that escapes (it must be refused); the drawn lock about the crossbar
// (its distance from the pivot must spread); a drawn pallet set run through solveA1's own judge (it must escape there too).
//
//   node tools/probe-technic-deadbeat.mjs [--quick]   (--quick: the A1 solve on a quarter of the lattice)
import { loadPack } from './technic-pack.mjs';
import { placements, LDU_MM } from '../src/ldraw.js';
import { escapementModel, escSpec, traceCycle, palletAngle, TECHNIC_ESCAPEMENT, ESC_DIM_MM, F2_PLAY_MM, ESCAPEMENT_PARTS } from '../src/technic-escapement.js';
import { LEGO_DIM_MM } from '../src/technic-frame.js';
import * as DB from '../src/technic-deadbeat.js';

const lib = loadPack();
const quick = process.argv.includes('--quick');
let fails = 0;
const fail = (m) => { fails++; console.log(`  ✗ ${m}`); };
const controls = [];
const control = (name, caught) => controls.push([name, !!caught]);
const deg = (d) => d * Math.PI / 180, toDeg = (r) => r * 180 / Math.PI;
console.log('A DEAD-BEAT FOR THE LEGO GOING TRAIN, landing 1 — measured off the parts; the knife\'s loss not modelled\n');

// ── MOUNT
{
  if (Math.abs(DB.PIVOT_TO_CROSSBAR - ESC_DIM_MM.axleReach) > 1e-12) fail('the crossbar offset is not §287\'s axle reach');
  const holes = placements(lib, `${DB.DEADBEAT_PARTS.mount}.dat`, /axlehol|axleh/i), studs = placements(lib, `${DB.DEADBEAT_PARTS.mount}.dat`, /stud/i);
  // its top studs (the underside's tube primitive is a stud file too, on the axle, and is not one of them)
  const h = holes[0]?.m, top = studs.filter((s) => h && Math.abs(Math.abs(s.m[0] - h[0]) - 10) < 1e-6 && Math.abs(Math.abs(s.m[2] - h[2]) - 10) < 1e-6);
  const corner = top.length === 4 && new Set(top.map((s) => `${Math.sign(s.m[0] - h[0])},${Math.sign(s.m[2] - h[2])}`)).size === 4;
  if (!corner) fail(`${DB.DEADBEAT_PARTS.mount}'s axle is not at the corner of its four studs`);
  console.log(`MOUNT the crossbar ${DB.PIVOT_TO_CROSSBAR} mm above the pivot (24× F2's ${F2_PLAY_MM} mm play): the nearest a lattice arc's centre can stand to it; ${DB.DEADBEAT_PARTS.mount}'s axle at the corner of its four top studs (±10 LDU), so a stud-grid corner on it is the crossbar's axis`);
}

// ── PALLETS
const behind = {}, onAxes = [];
console.log('\nPALLETS (each arc read off the part about the centre DEADBEAT_PALLETS names):');
for (const [p, { centre: c, normal }] of Object.entries(DB.DEADBEAT_PALLETS)) {
  const sil = DB.silhouette(lib, p, { normal, res: 0.25 });
  // the arcs a pallet can lock on: partial, convex or concave, round under F2's play, a real wall (the survey's rule)
  const usable = DB.arcsAbout(lib, sil, c).filter((a) => a.kind !== 'thin' && a.span < DB.deg(330) && a.roundness * LDU_MM < F2_PLAY_MM && a.faceHeight * LDU_MM >= LEGO_DIM_MM.studH && a.r * LDU_MM >= 4);
  if (!usable.length) { fail(`${p}: no usable arc about (${c})`); continue; }
  for (const a of usable) {
    const t = DB.thicknessBehind(sil, c, a), rnd = a.roundness * LDU_MM, wall = a.faceHeight * LDU_MM;
    const ends = [a.from, a.from + a.span].map((x) => toDeg(x) % 90).map((x) => Math.min(x, 90 - x));
    behind[p] = behind[p] ?? {}; behind[p][a.kind] = Math.min(behind[p][a.kind] ?? Infinity, t.least);
    onAxes.push({ p, kind: a.kind, off: Math.max(...ends) });
    console.log(`  ${p.padEnd(6)} ${a.kind.padEnd(8)} r ${(a.r * LDU_MM).toFixed(3)} mm, ${toDeg(a.span).toFixed(1)}° from ${toDeg(a.from).toFixed(1)}° (its ends ${ends.map((x) => x.toFixed(1)).join('°, ')}° off a quarter turn), round to ${rnd.toFixed(4)} mm, wall ${wall.toFixed(1)} mm, ${t.least.toFixed(2)}–${t.most.toFixed(2)} mm behind the face — ${lib.get(`${p}.dat`).title}`);
  }
}

// ── MODEL: §287's anchor through the silhouette model
{
  const esc = escSpec(lib, TECHNIC_ESCAPEMENT), ref = escapementModel(lib, esc), res = 0.1;
  const pal = (turn = 0) => [1, -1].map((k) => ({ part: ESCAPEMENT_PARTS.pallet, normal: 2, centre: [0, 0], at: [k * esc.s, esc.vA], angle: palletAngle(esc, k) + turn }));
  const m = DB.deadbeatModel(lib, { wheelPart: esc.wheelPart, teeth: esc.teeth, W: [0, esc.vW], sense: esc.sense, pallets: pal(), res });
  const A = 3, a = traceCycle(ref, A, { n: 300 }), b = traceCycle(m, A, { n: 300 });
  // the two grids' resolution, as an anchor angle: a silhouette cell over the pallet's lever, a 0.1° profile bin at the tip
  const tol = (res * LDU_MM + deg(0.1) * ref.W.tip) / esc.s;
  const same = a.ok && b.ok && a.drops.length === b.drops.length && a.drops.every((d, i) => d.dir === b.drops[i].dir && Math.abs(d.alpha - b.drops[i].alpha) <= tol);
  if (!same) fail(`§287's anchor read through the silhouette model drops at ${b.drops?.map((d) => toDeg(d.alpha).toFixed(2)).join(', ')}°, §287's own at ${a.drops.map((d) => toDeg(d.alpha).toFixed(2)).join(', ')}° (± ${toDeg(tol).toFixed(2)}°)`);
  const turned = DB.deadbeatModel(lib, { wheelPart: esc.wheelPart, teeth: esc.teeth, W: [0, esc.vW], sense: esc.sense, pallets: pal(TECHNIC_ESCAPEMENT.teeth ? (2 * Math.PI / 8) / 10 : 0), res });
  const c = traceCycle(turned, A, { n: 300 });
  control('§287\'s pallets turned a tenth of a pitch (the drops must move)', !(c.ok && c.drops.length === a.drops.length && c.drops.every((d, i) => d.dir === a.drops[i].dir && Math.abs(d.alpha - a.drops[i].alpha) <= tol)));
  console.log(`\nMODEL §287's 8T anchor at ±${A}°: drops at ${b.drops?.map((d) => `${toDeg(d.alpha).toFixed(2)}°`).join(', ')} (escapementModel: ${a.drops.map((d) => `${toDeg(d.alpha).toFixed(2)}°`).join(', ')}; the grids' resolution ±${toDeg(tol).toFixed(2)}°), one tooth a cycle (${b.advance?.toFixed(6)})`);
}

// ── DEAD LOCK, CONCENTRICITY and SLENDERNESS: the drawn Graham on the going train's 8T
const LAYOUTS = [{ lift: 1, len: 3 }, { lift: 1, len: 1 }, { lift: 1.5, len: 1 }, { lift: 2, len: 1 }, { lift: 3, len: 1 }];
const escapesDrawn = (n, w, centre = DB.CROSSBAR) => {
  for (const L of LAYOUTS) for (const sense of [1, -1]) {
    const g = DB.drawnGraham(lib, '3647', 8, n, { w, dip: 0.3, len: L.len, lift: L.lift, sense, centre });
    const m = DB.deadbeatModel(lib, g);
    const j = DB.judgeA1(m, { swings: [2, 4, 6, 8, 10], n: 140 });
    if (j.swings.length) return { g, m, layout: L, sense, swings: j.swings };
  }
  return null;
};
const slender = {};
{
  const atBar = escapesDrawn(1, 1), atPivot = escapesDrawn(1, 1, [0, 0]);
  if (!atBar || !atPivot) fail(`the drawn Graham does not escape (about the crossbar: ${!!atBar}, about the pivot: ${!!atPivot})`);
  else {
    control('a drawn pallet set through solveA1\'s own judge (it must escape there too)', DB.judgeA1(atBar.m, { swings: atBar.swings }).swings.length > 0);
    // CONCENTRICITY (geometry): along each drawn lock face, its distance from the PIVOT — what a tooth resting on it
    // sees as the balance turns. About the pivot it is one radius (no recoil, no draw); about the crossbar it spreads
    // by the eccentricity's projection over the face, and that spread, over the swing, is A1's residual recoil.
    const spread = (centre, hit) => {
      const g = DB.drawnGraham(lib, '3647', 8, 1, { w: 1, dip: 0.3, len: hit.layout.len, lift: hit.layout.lift, sense: hit.sense, centre });
      let worst = 0;
      for (const p of g.pallets) {
        const face = p.poly.slice(0, 17).map(([u, v]) => Math.hypot(u * LDU_MM, v * LDU_MM));   // the face's own points
        worst = Math.max(worst, Math.max(...face) - Math.min(...face));
      }
      return worst;
    };
    const dP = spread([0, 0], atPivot), dB = spread(DB.CROSSBAR, atBar);
    if (!(dP < 1e-9)) fail(`about the pivot a drawn lock face's distance from the pivot spreads ${dP.toExponential(2)} mm`);
    control('the drawn lock faces about the crossbar (their distance from the pivot must spread)', dB > 1e-6);
    console.log(`\nDEAD LOCK a drawn Graham (8T, 1.5 pitches between its locks, pallets 1 mm thick) escapes through the same model and judge, its arcs about the crossbar and about the pivot. CONCENTRICITY each lock face's distance from the pivot spreads ${dP.toExponential(1)} mm with the arcs about the pivot and ${dB.toFixed(3)} mm about the crossbar, over a face ${(atBar.layout.len + 0.3).toFixed(1)} mm long (the 2.4 mm eccentricity, projected)`);
  }
  // SLENDERNESS: the widest drawn pallet that escapes, per straddle (n + ½ pitches between the locks)
  for (const n of [1, 2, 3]) {
    let wMax = null;
    for (const w of [1, 2, 3, 4, 5, 6, 8, 10, 12]) { if (escapesDrawn(n, w)) wMax = w; else break; }
    slender[n] = wMax;
  }
  const n1 = slender[1];
  control(`a drawn Graham one step past the widest that escapes at 1.5 pitches (it must be refused)`, n1 !== null && !escapesDrawn(1, n1 + 1));
  console.log(`SLENDERNESS on the 8T the widest drawn pallet that escapes stands ${slender[1]} mm behind its face at 1.5 pitches between the locks, ${slender[2]} mm at 2.5, ${slender[3]} mm at 3.5 — wider pallets fit only where the locks stand farther apart and the arcs' radius grows (rt·tan β: ${[1, 2, 3].map((n) => (4.98 * Math.tan((n + 0.5) * Math.PI / 8)).toFixed(1)).join(', ')} mm)`);
}

// ── A1
{
  const t0 = Date.now();
  const r = DB.solveA1(lib, quick ? { uRange: [-20, 20], vRange: [-6, 6] } : {});
  console.log(`\nA1 on the 8T: ${r.tried} placements tried (${r.prefiltered} whose tip circle crosses a convex and a concave arc), both senses: ${r.counts.noFree} leave the wheel no free place within ±2° of the swing's centre, ${r.counts.traced} traced, ${r.escapes.length} escape (${((Date.now() - t0) / 1000).toFixed(0)} s)`);
  if (r.closest) console.log(`  CLOSEST: the best wheel angle still overlaps by ${r.closest.score.toFixed(2)} mm (${r.closest.pallets.map((p) => `${p.part} turn ${p.rot}${p.flip ? ', face down' : ''}`).join(' + ')}, the 8T at (${r.closest.W.join(', ')}) mm)`);
  // WHY, as the readings above say it: a keyed cross turns a pallet by quarter turns, and most candidates' arcs END
  // on quarter turns about their centre, while a Graham on the 8T needs its two locks (n + ½) pitches apart on the tip
  // circle — in the textbook layout 180° − (n + ½)·45° apart about the arcs' centre, never a multiple of 90° (the
  // catalogue count that would be is 4n + 2: the 14T, at n = 3); and where the locks may stand farther apart the arcs'
  // radius must grow with them. A report: the solve above is the verdict.
  const quarter = onAxes.filter((x) => x.off < 1).map((x) => x.p), off = onAxes.filter((x) => x.off >= 1);
  const apart = [1, 2, 3].map((n) => 180 - (n + 0.5) * 45);
  console.log(`  WHY (a report): ${[...new Set(quarter)].length} of ${Object.keys(DB.DEADBEAT_PALLETS).length} candidates end their arcs on quarter turns (${off.map((x) => `${x.p} ${x.kind} ${x.off.toFixed(1)}° off`).join(', ')}); the 8T's textbook locks stand ${apart.map((x) => `${x}°`).join(', ')} apart about the arcs' centre at 1.5, 2.5, 3.5 pitches; material behind the faces ${Object.entries(behind).map(([p, k]) => `${p} ${Object.values(k).map((v) => v.toFixed(1)).join('/')}`).join(', ')} mm against the ${slender[1]}/${slender[2]}/${slender[3]} mm the 8T admits`);
  if (r.escapes.length) console.log(`  ESCAPES: ${JSON.stringify(r.escapes.slice(0, 3).map((e) => ({ W: e.W, sense: e.sense, swings: e.swings, pallets: e.pallets.map((p) => `${p.part} r${p.rot}${p.flip ? 'f' : ''}`) })))}`);
  console.log(`  VERDICT: ${r.escapes.length ? 'A1 has a geometry on the 8T' : 'A1 is IMPOSSIBLE on the going train\'s 8T with these parts: no keyed placement of any candidate pair, at any lattice point, lets the wheel rest within ±2° of the swing\'s centre'}`);
}

console.log('\ncontrols:');
for (const [n, c] of controls) { console.log(`  ${c ? 'caught' : 'NOT CAUGHT'}  ${n}`); if (!c) fails++; }
console.log(fails ? `\n${fails} FAILED` : '\nthe dead-beat landing\'s readings hold: the parts measured, the model read against §287 and a drawn Graham, A1 solved over the lattice');
process.exit(fails ? 1 : 0);
