// CAN THE MOVEMENT ACTUALLY BE CASED — the back bore's insertion profile
// against the rim's measured reach, per z-slice.
//
// ACCEPTANCE (inverted while the defect stands: see EXPECT below). §3's
// construction is BACK-LOADING — "the movement enters from the back" — and
// §186 hung the movement from a rim of measured reach ~50.06 that must
// descend the back bore to its ledge. Nothing instruments that PATH: the
// flange §3 left at the bore mouth (R_FL ≈ 44.86, z ≈ 15.5..18.1) does not
// TOUCH the seated rim, so no pair sweep, no probe-case-relief row and no
// boot assert ever sees it — but the rim cannot pass a 44.86 bore, and a
// case that cannot be assembled is a modelling lie of exactly TODO.md's
// kind, invisible because it lives between poses (in ASSEMBLY, which no
// pose reaches). §187 deletes the flange; this instrument is the number
// that justifies the deletion and, after it, the gate that keeps the path
// open.
//
// WHAT IS MEASURED. For every z-slice above the rim's final back face
// (PLATE_RIM-style measured, not restated), the minimum radial distance of
// case-MIDDLE metal from the axis — the bore the rim must pass at that
// height. The rim descends through every slice above its seat, so the path
// is blocked wherever a slice's bore reads INBOARD of the rim's own
// measured reach — mesh against mesh, because both sides are tessellated:
// the bore wall's 96-gon chords read up to ~0.03 under the authored
// R_BORE_BACK, and holding the path to reach + SEAT_FIT would fail the
// wall itself on its own sagitta (the first cut of this probe did exactly
// that). The DESIGN fit between the authored surfaces is §186's
// PLATE_RIM assert's business; this instrument asks the cruder, binary
// question — does metal stand where the rim must pass — and reports the
// running clearance beside the verdict. Metal at or below the rim's final
// back face is NOT the path's business — that region is the seat itself,
// negotiated by §186's notches and fit asserts and gated by
// probe-case-relief.
//
// EXCLUSIONS, each a claim: the clamp screws (installed AFTER the movement
// is cased — they are what cases it); the lugs, collars and everything
// outboard of the rim's reach (cannot block a descent); the crystal
// assembly (front, other side of the movement); the caseBack assembly
// (removed during casing — taking the back off is what "back-loading"
// means).
//
// EDGES, not vertices: min-r along a straight edge is convex in t, so each
// edge contributes its endpoints, its interior stationary point t* =
// −(a·d)/(d·d), and its crossings of slice boundaries — a lathe wall
// between two profile corners carries no vertex in the slices between
// them, and a vertex scan would report those slices boreless.
//
// Controls: (1) the scan must SEE the bore — some slice must read a finite
// bore within 0.5 u of the §186 bore wall (a run that reads Infinity
// everywhere measured nothing); (2) re-run with the offending MESHES
// excluded by name, the path must read CLEAR — proving the named parts are
// the whole story, not an artifact of the scan.
//
// EXPECT: on the tree §187 starts from, BLOCKED — exit 3 with TWO
// offenders named: §3's flange leg of caseMiddle (bore ~44.86 at
// z ~15.3..18.1) and casePusherBoreSleeve (inboard end ~43.42 at
// z ~5.0..9.8 — §186 kept the pre-§186 standoff for all three tube
// openings, and for the pusher, whose z-band is INSIDE the insertion
// path, that leaves the sleeve hanging across it; the crowns' sleeves sit
// below the rim's back face and are the seat's business, not the path's).
// After §187's Stage 2, CLEAR — exit 0. Any other combination is the scan
// or the tree lying.
//
// Run: node tools/probe-187-casing-path.mjs   (ROOT= for another worktree)
import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
const ROOT = process.env.ROOT || join(dirname(fileURLToPath(import.meta.url)), '..');
const srv = spawn('python3', ['-m', 'http.server', '8517', '--bind', '127.0.0.1'], { cwd: ROOT, stdio: 'ignore' });
await new Promise((r) => setTimeout(r, 1200));
const browser = await chromium.launch();
const page = await browser.newPage();
page.on('pageerror', (e) => console.log('PAGEERROR', String(e)));
await page.goto('http://127.0.0.1:8517/index.html', { waitUntil: 'load', timeout: 120000 });
await page.waitForFunction(() => !!window.__clock, null, { timeout: 120000 });

