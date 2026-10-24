// DO THE TWO CROWNS STAND CLEAR OF THE CASE THEY ARE CUT FOR — ON EVERY CASE
// SHAPE? Acceptance (TODO 268): exits non-zero on any failure.
//
// The through-case parts are cut to reach THROUGH the band and stand their
// knob a declared distance past it: the crown's base 2 mm outboard of the
// band's outer face, the tube's collar ending 1.5 mm out, so a finger grips
// 0.5 mm of clear knob before the collar (makeCase's tube rule, geometry.js;
// makeFormCase's TUBE_PROUD / COLLAR_H, form-case.js). Both stems were cut to
// CASE_R_OUT — the ROUND band's radius — while under ?case= the band is the
// plate's shape grown, whose wall on a stem's line can stand well past the
// circle: measured on the tonneau, 0.6 u past it on the winding stem's line
// at az 145° and 12.0 u at az 130.7° (the owner's ?barrelstep=-49.3 URL),
// 1.5 u on the alarm stem's. The knobs stood INSIDE the band, its sleeve and
// its collar, and no gate saw it: the battery runs the round build, and
// probe-case-relief.mjs with it. `caseWallAlong` (main.js) is the one law
// now; this is the instrument that holds it ON THE METAL, per build.
//
// Per build (the round build as the control that the law reduces to the
// circle, then every fitted form case gong-seats.js lists, then any extra
// query strings in SPEC=…;… — the owner's URL, say), per crown (winding,
// alarm), at the crown PUSHED IN and PULLED OUT (inspect.js's own 'crown' and
// 'alarmPull' axes, entered canonically):
//   F1  FINGER ROOM: the knob's inner face stands 0.5 mm past the collar's
//       outer face, read off the two metals' vertices along the stem's own
//       line — exactly (1e-6) pushed in, at least that pulled out. This is
//       what "gripped clear of the band" means, and it is measured between
//       two faces, so it restates neither builder's constant.
//   F2  CLEAR: every mesh of the knob clears the band (caseMiddle), its tube's
//       sleeve and its collar by CLEAR_MARGIN — meshClearance both ways, the
//       instruments skill's rule, bounded at 0.5 because only contact is asked.
//   R   REPORT: the band's outer face on the stem's line, read by a ray cast
//       inward against caseMiddle beside the opening (the round band is a
//       polygon, so this reads a chord, not the circle — reported, not gated),
//       and the knob's standoff from it, which the law puts at 2 mm.
// Controls, per build: C1 the knob moved inboard by the finger room plus the
// margin must turn F2 red (the instrument sees a knob in the collar) and is
// restored; C2 a name that resolves to no mesh THROWS rather than passing a
// scan of nothing (resolveAxes' precedent).
//
// Run: node tools/probe-form-crowns.mjs [--only round|rect|cushion|tonneau]
//      SPEC='case=tonneau&formrect=…&barrelstep=-49.3;…' adds builds (';'-separated queries)
//      PW_CHROMIUM=/path/to/chrome when Playwright's own browser is not installed
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { join, extname, normalize, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { GONG_SEATS } from '../src/gong-seats.js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
const only = args.includes('--only') ? args[args.indexOf('--only') + 1] : null;
const fails = [];
const ok = (name, cond, detail = '') => { console.log(`${cond ? 'PASS' : 'FAIL'}  ${name}${detail ? ` — ${detail}` : ''}`); if (!cond) fails.push(name); };

// The builds: the round control, one per fitted form kind (the seat rows carry
// each kind's fitted ?formrect=), then the caller's.
const builds = [{ name: 'round', q: '' }];
for (const [kind, modes] of Object.entries(GONG_SEATS)) {
  const row = modes.bar ?? Object.values(modes)[0];
  builds.push({ name: kind, q: `case=${kind}&formrect=${row.formrect.join(',')}` });
}
for (const q of (process.env.SPEC || '').split(';').map((s) => s.trim()).filter(Boolean)) builds.push({ name: `spec ${q}`, q });
const run = only ? builds.filter((b) => b.name === only || b.name.startsWith('spec ')) : builds;
if (!run.length) { console.error(`--only ${only}: no such build (${builds.map((b) => b.name).join(', ')})`); process.exit(2); }

const { chromium } = await import(join(ROOT, 'tools/node_modules/playwright/index.mjs'));
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.json': 'application/json', '.webmanifest': 'application/json', '.png': 'image/png', '.svg': 'image/svg+xml', '.css': 'text/css' };
const srv = createServer(async (req, res) => {
  try {
    const p = normalize(decodeURIComponent(new URL(req.url, 'http://x').pathname)).replace(/^(\.\.[/\\])+/, '');
    const body = await readFile(join(ROOT, p === '/' ? 'index.html' : p));
    res.writeHead(200, { 'content-type': MIME[extname(p)] ?? 'application/octet-stream', 'cache-control': 'no-store' }).end(body);
  } catch { res.writeHead(404).end('nf'); }
});
await new Promise((r) => srv.listen(0, '127.0.0.1', r));
const browser = await chromium.launch({ executablePath: process.env.PW_CHROMIUM || undefined,
  args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist',
    '--disable-background-timer-throttling', '--disable-backgrounding-occluded-windows', '--disable-renderer-backgrounding'] });

