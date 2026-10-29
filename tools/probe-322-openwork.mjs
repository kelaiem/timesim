// §322 — THE OPENWORKED PLATE'S VIEWS, measured off a real boot: does the
// fusee window frame the whole cone, does the kidney cut show the escape wheel
// round, and does the escape cock actually carry the pivot it took out of the
// plate — while the fourth wheel stays in its plate chaton, under the plate?
//
// ACCEPTANCE (exits non-zero). What it holds, each read off the built metal:
//  · the fusee window's reveal CONTAINS the cone's own silhouette (every
//    vertex of `fuseeCone` about the barrel axis) plus one CLEAR_MARGIN — the
//    intent takes the larger of the cone and the chain's edge, and today the
//    chain's edge (6.19) still holds the cone (5.53), so the window frames the
//    whole cone and only its boss ring and three webs cover any of it;
//  · every cone vertex outside the window's boss that the plate still covers
//    lies under one of the three webs — the webs are the only plate inside
//    the reveal;
//  · the ESCAPE WHEEL stands wholly in the opening (no chaton holds it to the
//    plate any more);
//  · the FOURTH WHEEL keeps its upper bearing in the plate: a pivot collar
//    stands at its station in the plate's own group. How much of its rim the
//    escape wheel's rounding shows is REPORTED, as are the heart cam and the
//    reset hammer, which stay under the plate;
//  · the escape cock seated its foot, its stone holds the pivot cut for it
//    (the `trainPivot` ends on the stone's top face, shouldered at least the
//    margin under its underside), its foot screw measures engaged, and at
//    rest the cock keeps CLEAR_MARGIN from the plate, both other cocks, the
//    fork and the fourth wheel it passes over.
// CONTROLS (fatal): the third wheel, which the plate still carries, reads
// covered (a reveal test that cannot see plate passes everything); the
// pallet fork, which the cut has shown since §62, reads clear.
//
// It is NOT probe-115-window: that reads the §62 windows' solve tables and
// the governor's reveal; the kidney cut is not a window and the cock is not
// in any window's report. Boot must be silent (rule 6).
//
//   cd tools && node probe-322-openwork.mjs
//   QUERY='arrangement=designed' node probe-322-openwork.mjs   (a spec point)
import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
const ROOT = process.env.ROOT || join(dirname(fileURLToPath(import.meta.url)), '..');
const port = process.env.PORT || '8521';
const srv = spawn('python3', ['-m', 'http.server', port, '--bind', '127.0.0.1'], { cwd: ROOT, stdio: 'ignore' });
process.on('exit', () => srv.kill());
await new Promise((r) => setTimeout(r, 1000));
const browser = await chromium.launch();
const page = await browser.newPage();
const warns = [];
const stateMiss = [];
page.on('response', (r) => { if (r.status() === 404 && new URL(r.url()).pathname === '/__state') stateMiss.push(1); });
page.on('console', (m) => {
  const t = m.text();
  if (/WebGL|ReadPixels|GPU stall/.test(t)) return;
  if (/Failed to load resource: .*404/.test(t) && stateMiss.length) { stateMiss.pop(); return; }
  if (/Failed to load resource: .*501/.test(t)) return;   // the static server has no PUT for /__state
  if (m.type() === 'warning' || m.type() === 'error') warns.push(t);
});
page.on('pageerror', (e) => warns.push('PAGEERROR ' + String(e)));
await page.goto(`http://127.0.0.1:${port}/index.html${process.env.QUERY ? `?${process.env.QUERY}` : ''}`, { waitUntil: 'load', timeout: 180000 });
await page.waitForFunction(() => !!window.__clock && (!window.__clock.boot || window.__clock.boot.done !== false), null, { timeout: 240000 });
await page.waitForTimeout(1000);

