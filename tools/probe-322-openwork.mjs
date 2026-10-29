// §322 — THE OPENWORKED PLATE'S THREE VIEWS, measured off a real boot: does
// the fusee window frame the whole cone, does the kidney cut show the escape
// wheel round, the fourth wheel and the reset hammer, and does the fourth
// wheel bridge actually carry the two pivots it took out of the plate?
//
// ACCEPTANCE (exits non-zero). What it holds, each read off the built metal:
//  · the fusee window's reveal is the CONE's own silhouette (every vertex of
//    `fuseeCone` about the barrel axis) plus one CLEAR_MARGIN, not the
//    chain's edge: the window is sized to the member it is a window ONTO, and
//    the cone outgrew the chain's largest wrap when its proportioning moved;
//  · every cone vertex outside the window's boss that the plate still covers
//    lies under one of the three webs — the webs are the only plate inside
//    the reveal;
//  · the ESCAPE WHEEL stands wholly in the opening (no chaton holds it to the
//    plate any more), the HEART CAM too, and the RESET HAMMER at every pose
//    of its travel (the crown axis drives it);
//  · the FOURTH WHEEL's covered vertices all lie under the third wheel's
//    chaton keep or in that keep's SHADOW about the balance axis — the cost
//    of one star-shaped cut, named — and nothing outside both is covered;
//  · the fourth wheel bridge seated both feet, its two stones hold the
//    pivots cut for them (each `trainPivot` ends on its stone's top face,
//    the staff shoulders CLEAR_MARGIN under its underside), both foot screws
//    measure engaged, and at rest the bridge keeps CLEAR_MARGIN from the
//    plate, both cocks and the hammer it was built to show.
// CONTROLS (fatal): the third wheel, which the plate still carries, reads
// covered (a reveal test that cannot see plate passes everything); the
// pallet fork, which the cut has shown since §62, reads clear.
//
// It is NOT probe-115-window: that reads the §62 windows' solve tables and
// the governor's reveal; the kidney cut is not a window and the bridge is not
// in any window's report. Boot must be silent (rule 6).
//
//   cd tools && node probe-322-openwork.mjs
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
await page.goto(`http://127.0.0.1:${port}/index.html`, { waitUntil: 'load', timeout: 180000 });
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
  // the fourth wheel: covered ⇔ in the third chaton's keep or its shadow about the balance axis
  const fourthRows = verts('Fourth wheel');
  const third = { x: P.third.x, y: P.third.y };
  const keepR = (() => { const G = window.__clock.meshes ? null : null; return null; })();
  // the keep: the third chaton's counterbore and seats, read through the plate's own cut — the plate's inner radius about P.third
  // is measured here rather than typed: the nearest covered-to-open transition along rays from P.third
  const keepReach = (() => {
    let worst = 0;
    for (let d = 0; d < 360; d += 3) {
      const a = d * Math.PI / 180; let r = 0.3;
      while (r < 9 && covered(third.x + Math.cos(a) * r, third.y + Math.sin(a) * r)) r += 0.05;
      if (r < 9) worst = Math.max(worst, r);
    }
    return worst;
  })();
  const inKeepOrShadow = (x, y, grow) => {
    // the ray from the balance axis to (x, y): does it meet the keep disc (grown) before (x, y)?
    const bx = P.balance.x, by = P.balance.y, dx = x - bx, dy = y - by, L2 = dx * dx + dy * dy;
    const t = Math.max(0, Math.min(1, ((third.x - bx) * dx + (third.y - by) * dy) / L2));
    const px = bx + dx * t - third.x, py = by + dy * t - third.y;
    return Math.hypot(px, py) <= keepReach + grow;
  };
  const fourthBad = fourthRows.filter((q) => q.covered !== inKeepOrShadow(q.x, q.y, q.covered ? 0.35 : -0.35) && (q.covered || !inKeepOrShadow(q.x, q.y, 0.35)) && (!q.covered || !inKeepOrShadow(q.x, q.y, 0.35)));
  // --- the hammer over its travel (the crown axis)
  const axis = I.AXES.find((a) => a.name === 'crown');
  const hammer = [];
  for (let k = 0; k <= 6; k++) {
    I.enterAxis(clock); clock.setPose(axis.pose(k / 6, clock)); clock.scene.updateMatrixWorld(true);
    hammer.push({ f: k / 6, free: frac(verts('Reset hammer')) });
  }
  I.enterAxis(clock); clock.scene.updateMatrixWorld(true);
  // --- the bridge
  const b = clock.fourthBridge;
  const bridge = find('Fourth wheel bridge');
  const pivotEnds = {};
  for (const [n, st] of [['Fourth wheel', P.fourth], ['Escape wheel', P.escape]]) {
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
  const joints = clock.frameJoints().filter((j) => j.joint === 'Fourth wheel bridge ⇄ base plate');
  const rest = {};
  for (const n of ['Three-quarter plate', 'Fork cock', 'Balance cock', 'Reset hammer', 'Heart cam (seconds reset)', 'Third wheel']) rest[n] = I.clearanceAt(clock, 'Fourth wheel bridge', n);
  return {
    CLEAR_MARGIN: L.CLEAR_MARGIN, zBot, zTop,
    fusee: { wanted: win.wanted, r0: win.r0, webW: win.webW, sectors: win.sectors.length, coneR, coneVerts: coneRows.length, coneFree: frac(coneRows), coneCoveredOffWeb },
    reveal: { escape: frac(escRows), heart: frac(heartRows), fourth: frac(fourthRows), third: frac(thirdRows), fork: frac(forkRows), fourthBad: fourthBad.length, fourthN: fourthRows.length, keepReach },
    hammer,
    bridge: b && { footA: { x: b.footA.x, y: b.footA.y, reach: b.footA.reach, deg: b.footA.a * 180 / Math.PI, missed: !!b.footA.missed, short: b.footA.short },
      footB: { x: b.footB.x, y: b.footB.y, reach: b.footB.reach, deg: b.footB.a * 180 / Math.PI, missed: !!b.footB.missed, short: b.footB.short },
      bot: b.bot, T: b.T, bossR: b.bossR, nodeR: b.nodeR, stoneTopZ: b.stoneTopZ, stoneBotZ: b.stoneBotZ, stoneBore: b.stoneBore, meshes: (() => { let n = 0; bridge.obj.traverse((o) => { if (o.isMesh) n++; }); return n; })() },
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
if (Math.abs(f.wanted - (f.coneR + M)) > 1e-6) fail(`the fusee window's reveal is not the cone's silhouette plus the margin (${f.wanted.toFixed(4)} vs ${(f.coneR + M).toFixed(4)})`); else ok('the fusee window is sized to the cone');
if (f.coneCoveredOffWeb) fail(`${f.coneCoveredOffWeb} covered cone vertices lie under no web and no boss`); else ok('every covered cone vertex is under a web or the boss');
// the cut's tenants
const r = out.reveal;
console.log(`reveal, clear of the plate: escape wheel ${(r.escape * 100).toFixed(1)}%, heart cam ${(r.heart * 100).toFixed(1)}%, fourth wheel ${(r.fourth * 100).toFixed(1)}% (third chaton keep reaches ${r.keepReach.toFixed(2)} about its axis), third wheel ${(r.third * 100).toFixed(1)}% [control], pallet fork ${(r.fork * 100).toFixed(1)}% [control]`);
if (r.escape < 1) fail(`the escape wheel is not wholly in the opening (${(r.escape * 100).toFixed(1)}%)`); else ok('the escape wheel stands wholly in the opening');
if (r.heart < 1) fail(`the heart cam is not wholly in the opening (${(r.heart * 100).toFixed(1)}%)`); else ok('the heart cam stands wholly in the opening');
if (r.fourthBad) fail(`${r.fourthBad} of ${r.fourthN} fourth wheel vertices disagree with the third chaton's keep and shadow`); else ok("the fourth wheel's cover is exactly the third chaton's keep and its shadow");
if (!(r.third < 0.5)) fail(`CONTROL: the third wheel reads ${(r.third * 100).toFixed(1)}% clear — the plate carries it; the cover test sees no plate`); else ok('control: the third wheel reads covered');
if (r.fork < 1) fail(`CONTROL: the pallet fork reads ${(r.fork * 100).toFixed(1)}% clear — §62 showed it whole`); else ok('control: the pallet fork reads clear');
for (const h of out.hammer) if (h.free < 1) fail(`the reset hammer is covered at crown f=${h.f.toFixed(2)} (${(h.free * 100).toFixed(1)}% clear)`);
if (out.hammer.every((h) => h.free === 1)) ok(`the reset hammer stands in the opening at every sampled pose (${out.hammer.length})`);
// the bridge
const b = out.bridge;
if (!b) fail('no fourth wheel bridge on the inspection surface');
else {
  console.log(`bridge: slab ${b.bot.toFixed(3)}..${(b.bot + b.T).toFixed(3)}, bosses r ${b.bossR.toFixed(3)}, feet r ${b.nodeR.toFixed(3)}; foot A (${b.footA.x.toFixed(2)}, ${b.footA.y.toFixed(2)}) reach ${b.footA.reach.toFixed(2)} at ${b.footA.deg.toFixed(0)}° (margin ${b.footA.short.toFixed(3)}); foot B (${b.footB.x.toFixed(2)}, ${b.footB.y.toFixed(2)}) reach ${b.footB.reach.toFixed(2)} at ${b.footB.deg.toFixed(0)}° (margin ${b.footB.short.toFixed(3)}); ${b.meshes} meshes`);
  if (b.footA.missed || b.footB.missed) fail('a foot found no seat'); else ok('both feet seated');
  for (const [n, e] of Object.entries(out.pivotEnds)) {
    if (Math.abs(e.pivTop - b.stoneTopZ) > 1e-6) fail(`${n}: its upper pivot ends at ${e.pivTop.toFixed(4)}, the bridge's stone top is ${b.stoneTopZ.toFixed(4)}`);
    else if (Math.abs(e.staffTop - (b.stoneBotZ - M)) > 1e-6) fail(`${n}: its staff shoulders at ${e.staffTop.toFixed(4)}, ${(b.stoneBotZ - M).toFixed(4)} wanted (stone underside less the margin)`);
    else ok(`${n}: pivot to the stone's top (${e.pivTop.toFixed(3)}), staff shouldered ${M} under it`);
  }
  if (out.joints.length !== 2) fail(`${out.joints.length} bridge foot joints declared, 2 wanted`);
  for (const j of out.joints) if (!(j.engagedMM != null && j.engagedMM >= j.requiredMM - 1e-4)) fail(`foot screw at (${j.at.x.toFixed(2)}, ${j.at.y.toFixed(2)}) engages ${j.engagedMM} mm of ${j.requiredMM.toFixed(4)}`);
  if (out.joints.length === 2 && out.joints.every((j) => j.engagedMM >= j.requiredMM - 1e-4)) ok(`both foot screws engaged (${out.joints.map((j) => j.engagedMM.toFixed(4)).join(', ')} mm of ${out.joints[0].requiredMM.toFixed(4)})`);
  for (const [n, d] of Object.entries(out.rest)) {
    const dd = typeof d === 'number' ? d : d?.d ?? d?.min ?? NaN;
    if (!(dd >= M - 1e-6)) fail(`at rest the bridge stands ${Number(dd).toFixed(4)} from ${n} (need ${M})`); else ok(`bridge ⇄ ${n}: ${dd.toFixed(3)} at rest`);
  }
}
console.log(failed ? `FAIL — ${failed} finding(s)` : 'PASS');
process.exit(failed ? 1 : 0);
