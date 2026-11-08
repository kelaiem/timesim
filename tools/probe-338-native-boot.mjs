#!/usr/bin/env node
// §338 landing 1 — DOES THE NATIVE HOST BUILD THE SAME MOVEMENT AS THE BROWSER?
//
// Acceptance (exits non-zero on a failed gate). For each spec below it boots
// the tree twice: in headless Chromium the way the battery does
// (battery-checks.mjs' virginBoot + prepPage), and in the native host
// (tools/native/host.mjs, a child Node process, because main.js is a module and
// evaluates once per process). Then:
//
//   GATES   both boots silent (standing rule 6);
//           one spec roster and one parsed spec (src/spec-fields.js) in both;
//           the §52 fingerprint identical across the hosts;
//           §152's PLACE agrees for every unit at the digest's own resolution: the
//           quantized hash equal, or, where a coordinate straddles a cell edge, every
//           world matrix at every digest pose within one 1/DIGEST_PLACE_Q cell
//           (a last-ulp difference at an ill-conditioned pose can cross an edge
//           while the metal stands in the same place; the straddles are reported).
//   CONTROLS the native DEFAULT build's fingerprint must DIFFER from Chromium's
//           build of the other spec, so equality is something this comparison
//           can fail to find, and the spec demonstrably reaches each host's build.
//           And the PLACE tolerance is held the same way: those two different builds
//           must part by more than a cell somewhere, and a planted two-cell move in
//           one coordinate must be caught.
//           And a native boot with the ENGINE's Math (host option detMath: false)
//           must differ from Chromium in SHAPE and warn at boot, or the SHAPE gate
//           would be passing on something other than the maths.
//   GATES, since §338 landing 2: deterministic maths installed in both (each
//           host's __detMath: installed, and its boot known answers reproduce);
//           and §152's SHAPE digest identical for every unit. Landing 1 could
//           only REPORT SHAPE: the hosts' V8 versions disagreed in the last ulp
//           of transcendentals (coordinates ~1e-17 apart, a few meshes with a
//           different vertex count), and the page's frames reordered index
//           buffers by building bounds trees. Landing 2 installs src/det-math.js
//           and hashes the index as a triangle SET, and SHAPE gates. A unit that
//           differs is still classified, as the diagnosis:
//             index-order  positions and triangle set agree, only the order
//                          differs (cannot happen with the set hash: a digest
//                          bug if it does);
//             positions    the vertex count agrees and coordinates differ (max
//                          |Δ| printed): arithmetic that is still the engine's;
//             topology     a mesh's vertex count differs: a construction
//                          decision went the other way on such a difference.
//
//   node tools/probe-338-native-boot.mjs [--json FILE]   (~2 min; boots run in parallel)
//
// --json writes, per spec and host, the fingerprint, every unit's SHAPE and
// PLACE digest and the boot known answers, plus the platform: the input
// tools/compare-338-hosts.mjs holds equal ACROSS machines (native-host.yml's
// x64 and arm64 legs).
import { execFileSync, spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { createServer } from 'node:net';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { prepPage, virginBoot } from './battery-checks.mjs';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const SPECS = ['', 'arrangement=designed'];   // the identity, and ci-battery's first silent swept spec point
const JSON_OUT = (() => { const i = process.argv.indexOf('--json'); return i > 0 ? process.argv[i + 1] : null; })();

async function loadPlaywright() {
  try { return await import('playwright'); } catch {
    const root = execFileSync('npm', ['root', '-g'], { encoding: 'utf8' }).trim();
    return createRequire(join(root, 'noop.js'))('playwright');
  }
}

// Evaluated IN each host over its own __clock and inspect.js (`I`): the gated
// identities and, per unit, what the SHAPE report classifies by. Written once,
// shipped to both hosts as source, so the two sides cannot measure differently.
function measure(I) {
  const c = globalThis.__clock;
  const fnv = (arr, h) => { const b = new Uint8Array(arr.buffer, arr.byteOffset, arr.byteLength); for (let i = 0; i < b.length; i++) { h ^= b[i]; h = Math.imul(h, 16777619); } return h >>> 0; };
  const fingerprint = I.fingerprint(c);
  const digests = I.unitDigests(c);
  const poses = I.digestPoses(c);
  const units = {};
  const meshesOf = (obj) => { const out = []; obj.traverse((m) => { if (m.isMesh && m.geometry) out.push(m); }); return out; };
  for (const p of poses) {
    c.resetInputs(); c.setPose(p); c.scene.updateMatrixWorld(true);
    for (const { name, obj } of c.labelEntries) {
      const u = units[name] ??= { pos: 0x811c9dc5, counts: [], coords: null };
      for (const m of meshesOf(obj)) u.pos = fnv(m.geometry.attributes.position.array, u.pos);
    }
  }
  // The PLACE half's RAW metal (the gate below compares it to the digest's own resolution): every mesh's world matrix
  // at every digest pose, over the digest's own population (collectUnits' walk, the §66 schematic tier pruned, then
  // the held fixtures), in its order. Packed as Float64 bytes in base64 so a boot's payload stays a few MB.
  const placeRaw = {};
  {
    const pop = [];
    for (const { name, obj } of c.labelEntries) {
      const ms = []; const walk = (o) => { if (o.userData && o.userData.schematic) return; if (o.isMesh && o.geometry && o.geometry.attributes.position) ms.push(o); for (const ch of o.children) walk(ch); };
      walk(obj); if (ms.length) pop.push({ name, ms });
    }
    for (const h of I.heldFixtureEntries(c)) pop.push({ name: h.name, ms: h.meshes });
    const acc = Object.fromEntries(pop.map((u) => [u.name, []]));
    for (const p of poses) {
      c.resetInputs(); c.setPose(p); c.scene.updateMatrixWorld(true);
      for (const u of pop) for (const m of u.ms) acc[u.name].push(...m.matrixWorld.elements);
    }
    for (const [name, arr] of Object.entries(acc)) {
      const b = new Uint8Array(new Float64Array(arr).buffer); let str = '';
      for (let i = 0; i < b.length; i += 0x8000) str += String.fromCharCode.apply(null, b.subarray(i, i + 0x8000));
      placeRaw[name] = btoa(str);
    }
  }
  c.resetInputs();
  for (const { name, obj } of c.labelEntries) {
    const u = units[name];
    const tris = [];
    const ms = meshesOf(obj);
    u.counts = ms.map((m) => m.geometry.attributes.position.count);
    u.coords = ms.map((m) => Array.from(m.geometry.attributes.position.array));   // rest pose, for max |Δ|
    for (const m of ms) {
      const ix = m.geometry.index?.array; if (!ix) continue;
      for (let i = 0; i < ix.length; i += 3) tris.push(`${Math.min(ix[i], ix[i + 1], ix[i + 2])},${ix[i] + ix[i + 1] + ix[i + 2]},${Math.max(ix[i], ix[i + 1], ix[i + 2])}`);
    }
    tris.sort();
    u.triSet = fnv(new TextEncoder().encode(tris.join(';')), 0x811c9dc5);
  }
  return { fingerprint, digests, units, placeRaw, placeQ: I.DIGEST_PLACE_Q, warns: (c.bootWarns || []).slice(),
    detMath: globalThis.__detMath ? { installed: globalThis.__detMath.installed, failed: globalThis.__detMath.failed, katN: globalThis.__detMath.katN } : null,
    roster: [...(globalThis.__WATCH_SPEC_KEYS || [])], spec: globalThis.__WATCH_SPEC ?? null };
}

const freePort = () => new Promise((r) => { const s = createServer(); s.listen(0, '127.0.0.1', () => { const p = s.address().port; s.close(() => r(p)); }); });

async function chromiumBoots() {
  const { chromium } = await loadPlaywright();
  const port = await freePort();
  const base = `http://127.0.0.1:${port}`;
  const srv = spawn('python3', [join(ROOT, 'dev_server.py'), String(port)], { cwd: ROOT, env: { ...process.env, TMPDIR: mkdtempSync(join(tmpdir(), 'timesim-338n-')) }, stdio: 'ignore' });
  try {
    for (let t0 = Date.now(); ; ) { try { await fetch(`${base}/index.html`); break; } catch { if (Date.now() - t0 > 15000) throw new Error('dev server never answered'); await new Promise((r) => setTimeout(r, 200)); } }
    const browser = await chromium.launch({ args: ['--disable-background-timer-throttling', '--disable-backgrounding-occluded-windows', '--disable-renderer-backgrounding'] });
    try {
      const out = {};
      await Promise.all(SPECS.map(async (q) => {
        const { page, context } = await virginBoot(browser, base, 600000, q ? `?${q}` : '');
        await prepPage(page);
        out[q] = await page.evaluate(`(${measure})(window.__I)`);
        await context.close();
      }));
      return out;
    } finally { await browser.close(); }
  } finally { srv.kill(); }
}

function nativeBoot(q, { detMath = true } = {}) {
  const dir = mkdtempSync(join(tmpdir(), 'timesim-338n-'));
  const file = join(dir, 'out.json');
  const script = `
    import { bootNative } from ${JSON.stringify(new URL('./native/host.mjs', import.meta.url).href)};
    import { writeFileSync } from 'node:fs';
    await bootNative({ query: ${JSON.stringify(q)}, detMath: ${detMath} });
    const I = await import(${JSON.stringify(new URL('../src/inspect.js', import.meta.url).href)});
    writeFileSync(${JSON.stringify(file)}, JSON.stringify((${measure})(I)));
    process.exit(0);`;
  return new Promise((res, rej) => {
    const ch = spawn(process.execPath, ['--import', fileURLToPath(new URL('./native/loader.mjs', import.meta.url)), '--input-type=module', '-e', script], { cwd: ROOT, stdio: ['ignore', 'ignore', 'pipe'] });
    let err = ''; ch.stderr.on('data', (d) => { err += d; });
    ch.on('exit', (code) => (code === 0 ? res(JSON.parse(readFileSync(file, 'utf8'))) : rej(new Error(`native boot of '${q}' exited ${code}\n${err.slice(-2000)}`))));
  });
}

const t0 = Date.now();
const [chrome, engineMath, ...natives] = await Promise.all([chromiumBoots(), nativeBoot(SPECS[0], { detMath: false }), ...SPECS.map((q) => nativeBoot(q))]);
const native = Object.fromEntries(SPECS.map((q, i) => [q, natives[i]]));
console.log(`booted ${SPECS.length} spec(s) in both hosts in ${((Date.now() - t0) / 1000).toFixed(0)} s (native: node ${process.version}, V8 ${process.versions.v8})`);

const fails = [];
const gate = (ok, what) => { console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${what}`); if (!ok) fails.push(what); };
for (const q of SPECS) {
  const a = chrome[q], b = native[q], name = q || 'identity';
  console.log(`\n${name}`);
  gate(a.warns.length === 0, `Chromium boot silent (${a.warns.length} warning(s)${a.warns.length ? ': ' + a.warns.join(' | ') : ''})`);
  gate(b.warns.length === 0, `native boot silent (${b.warns.length} warning(s)${b.warns.length ? ': ' + b.warns.join(' | ') : ''})`);
  gate(JSON.stringify(a.roster) === JSON.stringify(b.roster) && JSON.stringify(a.spec) === JSON.stringify(b.spec),
    `the build read one roster (${b.roster.length} keys) and one spec ${JSON.stringify(b.spec)} in both hosts`);
  gate(a.fingerprint.hash === b.fingerprint.hash && a.fingerprint.units === b.fingerprint.units,
    `fingerprint identical: Chromium ${a.fingerprint.hash} / native ${b.fingerprint.hash} (${b.fingerprint.units} units, ${b.fingerprint.poseCount} poses)`);
  const names = [...new Set([...Object.keys(a.digests.units), ...Object.keys(b.digests.units)])].sort();
  // PLACE, judged at the digest's OWN resolution. The hash compares 1/DIGEST_PLACE_Q cells, so two placements a
  // femtometre apart that straddle a cell edge hash differently: that is what a last-ulp difference in the two V8s'
  // transcendentals does wherever the pose net samples an ill-conditioned instant (the Balance at maintHold 0.5, τ
  // 2.6e-12 s apart, its metal 1.2e-9). §152 declared the cell the size of "the same place", so the gate is the cell
  // itself, never a second tolerance: a unit whose hash agrees agrees exactly, and a unit whose hash differs agrees
  // only if every coordinate of every matrix at every pose is within one cell. The straddles are REPORTED.
  const tol = 1 / b.placeQ;
  if (!(a.placeQ === b.placeQ)) gate(false, `the two hosts quantize PLACE alike (Chromium ${a.placeQ}, native ${b.placeQ})`);
  const raw = (h, n) => (h.placeRaw[n] ? new Float64Array(Buffer.from(h.placeRaw[n], 'base64').buffer.slice(0)) : null);
  const maxDev = (A, B) => { if (!A || !B || A.length !== B.length) return Infinity; let m = 0; for (let k = 0; k < A.length; k++) { const d = Math.abs(A[k] - B[k]); if (d > m) m = d; } return m; };
  const straddle = [], placeDiff = [];
  for (const n of names) {
    if (a.digests.units[n]?.place === b.digests.units[n]?.place) continue;
    const dev = maxDev(raw(a, n), raw(b, n));
    (dev < tol ? straddle : placeDiff).push(`${n} (max |ΔM| ${Number.isFinite(dev) ? dev.toExponential(2) : 'no matrices to compare'})`);
  }
  gate(placeDiff.length === 0, `PLACE agrees for all ${names.length} units over ${b.digests.poseCount} poses within one ${tol.toExponential(0)} digest cell${placeDiff.length ? ' — moved: ' + placeDiff.join(', ') : ''}`);
  console.log(`  REPORT PLACE hash straddles a cell edge for ${straddle.length} unit(s) whose metal agrees within the cell${straddle.length ? ': ' + straddle.join(', ') : ''}`);
  for (const [host, r] of [['Chromium', a], ['native', b]]) {
    gate(!!r.detMath && r.detMath.installed && r.detMath.failed.length === 0,
      `${host}: deterministic maths installed, boot known answers reproduce (${r.detMath ? `${r.detMath.katN} inputs per function${r.detMath.failed.length ? ', moved: ' + r.detMath.failed.join(', ') : ''}` : 'no __detMath'})`);
  }
  const shapeDiff = names.filter((n) => a.digests.units[n]?.shape !== b.digests.units[n]?.shape);
  gate(shapeDiff.length === 0, `SHAPE digest identical for all ${names.length} units over ${b.digests.poseCount} poses${shapeDiff.length ? ` — ${shapeDiff.length} differ, classified below` : ''}`);
  const tally = { 'index-order': 0, positions: 0, topology: 0, 'not a label unit': 0 };
  for (const n of shapeDiff) {
    const ua = a.units[n], ub = b.units[n];
    if (!ua || !ub) { tally['not a label unit']++; console.log(`    ${n.padEnd(28)} not a label unit (a held fixture): unclassified`); continue; }
    if (ua.counts.length !== ub.counts.length || ua.counts.some((x, i) => x !== ub.counts[i])) {
      tally.topology++;
      const at = ua.counts.findIndex((x, i) => x !== ub.counts[i]);
      console.log(`    ${n.padEnd(28)} topology: mesh #${at} has ${ua.counts[at]} vertices in Chromium, ${ub.counts[at]} native`);
    } else if (ua.pos !== ub.pos) {
      tally.positions++;
      let max = 0, nd = 0;
      ua.coords.forEach((arr, i) => { for (let k = 0; k < arr.length; k++) { const d = Math.abs(arr[k] - ub.coords[i][k]); if (d > 0) { nd++; if (d > max) max = d; } } });
      console.log(`    ${n.padEnd(28)} positions: ${nd ? `${nd} coordinate(s) differ at rest, max |Δ| ${max.toExponential(2)}` : 'identical at rest, different at a digest pose (a posed morph)'}${ua.triSet === ub.triSet ? '' : ', triangle set differs too'}`);
    } else if (ua.triSet === ub.triSet) { tally['index-order']++; }
    else { tally.topology++; console.log(`    ${n.padEnd(28)} topology: same vertices, different triangle set`); }
  }
  console.log(`    by class: ${Object.entries(tally).filter(([, v]) => v).map(([k, v]) => `${k} ${v}`).join(', ') || 'none'}`);
}

