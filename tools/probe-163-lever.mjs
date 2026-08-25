// §163 — THE TWO-BODY CHAIN: a driving pawl carried on an operating lever.
//
// TODO 87 step 3, fourth architecture. The three before it, all measured:
//
//   · pawl on the RISER — its pivot rode the pusher, so it travelled a STRAIGHT
//     LINE. Its azimuth about the wheel advanced 11° while the wheel had to turn
//     30°; the arm supplied the missing 19° by swinging past tangential
//     (53° → 95° off radial) and lay down in the teeth. Worst clearance −0.15.
//   · driver on the wheel's ARBOR — its pivot rides a circle CONCENTRIC with the
//     wheel, so on the drive nothing moves relative to the teeth. Survives:
//     shaped member exists at the as-cut depth (probe-163-driver.mjs). Its cost
//     is a z-stratum the movement does not currently have.
//   · single-body pawl on a FIXED outside post, pulling — its nose slides
//     radially along the cliff as it pulls and one pitch drags it off the face
//     (probe-163-puller.mjs).
//
// Read together those three say the governing variable is WHAT PATH THE PAWL'S
// PIVOT TRAVELS: a straight line fails, a concentric circle works. This one is
// the real chronograph answer and it sits between them — the pawl pivots on an
// OPERATING LEVER, which itself pivots on a fixed post outside the wheel, so the
// pawl's pivot rides an arc of radius `a` about that post. Coplanar with the saw
// throughout: the column's height belongs to the riders stacked up it.
//
// The three architectures are then one family with one parameter, which is why
// this probe can be controlled against a verified sibling: put the lever's post
// AT the wheel's axis and the pivot's arc becomes concentric, so this must
// reproduce probe-163-driver.mjs exactly. That is control A below.
//
// CONTROLS RUN AND PRINT FIRST, and the run aborts before showing any table if
// either fails. Four instrument faults in this session produced plausible tables
// attached to broken solvers — a constant −0.15 across 36 configurations, a
// pawl angle carried in the wrong frame, a drive run spanning a gap in its own
// samples, a control that sent its nose the wrong way. A table nobody can trust
// is worse than no table, because it reads exactly like a result.
//
// Run: cd tools && node probe-163-lever.mjs
import { chromium } from 'playwright';
import { spawn } from 'node:child_process';

