// §163 — CAN A DRIVER PIVOTED ON THE COLUMN WHEEL'S OWN ARBOR RETURN?
//
// TODO 87 step 3's first question, and the one that killed the architecture
// before this one. The proposal is a driver lever pivoted on the wheel's arbor,
// carrying a sprung pawl. On the DRIVE stroke driver and wheel turn about the
// same axis together, so relative to the teeth nothing moves and there is
// nothing to foul — that is kinematics, not a measurement. The RETURN is the
// open question: there the driver sweeps a whole tooth backwards relative to
// the wheel, the nose has to ride out over one flank and drop into the next
// corner, and the pawl's BAR has to stay out of the metal while it does.
//
// The predecessor design failed exactly here, so this measures rather than
// argues, and it measures against `userData.ratchetPoly` — the same polygon
// geometry.js cut the teeth from, so the answer cannot drift from the metal.
//
// TWO THINGS THIS GETS RIGHT THAT A SYNTHETIC MODEL DID NOT, both of which
// produced confident nonsense first time round:
//
//   · THE SAW'S HANDEDNESS IS READ, NOT ASSUMED. geometry.js cuts the outline
//     y-MIRRORED (the §43 postscript: the teeth were once cut for the wrong
//     drive direction and two of three members disagreed). Rebuilding the saw
//     from `rr`, `tip` and a pitch without that mirror silently tests the
//     other side of every tooth. Here the cliff and the flank are identified
//     from the polygon itself: at a root corner one neighbour sits at the SAME
//     azimuth — that edge is the radial cliff — and the other is a tip one
//     pitch away, which is the flank. The return travels corner → flank top.
//
//   · THE SEAT SOLVE TRACKS, IT DOES NOT SEARCH. The pawl's angle at each step
//     is found in a window around the previous step's, so the nose stays on
//     the tooth it is actually riding. A global minimum over the whole circle
//     will happily seat the nose in some other gap, and then every clearance
//     it reports belongs to a pose the mechanism never stands in.
//
// Run: cd tools && node probe-163-driver.mjs
import { chromium } from 'playwright';
import { spawn } from 'node:child_process';

const srv = spawn('python3', ['-m', 'http.server', '8482', '--bind', '127.0.0.1'], { cwd: '..', stdio: 'ignore' });
await new Promise((r) => setTimeout(r, 900));
const b = await chromium.launch();
const p = await b.newPage();
p.on('pageerror', (e) => console.log('PAGEERROR', String(e)));
await p.goto('http://127.0.0.1:8482/index.html?hud=0&sync=0', { waitUntil: 'load', timeout: 90000 });
await p.waitForFunction(() => !!window.__clock, null, { timeout: 90000 });