console.log('\ncontrol');
const [q0, q1] = SPECS;
gate(native[q0].fingerprint.hash !== chrome[q1].fingerprint.hash,
  `native '${q0 || 'identity'}' (${native[q0].fingerprint.hash}) differs from Chromium '${q1}' (${chrome[q1].fingerprint.hash}): the comparison can fail, and the spec reaches the build`);

// The PLACE tolerance's own controls, so "within one cell" is something the comparison can fail to find: two
// DIFFERENT builds must part by more than a cell somewhere, and one coordinate moved by two cells must be caught.
{
  const tol = 1 / native[q0].placeQ;
  const rawOf = (h, n) => (h.placeRaw[n] ? new Float64Array(Buffer.from(h.placeRaw[n], 'base64').buffer.slice(0)) : null);
  const dev = (A, B) => { if (!A || !B || A.length !== B.length) return Infinity; let m = 0; for (let k = 0; k < A.length; k++) m = Math.max(m, Math.abs(A[k] - B[k])); return m; };
  const apart = Object.keys(native[q0].placeRaw).filter((n) => !(dev(rawOf(native[q0], n), rawOf(chrome[q1], n)) < tol));
  gate(apart.length > 0, `native '${q0 || 'identity'}' and Chromium '${q1}' part by more than one PLACE cell in ${apart.length} unit(s): the tolerance can fail`);
  const n0 = Object.keys(chrome[q0].placeRaw).find((n) => rawOf(chrome[q0], n)?.length) , A = rawOf(chrome[q0], n0), B = A.slice(); B[B.length >> 1] += 2 * tol;
  gate(!(dev(A, B) < tol), `a planted two-cell move in '${n0}' is caught (max |ΔM| ${dev(A, B).toExponential(2)} against ${tol.toExponential(0)})`);
}