const out = await page.evaluate(async () => {
  const THREE = await import('./vendor/three.module.js');
  const I = await import('./src/inspect.js');
  const L = await import('./src/layout.js');
  const clock = window.__clock;
  const P = clock.P;
  const find = (n) => clock.labelEntries.find((e) => e.name === n);
  const plate = find('Three-quarter plate');
  const plateMeshes = []; plate.obj.traverse((o) => { if (o.isMesh && !o.userData?.schematic) plateMeshes.push(o); });
  const slab = plateMeshes.find((m) => m.name === 'threeQuarterPlate'); slab.updateWorldMatrix(true, true);
  const sb = new THREE.Box3().setFromObject(slab); const zBot = sb.min.z, zTop = sb.max.z;
  const rc = new THREE.Raycaster(); const up = new THREE.Vector3(0, 0, 1); const v = new THREE.Vector3();
  // plate above (x, y)? cast up through the plate's own band from just under it
  const covered = (x, y) => { rc.set(new THREE.Vector3(x, y, zBot - 0.01), up); rc.far = zTop - zBot + 0.1; return rc.intersectObjects(plateMeshes, false).length > 0; };
  // every vertex of a unit (or of one named mesh) under the plate's floor, with its cover
  const verts = (unitName, meshName = null, step = 1) => {
    const e = find(unitName); e.obj.updateWorldMatrix(true, true); const rows = [];
    e.obj.traverse((o) => {
      if (!o.isMesh || o.userData?.schematic || (meshName && o.name !== meshName)) return;
      const pos = o.geometry.attributes.position;
      for (let i = 0; i < pos.count; i += step) {
        v.fromBufferAttribute(pos, i).applyMatrix4(o.matrixWorld);
        if (v.z > zBot) continue;
        rows.push({ x: v.x, y: v.y, z: v.z, covered: covered(v.x, v.y), mesh: o.name || o.geometry.type });
      }
    });
    return rows;
  };
  const frac = (rows) => rows.length ? rows.filter((r) => !r.covered).length / rows.length : null;
  // --- the fusee window
  const win = clock.tqWindows.find((w) => w.name === 'fusee');
  const coneR = (() => { let r = 0; for (const q of verts('Fusee & great wheel', 'fuseeCone')) r = Math.max(r, Math.hypot(q.x - P.barrel.x, q.y - P.barrel.y)); return r; })();
  const coneRows = verts('Fusee & great wheel', 'fuseeCone');
  // a covered cone vertex outside the boss must lie under a web: the sectors' angular gaps
  const webHalf = win.webW / 2;
  const underWeb = (x, y) => {
    const dx = x - win.c.x, dy = y - win.c.y, r = Math.hypot(dx, dy), th = Math.atan2(dy, dx);
    if (r < win.r0 + 1e-6) return true;   // the boss
    if (r > win.wanted - 1e-6) return true;   // outside the reveal
    for (const s of win.sectors) {   // inside a sector's angular run and off both its web edges: open
      let d = th - s.a; d = ((d % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI);
      if (d <= s.b - s.a && r * Math.sin(d) >= webHalf - 1e-6 && r * Math.sin(s.b - s.a - d) >= webHalf - 1e-6) return false;
    }
    return true;
  };
  const coneCoveredOffWeb = coneRows.filter((q) => q.covered && !underWeb(q.x, q.y)).length;
  // --- the kidney cut's tenants
  const escRows = verts('Escape wheel'), heartRows = verts('Heart cam (seconds reset)');
  const thirdRows = verts('Third wheel'), forkRows = verts('Pallet fork');
  const fourthRows = verts('Fourth wheel');
  // the fourth wheel's upper bearing, read off the plate's own group: a pivot collar at its station
  let fourthCollar = Infinity;
  plate.obj.traverse((o) => { if (o.isMesh && o.name === 'pivotCollar') { const w = o.getWorldPosition(new THREE.Vector3()); fourthCollar = Math.min(fourthCollar, Math.hypot(w.x - P.fourth.x, w.y - P.fourth.y)); } });
  const hammerRows = verts('Reset hammer');
  // --- the cock
  const b = clock.escapeCock;
  const cock = find('Escape cock');
  const pivotEnds = {};
  for (const [n, st] of [['Escape wheel', P.escape]]) {
    const e = find(n); e.obj.updateWorldMatrix(true, true);
    let pivTop = -Infinity, staffTop = -Infinity;
    e.obj.traverse((o) => {
      if (!o.isMesh) return;
      const bb = new THREE.Box3().setFromObject(o);
      if (o.name === 'trainPivot' && bb.max.z > pivTop) pivTop = bb.max.z;
      if (o.geometry.type === 'CylinderGeometry' && o.name !== 'trainPivot' && bb.max.z > staffTop && Math.abs(o.geometry.parameters.radiusTop - 0.5) < 1e-9) staffTop = bb.max.z;
    });
    pivotEnds[n] = { pivTop, staffTop };
  }
  const joints = clock.frameJoints().filter((j) => j.joint === 'Escape cock ⇄ base plate');
  const rest = {};
  for (const n of ['Three-quarter plate', 'Fork cock', 'Balance cock', 'Pallet fork', 'Fourth wheel']) rest[n] = I.clearanceAt(clock, 'Escape cock', n);
  return {
    CLEAR_MARGIN: L.CLEAR_MARGIN, zBot, zTop,
    fusee: { wanted: win.wanted, r0: win.r0, webW: win.webW, sectors: win.sectors.length, coneR, coneVerts: coneRows.length, coneFree: frac(coneRows), coneCoveredOffWeb },
    reveal: { escape: frac(escRows), heart: frac(heartRows), fourth: frac(fourthRows), hammer: frac(hammerRows), third: frac(thirdRows), fork: frac(forkRows), fourthCollar },
    cock: b && { foot: { x: b.foot.x, y: b.foot.y, reach: b.foot.reach, deg: b.foot.a * 180 / Math.PI, missed: !!b.foot.missed, short: b.foot.short },
      bot: b.bot, T: b.T, bossR: b.bossR, nodeR: b.nodeR, stoneTopZ: b.stoneTopZ, stoneBotZ: b.stoneBotZ, stoneBore: b.stoneBore, meshes: (() => { let n = 0; cock.obj.traverse((o) => { if (o.isMesh) n++; }); return n; })() },
    pivotEnds, joints: joints.map((j) => ({ at: j.site, engagedMM: j.measuredMM, requiredMM: j.requiredMM })), rest,
  };
});
await browser.close(); srv.kill();

let failed = 0;
const fail = (m) => { failed++; console.log('FAIL ' + m); };
const ok = (m) => console.log('ok   ' + m);
const M = out.CLEAR_MARGIN;
console.log(`§322 openwork — plate band z ${out.zBot.toFixed(3)}..${out.zTop.toFixed(3)}`);
if (warns.length) fail(`boot is not silent: ${warns.length} warning(s)\n  ` + warns.join('\n  ')); else ok('boot silent');
// the fusee window
const f = out.fusee;
console.log(`fusee window: wanted ${f.wanted.toFixed(4)}, cone silhouette ${f.coneR.toFixed(4)} + margin = ${(f.coneR + M).toFixed(4)}; boss r0 ${f.r0.toFixed(3)}, ${f.sectors} sectors, webs ${f.webW.toFixed(3)} wide; cone vertices clear of the plate ${(f.coneFree * 100).toFixed(1)}% of ${f.coneVerts}`);
if (f.wanted < f.coneR + M - 1e-6) fail(`the fusee window's reveal does not contain the cone's silhouette plus the margin (${f.wanted.toFixed(4)} vs ${(f.coneR + M).toFixed(4)})`); else ok(`the fusee window contains the cone (reveal ${f.wanted.toFixed(3)} ≥ silhouette ${f.coneR.toFixed(3)} + ${M}: the chain's edge still sizes it)`);
if (f.coneCoveredOffWeb) fail(`${f.coneCoveredOffWeb} covered cone vertices lie under no web and no boss`); else ok('every covered cone vertex is under a web or the boss');
// the cut's tenants
const r = out.reveal;
console.log(`reveal, clear of the plate: escape wheel ${(r.escape * 100).toFixed(1)}%; under the plate (report): fourth wheel ${(r.fourth * 100).toFixed(1)}% clear (the lens of its rim the escape wheel's rounding shows), heart cam ${(r.heart * 100).toFixed(1)}%, reset hammer ${(r.hammer * 100).toFixed(1)}%; third wheel ${(r.third * 100).toFixed(1)}% [control], pallet fork ${(r.fork * 100).toFixed(1)}% [control]`);
if (r.escape < 1) fail(`the escape wheel is not wholly in the opening (${(r.escape * 100).toFixed(1)}%)`); else ok('the escape wheel stands wholly in the opening');
if (!(r.fourthCollar < 1e-6)) fail(`the fourth wheel has no pivot collar in the plate at its station (nearest ${r.fourthCollar.toFixed(3)} off) — its bearing left the plate`); else ok('the fourth wheel keeps its upper bearing in the plate');
if (!(r.third < 0.5)) fail(`CONTROL: the third wheel reads ${(r.third * 100).toFixed(1)}% clear — the plate carries it; the cover test sees no plate`); else ok('control: the third wheel reads covered');
if (r.fork < 1) fail(`CONTROL: the pallet fork reads ${(r.fork * 100).toFixed(1)}% clear — §62 showed it whole`); else ok('control: the pallet fork reads clear');
// the cock
const b = out.cock;
if (!b) fail('no escape cock on the inspection surface');
else {
  console.log(`escape cock: slab ${b.bot.toFixed(3)}..${(b.bot + b.T).toFixed(3)}, boss r ${b.bossR.toFixed(3)}, foot r ${b.nodeR.toFixed(3)}; foot (${b.foot.x.toFixed(2)}, ${b.foot.y.toFixed(2)}) reach ${b.foot.reach.toFixed(2)} at ${b.foot.deg.toFixed(0)}° (margin ${b.foot.short.toFixed(3)}); ${b.meshes} meshes`);
  if (b.foot.missed) fail('the foot found no seat'); else ok('the foot seated');
  for (const [n, e] of Object.entries(out.pivotEnds)) {
    // shouldered CLEAR_MARGIN under the stone where a staff's worth of run exists, else on the hub's top face, which must then stand at least the margin under the stone
    if (Math.abs(e.pivTop - b.stoneTopZ) > 1e-6) fail(`${n}: its upper pivot ends at ${e.pivTop.toFixed(4)}, the cock's stone top is ${b.stoneTopZ.toFixed(4)}`);
    else if (!(e.staffTop <= b.stoneBotZ - M + 1e-6)) fail(`${n}: its staff shoulders at ${e.staffTop.toFixed(4)}, inside the margin under the stone's underside ${b.stoneBotZ.toFixed(4)}`);
    else ok(`${n}: pivot to the stone's top (${e.pivTop.toFixed(3)}), shouldered ${(b.stoneBotZ - e.staffTop).toFixed(3)} under the stone`);
  }
  if (out.joints.length !== 1) fail(`${out.joints.length} escape cock foot joints declared, 1 wanted`);
  for (const j of out.joints) if (!(j.engagedMM != null && j.engagedMM >= j.requiredMM - 1e-4)) fail(`foot screw at (${j.at.x.toFixed(2)}, ${j.at.y.toFixed(2)}) engages ${j.engagedMM} mm of ${j.requiredMM.toFixed(4)}`);
  if (out.joints.length === 1 && out.joints[0].engagedMM >= out.joints[0].requiredMM - 1e-4) ok(`the foot screw engaged (${out.joints[0].engagedMM.toFixed(4)} mm of ${out.joints[0].requiredMM.toFixed(4)})`);
  for (const [n, d] of Object.entries(out.rest)) {
    const dd = typeof d === 'number' ? d : d?.d ?? d?.min ?? NaN;
    if (!(dd >= M - 1e-6)) fail(`at rest the cock stands ${Number(dd).toFixed(4)} from ${n} (need ${M})`); else ok(`cock ⇄ ${n}: ${dd.toFixed(3)} at rest`);
  }
}
console.log(failed ? `FAIL — ${failed} finding(s)` : 'PASS');
process.exit(failed ? 1 : 0);
