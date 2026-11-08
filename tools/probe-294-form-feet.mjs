// DO THE DIAL'S FEET STAND ON THE DIAL AND THE PLATE THEY JOIN, ON EVERY FORM KIND, AND DOES NONE OF THEM SET THE CASE?
// Acceptance (TODO 294; the free kind's own rows are tools/probe-325-free-case.mjs P1).
//
//   node tools/probe-294-form-feet.mjs        (exit 1 on any failed row)
//
// The feet are three posts from the dial's back to the base plate. §125 step 5 sites them by the ROUND rule, one
// CLEAR_MARGIN inside the tighter of the dial's and the plate's radii. The form kinds cut the dial and both plates to
// the form outline (FORM), and since TODO 294 every form kind re-sites them inside it (main.js FORM_DIAL_FEET, §325
// landing 2's solve). Per build:
//   F1 each foot stands inside the outline the dial and the plates are cut to by the rim margin plus its own radius
//      (FORM.inset ≥ PLATE_RIM_MARGIN + DIAL_FOOT_R), so it is wholly under the dial and on the plate, and it is
//      sited by the outline, not counted metal (userData.followsOutline: the fit cannot be held out by it);
//   F2 the hands stand inside the feet's triangle (the dial does not tip);
//   F3 no foot is what sets the case: the regions record's binding member is not a foot.
// CONTROL: the round default keeps its feet exactly at the rim rule (each at min(dialRadius, plateR) − DIAL_FOOT_R −
// CLEAR_MARGIN off the hands, at 10°, 108° and 250°), to 1e-9.
// REPORTED: each build's fitted-case area, against the as-cut figures TODO 294 filed.
import { bootMany } from './boot-pool.mjs';

const FILED = { 'case=rect': 1162.1, 'case=cushion': 1083.3, 'case=tonneau': 1124.4, 'case=fitted': 1060.9, 'alarm=0&case=fitted': 1040.2 };
const SPECS = ['', ...Object.keys(FILED)];
const EXPR = `({ f: (() => { const c = window.__clock, D = c.labelEntries.find((e) => e.name === 'Dial').obj;
  c.scene.updateWorldMatrix(true, true);
  const feet = []; D.traverse((o) => { if (o.userData?.dialFootDeg !== undefined) { const p = o.getWorldPosition(new o.position.constructor());
    feet.push({ deg: o.userData.dialFootDeg, x: p.x, y: p.y, r: o.geometry.parameters.radiusTop, follows: !!o.userData.followsOutline,
      inset: c.form ? c.form.inset(p.x, p.y) : null }); } });
  return { feet, dial: [c.P.dial.x, c.P.dial.y], dialR: c.dialRadius, plateR: c.plateR, form: !!c.form,
    binding: c.regions?.binding ?? null, fit: c.formFootprint?.fitAreaMm2 ?? null }; })() })`;
const res = await bootMany(SPECS, EXPR);
const L = await import('../src/layout.js');
let fail = 0;
const row = (ok, what) => { console.log(`${ok ? 'OK  ' : 'FAIL'} ${what}`); if (!ok) fail++; };
for (let i = 0; i < SPECS.length; i++) {
  const q = SPECS[i] || '(default)', r = res[i];
  if (r.bootError || !r.extra) { row(false, `${q}: boot ${r.bootError ?? 'no record'}`); continue; }
  const F = r.extra.f, [hx, hy] = F.dial;
  if (F.feet.length !== 3) { row(false, `${q}: ${F.feet.length} feet, not 3`); continue; }
  if (!F.form) {
    const R = Math.min(F.dialR, F.plateR) - F.feet[0].r - L.CLEAR_MARGIN;
    const dev = Math.max(...F.feet.map((t) => Math.hypot(t.x - hx - R * Math.cos(t.deg * Math.PI / 180), t.y - hy - R * Math.sin(t.deg * Math.PI / 180))));
    row(dev <= 1e-9 && F.feet.every((t) => !t.follows), `${q} CONTROL: the round build's feet stand at the rim rule (r ${R.toFixed(4)}, worst ${dev.toExponential(1)})`);
    continue;
  }
  const need = L.PLATE_RIM_MARGIN + F.feet[0].r;
  row(F.feet.every((t) => t.follows && t.inset >= need - 1e-6), `${q} F1: each foot ${F.feet.map((t) => t.inset.toFixed(2)).join(' / ')} u inside the cut outline (need ${need.toFixed(2)}), sited by it`);
  const cr = (a, b) => (b.x - a.x) * (hy - a.y) - (b.y - a.y) * (hx - a.x);
  const s = F.feet.map((t, k) => cr(t, F.feet[(k + 1) % 3]));
  row(s.every((v) => Math.sign(v) === Math.sign(s[0]) && v !== 0), `${q} F2: the hands stand inside the feet's triangle`);
  const b = F.binding;
  const footBinds = b && b.unit === 'Dial' && F.feet.some((t) => Math.abs(t.inset - (b.inset ?? NaN)) < 1e-3);
  row(!footBinds, `${q} F3: the case's binding member is ${b ? `${b.unit} (${b.group}), inset ${b.inset}` : 'none'}, not a foot`);
  console.log(`     REPORT ${q}: fitted case ${F.fit.toFixed(1)} mm² against ${FILED[SPECS[i]]} as filed (${((F.fit / FILED[SPECS[i]] - 1) * 100).toFixed(1)}%)`);
}
process.exit(fail ? 1 : 0);
