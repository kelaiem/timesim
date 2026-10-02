// TODO 190 — WHAT DOES THE SILENCE ROCKER TOUCH ON THE FEELER, MESH BY MESH?
// REPORT. The EXPECTED pair `Alarm silence rocker ⇄ Alarm release feeler`
// excuses every contact between the two units, and the `rocker finger ⇄
// feeler tail` hand-off row measures only its own two named meshes — so a
// finger that lands on the feeler's RETURN BLADE instead of its tail reads
// green on both. This walks every mesh pair of the two units over the pose
// net (every AXES axis, sampled, plus the four ALARM_HANDOFF_POSES parities)
// and prints, per pair under 0.3: the minimum BVH clearance (`meshClearance`,
// the battery's own primitive — 0 means contact), and for pairs in contact an
// oriented-box separating-axis DEPTH (exact for boxes; a cylinder is read as
// its circumscribing square prism, so a cylinder's depth is an OVER-estimate,
// never an under-one). It also prints what the hand-off row reads at the four
// parities, and the finger's clearance to the return blade at the SETTING
// parity — the P0 question: does the finger reach the tail before the blade?
//
// CONTROLS: the declared hand-off contact (finger ⇄ tail at `setting`) must
// read 0 — a probe whose must-hit pair reads clear has measured nothing; and
// the paddle ⇄ the feeler's tip, which are units apart, must read clear.
//
// Not `probe-117-*` (the feeler's own fold) and not the battery's
// `expectedContacts` (which reports one minimum per unit pair, never the
// population behind it). Run from tools/: `node probe-silence-feeler-pairs.mjs`
// (ROOT=<tree> to measure another checkout; CHROMIUM=<path> for a browser
// outside Playwright's cache). A REPORT in its verdicts — it exits non-zero only
// if a control fails or the boot dies, which is why INDEX.md files it as
// acceptance.
import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import { resolve } from 'node:path';
import { virginBoot, prepPage } from './battery-checks.mjs';

const ROOT = resolve(process.env.ROOT || '..');
const PORT = Number(process.env.PORT || 8590);
const SAMPLES = Number(process.env.SAMPLES || 24);
const BOOT_MS = 300000;

