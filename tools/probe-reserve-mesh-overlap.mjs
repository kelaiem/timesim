// TODO 77 — HOW DEEPLY DO THE RESERVE TRAIN'S TWO MESHES INTERPENETRATE?
//
// `probe-reserve-mesh.mjs` next door answers the other half of the question:
// are the two meshes in PHASE (a tooth against a gap on the line of centres).
// It measures 0.07% of a pitch off anti-phase, and it is measuring the right
// thing — but a correct phase at a correct centre distance cannot stop two
// NON-CONJUGATE outlines from passing through each other, which is exactly
// what `gearOutlineShape`'s straight-chord flanks are. So this is the second
// instrument: not "are they aligned" but "how much metal is in the same place".
//
// THE MEASURE, and its honest limit. For each gear pair, one gear's vertices
// are tested against the other's SILHOUETTE — the max radius per angular bin
// about that gear's own axis, 4096 bins. A gear outline is star-shaped about
// its axis (every ray from the centre crosses the boundary once), so a point
// at radius r and angle θ is inside the metal exactly when r < R(θ), and the
// depth is R(θ) − r. That is a RADIAL overlap: an upper bound on the
// minimum-translation penetration depth, never that depth itself. Quoted as
// what it is, because the alternative — calling it "penetration" — would
// overstate a number that is already bad enough.
//
// Tested BOTH ways per pair (A into B and B into A) and swept over the wind,
// because the worst pose is not the build pose: stage one peaks at tension
// 0.20 and stage two at 0.475.
//
// The pairs are identified STRUCTURALLY rather than by index — by axis and
// z-band — because the unit carries six extrusions (four gears and two studs)
// and an index list would silently re-point if a body were added. The first
// cut of this probe did exactly that and compared a stud against a pinion,
// reporting 1.55 mm of overlap between two bodies that share an axis and do
// not share a z-band at all.
//
// §136 LANDED AND THE SILHOUETTE RAN OUT OF RESOLUTION, which is why there are
// now three columns rather than one. The radial reading above runs along a ray
// from the mate's centre, and a cycloidal pinion's flank below the pitch circle
// is RADIAL — the degenerate hypocycloid is a straight line through the centre
// — so the ray lies IN the surface it is supposed to cross and the reading
// inflates. The PERPENDICULAR column (distance to the boundary polyline) drops
// that bias; the EXACT column drops the bins entirely, rebuilding each member
// from the real generator, growing it by the extrude's bevel, registering it
// against the shipped mesh and measuring polygon against polygon. Read them in
// that order: each one exists because the one before it could not answer.
//
// The pre- and post-§136 RADIAL numbers are not comparable and must not be
// subtracted — the bias changed with the profile. The other two are.
//
// Run from tools/ with a Playwright Chromium: `node probe-reserve-mesh-overlap.mjs`.
import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
const port = process.env.PORT || '8479';
const root = process.env.ROOT || '..';
const srv = spawn('python3', ['-m', 'http.server', port, '--bind', '127.0.0.1'], { cwd: root, stdio: 'ignore' });
await new Promise((r) => setTimeout(r, 900));
const browser = await chromium.launch();
const page = await browser.newPage();
page.on('pageerror', (e) => console.log('PAGEERROR', String(e)));
await page.goto(`http://127.0.0.1:${port}/index.html`, { waitUntil: 'load', timeout: 90000 });
await page.waitForFunction(() => !!window.__clock, null, { timeout: 90000 });