// The browser half: everything below runs in the page against the built metal.
const measure = async () => {
  const I = await import('./src/inspect.js');
  const THREE = await import('three');
  const L = await import('./src/layout.js');
  const clock = window.__clock, scene = clock.scene;
  const need = (name) => { const o = scene.getObjectByName(name); if (!o) throw new Error(`no such object: ${name}`); return o; };
  const knobOf = (stemName) => {
    const stem = need(stemName);
    const k = stem.parent.children.find((c) => c.userData?.crown);   // §119: the knob carries its knurling radius
    if (!k) throw new Error(`${stemName}'s spinner carries no knob with userData.crown`);
    return { stem, spinner: stem.parent, knob: k };
  };
  const CROWNS = [
    { name: 'winding crown', stem: 'windStem', tube: 'caseCrownTube', axis: 'crown', pulls: [['pushed in', 0], ['pulled out', 1]] },
    { name: 'alarm crown', stem: 'alarmStem', tube: 'caseAlarmTube', axis: 'alarmPull', pulls: [['pushed in', 0], ['pulled out', 0.5]] },   // alarmPull's law is 1 − |2f − 1|: f = 0.5 is the full pull
  ];
  const band = need('caseMiddle');
  const meshesUnder = (o) => { const a = []; o.traverse((m) => { if (m.isMesh && m.geometry?.attributes?.position && !m.userData.schematic) a.push(m); }); return a; };
  const v = new THREE.Vector3();
  // Extreme of a mesh's vertices projected on the line (x, y only — the line is radial, in the band's plane).
  const extreme = (mesh, u, sign) => {
    const p = mesh.geometry.attributes.position;
    let best = -Infinity;
    for (let i = 0; i < p.count; i++) { v.fromBufferAttribute(p, i).applyMatrix4(mesh.matrixWorld); best = Math.max(best, sign * (v.x * u.x + v.y * u.y)); }
    return sign * best;
  };
  const ray = new THREE.Raycaster();
  const out = { mm: 1 / L.UNIT_MM, clearMargin: L.CLEAR_MARGIN, crowns: [] };
  for (const C of CROWNS) {
    const { spinner, knob } = knobOf(C.stem);
    const tube = need(C.tube), sleeve = need(`${C.tube}Sleeve`), collar = need(`${C.tube}Collar`);
    const axis = I.AXES.find((a) => a.name === C.axis);
    if (!axis) throw new Error(`no axis named ${C.axis}`);
    const knobMeshes = meshesUnder(knob);
    if (!knobMeshes.length) throw new Error(`${C.name}: no meshes under the knob`);
    const rows = [];
    for (const [label, f] of C.pulls) {
      I.enterAxis(clock);
      clock.setPose(axis.pose(f, clock));
      scene.updateMatrixWorld(true);
      // the stem's own line: the spinner's +Y, in world
      const u = new THREE.Vector3(0, 1, 0).transformDirection(spinner.matrixWorld); u.z = 0; u.normalize();
      const knobBase = Math.min(...knobMeshes.map((m) => extreme(m, u, -1)));
      const collarEnd = extreme(collar, u, +1), sleeveEnd = extreme(sleeve, u, +1);
      // the band's face on the line: a ray cast inward beside the opening (its
      // own z stepped back until the band answers on the NEAR side — the round
      // band is bored on the line itself, so on the line the first face the
      // ray meets is the far wall's bore, which is not this crown's wall)
      let bandFace = null, dz = null;
      const tz = tube.children[0].position.z;
      for (let k = 0; k <= 32 && bandFace === null; k++) {
        const z = tz + k * 0.25;
        ray.set(new THREE.Vector3(u.x * 400, u.y * 400, z), new THREE.Vector3(-u.x, -u.y, 0));
        const hit = ray.intersectObject(band, false).find((h) => h.point.x * u.x + h.point.y * u.y > 0);
        if (hit) { bandFace = hit.point.x * u.x + hit.point.y * u.y; dz = k * 0.25; }
      }
      // F2 — clearance of every knob mesh against the three bodies, both ways
      let clear = Infinity, worst = null;
      for (const A of [band, sleeve, collar]) for (const B of knobMeshes) {
        const d = Math.min(I.meshClearance(A, B, 0.5), I.meshClearance(B, A, 0.5));
        if (d < clear) { clear = d; worst = `${A.name} ⇄ ${B.name || B.geometry.type}`; }
      }
      rows.push({ pull: label, f, az: Math.atan2(u.y, u.x) * 180 / Math.PI, knobBase, collarEnd, sleeveEnd, bandFace, dz, fingerRoom: knobBase - collarEnd, standoff: bandFace === null ? null : knobBase - bandFace, clear, worst });
    }
    // C1 — the knob moved inboard by the finger room plus the margin must read in contact
    I.enterAxis(clock);
    clock.setPose(axis.pose(C.pulls[0][1], clock));
    const y0 = knob.position.y;
    knob.position.y = y0 - (rows[0].fingerRoom + L.CLEAR_MARGIN + 0.01);
    scene.updateMatrixWorld(true);
    let ctl = Infinity;
    for (const A of [sleeve, collar]) for (const B of knobMeshes) ctl = Math.min(ctl, I.meshClearance(A, B, 0.5), I.meshClearance(B, A, 0.5));
    knob.position.y = y0;
    scene.updateMatrixWorld(true);
    out.crowns.push({ name: C.name, rows, control: ctl });
  }
  // C2 — a roster that names nothing throws
  let threw = false;
  try { knobOf('noSuchStem'); } catch { threw = true; }
  out.missingThrows = threw;
  I.enterAxis(clock);
  return out;
};

