// Does the equalisation gate's oil-ageing row (§346, row 23) actually fire? It boots once, clones the EQUALISATION record, and runs `checkEqualisation` over sabotaged copies of `going.energy.oilAgeing`, asserting that each is REFUSED and named: the ageing rows not the lubrication map's, an aged coefficient off its band corner, the law no longer declared posed, a sample's swing raised by a degree, every row aged (the whole adverse corner at the interval's end), the late-failing shape (f² in place of f, the samples re-walked consistently), a stage that names no friction row, samples coarser than the reading they serve, and a summary that disagrees with its samples. It also prints the record: the rows that age, the swing fresh and aged in both positions, and the spacing. A gate nobody has watched fire is a comment. ACCEPTANCE: exits non-zero if the unmutated clone is not clean or if any sabotage passes.
//
// The record is arithmetic over a published walk, so a clone tests the gate's logic in
// milliseconds where a patched tree costs a boot apiece (probe-296-tooth-gate.mjs' reason).
// The baseline clone is the control that the clone path is faithful.
//
// What this does NOT cover: whether the law is TRUE. It is posed (layout.js OIL_AGEING),
// and no instrument here can measure an oil; the gate holds only that the record is the
// declared law applied to the energy column's own corners.
//
// Run from the repository root:
//   node --import ./tools/native/loader.mjs tools/probe-346-oil-ageing.mjs
import { bootNative } from './native/host.mjs';
import * as I from '../src/inspect.js';
import { FRICTION, OIL_AGEING } from '../src/layout.js';

const f = (x, d = 2) => Number(x).toFixed(d);
let bad = 0;

const boot = await bootNative({ query: '' });
const CK = boot.clock;
if (boot.warns.length) { console.error('boot is not silent:', boot.warns); bad++; }

const clockWith = (E) => new Proxy(CK, {
  get(t, k) {
    if (k === 'equalisation') return E;
    const v = t[k];
    return typeof v === 'function' ? v.bind(t) : v;
  },
});
const clone = () => JSON.parse(JSON.stringify(CK.equalisation));
const oilFails = (E) => {
  const r = I.checkEqualisation(clockWith(E));
  if (r.error) return [{ what: 'THREW: ' + r.error }];
  return (r.failures || []).filter((q) => /oil ageing|names no FRICTION row/i.test(String(q.what)));
};

// ---- BASELINE ------------------------------------------------------------------
{
  const all = I.checkEqualisation(clockWith(clone())).failures || [];
  console.log(`baseline: ${all.length} failure(s) in all, ${oilFails(clone()).length} on oil ageing`);
  if (all.length) { console.error('  the cloned record does not pass the gate:', JSON.stringify(all.slice(0, 3))); bad++; }
}
const E0 = clone();
const O0 = E0.going.energy.oilAgeing;
if (!O0) { console.error('FAIL the record carries no oilAgeing block'); process.exit(1); }
const last = O0.samples[O0.intervals];
console.log(`record: ${O0.rows.join(', ')} age (${O0.fresh} → ${O0.aged}, ${O0.shape}, posed); held ${O0.held.join(', ')}`);
console.log(`        vertical ${f(O0.samples[0].sustainedDeg.vertical)}° → ${f(last.sustainedDeg.vertical)}° over ${O0.intervalYears} years (−${f(O0.dropDeg.vertical)}°), dial-flat ${f(O0.samples[0].sustainedDeg.flat)}° → ${f(last.sustainedDeg.flat)}°`);
console.log(`        ${O0.intervals} intervals, the line within ${f(O0.interpErrDeg, 4)}° of the swing against a ${O0.readDeg}° reading\n`);

