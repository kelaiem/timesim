// WHAT DOES IT COST, IN POSITION SPACE, TO CUT A PAIR AS CONICAL GEARS?
// Report, browser, on the shipped tree. Prices a spur-or-sheared member's
// replacement by `makeConicalGear` BEFORE any of it is cut, which is CLAUDE.md's
// order of work: prove the group at P0 in free space, then hunt the packaging at
// P3 with the mechanism's dimensions held fixed. Answers, per member: what the
// metal occupies TODAY in its own frame and in world; what the conical blank
// would occupy at the same apex; and whether that reaches anywhere the old one
// did not — a shrink is nearly free, a GROWTH is a P3 conflict to solve by
// moving a station, never by trimming a tooth.
//
// It also prices the STATION, because for a crossed-axis pair the two are one
// question. Two cones on a shared apex put the member's centre at R·cos γ from
// that apex, and for Σ = 90° that reduces to `module·z_mate/2` — the MATE's
// pitch radius. A row declaring a current separation that differs is quoting
// the correction the fold has to make.
//
// IT DECLARES ITS SUBJECTS RATHER THAN DISCOVERING THEM, and that is the repair
// this file needed. It used to find its subjects by `userData.solid.shearZ` —
// the shear-cone declaration — and when TODO 138 Landing 2 retired that builder
// the probe went on running and printed "0 bevel gear(s) in the metal", a clean
// report of no work at all. A discovered population can empty itself silently;
// a declared one cannot, so an unmatched row is a FAILURE here and an empty
// table refuses.
//
// cd tools && node probe-138-fold-price.mjs
import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
const ROOT = process.env.ROOT || join(dirname(fileURLToPath(import.meta.url)), '..');
const PORT = Number(process.env.PORT || 8519);
const srv = spawn('python3', ['-m', 'http.server', String(PORT), '--bind', '127.0.0.1'], { cwd: ROOT, stdio: 'ignore' });
process.on('exit', () => srv.kill());
await new Promise((r) => setTimeout(r, 1200));
const browser = await chromium.launch();
const page = await browser.newPage();
page.on('pageerror', (e) => console.log('PAGEERROR', String(e)));
await page.goto(`http://127.0.0.1:${PORT}/index.html`, { waitUntil: 'load', timeout: 90000 });
await page.waitForFunction(() => !!window.__clock, null, { timeout: 90000 });

const out = await page.evaluate(async () => {
  const THREE = await import('three');
  const G = await import('./src/geometry.js');
  const C = window.__clock;

  // TODO 136's four: two crossed pairs carrying the keyless works, cut today as
  // FLAT SPUR wheels with one member of each turned 90°. Counts and module are
  // layout.js's (KW_MODULE 0.34; crown and setting 20 t, pinion and clutch rim
  // 8 t), named here so a change there shows up as a diff.
  const ROWS = [
    { name: 'crownWheel', mate: 'windingPinion', teeth: 20, mateTeeth: 8, module: 0.34, bore: 0.7 },
    { name: 'windingPinion', mate: 'crownWheel', teeth: 8, mateTeeth: 20, module: 0.34, bore: 0.7 },
    { name: 'settingWheel', mate: 'clutchRim', teeth: 20, mateTeeth: 8, module: 0.34, bore: 0.7 },
    { name: 'clutchRim', mate: 'settingWheel', teeth: 8, mateTeeth: 20, module: 0.34, bore: 0.7 },
  ];

  // A MEMBER IS A GROUP OF MESHES, not one mesh, and pricing its envelope means
  // unioning them. The first version of this took the last mesh matching the
  // name and priced the crown wheel at r 1.12 — its HUB — against a 3.52 cone,
  // and reported the fold "reaching further out" on the strength of it. A
  // 20-tooth wheel at module 0.34 has a tip near 3.6, which is what said so.
  const find = (name) => {
    let grp = null;
    C.scene.traverse((o) => { if (o.name === name && o.children && o.children.length) grp = o; });
    if (!grp) {
      let m = null;
      C.scene.traverse((o) => { if (o.isMesh && o.name === name) m = o; });
      return m ? { root: m, meshes: [m] } : null;
    }
    const meshes = [];
    grp.traverse((o) => { if (o.isMesh && o.geometry && o.geometry.attributes.position) meshes.push(o); });
    return meshes.length ? { root: grp, meshes } : null;
  };

  const rows = [];
  for (const r of ROWS) {
    const hit = find(r.name);
    if (!hit) { rows.push({ ...r, missing: true }); continue; }
    hit.root.updateMatrixWorld(true);
    // local extent in the MEMBER's own frame, unioned over its meshes
    const inv = new THREE.Matrix4().copy(hit.root.matrixWorld).invert();
    const lb = new THREE.Box3(), wb = new THREE.Box3();
    const v = new THREE.Vector3();
    for (const m of hit.meshes) {
      wb.union(new THREE.Box3().setFromObject(m));
      const pos = m.geometry.attributes.position;
      const toRoot = new THREE.Matrix4().multiplyMatrices(inv, m.matrixWorld);
      for (let i = 0; i < pos.count; i++) lb.expandByPoint(v.fromBufferAttribute(pos, i).applyMatrix4(toRoot));
    }
    const o = (v2) => +v2.toFixed(4);
    r.meshCount = hit.meshes.length;
    // the conical replacement, from the same counts, with the face width the
    // generator derives (coneR/3, the classical blank proportion)
    const sp = G.bevelToothSpec({ module: r.module, teeth: r.teeth, mateTeeth: r.mateTeeth, boreR: r.bore });
    const gcone = G.makeConicalGear({ teeth: r.teeth, module: r.module, mateTeeth: r.mateTeeth, boreR: r.bore });
    const cb = new THREE.Box3().setFromObject(gcone);
    rows.push({
      ...r,
      meshCount: r.meshCount,
      oldLocalR: o(Math.max(Math.abs(lb.min.x), lb.max.x, Math.abs(lb.min.y), lb.max.y)),
      oldLocalZ: [o(lb.min.z), o(lb.max.z)],
      worldMin: [o(wb.min.x), o(wb.min.y), o(wb.min.z)],
      worldMax: [o(wb.max.x), o(wb.max.y), o(wb.max.z)],
      newLocalR: o(Math.max(Math.abs(cb.min.x), cb.max.x, Math.abs(cb.min.y), cb.max.y)),
      newLocalZ: [o(cb.min.z), o(cb.max.z)],
      // WHERE THE TEETH ARE, separately from the blank that carries them. The
      // toothed band is ρ ∈ [coneRi, coneR] over θ ∈ [θ_root, θ_tip], so its axial
      // reach is coneRi·cos θ_tip … coneR·cos θ_root. The BLANK reaches further
      // because its web runs inboard at constant cone distance, down to where
      // the bore cuts it at √(coneR² − bore²) — which for a shallow cone is a
      // deep dish rather than the flat plate a face gear actually is. Reporting
      // both is what separates "the teeth do not fit" from "the web does not".
      bandZ: [o(sp.coneRi * Math.cos(sp.thetaTip)), o(sp.coneR * Math.cos(sp.thetaRoot))],
      boreZ: o(sp.zBoreOut),
      gammaDeg: o((sp.gamma * 180) / Math.PI),
      coneR: o(sp.coneR), faceW: o(sp.faceW),
      // WHERE THE MEMBER'S CENTRE MUST STAND from the pair's shared apex
      stationFromApex: o(sp.coneR * Math.cos(sp.gamma)),
      matePitchR: o((r.module * r.mateTeeth) / 2),
    });
  }
  return { rows };
});
await browser.close(); srv.kill();

