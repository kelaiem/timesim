// §129 — the spider differential, measured as a body before it is a member.
//
// The builder's whole job is a SIGN. Two side gears face each other from a
// shared pitch apex, so one of the two mounts lays its local +Z onto world −Z
// and a rotation about that gear's own axis reads NEGATED in world. Get that
// pair the wrong way round and the differential still turns — it just stops
// subtracting, which is exactly the failure TODO 55 exists to fix and would be
// invisible to anything that only looks at it.
//
// So this measures the ABSOLUTE rotation of each member by tracking a marked
// material point through the world matrices, and asks the two questions that
// tell a subtractor from a sum:
//
//   · turn both inputs TOGETHER and the whole assembly must turn as one rigid
//     body — cage with them, planets dead still;
//   · turn them OPPOSITE and the cage must stand still while the planets roll.
//
// Run: node tools/probe-129-spider.mjs
import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
const port = process.env.PORT || '8512';
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
  const THREE = await import('./vendor/three.module.js');
  const UNIT_MM = 0.379, STOCK = 0.12 / UNIT_MM, PIVOT = 0.07 / UNIT_MM;
  // the budget the movement actually leaves beside the barrel at the solved leg
  // count — see main.js's leg-count derivation
  const BUDGET = 1.7613;
  const spec = G.spiderSpec({ arborR: PIVOT, stockMin: STOCK, tipBudget: BUDGET,
    thickness: 0.8 });
  const diff = G.makeSpiderDifferential({
    spec, outModule: 0.2, outTeeth: 24, thickness: 0.8,
  });
  const root = new THREE.Group();
  root.add(diff);

  const named = (n) => { let f = null; diff.traverse((o) => { if (o.name === n) f = o; }); return f; };
  // a marked material point on each body, taken in its own local frame
  const MARK = new THREE.Vector3(spec.R * 0.6, 0, 0);
  const track = {
    sideA: named('spiderSideA'), sideB: named('spiderSideB'),
    cage: named('spiderCageSpin'), planet0: named('spiderPlanet0'), planet1: named('spiderPlanet1'),
  };
  // A planet's roll is only meaningful RELATIVE TO THE CAGE and about the
  // planet's OWN axis, and both of those move. Measured in world about a fixed
  // axis it reads the cage's motion instead, which is the reading that made
  // this probe's first run call a still planet a rolling one. So the marked
  // point goes into the CAGE's frame, where each planet's axis is a constant
  // (cos a, sin a, 0), and the azimuth is taken in the plane normal to it with
  // a right-handed basis about that axis — the same sense for every planet, so
  // "the same about their own outward axes" becomes a comparison of equals.
  const azOf = (o, axis) => {
    root.updateMatrixWorld(true);
    const w = o.localToWorld(MARK.clone());
    if (axis === 'z') return Math.atan2(w.y, w.x);
    const u = axis;                                  // the planet's cage-local axis
    const p = track.cage.worldToLocal(w.clone());
    const e1 = new THREE.Vector3(0, 0, 1).cross(u).normalize();
    const e2 = u.clone().cross(e1).normalize();
    return Math.atan2(p.dot(e2), p.dot(e1));
  };
  // The planets sit in the cage wheel's CROSSINGS — a quarter turn off its arms
  // — so their axes are ±Y, not ±X. Measuring them about the old axes read a
  // constant pi and called a correct roll a failure: the frame a rotation is
  // measured in is part of the measurement.
  const AX = {
    sideA: 'z', sideB: 'z', cage: 'z',
    planet0: new THREE.Vector3(0, 1, 0), planet1: new THREE.Vector3(0, -1, 0),
  };
  const unwrap = (a, b) => { let d = b - a; while (d > Math.PI) d -= Math.PI * 2; while (d <= -Math.PI) d += Math.PI * 2; return d; };

  const readAll = () => Object.fromEntries(Object.entries(track).map(([k, o]) => [k, azOf(o, AX[k])]));
  diff.userData.pose(0, 0);
  const base = readAll();
  const delta = (tA, tB) => {
    diff.userData.pose(tA, tB);
    const now = readAll();
    return Object.fromEntries(Object.keys(base).map((k) => [k, unwrap(base[k], now[k])]));
  };

  const r = { spec: {}, checks: [], rows: [] };
  for (const k of ['module', 'sideTeeth', 'R', 'faceWidth', 'halfHeight', 'tipR', 'cageBoreR', 'hubR', 'planetBoreR', 'teethOk', 'fitsBudget'])
    r.spec[k] = typeof spec[k] === 'number' ? +spec[k].toFixed(4) : spec[k];
  const push = (n, ok, got, want) => r.checks.push({ n, ok, got, want });
  const near = (a, b, tol = 2e-3) => Math.abs(a - b) < tol;

  // 1. COMMON rotation — one rigid body, planets dead
  const t = 0.4;
  const c = delta(t, t);
  r.rows.push({ case: `both +${t}`, ...Object.fromEntries(Object.entries(c).map(([k, v]) => [k, +v.toFixed(4)])) });
  push('common: side A follows', near(c.sideA, t), +c.sideA.toFixed(4), t);
  push('common: side B follows', near(c.sideB, t), +c.sideB.toFixed(4), t);
  push('common: the cage follows too', near(c.cage, t), +c.cage.toFixed(4), t);
  push('common: the planets do NOT roll', near(c.planet0, 0) && near(c.planet1, 0),
    `${+c.planet0.toFixed(4)} / ${+c.planet1.toFixed(4)}`, '0 / 0 — it turns as one body');

  // 2. OPPOSITE rotation — the cage stands still, the planets roll
  const o = delta(t, -t);
  r.rows.push({ case: `A +${t}, B −${t}`, ...Object.fromEntries(Object.entries(o).map(([k, v]) => [k, +v.toFixed(4)])) });
  push('opposite: side A turns +', near(o.sideA, t), +o.sideA.toFixed(4), t);
  push('opposite: side B turns −', near(o.sideB, -t), +o.sideB.toFixed(4), -t);
  push('opposite: the cage stands still', near(o.cage, 0), +o.cage.toFixed(4), '0');
  const rollWant = (spec.sideTeeth / spec.planetTeeth) * t;   // planetOf(t, −t)
  push('opposite: the planets roll by (Zs/Zp)·(A−B)/2',
    near(Math.abs(o.planet0), rollWant), +Math.abs(o.planet0).toFixed(4), rollWant);
  push('opposite: both planets roll the same about their own axes',
    near(o.planet0, o.planet1), `${+o.planet0.toFixed(4)} / ${+o.planet1.toFixed(4)}`, 'equal');

  // 3. the defining relation, over a spread of asymmetric inputs
  let worst = 0;
  for (let i = 0; i <= 12; i++) {
    const a = -0.6 + (1.2 * i) / 12, b = 0.35 - (0.9 * i) / 12;
    const d = delta(a, b);
    worst = Math.max(worst, Math.abs(d.cage - (a + b) / 2));
  }
  push('cage = (A + B)/2 everywhere', worst < 2e-3, worst.toExponential(1), '0 — the differential relation');

  // 4. it is METAL: sections at or above the §50 floor, and every body closed
  push('face width at or above the §50 floor', spec.faceWidth >= STOCK - 1e-9,
    +spec.faceWidth.toFixed(4), `≥ ${+STOCK.toFixed(4)}`);
  push('tooth counts clear minGearTeeth', spec.teethOk, `${spec.sideTeeth}/${spec.planetTeeth}`,
    `≥ ${G.minGearTeeth(spec.module, spec.planetBoreR)}`);
  push('the planets clear the cage hub', spec.planetBoreR >= spec.hubR + spec.margin - 1e-9,
    +spec.planetBoreR.toFixed(4), `≥ hub ${+spec.hubR.toFixed(4)} + margin`);
  push('the SWEPT radius fits the budget the metal leaves', spec.fitsBudget,
    +spec.sweptR.toFixed(4), `≤ ${BUDGET}`);
  // A cone's rim stands one tip radius OFF the cage's axis as well as one out
  // along its own, so what it sweeps is √2·tip. Sizing to the tip is the same
  // error as scoring a rotor by its resting silhouette, one dimension down.
  push('the swept radius is √2 × the tip, not the tip',
    Math.abs(spec.sweptR - spec.tipR * Math.SQRT2) < 1e-12,
    `${+spec.tipR.toFixed(4)} → ${+spec.sweptR.toFixed(4)}`, '√2 ×');
  // AND AN IMPOSSIBLE BUDGET MUST BE REFUSED, not met by shrinking the teeth
  // until they fit. Asked for a budget nothing can satisfy, the spec used to
  // return a 114-tooth wheel at module 0.018 — 0.007 mm teeth — and call it a
  // solution. A tooth is a section, so the §50 floor reaches it.
  // Two ways to be impossible, and both must be REFUSED rather than met.
  // A budget under even the smallest wheel the bore stack allows: nothing to
  // shrink, so it fails on the swept radius.
  const tooSmall = G.spiderSpec({ arborR: PIVOT, stockMin: STOCK, tipBudget: 1.16,
    thickness: 0.8 });
  push('a budget under the bore stack is refused', !tooSmall.fitsBudget,
    `swept ${+tooSmall.sweptR.toFixed(4)} vs budget 1.16`, 'refused');
  // And the one the floor exists for: a budget just tight enough that the only
  // way in is finer teeth. This returned a 64-tooth wheel at module 0.032 —
  // 0.012 mm teeth — and called it a solution.
  const squeezed = G.spiderSpec({ arborR: PIVOT, stockMin: STOCK, tipBudget: 1.48,
    thickness: 0.8 });
  push('a budget reachable only by finer teeth is refused too',
    !squeezed.cuttable && !squeezed.fitsBudget,
    `${squeezed.sideTeeth} t at module ${+squeezed.module.toFixed(4)} vs floor ${+squeezed.moduleMin.toFixed(4)}`,
    'refused — a tooth is a section');
  push('the rim is §50 stock', spec.R - spec.planetBoreR >= STOCK - 1e-9,
    +(spec.R - spec.planetBoreR).toFixed(4), `≥ ${+STOCK.toFixed(4)}`);
  let meshes = 0, degenerate = 0;
  diff.traverse((m) => {
    if (!m.isMesh) return;
    meshes++;
    const p = m.geometry.attributes.position;
    if (!p || p.count < 12) degenerate++;
  });
  push('every body is real geometry', degenerate === 0, `${meshes} meshes, ${degenerate} degenerate`, '0 degenerate');
  return r;
});

console.log('--- the spider, derived ---');
for (const [k, v] of Object.entries(out.spec)) console.log(`  ${k.padEnd(12)} ${v}`);
console.log('\n--- absolute rotations, tracked through the world matrices ---');
for (const row of out.rows) {
  const { case: c, ...rest } = row;
  console.log(`  ${c.padEnd(14)} ` + Object.entries(rest).map(([k, v]) => `${k} ${String(v).padStart(8)}`).join('  '));
}
console.log('\n--- checks ---');
let bad = 0;
for (const c of out.checks) {
  if (!c.ok) bad++;
  console.log(`  ${c.ok ? 'PASS' : 'FAIL'}  ${c.n.padEnd(48)} ${String(c.got).padStart(18)}   want ${c.want}`);
}
console.log(bad ? `\n${bad} FAILING` : '\nall checks pass');
await browser.close();
srv.kill();
process.exit(bad ? 1 : 0);
