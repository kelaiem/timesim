// §220 — THE SMOKED SAPPHIRE DIAL: IS THE LAW THE ONE WRITTEN, DOES T = 1
// STAY THE SHIPPED CRYSTAL, DOES THE PRINT FLIP WHERE THE COMPOSITE SAYS,
// DOES X-RAY STILL SHOW THE WORKS? Acceptance (exit 1 on any claim), plus a
// `--scan` REPORT that measures the knob's floor.
//
// Boots the identity build with `dial.plate.sapphire` on and `dial.plate.smoke`
// at six values through the aesthetics override store — 1 (the control),
// T_SMOKE (a Lumen-dark coat inside the window), the two neighbours the
// derivation puts either side of the ink solve's flip, the schema's FLOOR,
// and one step UNDER the floor with the loader's clamp lifted — and holds
// §220's claims:
//   1. EVERY BOOT SILENT. materials.js asserts smokedGlass(1) ≡ CRYSTAL_GLASS
//      at boot and the §157 ink gate runs on the smoked ground, so silence is
//      the identity control and the legibility measurement, not their absence.
//   2. T = 1 IS §3 BYTE FOR BYTE. Plate, walls and sheets at the crystal's
//      recipe (opacity 0.14, colour #f8fbff), the ground the ink was solved
//      against the clear composite, x-ray self-mapping every glass part — the
//      same reads probe-3-sapphire.mjs makes, on the same boot.
//   3. THE LAW, NOT A NUMBER. At T_SMOKE the plate body and both pocket walls
//      carry opacity αc + (1 − αc)(1 − T²) and colour C·αc/opacity, computed
//      HERE from the crystal's literals read off the page — never pasted —
//      and the sheets keep opacity 1 on a white material (print on the coat,
//      not a second coat).
//   4. THE GROUND IS THE RENDERED COMPOSITE. inkContrast's ground equals sheet
//      over body over nickel, re-derived here from the three materials, and
//      at T_SMOKE the solve printed the LIGHT pole.
//   5. THE FLIP IS WHERE THE COMPOSITE PUTS IT: the boot at T_FLIP_DARK
//      prints the dark pole and the boot at T_FLIP_LIGHT the light one.
//   6. X-RAY SHOWS THE WORKS. On the smoked boot the toggle swaps the body and
//      walls for their CLEAR twins (opacity 0.14), leaves the sheets alone,
//      and restores every original material (by identity) on the way off.
//   7. THE GEOMETRY DOES NOT MOVE between T = 1 and T_SMOKE: names, vertex
//      counts and each mesh's OWN (local) bounds. Local, because the Dial
//      unit carries parts whose world pose is integrated by step() (the
//      alarm's motor, eased members) and so differs between two boots at
//      any setPose — probe-3-sapphire compared WORLD bounds and reported
//      four such boxes as moved metal on an untouched tree (fixed there too).
//   8. THE CRYSTAL IS UNTOUCHED on every boot (the case reads CRYSTAL_GLASS).
//   9. THE FLOOR IS WHERE THE SCHEMA SAYS. `_bounds.smoke[0]` is derived from
//      the reserve sub-dial's zone gate (a black zone holds 3:1 against the
//      face only while the ground's luminance is ≥ 0.10 — aesthetics.json's
//      comment has the arithmetic): the boot AT the floor is silent, and the
//      boot one slider step UNDER it (clamp lifted) warns from exactly that
//      gate and from nothing else — the floor's own control.
// One Dial-preset PNG per boot for the eye.
//
// `--scan` MEASURES THE WORKS' OWN FLOOR — the number the entry could not
// derive at a desk, and a REPORT since the zone gate above binds first: it
// serves aesthetics.json with `_bounds.smoke[0]` lifted to 0 (what lies under
// the floor is what is being measured, so the loader's clamp is taken out of
// the loop, and said so here), boots T from 1 downward, renders the Dial
// preset, and reads a WORKS PATCH of the frame — a rectangle over the motion-works
// wheels left of centre that holds no print, no hand and no chapter ring
// (fractions of the viewport, dumped as a crop beside each frame so the claim
// "works only" can be checked by eye; BLUED STEEL is MASKED out by colour —
// the alarm hand crosses the patch's corner at the read pose, and the works'
// own blued screw heads sit in it — so a hand is never counted as the works,
// and the screws, which fall under the colour test as the coat darkens, are
// not counted at one T and dropped at the next; the masked count is printed
// per boot so that bias is visible). The metric is
// the CIELAB lightness separation ΔL* between the patch's 90th- and
// 10th-percentile relative luminance — the ground the works stand on against
// the works themselves, which read DARK against the lit nickel through the
// coat — and the floor is the JUST-NOTICEABLE DIFFERENCE, ΔL* = 2.3 (the
// CIE 1976 ΔE*ab JND, Mahy et al. 1994): below it the works are within one
// perceptual step of the plate, which is what "stop reading" means. WHY NOT
// SC 1.4.11's 3:1, the print's floor: it was the entry's first criterion and
// it FAILED ITS OWN CLEAR-DIAL CONTROL — the works on the clear sapphire read
// 2.56:1 (measured), because they are large shapes the eye reads at far lower
// contrast than the small-object floor assumes; a floor that says the works
// never read at all measures the criterion, not the coat. The floor to write
// into `_bounds` is the smallest T at which the patch still reads ≥ the JND,
// refined to the slider's 0.01 step by bisection. Two CONTROLS run first: the
// same patch on the SILVERED dial (opaque — the works cannot be seen, so the
// separation must read UNDER the JND, or the metric is reading the print, not
// the works) and on the clear sapphire dial (the works at their most visible
// — the separation must clear the JND by an order, or the patch is not on the
// works). A scan whose controls fail prints no number. The number it prints
// is recorded in the §220 BUILT entry beside the derived floor, and if it
// ever rose ABOVE the schema's floor the works would be the binding
// constraint and `_bounds` would have to follow it — the scan says which.
//   cd tools && node probe-220-smoke.mjs [outdir]            (acceptance)
//   cd tools && node probe-220-smoke.mjs [outdir] --scan     (report)
import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { mkdirSync, writeFileSync, readFileSync } from 'node:fs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const argv = process.argv.slice(2);
const SCAN = argv.includes('--scan');
const OUT = argv.find((a) => !a.startsWith('--')) || join(ROOT, 'tools', 'shot220');
mkdirSync(OUT, { recursive: true });
const PORT = Number(process.env.PORT) || 8466; // PORT= lets an acceptance run and a scan share one machine
const srv = spawn('python3', ['-m', 'http.server', String(PORT), '--bind', '127.0.0.1'], { cwd: ROOT, stdio: 'ignore' });
await new Promise((r) => setTimeout(r, 900));
const browser = await chromium.launch();

