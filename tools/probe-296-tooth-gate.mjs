// Do the equalisation gate's club-tooth rows (TODO 296 rows 20 and 21, TODO 299 row 22) actually fire? It boots once, clones the EQUALISATION record, and runs `checkEqualisation` over fourteen sabotaged copies, asserting that each is REFUSED and named. Row 20, the quasi-static load: the wedge read as its flanks' SUM, the unlock priced forward, a load off its torque, a tip blunter than the finish band's sharp end, the arms' virtual work relaxed, the escape torque raised just past the multiple at which the tip first yields (derived: the worst row's margin squared, 24.6x), the binding criterion flipped, and two rows wearing each other's corner. Row 21, the drop's landing: a closing velocity off its arm, a run-in that blunts the tip past its finish band, the compliance claimed as the contact's rather than the tooth's, the landing priced at the design swing instead of the peak, a drop that takes the wheel nowhere, and the unmodelled series members left unnamed. Row 22, the design life: a centre arbor that does not turn once an hour, a recession that is not Archard's, the wear priced at the hardness band's high end instead of its low, corners that do not rise with the coefficient, a row claiming every corner holds, a straddle it does not report, and the BAR itself (four times the slip, repriced consistently, so the nominal corner misses its century). A gate nobody has watched fire is a comment. ACCEPTANCE: exits non-zero if the unmutated clone is not clean or if any sabotage passes.
//
// Why a clone and not a re-boot. The row is arithmetic over a published record,
// so the gate's logic is exactly what wants testing, and a doctored record
// tests it in milliseconds where a patched tree costs a boot apiece. The
// baseline clone is the control that the clone path itself is faithful: if
// JSON-round-tripping the record lost something the check reads, the baseline
// would fail and every sabotage below would be meaningless.
//
// What this does NOT cover, said plainly: the measurements FEEDING the record
// (the wedge off the outline, the arms off the escapement solve, the band off
// the mesh). Those are tools/probe-296-escape-tooth.mjs's, which re-measures
// them a second way off the cut mesh's own face normals and re-solves the
// escapement; between them the record is held at both ends.
//
// Run from the repository root:
//   node --import ./tools/native/loader.mjs tools/probe-296-tooth-gate.mjs
import { bootNative } from './native/host.mjs';
import * as I from '../src/inspect.js';
import * as L from '../src/layout.js';

const f = (x, d = 3) => Number(x).toFixed(d);
let bad = 0;

const boot = await bootNative({ query: '' });
const CK = boot.clock;
if (boot.warns.length) { console.error('boot is not silent:', boot.warns); bad++; }

// A clock whose `equalisation` is ours and whose everything else is the real
// one's (methods bound, so setPose/step still work for the alarm cadence rows).
const clockWith = (E) => new Proxy(CK, {
  get(t, k) {
    if (k === 'equalisation') return E;
    const v = t[k];
    return typeof v === 'function' ? v.bind(t) : v;
  },
});
const clone = () => JSON.parse(JSON.stringify(CK.equalisation));
const toothFails = (E) => {
  const r = I.checkEqualisation(clockWith(E));
  if (r.error) return [{ what: 'THREW: ' + r.error }];
  // the row's own wording, so a failure it raises cannot be filtered out of its
  // own control (an early draft's regex said "locking flank" where the gate
  // says "locking face", and S2 read as a gate gap)
  return (r.failures || []).filter((q) => /club|escape tooth|contact arm|wedge|locking (face|flank)|\btip\b|forward run|recoil|landing|drop|shakedown|series members|peak swing|wear|Archard|hardness|design life|corners that hold|straddle|once an hour|once a minute|slip|budget|temper|revolution|finish|polish|fixed point|cut-back|gullet|pocket|concave/i.test(JSON.stringify(q)));
};

// ---- BASELINE: the clone path is faithful and the row is clean -------------
{
  const base = toothFails(clone());
  const all = I.checkEqualisation(clockWith(clone())).failures || [];
  console.log(`baseline: ${all.length} failure(s) in all, ${base.length} on the club tooth`);
  if (all.length) { console.error('  the cloned record does not pass the gate — the clone path lost something the check reads:', JSON.stringify(all.slice(0, 3))); bad++; }
}

