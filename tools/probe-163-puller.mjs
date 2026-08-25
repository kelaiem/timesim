// §163 — A PULLING PAWL ON A FIXED POST OUTSIDE THE WHEEL, COPLANAR WITH THE SAW.
//
// TODO 87 step 3, third architecture measured. The two before it died for
// reasons this one is shaped to avoid:
//
//   · pawl pivoted on the RISER — the pivot rode the pusher, so it travelled a
//     straight chord: its azimuth about the wheel advanced 11° while the wheel
//     had to turn 30°, the arm supplied the missing 19° by swinging past
//     tangential (53° → 95° off radial) and lay down in the teeth. Measured
//     worst clearance −0.15, and shallowing the engagement did not save it.
//   · driver pivoted on the wheel's ARBOR — survives (measured, see
//     probe-163-driver.mjs), but its body has to pass UNDER the ratchet skirt,
//     and that stratum does not exist: the free band over the plate is one
//     CLEAR_MARGIN and a driver at floor stock needs 0.617.
//
// This one is the movement's OWN idiom, twice over: a pawl reaching in from a
// post outside the wheel, exactly as `alarmClickPawl` and the switch click
// already do. It stays COPLANAR with the saw on purpose — the column's height
// is spoken for by the riders stacked up it (lock beak, click, link beak), so
// solving this in z would spend a budget that belongs to them.
//
// THE MODEL. The pivot F is FIXED, so the nose rides a pure arc about it — no
// travelling pivot, which is what killed the riser. The nose PULLS: it bears on
// a tooth's radial cliff and drags it round. Contact is stated exactly rather
// than sampled: a cliff is a radial segment, so a nose of radius rn touching it
// sits at |N|·sin(azN − a) = rn, which gives the wheel angle in closed form and
// puts the contact at radius √(|N|² − rn²) — a number that must stay between
// root and tip or the nose is off the face it claims to be driving.
//
// Run: cd tools && node probe-163-puller.mjs
import { chromium } from 'playwright';
import { spawn } from 'node:child_process';

const srv = spawn('python3', ['-m', 'http.server', '8484', '--bind', '127.0.0.1'], { cwd: '..', stdio: 'ignore' });
await new Promise((r) => setTimeout(r, 900));
const b = await chromium.launch();
const p = await b.newPage();
p.on('pageerror', (e) => console.log('PAGEERROR', String(e)));
await p.goto('http://127.0.0.1:8484/index.html?hud=0&sync=0', { waitUntil: 'load', timeout: 90000 });
await p.waitForFunction(() => !!window.__clock, null, { timeout: 90000 });

