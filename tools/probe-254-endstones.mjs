// TODO 254 — IS EACH END OF THE BALANCE STAFF A BEARING END? An endstone bears
// only if the pivot's TIP reaches it before the staff's SHOULDER reaches the hole
// jewel's face. Until TODO 254 neither end was: §120 hung the upper endstone 0.17
// over the tip against a shoulder 0.15 under the cock's stone (so the shoulder
// bore first, by 0.02), and the lower end had no endstone at all.
//
// HOW IT MEASURES — along the staff's own axis, not off bounding boxes (the
// build's guard reads boxes; this reads surfaces, so the two are independent
// readers of one law). Two rays parallel to the axis, every crossing kept:
//   · INNER, inside the pivot (r 0.03 < 0.0956) and so inside the hole jewels'
//     holes: it sees the two pivots and the two endstones, and nothing of the
//     stones. tip gap = endstone face − tip.
//   · OUTER, on the staff's body outside the pivot (r 0.22: over the hole's
//     0.1456, under the staff's 0.3): it sees the two hole jewels and the staff
//     body's two shoulders, and no pivot. shoulder gap = stone face − shoulder.
// Each end must read 0 < tip gap < shoulder gap, the two tip gaps must add to
// END_SHAKE (2·PIVOT_BORE_CLEAR) and, the staff centred in the build, be equal;
// END_SHAKE in mm must sit in the 0.02–0.04 mm band a bench sets a wheel to;
// and FRICTION.endContactMm's every corner must be under the pivot's end as cut
// (a contact cannot be wider than the end it sits on).
//
// CONTROLS — mutation, because a guard nobody has seen fire is a comment. Each
// mutant copies src/, vendor/ and tools/native/ (and this file), changes ONE
// site (the anchor must match exactly once and the file must move, or the row
// is an error rather than a pass), boots the copy natively, and must be caught
// TWICE: by the build's own guard (its warning, by text) and by this probe's
// rays (the law reads FAIL). An identity copy must boot silent and pass, which
// proves the copying and the filtering did not make the mutants' failures.
//
//   node --import ./tools/native/loader.mjs tools/probe-254-endstones.mjs
// Acceptance: exits non-zero on any failure.
import { mkdtempSync, cpSync, readFileSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, '..');

// ---- the child: boot this tree, read the law off the axis ------------------
async function child() {
  const { bootNative } = await import('./native/host.mjs');
  const THREE = await import('../vendor/three.module.js');
  const L = await import('../src/layout.js');
  const r = await bootNative({ query: '' });
  const C = r.clock;
  C.setPose({ tau: 0 });
  C.scene.updateMatrixWorld(true);
  let pivot = null;
  C.scene.traverse((o) => { if (!pivot && o.isMesh && o.name === 'balancePivot') pivot = o; });
  const balance = pivot.parent;
  const inBalance = (o) => { for (let p = o; p; p = p.parent) if (p === balance) return true; return false; };
  const axis = new THREE.Vector3(); pivot.getWorldPosition(axis);
  const cast = (off) => {
    const ox = axis.x + off * Math.cos(0.7), oy = axis.y + off * Math.sin(0.7);   // off the exact axis, off any seam
    const ray = new THREE.Raycaster(new THREE.Vector3(ox, oy, -50), new THREE.Vector3(0, 0, 1), 0, 200);
    const rows = [];
    C.scene.traverse((o) => {
      if (!o.isMesh || o.userData?.schematic || !o.geometry?.attributes?.position) return;
      const box = new THREE.Box3().setFromObject(o);
      if (box.min.x > ox || box.max.x < ox || box.min.y > oy || box.max.y < oy) return;
      const mats = Array.isArray(o.material) ? o.material : [o.material];
      const sides = mats.map((m) => m.side); mats.forEach((m) => { m.side = THREE.DoubleSide; });
      const zs = [...new Set(ray.intersectObject(o, false).map((q) => Math.round(q.point.z * 1e7) / 1e7))].sort((a, b) => a - b);
      mats.forEach((m, k) => { m.side = sides[k]; });
      for (let i = 0; i + 1 < zs.length; i += 2) rows.push({ name: o.name, balance: inBalance(o), lo: zs[i], hi: zs[i + 1] });
    });
    return rows.sort((a, b) => a.lo - b.lo);
  };
  const inner = cast(0.03), outer = cast(0.22);
  const piv = inner.filter((q) => q.name === 'balancePivot');
  const one = (rows, name, pred = () => true) => rows.filter((q) => q.name === name && pred(q));
  const upCap = one(inner, 'balanceUpperEndstone'), loCap = one(inner, 'balanceLowerEndstone');
  const midZ = piv.length === 2 ? (piv[0].hi + piv[1].lo) / 2 : 0;
  const loStone = one(outer, 'chatonStone', (q) => q.hi < midZ), upStone = one(outer, 'chatonStone', (q) => q.lo > midZ);
  const out = { warns: r.warns, read: [], ends: {} };
  const need = (ok, what) => { if (!ok) out.read.push(what); return ok; };
  if (need(piv.length === 2, `${piv.length} pivots on the inner ray (want 2)`)
      & need(upCap.length === 1, `${upCap.length} upper endstones on the inner ray`)
      & need(loCap.length === 1, `${loCap.length} lower endstones on the inner ray`)
      & need(upStone.length === 1, `${upStone.length} upper hole jewels on the outer ray`)
      & need(loStone.length === 1, `${loStone.length} lower hole jewels on the outer ray`)) {
    const body = outer.filter((q) => q.balance);
    const loShoulder = Math.min(...body.filter((q) => q.lo >= loStone[0].hi).map((q) => q.lo));
    const upShoulder = Math.max(...body.filter((q) => q.hi <= upStone[0].lo).map((q) => q.hi));
    out.ends = {
      upper: { tipGap: upCap[0].lo - piv[1].hi, shoulderGap: upStone[0].lo - upShoulder },
      lower: { tipGap: piv[0].lo - loCap[0].hi, shoulderGap: loShoulder - loStone[0].hi },
    };
  }
  out.END_SHAKE = L.END_SHAKE; out.UNIT_MM = L.UNIT_MM;
  out.endContactMm = L.FRICTION.endContactMm;
  out.pivotR_mm = pivot.geometry.parameters.radiusTop * L.UNIT_MM;
  console.log('CHILD ' + JSON.stringify(out));
  process.exit(0);
}