const E0 = clone();
const et0 = E0.going.energy.escapeTooth;
if (!et0) { console.error('FAIL the record carries no escapeTooth block'); process.exit(1); }
console.log(`record: ${et0.rows.length} rows, ${et0.geom.runs.length} arms, wedge ${f(et0.wedgeDeg, 4)}°, worst ×${f(et0.worst.margin, 3)} on ${et0.worst.binds}\n`);

const U = L.UNIT_MM / 1000, tM = et0.line_u * U;
const Estar = et0.Estar_Pa, allow = et0.p0Allow_Pa;
// reprice a row's whole dependent chain at a new load, so a sabotage aimed at
// the BAR is not caught by an identity clause instead
const reprice = (r, F, rho, a) => {
  const secW = 2 * rho * Math.cos(a), secArm = rho * (1 - Math.sin(a));
  const kB = (6 * (1 - Math.sin(a)) / (4 * Math.cos(a) ** 2) + 1 / (2 * Math.cos(a))) / tM;
  r.load_N = F;
  r.torque_Nm = F * (r.arm_u * U);
  r.p0_Pa = Math.sqrt((F / tM) * Estar / (Math.PI * rho));
  r.sigma_Pa = 6 * F * secArm / (tM * secW * secW) + F / (tM * secW);
  r.rhoHertz_m = (F / tM) * Estar / (Math.PI * allow * allow);
  r.rhoBeam_m = kB * F / et0.yield_Pa;
  r.rhoMin_m = Math.max(r.rhoHertz_m, r.rhoBeam_m);
  r.binds = r.rhoHertz_m >= r.rhoBeam_m ? 'hertz' : 'beam';
  r.margin = Math.min(allow / r.p0_Pa, et0.yield_Pa / r.sigma_Pa);
};

// Hertz binds and p0 ∝ √F, so the worst row first yields at (its margin)²
// times the escapement's own torque.
const TORQUE_CROSS = Math.pow(et0.worst.margin, 2);

