// §339 landing 3c — BARREL B AS METAL: does ?barrels=3 build the parallel second barrel the line spec declares
// (PARALLEL_BARREL, held by tools/probe-339-parallel-barrel.mjs), drive it through the band, and leave every other build
// as it was? Acceptance, native (one process per boot).
//   node --import ./tools/native/loader.mjs tools/probe-339-barrel-b.mjs           (exit 1 on any failed row)
// Rows, each with its control:
//   1. THE LINE SPEC IN THE METAL (`alarm=0&barrels=3`): the record's hook k is the line spec's k_A + n²·k_B (the pure
//      solve of both ribbons, twin-barrel.js parallelBarrel, from the default's own record) to 1e-12; the released energy
//      is the line spec's multiple of the one drum's to 1e-9; B's ribbon (section, packing, stress) is the line spec's B.
//   2. THE SEAT: B's group stands at drum A's centre + the declared bearing × the centre distance, on the drum's plane.
//   3. THE DRIVE: over the wind (setPose tension 0…1) B turns exactly −n times drum A (the band's spur mesh), and both
//      set-up stacks (the drum's and B's) are built. Control: the ratio is not +n and not −1.
//   4. THE WORD: the boot raises exactly the warnings this landing records as its debt (DECLARED below, by their names):
//      the doubled drive overdriving the 14,400 balance (TODO 192, 216, 207/242; the 36,000 row is the target) and the
//      stop-work sized to the doubled stall torque losing its lock disc (§329). A warning beyond them, or a declared one
//      that stopped firing, fails.
//   5. NOTHING ELSE MOVED: the default and `alarm=0` boot silent with no B (equalisation.going.barrelB null, no
//      barrelBGroup), and ?barrels=3 is REFUSED, loudly, where its seat was never solved (with the alarm; on a form case).
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
if (process.argv[2] === '--child') {
  // a refusal is raised while layout.js evaluates the spec, before the build collects __clock.buildWarns, so the child
  // collects every console warning from its first line (the spec's and the build's alike)
  const early = [], warn0 = console.warn;
  console.warn = (...a) => { early.push(a.map(String).join(' ')); warn0(...a); };
  const { bootNative } = await import('./native/host.mjs');
  const r = await bootNative({ query: process.argv[3] });
  const c = r.clock, E = c.equalisation, sc = c.scene;
  const g = sc.getObjectByName('barrelBGroup'), d = c.labelEntries.find((e) => e.name === 'Mainspring drum')?.obj;
  const rot = [];
  if (g && d) for (const t of [0, 0.25, 0.5, 0.75]) { c.setPose({ tension: t }); rot.push(g.rotation.z / d.rotation.z); }
  // the chain's lowest metal within the band's reach of the drum's axis (r_pA + m + CLEAR_MARGIN), over the reserve
  let chainLow = null;
  if (g) {
    const P = g.userData.parallel, ch = c.labelEntries.find((e) => e.name === 'Chain').obj, V = sc.position.constructor, v = new V();
    const dp = d.getWorldPosition(new V()), reach = P.rpA + P.m + 0.15;
    chainLow = { z: Infinity };
    for (let i = 0; i <= 40; i++) { c.setPose({ tension: i / 40 }); ch.updateWorldMatrix(true, true);
      ch.traverse((m) => { if (!m.isMesh) return; const p = m.geometry.attributes.position;
        for (let k = 0; k < p.count; k++) { v.fromBufferAttribute(p, k).applyMatrix4(m.matrixWorld);
          if (Math.hypot(v.x - dp.x, v.y - dp.y) < reach && v.z < chainLow.z) chainLow = { z: v.z, t: i / 40 }; } }); }
    chainLow.bandTop = P.bandTop;
  }
  process.stdout.write('\n@@' + JSON.stringify({ warns: r.warns, early: early.filter((w) => !r.warns.includes(w)), going: E?.going ?? null,
    drumPos: d ? [d.position.x, d.position.y, d.position.z] : null, bPos: g ? [g.position.x, g.position.y, g.position.z] : null,
    stackA: !!c.labelEntries.find((e) => e.name === 'Set-up work'), stackB: !!sc.getObjectByName('setupStackB'), chainLow, band: !!sc.getObjectByName('drumBand'), rot }) + '\n');
  process.exit(0);
}
const env = Object.fromEntries(Object.entries(process.env).filter(([k]) => k !== '__TIMESIM_NATIVE_LOADER__'));
const boot = (q) => { const p = spawnSync(process.execPath, ['--import', './tools/native/loader.mjs', fileURLToPath(import.meta.url), '--child', q],
  { cwd: ROOT, encoding: 'utf8', maxBuffer: 1 << 26, env });
  const l = (p.stdout || '').split('\n').find((x) => x.startsWith('@@'));
  if (!l) throw new Error(`boot '${q}' failed: ${(p.stderr || '').slice(-400)}`);
  return JSON.parse(l.slice(2)); };
