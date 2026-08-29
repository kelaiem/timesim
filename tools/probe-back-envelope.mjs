// WHAT STANDS ABOVE THE THREE-QUARTER PLATE — the back envelope, per member
// and per station, SWEPT over the pose net.
//
// REPORT. Written for the case-redesign scope (roadmap): the caseback's glass
// wants to hug the movement, and the number it hugs is not a constant — it is
// whatever the tallest metal is, wherever it is, at its worst POSE (the alarm
// hammer swings; the link lever rocks). A rest-pose survey already lied once
// at scale: three records name the alarm barrel as the back-most metal, and
// §112 moved it under the plate (TODO 114).
//
// What this is NOT: `probe-104.mjs` surveys the striking corner's XY
// footprint at rest for a siting decision; `probe-alarm-under-plate.mjs` asks
// whether the module fits BELOW the plate. Neither sweeps poses nor reports
// the z-envelope the caseback must clear, which is this file's one question.
//
// Four products:
//   1. per-UNIT z-max over the whole net, with the pose that set it — the
//      caseback's floor, and E7's (strike-tier sinking) price list;
//   2. a radial histogram of the envelope (max z per r-bin over all poses) —
//      what a stepped or domed glass could hug at each radius;
//   3. the daylight ledger over the three-quarter plate: envelope minus
//      plate-top, per r-bin;
//   4. §187 — the BUILD-POSE histogram and per-unit z-max beside the swept
//      ones, with the swept-minus-build DELTA per unit. §187's glass derives
//      at boot, and boot cannot sweep poses (setPose lives thousands of
//      lines below the case build — TODO 111's structural note), so the boot
//      derivation is build-pose scan + DECLARED mover allowances; this
//      product is where those allowance numbers are MEASURED rather than
//      guessed, and the delta column is the allowance table's source.
//      ("Build pose" here is the canonical reset pose — TODO 111 measured
//      the construction pose and the reset pose identical; the going train's
//      tau drift between them is rotation about z and cannot move a z-max.)
//
// Controls (both directions, asserted): the alarm link tower MUST appear
// above the plate (rest measurement 13.877); the alarm barrel MUST NOT
// (§112 put it at ≈5.4). A run failing either exits 2 — the scan measured
// the wrong thing.
//
// §187 GATE — declared ≥ swept. When the tree under test exposes
// `__clock.backEnvelope` (the boot-measured declaration the glass is built
// from: build-pose bins + BACK_SWEPT_ALLOWANCE + BACK_SWEPT_REGIONS), this
// probe re-measures the envelope over the full pose net IN THE
// DECLARATION'S OWN BINNING and fails (exit 2) on any bin where swept
// metal tops the declaration — a mover that grows or migrates reds CI
// here, not the glass. Scoped to metal ABOVE the plate top: every glass
// surface stands at least the ring's own stack above the three-quarter
// plate's top face, so metal at or below it can never govern the glass,
// and gating it would only make the declaration carry parts the glass
// cannot meet.
//
// Run: node tools/probe-back-envelope.mjs   (ROOT= for another worktree)
import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
const ROOT = process.env.ROOT || join(dirname(fileURLToPath(import.meta.url)), '..');
const srv = spawn('python3', ['-m', 'http.server', '8511', '--bind', '127.0.0.1'], { cwd: ROOT, stdio: 'ignore' });
await new Promise((r) => setTimeout(r, 1200));
const browser = await chromium.launch();
const page = await browser.newPage();
page.on('pageerror', (e) => console.log('PAGEERROR', String(e)));
await page.goto('http://127.0.0.1:8511/index.html', { waitUntil: 'load', timeout: 120000 });
await page.waitForFunction(() => !!window.__clock, null, { timeout: 120000 });

