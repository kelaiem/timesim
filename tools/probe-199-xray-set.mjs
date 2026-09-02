// §199 — DOES X-RAY GLASS THE WHOLE THREE-QUARTER PLATE, AND NOTHING ELSE?
//
// Owner's report: with x-ray on, the screwed gold chatons and the plate screws
// stood solid in a glass plate. §6's setXray swapped ONE plate mesh — the body
// — while the `Three-quarter plate` group carries eight other mesh classes
// (collars, chatons with their stones and sunk screws, seat lands, flush
// stones, pillar screws and lands). §199's rule is "x-ray glasses a UNIT, not a
// mesh": the x-ray set is every non-schematic mesh under the two units' roots.
//
// WHAT IT MEASURES, per mesh and by object identity — never by looking:
//   1. COVERAGE — x-ray on: every non-schematic mesh under 'Three-quarter
//      plate' and 'Dial' carries a material that is NOT its solid one, is
//      transparent, has depthWrite off and reads the plate body's opacity (rule
//      1: one translucency constant). The mesh-class histogram is printed so
//      "everything" is a list you can read, not a count you trust.
//   2. NO LEAK — the clones are made from SHARED materials (MATS.blueSteel is
//      every screw head in the movement, MATS.ruby every stone, MATS.gold the
//      balance's lyre too), so the leak test is the parts that share them and
//      must stay solid: the balance cock's screws, the fork cock's stone, the
//      alarm click's screw, the escape wheel. Every mesh there keeps the same
//      material OBJECT through the toggle.
//   3. ROUND TRIP — x-ray off: every mesh in the set is back on its original
//      material object; nothing anywhere in `movement` is left on a clone.
//   4. §59 PICK DEMOTION — hover a chaton bezel's projected centre: x-ray off
//      the readout must name 'Three-quarter plate' (the CONTROL — proves the
//      pointer is on the chaton), x-ray on it must name something else (the
//      wheel behind), because a glassed mesh is demoted under the pointer.
//   5. §69 COMPOSITION — with ?focus= on a unit that is not the plate, x-ray
//      on must leave the plate on x-ray clones (never a ghost-of-a-clone),
//      x-ray off must return it to focus GHOSTS (the focus is still on), and
//      clearing the focus must return every mesh to its solid material.
//   6. BOOT SILENT — no console warning at either boot.
//
// GUARDS against the clean-but-empty result: coverage asserts the plate set is
// at least the mesh classes §199 names (a walk that collected three meshes and
// glassed them all would otherwise pass), the leak set must be non-empty for
// every named control, and the hover control must FIRE (a chaton off-screen or
// under the HUD would make step 4 vacuously true, so the probe walks the
// chatons until one both names the plate off and is in the viewport).
//
// ACCEPTANCE — exits non-zero. Screenshots (x-ray off/on) land beside the
// report in $OUT when set, for the eye — the verdict never reads them.
// Run from tools/ with a Playwright Chromium: `node probe-199-xray-set.mjs`.
import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import { mkdirSync } from 'node:fs';

const port = process.env.PORT || '8499';
const root = process.env.ROOT || '..';
const OUT = process.env.OUT || null;
if (OUT) mkdirSync(OUT, { recursive: true });
const srv = spawn('python3', ['-m', 'http.server', port, '--bind', '127.0.0.1'], { cwd: root, stdio: 'ignore' });
await new Promise((r) => setTimeout(r, 900));
const browser = await chromium.launch();
// A DOM click, not Playwright's: its actionability wait needs steady frames, and
// under software GL a solid frame can take longer than the wait allows.
const clickId = (pg, id) => pg.evaluate((i) => document.getElementById(i).click(), id);
const failures = [];
const fail = (s) => { failures.push(s); console.log('  FAIL ' + s); };
const ok = (s) => console.log('  ok   ' + s);