// Re-walk the samples under a different law g(f), consistently (every figure the
// gate reads), so a sabotage is a whole alternative law rather than one bad number.
const rewalk = (E, g, ages) => {
  const en = E.going.energy, O = en.oilAgeing;
  const F0 = en.corners[OIL_AGEING.fresh], F1 = en.corners[OIL_AGEING.aged];
  const kB = en.balance.k_Nm_per_rad, a = Math.PI * kB / (2 * F0.qOther);
  const mu0 = FRICTION.muJewel[OIL_AGEING.fresh], mu1 = FRICTION.muJewel[OIL_AGEING.aged];
  for (const s of O.samples) {
    const x = g(s.f);
    const eta = F0.stages.reduce((p, st, j) => p * (ages.has(st.row) ? st.eta + (F1.stages[j].eta - st.eta) * x : st.eta), 1);
    s.etaTotal = eta; s.delivered_J = eta * en.perBeat_J;
    const mu = ages.has('muJewel') ? mu0 + (mu1 - mu0) * x : mu0;
    s.pivot = { vertical_Nm: F0.pivot.vertical_Nm * mu / mu0, flat_Nm: F0.pivot.flat_Nm * mu / mu0 };
    const root = (tf) => (-2 * tf + Math.sqrt(4 * tf * tf + 4 * a * s.delivered_J)) / (2 * a) * 180 / Math.PI;
    s.sustainedDeg = { vertical: root(s.pivot.vertical_Nm), flat: root(s.pivot.flat_Nm) };
  }
  const end = O.samples[O.intervals].sustainedDeg;
  O.dropDeg = { vertical: O.samples[0].sustainedDeg.vertical - end.vertical, flat: O.samples[0].sustainedDeg.flat - end.flat };
  O.endDeg = { ...end };
};

const SABOTAGE = [
  ['O1 the mainspring grease left out of the ageing rows', /rows are not the lubrication map/,
    (E) => { E.going.energy.oilAgeing.rows = E.going.energy.oilAgeing.rows.filter((r) => r !== 'springInt'); }],
  ['O2 aged jewel oil read at the favourable corner', /coefficient is not its band corner/,
    (E) => { E.going.energy.oilAgeing.coefficients.aged.muJewel = FRICTION.muJewel.favourable; }],
  ['O3 the law no longer declared posed', /not the declared posed law/,
    (E) => { E.going.energy.oilAgeing.posed = false; }],
  ['O4 one sample\'s swing raised a degree', /not the corners' linear walk/,
    (E) => { E.going.energy.oilAgeing.samples[3].sustainedDeg.vertical += 1; }],
  ['O5 every row aged (the adverse corner whole at the interval\'s end), re-walked', /not the corners' linear walk/,
    (E) => rewalk(E, (x) => x, new Set(Object.keys(FRICTION)))],
  ['O6 the late-failing shape, f² for f, re-walked', /not the corners' linear walk/,
    (E) => rewalk(E, (x) => x * x, new Set(E.going.energy.oilAgeing.rows))],
  ['O7 a stage that names no friction row', /names no FRICTION row/,
    (E) => { delete E.going.energy.corners.nominal.stages[1].row; }],
  ['O8 samples coarser than the reading', /coarser than the reading/,
    (E) => { const O = E.going.energy.oilAgeing; O.interpErrDeg = O.readDeg; }],
  ['O9 a summary that disagrees with its samples', /summary disagrees/,
    (E) => { E.going.energy.oilAgeing.dropDeg.vertical *= 0.5; }],
];

let refused = 0;
for (const [name, want, mutate] of SABOTAGE) {
  const E = clone();
  mutate(E);
  const got = oilFails(E);
  const named = got.some((q) => want.test(String(q.what)));
  if (named) refused++;
  else bad++;
  console.log(`${named ? 'refused' : 'PASSED '}  ${name}${named ? '' : `  — the gate said: ${JSON.stringify(got.map((q) => q.what))}`}`);
}

console.log(bad
  ? `\nFAIL — ${SABOTAGE.length - refused} of ${SABOTAGE.length} sabotages passed the oil-ageing row${bad > SABOTAGE.length - refused ? ', and the baseline is not clean' : ''}`
  : `\nPASS — the oil-ageing row refuses all ${SABOTAGE.length} sabotages and the unmutated record is clean.`);
process.exit(bad ? 1 : 0);