const out = await page.evaluate(async () => {
  const C = window.__clock;
  const L = await import('/src/layout.js');
  const geom = await import('/src/geometry.js');
  const train = C.labelEntries.find((e) => e.name === 'Power-reserve train')?.obj;
  if (!train) return { error: 'no Power-reserve train label' };

  const bodies = [];
  train.traverse((o) => {
    if (!o.isMesh || o.geometry?.type !== 'ExtrudeGeometry') return;
    o.updateWorldMatrix(true, true);
    const e = o.matrixWorld.elements, ox = e[12], oy = e[13];
    const pos = o.geometry.attributes.position;
    const v = new (Object.getPrototypeOf(o.position).constructor)();
    let zlo = Infinity, zhi = -Infinity, tipR = 0;
    for (let i = 0; i < pos.count; i++) {
      v.fromBufferAttribute(pos, i).applyMatrix4(o.matrixWorld);
      if (v.z < zlo) zlo = v.z;
      if (v.z > zhi) zhi = v.z;
      const r = Math.hypot(v.x - ox, v.y - oy);
      if (r > tipR) tipR = r;
    }
    bodies.push({ obj: o, ox, oy, zlo, zhi, tipR });
  });
  // A MESH is two bodies on different axes whose z-bands overlap and whose tip
  // circles reach each other. Studs fail the tip test; the coaxial wheel+pinion
  // pair fails the axis test; the two stages fail each other's z test.
  const axisApart = (a, b) => Math.hypot(a.ox - b.ox, a.oy - b.oy);
  const meshes = [];
  for (let i = 0; i < bodies.length; i++) {
    for (let j = i + 1; j < bodies.length; j++) {
      const a = bodies[i], b = bodies[j], d = axisApart(a, b);
      if (d < 1e-6) continue;                                  // coaxial: one part
      if (Math.min(a.zhi, b.zhi) - Math.max(a.zlo, b.zlo) <= 0) continue;  // different planes
      if (a.tipR + b.tipR < d) continue;                       // tip circles do not reach
      meshes.push({ a, b, centre: d });
    }
  }

  const BINS = 4096;
  const silhouette = (g) => {
    g.obj.updateWorldMatrix(true, true);
    const e = g.obj.matrixWorld.elements, ox = e[12], oy = e[13];
    const pos = g.obj.geometry.attributes.position;
    const R = new Float64Array(BINS);
    const v = new (Object.getPrototypeOf(g.obj.position).constructor)();
    for (let i = 0; i < pos.count; i++) {
      v.fromBufferAttribute(pos, i).applyMatrix4(g.obj.matrixWorld);
      const dx = v.x - ox, dy = v.y - oy;
      const r = Math.hypot(dx, dy);
      let th = Math.atan2(dy, dx); if (th < 0) th += Math.PI * 2;
      const k = Math.min(BINS - 1, ((th / (Math.PI * 2)) * BINS) | 0);
      if (r > R[k]) R[k] = r;
    }
    return { R, ox, oy };
  };
  // The SECOND measure, and why §136 forced it. The radial reading above runs
  // along a ray from the mate's centre — which for a RADIAL flank is a ray
  // lying IN the flank surface. A cycloidal pinion's flank below the pitch
  // circle is exactly that: the degenerate hypocycloid a describing circle of
  // pitch-radius diameter traces is a straight line through the centre. So a
  // vertex a hair off such a flank reads a radial depth of most of a tooth
  // height, because the ray exits at the tip rather than crossing the flank.
  // The old straight-chord profile had the same bias in principle and much
  // less of it in practice (its flanks are chords, not radii), so the pre- and
  // post-§136 radial columns are NOT comparable and must not be subtracted.
  //
  // This one is the distance from the interior vertex to the mate's boundary
  // POLYLINE — consecutive silhouette samples joined, so the one-bin radial
  // jump between a tip sample and a root sample IS the flank segment, and the
  // perpendicular distance to it is measured rather than skipped. Still an
  // upper bound on the minimum-translation depth (a single vertex's distance
  // to the surface bounds no more than that vertex), but a tight one, and free
  // of the radial bias. Report both: the radial column is the series TODO 77
  // has always quoted, the perpendicular column is what the metal does.
  // The bins are SPARSE — 4096 of them against a few hundred outline points, so
  // most are empty and a polyline built straight off `R` would run to the axis
  // and back thousands of times. Fill each empty run by interpolating between
  // the filled bins that bracket it, circularly. That is accurate where the
  // gaps are (the epicycloidal face and the root arc, both smooth and sampled
  // at `curveSegments`), and it does not smear the one place it would matter:
  // a RADIAL flank has zero angular width, so its two ends land in the same bin
  // or adjacent ones and create no gap to interpolate across. The polyline's
  // one-bin jump from tip radius to root radius IS that flank.
  const boundary = (sb) => {
    const R = Float64Array.from(sb.R);
    const filled = [];
    for (let k = 0; k < BINS; k++) if (R[k] > 0) filled.push(k);
    if (!filled.length) return null;
    for (let n = 0; n < filled.length; n++) {
      const a = filled[n], b = filled[(n + 1) % filled.length];
      let span = b - a; if (span <= 0) span += BINS;
      for (let d = 1; d < span; d++) R[(a + d) % BINS] = R[a] + ((R[b] - R[a]) * d) / span;
    }
    const bx = new Float64Array(BINS), by = new Float64Array(BINS);
    for (let k = 0; k < BINS; k++) {
      const th = ((k + 0.5) / BINS) * Math.PI * 2;
      bx[k] = sb.ox + R[k] * Math.cos(th);
      by[k] = sb.oy + R[k] * Math.sin(th);
    }
    return { bx, by, R, filledFrac: filled.length / BINS };
  };
  const segDist = (px, py, ax, ay, bx, by) => {
    const ux = bx - ax, uy = by - ay, L2 = ux * ux + uy * uy;
    let t = L2 > 0 ? ((px - ax) * ux + (py - ay) * uy) / L2 : 0;
    t = t < 0 ? 0 : t > 1 ? 1 : t;
    return Math.hypot(px - (ax + t * ux), py - (ay + t * uy));
  };
  const deepestInto = (A, B) => {
    const sb = silhouette(B);
    const bd = boundary(sb);
    A.obj.updateWorldMatrix(true, true);
    const pos = A.obj.geometry.attributes.position;
    const v = new (Object.getPrototypeOf(A.obj.position).constructor)();
    let worst = 0, worstPerp = 0;
    for (let i = 0; i < pos.count; i++) {
      v.fromBufferAttribute(pos, i).applyMatrix4(A.obj.matrixWorld);
      const dx = v.x - sb.ox, dy = v.y - sb.oy;
      const r = Math.hypot(dx, dy);
      let th = Math.atan2(dy, dx); if (th < 0) th += Math.PI * 2;
      const k = Math.min(BINS - 1, ((th / (Math.PI * 2)) * BINS) | 0);
      if (sb.R[k] > 0 && sb.R[k] - r > worst) worst = sb.R[k] - r;   // the historical column: raw bins
      if (bd.R[k] - r <= 0) continue;                                // outside the metal

      let perp = Infinity;
      for (let j = 0; j < BINS; j++) {
        const j2 = (j + 1) % BINS;
        const d = segDist(v.x, v.y, bd.bx[j], bd.by[j], bd.bx[j2], bd.by[j2]);
        if (d < perp) perp = d;
      }
      if (perp > worstPerp) worstPerp = perp;
    }
    return { worst, worstPerp, filledFrac: bd.filledFrac };
  };

  // ---------------------------------------------------------------------
  // THE THIRD MEASURE — exact, and the one that survives §136.
  //
  // Both columns above are silhouette readings, and §136 pushed the fault
  // under their noise floor: probe-136-roll rolls these same two pairs from
  // the same generator, at the same centre distances, and measures ZERO
  // penetration with backlash to spare. A binned instrument cannot confirm or
  // deny a residue smaller than its own bias, so it must stop being the last
  // word.
  //
  // This one has no bins. It rebuilds each member's outline from the REAL
  // generator, REGISTERS it against the shipped mesh (a phase search, with the
  // fit residual reported — if the analytic outline does not describe the
  // metal, that shows up as a large residual and the row is refused rather
  // than believed), places the two at the movement's own measured centres and
  // spins, and runs probe-136-roll's exact measure: ray-crossing point-in-
  // polygon, depth = distance to the nearest boundary segment.
  //
  // What it adds over probe-136-roll is the PHASE THE MOVEMENT ACTUALLY
  // PRODUCES. That probe rolls from a meshed phase by construction; here the
  // registration is read off the built scene at every wind state, so a phase
  // the train's own ratios deliver wrong would show up as interference the
  // free-space proof cannot see.
  // Tooth count from the TIP VERTICES, not from the binned envelope. Two
  // earlier cuts of this failed and both failures are worth keeping: counting
  // peaks in the envelope read the hub and the sparse-sample interpolation as
  // teeth (28 came back 27, an 8-leaf pinion came back 15), and scoring the
  // envelope for N-fold periodicity drowned in the same interpolation — its
  // noise floor sat at 0.13 of amplitude, above the signal for every member
  // but the 6-tooth wheel. So use the vertices themselves, unbinned: take the
  // ones standing at the tip radius and ask which lattice they lie on. Tips at
  // spacing 2*pi/N also lie on every MULTIPLE of that lattice, so the answer is
  // the SMALLEST N whose lattice they concentrate on; a member with no such
  // lattice returns 0 and the row is refused rather than guessed at.
  const teethOfBody = (g) => {
    g.obj.updateWorldMatrix(true, true);
    const e = g.obj.matrixWorld.elements, ox = e[12], oy = e[13];
    const pos = g.obj.geometry.attributes.position;
    const v = new (Object.getPrototypeOf(g.obj.position).constructor)();
    const th = [];
    for (let i = 0; i < pos.count; i++) {
      v.fromBufferAttribute(pos, i).applyMatrix4(g.obj.matrixWorld);
      const dx = v.x - ox, dy = v.y - oy;
      if (Math.hypot(dx, dy) < g.tipR * 0.995) continue;
      th.push(Math.atan2(dy, dx));
    }
    if (th.length < 8) return 0;
    for (let N = 3; N <= 200; N++) {
      let cr = 0, ci = 0;
      for (const a of th) { const f = a * N; cr += Math.cos(f); ci += Math.sin(f); }
      if (Math.hypot(cr, ci) / th.length > 0.8) return N;
    }
    return 0;
  };
  const radialOf = (pts, ox, oy) => {          // a polygon's own binned envelope, for registration only
    const R = new Float64Array(BINS);
    for (const [x, y] of pts) {
      const dx = x - ox, dy = y - oy;
      let th = Math.atan2(dy, dx); if (th < 0) th += Math.PI * 2;
      const k = Math.min(BINS - 1, ((th / (Math.PI * 2)) * BINS) | 0);
      const r = Math.hypot(dx, dy); if (r > R[k]) R[k] = r;
    }
    const filled = []; for (let k = 0; k < BINS; k++) if (R[k] > 0) filled.push(k);
    for (let n = 0; n < filled.length; n++) {
      const a = filled[n], b = filled[(n + 1) % filled.length];
      let span = b - a; if (span <= 0) span += BINS;
      for (let d = 1; d < span; d++) R[(a + d) % BINS] = R[a] + ((R[b] - R[a]) * d) / span;
    }
    return R;
  };
  const inside = (px, py, poly) => {           // ray crossing, exact
    let c = false;
    for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
      const [xi, yi] = poly[i], [xj, yj] = poly[j];
      if ((yi > py) !== (yj > py) && px < ((xj - xi) * (py - yi)) / (yj - yi) + xi) c = !c;
    }
    return c;
  };
  const toBoundary = (px, py, poly) => {
    let best = Infinity;
    for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
      const d = segDist(px, py, poly[i][0], poly[i][1], poly[j][0], poly[j][1]);
      if (d < best) best = d;
    }
    return best;
  };

  // Register one member's analytic outline against its shipped mesh. The
  // registration is done on the TIP LATTICE — the angles of the vertices
  // standing at the tip radius — and not on a radial envelope: an envelope
  // binned from a sparse outline reports the HUB's radius in every bin no
  // outline vertex happened to land in, and a first cut that fitted against
  // one measured a 4.7 u disagreement on a gear 5.3 u in radius, which is the
  // hub, not the teeth.
  //
  // Tips lie on a lattice of spacing 2*pi/N, so their circular mean at
  // frequency N recovers the phase exactly and cheaply. Two numbers come back
  // as the evidence that the generator really describes this metal, and the
  // caller refuses the row if either is bad: `conc`, how tightly the tips sit
  // on that lattice (1 = perfectly), and `dTip`, the disagreement between the
  // analytic tip radius and the one measured off the mesh. A trapezoidal cut
  // of the same tooth count fails the second.
  const registerOne = (g, teeth, mateTeeth, mod) => {
    g.obj.updateWorldMatrix(true, true);
    const e = g.obj.matrixWorld.elements, ox = e[12], oy = e[13];
    const pos = g.obj.geometry.attributes.position;
    const v = new (Object.getPrototypeOf(g.obj.position).constructor)();
    let cr = 0, ci = 0, n = 0;
    for (let i = 0; i < pos.count; i++) {
      v.fromBufferAttribute(pos, i).applyMatrix4(g.obj.matrixWorld);
      const dx = v.x - ox, dy = v.y - oy;
      if (Math.hypot(dx, dy) < g.tipR * 0.995) continue;
      const a = Math.atan2(dy, dx) * teeth;
      cr += Math.cos(a); ci += Math.sin(a); n++;
    }
    const conc = n ? Math.hypot(cr, ci) / n : 0;
    const phiMesh = Math.atan2(ci, cr) / teeth;

    const spec = geom.gearToothSpec({ module: mod, teeth, mates: [mateTeeth] });
    // THE SHIPPED METAL IS NOT THE CUT PROFILE. `makeGear`/`makePinion` extrude
    // with `bevelSize: bevel`, and three.js offsets the contour OUTWARD by that
    // much perpendicular to every edge — the fact `gearOuterR` and
    // `gearTrueReach` were written for (§115/§136). So the body is the profile
    // grown all round, and the growth is what this measure must compare. It is
    // recovered rather than assumed: `gearBevel` is module*0.22 capped at
    // thickness*0.18, and the mesh's own z-band is thickness + 2*bevel, so the
    // two solve together off the measured band. `gearTrueReach`'s miter
    // (bevel / sin(half-angle), clamped) is applied per vertex, which is why the
    // recovered tip radius lands on the measured one — the check the caller
    // makes before believing any of this.
    const band = g.zhi - g.zlo;
    const bCap = mod * 0.22;
    const bevel = (band - 2 * bCap) * 0.18 >= bCap ? bCap : (0.18 * band) / 1.36;
    const cut = geom.cycloidalGearShape(spec).getPoints(1).map((q) => [q.x, q.y]);
    const poly0 = cut.map((_, i) => {
      const a = cut[(i - 1 + cut.length) % cut.length], b = cut[i], c = cut[(i + 1) % cut.length];
      let ux = b[0] - a[0], uy = b[1] - a[1], vx = c[0] - b[0], vy = c[1] - b[1];
      const lu = Math.hypot(ux, uy) || 1, lv = Math.hypot(vx, vy) || 1;
      ux /= lu; uy /= lu; vx /= lv; vy /= lv;
      // outward normal of a CCW edge (dx,dy) is (dy,-dx); their SUM is the
      // outward bisector and |sum| is 2*cos(turn/2) = 2*sin(half interior angle)
      const nx = uy + vy, ny = -(ux + vx), ln = Math.hypot(nx, ny);
      if (ln <= 1e-9) return [b[0], b[1]];
      const off = bevel / Math.max(ln / 2, 0.2);
      return [b[0] + (nx / ln) * off, b[1] + (ny / ln) * off];
    });
    let ar = 0, ai = 0, an = 0, aTip = 0;
    for (const [x, y] of poly0) aTip = Math.max(aTip, Math.hypot(x, y));
    for (const [x, y] of poly0) {
      if (Math.hypot(x, y) < aTip * 0.995) continue;
      const a = Math.atan2(y, x) * teeth;
      ar += Math.cos(a); ai += Math.sin(a); an++;
    }
    const phiPoly = an ? Math.atan2(ai, ar) / teeth : 0;

    const rot = phiMesh - phiPoly, ca = Math.cos(rot), sa = Math.sin(rot);
    return {
      conc, dTip: Math.abs(aTip - g.tipR), teeth, aTip, mTip: g.tipR, pitchR: spec.pitchR,
      addendum: spec.addendum, backlash: spec.backlash, bevel, cutTipR: spec.tipR,
      poly: poly0.map(([x, y]) => [ox + x * ca - y * sa, oy + x * sa + y * ca]),
    };
  };
  const exactPen = (m) => {
    const Na = teethOfBody(m.a), Nb = teethOfBody(m.b);
    const mod = (2 * m.centre) / (Na + Nb);
    if (!Na || !Nb) return { error: `no N-fold periodicity (${Na} / ${Nb})`, teeth: [Na, Nb], module: 0 };
    let ra, rb;
    try { ra = registerOne(m.a, Na, Nb, mod); rb = registerOne(m.b, Nb, Na, mod); }
    catch (err) { return { error: String(err), teeth: [Na, Nb], module: mod }; }
    let pen = 0;
    for (const [X, Y] of [[ra, rb], [rb, ra]])
      for (const [px, py] of X.poly)
        if (inside(px, py, Y.poly)) pen = Math.max(pen, toBoundary(px, py, Y.poly));
    return { teeth: [Na, Nb], module: mod, conc: Math.min(ra.conc, rb.conc),
      dTip: Math.max(ra.dTip, rb.dTip), pen,
      detail: [ra, rb].map((x) => ({ teeth: x.teeth, aTip: +x.aTip.toFixed(4), mTip: +x.mTip.toFixed(4),
        pitchR: +x.pitchR.toFixed(4), h: +x.addendum.toFixed(4), bl: +x.backlash.toFixed(4),
        bevel: +x.bevel.toFixed(4), cutTipR: +x.cutTipR.toFixed(4), conc: +x.conc.toFixed(4) })) };
  };

  const STEPS = 40;
  const rows = meshes.map((m) => ({ centre: +m.centre.toFixed(4), tipR: [+m.a.tipR.toFixed(3), +m.b.tipR.toFixed(3)], worstU: 0, atTension: null, perpU: 0, atPerpTension: null, filledFrac: 0, exactU: 0, atExactTension: null, conc: null, dTip: 0, teeth: null, module: 0, exactErr: null }));
  for (let i = 0; i <= STEPS; i++) {
    const t = i / STEPS;
    C.setPose({ tension: t });
    C.render();
    meshes.forEach((m, k) => {
      const ab = deepestInto(m.a, m.b), ba = deepestInto(m.b, m.a);
      const d = Math.max(ab.worst, ba.worst);
      const p = Math.max(ab.worstPerp, ba.worstPerp);
      if (d > rows[k].worstU) { rows[k].worstU = d; rows[k].atTension = +t.toFixed(3); }
      if (p > rows[k].perpU) { rows[k].perpU = p; rows[k].atPerpTension = +t.toFixed(3); }
      rows[k].filledFrac = Math.max(rows[k].filledFrac, ab.filledFrac, ba.filledFrac);
      const ex = exactPen(m);
      if (ex.error) { rows[k].exactErr = ex.error; return; }
      rows[k].teeth = ex.teeth; rows[k].module = ex.module;
      rows[k].conc = rows[k].conc === null ? ex.conc : Math.min(rows[k].conc, ex.conc);
      rows[k].dTip = Math.max(rows[k].dTip, ex.dTip);
      rows[k].detail = ex.detail;
      if (ex.pen > rows[k].exactU) { rows[k].exactU = ex.pen; rows[k].atExactTension = +t.toFixed(3); }
    });
  }
  return {
    unitMM: L.UNIT_MM,
    bodies: bodies.length,
    rows: rows.map((r) => ({
      ...r,
      worstU: +r.worstU.toFixed(4), worstMM: +(r.worstU * L.UNIT_MM).toFixed(4),
      perpU: +r.perpU.toFixed(4), perpMM: +(r.perpU * L.UNIT_MM).toFixed(4),
      filledFrac: +r.filledFrac.toFixed(4),
      exactU: +r.exactU.toFixed(5), exactMM: +(r.exactU * L.UNIT_MM).toFixed(5),
      conc: +(r.conc ?? 0).toFixed(4), dTip: +r.dTip.toFixed(5), module: +r.module.toFixed(6),
    })),
  };
});