// The coat under test, and the pair either side of the derived flip. T_SMOKE
// sits under Lange's "blocks most of the visible light" (T < 0.5) and above
// the measured floor in aesthetics.json's _bounds; the flip pair is where the
// rendered composite (sheet over body over nickel) hands the solve from the
// dark pole to the light one — derived in the §220 record, held here.
// §222 made T_SMOKE the SCHEMA'S DEFAULT, on the strength of these boots. It
// is still written here rather than read from the schema, and that is the
// point of it: this is the acceptance the default was chosen against, so if
// someone moves aesthetics.json's `smoke` the probe must go on holding 0.45
// and the battery's boot-silence must hold the new value — two independent
// reads, not one number checking itself.
const T_SMOKE = 0.45;
const T_FLIP_DARK = 0.59;
const T_FLIP_LIGHT = 0.58;
const T_BELOW_FLOOR_STEP = 0.01; // the slider's step: one step under the schema's floor must warn
// The works patch, as fractions of the viewport at the Dial preset (900×700):
// the motion-works wheels left of centre — no print, no hand, no chapter ring.
const PATCH = { x0: 0.283, y0: 0.374, x1: 0.467, y1: 0.479 };
const JND_LSTAR = 2.3; // CIE 1976 ΔE*ab just-noticeable difference (Mahy, Van Eycken & Oosterlinck 1994) — one perceptual step
const READ_TAU = 6 * 3600 + 30 * 60 - (1 * 3600 + 51 * 60); // 6:30 displayed: tau past the 1:51 boot epoch (main.js DIAL_EPOCH_S)

