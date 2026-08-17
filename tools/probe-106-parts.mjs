// §106 — the stop-work's two bodies, measured before they are sited.
//
// P0/P2 in free space, per the design-priority order: the cross and the finger
// are checked against their own spec and against EACH OTHER through the whole
// engagement, with no movement around them. What this asks:
//
//   · does the spec's index angle actually come out 2π/N (the test the
//     inverted relation fails, and the one a²+b²=d² cannot see);
//   · are the cut sections above the §50 floor — arm web, rim walls, hub;
//   · does the cross's outline trace closed, with the bore as its one hole;
//   · over the engagement, does the pin stay inside its slot and the cross's
//     rim stay clear of the finger's disc — the P2 question the pair sweep
//     structurally cannot ask, because these two are one unit.
//
// Run: node tools/probe-106-parts.mjs
import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
const port = process.env.PORT || '8494';
const srv = spawn('python3', ['-m', 'http.server', port, '--bind', '127.0.0.1'],
  { cwd: '..', stdio: 'ignore' });
await new Promise((r) => setTimeout(r, 900));
const browser = await chromium.launch();
const page = await browser.newPage();
page.on('pageerror', (e) => console.log('PAGEERROR', String(e)));
page.on('console', (m) => { if (m.type() === 'error') console.log('CONSOLE', m.text()); });
await page.goto(`http://127.0.0.1:${port}/test-geometry.html`, { waitUntil: 'load', timeout: 90000 });

