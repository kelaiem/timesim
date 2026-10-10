// THE HEIGHT LEDGER'S HARNESS — one boot measured for the cased-depth chains,
// copied-tree mutants, and the ledger itself (front and back chains, the
// back-most metal and its slack), as a module. Not a probe: it measures nothing
// on its own.
//
// It exists so that the two instruments reading the stack read it with ONE law.
// probe-261-height-ledger.mjs (acceptance: the ledger reproduces the build and
// predicts its mutants) and probe-261-lever-prices.mjs (report: what each
// compaction lever buys in cased millimetres) both import it. A second copy of
// backChain() in the price probe would be the "whole law written twice" defect
// CLAUDE.md's TODO 115 entry records, with the longer fuse: the two would agree
// until the case's chain moved, and then price levers against a chain the
// acceptance probe no longer believed in.
//
// Usage: import { boot, mutantTree, ledger, backChain, backMost, envMaxOver }
//        from './height-ledger.mjs'. ROOT= selects another tree, as in the probes.
import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import { mkdtempSync, cpSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

export const ROOT = process.env.ROOT || join(dirname(fileURLToPath(import.meta.url)), '..');
let port = 8561;
const servers = [];
process.on('exit', () => { for (const s of servers) try { s.kill(); } catch {} });
/** Start the next boot's server on a port of the caller's choosing (two probes run at once must not share). */
export function setPortBase(p) { port = p; }

// ---------------------------------------------------------------------------
// One boot, measured. Everything the ledger needs, and nothing derived yet —
// the derivation runs in Node over these numbers so the mutants are predicted
// by the same code that reads the base.
export const MEASURE = async () => {
  const THREE = await import('three');
  const L = await import('./src/layout.js');
  const clock = window.__clock;
  clock.resetInputs?.();
  clock.scene.updateMatrixWorld(true);
  const v = new THREE.Vector3();
  const caseRoot = clock.scene.getObjectByName('case');
  const inCase = (o) => { for (let p = o; p; p = p.parent) if (p === caseRoot) return true; return false; };
  // z extents per mesh NAME over the case, every vertex (the case's lathes
  // carry few vertices, and a face IS a vertex ring on a lathe).
  const caseParts = {};
  caseRoot.traverse((o) => {
    if (!o.isMesh || o.userData.schematic || !o.geometry?.attributes?.position) return;
    const p = o.geometry.attributes.position;
    const e = caseParts[o.name || '(unnamed)'] ??= { zMin: Infinity, zMax: -Infinity, n: 0 };
    e.n++;
    for (let i = 0; i < p.count; i++) {
      o.localToWorld(v.fromBufferAttribute(p, i));
      if (v.z < e.zMin) e.zMin = v.z; if (v.z > e.zMax) e.zMax = v.z;
    }
  });
  // The movement's front-most metal, by mesh, over every labelled unit but
  // the case. Every vertex: a hand's boss is a short cylinder whose front IS
  // its end ring.
  let front = { z: Infinity, mesh: null, unit: null };
  const units = [];
  for (const e of clock.labelEntries) {
    if (inCase(e.obj)) continue;
    let zMin = Infinity, zMax = -Infinity;
    e.obj.traverse((o) => {
      if (!o.isMesh || o.userData.schematic || !o.geometry?.attributes?.position) return;
      const p = o.geometry.attributes.position;
      for (let i = 0; i < p.count; i++) {
        o.localToWorld(v.fromBufferAttribute(p, i));
        if (v.z < zMin) zMin = v.z; if (v.z > zMax) zMax = v.z;
        if (v.z < front.z) front = { z: v.z, mesh: o.name || '(unnamed)', unit: e.name };
      }
    });
    if (zMin < Infinity) units.push({ name: e.name, zMin, zMax });
  }
  // §39's own boxes, reproduced exactly as main.js takes them: the movement
  // is every child of the case's parent but the case and its line tier; the
  // cased box adds the case solid.
  const movBox = new THREE.Box3();
  for (const c of caseRoot.parent.children) if (c !== caseRoot && c.name !== 'caseLines') movBox.expandByObject(c);
  const casedBox = movBox.clone().expandByObject(caseRoot);
  const env = clock.backEnvelope;
  return {
    L: { CLEAR_MARGIN: L.CLEAR_MARGIN, UNIT_MM: L.UNIT_MM, CASE_CRYSTAL_T: L.CASE_CRYSTAL_T,
      CASE_CRYSTAL_CLEAR: L.CASE_CRYSTAL_CLEAR, CASE_WIDTH_MAX: L.CASE_WIDTH_MAX, CASE_BAND_T: L.CASE_BAND_T,
      Z_DIAL: L.Z_DIAL, Z_DIAL_FACE: L.Z_DIAL_FACE, BACK_PLATE_T: L.BACK_PLATE_T, Z_KEYLESS: L.Z_KEYLESS,
      L_BARREL: L.L_BARREL, L_FOURTH: L.L_FOURTH, L_BALANCE: L.L_BALANCE, SPRING_TOP_Z: L.SPRING_TOP_Z,
      COCK_SLAB_TOP: L.COCK_SLAB_TOP },
    caseParts, front, units,
    box39: { mov: [movBox.min.z, movBox.max.z], cased: [casedBox.min.z, casedBox.max.z] },
    env: { bins: env.bins, regions: env.regions, allowances: env.allowances, unitBins: env.unitBins ?? null },
    glass: { ...clock.backGlass },
  };
};

export async function boot(dir = ROOT) {
  const p0 = port++;
  const srv = spawn('python3', ['-m', 'http.server', String(p0), '--bind', '127.0.0.1'], { cwd: dir, stdio: 'ignore' });
  servers.push(srv);
  await new Promise((r) => setTimeout(r, 1200));
  const browser = await chromium.launch();
  const warns = [];
  try {
    const page = await browser.newPage();
    page.on('console', (m) => { if (m.type() === 'warning' && !/WebGL|GPU stall|GroupMarker/.test(m.text())) warns.push(m.text()); });
    page.on('pageerror', (e) => warns.push('PAGEERROR ' + String(e)));
    await page.goto(`http://127.0.0.1:${p0}/index.html`, { waitUntil: 'load', timeout: 180000 });
    await page.waitForFunction(() => !!window.__clock || !!window.__bootError, null, { timeout: 180000 });
    const bootError = await page.evaluate(() => window.__bootError ? String(window.__bootError) : null);
    if (bootError) throw new Error('boot failed: ' + bootError);
    const m = await page.evaluate(`(${MEASURE.toString()})()`);
    return { ...m, warns };
  } finally { await browser.close(); srv.kill(); }
}

/**
 * Copy the tree and apply PATCHES, each { file, find, to }. Every anchor must
 * match exactly once and every patch must change its file: a patch that moved
 * nothing would boot an unmutated tree and report it as a mutant.
 */
export function mutantTree(patches) {
  const dir = mkdtempSync(join(tmpdir(), 'ledger261-'));
  cpSync(ROOT, dir, { recursive: true, dereference: true,
    filter: (s) => !/(^|[\\/])(\.git|node_modules|\.battery-out|\.claude|timelapse)([\\/]|$)/.test(s) });
  for (const { file, find, to } of patches) {
    const target = join(dir, file);
    const before = readFileSync(target, 'utf8');
    const hits = before.split(find).length - 1;
    if (hits !== 1) throw new Error(`mutation anchor matched ${hits} times in ${file}, needs exactly 1 — the patch is stale: ${find.slice(0, 80)}`);
    const after = before.replace(find, to);
    if (after === before) throw new Error('mutation left the file unchanged — it would have tested nothing');
    writeFileSync(target, after);
  }
  return dir;
}

// ---------------------------------------------------------------------------
// The ledger: a pure function of one boot's measurements (and, for a
// prediction, of an edited copy of its envelope).
export function envMaxOver(bins, r0, r1) {
  let z = -Infinity, owner = null;
  for (const b of bins) if (b.z !== null && b.r1 > r0 && b.r0 < r1 && b.z > z) { z = b.z; owner = b.owner; }
  return { z, owner };
}
export function backChain(m, bins, eng, ringRise, keyRise) {
  const { CLEAR_MARGIN: CM, CASE_WIDTH_MAX, CASE_BAND_T, CASE_CRYSTAL_T } = m.L;
  const R_BORE_BACK = CASE_WIDTH_MAX - CASE_BAND_T;
  const annulus = envMaxOver(bins, m.glass.skirtID, R_BORE_BACK);
  const clampTop = m.caseParts.caseClampScrew?.zMax ?? -Infinity;
  const skirtBand = annulus.z >= clampTop ? { z: annulus.z, by: `envelope r ${m.glass.skirtID.toFixed(2)}–${R_BORE_BACK.toFixed(2)}: ${annulus.owner}` }
    : { z: clampTop, by: 'the clamp screws\' heads (measured)' };
  const skirtBot = skirtBand.z + CM;
  const outboard = envMaxOver(bins, m.glass.apertureR - 2 * CM, CASE_WIDTH_MAX);
  const paneFloor = outboard.z + CM;
  const skirtArm = skirtBot + eng;
  const midBack = Math.max(skirtArm, paneFloor);
  const all = envMaxOver(bins, 0, CASE_WIDTH_MAX);
  const stepUnder = all.z + CM;
  const z0 = midBack + ringRise;
  return {
    skirtBand, skirtBot, outboard, paneFloor, skirtArm, midBack,
    midBy: skirtArm >= paneFloor ? 'skirt arm (skirt bottom + thread engagement)' : `pane floor (outboard of the aperture: ${outboard.owner})`,
    midSlack: Math.abs(skirtArm - paneFloor),
    stepUnder, stepBy: all.owner, stepTop: stepUnder + CASE_CRYSTAL_T,
    z0, keysTop: z0 + keyRise,
  };
}
// The back-most metal: the faces that ride the chain, and every other case
// part at its own measured top (those do not ride it).
export const RIDES = new Set(['caseBack', 'caseBackKey', 'caseBackCrystal', 'caseBackCrystalGasket', 'caseGasket']);
export function backMost(m, chain, base) {
  const cands = [
    { by: 'the ring\'s wrench keys (caseBackKey)', z: chain.keysTop },
    { by: 'the raised glass step (caseBackCrystal)', z: chain.stepTop },
    { by: 'the ring face (caseBack)', z: chain.z0 },
  ];
  for (const [name, e] of Object.entries(base.caseParts)) if (!RIDES.has(name)) cands.push({ by: name, z: e.zMax });
  cands.sort((a, b) => b.z - a.z);
  return { top: cands[0], next: cands[1], slack: cands[0].z - cands[1].z };
}
export function ledger(m) {
  const g = m.glass;
  const eng = g.paneInner - g.skirtBot;                 // implied; held constant across mutants below
  const ringRise = m.caseParts.caseBack.zMax - g.paneInner;
  const keyRise = (m.caseParts.caseBackKey?.zMax ?? m.caseParts.caseBack.zMax) - m.caseParts.caseBack.zMax;
  const back = backChain(m, m.env.bins, eng, ringRise, keyRise);
  const frontCase = Math.min(...Object.values(m.caseParts).map((e) => e.zMin));
  const frontName = Object.entries(m.caseParts).find(([, e]) => e.zMin === frontCase)[0];
  const bm = backMost(m, back, m);
  return { eng, ringRise, keyRise, back, bm, frontCase, frontName,
    depth: bm.top.z - frontCase };
}


/**
 * Re-fold the back envelope from the per-unit maxima the build's own walk
 * recorded (__clock.backEnvelope.unitBins, §261), leaving out EXCLUDE (unit
 * names) and their declared swept regions — the envelope as it would stand
 * with those units gone. With EXCLUDE empty it must reproduce the shipped bins;
 * probe-261-lever-prices holds that before it prices anything with it.
 */
export function foldEnvelope(env, exclude = []) {
  const skip = new Set(exclude);
  const n = env.bins.length, rSpan = env.bins[n - 1].r1;
  const bins = env.bins.map((b) => ({ r0: b.r0, r1: b.r1, z: null, owner: null }));
  for (const [u, arr] of Object.entries(env.unitBins)) {
    if (skip.has(u)) continue;
    arr.forEach((z, s) => { if (z !== null && (bins[s].z === null || z > bins[s].z)) { bins[s].z = z; bins[s].owner = u; } });
  }
  for (const reg of env.regions) {
    if (skip.has(reg.unit)) continue;
    const sLo = Math.max(0, Math.floor(reg.r0 / rSpan * n)), sHi = Math.min(n - 1, Math.ceil(reg.r1 / rSpan * n) - 1);
    for (let s = sLo; s <= sHi; s++) if (bins[s].z === null || reg.z > bins[s].z) { bins[s].z = reg.z; bins[s].owner = `${reg.unit} (declared swept region)`; }
  }
  return bins;
}