const schemaText = readFileSync(join(ROOT, 'src', 'aesthetics.json'), 'utf8');
const schema = JSON.parse(schemaText);
const FLOOR_IN_FILE = schema.dial.plate._bounds.smoke[0];

async function boot({ sapphire, smoke, liftFloor = false }) {
  const ctx = await browser.newContext({ viewport: { width: 900, height: 700 } });
  const seed = { dial: { plate: { sapphire } } };
  if (smoke !== undefined) seed.dial.plate.smoke = smoke;
  await ctx.addInitScript((v) => localStorage.setItem('aestheticsOverrides', JSON.stringify(v)), seed);
  const page = await ctx.newPage();
  if (liftFloor) {
    // The scan measures the floor, so the loader's clamp to it is lifted for
    // these boots only — the served file is the repo's with one number moved.
    const lifted = JSON.parse(schemaText);
    lifted.dial.plate._bounds.smoke[0] = 0;
    await page.route('**/src/aesthetics.json', (route) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(lifted) }));
  }
  const warns = [];
  page.on('pageerror', (e) => warns.push('PAGEERROR ' + String(e)));
  page.on('console', (m) => { if (m.type() === 'warning' && !/GroupMarker|GL Driver|SwiftShader|WebGL/.test(m.text())) warns.push(m.text()); });
  await page.goto(`http://127.0.0.1:${PORT}/index.html`, { waitUntil: 'load', timeout: 90000 });
  await page.waitForFunction(() => !!window.__clock || !!window.__bootError, null, { timeout: 120000 }).catch(() => warns.push('NO __clock'));
  if (await page.evaluate(() => !window.__clock)) { console.log(`boot died (sapphire ${sapphire}, smoke ${smoke}): ${warns.join(' | ').slice(0, 400)}`); process.exit(2); }
  const read = async () => page.evaluate(async (READ_TAU) => {
    const THREE = await import('three');
    const c = window.__clock;
    // One pose for every read and every frame. The Dial unit carries
    // tau-driven parts, so geometry is compared at one tau; and the tau is
    // 6:30 on the dial (displayed = tau + the 1:51 boot epoch), where both
    // hands hang over the seconds sub-dial and neither crosses the works
    // patch — at tau 0 the hour hand lay straight across it (measured).
    c.setPose({ tau: READ_TAU, crownPullT: 0, leverEngage: 0, tension: 0.5, windAccumTurns: 0 });
    const dialUnit = c.labelEntries.find((e) => e.name === 'Dial');
    const rows = [];
    dialUnit.obj.updateWorldMatrix(true, true);
    dialUnit.obj.traverse((o) => {
      if (!o.isMesh || o.userData.schematic) return;
      o.geometry.computeBoundingBox();
      const bb = o.geometry.boundingBox; // the mesh's OWN bounds — the metal, not its pose
      const m = o.material;
      rows.push({ name: o.name || o.geometry.type, verts: o.geometry.attributes.position.count,
        bb: [bb.min.x, bb.min.y, bb.min.z, bb.max.x, bb.max.y, bb.max.z].map((v) => +v.toFixed(4)),
        transparent: !!m.transparent, opacity: m.opacity, color: '#' + m.color.getHexString(), depthWrite: m.depthWrite,
        side: m.side, glass: !!(m.userData && m.userData.glass), mat: m.uuid, hasMap: !!m.map });
    });
    let dial = null;
    dialUnit.obj.traverse((o) => { if (!dial && o.userData && 'sapphire' in o.userData) dial = o; });
    if (!dial) dial = dialUnit.obj;
    const ink = dial.userData.inkContrast ? dial.userData.inkContrast() : null;
    return { sapphire: !!dial.userData.sapphire, smoke: dial.userData.smoke, rows, ink, bootWarns: (window.__bootWarns || []).slice() };
  }, READ_TAU);
  const before = await read();
  await page.click('#btn-xray'); await page.evaluate(() => window.__clock.step(0.01));
  const xon = await read();
  await page.click('#btn-xray'); await page.evaluate(() => window.__clock.step(0.01));
  const after = await read();
  const consts = await page.evaluate(async () => {
    const M = await import('./src/materials.js');
    let crystal = null;
    window.__clock.scene.traverse((o) => { if (!crystal && o.isMesh && /crystal/i.test(o.name || '')) crystal = o.material; });
    return {
      CRYSTAL_GLASS: { color: M.CRYSTAL_GLASS.color, opacity: M.CRYSTAL_GLASS.opacity },
      nickel: '#' + M.MATS.perledNickel.color.getHexString(),
      dialGlass: { color: M.DIAL_GLASS.color, opacity: M.DIAL_GLASS.opacity },
      smokeT: M.DIAL_SMOKE_T,
      law: (() => { const r = M.smokedGlass(M.DIAL_SMOKE_T); return { color: r.color, opacity: r.opacity }; })(),
      crystal: crystal ? { transparent: crystal.transparent, opacity: crystal.opacity, color: '#' + crystal.color.getHexString() } : null,
    };
  });
  // The frame and the works patch, read in the render's own task (the
  // CLAUDE.md trap: nothing awaited between render and read).
  const frame = await page.evaluate((P) => {
    const sch = document.getElementById('btn-schematic');
    if (sch && sch.dataset.state === 'on') sch.click();
    document.querySelector('[data-cam="Dial"]').click();
    const c = window.__clock;
    c.step(1);
    c.render();
    const src = document.querySelector('canvas');
    const cv = document.createElement('canvas'); cv.width = src.width; cv.height = src.height;
    const g = cv.getContext('2d', { willReadFrequently: true }); g.drawImage(src, 0, 0); // the attribute, or Chromium logs a readback warning the silence claim would count
    const x0 = Math.round(P.x0 * src.width), y0 = Math.round(P.y0 * src.height);
    const w = Math.round((P.x1 - P.x0) * src.width), h = Math.round((P.y1 - P.y0) * src.height);
    const d = g.getImageData(x0, y0, w, h).data;
    const lin = (v) => { v /= 255; return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; };
    const L = []; let masked = 0;
    for (let i = 0; i < d.length; i += 4) {
      if (d[i + 2] > d[i] + 25 && d[i + 2] > d[i + 1] + 25) { masked++; continue; } // blued steel (hands, screw heads), by colour — nothing else in the patch is blue
      L.push(0.2126 * lin(d[i]) + 0.7152 * lin(d[i + 1]) + 0.0722 * lin(d[i + 2]));
    }
    L.sort((a, b) => a - b);
    const q = (f) => L[Math.min(L.length - 1, Math.floor(f * L.length))];
    const crop = document.createElement('canvas'); crop.width = w; crop.height = h;
    crop.getContext('2d').putImageData(g.getImageData(x0, y0, w, h), 0, 0);
    return { png: src.toDataURL('image/png'), crop: crop.toDataURL('image/png'), p10: q(0.10), p90: q(0.90), n: L.length, masked, box: [x0, y0, w, h] };
  }, PATCH);
  const tag = sapphire ? `sapphire-T${String(smoke ?? 1).replace('.', 'p')}` : 'silvered';
  writeFileSync(join(OUT, `dial-${tag}.png`), Buffer.from(frame.png.split(',')[1], 'base64'));
  writeFileSync(join(OUT, `patch-${tag}.png`), Buffer.from(frame.crop.split(',')[1], 'base64'));
  await ctx.close();
  const Lstar = (Y) => (Y > 0.008856 ? 116 * Math.cbrt(Y) - 16 : 903.3 * Y); // CIE 1976 lightness, D65 white = 1
  const dL = Lstar(frame.p90) - Lstar(frame.p10);
  return { before, xon, after, consts, consoleWarns: warns, patch: { dL, ratio: (frame.p90 + 0.05) / (frame.p10 + 0.05), p10: frame.p10, p90: frame.p90, n: frame.n, masked: frame.masked, box: frame.box } };
}

