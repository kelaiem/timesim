// DOES THE WIREFRAME DRAW THE CASE THAT WAS BUILT — ON EVERY CASE SHAPE?
// Acceptance (BUILT §307 landing 3): exits non-zero on any failure.
//
// The schematic tier (main.js §66/§71, "Wireframe" on the panel) draws the
// housing as hairlines and the base plate as a page-colored occluder, and until
// §307 landing 3 both were the ROUND case's: CASE_DIMS circles and a
// BASE_RIM_R disc, drawn round a movement whose plate, dial and case had been
// cut to a form loop (§307/§308's ?case=rect|cushion|tonneau). Nothing saw it:
// the battery runs the round build, and the round drawing's one rule — "same
// derivation, two tiers" — held only there. form-case.js's `formCaseLines`
// is the drawing law now, read off the BUILT group and the same CASE_DIMS the
// solid was cut to; the plate's occluder is the loop the plate was cut to
// (BACK_PLATE_CUT.outline). This is the instrument that holds both ON THE
// METAL, per build, so the law cannot drift from the solid in silence again.
//
// Per build (the round build as a control that the tier still draws there, then
// every fitted form case gong-seats.js lists, then any extra query strings in
// SPEC=…;…), with the metal at the boot pose (the case does not move):
//   L1  ON THE METAL: every vertex of every line in the `caseLines` group lies on
//       the solid case's surface — the closest point over every mesh of the
//       'case' unit (three-mesh-bvh, in each mesh's own rigid frame; the case
//       carries no scale) within TOL = 1e-4 u, float32's rounding of a shared
//       point and three orders under anything physical. The one exception is
//       the spring bar's line, which the drawing draws as the bar's AXIS (the
//       round drawing's convention): it is held INSIDE the bar instead, within
//       CASE_SPRING_BAR_D / 2 of the metal. Gated on the form builds; on the
//       round build the rings sit on an analytic circle the lathe only
//       approximates and the tubes run R_IN→R_OUT by convention, so there the
//       worst distance per kind of line is REPORTED, except the pusher's bore
//       lines, which §307 landing 3 moved onto the chord the solid drills on
//       and which are gated inside the bore's own wall thickness.
//   L2  COMPLETE: the form drawing carries every kind of line the law names —
//       outer, bezel (§289: the flat's two edges), opening, crystal, bore, aperture, glass rings; four generators;
//       six tube lines (three tubes); four lug outlines, four holes, two bars.
//   P1  THE PLATE'S OCCLUDER IS THE PLATE: every vertex of the base plate's
//       schematic rim lines and wall ribbon lies ON the form outline
//       (|inset| ≤ 1e-5, float32's rounding of a shared point, against the shape the case carries, g.userData.form,
//       whose loop the plate was cut to) and every fill vertex inside or on it.
//   P2  FACING OUT: the two fills face away from the slab (the +1 face's
//       triangles wind +z, the −1 face's −z — mirrored by winding, the
//       landing's rule, since a tonneau is not its own mirror) and every wall
//       quad faces outward from the shape's centre; a face wound the wrong way
//       is culled and the occluder goes transparent on that side. A sliver
//       under 1e-4 u² (earcut's rounding over a dense loop) has no winding to
//       judge and is counted, not gated.
// Controls, per form build: C1 the circle FITTED to the drawn outer ring (its
// mean radius about the shape's centre — what the old drawing amounted to)
// must miss the metal by more than CLEAR_MARGIN under L1's own reader, and
// the same circle fitted to the plate's rim must miss the outline by more than
// CLEAR_MARGIN under P1's; C2 a name that resolves to no object THROWS rather
// than passing a scan of nothing (resolveAxes' precedent). A page error gates a
// catalogue build and is reported on a SPEC build; console warnings (boot
// silence, standing rule 6) are REPORTED per build.
//
// Run: node tools/probe-schematic-form-case.mjs [--only round|rect|cushion|tonneau] [--shot DIR]
//      SPEC='case=tonneau&formrect=…;…' adds builds (';'-separated queries)
//      PW_CHROMIUM=/path/to/chrome when Playwright's own browser is not installed
//      --shot DIR saves a wireframe screenshot per build, for the eye.
import { createServer } from 'node:http';
import { readFile, mkdir } from 'node:fs/promises';
import { join, extname, normalize, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { GONG_SEATS } from '../src/gong-seats.js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
const only = args.includes('--only') ? args[args.indexOf('--only') + 1] : null;
const shotDir = args.includes('--shot') ? args[args.indexOf('--shot') + 1] : null;
const fails = [];
const ok = (name, cond, detail = '') => { console.log(`${cond ? 'PASS' : 'FAIL'}  ${name}${detail ? ` — ${detail}` : ''}`); if (!cond) fails.push(name); };

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
const measure = async (isForm) => {
  const THREE = await import('three');
  const { MeshBVH } = await import('./vendor/three-mesh-bvh.module.js');
  const L = await import('./src/layout.js');
  const clock = window.__clock, scene = clock.scene;
  const need = (name) => { const o = scene.getObjectByName(name); if (!o) throw new Error(`no such object: ${name}`); return o; };
  scene.updateMatrixWorld(true);
  const caseG = need('case'), lines = need('caseLines'), plate = need('backPlate');
  const TOL = 1e-4;
  // The occluder's vertices are float32 (BufferGeometry) copies of the loop's
  // doubles: at a 20 u radius half an ulp is ~6e-7 per coordinate, so a point
  // ON the outline reads an inset of up to ~1e-6, and the disc's 96 radii
  // spread by that much. 1e-5 is ten of those and five orders under CLEAR_MARGIN.
  const F32 = 1e-5;

  // L1's reader: the distance from a world point to the nearest case metal.
  const caseMeshes = [];
  caseG.traverse((m) => { if (m.isMesh && m.geometry?.attributes?.position && !m.userData.schematic) caseMeshes.push(m); });
  const trees = caseMeshes.map((m) => ({ m, bvh: new MeshBVH(m.geometry), inv: m.matrixWorld.clone().invert() }));
  const q = new THREE.Vector3(), tgt = {};
  const distToCase = (p) => {
    let best = Infinity;
    for (const { bvh, inv } of trees) {
      q.copy(p).applyMatrix4(inv);
      const hit = bvh.closestPointToPoint(q, tgt, 0, best);
      if (hit && hit.distance < best) best = hit.distance;
    }
    return best;
  };
  const vertsOf = (o) => {
    const p = o.geometry.attributes.position, out = [];
    for (let i = 0; i < p.count; i++) out.push(new THREE.Vector3().fromBufferAttribute(p, i).applyMatrix4(o.matrixWorld));
    return out;
  };

  // L1 / L2 — the case lines, per kind.
  const byWhat = {};
  let outerRing = null;
  for (const ln of lines.children) {
    if (!ln.isLine) continue;
    const what = ln.userData.what ?? 'untagged';
    const vs = vertsOf(ln);
    const row = byWhat[what] ??= { lines: 0, verts: 0, worst: 0 };
    row.lines++; row.verts += vs.length;
    for (const v of vs) row.worst = Math.max(row.worst, distToCase(v));
    if (what === 'outer' && !outerRing) outerRing = vs;
  }
  // The round drawing's pusher bore: its two lines, told apart from the crowns'
  // by their diameter (CASE_PUSHER_D against CASE_TUBE_D — the lines of one tube
  // stand d apart).
  // Held to the BUILT bore's axis rather than to its metal: the round drawing
  // runs every tube R_IN→R_OUT by convention while the pusher's sleeve lines
  // only the band's own hole (makeCase §187), so its inboard end stands in
  // air; what the fix moved is WHERE the lines stand, and that is the distance
  // of each drawn vertex from the sleeve's axis — exactly CASE_PUSHER_D / 2.
  // On the radius, as drawn until §307 landing 3, it read d/2 ± the chord.
  let pusherWorst = null;
  if (!isForm) {
    const sleeve = need('casePusherBoreSleeve');
    const o = new THREE.Vector3().setFromMatrixPosition(sleeve.matrixWorld);
    const dir = new THREE.Vector3(0, 1, 0).transformDirection(sleeve.matrixWorld);
    const tubes = lines.children.filter((ln) => ln.isLine && ln.userData.what === 'tube').map(vertsOf);
    for (let i = 0; i < tubes.length; i++) for (let j = i + 1; j < tubes.length; j++) {
      const d = tubes[i][0].distanceTo(tubes[j][0]);
      if (Math.abs(d - L.CASE_PUSHER_D) < 1e-6) {
        pusherWorst = 0;
        for (const v of [...tubes[i], ...tubes[j]]) {
          const off = new THREE.Vector3().subVectors(v, o).cross(dir).length();   // distance from the axis line
          pusherWorst = Math.max(pusherWorst, Math.abs(off - L.CASE_PUSHER_D / 2));
        }
      }
    }
  }

  // C1 (case) — the circle fitted to the drawn outer ring, read the same way.
  const form = caseG.userData.form ?? null;
  // A form build whose case carries no shape is not the build asked for (a
  // mistyped query boots round): refuse to measure rather than pass vacuously.
  if (isForm && !form) throw new Error(`the 'case' group carries no userData.form — this is not a form build (${location.search})`);
  const cx = form ? form.cx : 0, cy = form ? form.cy : 0;
  let fitted = null;
  if (outerRing) {
    const z = outerRing[0].z;
    const r = outerRing.reduce((a, v) => a + Math.hypot(v.x - cx, v.y - cy), 0) / outerRing.length;
    fitted = { r, worst: 0 };
    for (let k = 0; k < 96; k++) {
      const a = 2 * Math.PI * k / 96;
      fitted.worst = Math.max(fitted.worst, distToCase(new THREE.Vector3(cx + r * Math.cos(a), cy + r * Math.sin(a), z)));
    }
  }

  // P1 / P2 — the base plate's occluder, in the plate's own frame (the loop it
  // was cut to is in that frame; the occluder's children carry only a z).
  const occ = { rim: { verts: 0, worst: 0, radii: [] }, fill: { verts: 0, worstOutside: 0, wrongWinding: 0, wrongArea: 0, slivers: 0, faces: 0 }, wall: { verts: 0, worst: 0, inward: 0, quads: 0 } };
  // A fill triangle thinner than float32 can resolve has no winding to judge:
  // earcut over a dense loop (the cushion's 2050 vertices, chords ~0.15 u)
  // emits slivers whose signed area is rounding noise (~chord × 1e-6 ≈ 1e-7 u²)
  // and either sign. AREA_FLOOR is three orders over that noise and still
  // invisible (1e-4 u² is 1.7e-4 mm²); a wrongly wound triangle ABOVE it is a
  // face the viewer would see missing, and gates. Slivers are counted.
  const AREA_FLOOR = 1e-4;
  const insetOf = (x, y) => (form ? form.inset(x, y) : NaN);
  let plateCentreR = null;
  for (const o of plate.children) {
    if (!o.userData?.schematic || !o.geometry?.attributes?.position) continue;
    const p = o.geometry.attributes.position;
    const local = (i) => new THREE.Vector3().fromBufferAttribute(p, i).applyMatrix4(o.matrix);
    if (o.isLine) {
      for (let i = 0; i < p.count; i++) {
        const v = local(i);
        occ.rim.verts++; occ.rim.radii.push(Math.hypot(v.x, v.y));
        if (form) occ.rim.worst = Math.max(occ.rim.worst, Math.abs(insetOf(v.x, v.y)));
      }
      if (!plateCentreR) plateCentreR = occ.rim.radii.reduce((a, b) => a + b, 0) / occ.rim.radii.length;
    } else if (o.isMesh) {
      const ix = o.geometry.index?.array;
      const zs = new Set(); for (let i = 0; i < p.count; i++) zs.add(local(i).z.toFixed(6));
      const isFill = zs.size === 1;   // a face lies in one plane; the wall spans two
      const row = isFill ? occ.fill : occ.wall;
      for (let i = 0; i < p.count; i++) {
        const v = local(i); row.verts++;
        if (!form) continue;
        const d = insetOf(v.x, v.y);
        if (isFill) row.worstOutside = Math.max(row.worstOutside, -d);
        else row.worst = Math.max(row.worst, Math.abs(d));
      }
      if (ix) {
        const a = new THREE.Vector3(), b = new THREE.Vector3(), c = new THREE.Vector3(), n = new THREE.Vector3();
        for (let t = 0; t < ix.length; t += 3) {
          a.copy(local(ix[t])); b.copy(local(ix[t + 1])); c.copy(local(ix[t + 2]));
          n.subVectors(b, a).cross(c.clone().sub(a));
          if (isFill) {
            row.faces++;
            const area = Math.abs(n.z) / 2;
            if (area <= AREA_FLOOR) row.slivers++;
            else if (Math.sign(n.z) !== Math.sign(a.z)) { row.wrongWinding++; row.wrongArea = Math.max(row.wrongArea, area); }
          }
          else {
            row.quads++;
            const mx = (a.x + b.x + c.x) / 3 - cx, my = (a.y + b.y + c.y) / 3 - cy;
            if (n.x * mx + n.y * my <= 0) row.inward++;
          }
        }
      }
    }
  }
  // C1 (plate) — the circle fitted to the rim, against the outline.
  let plateFitted = null;
  if (form && plateCentreR !== null) {
    plateFitted = { r: plateCentreR, worst: 0 };
    for (let k = 0; k < 96; k++) {
      const a = 2 * Math.PI * k / 96;
      plateFitted.worst = Math.max(plateFitted.worst, Math.abs(insetOf(cx + plateCentreR * Math.cos(a), cy + plateCentreR * Math.sin(a))));
    }
  }
  // C2 — a roster that names nothing throws.
  let threw = false;
  try { need('noSuchGroup'); } catch { threw = true; }
  return { tol: TOL, f32: F32, clearMargin: L.CLEAR_MARGIN, barR: L.CASE_SPRING_BAR_D / 2,
    kind: form ? form.kind : 'circle', byWhat, pusherWorst, fitted, occ: { rim: { verts: occ.rim.verts, worst: occ.rim.worst, rSpread: Math.max(...occ.rim.radii) - Math.min(...occ.rim.radii) }, fill: occ.fill, wall: occ.wall }, plateFitted, missingThrows: threw };
};

const NOISE = /GPU stall|GL Driver Message|swiftshader|ReadPixels|Automatic fallback to software WebGL|Failed to load resource: the server responded with a status of 404/i;
const FORM_KINDS = ['outer', 'backRound', 'bezel', 'opening', 'crystal', 'bore', 'aperture', 'glass', 'generator', 'tube', 'lug', 'lugHole', 'lugBar'];   // 'bezel': §289's flat's two edges, under a form too; 'backRound': §321's back round meeting its flat
if (shotDir) await mkdir(shotDir, { recursive: true });
for (const b of run) {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } }), page = await ctx.newPage();
  const errors = [], warns = [];
  page.on('pageerror', (e) => errors.push('PAGEERROR ' + e.message));
  page.on('console', (m) => {
    if (NOISE.test(m.text())) return;
    if (m.type() === 'error') errors.push(m.text());
    if (m.type() === 'warning') warns.push(m.text());
  });
  await page.goto(`http://127.0.0.1:${srv.address().port}/index.html?hud=0&sync=0&schematic=1${b.q ? '&' + b.q : ''}`);
  await page.waitForFunction(() => !!window.__clock || !!window.__bootError, null, { timeout: 600000, polling: 1000 });
  const dead = await page.evaluate(() => window.__bootError ? String(window.__bootError) : null);
  if (dead) { ok(`${b.name}: boots`, false, dead); await ctx.close(); continue; }
  const isForm = b.name !== 'round';
  const r = await page.evaluate(measure, isForm);
  if (shotDir) {
    await page.evaluate(() => window.__clock.render());
    await page.screenshot({ path: join(shotDir, `wireframe-${b.name.replace(/[^a-z0-9]+/gi, '_')}.png`) });
  }
  await ctx.close();
  console.log(`\n== ${b.name}${b.q ? ` (?${b.q})` : ''} — shape ${r.kind}`);
  const f4 = (x) => (x === Infinity ? 'over the bound' : x.toFixed(6));
  for (const [what, row] of Object.entries(r.byWhat)) {
    const bar = what === 'lugBar';
    const lim = bar ? r.barR + r.tol : r.tol;
    const line = `${b.name}: ${row.lines} ${what} line(s), ${row.verts} vertices — worst ${f4(row.worst)} ${bar ? 'inside the bar' : 'off the case metal'}`;
    if (isForm) ok(`${line} (≤ ${lim.toExponential(1)})`, row.worst <= lim);
    else console.log(`REPORT  ${line}`);
  }
  if (isForm) {
    ok(`${b.name}: every kind of line the law names is drawn`, FORM_KINDS.every((k) => r.byWhat[k]), `missing: ${FORM_KINDS.filter((k) => !r.byWhat[k]).join(', ') || 'none'}; extra: ${Object.keys(r.byWhat).filter((k) => !FORM_KINDS.includes(k)).join(', ') || 'none'}`);
    ok(`${b.name}: 4 generators, 6 tube lines, 4 lug outlines, 4 holes, 2 bars`,
      r.byWhat.generator?.lines === 4 && r.byWhat.tube?.lines === 6 && r.byWhat.lug?.lines === 4 && r.byWhat.lugHole?.lines === 4 && r.byWhat.lugBar?.lines === 2,
      `${r.byWhat.generator?.lines ?? 0} / ${r.byWhat.tube?.lines ?? 0} / ${r.byWhat.lug?.lines ?? 0} / ${r.byWhat.lugHole?.lines ?? 0} / ${r.byWhat.lugBar?.lines ?? 0}`);
    ok(`${b.name}: C1 — a circle fitted to the outer ring (r ${r.fitted?.r.toFixed(3)}) misses the metal by more than CLEAR_MARGIN`, r.fitted && r.fitted.worst > r.clearMargin, `${f4(r.fitted?.worst ?? NaN)} > ${r.clearMargin}`);
    ok(`${b.name}: P1 — the plate occluder's rim (${r.occ.rim.verts} vertices) lies on the outline`, r.occ.rim.verts > 0 && r.occ.rim.worst <= r.f32, `|inset| ≤ ${r.occ.rim.worst.toExponential(2)}`);
    ok(`${b.name}: P1 — its wall (${r.occ.wall.verts} vertices) lies on the outline`, r.occ.wall.verts > 0 && r.occ.wall.worst <= r.f32, `|inset| ≤ ${r.occ.wall.worst.toExponential(2)}`);
    ok(`${b.name}: P1 — its fills (${r.occ.fill.verts} vertices) lie inside or on it`, r.occ.fill.verts > 0 && r.occ.fill.worstOutside <= r.f32, `outside by ≤ ${r.occ.fill.worstOutside.toExponential(2)}`);
    ok(`${b.name}: P2 — the fills face away from the slab (${r.occ.fill.faces} triangles, ${r.occ.fill.slivers} slivers under ${1e-4} u² not judged)`, r.occ.fill.faces > r.occ.fill.slivers && r.occ.fill.wrongWinding === 0, `${r.occ.fill.wrongWinding} wound toward it${r.occ.fill.wrongWinding ? `, the largest ${r.occ.fill.wrongArea.toExponential(2)} u²` : ''}`);
    ok(`${b.name}: P2 — the wall faces outward (${r.occ.wall.quads} triangles)`, r.occ.wall.quads > 0 && r.occ.wall.inward === 0, `${r.occ.wall.inward} facing in`);
    ok(`${b.name}: C1 — a circle fitted to the plate's rim (r ${r.plateFitted?.r.toFixed(3)}) misses the outline by more than CLEAR_MARGIN`, r.plateFitted && r.plateFitted.worst > r.clearMargin, `${f4(r.plateFitted?.worst ?? NaN)} > ${r.clearMargin}`);
  } else {
    ok(`${b.name}: the case draws (${Object.values(r.byWhat).reduce((a, x) => a + x.lines, 0)} lines) and the plate occluder is a disc`, Object.keys(r.byWhat).length > 0 && r.occ.rim.verts > 0 && r.occ.rim.rSpread < r.f32, `rim radii spread ${r.occ.rim.rSpread.toExponential(2)}`);
    ok(`${b.name}: the pusher's two bore lines stand d/2 off the built bore's axis (on its chord, not its radius)`, r.pusherWorst !== null && r.pusherWorst <= r.tol, r.pusherWorst === null ? 'pusher lines not found' : `worst ${f4(r.pusherWorst)} off d/2`);
  }
  ok(`${b.name}: a name that resolves to no object throws`, r.missingThrows);
  if (b.name.startsWith('spec ')) console.log(`${errors.length ? 'REPORT' : 'PASS'}  ${b.name}: ${errors.length ? `${errors.length} page error(s), not this probe's — ${errors.join(' | ').slice(0, 300)}` : 'no page error'}`);
  else ok(`${b.name}: no page error`, !errors.length, errors.join(' | ').slice(0, 300));
  console.log(`REPORT  ${b.name}: ${warns.length} console warning(s)${warns.length ? ` — ${warns.join(' | ').slice(0, 400)}` : ''}`);
}
await browser.close();
srv.close();
console.log(fails.length ? `\n${fails.length} FAILED:\n  ${fails.join('\n  ')}` : '\nALL PASS');
process.exit(fails.length ? 1 : 0);