const R = out.rows;
const missing = R.filter((r) => r.missing);
if (!R.length) { console.log('THE TABLE IS EMPTY — nothing was priced. This is a refusal, not a clean report.'); process.exit(1); }

console.log(`${R.length} member(s) declared, ${R.length - missing.length} found in the metal\n`);
console.log('member           teeth  γ°      coneR   face    old r    new r    Δr       verdict');
for (const r of R) {
  if (r.missing) { console.log(`${r.name.padEnd(16)} ✗ NOT IN THE METAL — a declared row that matched nothing`); continue; }
  const d = r.newLocalR - r.oldLocalR;
  console.log(`${r.name.padEnd(16)} ${String(r.teeth).padEnd(6)} ${String(r.gammaDeg).padEnd(7)} ${String(r.coneR).padEnd(7)} `
    + `${String(r.faceW).padEnd(7)} ${String(r.oldLocalR).padEnd(8)} ${String(r.newLocalR).padEnd(8)} `
    + `${d.toFixed(3).padStart(7)}  ${d <= 0 ? 'inside the old rim' : '✗ REACHES FURTHER OUT — site it, do not trim it'}`);
}

console.log('\nAXIAL EXTENT, in the member\'s own frame — a spur disc straddles its plane, a cone does NOT\n');
console.log('member           old z            blank z          TEETH z          web reaches');
for (const r of R) {
  if (r.missing) continue;
  const teethSpan = (r.bandZ[1] - r.bandZ[0]).toFixed(3);
  console.log(`${r.name.padEnd(16)} ${`${r.oldLocalZ[0]}…${r.oldLocalZ[1]}`.padEnd(16)} `
    + `${`${r.newLocalZ[0]}…${r.newLocalZ[1]}`.padEnd(16)} `
    + `${`${r.bandZ[0]}…${r.bandZ[1]}`.padEnd(16)} `
    + `${r.boreZ} at the bore   (teeth only ${teethSpan} thick)`);
}

console.log('\nTHE STATION — a member\'s centre stands R·cos γ from the pair\'s shared apex,\nwhich at Σ = 90° is the MATE\'s pitch radius\n');
console.log('member           R·cos γ   mate pitch r   agree');
for (const r of R) {
  if (r.missing) continue;
  const ok = Math.abs(r.stationFromApex - r.matePitchR) < 1e-3;
  console.log(`${r.name.padEnd(16)} ${String(r.stationFromApex).padEnd(9)} ${String(r.matePitchR).padEnd(14)} ${ok ? 'yes' : '✗ NO'}`);
}

console.log(`\n${missing.length} declared row(s) matched nothing`
  + (missing.length ? ' — the table is stale, and that is a failure, not a clean run' : ''));
process.exit(missing.length ? 1 : 0);
