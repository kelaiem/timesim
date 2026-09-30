// §244 — does anything of the reset hammer BESIDES its roller reach the heart
// cam? Owner report after the contact-law fix: "part of the hammer arm phases
// through the cam when the cam is at its maximum radius". The contact law
// (heartFreeAngleAt) asks only where the ROLLER may be, so the lever's own
// outline (the flared head, the arm, the boss) is not held by anything in the
// tick law. The battery does not hold it either: `Heart cam ⇄ Reset hammer` is
// an EXPECTED pair with no EXPECTED_CONTACT_FLOORS row, so TODO 6's blanket
// excuses the whole pair.
//
// ACCEPTANCE. It steps the shipped eased crown pull (and the push back in) at
// 1/60 s from 24 cam phases round the turn, and at every frame measures, in
// plan and against the heart's CUT profile dilated by its bevel (the heart is
// the Minkowski sum of the cut outline and a bevel disc, so its distance field
// is the outline's less `bevel`):
//   · BODY — the lever's bevel-dilated outline (userData.outline pushed out by
//     its miter, the same expansion HAMMER_SWING_RAD's solve uses), sampled
//     densely along every edge, plus the pivot boss circle. Signed: negative
//     is metal inside metal.
//   · ROLLER — the roller circle against the same heart, which is the working
//     contact and must read ~0 at first touch and never go deep.
// PASS iff BODY ≥ CLEAR_MARGIN (0.15) at every frame, and boot is silent
// (rule 6: the head's width solve and the ride assert both warn at boot).
//
// Controls, both asserted: the ROLLER must actually touch at some frame
// (|gap| ≤ 0.02 — a sweep that never brings the parts together measures
// nothing), and a must-hit control moves the heart's axis onto the lever's
// head and requires BODY < 0 there (a signed-distance routine with its sign
// backwards would pass everything).
//
// NOT probe-reset-contact.mjs (roller only, vertex gap) and not
// probe-244-shot.mjs (metal vs plan gap at first motion, a report).
//
// cd tools && node probe-244-lever-body.mjs
import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
const port = process.env.PORT || '8551';
const srv = spawn('python3', ['-m', 'http.server', port, '--bind', '127.0.0.1'], { cwd: '..', stdio: 'ignore' });
await new Promise((r) => setTimeout(r, 900));
const browser = await chromium.launch();
const page = await browser.newPage();
page.on('pageerror', (e) => console.log('PAGEERROR', String(e)));
await page.goto(`http://127.0.0.1:${port}/index.html`, { waitUntil: 'load', timeout: 90000 });
await page.waitForFunction(() => !!window.__clock, null, { timeout: 90000 });
// The app's own record of its boot warnings, the list the battery's rule-6 gate
// reads — not the console, which also carries the browser's GL chatter.
const bootWarnings = await page.evaluate(() => (window.__clock.bootWarns || []).slice());