const res = await page.evaluate(async () => {
  const THREE = await import('three');
  const clock = window.__clock;
  const v = new THREE.Vector3(), a = new THREE.Vector3(), b = new THREE.Vector3();

  // The rim's measured metal — reach and back face, off the plate mesh
  // (TODO 84's rule; PLATE_RIM's own numbers re-derived here so this probe
  // stands alone against any worktree).
  let plate = null; clock.scene.traverse((o) => { if (o.name === 'backPlate' && !plate) plate = o; });
  plate.updateWorldMatrix(true, true);
  let rimReach = 0, rimBack = -Infinity;
  {
    const p = plate.geometry.attributes.position;
    for (let i = 0; i < p.count; i++) {
      plate.localToWorld(v.fromBufferAttribute(p, i));
      const r = Math.hypot(v.x, v.y);
      if (r > rimReach) rimReach = r;
      if (v.z > rimBack) rimBack = v.z;
    }
  }

  // The case middle's meshes — the metal the descent must pass. Named
  // exclusions per the header; a name that matches nothing in the middle
  // assembly throws (a stale roster reports a clean scan of no work).
  let caseGrp = null; clock.scene.traverse((o) => { if (o.name === 'case' && !caseGrp) caseGrp = o; });
  if (!caseGrp) throw new Error('no case group in the scene');
  const middle = caseGrp.userData.assemblies.middle;
  const EXCLUDE = ['caseClampScrew', 'caseLug', 'caseSpringBar',
    'caseCrownTubeCollar', 'caseAlarmTubeCollar'];
  const seen = new Set();
  const meshes = [];
  middle.updateWorldMatrix(true, true);
  middle.traverse((o) => {
    if (!o.isMesh || o.userData.schematic || !o.geometry?.attributes?.position) return;
    if (EXCLUDE.includes(o.name)) { seen.add(o.name); return; }
    meshes.push(o);
  });
  const stale = EXCLUDE.filter((n) => !seen.has(n));
  if (stale.length) throw new Error(`exclusion names matched nothing: ${stale.join(', ')}`);

  // z-slices from the rim's final back face to the top of the middle.
  let zTop = -Infinity;
  const box = new THREE.Box3();
  for (const m of meshes) { box.setFromObject(m); if (box.max.z > zTop) zTop = box.max.z; }
  const NS = 96;
  const z0 = rimBack, z1 = zTop + 1e-6;
  const boreOf = new Array(NS).fill(Infinity);
  const ownerOf = new Array(NS).fill(null);
  const sliceOf = (z) => Math.min(NS - 1, Math.max(0, Math.floor((z - z0) / (z1 - z0) * NS)));
  const zAt = (s) => z0 + (s / NS) * (z1 - z0);

  const scan = (exclBandLo = null, exclBandHi = null, bores, owners) => {
    for (const o of meshes) {
      const pos = o.geometry.attributes.position, idx = o.geometry.index;
      const n = idx ? idx.count : pos.count;
      for (let t = 0; t < n; t += 3) {
        for (let e = 0; e < 3; e++) {
          const i0 = idx ? idx.getX(t + e) : t + e;
          const i1 = idx ? idx.getX(t + (e + 1) % 3) : t + (e + 1) % 3;
          a.fromBufferAttribute(pos, i0); o.localToWorld(a);
          b.fromBufferAttribute(pos, i1); o.localToWorld(b);
          // sample parameters: endpoints, the radial minimum, each slice
          // boundary the edge crosses
          const dx = b.x - a.x, dy = b.y - a.y, dz = b.z - a.z;
          const dd = dx * dx + dy * dy;
          const ts = [0, 1];
          if (dd > 1e-12) {
            const tStar = -(a.x * dx + a.y * dy) / dd;
            if (tStar > 0 && tStar < 1) ts.push(tStar);
          }
          if (Math.abs(dz) > 1e-12) {
            const sLo = sliceOf(Math.min(a.z, b.z)), sHi = sliceOf(Math.max(a.z, b.z));
            for (let s = sLo; s <= sHi + 1; s++) {
              const tc = (zAt(s) - a.z) / dz;
              if (tc > 0 && tc < 1) ts.push(tc);
            }
          }
          for (const tp of ts) {
            const z = a.z + tp * dz;
            if (z < z0 || z >= z1) continue;
            if (exclBandLo !== null && z >= exclBandLo && z <= exclBandHi) continue;
            const r = Math.hypot(a.x + tp * dx, a.y + tp * dy);
            const s = sliceOf(z);
            if (r < bores[s]) { bores[s] = r; owners[s] = o.name || '(anon)'; }
          }
        }
      }
    }
  };
  scan(null, null, boreOf, ownerOf);

  // The path verdict: a slice BLOCKS when its bore reads inboard of the
  // rim's own measured reach (mesh vs mesh; 1e-3 of float grace). Blocked
  // slices are grouped into contiguous BANDS, each with its owners.
  const blocked = [];
  for (let s = 0; s < NS; s++) if (boreOf[s] < rimReach - 1e-3) blocked.push(s);
  const bands = [];
  for (const s of blocked) {
    const last = bands[bands.length - 1];
    if (last && s === last.s1 + 1) { last.s1 = s; last.owners.add(ownerOf[s]); last.bore = Math.min(last.bore, boreOf[s]); }
    else bands.push({ s0: s, s1: s, owners: new Set([ownerOf[s]]), bore: boreOf[s] });
  }
  // Control 2: exclude the offending meshes BY NAME and re-scan — the rest
  // of the middle must leave the path clear, or the named parts are not the
  // whole story.
  const offenderNames = new Set();
  for (const b of bands) for (const n of b.owners) offenderNames.add(n);
  let clearWithoutOffenders = null;
  if (bands.length) {
    const keep = meshes.filter((m) => !offenderNames.has(m.name || '(anon)'));
    const saved = meshes.slice();
    meshes.length = 0; meshes.push(...keep);
    const bores2 = new Array(NS).fill(Infinity), owners2 = new Array(NS).fill(null);
    scan(null, null, bores2, owners2);
    meshes.length = 0; meshes.push(...saved);
    clearWithoutOffenders = Math.min(...bores2.map((x) => x));
  }
  let minBore = Infinity, minAt = null;
  for (let s = 0; s < NS; s++) if (boreOf[s] < minBore) { minBore = boreOf[s]; minAt = s; }
  return {
    rimReach, rimBack, zTop, NS,
    slices: boreOf.map((r, s) => ({ z: zAt(s), bore: r === Infinity ? null : r, owner: ownerOf[s] }))
      .filter((x) => x.bore !== null),
    minBore, minAt: minAt === null ? null : zAt(minAt),
    bands: bands.map((b) => ({ zLo: zAt(b.s0), zHi: zAt(b.s1 + 1), bore: b.bore, owners: [...b.owners] })),
    clearWithoutOffenders,
  };
});