const SABOTAGES = [
  { name: 'S1 the wedge read as its flanks\' SUM (TODO 296\'s own trap)',
    expect: /flanks' DIFFERENCE/,
    patch: (E) => { const w = E.going.energy.escapeTooth.geom.wedge;
      w.fullDeg = Math.abs(w.lockFlankDeg) + Math.abs(w.impulseFlankDeg);
      w.halfRad = w.fullDeg * Math.PI / 360;
      w.widthPerDepth = Math.abs(Math.tan(w.lockFlankDeg * Math.PI / 180)) + Math.abs(Math.tan(w.impulseFlankDeg * Math.PI / 180)); } },
  { name: 'S2 the unlock priced FORWARD instead of as recoil',
    expect: /one forward run and one recoil run/,
    patch: (E) => { const t = E.going.energy.escapeTooth;
      for (const q of t.geom.runs) if (q.flow === 'recoil') q.flow = 'forward';
      for (const r of t.rows) if (r.flow === 'recoil') {
        r.flow = 'forward';
        reprice(r, E.going.energy.escapeTorque_Nm * r.etaPath / (r.arm_u * U), t.rho_m, t.geom.wedge.halfRad);
      } } },
  { name: 'S3 a load that is not its torque over its arm',
    expect: /load identity/,
    patch: (E) => { E.going.energy.escapeTooth.rows[4].load_N *= 1.05; } },
  { name: 'S4 rows priced at a radius that is not the derived finish',
    expect: /not priced at the derived finish/,
    patch: (E) => { E.going.energy.escapeTooth.rho_m *= 1.5; } },
  { name: 'S5 the arms\' virtual work relaxed',
    expect: /fail virtual work/,
    patch: (E) => { E.going.energy.escapeTooth.geom.virtualWork.rel = 1e-3; } },
  // THE BAR ITSELF. Hertz binds here and p0 goes as √F, so the multiple of the
  // escape torque at which the worst row first yields is its margin SQUARED --
  // derived, not a magic number, and worth reading: it is the headroom the tip
  // has over the escapement's own load. The sabotage stands just past it.
  { name: `S6 ${f(TORQUE_CROSS * 1.1, 1)}× the escape torque (the BAR itself; it first yields at ×${f(TORQUE_CROSS, 1)})`,
    expect: /over first yield in contact/,
    patch: (E) => { const t = E.going.energy.escapeTooth, k = TORQUE_CROSS * 1.1;
      E.going.energy.escapeTorque_Nm *= k;
      for (const r of t.rows) reprice(r, r.load_N * k, t.rho_m, t.geom.wedge.halfRad);
      const w = t.rows.reduce((x, y) => (y.margin < x.margin ? y : x));
      t.worst = { run: w.run, corner: w.corner, margin: w.margin, binds: w.binds };
      t.rhoMin_m = Math.max(...t.rows.map((r) => r.rhoMin_m)); } },
  { name: 'S7 the binding criterion flipped',
    expect: /not the larger criterion/,
    patch: (E) => { for (const r of E.going.energy.escapeTooth.rows) r.binds = r.binds === 'hertz' ? 'beam' : 'hertz'; } },
  // Each row stays internally consistent; what is false is WHICH CORNER it
  // claims to be. The η clause names it, the ordering clause names it too when
  // the swap inverts the run — one defect, and the gate refuses it either way.
  { name: 'S8 two rows of a forward run wearing each other\'s corner',
    expect: /is not its corner|does not fall toward the adverse corner/,
    patch: (E) => { const t = E.going.energy.escapeTooth;
      const first = t.rows.find((x) => x.flow === 'forward');
      const fw = t.rows.filter((r) => r.flow === 'forward' && r.run === first.run && r.stone === first.stone);
      const favo = fw.find((r) => r.corner === 'favourable'), adv = fw.find((r) => r.corner === 'adverse');
      favo.corner = 'adverse'; adv.corner = 'favourable'; } },
  // ---- row 21 (TODO 296 landing 2), the drop's landing -------------------
  { name: 'S9 a closing velocity that is not its arm times its speed',
    expect: /closing velocity identity/,
    patch: (E) => { E.going.energy.escapeTooth.landing.v0_m_s *= 1.02; } },
  { name: 'S10 a finish outside what a polish can hold',
    expect: /outside what a polish can hold/,
    patch: (E) => { const t = E.going.energy.escapeTooth, lg = t.landing, k = lg.finish.band_m[1] * 3 / lg.finish.rho_m;
      lg.finish.rho_m *= k; t.rho_m = lg.finish.rho_m;
      lg.finish.elasticRho_m *= k;
      { const w = t.geom.wedge, sU = lg.finish.rho_m / Math.sin(w.halfRad) / U, R = t.geom.tip.r;   // §344: radial
        lg.finish.cutBack_u = R - Math.sqrt(R * R - 2 * R * sU * Math.cos(w.bisectorRad) + sU * sU) - lg.finish.rho_m / U; }
      // keep the fixed-point identity true so the ACHIEVABILITY clause is what
      // refuses it rather than an arithmetic one
      lg.atFinish.p0_Pa = lg.shakedownAllow_Pa; } },
  { name: 'S11 the landing\'s compliance claimed as the CONTACT\'s, not the tooth\'s',
    expect: /compliance is not the tooth/,
    patch: (E) => { const lg = E.going.energy.escapeTooth.landing;
      for (const q of [lg.atFinish, lg.finish.atSharp]) {
        const t = q.kTooth_N_per_m; q.kTooth_N_per_m = q.kHertz_N_per_m; q.kHertz_N_per_m = t; } } },
  { name: 'S12 the landing priced at the design swing instead of the peak',
    expect: /not priced at the peak swing/,
    patch: (E) => { E.going.energy.escapeTooth.landing.peakDeg = 200; } },
  { name: 'S13 the drop taking the wheel nowhere',
    expect: /does not accelerate through the drop|energy identity/,
    patch: (E) => { const lg = E.going.energy.escapeTooth.landing;
      lg.omegaLand_rad_s = lg.omegaLetoff_rad_s; } },
  { name: 'S14 the series members it leaves out left unnamed',
    expect: /does not name the series members/,
    patch: (E) => { E.going.energy.escapeTooth.landing.notModelled = []; } },
  // ---- row 22 (TODO 299), the design life ---------------------------------
  // A clone cannot carry the geometry's `lockRunAt`, so the clause that
  // RE-SOLVES the worn crossing at the budget is covered by the real boot
  // (where the function is there) and not by a sabotage here. Said rather than
  // left as a silent hole.
  { name: 'S15 a centre arbor that does not turn once an hour',
    expect: /once an hour/,
    patch: (E) => { E.going.energy.escapeTooth.wear.counts.control.centrePerHour = 0.5; } },
  { name: 'S16 a recession that is not Archard\'s',
    expect: /Archard identity/,
    patch: (E) => { E.going.energy.escapeTooth.wear.corners.nominal.recession_m *= 1.1; } },
  // §344 — the two readings §344 corrected, restored whole: each must be
  // refused by the identity it moved, not by a clause downstream of it
  { name: 'S16b a recession read along the wedge\'s BISECTOR (pre-§344)',
    expect: /Archard identity/,
    patch: (E) => { const t = E.going.energy.escapeTooth, w = t.wear;
      for (const c of ['favourable', 'nominal', 'adverse']) {
        const q = w.corners[c], d = Math.sqrt((q.volume_m3 / tM) / Math.tan(t.geom.wedge.halfRad));
        q.recession_m = d; q.recession_u = d / U; q.overBudget = (d / U) / w.budget_u;
      } } },
  { name: 'S16c a finish set back along the BISECTOR (pre-§344)',
    expect: /cut-back identity/,
    patch: (E) => { const t = E.going.energy.escapeTooth, fin = t.landing.finish;
      fin.cutBack_u = fin.rho_m * (1 / Math.sin(t.geom.wedge.halfRad) - 1) / U; } },
  { name: 'S16d a bisector that is not the flanks\' mean',
    expect: /bisector is not off the radius/,
    patch: (E) => { E.going.energy.escapeTooth.geom.wedge.bisectorRad *= 0.5; } },
  { name: 'S17 the wear priced at the hardness band\'s HIGH end',
    expect: /not priced at the hardness band/,
    patch: (E) => { const w = E.going.energy.escapeTooth.wear; w.hardness_Pa = w.hardnessBand.high; } },
  { name: 'S18 wear corners that do not rise with the coefficient',
    expect: /corners are not ordered/,
    patch: (E) => { const c = E.going.energy.escapeTooth.wear.corners;
      const t = c.favourable.recession_m; c.favourable.recession_m = c.adverse.recession_m; c.adverse.recession_m = t; } },
  { name: 'S19 a row claiming every corner holds',
    expect: /does not name the corners that hold/,
    patch: (E) => { E.going.energy.escapeTooth.wear.holdsAt = ['favourable', 'nominal', 'adverse']; } },
  { name: 'S20 a straddle the row does not report',
    expect: /does not report its own straddle/,
    patch: (E) => { E.going.energy.escapeTooth.wear.straddles = false; } },
  // THE BAR: row 15's precedent, the design life held at the NOMINAL corner.
  // THE BAR: row 15's precedent, the design life held at the NOMINAL corner.
  // Shrink the BUDGET rather than the slip or the load, because both of those
  // are tied back to what the geometry measured and the rows priced -- an
  // earlier draft scaled the slip and the gate refused it on that identity
  // before the bar was ever reached, which is a control testing the wrong
  // clause.
  { name: 'S21 a tooth that does not reach its life at the NOMINAL corner (the BAR)',
    expect: /does not reach its design life at a corner it must/,
    patch: (E) => { const t = E.going.energy.escapeTooth, w = t.wear, k = 4;
      w.budget_u /= k; t.geom.budget.recession_u /= k;
      for (const c of ['favourable', 'nominal', 'adverse']) {
        w.corners[c].overBudget *= k;
        w.needHardness_Pa[c] *= k * k;
      }
      w.holdsAt = ['favourable', 'nominal', 'adverse'].filter((c) => w.corners[c].overBudget <= 1);
      w.straddles = w.holdsAt.length > 0 && w.holdsAt.length < 3; } },
];

for (const s of SABOTAGES) {
  const E = clone();
  s.patch(E);
  const got = toothFails(E);
  const hit = got.some((q) => s.expect.test(JSON.stringify(q)));
  console.log(`${hit ? 'REFUSED ' : 'PASSED!! '} ${s.name}`);
  if (hit) {
    const w = got.find((q) => s.expect.test(JSON.stringify(q)));
    console.log(`          → ${w.what}`);
  } else {
    console.error(`          the gate did not name it. ${got.length} club-tooth failure(s): ${JSON.stringify(got.slice(0, 2))}`);
    bad++;
  }
}

console.log('');
if (bad) { console.error(`FAIL — ${bad} sabotage(s) the gate does not refuse, or a baseline that is not clean.`); process.exit(1); }
console.log(`PASS — the club-tooth row refuses all ${SABOTAGES.length} sabotages and the unmutated record is clean.`);
process.exit(0);