async function boot(query) {
  const page = await browser.newPage({ viewport: { width: 900, height: 600 } });
  const warns = [];
  // Not the app's, filtered: Chromium's own software-GL notices (probe-104-boot's
  // filter); python's static server answering the dev server's /__state 404/501
  // (offline-check's `Failed to load resource` class); and three.js's
  // 'Unable to serialize Texture' on clearing a tap-focus, which is §168's
  // filed finding (the autosave serialising textures) and fires with or
  // without §199. Everything else counts.
  const NOISE = /GroupMarker|GL Driver|SwiftShader|WebGL|Failed to load resource|Unable to serialize Texture/;
  page.on('console', (m) => { if ((m.type() === 'warning' || m.type() === 'error') && !NOISE.test(m.text())) warns.push(m.text()); });
  page.on('pageerror', (e) => warns.push('PAGEERROR ' + String(e)));
  // §69 boots the SCHEMATIC tier by default, which disables the solid layer —
  // there would be no material to read and no solid for a pick to land on.
  await page.goto(`http://127.0.0.1:${port}/index.html?schematic=0${query}`, { waitUntil: 'load', timeout: 90000 });
  await page.waitForFunction(() => !!window.__clock, null, { timeout: 90000 });
  await page.waitForTimeout(1500); // the boot's own deferred passes (weld, occluders)
  return { page, warns };
}

// In-page census: material identity per mesh under a set of unit roots.
const CENSUS = `(() => {
  const C = window.__clock;
  const unit = (n) => C.labelEntries.find((e) => e.name === n)?.obj ?? null;
  const under = (n) => {
    const out = [];
    const walk = (o) => {
      if (o.userData && o.userData.schematic) return;
      if (o.isMesh && !Array.isArray(o.material)) out.push(o);
      for (const c of o.children) walk(c);
    };
    const r = unit(n); if (r) walk(r);
    return out;
  };
  // inSet/solid: setXray stamps userData.solidMat on exactly the meshes it swaps — the
  // declared membership, read back rather than inferred from transparency (the ruby is
  // transparent by nature and would fool an opacity test either way).
  const row = (m) => ({ mesh: m.uuid, name: m.name || '(unnamed)', mat: m.material.uuid,
    inSet: !!m.userData.solidMat, solid: m.userData.solidMat ? m.userData.solidMat.uuid : null,
    transparent: !!m.material.transparent, opacity: m.material.opacity, depthWrite: m.material.depthWrite });
  return {
    plate: under('Three-quarter plate').map(row),
    dial: under('Dial').map(row),
    controls: Object.fromEntries(['Balance cock', 'Fork cock', 'Alarm click', 'Escape wheel'].map((n) => [n, under(n).map(row)])),
  };
})()`;

const hist = (rows) => { const h = {}; for (const r of rows) h[r.name] = (h[r.name] || 0) + 1; return h; };

// ---------------------------------------------------------------- boot 1
console.log('§199 x-ray set — boot 1 (plain)');
const { page, warns } = await boot('');
const off1 = await page.evaluate(CENSUS);
console.log(`  plate meshes under the unit: ${off1.plate.length}  classes: ${JSON.stringify(hist(off1.plate))}`);
console.log(`  dial meshes: ${off1.dial.length}; controls: ${Object.entries(off1.controls).map(([k, v]) => `${k}=${v.length}`).join(', ')}`);
const NAMED = ['pivotCollar', 'chatonBezel'];
for (const n of NAMED) if (!off1.plate.some((r) => r.name === n)) fail(`plate set has no '${n}' — the walk is not seeing the plate's own metal`);
if (off1.plate.length < 20) fail(`plate set is ${off1.plate.length} meshes — too few for a body + collars + chatons + screws`);
for (const [k, v] of Object.entries(off1.controls)) if (!v.length) fail(`control '${k}' resolved to no meshes — the leak test would be vacuous`);
// Screenshots are for the eye and never for the verdict: under software GL a
// solid frame can take seconds, so they get a long timeout and may not land.
const shot = async (pg, name) => { if (!OUT) return; try { await pg.screenshot({ path: `${OUT}/${name}.png`, timeout: 120000 }); } catch (e) { console.log(`  (screenshot ${name} skipped: ${String(e).split('\n')[0]})`); } };
await shot(page, '199-xray-off');