const srv = spawn('python3', ['-m', 'http.server', '8485', '--bind', '127.0.0.1'], { cwd: '..', stdio: 'ignore' });
await new Promise((r) => setTimeout(r, 900));
const b = await chromium.launch();
const p = await b.newPage();
p.on('pageerror', (e) => console.log('PAGEERROR', String(e)));
await p.goto('http://127.0.0.1:8485/index.html?hud=0&sync=0', { waitUntil: 'load', timeout: 90000 });
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

  // handedness READ off the polygon — geometry.js cuts it y-mirrored, and
  // assuming the sense tests the wrong side of every tooth (§43's postscript).
  let seatIdx = -1, cliffIdx = -1, flankIdx = -1;
  for (let i = 0; i < N; i++) {
    if (R[i] > (rr + tip) / 2) continue;
    const nx = (i + 1) % N, pv = (i - 1 + N) % N;
    if (Math.abs(wrap(A[nx] - A[i])) < 1e-6) { seatIdx = i; cliffIdx = nx; flankIdx = pv; break; }
    if (Math.abs(wrap(A[pv] - A[i])) < 1e-6) { seatIdx = i; cliffIdx = pv; flankIdx = nx; break; }
  }
  if (seatIdx < 0) return { err: 'no root corner with a radial cliff' };
  const returnDir = Math.sign(wrap(A[flankIdx] - A[seatIdx]));
  const driveDir = -returnDir;

  const segD = (ax, ay, bx, by, qx, qy) => {
    const dx = bx - ax, dy = by - ay, l2 = dx * dx + dy * dy;
    let t = l2 === 0 ? 0 : ((qx - ax) * dx + (qy - ay) * dy) / l2;
    t = Math.max(0, Math.min(1, t));
    return Math.hypot(ax + t * dx - qx, ay + t * dy - qy);
  };
  const rot = (q, a) => ({ x: q.x * Math.cos(a) - q.y * Math.sin(a), y: q.x * Math.sin(a) + q.y * Math.cos(a) });
  const clearAt = (qx, qy, phi) => {
    let d = Infinity, inside = false;
    for (let i = 0; i < N; i++) {
      const a = rot(P[i], phi), c = rot(P[(i + 1) % N], phi);
      d = Math.min(d, segD(a.x, a.y, c.x, c.y, qx, qy));
    }
    for (let i = 0, j = N - 1; i < N; j = i++) {
      const a = rot(P[i], phi), c = rot(P[j], phi);
      if ((a.y > qy) !== (c.y > qy) && qx < ((c.x - a.x) * (qy - a.y)) / (c.y - a.y) + a.x) inside = !inside;
    }
    return inside ? -d : d;
  };

  // the corner seat for a nose of radius rn — bisector of the interior angle
  const seatFor = (rn) => {
    const C = P[seatIdx], E1 = P[cliffIdx], E2 = P[flankIdx];
    const u1 = { x: E1.x - C.x, y: E1.y - C.y }, u2 = { x: E2.x - C.x, y: E2.y - C.y };
    const m1 = Math.hypot(u1.x, u1.y), m2 = Math.hypot(u2.x, u2.y);
    u1.x /= m1; u1.y /= m1; u2.x /= m2; u2.y /= m2;
    const bx = u1.x + u2.x, by = u1.y + u2.y, bm = Math.hypot(bx, by);
    const half = Math.acos(Math.max(-1, Math.min(1, u1.x * u2.x + u1.y * u2.y))) / 2;
    const st = rn / Math.sin(half);
    return { x: C.x + (bx / bm) * st, y: C.y + (by / bm) * st };
  };

  // ——— the chain ———
  // E: the lever's fixed post.  Q: the pawl's pivot, riding an arc of radius `a`
  // about E at lever angle lam.  N: the nose, L from Q, seated at Rseat.
  const qAt = (E, a, lam) => ({ x: E.x + a * Math.cos(lam), y: E.y + a * Math.sin(lam) });
  // nose azimuth with the nose SEATED at Rseat: circle(Q,L) ∩ circle(O,Rseat)
  function noseAzOf(Q, L, Rseat, branch) {
    const dq = Math.hypot(Q.x, Q.y);
    const c = (dq * dq + Rseat * Rseat - L * L) / (2 * dq * Rseat);
    if (Math.abs(c) > 1) return null;
    return Math.atan2(Q.y, Q.x) + branch * Math.acos(c);
  }

  // ——————————————— CONTROLS ———————————————
  const controls = [];
  // A. DEGENERATE TO THE VERIFIED SIBLING. Put the post at the wheel's axis and
  //    the pivot's arc is concentric, so this is probe-163-driver's case: with
  //    the pawl RIGID on the lever the whole assembly rotates one pitch and the
  //    nose must land exactly on the next corner. Ties this probe to one whose
  //    own control already passed at 2.7e-15.
  {
    const rn = 0.20, Rseat0 = Math.hypot(seatFor(rn).x, seatFor(rn).y);
    const E = { x: 0, y: 0 }, a = 6.6;
    const seat = seatFor(rn);
    const lam0 = Math.atan2(seat.y, seat.x) + returnDir * (36 * Math.PI / 180);
    const Q0 = qAt(E, a, lam0);
    const L = Math.hypot(seat.x - Q0.x, seat.y - Q0.y);
    const phi0 = Math.atan2(seat.y - Q0.y, seat.x - Q0.x) - lam0;   // pawl angle in the LEVER's frame
    const lam1 = lam0 + returnDir * PITCH;
    const Q1 = qAt(E, a, lam1);
    const nEnd = { x: Q1.x + L * Math.cos(phi0 + lam1), y: Q1.y + L * Math.sin(phi0 + lam1) };
    const tgt = rot(seat, returnDir * PITCH);
    controls.push({ name: 'A · concentric post degenerates to the arbor driver',
      err: Math.hypot(nEnd.x - tgt.x, nEnd.y - tgt.y), tol: 1e-9, Rseat0 });
  }
  // B. THE SEAT IS ON THE METAL. A nose placed at the computed corner seat must
  //    touch the outline at exactly its own radius — not float, not bite.
  {
    const rn = 0.20, s = seatFor(rn);
    controls.push({ name: 'B · the corner seat touches the saw at exactly rn',
      err: Math.abs(clearAt(s.x, s.y, 0) - rn), tol: 1e-6 });
  }
  // C. THE SEATED SOLVE INVERTS. Given a seated nose, noseAzOf must return the
  //    azimuth it was built from, for a pivot anywhere.
  {
    const rn = 0.20, s = seatFor(rn), Rseat = Math.hypot(s.x, s.y);
    let worst = 0;
    for (const [qx, qy] of [[9.1, -3.2], [7.4, 5.1], [-8.8, 2.0]]) {
      const Q = { x: qx, y: qy };
      const L = Math.hypot(s.x - Q.x, s.y - Q.y);
      const want = Math.atan2(s.y, s.x);
      let best = Infinity;
      for (const br of [1, -1]) {
        const got = noseAzOf(Q, L, Rseat, br);
        if (got !== null) best = Math.min(best, Math.abs(wrap(got - want)));
      }
      worst = Math.max(worst, best);
    }
    controls.push({ name: 'C · the seated circle/circle solve inverts', err: worst, tol: 1e-9 });
  }
  if (controls.some((c) => !(c.err <= c.tol))) return { controls, aborted: true };

  // ——————————————— THE SWEEP ———————————————
  const rn = 0.20, w = 0.15, MARGIN = 0.15, POST_R = 0.28;
  const seat = seatFor(rn), Rseat = Math.hypot(seat.x, seat.y);
  const azSeat = Math.atan2(seat.y, seat.x);
  const rows = [];
  for (const Re of [9.5, 11.0, 13.0, 15.5, 18.0, 22.0]) {
    if (Re - POST_R < tip + MARGIN) continue;
    for (const azEdeg of [-80, -60, -40, -20, 0, 20]) {
      const E = { x: Re * Math.cos(azSeat + azEdeg * Math.PI / 180), y: Re * Math.sin(azSeat + azEdeg * Math.PI / 180) };
      for (const a of [1.5, 2.5, 3.5, 5.0, 7.0]) {
        for (const L of [1.5, 2.2, 3.0, 4.0, 5.5]) {
          for (const branch of [1, -1]) {
            // scan the lever angle; the nose stays seated, so the wheel angle is
            // the nose's azimuth less the seat's own offset
            const S = [];
            for (let k = 0; k <= 1200; k++) {
              const lam = -Math.PI + k * (2 * Math.PI / 1200);
              const Q = qAt(E, a, lam);
              if (Math.hypot(Q.x, Q.y) - 0 < 0) continue;
              const az = noseAzOf(Q, L, Rseat, branch);
              if (az === null) continue;
              S.push({ k, lam, az, Q });
            }
            if (S.length < 30) continue;
            // a CONTIGUOUS run delivering exactly one pitch in the drive sense
            let run = null;
            for (let i = 0; i < S.length && !run; i++) {
              for (let j = i + 1; j < S.length; j++) {
                if (S[j].k - S[i].k !== j - i) break;                 // gap: not a stroke
                const d = wrap(S[j].az - S[i].az);
                if (Math.sign(d) !== driveDir) continue;
                if (Math.abs(Math.abs(d) - PITCH) < 2e-3) { run = { i, j, d }; break; }
                if (Math.abs(d) > PITCH + 0.05) break;
              }
            }
            if (!run) continue;
            const swing = Math.abs(S[run.j].lam - S[run.i].lam);
            // THE NUMBER THAT EXPLAINS ALL FOUR ARCHITECTURES. However the
            // pawl's pivot is carried, what matters is how far its azimuth
            // ABOUT THE WHEEL advances over the stroke. The wheel must turn one
            // pitch; whatever the pivot does not supply, the pawl has to make up
            // by swinging on its own axis — and a pawl swinging while its nose
            // is engaged is exactly what lies down in the teeth (riser) or fails
            // to retreat a full pitch on the way back (here). The arbor driver
            // works because this number IS the pitch, by construction.
            const pivAdv = Math.abs(wrap(Math.atan2(S[run.j].Q.y, S[run.j].Q.x)
                                       - Math.atan2(S[run.i].Q.y, S[run.i].Q.x)));
            // the pawl BAR over the drive, nose zone excluded
            let worst = Infinity, pivotMin = Infinity;
            for (let k = run.i; k <= run.j; k += 2) {
              const s = S[k];
              const phi = wrap(s.az - azSeat);
              const n = { x: Rseat * Math.cos(s.az), y: Rseat * Math.sin(s.az) };
              pivotMin = Math.min(pivotMin, Math.hypot(s.Q.x, s.Q.y));
              for (let e = 0; e < N; e++) {
                const p1 = rot(P[e], phi), p2 = rot(P[(e + 1) % N], phi);
                for (let t = 0; t <= 14; t++) {
                  const qx = p1.x + (p2.x - p1.x) * (t / 14), qy = p1.y + (p2.y - p1.y) * (t / 14);
                  if (Math.hypot(qx - n.x, qy - n.y) < 1.7 * rn) continue;
                  worst = Math.min(worst, segD(s.Q.x, s.Q.y, n.x, n.y, qx, qy) - w);
                }
              }
            }
            if (pivotMin < tip + MARGIN) continue;      // the pawl's own pivot must clear the saw
            rows.push({ Re, azEdeg, a, L, branch,
              swingDeg: +(swing * 180 / Math.PI).toFixed(2),
              pivAdvDeg: +(pivAdv * 180 / Math.PI).toFixed(2),
              gain: +(PITCH / swing).toFixed(3),
              pivotMin: +pivotMin.toFixed(3),
              worstArm: +worst.toFixed(4),
              // THE RUN'S ENDPOINTS ARE LAMBDAS, NOT INDICES. `S` is a filtered
              // array, so S[i] is not the i-th sample of the lambda grid — the
              // fifth instance this session of using a filtered array's indices
              // as if they indexed the original. Carry the angles themselves.
              lamA: S[run.i].lam, lamB: S[run.j].lam, ok: worst >= MARGIN });
          }
        }
      }
    }
  }
  rows.sort((x, y) => y.worstArm - x.worstArm);

  // ——— THE RETURN, and whether a SHAPED pawl survives the whole cycle ———
  // A drive-only verdict is exactly the incompleteness that promoted the puller:
  // four of its configurations passed the drive and every one died on the cycle.
  // Here the wheel is HELD one pitch on, the lever swings back, and the nose
  // must ride out over a flank and drop into the next corner. The pawl's angle
  // is carried in the LEVER's frame (phi = psi − lam) so a pawl that does not
  // move on its own pivot still swings at the lever's rate — carrying it in the
  // wheel's frame drags it backwards against its own lever every step.
  function cycle(E, a, L, branch, lamA, lamB, wStep) {
    const poses = [];
    for (let k = 0; k <= 60; k++) {
      const lam = lamA + (lamB - lamA) * (k / 60);
      const Q = qAt(E, a, lam);
      const az = noseAzOf(Q, L, Rseat, branch);
      if (az === null) return { reachable: false, why: 'the nose unseats mid-drive' };
      poses.push({ Q, lam, psi: Math.atan2(Rseat * Math.sin(az) - Q.y, Rseat * Math.cos(az) - Q.x),
                   phi: wrap(az - azSeat), n: { x: Rseat * Math.cos(az), y: Rseat * Math.sin(az) } });
    }
    const phiEnd = poses[poses.length - 1].phi;
    let ph = poses[poses.length - 1].psi - lamB;             // pawl angle in the LEVER's frame
    let landedErr = null, landedK = null, seatedAt = null, seatedK = null, noseRmax = -Infinity;
    // OVERTRAVEL IS REAL, AND THE FIRST CUT FORBADE IT. Demanding the nose be
    // seated at exactly lamA over-constrains the mechanism: on the drive the
    // nose is SEATED (pinned to Rseat) while on the return the spring lifts it
    // over the tip, so the two strokes are not the same path and the nose ends
    // short — measured, 1.29–1.38 from a corner at every station, which is one
    // tooth depth, i.e. sitting on the tip. A real operating lever returns to a
    // banking stop past where it drove and the pawl drops in on the way. So
    // sweep PAST lamA and report the smallest overtravel at which the nose
    // actually seats: a bounded number is a declarable design quantity, and no
    // seat at all is a real failure.
    const STEPS_R = 140;
    for (let k = 1; k <= STEPS_R; k++) {
      const lam = lamB + (lamA - lamB) * (k / 60);
      const Q = qAt(E, a, lam);
      const at = (t) => ({ x: Q.x + L * Math.cos(t), y: Q.y + L * Math.sin(t) });
      const free = (t) => { const q = at(t); return clearAt(q.x, q.y, phiEnd) >= rn - 1e-4; };
      const rOf = (t) => { const q = at(t); return Math.hypot(q.x, q.y); };
      let th = ph + lam;                                      // rigid prediction
      const inward = rOf(th + 1e-4) < rOf(th - 1e-4) ? 1 : -1;
      if (!free(th)) {
        let got = false;
        for (let m = 1; m * 0.0008 <= 1.4; m++) { const t = th - inward * m * 0.0008; if (free(t)) { th = t; got = true; break; } }
        if (!got) return { reachable: false, why: 'the nose cannot clear the tooth on the way back' };
      } else {
        for (let m = 1; m * 0.0008 <= 1.4; m++) { const t = th + inward * m * 0.0008; if (!free(t)) break; th = t; }
      }
      ph = th - lam;
      noseRmax = Math.max(noseRmax, rOf(th));
      poses.push({ Q, lam, psi: th, phi: phiEnd, n: at(th) });
      {
        // WHICH CORNER SHOULD IT LAND IN? The wheel has turned one pitch and the
        // nose has ridden one pitch back relative to it, so in WORLD terms the
        // cycle is periodic and the nose returns to the corner it started from.
        // Rather than assert that sign — it was wrong the first time, by a whole
        // pitch — measure the distance to the NEAREST corner of the rotated
        // wheel and report which one, so a sign error shows up as `k` rather
        // than hiding inside a large error.
        const q = at(th);
        let best = Infinity, bm = null;
        for (let m = -2; m <= 2; m++) {
          const c = rot(seat, phiEnd + m * PITCH);
          const d = Math.hypot(q.x - c.x, q.y - c.y);
          if (d < best) { best = d; bm = m; }
        }
        if (landedErr === null || best < landedErr) { landedErr = best; landedK = bm; }
        // SEATED MEANS THE RIGHT CORNER, not merely a near one. Early in the
        // return the nose is still beside the corner it just drove (k=0) and a
        // distance test alone accepts that as a landing. What the cycle needs
        // is the corner ONE PITCH BACK relative to the wheel — k = returnDir.
        // The first cut guarded this with `k >= 55`, an arbitrary fraction of
        // the sweep, which rejected real landings and would have accepted a
        // wrong one at a different geometry.
        if (best <= 0.06 && bm === returnDir && seatedAt === null) { seatedAt = k; seatedK = bm; }
      }
      if (seatedAt !== null) break;
    }
    if (seatedAt === null) return { reachable: false, why: `never seats — closest ${landedErr.toFixed(2)} from a corner (k=${landedK})`, noseRmax: +noseRmax.toFixed(3) };
    const overDeg = Math.abs((lamA - lamB) * (seatedAt - 60) / 60) * 180 / Math.PI;
    // swept FREE REGION in the pawl's own frame over the whole cycle
    const DU = 0.05, U0 = -0.35, U1 = L + 0.45, V0 = -1.5, V1 = 1.5;
    const NU = Math.round((U1 - U0) / DU), NV = Math.round((V1 - V0) / DU);
    const okc = new Uint8Array(NU * NV);
    for (let iu = 0; iu < NU; iu++) for (let iv = 0; iv < NV; iv++) {
      const u = U0 + iu * DU, v = V0 + iv * DU;
      const nearNose = Math.hypot(u - L, v) < rn + wStep;
      let good = true;
      for (const po of poses) {
        const c = Math.cos(po.psi), sn = Math.sin(po.psi);
        const x = po.Q.x + u * c - v * sn, y = po.Q.y + u * sn + v * c;
        if (clearAt(x, y, po.phi) < (nearNose ? rn * 0.5 : wStep)) { good = false; break; }
      }
      okc[iu * NV + iv] = good ? 1 : 0;
    }
    const idx = (iu, iv) => iu * NV + iv;
    const su = Math.round((0 - U0) / DU), sv = Math.round((0 - V0) / DU), tu = Math.round((L - U0) / DU);
    if (!okc[idx(su, sv)]) return { reachable: false, why: 'the pawl PIVOT is not free through the cycle', noseRmax: +noseRmax.toFixed(3) };
    const seen = new Uint8Array(NU * NV); const st = [[su, sv]]; seen[idx(su, sv)] = 1;
    let hit = false, area = 0;
    while (st.length) {
      const [iu, iv] = st.pop(); area++;
      if (Math.abs(iu - tu) <= 2 && Math.abs(iv - sv) <= 2) hit = true;
      for (const [du, dv] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const ju = iu + du, jv = iv + dv;
        if (ju < 0 || jv < 0 || ju >= NU || jv >= NV || seen[idx(ju, jv)] || !okc[idx(ju, jv)]) continue;
        seen[idx(ju, jv)] = 1; st.push([ju, jv]);
      }
    }
    return { reachable: hit, area: +(area * DU * DU).toFixed(3), noseRmax: +noseRmax.toFixed(3), landedErr: +landedErr.toFixed(4), landedK: seatedK, overDeg: +overDeg.toFixed(2),
             why: hit ? 'pivot and nose in ONE connected free region over drive AND return' : 'the free region does not reach the nose' };
  }
  const shaped = [];
  for (const r of rows.slice(0, 10)) {
    const E = { x: r.Re * Math.cos(azSeat + r.azEdeg * Math.PI / 180), y: r.Re * Math.sin(azSeat + r.azEdeg * Math.PI / 180) };
    shaped.push({ ...r, ...cycle(E, r.a, r.L, r.branch, r.lamA, r.lamB, w) });
  }
  return { rr, tip, PITCH, returnDir, rn, w, MARGIN, Rseat: +Rseat.toFixed(4),
           teeth: N / 2, controls, rows: rows.slice(0, 40), shaped, total: rows.length,
           clears: rows.filter((r) => r.ok).length };
});