const out = await p.evaluate(async () => {
  const clock = window.__clock;
  const unit = clock.labelEntries.find((e) => e.name === 'Alarm switch');
  let wheel = null;
  unit.obj.traverse((o) => { if (o.name === 'alarmColSkirt') wheel = o.parent; });
  const poly = wheel?.userData?.ratchetPoly;
  if (!poly) return { err: 'no ratchetPoly on the wheel group' };

  const P = poly.map((q) => ({ x: q.x, y: q.y }));
  const N = P.length;
  const R = P.map((q) => Math.hypot(q.x, q.y));
  const A = P.map((q) => Math.atan2(q.y, q.x));
  const rr = Math.min(...R), tip = Math.max(...R);
  const PITCH = (Math.PI * 2) / (N / 2);
  const wrap = (a) => Math.atan2(Math.sin(a), Math.cos(a));

  // handedness, READ off the polygon (probe-163-driver's rule, same reason:
  // geometry.js cuts the outline y-mirrored and assuming it tests the wrong
  // side of every tooth)
  let seatIdx = -1, cliffIdx = -1, flankIdx = -1;
  for (let i = 0; i < N; i++) {
    if (R[i] > (rr + tip) / 2) continue;
    const nx = (i + 1) % N, pv = (i - 1 + N) % N;
    if (Math.abs(wrap(A[nx] - A[i])) < 1e-6) { seatIdx = i; cliffIdx = nx; flankIdx = pv; break; }
    if (Math.abs(wrap(A[pv] - A[i])) < 1e-6) { seatIdx = i; cliffIdx = pv; flankIdx = nx; break; }
  }
  if (seatIdx < 0) return { err: 'no root corner with a radial cliff' };
  const returnDir = Math.sign(wrap(A[flankIdx] - A[seatIdx]));  // nose travels this way on the RETURN
  const cliffAz0 = A[seatIdx];

  const segD = (ax, ay, bx, by, qx, qy) => {
    const dx = bx - ax, dy = by - ay, l2 = dx * dx + dy * dy;
    let t = l2 === 0 ? 0 : ((qx - ax) * dx + (qy - ay) * dy) / l2;
    t = Math.max(0, Math.min(1, t));
    return Math.hypot(ax + t * dx - qx, ay + t * dy - qy);
  };
  const rot = (q, a) => ({ x: q.x * Math.cos(a) - q.y * Math.sin(a), y: q.x * Math.sin(a) + q.y * Math.cos(a) });
  const distToPolyAt = (qx, qy, phi) => {
    let d = Infinity;
    for (let i = 0; i < N; i++) {
      const a = rot(P[i], phi), c = rot(P[(i + 1) % N], phi);
      d = Math.min(d, segD(a.x, a.y, c.x, c.y, qx, qy));
    }
    return d;
  };
  const inPolyAt = (qx, qy, phi) => {
    let c = false;
    for (let i = 0, j = N - 1; i < N; j = i++) {
      const a = rot(P[i], phi), d = rot(P[j], phi);
      if ((a.y > qy) !== (d.y > qy) && qx < ((d.x - a.x) * (qy - a.y)) / (d.y - a.y) + a.x) c = !c;
    }
    return c;
  };
  const clearAt = (qx, qy, phi) => (inPolyAt(qx, qy, phi) ? -distToPolyAt(qx, qy, phi) : distToPolyAt(qx, qy, phi));

  // ——— the drive, in closed form ———
  // nose at pawl angle psi; the cliff it bears on sits one nose-offset away in
  // azimuth, on the FREE side (the flank side, which is returnDir).
  const noseAt = (F, L, psi) => ({ x: F.x + L * Math.cos(psi), y: F.y + L * Math.sin(psi) });
  function wheelAngleFor(F, L, psi, rn) {
    const n = noseAt(F, L, psi);
    const rN = Math.hypot(n.x, n.y);
    if (rN <= rn) return null;
    const contactR = Math.sqrt(rN * rN - rn * rn);
    if (contactR < rr || contactR > tip) return null;      // off the face it claims to drive
    const off = Math.asin(rn / rN);
    const a = Math.atan2(n.y, n.x) - returnDir * off;      // the cliff's azimuth
    return { phi: wrap(a - cliffAz0), contactR, n, rN };
  }

  const rn = 0.20, w = 0.15, MARGIN = 0.15;
  const POST_R = 0.28;                                     // the post's own radius, the click's
  const rows = [];
  for (const Rf of [7.2, 7.8, 8.5, 9.5, 10.5, 12.0]) {
    for (const azFdeg of [-70, -55, -40, -25, -10]) {
      for (const L of [2.0, 2.8, 3.6, 4.6, 5.8, 7.0]) {
        const azF = cliffAz0 + azFdeg * Math.PI / 180;
        const F = { x: Rf * Math.cos(azF), y: Rf * Math.sin(azF) };
        if (Rf - POST_R < tip + MARGIN) continue;          // the post itself must clear the saw
        // sweep psi over everything that keeps the nose on a cliff face
        const samples = [];
        for (let k = 0; k <= 2000; k++) {
          const psi = -Math.PI + k * (2 * Math.PI / 2000);
          const s = wheelAngleFor(F, L, psi, rn);
          if (s) samples.push({ psi, k, ...s });
        }
        if (samples.length < 20) continue;
        // find a contiguous run delivering one whole PITCH in the drive sense
        let bestRun = null;
        for (let i = 0; i < samples.length; i++) {
          for (let j = i + 1; j < samples.length; j++) {
            if (samples[j].psi - samples[i].psi > Math.PI) break;
            // the run must be CONTIGUOUS in the original psi sampling: `samples`
            // is a filtered array, so two entries can sit next to each other in
            // it while a gap where the nose left the cliff lies between them.
            // Spanning such a gap invents a drive stroke the pawl cannot make.
            if (samples[j].k - samples[i].k !== j - i) break;
            const d = wrap(samples[j].phi - samples[i].phi);
            if (Math.abs(Math.abs(d) - PITCH) < 2e-3 && Math.sign(d) === -returnDir) {
              const span = samples[j].psi - samples[i].psi;
              if (!bestRun || Math.abs(span) < Math.abs(bestRun.span)) bestRun = { i, j, span, d };
              break;
            }
          }
        }
        if (!bestRun) continue;
        // the ARM over that drive run: worst clearance, nose zone excluded
        let worst = Infinity, minC = Infinity, maxC = -Infinity;
        for (let k = bestRun.i; k <= bestRun.j; k += 2) {
          const s = samples[k];
          minC = Math.min(minC, s.contactR); maxC = Math.max(maxC, s.contactR);
          for (let e = 0; e < N; e++) {
            const a = rot(P[e], s.phi), c = rot(P[(e + 1) % N], s.phi);
            for (let t = 0; t <= 16; t++) {
              const qx = a.x + (c.x - a.x) * (t / 16), qy = a.y + (c.y - a.y) * (t / 16);
              if (Math.hypot(qx - s.n.x, qy - s.n.y) < 1.7 * rn) continue;
              worst = Math.min(worst, segD(F.x, F.y, s.n.x, s.n.y, qx, qy) - w);
            }
          }
        }
        rows.push({ Rf, azFdeg, L, psiA: samples[bestRun.i].psi, psiB: samples[bestRun.j].psi,
          swingDeg: +(Math.abs(bestRun.span) * 180 / Math.PI).toFixed(2),
          contact: [+minC.toFixed(3), +maxC.toFixed(3)],
          worstArm: +worst.toFixed(4),
          gain: +(Math.abs(bestRun.d) / Math.abs(bestRun.span)).toFixed(3),
          ok: worst >= MARGIN });
      }
    }
  }
  // CONTROL. Place a nose ANALYTICALLY at a known contact radius on the home
  // cliff, hand it to the same solver, and require it reads back that radius
  // and a wheel angle of zero. The first cut of this control sent the nose
  // OUTWARD from its post instead of inward and reported Infinity — which is
  // the control doing its job on itself.
  let ctl = 0;
  for (const cr of [5.3, 5.8, 6.2]) {
    const rN = Math.hypot(cr, rn);
    const azN = cliffAz0 + returnDir * Math.asin(rn / rN);
    const n = { x: rN * Math.cos(azN), y: rN * Math.sin(azN) };
    const F = { x: 17.3, y: -11.9 };                       // arbitrary, far outside
    const L = Math.hypot(n.x - F.x, n.y - F.y);
    const psi = Math.atan2(n.y - F.y, n.x - F.x);
    const s = wheelAngleFor(F, L, psi, rn);
    if (!s) { ctl = Infinity; break; }
    ctl = Math.max(ctl, Math.abs(s.contactR - cr), Math.abs(wrap(s.phi)));
  }

  // ——— IS THERE A SHAPED PAWL? ———
  // A straight arm is a proxy and it fails for every architecture tried: a nose
  // engaged near the root is reached from outside only by crossing a tooth. The
  // question that decides the design is the swept FREE REGION in the PAWL's own
  // frame over the WHOLE cycle — drive and return — flooded from the pivot.
  function cycleFree(F, L, psiA, psiB, rn, w) {
    const poses = [];
    // drive: the wheel follows the nose
    for (let k = 0; k <= 60; k++) {
      const psi = psiA + (psiB - psiA) * (k / 60);
      const s = wheelAngleFor(F, L, psi, rn);
      if (!s) return { reachable: false, why: 'the nose leaves the cliff face mid-drive' };
      poses.push({ psi, phi: s.phi, n: s.n });
    }
    // return: wheel HELD one pitch on, pawl swings back, nose rides the flank
    const phiEnd = poses[poses.length - 1].phi;
    let psi = psiB;
    const noseOf = (ps) => ({ x: F.x + L * Math.cos(ps), y: F.y + L * Math.sin(ps) });
    const freeAt = (ps) => { const q = noseOf(ps); return clearAt(q.x, q.y, phiEnd) >= rn - 1e-4; };
    const rOf = (ps) => { const q = noseOf(ps); return Math.hypot(q.x, q.y); };
    let lifted = -Infinity, landed = null;
    for (let k = 0; k <= 60; k++) {
      const target = psiB + (psiA - psiB) * (k / 60);
      // the spring presses the nose in; take the deepest pose that clears
      const inward = rOf(target + 1e-4) < rOf(target - 1e-4) ? 1 : -1;
      let ps = target;
      if (!freeAt(ps)) {
        for (let m = 1; m * 0.0008 <= 1.2; m++) { const t = target - inward * m * 0.0008; if (freeAt(t)) { ps = t; break; } }
      } else {
        for (let m = 1; m * 0.0008 <= 1.2; m++) { const t = target + inward * m * 0.0008; if (!freeAt(t)) break; ps = t; }
      }
      lifted = Math.max(lifted, rOf(ps));   // nose RADIUS, not a lift
      landed = ps;
      poses.push({ psi: ps, phi: phiEnd, n: noseOf(ps) });
    }
    // grid in the pawl's frame: u along the arm from the pivot, v across
    const DU = 0.04, U0 = -0.35, U1 = L + 0.45, V0 = -1.6, V1 = 1.6;
    const NU = Math.round((U1 - U0) / DU), NV = Math.round((V1 - V0) / DU);
    const okCell = new Uint8Array(NU * NV);
    for (let iu = 0; iu < NU; iu++) for (let iv = 0; iv < NV; iv++) {
      const u = U0 + iu * DU, v = V0 + iv * DU;
      const nearNose = Math.hypot(u - L, v) < rn + w;
      let good = true;
      for (const po of poses) {
        const c = Math.cos(po.psi), sn = Math.sin(po.psi);
        const x = F.x + u * c - v * sn, y = F.y + u * sn + v * c;
        if (clearAt(x, y, po.phi) < (nearNose ? rn * 0.5 : w)) { good = false; break; }
      }
      okCell[iu * NV + iv] = good ? 1 : 0;
    }
    const idx = (iu, iv) => iu * NV + iv;
    const su = Math.round((0 - U0) / DU), sv = Math.round((0 - V0) / DU);
    const tu = Math.round((L - U0) / DU);
    if (!okCell[idx(su, sv)]) return { reachable: false, why: 'the PIVOT itself is not free through the cycle' };
    const seen = new Uint8Array(NU * NV); const st = [[su, sv]]; seen[idx(su, sv)] = 1;
    let hit = false, area = 0;
    while (st.length) {
      const [iu, iv] = st.pop(); area++;
      if (Math.abs(iu - tu) <= 2 && Math.abs(iv - sv) <= 2) hit = true;
      for (const [du, dv] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const ju = iu + du, jv = iv + dv;
        if (ju < 0 || jv < 0 || ju >= NU || jv >= NV || seen[idx(ju, jv)] || !okCell[idx(ju, jv)]) continue;
        seen[idx(ju, jv)] = 1; st.push([ju, jv]);
      }
    }
    return { reachable: hit, area: +(area * DU * DU).toFixed(3), noseRmax: +(lifted).toFixed(3),
             why: hit ? 'pivot and nose lie in ONE connected free region over the whole cycle'
                      : 'the free region around the pivot does not reach the nose' };
  }
  // run it for the straight-arm rows, best clearance first
  const shaped = [];
  for (const r of rows.slice().sort((a, b) => b.worstArm - a.worstArm).slice(0, 6)) {
    const azF = cliffAz0 + r.azFdeg * Math.PI / 180;
    const F = { x: r.Rf * Math.cos(azF), y: r.Rf * Math.sin(azF) };
    shaped.push({ ...r, ...cycleFree(F, r.L, r.psiA, r.psiB, rn, w) });
  }

  return { rr, tip, PITCH, returnDir, rn, w, MARGIN, rows, ctl, shaped,
           teeth: N / 2, postR: POST_R };
});