// x-ray ON
await clickId(page, 'btn-xray');
await page.waitForTimeout(300);
const on1 = await page.evaluate(CENSUS);
await shot(page, '199-xray-on');
const byMesh = (rows) => new Map(rows.map((r) => [r.mesh, r]));
const plateOpacity = await page.evaluate(() => {
  const C = window.__clock; let best = null;
  C.labelEntries.find((e) => e.name === 'Three-quarter plate').obj.traverse((o) => {
    if (o.isMesh && !o.userData.schematic && o.material.transparent && best === null) best = o.material.opacity;
  });
  return best;
});
console.log(`  x-ray on: plate opacity read ${plateOpacity}`);
{
  const before = byMesh(off1.plate), after = on1.plate;
  let n = 0, bad = 0;
  for (const r of after) {
    const b = before.get(r.mesh); n++;
    const good = b && r.mat !== b.mat && r.transparent && r.depthWrite === false && Math.abs(r.opacity - plateOpacity) < 1e-9;
    if (!good) { bad++; if (bad <= 6) console.log(`    not glass: ${r.name} transparent=${r.transparent} opacity=${r.opacity} depthWrite=${r.depthWrite} swapped=${b && r.mat !== b.mat}`); }
  }
  bad ? fail(`coverage: ${bad}/${n} plate meshes not on an x-ray clone`) : ok(`coverage: ${n}/${n} plate meshes on x-ray clones at opacity ${plateOpacity}`);
  // The 'Dial' label is dialGroup, which also parents the hands and the motion
  // works — §6 keeps those SOLID on purpose — so the dial claim is over §6's own
  // declared set (userData.solidMat), not the whole subtree.
  const bd = byMesh(off1.dial); let dbad = 0, dn = 0;
  for (const r of on1.dial) { if (!r.inSet) continue; dn++; const b = bd.get(r.mesh); if (!(b && r.mat !== b.mat && r.transparent && r.depthWrite === false)) dbad++; }
  if (!dn) fail('dial: §6 set is empty under the Dial label');
  else dbad ? fail(`dial coverage: ${dbad}/${dn} of §6's set not glass (§6 regressed)`) : ok(`dial: ${dn}/${dn} of §6's set glass (${on1.dial.length - dn} dialGroup meshes outside it — hands, motion works — untouched)`);
  const notInSet = off1.plate.filter((r) => !r.inSet).length;
  notInSet ? fail(`membership: ${notInSet} plate meshes carry no solidMat — outside the set the toggle swaps`) : ok(`membership: all ${off1.plate.length} plate meshes are in the declared x-ray set`);
  const clones = new Set(after.map((r) => r.mat));
  console.log(`  distinct clone materials on the plate: ${clones.size}`);
}
{
  let leaks = 0, n = 0;
  for (const [k, rows] of Object.entries(on1.controls)) {
    const before = byMesh(off1.controls[k]);
    for (const r of rows) { n++; if (before.get(r.mesh)?.mat !== r.mat) { leaks++; console.log(`    LEAK onto ${k}: ${r.name}`); } }
  }
  leaks ? fail(`leak: ${leaks}/${n} control meshes changed material under x-ray`) : ok(`no leak: ${n} control meshes keep their material object (cock screws, fork stone, click screw, escape wheel)`);
}