// The law, judged on what a child read. Returns the failures, [] when it holds.
function judge(q) {
  const f = [...q.read];
  for (const [end, e] of Object.entries(q.ends)) {
    if (!(e.tipGap > 0)) f.push(`${end}: tip on its endstone (${e.tipGap.toFixed(4)})`);
    else if (!(e.tipGap < e.shoulderGap)) f.push(`${end}: shoulder bears first (tip ${e.tipGap.toFixed(4)}, shoulder ${e.shoulderGap.toFixed(4)})`);
  }
  if (q.ends.upper && q.ends.lower) {
    const shake = q.ends.upper.tipGap + q.ends.lower.tipGap;
    if (Math.abs(shake - q.END_SHAKE) > 1e-5) f.push(`endshake ${shake.toFixed(5)} ≠ END_SHAKE ${q.END_SHAKE}`);
    if (Math.abs(q.ends.upper.tipGap - q.ends.lower.tipGap) > 1e-5) f.push(`the staff is not centred (${q.ends.upper.tipGap.toFixed(5)} over, ${q.ends.lower.tipGap.toFixed(5)} under)`);
  }
  const mm = q.END_SHAKE * q.UNIT_MM;
  if (!(mm >= 0.02 && mm <= 0.04)) f.push(`END_SHAKE is ${mm.toFixed(4)} mm, outside the bench's 0.02–0.04`);
  for (const c of ['favourable', 'nominal', 'adverse']) if (!(q.endContactMm[c] <= q.pivotR_mm)) f.push(`endContactMm.${c} ${q.endContactMm[c]} mm is wider than the pivot's end, ${q.pivotR_mm.toFixed(4)} mm`);
  return f;
}

if (process.argv.includes('--child')) { await child(); }