const MM = 0.378947;
console.log(`rim measured: reach ${res.rimReach.toFixed(4)}, back face z ${res.rimBack.toFixed(3)}; middle top z ${res.zTop.toFixed(3)}; ${res.NS} slices\n`);
console.log('INSERTION-PATH BORE (z-slice → tightest middle metal, owner):');
let last = null;
for (const s of res.slices) {
  const key = `${s.bore.toFixed(3)} ${s.owner}`;
  if (key === last) continue; // collapse runs
  console.log(`  z ${s.z.toFixed(2).padStart(7)}  bore r ${s.bore.toFixed(3).padStart(8)}  ${s.owner}`);
  last = key;
}
let ok = true;
if (res.slices.length === 0 || !res.slices.some((s) => Math.abs(s.bore - 50.14) < 0.5)) {
  ok = false;
  console.log('\nCONTROL FAIL: no slice reads a bore near the §186 back-bore wall (~50.14) — the scan measured nothing it can vouch for');
} else {
  console.log('\nCONTROL PASS: the back bore wall is seen by the scan');
}
if (res.bands.length) {
  console.log(`\nBLOCKED — ${res.bands.length} band(s) of middle metal stand inboard of the rim's reach ${res.rimReach.toFixed(4)}:`);
  for (const b of res.bands)
    console.log(`  z ${b.zLo.toFixed(2)}..${b.zHi.toFixed(2)}  bore r ${b.bore.toFixed(3)}  ` +
      `${(res.rimReach - b.bore).toFixed(3)} u = ${((res.rimReach - b.bore) * MM).toFixed(2)} mm into the rim's path  [${b.owners.join(', ')}]`);
  console.log('The movement cannot be cased.');
  if (res.clearWithoutOffenders !== null) {
    if (res.clearWithoutOffenders >= res.rimReach - 1e-3)
      console.log(`CONTROL PASS: with the named offender meshes excluded the path is clear (tightest ${res.clearWithoutOffenders.toFixed(3)}) — the named parts are the whole story`);
    else { ok = false; console.log(`CONTROL FAIL: even without the named offenders the path reads ${res.clearWithoutOffenders.toFixed(3)} — the report is incomplete; distrust it`); }
  }
  await browser.close(); srv.kill();
  process.exit(ok ? 3 : 2);
} else {
  console.log(`\nCLEAR: tightest bore ${res.minBore.toFixed(3)} at z ${res.minAt === null ? '—' : res.minAt.toFixed(2)} ≥ rim reach ${res.rimReach.toFixed(4)} — the movement cases. `
    + `(Running clearance ${(res.minBore - res.rimReach).toFixed(3)} u; the authored design fit is §186's PLATE_RIM assert.)`);
  await browser.close(); srv.kill();
  process.exit(ok ? 0 : 2);
}
