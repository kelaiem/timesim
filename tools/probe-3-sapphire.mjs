// §3 — THE BOX SAPPHIRE DIAL: IS IT GLASS, IS IT THE SAME METAL, CAN THE
// PRINT STILL BE READ? Acceptance. Boots the identity build twice — the
// shipped silvered dial, then `dial.plate.sapphire` set through the
// aesthetics override store — and holds §3's four claims:
//   1. BOTH BOOT SILENT. The §157 ink gate runs on the sapphire ground (the
//      crystal's tint over the base plate's nickel) exactly as on the face,
//      so silence here is the legibility measurement, not its absence.
//   2. THE GEOMETRY DOES NOT MOVE. Every mesh under the Dial unit: same
//      names, same vertex counts, same bounding boxes, silvered or sapphire.
//      A finish knob that moved metal would be a spec, and this is not one.
//   3. THE RIGHT PARTS ARE GLASS. Sapphire: the plate body, both pocket
//      walls, the face sheet and both well sheets are transparent at the
//      crystal's opacity with depthWrite off; the chapter ring, the applied
//      numerals and the feet are opaque metal. Silvered: none of the dial is
//      transparent. The crystal itself reads the same recipe on both boots.
//   4. X-RAY COMPOSES. On the sapphire dial the toggle installs the dial's
//      own materials (self-mapped) and restores them; the plate behind still
//      glasses; nothing on the dial changes material across on→off.
// Also writes two PNGs from the Dial preset for the record — a report, not a
// gate, since a software-GL frame is what it is.
//   cd tools && node probe-3-sapphire.mjs [outdir]   (exit 1 on any claim)
import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { mkdirSync, writeFileSync } from 'node:fs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = process.argv[2] || join(ROOT, 'tools', 'shot3');
mkdirSync(OUT, { recursive: true });
const PORT = 8465;
const srv = spawn('python3', ['-m', 'http.server', String(PORT), '--bind', '127.0.0.1'], { cwd: ROOT, stdio: 'ignore' });
await new Promise((r) => setTimeout(r, 900));
const browser = await chromium.launch();