await b.close();
srv.kill();
if (out.err) { console.log('FAIL:', out.err); process.exit(1); }

console.log('\nCONTROLS (printed before any table; the run aborts if one fails)');
for (const c of out.controls) {
  console.log(`  ${(c.err <= c.tol ? 'PASS' : 'FAIL')}  ${c.name}  —  ${c.err.toExponential(2)} against ${c.tol.toExponential(0)}`);
}
if (out.aborted) { console.log('\nABORTED: a control failed, so no table is shown. Fix the solver first.'); process.exit(2); }

console.log(`\nsaw: ${out.teeth} teeth, root ${out.rr.toFixed(3)}, tip ${out.tip.toFixed(3)}; nose seats at ${out.Rseat}`);
console.log(`${out.total} configurations deliver exactly one tooth with the nose seated and the pawl's pivot clear.\n`);
console.log('  postR  postAz  lever a  pawl L   lever swing   pivot advance   pivot min   arm clear');
for (const r of out.rows.slice(0, 16)) {
  console.log(`  ${r.Re.toFixed(1).padStart(5)}  ${String(r.azEdeg).padStart(4)}°   ${r.a.toFixed(1).padStart(5)}    ${r.L.toFixed(1)}    `
    + `${r.swingDeg.toFixed(2).padStart(7)}°     ${r.pivAdvDeg.toFixed(2).padStart(6)}° of 30°   ${r.pivotMin.toFixed(2)}      `
    + `${(r.worstArm >= 0 ? '+' : '') + r.worstArm.toFixed(4).padStart(7)}`);
}
const adv = out.rows.map((r) => r.pivAdvDeg);
console.log(`\npivot advance about the WHEEL over the drive: ${Math.min(...adv).toFixed(1)}°–${Math.max(...adv).toFixed(1)}° against the 30° the wheel must turn.`);
console.log(`${out.clears} of ${out.total} clear ${out.MARGIN} on the drive stroke with a STRAIGHT pawl arm.`);
console.log('\nA straight arm is a proxy. For the ten best, the WHOLE cycle — drive and');
console.log('return — decides whether a shaped pawl exists:');
for (const sh of out.shaped) {
  console.log(`  post ${sh.Re.toFixed(1).padStart(4)} @ ${String(sh.azEdeg).padStart(4)}°, lever ${sh.a}, pawl ${sh.L}  `
    + `${sh.reachable ? `free ${String(sh.area).padStart(6)} u², seats ${sh.landedErr} off after ${sh.overDeg}° overtravel  SHAPED PAWL EXISTS` : `NO — ${sh.why}`}`);
}
const lives = out.shaped.filter((sh) => sh.reachable);
console.log(`\n${lives.length} of ${out.shaped.length} best stations admit a shaped pawl over the whole cycle.`);
if (lives.length) {
  const g = lives[0];
  console.log(`\nBEST: post at radius ${g.Re}, ${g.azEdeg}° from the seat; lever arm ${g.a}, pawl arm ${g.L}.`);
  console.log(`  the lever swings ${g.swingDeg}° to deliver 30° (gain ${g.gain}); the pawl's own pivot never comes`);
  console.log(`  closer than ${g.pivotMin} to the wheel axis (tip ${out.tip.toFixed(2)} + margin ${out.MARGIN}); free region ${g.area} u².`);
  console.log('  THE OPERATING-LEVER CHAIN WORKS, coplanar with the saw and with no wheel raise.');
} else {
  console.log('\nNo shaped pawl survives the cycle at any of the ten best stations.');
}
process.exit(lives.length ? 0 : 1);