const srv = spawn('python3', ['-m', 'http.server', String(PORT), '--bind', '127.0.0.1'], { cwd: ROOT, stdio: 'ignore' });
await new Promise((r) => setTimeout(r, 900));
const browser = await chromium.launch(process.env.CHROMIUM ? { executablePath: process.env.CHROMIUM } : {});
let out;
try {
  const { context, page } = await virginBoot(browser, `http://127.0.0.1:${PORT}`, BOOT_MS);
  await page.waitForFunction(() => window.__clock.boot && window.__clock.boot.done, null, { timeout: BOOT_MS });
  const warns = await prepPage(page);
  out = await page.evaluate(async (SAMPLES) => {
    const c = window.__clock, I = window.__I, THREE = c.THREE || null;
    const meshesOf = (name) => {
      const e = c.labelEntries.find((x) => x.name === name);
      const ms = [];
      e.obj.traverse((o) => { if (o.isMesh && !o.userData.schematic && o.geometry?.attributes?.position) ms.push(o); });
      return ms;
    };
    const A = meshesOf('Alarm silence rocker'), B = meshesOf('Alarm release feeler');
    // a name two meshes share (the rocker's two risers) is suffixed with its
    // index, so their rows are not merged into one
    const label = (ms, m) => !m.name ? `${m.geometry.type}#${ms.indexOf(m)}`
      : ms.filter((x) => x.name === m.name).length > 1 ? `${m.name}#${ms.indexOf(m)}` : m.name;
    // oriented box of a mesh: geometry bbox in local, carried by matrixWorld
    const obb = (m) => {
      m.geometry.computeBoundingBox();
      const bb = m.geometry.boundingBox, e = m.matrixWorld.elements;
      const lc = [(bb.min.x + bb.max.x) / 2, (bb.min.y + bb.max.y) / 2, (bb.min.z + bb.max.z) / 2];
      const h = [(bb.max.x - bb.min.x) / 2, (bb.max.y - bb.min.y) / 2, (bb.max.z - bb.min.z) / 2];
      const ctr = [0, 1, 2].map((i) => e[i] * lc[0] + e[4 + i] * lc[1] + e[8 + i] * lc[2] + e[12 + i]);
      const ax = [0, 1, 2].map((k) => {
        const v = [e[4 * k], e[4 * k + 1], e[4 * k + 2]], L = Math.hypot(...v);
        return { u: v.map((x) => x / L), r: h[k] * L };
      });
      return { ctr, ax };
    };
    const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
    const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
    const satDepth = (p, q) => {
      const T = [q.ctr[0] - p.ctr[0], q.ctr[1] - p.ctr[1], q.ctr[2] - p.ctr[2]];
      const axes = [...p.ax.map((a) => a.u), ...q.ax.map((a) => a.u)];
      for (const a of p.ax) for (const b of q.ax) { const x = cross(a.u, b.u), L = Math.hypot(...x); if (L > 1e-6) axes.push(x.map((v) => v / L)); }
      let depth = Infinity;
      for (const L of axes) {
        const rp = p.ax.reduce((s, a) => s + a.r * Math.abs(dot(a.u, L)), 0);
        const rq = q.ax.reduce((s, a) => s + a.r * Math.abs(dot(a.u, L)), 0);
        depth = Math.min(depth, rp + rq - Math.abs(dot(T, L)));
      }
      return depth;   // > 0 overlapping by this much; ≤ 0 separated
    };
    const poses = [];
    for (const ax of I.AXES) for (let k = 0; k < SAMPLES; k++) {
      const f = SAMPLES === 1 ? 0 : k / (SAMPLES - 1);
      poses.push({ tag: `${ax.name} f=${f.toFixed(3)}`, p: ax.pose(f, c) });
    }
    const HANDOFF = [
      ['disarmed', { tau: 0.13, crownPullT: 0, leverEngage: 0, tension: 1, alarmOn: 0, alarmCrownPullT: 0 }],
      ['armed', { tau: 0.13, crownPullT: 0, leverEngage: 0, tension: 1, alarmOn: 1, alarmCrownPullT: 0 }],
      ['setting', { tau: 0.13, crownPullT: 0, leverEngage: 0, tension: 1, alarmOn: 0, alarmCrownPullT: 1 }],
      ['dropped', { tau: 36535, crownPullT: 0, leverEngage: 0, tension: 1, alarmOn: 0, alarmCrownPullT: 0 }],
      // the silence's own case: dropped AND setting (the finger presses a risen tail)
      ['dropped+setting', { tau: 36535, crownPullT: 0, leverEngage: 0, tension: 1, alarmOn: 0, alarmCrownPullT: 1 }],
    ];
    for (const [tag, p] of HANDOFF) poses.push({ tag, p });
    const rows = new Map();
    const at = {};
    let n = 0;
    for (const { tag, p } of poses) {
      c.resetInputs(); c.setPose(p);
      for (const ma of A) for (const mb of B) {
        const d = I.meshClearance(ma, mb, 0.6);
        const key = `${label(A, ma)} ⇄ ${label(B, mb)}`;
        let r = rows.get(key);
        if (!r) rows.set(key, r = { pair: key, min: Infinity, at: '', depthMax: 0, depthMin: Infinity, contactPoses: 0 });
        if (d < r.min) { r.min = d; r.at = tag; }
        if (d <= 0) {
          const dep = satDepth(obb(ma), obb(mb));
          r.contactPoses++;
          r.depthMax = Math.max(r.depthMax, dep); r.depthMin = Math.min(r.depthMin, dep);
        }
        if (HANDOFF.some(([t]) => t === tag)) (at[tag] ??= {})[key] = +d.toFixed(4);
      }
      if (++n % 16 === 0) await new Promise((r) => setTimeout(r, 0));
    }
    // where the members stand, at rest and at the setting parity (world)
    const where = (tag, p) => {
      c.resetInputs(); c.setPose(p);
      const box = (m) => { const b = new m.geometry.boundingBox.constructor().setFromObject(m); return [b.min.x, b.max.x, b.min.y, b.max.y, b.min.z, b.max.z].map((v) => +v.toFixed(3)); };
      return Object.fromEntries([...A.map((m) => [`R:${label(A, m)}`, box(m)]), ...B.map((m) => [`F:${label(B, m)}`, box(m)])]);
    };
    const boxes = { rest: where('rest', HANDOFF[0][1]), setting: where('setting', HANDOFF[2][1]) };
    const handoffs = I.checkAlarmHandoffs(c);
    c.resetInputs();
    return {
      poses: poses.length,
      rows: [...rows.values()].filter((r) => r.min < 0.3).sort((p, q) => p.min - q.min)
        .map((r) => ({ ...r, min: +r.min.toFixed(4), depthMax: +r.depthMax.toFixed(4), depthMin: r.depthMin === Infinity ? null : +r.depthMin.toFixed(4) })),
      at, boxes,
      handoff: (handoffs.rows || handoffs.results || []).filter((r) => /rocker|feeler/.test(r.label || '')),
      handoffRaw: handoffs.rows ? undefined : Object.keys(handoffs),
    };
  }, SAMPLES);
  out.warns = warns;
  await context.close();
} finally {
  await browser.close();
  srv.kill();
}