// The maths control: the same native boot with the engine's own Math must NOT
// build Chromium's metal (or the SHAPE gate above could not tell), and main.js
// must say so at boot.
{
  const a = chrome[SPECS[0]], e = engineMath;
  const moved = Object.keys(a.digests.units).filter((n) => a.digests.units[n].shape !== e.digests.units[n]?.shape);
  gate(moved.length > 0, `control: native '${SPECS[0] || 'identity'}' with the ENGINE's Math differs from Chromium in SHAPE (${moved.length} units: ${moved.slice(0, 4).join(', ')}${moved.length > 4 ? ', …' : ''})`);
  gate(e.warns.some((w) => w.startsWith('§338: deterministic maths is not installed')), 'control: that boot warns that deterministic maths is not installed');
}

if (JSON_OUT) {
  const pick = (r) => ({ fingerprint: r.fingerprint.hash, units: Object.fromEntries(Object.entries(r.digests.units).map(([n, u]) => [n, { shape: u.shape, place: u.place }])), detMath: r.detMath });
  writeFileSync(JSON_OUT, JSON.stringify({ format: 1, platform: `${process.platform}-${process.arch}`, node: process.version, v8: process.versions.v8,
    specs: Object.fromEntries(SPECS.map((q) => [q, { chromium: pick(chrome[q]), native: pick(native[q]) }])) }, null, 1));
  console.log(`wrote ${JSON_OUT}`);
}

console.log(fails.length ? `\nFAIL — ${fails.length} gate(s)` : '\nPASS — the native host builds the browser\'s movement: the same metal, digest for digest (PLACE within one cell, its straddles reported)');
process.exit(fails.length ? 1 : 0);