const MUTANTS = [
  { name: 'identity copy', file: null, guard: null },
  { name: "§120's upper endstone, 0.17 over the tip", file: 'src/main.js',
    find: 'const capUnder = (BALANCE_PIVOT_TIP_Z - COCK_SLAB_TOP) + BALANCE_TIP_GAP;',
    to: 'const capUnder = (BALANCE_PIVOT_TIP_Z - COCK_SLAB_TOP) + 0.17;',
    guard: /TODO 254: the upper pivot's tip stands 0\.1700 from its endstone and its shoulder 0\.1500/ },
  { name: 'no lower endstone (the tree before TODO 254)', file: 'src/main.js',
    find: '  pl.jewel.add(endstone);\n', to: '\n',
    guard: /TODO 254: the balance staff's bearing ends cannot be read — 0 lower endstones/ },
  { name: 'both endstones down on their tips', file: 'src/main.js',
    find: 'const BALANCE_TIP_GAP = END_SHAKE / 2;', to: 'const BALANCE_TIP_GAP = 0;',
    guard: /TODO 254: the (upper|lower) pivot's tip stands 0\.0000 from its endstone — it must be free of it/ },
  { name: 'an endshake past the shoulders', file: 'src/main.js',
    find: 'const BALANCE_TIP_GAP = END_SHAKE / 2;', to: 'const BALANCE_TIP_GAP = END_SHAKE * 2;',
    guard: /TODO 254: the (upper|lower) pivot's tip stands 0\.2000 from its endstone and its shoulder 0\.1500/ },
  { name: 'a contact wider than the end it sits on', file: 'src/layout.js',
    find: 'endContactMm: Object.freeze({ favourable: 0.01, nominal: 0.02, adverse: 0.03,',
    to: 'endContactMm: Object.freeze({ favourable: 0.01, nominal: 0.02, adverse: 0.04,',
    guard: /TODO 254: FRICTION\.endContactMm's adverse corner \(0\.04 mm\) is wider than the balance pivot's end as cut/ },
];

function bootCopy(m) {
  const dir = mkdtempSync(join(tmpdir(), 'endstones-'));
  for (const d of ['src', 'vendor', 'tools/native']) cpSync(join(ROOT, d), join(dir, d), { recursive: true, dereference: true });
  cpSync(join(HERE, 'probe-254-endstones.mjs'), join(dir, 'tools', 'probe-254-endstones.mjs'));
  if (m.file) {
    const target = join(dir, m.file);
    const before = readFileSync(target, 'utf8');
    const hits = before.split(m.find).length - 1;
    if (hits !== 1) { rmSync(dir, { recursive: true, force: true }); return Promise.resolve({ err: `anchor matched ${hits} times, needs exactly 1 — the patch is stale` }); }
    const after = before.replace(m.find, m.to);
    if (after === before) { rmSync(dir, { recursive: true, force: true }); return Promise.resolve({ err: 'the patch left the file unchanged' }); }
    writeFileSync(target, after);
  }
  return new Promise((resolve) => {
    const p = spawn(process.execPath, ['--import', join(dir, 'tools/native/loader.mjs'), join(dir, 'tools/probe-254-endstones.mjs'), '--child'], { stdio: ['ignore', 'pipe', 'pipe'],
      // the loader registers once per process by an env flag, which a child inherits: clear it, or the copy boots without its hooks
      env: Object.fromEntries(Object.entries(process.env).filter(([k]) => k !== '__TIMESIM_NATIVE_LOADER__')) });
    let so = '', se = '';
    p.stdout.on('data', (d) => { so += d; }); p.stderr.on('data', (d) => { se += d; });
    p.on('close', (code) => {
      rmSync(dir, { recursive: true, force: true });
      const line = so.split('\n').find((l) => l.startsWith('CHILD '));
      resolve(line ? { q: JSON.parse(line.slice(6)) } : { err: `the copy did not boot (exit ${code}): ${(se || so).split('\n').filter((l) => /Error|Cannot find/.test(l)).slice(0, 2).join(' | ')}` });
    });
  });
}

// The tree itself first, then every copy in parallel.
const fails = [];
const self = await bootCopy({ file: null });
console.log('TODO 254 — the balance staff\'s bearing ends, read along its axis');
if (self.err) { console.log(`  FAIL  the tree did not boot: ${self.err}`); process.exit(1); }
const q0 = self.q;
const f = (x) => x.toFixed(4);
for (const [end, e] of Object.entries(q0.ends)) console.log(`  ${end.padEnd(5)}  tip gap ${f(e.tipGap)}   shoulder gap ${f(e.shoulderGap)}   (the tip bears with ${f(e.shoulderGap - e.tipGap)} to spare)`);
if (q0.ends.upper && q0.ends.lower) console.log(`  endshake ${f(q0.ends.upper.tipGap + q0.ends.lower.tipGap)} u = ${(1000 * (q0.ends.upper.tipGap + q0.ends.lower.tipGap) * q0.UNIT_MM).toFixed(1)} µm   (END_SHAKE ${q0.END_SHAKE}, the bench's 20–40 µm)`);
console.log(`  dial-flat contact radius ${q0.endContactMm.favourable}–${q0.endContactMm.adverse} mm under a pivot end of ${f(q0.pivotR_mm)} mm`);
const j0 = judge(q0);
if (q0.warns.length) fails.push(`the tree booted with ${q0.warns.length} warning(s): ${q0.warns[0]}`);
for (const x of j0) fails.push(`the tree: ${x}`);
console.log(`  ${j0.length || q0.warns.length ? 'FAIL' : 'PASS'}  the law holds on the tree, booted silent`);

console.log('\ncontrols — each mutant must be caught by the build\'s guard AND by these rays');
const res = await Promise.all(MUTANTS.map(bootCopy));
MUTANTS.forEach((m, i) => {
  const r = res[i];
  if (r.err) { fails.push(`${m.name}: ${r.err}`); console.log(`  ERROR ${m.name}: ${r.err}`); return; }
  const law = judge(r.q);
  if (!m.guard) {
    const ok = r.q.warns.length === 0 && law.length === 0;
    if (!ok) fails.push(`${m.name}: ${r.q.warns[0] || law[0]}`);
    console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${m.name}: silent, law holds`);
    return;
  }
  const guarded = r.q.warns.some((w) => m.guard.test(w));
  const ok = guarded && law.length > 0;
  if (!ok) fails.push(`${m.name}: ${guarded ? '' : 'the guard did not fire; '}${law.length ? '' : 'the rays read it clean'}`);
  console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${m.name}: guard ${guarded ? 'fired' : 'SILENT'}; rays: ${law[0] || 'clean'}`);
});
console.log(fails.length ? `\nFAIL — ${fails.length}:\n  ${fails.join('\n  ')}` : `\nPASS — both ends bear on their endstones; ${MUTANTS.length - 1} mutants caught twice each, the identity copy clean`);
process.exit(fails.length ? 1 : 0);