const out = await p.evaluate(async () => {
  const clock = window.__clock;
  const unit = clock.labelEntries.find((e) => e.name === 'Alarm switch');
  let wheel = null;
  unit.obj.traverse((o) => { if (o.name === 'alarmColSkirt') wheel = o.parent; });
  const poly = wheel?.userData?.ratchetPoly;
  if (!poly) return { err: 'no ratchetPoly on the wheel group' };
  const drive = wheel.userData.ratchetDrive;

  const P = poly.map((q) => ({ x: q.x, y: q.y }));
  const N = P.length;
  const R = P.map((q) => Math.hypot(q.x, q.y));
  const A = P.map((q) => Math.atan2(q.y, q.x));
  const rr0 = Math.min(...R), tip = Math.max(...R);
  let rr = rr0;
  const PITCH = (Math.PI * 2) / (N / 2);

  // ——— handedness, READ off the polygon ———
  // A root vertex whose neighbour shares its azimuth: that edge is the CLIFF.
  // The other neighbour is a tip one pitch away: that is the FLANK's top, and
  // the direction the nose travels on the RETURN.
  const wrap = (a) => Math.atan2(Math.sin(a), Math.cos(a));
  let seatIdx = -1, cliffIdx = -1, flankIdx = -1;
  for (let i = 0; i < N; i++) {
    if (R[i] > (rr + tip) / 2) continue;                 // roots only
    const nx = (i + 1) % N, pv = (i - 1 + N) % N;
    const dn = Math.abs(wrap(A[nx] - A[i])), dp = Math.abs(wrap(A[pv] - A[i]));
    if (dn < 1e-6) { seatIdx = i; cliffIdx = nx; flankIdx = pv; break; }
    if (dp < 1e-6) { seatIdx = i; cliffIdx = pv; flankIdx = nx; break; }
  }
  if (seatIdx < 0) return { err: 'no root corner with a radial cliff — the saw is not the shape this probe reads' };
  const returnDir = Math.sign(wrap(A[flankIdx] - A[seatIdx]));   // +1 or −1, in LOCAL coords

  // ——— geometry helpers, exact against the cut outline ———
  const segD = (ax, ay, bx, by, qx, qy) => {
    const dx = bx - ax, dy = by - ay, l2 = dx * dx + dy * dy;
    let t = l2 === 0 ? 0 : ((qx - ax) * dx + (qy - ay) * dy) / l2;
    t = Math.max(0, Math.min(1, t));
    return Math.hypot(ax + t * dx - qx, ay + t * dy - qy);
  };
  const distToPoly = (qx, qy) => {
    let d = Infinity;
    for (let i = 0; i < N; i++) {
      const a = P[i], c = P[(i + 1) % N];
      d = Math.min(d, segD(a.x, a.y, c.x, c.y, qx, qy));
    }
    return d;
  };
  const inPoly = (qx, qy) => {
    let c = false;
    for (let i = 0, j = N - 1; i < N; j = i++) {
      const a = P[i], d = P[j];
      if ((a.y > qy) !== (d.y > qy) && qx < ((d.x - a.x) * (qy - a.y)) / (d.y - a.y) + a.x) c = !c;
    }
    return c;
  };
  // signed: positive outside the metal, negative inside
  const clearOf = (qx, qy) => (inPoly(qx, qy) ? -distToPoly(qx, qy) : distToPoly(qx, qy));

  // the corner seat for a nose of radius rn: along the interior-angle bisector,
  // rn / sin(half-angle) from the corner vertex, on the free side.
  const seatFor = (rn) => {
    const C = P[seatIdx], E1 = P[cliffIdx], E2 = P[flankIdx];
    const u1 = { x: E1.x - C.x, y: E1.y - C.y }, u2 = { x: E2.x - C.x, y: E2.y - C.y };
    const m1 = Math.hypot(u1.x, u1.y), m2 = Math.hypot(u2.x, u2.y);
    u1.x /= m1; u1.y /= m1; u2.x /= m2; u2.y /= m2;
    const bx = u1.x + u2.x, by = u1.y + u2.y, bm = Math.hypot(bx, by);
    const half = Math.acos(Math.max(-1, Math.min(1, u1.x * u2.x + u1.y * u2.y))) / 2;
    const step = rn / Math.sin(half);
    return { x: C.x + (bx / bm) * step, y: C.y + (by / bm) * step, half: half * 2 };
  };

  // ——— the pawl, tracked over the return ———
  // Q rides the driver, so relative to the WHEEL it rotates by one pitch in the
  // return direction. The nose is pressed onto the saw by its spring: at each
  // step take the DEEPEST pose (smallest |N|) whose nose still clears, searched
  // in a window about the previous step's angle so it stays on its own tooth.
  // The spring rotates the pawl ONE WAY — toward the wheel — until the nose
  // meets metal, so the solve is a MONOTONE scan from the previous step's
  // angle, not a minimum over a window. That distinction is not cosmetic: the
  // drop off the tip into the next corner is a radial fall of a whole tooth
  // depth, which at this arm length is ~0.27 rad of pawl rotation happening in
  // one or two steps. A ±0.30 rad window clips it, and the probe then reports
  // a nose that rides the flank forever and never indexes — a property of the
  // tracker, not of the mechanism.
  const STEPS = 90, SCAN = 1.20, DTH = 0.0006;
  function sweep(Rq, azq0, L, rn, w) {
    const seat = seatFor(rn);
    // THE PAWL'S ANGLE IS CARRIED IN THE DRIVER'S FRAME, not the wheel's. The
    // driver rotates about the wheel axis, so a pawl that does not move on its
    // own pivot still swings in the wheel's frame at exactly the driver's rate.
    // Integrating theta in the wheel's frame therefore drags the pawl backwards
    // against its own driver every step: the nose lags, never reaches the tip,
    // and the probe reports a transit that fails for a reason the mechanism
    // does not have. Carry `phi = theta − az` and the rigid case is phi
    // CONSTANT — which is what makes the return close by symmetry, since
    // rotating the whole assembly one pitch preserves |QN| and maps the seat
    // onto the next corner exactly.
    let phi = Math.atan2(seat.y - Rq * Math.sin(azq0), seat.x - Rq * Math.cos(azq0)) - azq0;
    let worstBar = Infinity, maxLift = -Infinity, lost = false;
    const seatR = Math.hypot(seat.x, seat.y);
    for (let s = 0; s <= STEPS; s++) {
      const f = s / STEPS;
      const az = azq0 + returnDir * PITCH * f;
      const qx = Rq * Math.cos(az), qy = Rq * Math.sin(az);
      let theta = phi + az;                    // rigid prediction, then the spring corrects it
      const at = (th) => ({ nx: qx + L * Math.cos(th), ny: qy + L * Math.sin(th) });
      const free = (th) => { const n = at(th); return clearOf(n.nx, n.ny) >= rn - 1e-4; };
      const rAt = (th) => { const n = at(th); return Math.hypot(n.nx, n.ny); };
      // which way is INWARD for this pose
      const inward = rAt(theta + 1e-4) < rAt(theta - 1e-4) ? 1 : -1;
      let best = null;
      if (!free(theta)) {
        // the pivot moved under the nose and it is now biting: back OUT to the
        // first pose that clears
        for (let k = 1; k * DTH <= SCAN; k++) {
          const th = theta - inward * k * DTH;
          if (free(th)) { const n = at(th); best = { r: Math.hypot(n.nx, n.ny), th, ...n }; break; }
        }
      } else {
        // press IN until the nose would bite; keep the last pose that clears
        let th = theta;
        for (let k = 1; k * DTH <= SCAN; k++) {
          const t2 = theta + inward * k * DTH;
          if (!free(t2)) break;
          th = t2;
        }
        const n = at(th);
        best = { r: Math.hypot(n.nx, n.ny), th, ...n };
      }
      if (!best) { lost = true; break; }
      phi = best.th - az;
      maxLift = Math.max(maxLift, best.r);
      // the BAR: worst clearance, the nose's own contact zone excluded
      for (let i = 0; i < N; i++) {
        const a = P[i], c = P[(i + 1) % N];
        for (let k = 0; k <= 24; k++) {
          const px = a.x + (c.x - a.x) * (k / 24), py = a.y + (c.y - a.y) * (k / 24);
          if (Math.hypot(px - best.nx, py - best.ny) < 1.7 * rn) continue;
          worstBar = Math.min(worstBar, segD(qx, qy, best.nx, best.ny, px, py) - w);
        }
      }
    }
    // DID IT ACTUALLY INDEX? A pawl that keeps a beautiful clearance because it
    // never climbs the tooth has not returned — it has to clear the tip and drop
    // into the NEXT corner, or the next press finds it on the same tooth. The
    // first cut of this probe reported only clearance and would have called
    // exactly that failure the best configuration in the scan.
    // the nose CENTRE has to stand its own radius PAST the tip to pass over the
    // corner, not merely reach the tip circle — the first cut understated this
    // by rn and would have scored a nose still buried in the tooth as clearing.
    const needLift = (tip + rn) - seatR;
    const endSeat = { x: seat.x * Math.cos(returnDir * PITCH) - seat.y * Math.sin(returnDir * PITCH),
                      y: seat.x * Math.sin(returnDir * PITCH) + seat.y * Math.cos(returnDir * PITCH) };
    // POSITIVE CONTROL. With the pawl RIGID on the driver (phi frozen, no spring
    // solve at all) the whole assembly rotates one pitch about the wheel axis,
    // so the nose must land exactly on the next corner — |error| = 0 by
    // symmetry. If this control is not ~0 the frames or the seat are wrong and
    // no verdict below means anything. A classifier that stops classifying is
    // how this kind of probe dies quietly (§48's rule, one instrument over).
    const phi0 = Math.atan2(seat.y - Rq * Math.sin(azq0), seat.x - Rq * Math.cos(azq0)) - azq0;
    const azC = azq0 + returnDir * PITCH;
    const rigidN = { x: Rq * Math.cos(azC) + L * Math.cos(phi0 + azC),
                     y: Rq * Math.sin(azC) + L * Math.sin(phi0 + azC) };
    const seatC = { x: seat.x * Math.cos(returnDir * PITCH) - seat.y * Math.sin(returnDir * PITCH),
                    y: seat.x * Math.sin(returnDir * PITCH) + seat.y * Math.cos(returnDir * PITCH) };
    const controlErr = Math.hypot(rigidN.x - seatC.x, rigidN.y - seatC.y);
    const azE = azq0 + returnDir * PITCH;
    const qxE = Rq * Math.cos(azE), qyE = Rq * Math.sin(azE);
    const endN = { x: qxE + L * Math.cos(phi + azE), y: qyE + L * Math.sin(phi + azE) };
    const landed = Math.hypot(endN.x - endSeat.x, endN.y - endSeat.y);
    return { lost, worstBar, lift: maxLift - seatR, needLift, landed, seatR, controlErr };
  }

  const rn = 0.20, w = 0.15, MARGIN = 0.15;
  // ——— DEPTH SWEEP ———
  // Every architecture so far has died on the same quantity: the nose must lift
  // a whole tooth depth to ratchet back, and this saw is CUT DEEP — 1.254 on a
  // 5.7 radius wheel, 22% of the radius at a 30° pitch. So sweep the depth by
  // moving the ROOT vertices only (tips and pitch fixed), which preserves the
  // handedness read off the built polygon, and find where the mechanism closes.
  const rows = [];
  const setDepth = (d) => {
    for (let i = 0; i < N; i++) {
      if (R[i] > (rr0 + tip) / 2) continue;
      const a = A[i]; P[i].x = (tip - d) * Math.cos(a); P[i].y = (tip - d) * Math.sin(a);
    }
  };
  for (const depth of [1.254, 1.05, 0.90, 0.75, 0.60, 0.45]) {
    setDepth(depth);
    let bestRow = null;
    for (const Rq of [6.55, 6.6, 6.7, 6.9, 7.2, 7.6, 8.2, 9.0, 10.0]) {
    for (const offDeg of [8, 16, 24, 28, 32, 36, 40, 44, 50, 56]) {
      // the pivot trails the nose, on the side the nose RETURNS toward
      const seat = seatFor(rn);
      const azSeat = Math.atan2(seat.y, seat.x);
      const azq0 = azSeat + returnDir * (offDeg * Math.PI / 180);
      const L = Math.hypot(seat.x - Rq * Math.cos(azq0), seat.y - Rq * Math.sin(azq0));
      const r = sweep(Rq, azq0, L, rn, w);
      const cleared = !r.lost && r.lift >= r.needLift - 1e-3 && r.landed <= 0.05;
      const row = { depth, Rq, offDeg, L: +L.toFixed(4), ...r, cleared, ok: cleared && r.worstBar >= MARGIN };
      if (!bestRow || (row.cleared && !bestRow.cleared)
          || (row.cleared === bestRow.cleared && row.worstBar > bestRow.worstBar)) bestRow = row;
    }
    }
    rows.push(bestRow);
  }
  setDepth(tip - rr0);

  // ——— THE POST'S RADIUS IS DERIVED, NOT SCANNED ———
  // §163: the pawl's pivot post rises through the SKIRT'S OWN z-band to reach
  // the teeth, so its SURFACE — not its centreline — must stand one CLEAR_MARGIN
  // outside the tip circle:
  //     Rq = tip + CLEAR_MARGIN + postR
  // The scan above reports whichever Rq measures best, which is a different
  // question and lands 6.6 — a centreline that puts a STOCK_MIN_R10 post's
  // surface 0.0495 from the tips, a third of the margin. What the build can
  // actually use is this one value, so it is measured on its own row rather
  // than read off a scan that was never asked the question.
  const CLEAR_MARGIN_G = 0.15, STOCK_MIN_R10_G = 0.16648151883772563;
  const RQ_DERIVED = tip + CLEAR_MARGIN_G + STOCK_MIN_R10_G;
  let derivedRow = null;
  {
    const seat = seatFor(rn);
    const azSeat = Math.atan2(seat.y, seat.x);
    for (const offDeg of [8, 16, 24, 28, 32, 36, 40, 44, 50, 56]) {
      const azq0 = azSeat + returnDir * (offDeg * Math.PI / 180);
      const L = Math.hypot(seat.x - RQ_DERIVED * Math.cos(azq0), seat.y - RQ_DERIVED * Math.sin(azq0));
      const r = sweep(RQ_DERIVED, azq0, L, rn, w);
      const cleared = !r.lost && r.lift >= r.needLift - 1e-3 && r.landed <= 0.05;
      const row = { depth: tip - rr0, Rq: RQ_DERIVED, offDeg, L: +L.toFixed(4), ...r, cleared, ok: cleared && r.worstBar >= MARGIN };
      if (!derivedRow || (row.cleared && !derivedRow.cleared)
          || (row.cleared === derivedRow.cleared && row.worstBar > derivedRow.worstBar)) derivedRow = row;
    }
  }

  // ——— AND DOES THE OUTLINE THE BUILD ACTUALLY CUTS SURVIVE IT? ———
  // freeRegion answers "does SOME member exist" with a flood fill, and a BFS
  // path is a staircase through grid cells — not a shape anybody would cut.
  // The build turns it into a few straight segments, and a straight segment
  // CUTS CORNERS the staircase went round. That is a different claim and it
  // gets its own measurement: thicken the proposed centreline to half-width w
  // (a capsule is the union of discs of radius w along it, so requiring w of
  // clearance at every sample IS the capsule test) and sweep it through the
  // same tracked return the free region was mapped from.
  function returnPoses(Rq, azq0, L, rn) {
    const seat = seatFor(rn);
    const phi0 = Math.atan2(seat.y - Rq * Math.sin(azq0), seat.x - Rq * Math.cos(azq0)) - azq0;
    const poses = [];
    let phi = phi0;
    for (let st = 0; st <= STEPS; st++) {
      const az = azq0 + returnDir * PITCH * (st / STEPS);
      const qx = Rq * Math.cos(az), qy = Rq * Math.sin(az);
      const theta = phi + az;
      const at = (th) => ({ nx: qx + L * Math.cos(th), ny: qy + L * Math.sin(th) });
      const free = (th) => { const n = at(th); return clearOf(n.nx, n.ny) >= rn - 1e-4; };
      const rAt = (th) => { const n = at(th); return Math.hypot(n.nx, n.ny); };
      const inward = rAt(theta + 1e-4) < rAt(theta - 1e-4) ? 1 : -1;
      let th = theta;
      if (!free(theta)) {
        for (let k = 1; k * DTH <= SCAN; k++) { const t2 = theta - inward * k * DTH; if (free(t2)) { th = t2; break; } }
      } else {
        for (let k = 1; k * DTH <= SCAN; k++) { const t2 = theta + inward * k * DTH; if (!free(t2)) break; th = t2; }
      }
      phi = th - az;
      poses.push({ qx, qy, th });
    }
    return poses;
  }
  // Worst slack of a THICKENED CENTRELINE over the whole tracked return. A
  // capsule of half-width w is the union of discs of radius w along its spine,
  // so requiring w of clearance at every sample IS the capsule test.
  function slackOf(poses, L, rn, w, nodes, pad = 0) {
    const pts = [];
    for (let i = 0; i + 1 < nodes.length; i++) {
      const [u0, v0] = nodes[i], [u1, v1] = nodes[i + 1];
      const n = Math.max(2, Math.ceil(Math.hypot(u1 - u0, v1 - v0) / 0.02));
      for (let k = 0; k <= n; k++) pts.push([u0 + (u1 - u0) * k / n, v0 + (v1 - v0) * k / n]);
    }
    let worst = Infinity, worstAt = null;
    for (const P2 of poses) {
      const c = Math.cos(P2.th), sn = Math.sin(P2.th);
      for (const [u, v] of pts) {
        const nearNose = Math.hypot(u - L, v) < rn + w;
        const need = nearNose ? rn * 0.5 : w + pad;
        const x = P2.qx + u * c - v * sn, y = P2.qy + u * sn + v * c;
        const slack = clearOf(x, y) - need;
        if (slack < worst) { worst = slack; worstAt = [+u.toFixed(3), +v.toFixed(3)]; }
      }
    }
    return { worst: +worst.toFixed(4), worstAt, ok: worst >= 0 };
  }
  // A BFS path is a staircase through grid cells — not a shape anybody would
  // cut. Straightening it is a DIFFERENT claim than the flood fill's, because a
  // straight segment cuts the corner the staircase went round (measured: the
  // first hand-simplification fouled by 0.1645 at u 2.40). So the simplification
  // is greedy and VERIFIED: take the longest straight run from each node that
  // still clears, never a run that does not.
  function simplifyPath(poses, L, rn, w, path, pad = 0) {
    if (!path || path.length < 2) return null;
    const outNodes = [path[0]];
    let i = 0;
    while (i < path.length - 1) {
      let bestJ = i + 1;
      for (let j = path.length - 1; j > i + 1; j--) {
        if (slackOf(poses, L, rn, w, [path[i], path[j]], pad).ok) { bestJ = j; break; }
      }
      outNodes.push(path[bestJ]);
      i = bestJ;
    }
    return outNodes;
  }

  // ——— IS THERE A SHAPED MEMBER AT ALL? ———
  // Every sweep above models the pawl as a STRAIGHT bar from pivot to nose, and
  // that is a proxy: a real pawl is shaped — out over the tip circle, then a
  // short beak in. So the straight-bar verdict answers "can a straight member
  // do it" (no) and NOT "can any member do it".
  //
  // The question that actually decides the architecture is the swept FREE
  // REGION in the pawl's own frame. A point fixed on the pawl traces a path as
  // the driver returns; it is usable iff it clears the metal at EVERY step. Map
  // that region, then flood-fill from the pivot: if the nose is reachable
  // within it, a member can be shaped to join them and the architecture lives.
  function freeRegion(Rq, azq0, L, rn, w, pad = 0) {
    const seat = seatFor(rn);
    const phi0 = Math.atan2(seat.y - Rq * Math.sin(azq0), seat.x - Rq * Math.cos(azq0)) - azq0;
    // re-run the tracked return, recording the pose at every step
    const poses = [];
    let phi = phi0;
    for (let st = 0; st <= STEPS; st++) {
      const az = azq0 + returnDir * PITCH * (st / STEPS);
      const qx = Rq * Math.cos(az), qy = Rq * Math.sin(az);
      let theta = phi + az;
      const at = (th) => ({ nx: qx + L * Math.cos(th), ny: qy + L * Math.sin(th) });
      const free = (th) => { const n = at(th); return clearOf(n.nx, n.ny) >= rn - 1e-4; };
      const rAt = (th) => { const n = at(th); return Math.hypot(n.nx, n.ny); };
      const inward = rAt(theta + 1e-4) < rAt(theta - 1e-4) ? 1 : -1;
      let th = theta;
      if (!free(theta)) {
        for (let k = 1; k * DTH <= SCAN; k++) { const t2 = theta - inward * k * DTH; if (free(t2)) { th = t2; break; } }
      } else {
        for (let k = 1; k * DTH <= SCAN; k++) { const t2 = theta + inward * k * DTH; if (!free(t2)) break; th = t2; }
      }
      phi = th - az;
      poses.push({ qx, qy, th });
    }
    // grid in the pawl's frame: u along the arm, v across it
    const DU = 0.04, U0 = -0.35, U1 = L + 0.45, V0 = -1.6, V1 = 1.6;
    const NU = Math.round((U1 - U0) / DU), NV = Math.round((V1 - V0) / DU);
    const okCell = new Uint8Array(NU * NV);
    for (let iu = 0; iu < NU; iu++) for (let iv = 0; iv < NV; iv++) {
      const u = U0 + iu * DU, v = V0 + iv * DU;
      const nearNose = Math.hypot(u - L, v) < rn + w;      // the nose's own contact zone
      let good = true;
      for (const P2 of poses) {
        const c = Math.cos(P2.th), sn = Math.sin(P2.th);
        const x = P2.qx + u * c - v * sn, y = P2.qy + u * sn + v * c;
        const need = nearNose ? rn * 0.5 : w + pad;
        if (clearOf(x, y) < need) { good = false; break; }
      }
      okCell[iu * NV + iv] = good ? 1 : 0;
    }
    // flood-fill from the pivot (u=0,v=0) and ask whether the nose is reachable
    const idx = (iu, iv) => iu * NV + iv;
    const su = Math.round((0 - U0) / DU), sv = Math.round((0 - V0) / DU);
    const tu = Math.round((L - U0) / DU), tv = sv;
    if (!okCell[idx(su, sv)]) return { reachable: false, why: 'the PIVOT itself is not free through the return' };
    // BREADTH-FIRST, keeping parents — because "a shaped member exists" is only
    // half an answer. The build needs the SHAPE, and guessing an outline is
    // exactly the kind of number rule 1 forbids. A BFS through cells that
    // already require w of clearance yields a centreline a bar of half-width w
    // can follow, so the pawl's outline is DERIVED from the swept free region
    // rather than drawn to look right.
    const seen = new Int32Array(NU * NV).fill(-1);
    const q = [idx(su, sv)]; seen[idx(su, sv)] = idx(su, sv);
    let hit = -1, area = 0;
    for (let h = 0; h < q.length; h++) {
      const cur = q[h], iu = Math.floor(cur / NV), iv = cur % NV; area++;
      if (hit < 0 && Math.abs(iu - tu) <= 2 && Math.abs(iv - tv) <= 2) hit = cur;
      for (const [du, dv] of [[1,0],[-1,0],[0,1],[0,-1]]) {
        const ju = iu + du, jv = iv + dv;
        if (ju < 0 || jv < 0 || ju >= NU || jv >= NV) continue;
        const n = idx(ju, jv);
        if (seen[n] >= 0 || !okCell[n]) continue;
        seen[n] = cur; q.push(n);
      }
    }
    let path = null;
    if (hit >= 0) {
      const pts = [];
      for (let c = hit; ; c = seen[c]) {
        pts.push([+(U0 + Math.floor(c / NV) * DU).toFixed(3), +(V0 + (c % NV) * DU).toFixed(3)]);
        if (seen[c] === c) break;
      }
      pts.reverse();
      // thin it to a readable polyline: keep a node whenever the direction turns
      const keep = [pts[0]];
      for (let i = 1; i < pts.length - 1; i++) {
        const a = keep[keep.length - 1], b = pts[i], c2 = pts[i + 1];
        const cross = (b[0] - a[0]) * (c2[1] - a[1]) - (b[1] - a[1]) * (c2[0] - a[0]);
        if (Math.abs(cross) > 1e-9) keep.push(b);
      }
      keep.push(pts[pts.length - 1]);
      path = keep;
    }
    return { reachable: hit >= 0, area: +(area * DU * DU).toFixed(3), path,
             why: hit >= 0 ? 'pivot and nose lie in ONE connected free region — a shaped member exists'
                      : 'the free region around the pivot does not reach the nose' };
  }
  const shaped = [];
  for (const r of rows) {
    if (!r.cleared) { shaped.push({ depth: r.depth, skip: true }); continue; }
    setDepth(r.depth);
    const seat = seatFor(rn); const azSeat = Math.atan2(seat.y, seat.x);
    const azq0 = azSeat + returnDir * (r.offDeg * Math.PI / 180);
    shaped.push({ depth: r.depth, Rq: r.Rq, offDeg: r.offDeg, ...freeRegion(r.Rq, azq0, r.L, rn, w) });
  }
  setDepth(tip - rr0);
  let derivedShaped = null, derivedOutline = null;
  if (derivedRow && derivedRow.cleared) {
    const seat = seatFor(rn); const azSeat = Math.atan2(seat.y, seat.x);
    const azq0 = azSeat + returnDir * (derivedRow.offDeg * Math.PI / 180);
    derivedShaped = { Rq: derivedRow.Rq, offDeg: derivedRow.offDeg, ...freeRegion(derivedRow.Rq, azq0, derivedRow.L, rn, w) };
    // THE BUILD'S OWN CENTRELINE — the free region's path, straightened into
    // segments a drawing could hold, each one verified rather than eyeballed.
    //
    // AND PADDED. The flood fill above asks only whether the member's metal
    // INTERSECTS the saw; a member that answers yes can still run 0.017 off a
    // tooth tip, which is a hair, not a clearance. The build's own region is
    // re-mapped requiring w + CLEAR_MARGIN everywhere except the nose's own
    // working zone, so what comes out is a member that keeps the movement's one
    // structural margin from every surface it is not supposed to touch.
    const L2 = derivedRow.L;
    const poses = returnPoses(derivedRow.Rq, azq0, L2, rn);
    const padded = freeRegion(derivedRow.Rq, azq0, L2, rn, w, CLEAR_MARGIN_G);
    const simple = padded.reachable ? simplifyPath(poses, L2, rn, w, padded.path, CLEAR_MARGIN_G) : null;
    derivedOutline = simple
      ? { nodes: simple, pad: CLEAR_MARGIN_G, area: padded.area, ...slackOf(poses, L2, rn, w, simple, CLEAR_MARGIN_G) }
      : { nodes: null, pad: CLEAR_MARGIN_G, area: padded.area, ok: false, why: padded.why };
  }
  setDepth(tip - rr0);
  return {
    rr, tip, PITCH, drive, returnDir, teeth: N / 2, derivedRow, derivedShaped, derivedOutline, RQ_DERIVED,
    cornerInteriorDeg: +(seatFor(0.2).half * 180 / Math.PI).toFixed(2),
    seatR: +Math.hypot(seatFor(0.2).x, seatFor(0.2).y).toFixed(4),
    rn, w, MARGIN, rows, shaped,
  };
});

