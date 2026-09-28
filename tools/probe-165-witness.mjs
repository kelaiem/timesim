// TODO 165 — does the pass-through witness reach the bevels now? ACCEPTANCE.
//
// `sampledVerdict`'s TODO 95 witness (does any edge of one body pierce the
// other in AND out?) only runs when the body being crossed is a closed
// manifold, judged by `boundsASolid`. That judgement counted a collapsed
// triangle — two corners on one position key, i.e. a segment — as two edges on
// the same key, so every seam of `makeConicalGear`'s cap strips read as a
// 4-count edge and every bevel in the movement was refused the witness. A body
// thinner than the sample spacing could then pass straight through a bevel's
// web and read as clearance. TODO 165 skips collapsed triangles
// (`surfaceEdgeCensus`, the one copy of the law).
//
// Three tiers, each against the rule AS IT WAS, obtained by rewriting the
// TODO 165 line out of src/inspect.js in flight (a rewrite that does not take
// is a thrown error, never a silent pass):
//   census   — no mesh accepted by the old rule is refused by the new one (the
//              change is monotone), and alarmWindContrate has 0 bad edges.
//   rod      — a 0.004-square rod through the contrate's largest flat web face,
//              both ends in air, crossing the web exactly twice (counted by an
//              independent raycast). The OLD rule must read it > 0 — that is
//              the must-fail control; if it reads 0 the rod has found some
//              other witness and the tier is measuring nothing. The NEW rule
//              must read exactly 0.
// Both builds must boot without a page error. Boot SILENCE is the battery's
// gate (it knows which console lines are the GPU's), so it is not re-judged here.
import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = process.env.ROOT || join(dirname(fileURLToPath(import.meta.url)), '..');
const PORT = Number(process.env.PORT || 8491);
const srv = spawn('python3', ['-m', 'http.server', String(PORT), '--bind', '127.0.0.1'], { cwd: ROOT, stdio: 'ignore' });
await new Promise((r) => setTimeout(r, 1200));

const NEW_LINE = 'if (k[0] === k[1] || k[1] === k[2] || k[0] === k[2]) { collapsed++; continue; }';
const OLD_KEY = 'const kk = a < b ? `${a}|${b}` : `${b}|${a}`;';
const src = readFileSync(join(ROOT, 'src/inspect.js'), 'utf8');
const count = (s, x) => s.split(x).length - 1;
if (count(src, NEW_LINE) !== 1 || count(src, OLD_KEY) !== 1)
  throw new Error('probe-165: the rule line or the edge key is not where this probe expects it — the old-rule rewrite cannot be made, update the probe');
const OLD_SRC = src.replace(NEW_LINE, '').replace(OLD_KEY, 'if (a === b) continue; ' + OLD_KEY);

const browser = await chromium.launch({ args: ['--disable-background-timer-throttling', '--disable-backgrounding-occluded-windows', '--disable-renderer-backgrounding'] });

const MEASURE = async () => {
  const I = await import('./src/inspect.js');
  const THREE = await import('three');
  const c = window.__clock;
  c.resetInputs();
  c.scene.updateMatrixWorld(true);
  // census over every labelled, non-schematic mesh
  const perGeom = new Map();
  const walk = (n, out) => { if (n.userData && n.userData.schematic) return; if (n.isMesh && n.geometry?.attributes?.position) out.push(n); for (const ch of n.children) walk(ch, out); };
  const meshes = [];   // [mesh, id] — the id is the unit and walk order, which two boots share (a uuid is not)
  for (const e of c.labelEntries) { const ms = []; walk(e.obj, ms); ms.forEach((m, i) => meshes.push([m, `${e.name}/${i}/${m.name || m.geometry.type}`])); }
  let accepted = 0;
  const acceptedIds = [];
  for (const [m, id] of meshes) {
    let r = perGeom.get(m.geometry);
    if (!r) { r = I.surfaceEdgeCensus(m.geometry); perGeom.set(m.geometry, r); }
    if (r.bad === 0) { accepted++; acceptedIds.push(id); }
  }
  const contrates = [];
  c.scene.traverse((o) => { if (o.isMesh && o.name === 'alarmWindContrate') contrates.push(o); });
  const K = contrates.map((m) => I.surfaceEdgeCensus(m.geometry));
  // the rod: through the centroid of the contrate body's largest flat face
  const body = contrates.map((m, i) => [m, K[i]]).sort((x, y) => y[0].geometry.index.count - x[0].geometry.index.count)[0][0];
  const g = body.geometry, pos = g.attributes.position, idx = g.index;
  const A = new THREE.Vector3(), B = new THREE.Vector3(), C = new THREE.Vector3(), N = new THREE.Vector3(), T = new THREE.Triangle();
  let best = null;
  for (let t = 0; t < idx.count; t += 3) {
    A.fromBufferAttribute(pos, idx.getX(t)); B.fromBufferAttribute(pos, idx.getX(t + 1)); C.fromBufferAttribute(pos, idx.getX(t + 2));
    T.set(A, B, C); T.getNormal(N);
    if (Math.abs(N.z) < 0.999) continue;                 // a web face: flat, normal along the arbor
    const area = T.getArea();
    if (!best || area > best.area) best = { area, centroid: T.getMidpoint(new THREE.Vector3()), nz: N.z };
  }
  // the rod runs along the face normal, starting 0.3 OUTSIDE the face and 1.6
  // long, so it crosses the ~0.38 web and its mid-length (where every long edge
  // and diagonal of a BoxGeometry has its midpoint) lies 0.5 past the face, in
  // air beyond the web. Neither its vertices nor any edge midpoint can then sit
  // inside the metal, and only a pass-through witness can see the crossing.
  const ROD_W = 0.004, ROD_L = 1.6, OUT = 0.3, sgn = Math.sign(best.nz);
  const z0 = best.centroid.z + sgn * OUT, z1 = z0 - sgn * ROD_L;
  const rod = new THREE.Mesh(new THREE.BoxGeometry(ROD_W, ROD_W, ROD_L), new THREE.MeshBasicMaterial());
  rod.position.set(best.centroid.x, best.centroid.y, (z0 + z1) / 2);
  body.add(rod); body.updateMatrixWorld(true);
  const d = I.meshClearance(rod, body);   // builds the body's bounds tree as a side effect
  // independent truth: crossings of the rod's axis with the body's surface
  // within the rod's length, DOUBLE-SIDED (a FrontSide material would drop the
  // exit face), in the body's own frame, deduped as segmentPierces dedupes.
  const lray = new THREE.Ray(new THREE.Vector3(best.centroid.x, best.centroid.y, z0), new THREE.Vector3(0, 0, -sgn));
  const hits = [...new Set(g.boundsTree.raycast(lray, THREE.DoubleSide, 0, ROD_L).map((h) => +h.distance.toFixed(4)))].sort((x, y) => x - y);
  const crossings = hits.length;
  body.remove(rod);
  return {
    meshes: meshes.length, geometries: perGeom.size, accepted, acceptedIds,
    contrate: K.map((k, i) => ({ tris: contrates[i].geometry.index ? contrates[i].geometry.index.count / 3 : 0, ...k })),
    face: { area: +best.area.toFixed(4), x: +best.centroid.x.toFixed(3), y: +best.centroid.y.toFixed(3), z: +best.centroid.z.toFixed(3) },
    crossings, hits, d,
  };
};