// §59 pick demotion — hover a chaton bezel: on names not-the-plate, off names the plate.
// The readout only resolves in EXPLORE mode (resolveExploreHover returns early otherwise).
await clickId(page, 'btn-explore'); await page.waitForTimeout(500);
// The default camera looks at the plate THROUGH the case's back crystal, and
// the crystal is not in any x-ray set, so it takes every pick from the back —
// naming its explode entry — whatever x-ray does; and the orbit's minDistance
// stops a zoom just OUTSIDE the glass, so no viewer can get past it either.
// (Measured: at 24 u from the plate the first hit was still caseBackCrystal.)
// That is §187's interaction with §59, pre-existing and outside this entry;
// here the crystal is moved to an unused layer as a declared CONTROL so the
// pointer reaches the plate. Nothing about the plate, the pick or x-ray changes.
await page.evaluate(() => { const c = window.__clock.scene.getObjectByName('caseBackCrystal'); if (c) c.layers.set(31); });
await page.waitForTimeout(400);
async function hoverChatons() {
  const pts = await page.evaluate(() => {
    const C = window.__clock;
    const out = [];
    C.labelEntries.find((e) => e.name === 'Three-quarter plate').obj.traverse((o) => {
      if (!o.isMesh || o.name !== 'chatonBezel') return;
      // A bezel is a RING: its bounding centre is the empty bore, and a ray
      // through it lands on the arbor pivot behind. Hover the rim — 85% of the
      // outer radius out along the chaton's own local x (the plate lies in XY).
      o.geometry.computeBoundingBox();
      const bb = o.geometry.boundingBox; const R = (bb.max.x - bb.min.x) / 2;
      const rim = bb.getCenter(o.position.clone()); rim.x += 0.85 * R; o.localToWorld(rim);
      const p = rim.clone().project(C.camera);
      out.push({ x: (p.x + 1) / 2 * window.innerWidth, y: (1 - p.y) / 2 * window.innerHeight, z: p.z });
    });
    return out;
  });
  const res = [];
  for (const p of pts) {
    if (p.z > 1 || p.x < 20 || p.y < 20 || p.x > 880 || p.y > 580) continue;
    // The pick runs in frame(); under software GL a solid frame is slow, so wait
    // for the readout to change rather than for a fixed interval.
    const before = await page.evaluate(() => document.getElementById('explore-hover').textContent + '|' + document.getElementById('explore-hover').style.display);
    await page.mouse.move(p.x, p.y); await page.mouse.move(p.x + 1, p.y + 1);
    await page.waitForFunction((b) => (document.getElementById('explore-hover').textContent + '|' + document.getElementById('explore-hover').style.display) !== b, before, { timeout: 8000 }).catch(() => {});
    await page.waitForTimeout(400);
    const t = await page.evaluate(() => { const el = document.getElementById('explore-hover'); return el && el.style.display === 'block' ? el.textContent : null; });
    await page.mouse.move(5, 300); await page.waitForTimeout(300); // off the canvas edge region → next chaton starts clean
    res.push({ ...p, t });
  }
  return res;
}
const hovOn = await hoverChatons();
await clickId(page, 'btn-xray'); await page.waitForTimeout(300);
const hovOff = await hoverChatons();
{
  // pair by position; the control is a chaton that names the plate OFF
  let controls = 0, demoted = 0;
  for (let i = 0; i < hovOff.length; i++) {
    const a = hovOff[i], b = hovOn[i];
    if (a.t === 'Three-quarter plate') { controls++; if (b && b.t !== 'Three-quarter plate') demoted++; else console.log(`    chaton at (${a.x | 0},${a.y | 0}): off→'${a.t}' on→'${b?.t}'`); }
    else console.log(`    (chaton at (${a.x | 0},${a.y | 0}) names '${a.t}' with x-ray off — not a control)`);
  }
  if (!controls) fail('§59: no chaton in view named the plate with x-ray off — the demotion test did not fire');
  else demoted === controls ? ok(`§59: ${demoted}/${controls} chatons under the pointer resolve THROUGH the glassed plate (named: ${hovOn.filter((h) => h.t && h.t !== 'Three-quarter plate').map((h) => h.t).join(', ')})`)
    : fail(`§59: ${controls - demoted}/${controls} chatons still take the pick with x-ray on`);
}