// ---- the law, re-derived here from the page's own literals -----------------
const hex6 = (n) => '#' + n.toString(16).padStart(6, '0');
const bytes = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
const toHex = (v) => '#' + v.map((x) => Math.round(x).toString(16).padStart(2, '0')).join('');
const alphaOver = (top, a, under) => toHex(bytes(top).map((c, i) => c * a + bytes(under)[i] * (1 - a)));
const lawFor = (T, CG) => {
  const ac = CG.opacity, opacity = ac + (1 - ac) * (1 - T * T);
  const C = bytes(hex6(CG.color));
  return { opacity, color: toHex(C.map((c) => (c * ac) / opacity)) };
};
const groundFor = (T, k) => alphaOver(hex6(k.CRYSTAL_GLASS.color), k.CRYSTAL_GLASS.opacity, alphaOver(lawFor(T, k.CRYSTAL_GLASS).color, lawFor(T, k.CRYSTAL_GLASS).opacity, k.nickel));
const isBodyOrWall = (r) => r.name === 'dialPlate' || /SubdialWall$/.test(r.name);
const isSheet = (r) => r.hasMap && !isBodyOrWall(r); // the face disc (unnamed — reads as its geometry type) and both well sheets: the mapped meshes of the unit

let fail = 0;
const F = (m) => { fail++; console.log('FAIL', m); };
const OK = (m) => console.log('OK  ', m);