const run = async (oldRule) => {
  const page = await browser.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  await page.route('**/__state*', (r) => r.fulfill({ status: 404, body: '' }));
  let took = !oldRule;
  if (oldRule) await page.route('**/src/inspect.js*', (r) => { took = true; r.fulfill({ status: 200, contentType: 'text/javascript; charset=utf-8', body: OLD_SRC }); });
  await page.goto(`http://127.0.0.1:${PORT}/index.html`, { waitUntil: 'load', timeout: 180000 });
  await page.waitForFunction(() => !!window.__clock && !!window.__clock.labelEntries, null, { timeout: 180000 });
  // freeze the render loop only AFTER boot — the entry script yields a frame
  // before it imports main.js, so a frozen rAF from the start never boots
  await page.evaluate(() => { window.requestAnimationFrame = () => 0; });
  const r = await page.evaluate(MEASURE);
  if (!took) throw new Error('probe-165: the old-rule route never fired — the control would be the new rule twice');
  await page.close();
  return { ...r, errors };
};

const fails = [];
const fail = (s) => { fails.push(s); console.log('  FAIL ' + s); };
const NEW = await run(false);
const OLD = await run(true);

console.log('== census ==');
console.log(`  ${NEW.meshes} meshes over ${NEW.geometries} geometries: accepted ${OLD.accepted} under the old rule, ${NEW.accepted} under TODO 165's`);
const newSet = new Set(NEW.acceptedIds);
const lost = OLD.acceptedIds.filter((x) => !newSet.has(x));
if (lost.length) fail(`${lost.length} mesh(es) accepted before are refused now (the rule must be monotone): ${lost.slice(0, 5).join(', ')}`);
else console.log('  0 lost — monotone');
if (NEW.accepted <= OLD.accepted) fail('the new rule accepts no more meshes than the old — the change did nothing');
for (const [tag, R] of [['old', OLD], ['new', NEW]])
  console.log(`  alarmWindContrate (${tag}): ` + R.contrate.map((k) => `${k.tris} tris, bad ${k.bad} (over ${k.over}), collapsed ${k.collapsed}`).join(' · '));
if (!NEW.contrate.length) fail('alarmWindContrate not found');
if (NEW.contrate.some((k) => k.bad !== 0)) fail('alarmWindContrate still has non-2 edges under the new rule');
if (!OLD.contrate.some((k) => k.bad > 0)) fail('CONTROL: alarmWindContrate reads closed under the OLD rule too — the rewrite measured nothing');

console.log('== rod through the web ==');
console.log(`  face: area ${NEW.face.area} at (${NEW.face.x}, ${NEW.face.y}, ${NEW.face.z}) contrate-local; axis crossings within the rod: ${NEW.crossings} [${NEW.hits.join(', ')}]`);
if (NEW.crossings !== 2) fail(`the rod's axis crosses the body ${NEW.crossings} times, not in-and-out once — the rod is not a clean pass-through`);
console.log(`  meshClearance: old rule ${OLD.d.toFixed(4)}, new rule ${NEW.d.toFixed(4)}`);
if (!(OLD.d > 0)) fail('CONTROL: the old rule already reads the rod as touching — some other witness sees it, so this tier proves nothing');
if (NEW.d !== 0) fail(`the new rule reads ${NEW.d.toFixed(4)} for a rod that passes through the web — the witness did not run`);

console.log('== boot ==');
for (const [tag, R] of [['old', OLD], ['new', NEW]]) {
  console.log(`  ${tag}: ${R.errors.length} page error(s)`);
  if (R.errors.length) fail(`${tag} build: ${R.errors[0]}`);
}

await browser.close(); srv.kill();
console.log(fails.length ? `\nFAIL — ${fails.length} problem(s)` : '\nPASS — the witness reaches the bevels, monotone, and a rod through the contrate web reads 0');
process.exit(fails.length ? 1 : 0);
