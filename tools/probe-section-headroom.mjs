// TODO 109 step 2 — HOW MUCH SECTION CAN EACH BAR ACTUALLY GAIN?
//
// Step 1 established which of §54's unwaived rows are measuring the right free
// length. For those, the fix is section: λ = Lₑ/t, so t = Lₑ/30. That is
// arithmetic on the row. What it does NOT say is whether the movement has room
// for the thicker bar — and CLAUDE.md's design priority is explicit that a
// section may not be spent to buy packaging (P1 outranks P3, and P3 is
// resolved in position space). So the section a row NEEDS and the section its
// corridor ALLOWS are two different numbers, and this measures the second.
//
// For each bar: the nearest cross-unit metal, over a pose net, ranked. Growing
// a round bar's radius by δ closes the gap by δ; growing a flat's stiff
// dimension symmetrically closes it by δ/2 per side. So the headroom is
// (nearest gap − CLEAR_MARGIN), and the neighbour that owns that gap is the
// WALL — the thing a position-space fix would have to move.
//
// IT RANKS RATHER THAN MINIMISES, on purpose. Several of these bars are PINNED
// to metal in another unit (the hack rod to `Setting lever / hackRodPin`, the
// reset rod to the hammer), and a working joint reads 0.0000. A probe that
// reported only the minimum would call every rod immovable and be wrong every
// time. The reader needs to see the 0.0000 that is a joint and the 0.42 that
// is a wall in the same list.
//
// Same-unit neighbours are excluded: a bar growing into its own jog, knuckle
// or pin is `intraUnit`'s business and usually desirable (they are one part).
//
// IT REPORTS ARITHMETIC, NOT INTENT. A near cross-unit neighbour may be a
// DECLARED working contact — `Alarm crown ⇄ Alarm release lifter` is an
// EXPECTED pair (§45, the lifter head riding the stem collar), and a cam that
// rides is supposed to be close. The probe cannot read `EXPECTED_PAIRS`
// (inspect.js does not export it) and does not guess: it prints the gap, the
// growth, and the difference. Deciding whether a given neighbour is a wall or
// a working contact is the reader's, against inspect.js.
//
// COARSE BY DESIGN — samplesPerAxis over AXES, not the battery's refined
// sweep. It exists to say which section is worth ATTEMPTING; the battery is
// the acceptance for one that lands. A REPORT (§40): prints and exits 0.
//
// Usage: node probe-section-headroom.mjs [out.json]   (from tools/;
// needs npm ci + Playwright Chromium).
import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import { writeFileSync } from 'node:fs';

const PORT = process.env.PORT || 8474;
const ROOT = process.env.ROOT || '..';
const SAMPLES = +(process.env.SAMPLES || 5);
const srv = spawn('python3', ['-m', 'http.server', String(PORT), '--bind', '127.0.0.1'], { cwd: ROOT, stdio: 'ignore' });
await new Promise((r) => setTimeout(r, 800));
const browser = await chromium.launch();
const page = await browser.newPage();
page.on('pageerror', (e) => console.error('PAGEERROR', String(e)));
await page.goto(`http://127.0.0.1:${PORT}/index.html`, { waitUntil: 'load', timeout: 60000 });
await page.waitForFunction(() => !!window.__clock, null, { timeout: 60000 });