const out = await page.evaluate(async () => {
  const G = await import('./src/geometry.js');
  const UNIT_MM = 0.379, STOCK = 0.12 / UNIT_MM, PIVOT = 0.07 / UNIT_MM, MARGIN = 0.15;
  const studR = PIVOT + 0.01 + STOCK;
  // The arbor sits at the §50 pivot floor, and the stall confirms the floor
  // is enough rather than the floor being assumed adequate: at the bank the
  // pinion carries a quarter of the alarm arbor's torque (11 t on 44 t), and
  // k·θ at full wind is 1.472e-5 × 26.7 = 3.93e-4 N·m, so T = 9.8e-5 N·m.
  // τ = 2T/πr³ at r = 0.07 mm is 182 MPa against hardened steel's ~600 MPa
  // shear — a factor of 3.3. The radius the stall alone would ask for is
  // 0.179 u, just UNDER the floor, so the floor governs and is sound.
  const spec = G.genevaSpec({ N: 8, stockMin: STOCK, pivotMin: PIVOT, margin: MARGIN, studR, arborR: PIVOT });
  const r = { spec: {}, checks: [] };
  r.floors = Object.fromEntries(Object.entries(spec.floors).map(([k, v]) => [k, +v.toFixed(4)]));
  r.horn = +spec.horn.toFixed(4);
  for (const k of ['N', 'd', 'a', 'b', 'slotW', 'slotInner', 'hubR', 'lockR', 'web', 'banks'])
    r.spec[k] = typeof spec[k] === 'number' ? +spec[k].toFixed(4) : spec[k];

  const push = (name, ok, got, want) => r.checks.push({ name, ok, got, want });
  // the angle, which is the whole point
  const index = 2 * Math.asin(spec.a / spec.d);
  push('index = 2π/N', Math.abs(index - (2 * Math.PI) / 8) < 1e-12,
    +(index * 180 / Math.PI).toFixed(6) + '°', '45°');
  push('a² + b² = d²', Math.abs(spec.a ** 2 + spec.b ** 2 - spec.d ** 2) < 1e-12,
    (spec.a ** 2 + spec.b ** 2 - spec.d ** 2).toExponential(1), '0');
  push('arm web ≥ §50 floor', spec.web >= STOCK - 1e-9, +spec.web.toFixed(4), +STOCK.toFixed(4));
  push('rim pitch ≥ slot + 2 walls', (2 * Math.PI * spec.b) / 8 >= spec.slotW + 2 * STOCK,
    +((2 * Math.PI * spec.b) / 8).toFixed(4), +(spec.slotW + 2 * STOCK).toFixed(4));
  push('the pin banks on the blank arm', spec.banks, `d−a ${+spec.slotInner.toFixed(3)}`, `< b ${+spec.b.toFixed(3)}`);
  push('locking disc clears its arbor', spec.lockR > spec.arborR, +spec.lockR.toFixed(4), `> arbor ${+spec.arborR.toFixed(4)}`);

  // NOT a free-disc test against a headline number any more. That check quoted
  // "8.067 at az 12°", which is the §106 scan's best over ALL centre distances
  // — the misread that put the pinion on another arbor. Whether the assembly
  // FITS is `probe-106-resite`'s question, asked per member over three
  // freedoms; what belongs here is that the horn floor governs, since it is the
  // floor that sets d and the one a change to the spec would silently move.
  push('the horn floor is what sets d', Math.abs(spec.d - spec.floors.horn) < 1e-9,
    +spec.floors.horn.toFixed(4), 'd ' + +spec.d.toFixed(4));
  push('the horn clears the finger BORE, not the bare arbor',
    spec.horn >= spec.fingerBoreR + MARGIN - 1e-9,
    +spec.horn.toFixed(4), `≥ bore+margin ${+(spec.fingerBoreR + MARGIN).toFixed(4)}`);

  const cross = G.makeGenevaCross({ spec, thickness: 0.5, blankAt: 0 });
  const fing = G.makeGenevaFinger({ spec, thickness: 0.5, boreR: spec.arborR });
  const poly = cross.userData.outline;
  push('cross outline traced', poly && poly.length > 200, poly ? poly.length + ' pts' : 'none', '> 200');
  const rr = poly.map(([x, y]) => Math.hypot(x, y));
  push('outline inside the rim', Math.max(...rr) <= spec.b + 0.02,
    +Math.max(...rr).toFixed(4), '≤ b ' + +spec.b.toFixed(3));
  push('outline reaches the rim', Math.max(...rr) >= spec.b - 0.02,
    +Math.max(...rr).toFixed(4), '≈ b');
  // the OUTER loop's innermost point is a slot's rounded bottom; the hub is
  // reached only by the bore, which is a hole and a separate loop
  const slotBottom = spec.slotInner - spec.slotW / 2;
  push('outline reaches the slot bottoms', Math.abs(Math.min(...rr) - slotBottom) < 0.02,
    +Math.min(...rr).toFixed(4), 'slot floor ' + +slotBottom.toFixed(3));

  // THE ENGAGEMENT, both bodies at once. The pin must sit in a slot the whole
  // time, and the cross must not eat the finger's disc.
  //
  // The cross is measured through its OWN TRACED OUTLINE, not an idealised rim
  // circle (MODELING rule 1). That distinction is the whole measurement here:
  // against a plain rim the pair reads 0.064 of interference at a fixed spot,
  // and the spot is a HOLLOW — metal the builder already cut away for exactly
  // this clearance. Measuring the shape that was authored rather than the one
  // that was cut invents a collision and would have been "fixed" by thinning
  // something real.
  const sweep = Math.PI / 2 - spec.beta;
  const poly2 = cross.userData.outline;
  const fo = fing.userData.outline;
  let pinWorst = Infinity, discWorst = Infinity, slotErr = 0, worstAt = null;
  const psiEngaged = (1 / spec.N) * Math.PI * 2;   // station 1; station 0 is the blank
  for (let k = 0; k <= 400; k++) {
    const th = -sweep + (2 * sweep * k) / 400;
    const px = spec.a * Math.cos(th), py = spec.a * Math.sin(th);       // pin, driver frame
    const gam = Math.atan2(py, px - spec.d);                            // slot direction
    const fromCross = Math.hypot(px - spec.d, py);
    if (fromCross < spec.slotInner - 1e-6 || fromCross > spec.b + 1e-6) slotErr++;
    pinWorst = Math.min(pinWorst, fromCross - spec.slotInner, spec.b - fromCross);
    const chi = gam - psiEngaged, cc = Math.cos(chi), sc = Math.sin(chi);
    for (let m = 0; m < poly2.length; m += 2) {
      const [lx, ly] = poly2[m];
      const qx = spec.d + lx * cc - ly * sc, qy = lx * sc + ly * cc;
      const q = Math.hypot(qx, qy);
      if (q > spec.lockR) continue;
      let ang = Math.atan2(qy, qx) - th;
      ang = ((ang % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2);
      const i = Math.round((ang / (Math.PI * 2)) * fo.length) % fo.length;
      const gap = q - Math.hypot(fo[i][0], fo[i][1]);
      if (gap < discWorst) { discWorst = gap; worstAt = { th: +(th * 180 / Math.PI).toFixed(1), q: +q.toFixed(3) }; }
    }
  }
  r.worstAt = worstAt;
  push('pin stays in its slot', slotErr === 0, slotErr + ' samples out', '0');
  push('pin clear of slot ends', pinWorst > -1e-6, +pinWorst.toFixed(4), '≥ 0');
  push('cross clear of the finger disc', discWorst > 0, +discWorst.toFixed(4), '> 0');
  r.tri = { verts: cross.geometry.attributes.position.count };
  return r;
});

console.log('--- the floors on d (largest binds) ---');
for (const [k, v] of Object.entries(out.floors)) console.log(`  ${k.padEnd(6)} ${v}`);
console.log(`  horn clearance at the chosen d: ${out.horn}`);
console.log('\n--- the derived spec ---');
for (const [k, v] of Object.entries(out.spec)) console.log(`  ${k.padEnd(11)} ${v}`);
console.log('\n--- checks ---');
let bad = 0;
for (const c of out.checks) {
  if (!c.ok) bad++;
  console.log(`  ${c.ok ? 'PASS' : 'FAIL'}  ${c.name.padEnd(36)} ${String(c.got).padStart(14)}   want ${c.want}`);
}
console.log(`\ncross mesh: ${out.tri.verts} verts   worst disc approach at ${JSON.stringify(out.worstAt)}`);
console.log(bad ? `\n${bad} FAILING` : '\nall checks pass');
await browser.close();
srv.kill();
process.exit(bad ? 1 : 0);