// round trip: after the OFF above, identity everywhere
{
  const back = await page.evaluate(CENSUS);
  let bad = 0, n = 0;
  const chk = (a, b) => { const m = byMesh(a); for (const r of b) { n++; if (m.get(r.mesh)?.mat !== r.mat) bad++; } };
  chk(off1.plate, back.plate); chk(off1.dial, back.dial);
  for (const k of Object.keys(off1.controls)) chk(off1.controls[k], back.controls[k]);
  bad ? fail(`round trip: ${bad}/${n} meshes not back on their solid material`) : ok(`round trip: ${n}/${n} meshes back on their original material object`);
}
if (warns.length) fail(`boot 1 not silent: ${warns.length} warning(s) — ${warns.join(' | ')}`); else ok('boot 1 silent');
await page.close();

// ---------------------------------------------------------------- boot 2: focus composition
console.log('§199 — boot 2 (?focus=Escape%20wheel)');
const b2 = await boot('&focus=Escape%20wheel');
await b2.page.waitForTimeout(1500);
const focusOn = await b2.page.evaluate(() => document.getElementById('btn-focus').dataset.state);
if (focusOn !== 'on') fail(`focus did not restore from ?focus= (state '${focusOn}') — composition test did not run`);
else {
  const g0 = await b2.page.evaluate(CENSUS); // plate GHOSTED by focus
  const ghosted = g0.plate.filter((r) => r.transparent).length;
  ghosted === g0.plate.length ? ok(`focus: ${ghosted}/${g0.plate.length} plate meshes ghosted before x-ray`) : fail(`focus: only ${ghosted}/${g0.plate.length} plate meshes ghosted`);
  await clickId(b2.page, 'btn-xray'); await b2.page.waitForTimeout(300);
  const g1 = await b2.page.evaluate(CENSUS);
  // Under x-ray the plate's materials must be the x-ray clones — at the one
  // opacity with depthWrite off — not ghosts-of-ghosts. Identity does not
  // survive a reboot, so this tier reads the material's properties.
  let bad = 0; for (const r of g1.plate) if (!(r.transparent && r.depthWrite === false && Math.abs(r.opacity - plateOpacity) < 1e-9)) bad++;
  bad ? fail(`compose: ${bad}/${g1.plate.length} plate meshes not at the x-ray opacity with focus on`) : ok(`compose: x-ray on over focus — ${g1.plate.length}/${g1.plate.length} plate meshes at the one opacity ${plateOpacity}`);
  await clickId(b2.page, 'btn-xray'); await b2.page.waitForTimeout(300);
  const g2 = await b2.page.evaluate(CENSUS);
  const still = g2.plate.filter((r) => r.transparent).length;
  still === g2.plate.length ? ok(`compose: x-ray off returns the plate to focus ghosts (${still}/${g2.plate.length} transparent)`) : fail(`compose: x-ray off left ${g2.plate.length - still} plate meshes solid while focus is on`);
  await clickId(b2.page, 'btn-focus'); await b2.page.waitForTimeout(300);
  const g3 = await b2.page.evaluate(CENSUS);
  let notBack = 0;
  // after clearing focus every plate mesh must be back on its stamped solid material
  for (const r of g3.plate) if (r.mat !== r.solid) notBack++;
  notBack ? fail(`compose: ${notBack}/${g3.plate.length} plate meshes not on their solidMat after focus cleared`) : ok(`compose: focus cleared — ${g3.plate.length}/${g3.plate.length} plate meshes back on their solid material object`);
}
if (b2.warns.length) fail(`boot 2 not silent: ${b2.warns.length} warning(s) — ${b2.warns.join(' | ')}`); else ok('boot 2 silent');
await b2.page.close();

await browser.close(); srv.kill();
console.log(failures.length ? `\n§199: ${failures.length} FAILURE(S)` : '\n§199: PASS');
process.exit(failures.length ? 1 : 0);