const { installDetMath } = await import('../src/det-math.js'); installDetMath(Math);
const { parallelBarrel } = await import('../src/twin-barrel.js');
const { PARALLEL_BARREL: D } = await import('../src/layout.js');
let fail = 0;
const row = (ok, what) => { console.log(`${ok ? 'OK  ' : 'FAIL'} ${what}`); if (!ok) fail++; };
const rel = (a, b) => Math.abs(a - b) / Math.abs(b), f = (x, d = 4) => (+x).toFixed(d);

const def = boot(''), a0 = boot('alarm=0'), B3 = boot('alarm=0&barrels=3');
const R0 = def.going, setup = R0.windRangeRad[0], sweep = R0.windRangeRad[1] - R0.windRangeRad[0];
const fw = { setupClicks: R0.setup.clicks, setupTeeth: R0.setup.teeth };
const { CHAIN_END_R_OUT, CLEAR_MARGIN } = await import('../src/layout.js');
fw.chainEndROut = CHAIN_END_R_OUT;   // the build's own constant, the one both the band and the line spec read
const BB = B3.going?.barrelB;
const L = parallelBarrel({ NB: D.NB, zA: D.zA, zB: D.zB, fw, c: R0.section.c, RA: 10.71, setup, sweep });

// 1
row(!!BB && L.feasible && rel(B3.going.k_Nm_per_rad, L.kHook) <= 1e-12,
  `1. the hook's k is the line spec's k_A + n²·k_B: ${B3.going ? B3.going.k_Nm_per_rad.toExponential(6) : '—'} vs ${L.kHook?.toExponential(6)}`);
row(rel(B3.going.energy.released_J / R0.energy.released_J, L.mult) <= 1e-9,
  `1. released energy ×${f(B3.going.energy.released_J / R0.energy.released_J)} of the one drum's, the line spec's ×${f(L.mult)}`);
row(!!BB && rel(BB.k_Nm_per_rad, L.B.k) <= 1e-12 && rel(BB.section.a, L.B.a) <= 1e-12 && rel(BB.devLen_u, L.B.L) <= 1e-12,
  `1. B's ribbon as cut is the line spec's (k ${BB?.k_Nm_per_rad.toExponential(6)}, a ${BB && f(BB.section.a, 6)}, L ${BB && f(BB.devLen_u, 3)})`);
row(!!BB && BB.setup.quantised && BB.setup.clicks === D.NB, `1. B's set-up is ${BB?.setup.clicks} whole clicks of its ${BB?.setup.teeth}-tooth ratchet`);
// 2
const want = B3.drumPos && [B3.drumPos[0] + Math.cos((D.barrelAzDeg * Math.PI) / 180) * L.centreDistance, B3.drumPos[1] + Math.sin((D.barrelAzDeg * Math.PI) / 180) * L.centreDistance];
row(!!B3.bPos && Math.hypot(B3.bPos[0] - want[0], B3.bPos[1] - want[1]) < 1e-9 && Math.abs(B3.bPos[2] - B3.drumPos[2]) < 1e-12,
  `2. B stands at the declared seat, ${D.barrelAzDeg}° round A at ${f(L.centreDistance, 3)}: (${B3.bPos?.map((x) => f(x, 3)).join(', ')})`);