const res = await page.evaluate(() => {
  const C = window.__clock;
  const MARGIN = 0.15;
  const find = (n) => C.labelEntries.find((e) => e.name === n)?.obj ?? null;
  const arbor = find('Heart cam (seconds reset)'), hamGroup = find('Reset hammer');
  let heart = null, lever = null;
  arbor.traverse((o) => { if (!heart && o.userData && o.userData.rMin !== undefined) heart = o; });
  hamGroup.traverse((o) => { if (!lever && o.userData && o.userData.outline) lever = o; });
  const { r: R, rMin, bevel: hb } = heart.userData;
  const { outline, bevel: lb, rollerR, bossR, length: L } = lever.userData;

  // The lever's dilated outline, in its own frame (the swing solve's miter).
  const n = outline.length;
  const area = outline.reduce((s, p, i) => { const q = outline[(i + 1) % n]; return s + p[0] * q[1] - q[0] * p[1]; }, 0);
  const ccw = area > 0 ? 1 : -1;
  const eN = (ux, uy) => { const m = Math.hypot(ux, uy) || 1; return [(ccw * uy) / m, (-ccw * ux) / m]; };
  const dil = outline.map((p, i) => {
    const a = outline[(i - 1 + n) % n], b = outline[(i + 1) % n];
    const n1 = eN(p[0] - a[0], p[1] - a[1]), n2 = eN(b[0] - p[0], b[1] - p[1]);
    let mx = n1[0] + n2[0], my = n1[1] + n2[1];
    const mm = Math.hypot(mx, my) || 1; mx /= mm; my /= mm;
    const c = Math.max(mx * n1[0] + my * n1[1], 0.1);
    return [p[0] + (mx * lb) / c, p[1] + (my * lb) / c];
  });
  const bodyPts = [];
  for (let i = 0; i < dil.length; i++) {
    const [ax, ay] = dil[i], [bx, by] = dil[(i + 1) % dil.length];
    const k = Math.max(2, Math.ceil(Math.hypot(bx - ax, by - ay) / 0.02));
    for (let j = 0; j < k; j++) bodyPts.push([ax + ((bx - ax) * j) / k, ay + ((by - ay) * j) / k, i]);
  }
  for (let j = 0; j < 96; j++) { const t = (j / 96) * 2 * Math.PI; bodyPts.push([bossR * Math.cos(t), bossR * Math.sin(t), 'boss']); }

  // Heart signed distance (heart-local point): cut curve distance − bevel,
  // negative inside. Scan then ternary refine, as heartFreeAngleAt's solve does.
  const rAt = (t) => rMin + (R - rMin) * (1 - Math.cos(t)) / 2;
  const N = 360;
  const heartSD = (x, y) => {
    const d2 = (t) => { const r = rAt(t); const dx = r * Math.cos(t) - x, dy = r * Math.sin(t) - y; return dx * dx + dy * dy; };
    let m = Infinity, best = 0;
    for (let i = 0; i < N; i++) { const t = (i / N) * 2 * Math.PI; const q = d2(t); if (q < m) { m = q; best = t; } }
    let lo = best - (2 * Math.PI) / N, hi = best + (2 * Math.PI) / N;
    for (let it = 0; it < 30; it++) { const a = lo + (hi - lo) / 3, b = hi - (hi - lo) / 3; if (d2(a) < d2(b)) hi = b; else lo = a; }
    const inside = Math.hypot(x, y) < rAt(Math.atan2(y, x));
    return (inside ? -1 : 1) * Math.sqrt(d2((lo + hi) / 2)) - hb;
  };
  const toHeart = (m, x, y) => {
    // lever-local (x, y, 0) → world via `m` (lever matrixWorld) → heart local
    const e = m.elements;
    const wx = e[0] * x + e[4] * y + e[12], wy = e[1] * x + e[5] * y + e[13];
    heart.updateWorldMatrix(true, false);
    const h = heart.matrixWorld.elements;          // rotation about z + translation
    const dx = wx - h[12], dy = wy - h[13];
    return [h[0] * dx + h[1] * dy, h[4] * dx + h[5] * dy];
  };
  const measure = () => {
    lever.updateWorldMatrix(true, false);
    const m = lever.matrixWorld;
    let body = Infinity, where = null;
    for (const [x, y, tag] of bodyPts) {
      const [hx, hy] = toHeart(m, x, y);
      const s = heartSD(hx, hy);
      if (s < body) { body = s; where = tag; }
    }
    const [rx, ry] = toHeart(m, 0, L);
    return { body, where, roller: heartSD(rx, ry) - rollerR };
  };

  // Must-hit control: the same routine, with the heart's AXIS placed on the
  // lever's head (the lever-local point (0, 0.9L)) — body must read < 0.
  const control = (() => {
    lever.updateWorldMatrix(true, false);
    const e = lever.matrixWorld.elements;
    let worst = Infinity;
    for (const [x, y] of bodyPts) {
      const dx = x - 0, dy = y - 0.9 * L;          // heart centred at lever (0, 0.9L), unrotated
      worst = Math.min(worst, heartSD(dx, dy));
    }
    return worst;
  })();

  const rows = [];
  let touched = false;
  for (let k = 0; k < 24; k++) {
    C.resetInputs();
    C.setPose({ tau: 0, crownPullT: 0, leverEngage: 0, tension: 1 });
    for (let i = 0; i < 10 + k * 25; i++) C.step(0.1);            // 24 cam phases, 2.5 s apart
    let worst = { body: Infinity }, rollerMin = Infinity;
    const run = () => {
      for (let i = 0; i < 90; i++) {
        C.step(1 / 60);
        const m = measure();
        if (m.body < worst.body) worst = { ...m, frame: i };
        rollerMin = Math.min(rollerMin, Math.abs(m.roller));
      }
    };
    document.getElementById('btn-crown').click(); run();          // pull: the reset
    document.getElementById('btn-crown').click(); run();          // push: the hammer lifts off
    if (rollerMin <= 0.02) touched = true;
    rows.push({ phase: k, body: worst.body, where: worst.where, rollerAtWorst: worst.roller, rollerMin });
  }
  return { rows, touched, control, MARGIN, dims: { R, rMin, hb, lb, rollerR, bossR, L, outline } };
});

console.log(`boot warnings (rule 6): ${bootWarnings.length}`);
for (const w of bootWarnings) console.log('  ' + w.slice(0, 300));
console.log('dims', JSON.stringify(res.dims));
console.log(`control (heart axis on the head): body ${res.control.toFixed(4)} — must be < 0`);
console.log('phase | worst body clearance | where (outline edge # or boss) | roller gap there | closest roller |gap|');
for (const r of res.rows)
  console.log(`${String(r.phase).padStart(5)} | ${r.body.toFixed(4).padStart(9)} | ${String(r.where).padStart(5)} | ${r.rollerAtWorst.toFixed(4).padStart(8)} | ${r.rollerMin.toFixed(4)}`);
const worst = Math.min(...res.rows.map((r) => r.body));
const bad = res.rows.filter((r) => r.body < res.MARGIN);
console.log(`\nworst body clearance over every frame: ${worst.toFixed(4)} (need ≥ ${res.MARGIN})`);
console.log(`phases under the margin: ${bad.length}/${res.rows.length}`);
console.log(`control fired: ${res.control < 0 ? 'yes' : 'NO'} · roller touched in some phase: ${res.touched ? 'yes' : 'NO'}`);
await browser.close();
srv.kill();
process.exit(bad.length || bootWarnings.length || !(res.control < 0) || !res.touched ? 1 : 0);