const V = await page.evaluate(async ({ SAMPLES }) => {
  const THREE = await import('./vendor/three.module.js');
  const I = await import('./src/inspect.js');
  const { CLEAR_MARGIN, UNIT_MM } = await import('./src/layout.js');
  const clock = window.__clock;
  I.enterAxis(clock);
  clock.scene.updateMatrixWorld(true);

  const unitObj = new Map(clock.labelEntries.map((e) => [e.name, e.obj]));
  const byMesh = new Map();
  const hops = (mesh, name) => { const t = unitObj.get(name); let n = 0;
    for (let o = mesh; o; o = o.parent, n++) if (o === t) return n; return Infinity; };
  const walk = (o, unitName) => {
    if (o.userData && o.userData.schematic) return;
    if (o.isMesh && o.geometry?.attributes?.position) {
      const prev = byMesh.get(o);
      if (!prev || hops(o, unitName) < hops(o, prev.unit)) byMesh.set(o, { unit: unitName, mesh: o });
    }
    for (const c of o.children) walk(c, unitName);
  };
  for (const e of clock.labelEntries) walk(e.obj, e.name);
  const all = [...byMesh.values()];

  const dims = (mesh) => { mesh.geometry.computeBoundingBox();
    const b = mesh.geometry.boundingBox;
    const d = [b.max.x - b.min.x, b.max.y - b.min.y, b.max.z - b.min.z].sort((x, y) => x - y);
    return { tMin: d[0], tMid: d[1], len: d[2] }; };

  // The bars: §54's unwaived over-ceiling rows, matched to their meshes BY
  // MEASUREMENT (the row's own section and stock in mm), never by name — six
  // of them answer to `(unnamed)`.
  const rep = I.checkSlenderness(clock);
  const targets = [];
  for (const row of rep.rows.filter((r) => !r.waived)) {
    const near = (a, b) => Math.abs(a - b) <= 1.5e-4;
    const stock = row.stock_mm != null ? row.stock_mm : row.length_mm;
    const hits = all.filter((e) => {
      if (e.unit !== row.unit || (e.mesh.name || '(unnamed)') !== row.mesh) return false;
      const { tMin, tMid, len } = dims(e.mesh);
      return near(tMin * UNIT_MM, row.thin_mm) && near(tMid * UNIT_MM, row.section_mm)
        && Math.abs(len * UNIT_MM - stock) <= 1.5e-3;
    });
    if (hits.length === 1) targets.push({ row, mesh: hits[0].mesh, unit: row.unit });
  }

  // CONTROLS. Two ends of the scale, and the first is an EQUALITY rather than
  // a plausibility: the battery's own `clearances` row publishes
  // `Alarm lock ⇄ Alarm striking wheel min 0.1572 at alarmStrike f=0.1743,
  // meshes alarmLockPad ⇄ alarmLockCollar`. Posed there, this probe's distance
  // call must return that number. A probe that measures nothing returns 0 or
  // Infinity; a probe that measures the wrong thing returns something else.
  // The second control is a pair that genuinely touches, so a 0.0000 is known
  // to be readable rather than assumed.
  const findMesh = (unit, name) => {
    const root = unitObj.get(unit); if (!root) return null;
    let hit = null; root.traverse((o) => { if (!hit && o.isMesh && o.name === name) hit = o; });
    return hit;
  };
  const controls = {
    exact: (() => {
      const a = findMesh('Alarm lock', 'alarmLockPad'), b = findMesh('Alarm striking wheel', 'alarmLockCollar');
      if (!a || !b) return { ok: false, why: 'control meshes not found — the published row names alarmLockPad ⇄ alarmLockCollar' };
      const ax = I.resolveAxes().find((x) => x.name === 'alarmStrike');
      if (!ax) return { ok: false, why: 'no alarmStrike axis' };
      I.enterAxis(clock);
      clock.setPose(ax.pose(0.1743));
      clock.scene.updateMatrixWorld(true);
      const d = I.meshClearance(a, b, Infinity);
      return { ok: Math.abs(d - 0.1572) <= 5e-4, measured: +d.toFixed(4), published: 0.1572,
               why: 'the battery publishes this pair at this pose; the probe must reproduce it' };
    })(),
    contact: (() => {
      // UNIT to UNIT, every mesh against every mesh. The version before this
      // took each unit's biggest mesh and read 0.2762 over the whole beat:
      // the fork BODY never touches the wheel, the pallet STONES do, and they
      // are separate meshes. Two controls in a row indicting themselves is
      // the argument for writing controls that fail loudly.
      const meshesOf = (unit) => { const root = unitObj.get(unit); const out = [];
        if (root) root.traverse((o) => { if (o.isMesh && o.geometry?.attributes?.position && !o.userData?.schematic) out.push(o); });
        return out; };
      const A = meshesOf('Escape wheel'), F = meshesOf('Pallet fork');
      if (!A.length || !F.length) return { ok: null, why: 'contact control meshes not found — reported, not assumed' };
      // OVER THE BEAT, not at one pose. The first version of this control
      // measured at tau 0 and read 0.3466 — the fork is between locks there,
      // so it indicted the control rather than the probe. An escapement
      // touches once per lock, which is a pose you have to look for.
      const ax = I.resolveAxes().find((x) => x.name === 'beat');
      let d = Infinity;
      I.enterAxis(clock);
      for (let i = 0; i < 24; i++) {
        clock.setPose(ax.pose(i / 23));
        clock.scene.updateMatrixWorld(true);
        for (const x of A) for (const y of F) d = Math.min(d, I.meshClearance(x, y, d));
      }
      return { ok: d <= 1e-4, measured: +d.toFixed(4), why: 'the escapement locks once per beat, so the minimum over the beat must be 0' };
    })(),
  };
  const control = [];

  const _bA = new THREE.Box3(), _bB = new THREE.Box3();
  const SEARCH = 2.5;   // u — beyond this a neighbour cannot become a wall at any section these rows want
  const nearestFor = (mesh, unit, acc) => {
    _bA.setFromObject(mesh).expandByScalar(SEARCH);
    for (const c of all) {
      if (c.unit === unit || c.mesh === mesh) continue;
      _bB.setFromObject(c.mesh);
      if (!_bA.intersectsBox(_bB)) continue;
      const d = I.meshClearance(mesh, c.mesh, SEARCH);
      if (!(d < SEARCH)) continue;
      const key = `${c.unit} / ${c.mesh.name || '(unnamed)'}`;
      const prev = acc.get(key);
      if (!prev || d < prev.d) acc.set(key, { d, unit: c.unit, label: c.mesh.name || '(unnamed)' });
    }
  };

  const accs = new Map([...targets, ...control].map((t) => [t.mesh, new Map()]));
  const axes = I.resolveAxes();
  let poses = 0;
  for (const ax of axes) {
    I.enterAxis(clock);
    for (let i = 0; i < SAMPLES; i++) {
      const f = SAMPLES === 1 ? 0 : i / (SAMPLES - 1);
      clock.setPose(ax.pose(f));
      clock.scene.updateMatrixWorld(true);
      poses++;
      for (const t of targets) nearestFor(t.mesh, t.unit, accs.get(t.mesh));
      for (const c of control) nearestFor(c.mesh, c.name, accs.get(c.mesh));
    }
  }

  const pack = (mesh) => [...accs.get(mesh).values()].sort((a, b) => a.d - b.d)
    .slice(0, 6).map((x) => ({ neighbour: `${x.unit} / ${x.label}`, gap_u: +x.d.toFixed(4), gap_mm: +(x.d * UNIT_MM).toFixed(4) }));

  return {
    clearMargin: CLEAR_MARGIN, unitMm: UNIT_MM, samplesPerAxis: SAMPLES, axes: axes.length, poses, search: SEARCH,
    rows: targets.map((t) => ({
      unit: t.unit, mesh: t.row.mesh, lambda: t.row.lambda, ceiling: t.row.ceiling,
      section_mm: t.row.section_mm, thin_mm: t.row.thin_mm,
      round: Math.abs(t.row.thin_mm - t.row.section_mm) <= 1e-4,
      needed_mm: +(((t.row.governing ? t.row.governing.effectiveL_u * (t.row.length_mm / t.row.governing.L_u) : t.row.length_mm)) / t.row.ceiling).toFixed(4),
      nearest: pack(t.mesh),
    })),
    controls,
  };
}, { SAMPLES });