console.log(`boot warns: ${out.warns.length}`);
for (const w of out.warns) console.log(`  · ${w}`);
console.log(`\n${out.poses} poses. Pairs under 0.3 (min clearance; SAT depth over contact poses):`);
for (const r of out.rows)
  console.log(`  ${r.min <= 0 ? 'CROSS' : r.min < 0.15 ? 'UNDER' : '     '}  ${r.pair.padEnd(58)} min ${String(r.min).padStart(7)} at ${r.at.padEnd(22)}`
    + (r.contactPoses ? `  contact at ${r.contactPoses} poses, depth ${r.depthMin}–${r.depthMax}` : ''));
console.log('\nAt the hand-off parities (pairs under 0.3 anywhere):');
const keys = out.rows.map((r) => r.pair);
for (const [tag, m] of Object.entries(out.at)) console.log(`  ${tag.padEnd(16)} ` + keys.map((k) => `${k.split(' ⇄ ').map((s) => s.replace(/^alarm/, '')).join('⇄')} ${m[k]}`).join(' | '));
console.log('\nHand-off rows naming the rocker or feeler:');
console.log(JSON.stringify(out.handoff, null, 1));
if (out.handoffRaw) console.log('handoff payload keys:', out.handoffRaw);
console.log('\nWorld boxes [x0,x1,y0,y1,z0,z1]:');
for (const [tag, b] of Object.entries(out.boxes)) { console.log(` ${tag}`); for (const [k, v] of Object.entries(b)) console.log(`   ${k.padEnd(34)} ${v.join(', ')}`); }

const tail = out.at.setting?.['alarmSilFinger ⇄ alarmFeelerTail'];
const far = Object.entries(out.at.setting || {}).find(([k]) => k.startsWith('alarmSilPaddle ⇄ alarmFeelerTip'))?.[1];   // absent from the map = beyond the 0.6 query bound
let bad = 0;
const ctl = (ok, what) => { console.log(`${ok ? 'PASS' : 'FAIL'}  control: ${what}`); if (!ok) bad++; };
ctl(tail !== undefined && tail <= 0.0001, `finger ⇄ tail reads contact at the setting parity (${tail})`);
ctl(far === undefined || far > 0.3, `paddle ⇄ feeler tip reads clear (${far ?? '> 0.6'})`);
process.exit(bad ? 1 : 0);