const NOISE = /GPU stall|GL Driver Message|swiftshader|ReadPixels|Automatic fallback to software WebGL|Failed to load resource: the server responded with a status of 404/i;
for (const b of run) {
  const ctx = await browser.newContext({ viewport: { width: 800, height: 600 } }), page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push('PAGEERROR ' + e.message));
  page.on('console', (m) => { if (m.type() === 'error' && !NOISE.test(m.text())) errors.push(m.text()); });
  await page.goto(`http://127.0.0.1:${srv.address().port}/index.html?hud=0&sync=0${b.q ? '&' + b.q : ''}`);
  await page.waitForFunction(() => !!window.__clock || !!window.__bootError, null, { timeout: 600000, polling: 1000 });
  const dead = await page.evaluate(() => window.__bootError ? String(window.__bootError) : null);
  if (dead) { ok(`${b.name}: boots`, false, dead); await ctx.close(); continue; }
  const r = await page.evaluate(measure);
  await ctx.close();
  console.log(`\n== ${b.name}${b.q ? ` (?${b.q})` : ''}`);
  const mm = (u) => `${u.toFixed(4)} u (${(u / r.mm).toFixed(3)} mm)`;
  for (const c of r.crowns) {
    for (const row of c.rows) {
      console.log(`  ${c.name} ${row.pull} (az ${row.az.toFixed(1)}°): knob base ${row.knobBase.toFixed(4)}, collar end ${row.collarEnd.toFixed(4)}, `
        + `band face ${row.bandFace === null ? 'not read' : row.bandFace.toFixed(4) + ` (ray ${row.dz} u off the line)`}; `
        + `standoff ${row.standoff === null ? '—' : mm(row.standoff)} [report], nearest ${row.clear === Infinity ? 'over the 0.5 bound' : `${row.clear.toFixed(4)} at ${row.worst}`}`);
      const want = 0.5 * r.mm;
      ok(`${b.name}: ${c.name} ${row.pull} — finger room ${row.f === 0 ? '= 0.5 mm' : '≥ 0.5 mm'}`,
        row.f === 0 ? Math.abs(row.fingerRoom - want) < 1e-6 : row.fingerRoom >= want - 1e-6, mm(row.fingerRoom));
      ok(`${b.name}: ${c.name} ${row.pull} — clears the band, sleeve and collar by CLEAR_MARGIN`, row.clear >= r.clearMargin - 1e-9,
        row.clear === Infinity ? 'over the 0.5 bound' : `${row.clear.toFixed(4)} ≥ ${r.clearMargin} (${row.worst})`);
    }
    ok(`${b.name}: ${c.name} control — the knob moved into the collar reads contact`, c.control < 1e-3, `${c.control.toFixed(4)}`);
  }
  ok(`${b.name}: a name that resolves to no mesh throws`, r.missingThrows);
  ok(`${b.name}: no page error`, !errors.length, errors.join(' | ').slice(0, 300));
}
await browser.close();
srv.close();
console.log(fails.length ? `\n${fails.length} FAILURE(S):\n  ${fails.join('\n  ')}` : '\nALL PASS');
process.exit(fails.length ? 1 : 0);