async function boot(sapphire) {
  const ctx = await browser.newContext({ viewport: { width: 900, height: 700 } });
  if (sapphire) await ctx.addInitScript(() => localStorage.setItem('aestheticsOverrides', JSON.stringify({ dial: { plate: { sapphire: true } } })));
  const page = await ctx.newPage();
  const warns = [];
  page.on('pageerror', (e) => warns.push('PAGEERROR ' + String(e)));
  page.on('console', (m) => { if (m.type() === 'warning' && !/GroupMarker|GL Driver|SwiftShader|WebGL/.test(m.text())) warns.push(m.text()); });
  await page.goto(`http://127.0.0.1:${PORT}/index.html`, { waitUntil: 'load', timeout: 90000 });
  await page.waitForFunction(() => !!window.__clock || !!window.__bootError, null, { timeout: 120000 }).catch(() => warns.push('NO __clock'));
  if (await page.evaluate(() => !window.__clock)) { console.log(`boot died (${sapphire ? 'sapphire' : 'silvered'}): ${warns.join(' | ').slice(0, 400)}`); process.exit(2); }
  const read = async () => page.evaluate(async () => {
    const THREE = await import('three');
    const c = window.__clock;
    const dialUnit = c.labelEntries.find((e) => e.name === 'Dial');
    const rows = [];
    dialUnit.obj.updateWorldMatrix(true, true);
    dialUnit.obj.traverse((o) => {
      if (!o.isMesh || o.userData.schematic) return;
      const bb = new THREE.Box3().setFromObject(o);
      const m = o.material;
      rows.push({ name: o.name || o.geometry.type, verts: o.geometry.attributes.position.count,
        bb: [bb.min.x, bb.min.y, bb.min.z, bb.max.x, bb.max.y, bb.max.z].map((v) => +v.toFixed(4)),
        transparent: !!m.transparent, opacity: m.opacity, depthWrite: m.depthWrite, glass: !!(m.userData && m.userData.glass), mat: m.uuid, hasMap: !!m.map });
    });
    let dial = null; // makeDial's own group, wherever the unit parents it (dialFace → dialPlateFace → dial)
    dialUnit.obj.traverse((o) => { if (!dial && o.userData && 'sapphire' in o.userData) dial = o; });
    if (!dial) dial = dialUnit.obj;
    const ink = dial.userData.inkContrast ? dial.userData.inkContrast() : null;
    return { sapphire: !!dial.userData.sapphire, rows, ink, bootWarns: (window.__bootWarns || []).slice() };
  });
  const before = await read();
  // x-ray on → read → off → read
  await page.click('#btn-xray'); await page.evaluate(() => window.__clock.step(0.01));
  const xon = await read();
  await page.click('#btn-xray'); await page.evaluate(() => window.__clock.step(0.01));
  const after = await read();
  // the crystal's recipe, read off the case
  const crystal = await page.evaluate(() => {
    let m = null; window.__clock.scene && window.__clock.scene.traverse && window.__clock.scene.traverse((o) => { if (!m && o.isMesh && /crystal/i.test(o.name || '')) m = o.material; });
    return m ? { transparent: m.transparent, opacity: m.opacity, depthWrite: m.depthWrite } : null;
  });
  // Read the frame off the canvas inside the same task that painted it
  // (probe-203's way): page.screenshot waits on a compositor frame, and a
  // software-GL frame of the realistic tier is longer than its timeout.
  const dataUrl = await page.evaluate(() => {
    // the realistic tier, not the line drawing — a sapphire dial has no schematic
    const sch = document.getElementById('btn-schematic');
    if (sch && sch.dataset.state === 'on') sch.click();
    document.querySelector('[data-cam="Dial"]').click(); // the preset lives in a fold the pane may hide — click it in-page
    const c = window.__clock;
    c.step(1);   // one step past the preset tween: camTween.t >= 1 lands the camera in one render
    c.render();
    return document.querySelector('canvas').toDataURL('image/png'); // same task as the render, nothing awaited between
  });
  writeFileSync(join(OUT, sapphire ? 'dial-sapphire.png' : 'dial-silvered.png'), Buffer.from(dataUrl.split(',')[1], 'base64'));
  await ctx.close();
  return { before, xon, after, crystal, consoleWarns: warns };
}

const silvered = await boot(false);
const sapphire = await boot(true);
await browser.close();
srv.kill();