if (!SCAN) {
  const T_FLOOR = FLOOR_IN_FILE;
  const T_UNDER = +(T_FLOOR - T_BELOW_FLOOR_STEP).toFixed(2);
  if (!(T_SMOKE >= T_FLOOR && T_SMOKE < 0.5)) F(`T_SMOKE ${T_SMOKE} is not inside the window [floor ${T_FLOOR}, 0.5)`);
  const T1 = await boot({ sapphire: true, smoke: 1 });
  const TS = await boot({ sapphire: true, smoke: T_SMOKE });
  const TD = await boot({ sapphire: true, smoke: T_FLIP_DARK });
  const TL = await boot({ sapphire: true, smoke: T_FLIP_LIGHT });
  const TF = await boot({ sapphire: true, smoke: T_FLOOR });
  const TU = await boot({ sapphire: true, smoke: T_UNDER, liftFloor: true });
  await browser.close(); srv.kill();
  const boots = [['T=1', T1], [`T=${T_SMOKE}`, TS], [`T=${T_FLIP_DARK}`, TD], [`T=${T_FLIP_LIGHT}`, TL], [`T=${T_FLOOR} (the floor)`, TF]];
  // 1 — silence
  for (const [n, b] of boots) {
    const w = b.before.bootWarns.length + b.consoleWarns.length;
    if (w) F(`${n}: ${w} warning(s): ${[...b.before.bootWarns, ...b.consoleWarns].join(' | ').slice(0, 300)}`);
    else OK(`${n} boots silent`);
  }
  // 9 — one step under the floor warns from the zone gate and nothing else
  {
    const all = [...TU.before.bootWarns, ...TU.consoleWarns];
    const zone = all.filter((w) => /^reserve face: the (warning|maximum) zone's best tone/.test(w));
    const other = all.filter((w) => !zone.includes(w));
    if (TU.consts.smokeT !== T_UNDER) F(`T=${T_UNDER}: the lifted floor did not reach materials.js (read ${TU.consts.smokeT}) — the loader clamped it`);
    if (!zone.length) F(`T=${T_UNDER} (one step under the floor): boot is SILENT — the floor is not where the schema says, or the zone gate moved`);
    else if (other.length) F(`T=${T_UNDER}: warned from something other than the zone gate: ${other.join(' | ').slice(0, 300)}`);
    else OK(`T=${T_UNDER} (one step under the floor, clamp lifted): ${zone.length} warning(s), all from the reserve zone gate — ${zone[0].match(/holds only ([\d.]+):1/)?.[1]}:1 against the face; the floor is where the schema says`);
  }
  for (const [n, b] of boots) if (!b.before.sapphire) F(`${n}: the sapphire knob did not reach makeDial`);
  if (T1.consts.smokeT !== 1 || Math.abs(TS.consts.smokeT - T_SMOKE) > 1e-12) F(`the smoke knob did not reach materials.js (read ${T1.consts.smokeT}, ${TS.consts.smokeT})`);
  // 2 — identity
  {
    const k = T1.consts;
    const bw = T1.before.rows.filter(isBodyOrWall);
    const off = bw.filter((r) => r.opacity !== k.CRYSTAL_GLASS.opacity || r.color !== hex6(k.CRYSTAL_GLASS.color));
    if (off.length) F(`T=1: ${off.length} plate part(s) not at the crystal's recipe: ${off.map((r) => `${r.name} ${r.color}@${r.opacity}`).join(', ')}`);
    else OK(`T=1: plate body and ${bw.length - 1} walls at the crystal's recipe ${hex6(k.CRYSTAL_GLASS.color)} @ ${k.CRYSTAL_GLASS.opacity} — §3 byte for byte`);
    if (k.dialGlass.color !== k.CRYSTAL_GLASS.color || k.dialGlass.opacity !== k.CRYSTAL_GLASS.opacity) F('T=1: DIAL_GLASS is not CRYSTAL_GLASS');
    const selfMapped = T1.xon.rows.filter((r) => isBodyOrWall(r) || isSheet(r)).every((r) => T1.before.rows.find((q) => q.name === r.name && q.mat === r.mat));
    if (!selfMapped) F('T=1: x-ray did not self-map the glass parts (§3\'s behaviour)');
    else OK('T=1: x-ray self-maps every glass part, as §3 shipped it');
    const g = T1.before.ink && T1.before.ink.gated;
    const expect = groundFor(1, k);
    if (!g) F('T=1: no inkContrast record');
    else if (g.wells.some((w) => w.ground !== expect)) F(`T=1: ground ${[...new Set(g.wells.map((w) => w.ground))].join(' ')} is not the clear composite ${expect}`);
    else OK(`T=1: ground ${expect} is the rendered composite (sheet over clear body over nickel); ink ${g.trackInk} holds ${Math.min(g.trackOuter, g.trackInner, ...g.wells.map((w) => w.ratio)).toFixed(2)}:1`);
  }
  // 3 — the law at T_SMOKE
  {
    const k = TS.consts;
    const law = lawFor(T_SMOKE, k.CRYSTAL_GLASS);
    if (Math.abs(k.law.opacity - law.opacity) > 1e-12 || hex6(k.law.color) !== law.color) F(`materials.smokedGlass(${T_SMOKE}) = ${hex6(k.law.color)}@${k.law.opacity}, the law here says ${law.color}@${law.opacity}`);
    const bw = TS.before.rows.filter(isBodyOrWall);
    const off = bw.filter((r) => Math.abs(r.opacity - law.opacity) > 1e-12 || r.color !== law.color);
    if (off.length) F(`T=${T_SMOKE}: ${off.length} plate part(s) off the law ${law.color}@${law.opacity.toFixed(4)}: ${off.map((r) => `${r.name} ${r.color}@${r.opacity}`).join(', ')}`);
    else OK(`T=${T_SMOKE}: plate body and ${bw.length - 1} walls carry the law — ${law.color} @ ${law.opacity.toFixed(4)} = αc + (1 − αc)(1 − T²), C·αc/opacity`);
    const sheets = TS.before.rows.filter(isSheet);
    const badSheet = sheets.filter((r) => r.opacity !== 1 || r.color !== '#ffffff' || !r.glass);
    if (badSheet.length || sheets.length < 3) F(`T=${T_SMOKE}: sheets not print-on-coat (white @ 1, marked glass): ${sheets.map((r) => `${r.name} ${r.color}@${r.opacity}`).join(', ')}`);
    else OK(`T=${T_SMOKE}: ${sheets.length} print sheets stay white @ 1 (print on the coat, not a second coat)`);
  }
  // 4/5 — the ground and the flip
  for (const [n, b, T, pole] of [[`T=${T_SMOKE}`, TS, T_SMOKE, 'light'], [`T=${T_FLIP_DARK}`, TD, T_FLIP_DARK, 'dark'], [`T=${T_FLIP_LIGHT}`, TL, T_FLIP_LIGHT, 'light']]) {
    const g = b.before.ink && b.before.ink.gated;
    if (!g) { F(`${n}: no inkContrast record`); continue; }
    const expect = groundFor(T, b.consts);
    const grounds = [...new Set(g.wells.map((w) => w.ground))];
    if (grounds.length !== 1 || grounds[0] !== expect) F(`${n}: ground ${grounds.join(' ')} is not the rendered composite ${expect}`);
    else OK(`${n}: ground ${expect} is the rendered composite`);
    const printedPole = g.trackInk.toLowerCase() === '#1a1a1a' ? 'dark' : 'light';
    const worst = Math.min(g.trackOuter, g.trackInner, ...g.wells.map((w) => w.ratio));
    if (printedPole !== pole) F(`${n}: the solve printed the ${printedPole} pole (${g.trackInk}), the composite says ${pole}`);
    else OK(`${n}: the solve printed the ${pole} pole ${g.trackInk}, ${worst.toFixed(2)}:1 worst case against ${g.floor}`);
    if (worst < g.floor) F(`${n}: ${worst.toFixed(2)}:1 is under the ${g.floor} floor`);
  }
  // 6 — x-ray on the smoked boot
  {
    const k = TS.consts;
    const bwOn = TS.xon.rows.filter(isBodyOrWall);
    const notClear = bwOn.filter((r) => r.opacity !== k.CRYSTAL_GLASS.opacity || r.color !== hex6(k.CRYSTAL_GLASS.color) || !r.glass);
    if (notClear.length) F(`T=${T_SMOKE} x-ray ON: ${notClear.length} plate part(s) not swapped to the clear twin: ${notClear.map((r) => `${r.name} ${r.color}@${r.opacity}`).join(', ')}`);
    else OK(`T=${T_SMOKE} x-ray ON: plate body and walls swapped to the clear twin ${hex6(k.CRYSTAL_GLASS.color)} @ ${k.CRYSTAL_GLASS.opacity} — the works show`);
    const wallSides = TS.xon.rows.filter((r) => /SubdialWall$/.test(r.name)).map((r) => r.side);
    const wallSidesBefore = TS.before.rows.filter((r) => /SubdialWall$/.test(r.name)).map((r) => r.side);
    if (wallSides.join() !== wallSidesBefore.join()) F(`T=${T_SMOKE} x-ray ON: the walls' clear twin lost its sidedness (${wallSidesBefore} → ${wallSides})`);
    const sheetsSelf = TS.xon.rows.filter(isSheet).every((r) => TS.before.rows.find((q) => q.name === r.name && q.mat === r.mat));
    if (!sheetsSelf) F(`T=${T_SMOKE} x-ray ON: a print sheet changed material — sheets self-map`);
    const matKey = (rows) => rows.map((r) => `${r.name}|${r.mat}`).sort().join('\n');
    if (matKey(TS.before.rows) !== matKey(TS.after.rows)) F(`T=${T_SMOKE}: x-ray on→off did not restore every dial material`);
    else OK(`T=${T_SMOKE}: x-ray on→off restores every dial material by identity; sheets self-mapped throughout`);
  }
  // 7 — geometry
  {
    const key = (r) => `${r.name}|${r.verts}|${r.bb.join(',')}`;
    const a = T1.before.rows.map(key).sort(), b = TS.before.rows.map(key).sort();
    const diff = a.filter((k, i) => k !== b[i]);
    if (a.length !== b.length || diff.length) F(`geometry differs between T=1 and T=${T_SMOKE}: ${diff.slice(0, 4).join(' ; ')}`);
    else OK(`geometry identical between T=1 and T=${T_SMOKE}: ${a.length} meshes, same names, vertex counts and own bounds`);
  }
  // 8 — the crystal
  for (const [n, b] of boots) {
    const c = b.consts.crystal;
    if (!c) { console.log(`     ${n}: crystal mesh not found by name — recipe not checked`); continue; }
    if (c.opacity !== b.consts.CRYSTAL_GLASS.opacity || c.color !== hex6(b.consts.CRYSTAL_GLASS.color)) F(`${n}: the case crystal moved to ${c.color}@${c.opacity}`);
  }
  OK('the case crystal reads CRYSTAL_GLASS on every boot');
  for (const [n, b] of boots) console.log(`     ${n}: works patch ΔL* ${b.patch.dL.toFixed(1)} (p90/p10 ${b.patch.ratio.toFixed(2)}:1, ${b.patch.masked} hand px masked) — a report; the scan is the instrument`);
  console.log(`frames: ${OUT}/dial-sapphire-T*.png (+ patch-*.png crops)`);
  process.exit(fail ? 1 : 0);
}

// ---- --scan: the floor --------------------------------------------------------
const fmt = (b) => `ΔL* ${b.patch.dL.toFixed(2)} (p10 ${b.patch.p10.toFixed(4)}, p90 ${b.patch.p90.toFixed(4)}, ${b.patch.n} px, ${b.patch.masked} hand px masked)`;
console.log(`scan: works patch ${JSON.stringify(PATCH)} (viewport fractions), floor ΔL* ≥ ${JND_LSTAR} (the CIELAB JND); aesthetics.json's floor ${FLOOR_IN_FILE} lifted to 0 for these boots`);
const silv = await boot({ sapphire: false, smoke: 1 }); // both keys pinned: never the schema's default (§222 moved it)
const clear = await boot({ sapphire: true, smoke: 1 });
console.log(`control  silvered (opaque): ${fmt(silv)}  ${silv.patch.dL < JND_LSTAR ? 'PASS (under the JND — the metric is not reading the print)' : 'FAIL (the metric reads something other than the works)'}`);
console.log(`control  clear sapphire    : ${fmt(clear)}  ${clear.patch.dL >= 10 * JND_LSTAR ? 'PASS (the works read at T = 1, an order above the JND)' : 'FAIL (the patch is not on the works)'}`);
if (silv.patch.dL >= JND_LSTAR || clear.patch.dL < 10 * JND_LSTAR) { console.log('controls failed — no floor printed'); await browser.close(); srv.kill(); process.exit(1); }
const rows = [[1, clear.patch.dL]];
let lo = null, hi = 1; // hi: last T that read; lo: first T that did not
for (let T = 0.9; T >= 0.05; T = +(T - 0.1).toFixed(2)) {
  const b = await boot({ sapphire: true, smoke: T, liftFloor: true });
  rows.push([T, b.patch.dL]);
  console.log(`T ${T.toFixed(2)}  ${fmt(b)}  ${b.patch.dL >= JND_LSTAR ? 'reads' : 'does not read'}`);
  if (b.patch.dL >= JND_LSTAR) hi = T; else { lo = T; break; }
}
if (lo === null) console.log(`the works read at every scanned T down to ${hi} — no floor inside the scan`);
else {
  while (+(hi - lo).toFixed(3) > 0.01) {
    const mid = +((hi + lo) / 2).toFixed(2);
    if (mid === hi || mid === lo) break;
    const b = await boot({ sapphire: true, smoke: mid, liftFloor: true });
    rows.push([mid, b.patch.dL]);
    console.log(`T ${mid.toFixed(2)}  ${fmt(b)}  ${b.patch.dL >= JND_LSTAR ? 'reads' : 'does not read'}`);
    if (b.patch.dL >= JND_LSTAR) hi = mid; else lo = mid;
  }
  console.log(`WORKS FLOOR: the works read at T = ${hi} and not at T = ${lo} (the JND). aesthetics.json's floor is ${FLOOR_IN_FILE}, the reserve zone gate's — `
    + (hi > FLOOR_IN_FILE ? `the WORKS now bind (${hi} > ${FLOOR_IN_FILE}): raise _bounds.smoke[0] to ${hi} and say why in its comment`
      : `the zones still bind (${hi} ≤ ${FLOOR_IN_FILE}); this number is the report the §220 record carries`));
}
await browser.close(); srv.kill();
console.log(`frames: ${OUT}/dial-*.png, crops ${OUT}/patch-*.png`);