await b.close();
srv.kill();
if (out.err) { console.log('FAIL:', out.err); process.exit(1); }

console.log(`\nsaw: ${out.teeth} teeth, root ${out.rr.toFixed(3)}, tip ${out.tip.toFixed(3)}, pitch ${(out.PITCH * 180 / Math.PI).toFixed(1)}°`);
console.log(`CONTROL (a nose placed rn off a cliff must read back its own contact radius and wheel angle): ${out.ctl.toExponential(2)} ${out.ctl < 1e-9 ? 'PASS' : 'BROKEN — ignore the table'}`);
console.log(`\n${out.rows.length} configurations deliver exactly one tooth with the nose on a cliff face.\n`);
console.log('  postR  postAz    L      pawl swing   contact radius   arm clear   verdict');
const sorted = out.rows.slice().sort((a, b) => b.worstArm - a.worstArm);
for (const r of sorted.slice(0, 18)) {
  console.log(`  ${r.Rf.toFixed(1).padStart(5)}  ${String(r.azFdeg).padStart(4)}°   ${r.L.toFixed(1)}    `
    + `${r.swingDeg.toFixed(2).padStart(6)}°     ${r.contact[0].toFixed(2)}–${r.contact[1].toFixed(2)}      `
    + `${(r.worstArm >= 0 ? '+' : '') + r.worstArm.toFixed(4).padStart(7)}   ${r.ok ? 'CLEARS' : 'fouls'}`);
}
console.log(`\nA straight arm is a proxy. For the six best rows, the swept free region over`);
console.log(`the WHOLE cycle (drive + return) decides whether a SHAPED pawl exists:`);
for (const sh of out.shaped) {
  console.log(`  post ${sh.Rf.toFixed(1)} @ ${String(sh.azFdeg).padStart(4)}°, arm ${sh.L.toFixed(1)}  `
    + `free ${String(sh.area ?? '—').padStart(6)} u²  noseRmax ${sh.noseRmax ?? '—'}  `
    + `${sh.reachable ? 'SHAPED PAWL EXISTS' : 'NO'} — ${sh.why}`);
}
const lives = out.shaped.filter((sh) => sh.reachable);
const good = out.rows.filter((r) => r.ok);
console.log(`\n${good.length} of ${out.rows.length} clear ${out.MARGIN} with a STRAIGHT arm on the drive stroke.`);
console.log(`${lives.length} of ${out.shaped.length} best rows admit a SHAPED pawl over the whole cycle.`);
if (lives.length) {
  const g = lives[0];
  console.log(`\nBEST: post at radius ${g.Rf}, ${g.azFdeg}° from the cliff, arm ${g.L}.`);
  console.log(`  the pawl swings ${g.swingDeg}° to deliver 30°; the contact rides ${g.contact[0]}–${g.contact[1]} `
    + `(root ${out.rr.toFixed(2)}, tip ${out.tip.toFixed(2)}); free region ${g.area} u².`);
  console.log('  A pulling pawl on a fixed post outside the wheel WORKS, coplanar with the saw.');
} else {
  console.log('\nNo shaped pawl survives the cycle at any of the best straight-arm stations.');
}
process.exit(lives.length ? 0 : 1);