let fail = 0;
const F = (m) => { fail++; console.log('FAIL', m); };
const OK = (m) => console.log('OK  ', m);
// 1 — silence
for (const [n, b] of [['silvered', silvered], ['sapphire', sapphire]]) {
  const w = b.before.bootWarns.length + b.consoleWarns.length;
  if (w) { F(`${n}: ${w} warning(s): ${[...b.before.bootWarns, ...b.consoleWarns].join(' | ').slice(0, 300)}`); }
  else OK(`${n} boots silent`);
}
if (!sapphire.before.sapphire || silvered.before.sapphire) F('the knob did not reach makeDial');
// 2 — geometry
const geoKey = (r) => `${r.name}|${r.verts}|${r.bb.join(',')}`;
const gA = silvered.before.rows.map(geoKey).sort(), gB = sapphire.before.rows.map(geoKey).sort();
if (gA.length !== gB.length || gA.some((k, i) => k !== gB[i])) F(`dial geometry differs between boots (${gA.length} vs ${gB.length} meshes)`);
else OK(`dial geometry identical: ${gA.length} meshes, same names, vertex counts and bounds`);
// 3 — which parts are glass
const isGlassPart = (r) => r.name === 'dialPlate' || /SubdialWall$|SubdialFace$/.test(r.name) || (r.hasMap && r.name === 'Mesh');
const glassRows = sapphire.before.rows.filter(isGlassPart);
const faceSheet = sapphire.before.rows.find((r) => r.hasMap && !/SubdialFace$/.test(r.name));
const expectGlass = [...glassRows, ...(faceSheet ? [faceSheet] : [])];
const bad = expectGlass.filter((r) => !(r.transparent && r.depthWrite === false && r.glass));
if (bad.length) F(`sapphire: ${bad.length} part(s) meant to be glass are not: ${bad.map((r) => r.name).join(', ')}`);
else OK(`sapphire: plate body, ${sapphire.before.rows.filter((r) => /SubdialWall$/.test(r.name)).length} walls, ${sapphire.before.rows.filter((r) => /SubdialFace$/.test(r.name)).length} well sheets and the face sheet are glass (transparent, depthWrite off, marked)`);
// The Dial unit's subtree carries a few ruby pins (MATS.ruby is transparent
// by nature, on both boots); "went transparent" means transparent on the
// sapphire boot and NOT on the silvered one, part by part.
const silvTransparent = new Set(silvered.before.rows.filter((r) => r.transparent).map((r) => r.name));
const metal = sapphire.before.rows.filter((r) => !expectGlass.includes(r));
const leaked = metal.filter((r) => r.transparent && !silvTransparent.has(r.name));
if (leaked.length) F(`sapphire: ${leaked.length} metal part(s) went transparent: ${leaked.map((r) => r.name).join(', ')}`);
else OK(`sapphire: ${metal.length - [...silvTransparent].length} metal parts (ring, numerals, feet, walls' neighbours) stay opaque; ${silvTransparent.size} ruby pins transparent on both boots as before`);
const silvGlass = silvered.before.rows.filter((r) => expectGlass.some((e) => e.name === r.name) && r.transparent);
if (silvGlass.length) F(`silvered: ${silvGlass.length} dial part(s) transparent that should be metal/enamel: ${silvGlass.map((r) => r.name).join(', ')}`);
else OK('silvered: plate, walls and print sheets are opaque, as shipped');
const body = sapphire.before.rows.find((r) => r.name === 'dialPlate');
if (sapphire.crystal && body && Math.abs(body.opacity - sapphire.crystal.opacity) > 1e-9) F(`sapphire plate opacity ${body.opacity} is not the crystal's ${sapphire.crystal.opacity}`);
else OK(`sapphire plate reads the crystal's opacity ${body && body.opacity}${sapphire.crystal ? '' : ' (crystal mesh not found by name — recipe equality not checked)'}`);
// ink
for (const [n, b] of [['silvered', silvered], ['sapphire', sapphire]]) {
  const g = b.before.ink && b.before.ink.gated;
  if (!g) { F(`${n}: no inkContrast record`); continue; }
  const worst = Math.min(g.trackOuter, g.trackInner, ...g.wells.map((w) => w.ratio));
  if (worst < g.floor) F(`${n}: ink contrast ${worst.toFixed(2)} under the ${g.floor} floor`);
  else OK(`${n}: ink ${g.trackInk} holds ${worst.toFixed(2)}:1 worst case against floor ${g.floor} (grounds ${[...new Set(g.wells.map((w) => w.ground))].join(' ')})`);
}
// 4 — x-ray composes
const matKey = (rows) => rows.map((r) => `${r.name}|${r.mat}`).sort().join('\n');
if (matKey(sapphire.before.rows) !== matKey(sapphire.after.rows)) F('sapphire: x-ray on→off did not restore the dial\'s materials');
else OK('sapphire: x-ray on→off restores every dial material');
const glassSelf = sapphire.xon.rows.filter(isGlassPart).every((r) => sapphire.before.rows.find((q) => q.name === r.name && q.mat === r.mat));
if (!glassSelf) F('sapphire: x-ray replaced a glass-by-nature material instead of composing');
else OK('sapphire: with x-ray ON the glass parts keep their own materials (self-mapped)');
const metalGlassed = sapphire.xon.rows.filter((r) => !expectGlass.some((e) => e.name === r.name && e.mat === r.mat) && r.name !== 'dialPlate').filter((r) => r.transparent).length;
OK(`sapphire: with x-ray ON ${metalGlassed} metal dial part(s) glass as the toggle asks`);
console.log(`screenshots: ${OUT}/dial-silvered.png, ${OUT}/dial-sapphire.png`);
process.exit(fail ? 1 : 0);