const res = await page.evaluate(async () => {
  const I = await import('./src/inspect.js');
  const THREE = await import('three');
  const clock = window.__clock;
  // The plate's own top face, read off its metal rather than restated: the
  // three-quarter plate mesh's max z. (TQ_TOP_Z is a nominal; the §182-era
  // rule is to measure the face you budget against.)
  const tq = clock.labelEntries.find((e) => e.name === 'Three-quarter plate');
  let plateTop = -Infinity, plateR = 0;
  {
    const v = new THREE.Vector3();
    tq.obj.updateWorldMatrix(true, true);
    tq.obj.traverse((o) => {
      if (!o.isMesh || o.userData.schematic || !o.geometry?.attributes?.position) return;
      const p = o.geometry.attributes.position;
      for (let i = 0; i < p.count; i++) {
        o.localToWorld(v.fromBufferAttribute(p, i));
        plateTop = Math.max(plateTop, v.z);
        plateR = Math.max(plateR, Math.hypot(v.x, v.y));
      }
    });
  }
  const NBIN = 60;                 // r-bins across [0, plateR·1.15]
  const rSpan = plateR * 1.15;
  // §187 — the declaration under test, when the tree carries one. The gate
  // histogram uses ITS binning, so the comparison is bin-for-bin.
  const decl = clock.backEnvelope || null;
  const declSwept = decl ? new Array(decl.NBIN).fill(-Infinity) : null;
  const declOwner = decl ? new Array(decl.NBIN).fill(null) : null;
  const bins = new Array(NBIN).fill(-Infinity);
  const binOwner = new Array(NBIN).fill(null);
  // §187 — the build-pose histogram, recorded beside the swept one. The
  // first pose in the walk is the CANONICAL RESET pose (enterAxis with no
  // setPose), which is the pose the boot derivation measures at.
  const binsBuild = new Array(NBIN).fill(-Infinity);
  const units = new Map();         // name → { zMax, pose, zBuild }
  const poses = [{ name: 'build pose (canonical reset)', enter: () => { I.enterAxis(clock); }, isBuild: true }];
  for (const ax of I.AXES) for (const f of [0, 0.5, 1])
    poses.push({ name: `${ax.name} f=${f}`, enter: () => { I.enterAxis(clock); clock.setPose(ax.pose(f, clock)); } });

  const v = new THREE.Vector3();
  for (const p of poses) {
    p.enter();
    clock.scene.updateMatrixWorld(true);
    for (const e of clock.labelEntries) {
      if (e.name === 'Three-quarter plate') continue;   // the datum, not a tenant
      e.obj.traverse((o) => {
        if (!o.isMesh || o.userData.schematic || o.userData.casePart || !o.geometry?.attributes?.position) return;
        const pos = o.geometry.attributes.position;
        for (let i = 0; i < pos.count; i++) {
          o.localToWorld(v.fromBufferAttribute(pos, i));
          if (v.z <= plateTop) continue;                // only what stands ABOVE the plate top
          const u = units.get(e.name) || { zMax: -Infinity, pose: '', zBuild: -Infinity };
          if (v.z > u.zMax) { u.zMax = v.z; u.pose = p.name; }
          if (p.isBuild && v.z > u.zBuild) u.zBuild = v.z;
          units.set(e.name, u);
          const b = Math.min(NBIN - 1, Math.floor(Math.hypot(v.x, v.y) / rSpan * NBIN));
          if (v.z > bins[b]) { bins[b] = v.z; binOwner[b] = e.name; }
          if (p.isBuild && v.z > binsBuild[b]) binsBuild[b] = v.z;
          if (decl) {
            const r = Math.hypot(v.x, v.y);
            if (r < decl.rSpan) {
              const db = Math.floor(r / decl.rSpan * decl.NBIN);
              if (v.z > declSwept[db]) { declSwept[db] = v.z; declOwner[db] = e.name; }
            }
          }
        }
      });
    }
  }
  // §187 gate rows: swept vs declared, in the declaration's bins.
  const declFails = [];
  if (decl) {
    for (let b = 0; b < decl.NBIN; b++) {
      if (declSwept[b] === -Infinity) continue;
      const d = decl.bins[b].z;
      if (d === null || declSwept[b] > d + 1e-6)
        declFails.push({ r0: decl.bins[b].r0, r1: decl.bins[b].r1, swept: declSwept[b],
          declared: d, owner: declOwner[b], declOwner: decl.bins[b].owner });
    }
  }
  return {
    hasDecl: !!decl, declFails,
    plateTop, plateR, rSpan, poses: poses.length,
    units: [...units.entries()].map(([name, u]) => ({ name, zMax: u.zMax, pose: u.pose, zBuild: u.zBuild }))
      .sort((a, b) => b.zMax - a.zMax),
    bins: bins.map((z, i) => ({ r0: i / NBIN * rSpan, r1: (i + 1) / NBIN * rSpan, zMax: z, owner: binOwner[i], zBuild: binsBuild[i] })),
  };
});