if (out.error) { console.log('ERROR', out.error); }
else {
  console.log(`${out.bodies} extruded bodies in the unit, ${out.rows.length} of their pairs are meshes\n`);
  console.log('centre dist   tip radii        worst RADIAL overlap   at t     worst PERPENDICULAR   at t');
  for (const r of out.rows) {
    console.log(`${String(r.centre).padEnd(13)} ${String(r.tipR.join(' / ')).padEnd(16)} `
      + `${(r.worstU.toFixed(4) + ' u = ' + r.worstMM.toFixed(4) + ' mm').padEnd(22)} `
      + `${String(r.atTension).padEnd(8)} `
      + `${(r.perpU.toFixed(4) + ' u = ' + r.perpMM.toFixed(4) + ' mm').padEnd(21)} ${r.atPerpTension}`
      + `   ${(r.filledFrac * 100).toFixed(1)}% of bins sampled`);
  }
  console.log('\nEXACT measure — the analytic outline registered against each shipped mesh, '
    + 'placed at the\nmovement\'s own centres and phases, ray-crossing point-in-polygon, '
    + 'depth to the nearest\nboundary segment. No bins:');
  for (const r of out.rows) {
    if (r.exactErr) { console.log(`  ${r.centre}: refused — ${r.exactErr}`); continue; }
    const ok = r.conc >= 0.8 && r.dTip <= 0.02;
    console.log(`  cd ${r.centre}  ${r.teeth?.join('t / ')}t  m=${r.module}`);
    for (const d of r.detail || [])
      console.log(`    ${String(d.teeth).padStart(3)}t  cut tip ${d.cutTipR}  + bevel ${d.bevel}`
        + `  -> reconstructed ${d.aTip} vs mesh ${d.mTip}   backlash ${d.bl}`);
    console.log(`    tip lattice ${r.conc.toFixed(4)}, reconstruction off by ${r.dTip.toFixed(5)} u — `
      + `${ok ? 'the generator describes this metal' : 'REFUSED: it does not'}`);
    if (!ok) {
      console.log('      (a reconstruction that over-reaches is this probe\'s own limit, not a '
        + 'finding:\n       the miter is clamped at sin >= 0.2 and three.js handles its sharpest '
        + 'vertices its\n       own way, which shows up first on a 6-tooth wheel at module 1.07.)');
      continue;
    }
    console.log(`    worst penetration ${r.exactU.toFixed(5)} u = ${r.exactMM.toFixed(5)} mm  at tension ${r.atExactTension}`);
  }
  console.log('\nBoth silhouette columns are UPPER BOUNDS on the minimum-translation penetration '
    + 'depth. The\nradial one runs along a ray from the mate\'s centre and so inflates against a '
    + 'RADIAL flank —\nwhich is what a cycloidal pinion has below its pitch circle — so its pre- '
    + 'and post-\u00a7136\nvalues are not comparable. Where the EXACT measure accepts a row, that '
    + 'is the one to read.\n');
}
await browser.close();
srv.kill();