await b.close();
srv.kill();

if (out.err) { console.log('FAIL:', out.err); process.exit(1); }

console.log(`\nsaw read off userData.ratchetPoly: ${out.teeth} teeth, root ${out.rr.toFixed(3)}, tip ${out.tip.toFixed(3)} (as cut: depth ${(out.tip-out.rr).toFixed(3)})`);
console.log(`  ratchetDrive ${out.drive}; the RETURN runs ${out.returnDir > 0 ? '+' : '\u2212'}az in the wheel's local frame (derived from the cliff/flank, not assumed)`);
const ctl = Math.max(...out.rows.map((r) => r.controlErr));
console.log(`  CONTROL (pawl rigid on the driver \u2014 must land on the next corner by symmetry): worst error ${ctl.toExponential(2)} ${ctl < 1e-9 ? 'PASS' : 'BROKEN \u2014 ignore every verdict below'}`);
console.log(`\ntooth depth   best Rq / offset      lift vs needed     worst bar clear   verdict`);
for (const r of out.rows) {
  console.log(`   ${r.depth.toFixed(3)}      Rq ${r.Rq.toFixed(1)} / ${String(r.offDeg).padStart(2)}\u00b0        `
    + `${r.lift.toFixed(3)} / ${r.needLift.toFixed(3)}      `
    + `${(r.worstBar >= 0 ? '+' : '') + r.worstBar.toFixed(4).padStart(7)}   `
    + `${!r.cleared ? 'never indexes' : (r.ok ? 'CLEARS' : 'indexes, but fouls')}`);
}
console.log(`\nA STRAIGHT bar is a proxy, so for every depth that INDEXES, the swept free`);
console.log(`region in the pawl's own frame decides whether a SHAPED member exists:`);
for (const sh of out.shaped) {
  if (sh.skip) { console.log(`   depth ${sh.depth.toFixed(3)}  — did not index, not asked`); continue; }
  console.log(`   depth ${sh.depth.toFixed(3)}  Rq ${sh.Rq} / ${sh.offDeg}\u00b0  free area ${sh.area ?? '—'}  ${sh.reachable ? 'SHAPED MEMBER EXISTS' : 'NO'} — ${sh.why}`);
}
// THE VERDICT IS THE SHAPED-MEMBER ROW, not the straight-bar column. The bar
// is a conservative proxy and it fails everywhere; reporting it as the answer
// would retire an architecture that works.
const indexes = out.rows.filter((r) => r.cleared);
const lives = out.shaped.filter((sh) => sh.reachable);
const asCut = out.shaped.find((sh) => Math.abs(sh.depth - (out.tip - out.rr)) < 1e-6);
console.log(`\n${indexes.length} of ${out.rows.length} depths index (nose clears the tip and lands in the next corner).`);
console.log(`${lives.length} of those admit a shaped member joining pivot to nose through the swept free region.`);
if (asCut && asCut.reachable) {
  const r = out.rows.find((x) => Math.abs(x.depth - asCut.depth) < 1e-6);
  console.log(`\nAT THE SAW AS CUT (depth ${asCut.depth.toFixed(3)}): Rq ${asCut.Rq}, pivot ${asCut.offDeg}\u00b0 off the seat, `
    + `lift ${r.lift.toFixed(3)} against ${r.needLift.toFixed(3)} needed, free region ${asCut.area} u\u00b2.`);
  console.log('The driver-on-the-arbor architecture SURVIVES its return stroke, and the saw needs no re-cutting.');
  if (asCut.path) {
    console.log(`\n  the pawl's centreline through that region, in the PAWL's own frame`);
    console.log(`  (u along pivot→nose, v across; pivot at 0,0, nose at ${r.L ?? '?'},0) — ${asCut.path.length} nodes:`);
    console.log('   ' + asCut.path.map(([u, v]) => `(${u}, ${v})`).join(' → '));
  }
  console.log('A STRAIGHT bar does not fit \u2014 the pawl must be shaped, which is what a real pawl is.');
} else {
  console.log('\nAt the saw as cut the architecture does NOT survive its return stroke.');
}
// ——— THE ROW THE BUILD CONSUMES ———
console.log(`\nTHE POST RADIUS THE BUILD MUST USE, derived rather than scanned:`);
console.log(`  Rq = tip ${out.tip.toFixed(3)} + CLEAR_MARGIN 0.150 + post STOCK_MIN_R10 0.166 = ${out.RQ_DERIVED.toFixed(5)}`);
if (!out.derivedRow || !out.derivedRow.cleared) {
  console.log('  at that radius the nose does NOT index — the architecture needs re-siting, not a smaller margin.');
} else {
  const d = out.derivedRow;
  console.log(`  pivot ${d.offDeg}° off the seat, arm L ${d.L}, lift ${d.lift.toFixed(3)} against ${d.needLift.toFixed(3)} needed`);
  console.log(`  free region ${out.derivedShaped?.area ?? '—'} u² — ${out.derivedShaped?.reachable ? 'SHAPED MEMBER EXISTS' : 'NO SHAPED MEMBER'}`);
  if (out.derivedShaped?.path) {
    console.log(`  centreline in the pawl's own frame (pivot 0,0 → nose ${d.L},0), ${out.derivedShaped.path.length} nodes:`);
    console.log('   ' + out.derivedShaped.path.map(([u, v]) => `(${u}, ${v})`).join(' → '));
  }
}

if (out.derivedOutline) {
  const o = out.derivedOutline;
  console.log(`\n  THE OUTLINE THE BUILD CUTS — half-width ${out.w}, and the region re-mapped`);
  console.log(`  requiring w + CLEAR_MARGIN ${o.pad} everywhere but the nose's working zone (free area ${o.area ?? '—'} u\u00b2):`);
  if (!o.nodes) { console.log(`   NO MEMBER SURVIVES THE PADDED REGION \u2014 ${o.why}`); }
  else console.log('   ' + o.nodes.map(([u, v]) => `(${u}, ${v})`).join(' \u2192 '));
  if (o.nodes) console.log(`  worst slack over the whole return: ${(o.worst >= 0 ? '+' : '') + o.worst}`
    + ` at (${o.worstAt?.join(', ')}) \u2014 ${o.ok ? 'THE CUT OUTLINE CLEARS' : 'THE CUT OUTLINE FOULS \u2014 the straight segments cut a corner the staircase went round'}`);
}

process.exit(asCut && asCut.reachable && out.derivedShaped?.reachable && out.derivedOutline?.ok ? 0 : 1);