const MM = 0.378947;
console.log(`plate top MEASURED z ${res.plateTop.toFixed(4)} (r ${res.plateR.toFixed(3)}), ${res.poses} poses swept\n`);
console.log('UNIT z-max ABOVE the plate top (u / mm proud), worst pose — and §187\'s swept−build delta:');
for (const u of res.units.slice(0, 20))
  console.log(`  ${u.name.padEnd(28)} ${u.zMax.toFixed(3).padStart(8)}  +${((u.zMax - res.plateTop) * MM).toFixed(2)} mm  build ${u.zBuild === -Infinity ? '   (below plate)' : u.zBuild.toFixed(3).padStart(8)}  Δ ${(u.zMax - (u.zBuild === -Infinity ? res.plateTop : u.zBuild)).toFixed(3)}  @ ${u.pose}`);
console.log('\nRADIAL ENVELOPE (r-bin → max z over all poses / at build pose, owner):');
for (const b of res.bins) {
  if (b.zMax === -Infinity) continue;
  console.log(`  r ${b.r0.toFixed(1).padStart(5)}..${b.r1.toFixed(1).padEnd(5)}  z ${b.zMax.toFixed(3).padStart(7)}  build ${b.zBuild === -Infinity ? '      —' : b.zBuild.toFixed(3).padStart(7)}  Δ ${(b.zBuild === -Infinity ? b.zMax - res.plateTop : b.zMax - b.zBuild).toFixed(3).padStart(6)}  daylight ${((b.zMax - res.plateTop) * MM).toFixed(2).padStart(5)} mm  ${b.owner}`);
}

// §187 GATE — declared ≥ swept, when the tree declares.
let declOk = true;
if (res.hasDecl) {
  if (res.declFails.length) {
    declOk = false;
    console.log(`\n§187 GATE FAIL — ${res.declFails.length} bin(s) where the swept envelope tops the boot declaration:`);
    for (const f of res.declFails)
      console.log(`  r ${f.r0.toFixed(1)}..${f.r1.toFixed(1)}  swept ${f.swept.toFixed(3)} (${f.owner})  declared ${f.declared === null ? 'NOTHING' : f.declared.toFixed(3)} (${f.declOwner ?? '—'}) — grow the unit's allowance or region row, with the measurement`);
  } else {
    console.log('\n§187 GATE PASS: every swept bin sits at or under the boot declaration (build + allowances + regions)');
  }
} else {
  console.log('\n(§187 gate skipped: this tree exposes no __clock.backEnvelope declaration)');
}

// CONTROLS — both directions.
const tower = res.units.find((u) => u.name === 'Alarm link');
const barrel = res.units.find((u) => u.name === 'Alarm barrel');
let ok = true;
if (!tower || tower.zMax < 13.0) { ok = false; console.log(`\nCONTROL FAIL: the alarm link tower (rest 13.877) was not found above the plate — the scan measured the wrong thing (got ${tower ? tower.zMax.toFixed(3) : 'nothing'})`); }
else console.log(`\nCONTROL PASS: alarm link tower found at ${tower.zMax.toFixed(3)}`);
if (barrel) { ok = false; console.log(`CONTROL FAIL: the alarm barrel appears ABOVE the plate at ${barrel.zMax.toFixed(3)} — §112 put it below; the scan or the tree is wrong`); }
else console.log('CONTROL PASS: the alarm barrel is not above the plate (§112 holds)');
await browser.close(); srv.kill();
process.exit(ok && declOk ? 0 : 2);