// 3
row(B3.rot.length === 4 && B3.rot.every((q) => Math.abs(q + L.n) < 1e-12), `3. B turns −n = −${f(L.n, 6)} times drum A at every pose sampled (${B3.rot.map((q) => f(q, 6)).join(', ')})`);
row(B3.rot.every((q) => Math.abs(q - L.n) > 1e-3 && Math.abs(q + 1) > 1e-3), '3. control: the ratio is neither +n nor −1');
row(B3.stackA && B3.stackB && B3.band, '3. the drum\'s band and both set-up stacks are built');
row(!!B3.chainLow && B3.chainLow.bandTop <= B3.chainLow.z - CLEAR_MARGIN && B3.chainLow.z - CLEAR_MARGIN - B3.chainLow.bandTop < 0.01,
  `3. the band's top ${B3.chainLow?.bandTop} stands one CLEAR_MARGIN under the chain's lowest metal in its reach over the reserve (${B3.chainLow && f(B3.chainLow.z)} at tension ${B3.chainLow?.t}), within the 0.01 it is rounded to`);
// 4
const DECLARED = ['§329: the lock disc lets the star go', 'TODO 192: AMPLITUDE_CLAIM_DEG', 'TODO 216: the serviced (nominal) corner knocks', 'TODO 207/242: BAL_RIM_F'];
const extra = [...B3.warns, ...B3.early].filter((w) => !DECLARED.some((p) => w.startsWith(p))), stale = DECLARED.filter((p) => !B3.warns.some((w) => w.startsWith(p)));
row(!extra.length && !stale.length, `4. the boot raises exactly the ${DECLARED.length} declared warnings${extra.length ? `; beyond them: ${extra.map((w) => w.slice(0, 90)).join(' | ')}` : ''}${stale.length ? `; stopped firing: ${stale.join(', ')}` : ''}`);
// 5
for (const [q, b] of [['(default)', def], ['alarm=0', a0]])
  row(b.warns.length === 0 && b.early.length === 0 && !b.going.barrelB && !b.bPos && !b.stackB, `5. ${q} boots silent with no second barrel`);
for (const q of ['barrels=3', 'alarm=0&barrels=3&case=fitted']) {
  const b = boot(q);
  row(b.early.some((w) => w.startsWith('§339: ?barrels=3 is refused')) && !b.bPos && !b.going.barrelB, `5. '${q}' is refused loudly and builds the one drum`);
}
// 6. THE 36,000 ROW ON THIS BUILD (landing 3d): RATE_TABLE[36000].parallel's balance (r 8.25, rim 0.235) reaches the
//    target and starts, so the record's TODO 192/216/207/242 rows are SILENT there, and the rate builds (not refused).
//    Its remaining warning is exactly the debt this landing records: the stop-work's lock disc (§329). The maintaining
//    detent's beak at the doubled torque (TODO 218, 221) went quiet when the ring was chosen by its click's worst recoil
//    rather than a whole pitch (landing 3f), and the escape pinion's bore band (TODO 175) when landing 3g cut the mesh
//    140/7 at the module floor and re-laid the escape and balance stations for it.
{
  const b = boot('alarm=0&barrels=3&vph=36000');
  const all = [...b.warns, ...b.early];
  const amp = all.filter((w) => /^TODO (192|216|207\/242|242):/.test(w));
  row(!all.some((w) => w.startsWith('TODO 292: ?vph=36000 is refused')) && amp.length === 0,
    `6. alarm=0&barrels=3&vph=36000 builds the rate, and its balance rows are silent${amp.length ? `: ${amp.map((w) => w.slice(0, 80)).join(' | ')}` : ''}`);
  const DECL36 = ['§329: the lock disc lets the star go'];
  const extra36 = all.filter((w) => !DECL36.some((p) => w.startsWith(p))), stale36 = DECL36.filter((p) => !all.some((w) => w.startsWith(p)));
  row(!extra36.length && !stale36.length, `6. its other warnings are exactly the one recorded debt (${all.length} lines)${extra36.length ? `; beyond them: ${extra36.map((w) => w.slice(0, 80)).join(' | ')}` : ''}${stale36.length ? `; stopped firing: ${stale36.join(', ')}` : ''}`);
}
process.exit(fail ? 1 : 0);