await browser.close();
srv.kill();

const out = process.argv[2];
if (out) writeFileSync(out, JSON.stringify(V, null, 2));

console.log(`${V.rows.length} bars, ${V.axes} axes × ${V.samplesPerAxis} samples = ${V.poses} poses; CLEAR_MARGIN ${V.clearMargin} u, search radius ${V.search} u\n`);
for (const r of V.rows) {
  const grow = r.needed_mm - r.section_mm;
  const growU = grow / V.unitMm;
  const closes = r.round ? growU / 2 : growU / 2;   // radial growth per side, either way
  console.log(`${r.unit} / ${r.mesh}  λ ${r.lambda}  section ${r.section_mm} mm → needs ${r.needed_mm} mm (+${grow.toFixed(4)} mm = ${growU.toFixed(4)} u across, ${closes.toFixed(4)} u per side)`);
  for (const n of r.nearest) {
    const verdict = n.gap_u <= 1e-4 ? 'TOUCHING (a joint, or a wall already spent)'
      : n.gap_u - V.clearMargin < closes ? `SHORT — ${(n.gap_u - V.clearMargin).toFixed(4)} u spare against ${closes.toFixed(4)} u of growth`
      : 'clears the grown section';
    console.log(`     ${n.gap_u.toFixed(4)} u (${n.gap_mm} mm)  ${n.neighbour.padEnd(42)} ${verdict}`);
  }
  console.log('');
}
console.log('CONTROLS:');
const ce = V.controls.exact, cc = V.controls.contact;
console.log(`  exactness  ${ce.ok ? 'PASS' : 'FAIL'}  measured ${ce.measured ?? '—'} against the battery's published ${ce.published ?? '—'} (alarmLockPad ⇄ alarmLockCollar at alarmStrike f=0.1743)`);
console.log(`  contact    ${cc.ok === null ? 'NOT RUN' : cc.ok ? 'PASS' : 'FAIL'}  measured ${cc.measured ?? '—'} — ${cc.why}`);
if (!ce.ok) { console.log('\n  The exactness control FAILED: nothing below this line is evidence.'); process.exitCode = 0; }
