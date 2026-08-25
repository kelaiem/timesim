// TODO 87 — THE PAWL AGAINST THE SAW, IN THE WHEEL'S OWN PLANE.
//
// probe-87-press measures the press stroke and reports a containment DEPTH
// that is capped at ~0.038 by geometry unrelated to the question: the pawl's
// 0.24 of z sits inside the skirt's 0.317 band with 0.038 to each face, so
// closestPointToPoint answers to a FACE however far the pawl advances in
// plane. That cap is documented there and it is honest — but it means the
// depth that matters has never been taken.
//
// This takes it. Both members are projected into the WHEEL's local frame and
// the pawl's vertices are tested against `userData.ratchetPoly` — the same
// polygon geometry.js cut the teeth from, so the measurement cannot drift from
// the metal. Point-in-polygon for containment, distance-to-polygon for depth.
//
// WHAT IT FOUND, and why the number reframes the item (2026-08-24, on the tree
// at 226ac8f): at rest the pawl straddles the tip circle and touches at depth
// 0 — the parked kiss, declared and correct. At the bottom of the stroke it
// stands at radius 4.451..5.378 against a ROOT CIRCLE OF 5.13, with all 24 of
// its vertices inside the saw and 0.7615 u of in-plane depth. The pawl does
// not foul the teeth; it ploughs through the body of the ratchet, for most of
// the cycle (past CLEAR_MARGIN from f 0.23 to f 0.96).
//
// So the drive contact is not a contact. The wheel's angle is computed
// kinematically (travel/arm, TODO 20) while the member said to be driving it
// is buried inside it — which is the same shape of finding as §35's original
// "every hand-off is a contact" audit, one member further upstream.
//
// This probe is step 3's acceptance test: a pawl that drives its wheel through
// a real contact reads 0 vertices inside at every pose except the declared
// kiss, where it reads depth 0.
//
// Run: cd tools && node probe-87-pawl.mjs
import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
const srv = spawn('python3', ['-m', 'http.server', '8480', '--bind', '127.0.0.1'], { cwd: '..', stdio: 'ignore' });
await new Promise((r) => setTimeout(r, 900));
const b = await chromium.launch(); const p = await b.newPage();
p.on('pageerror', (e) => console.log('PAGEERROR', String(e)));
await p.goto('http://127.0.0.1:8480/index.html?hud=0&sync=0', { waitUntil: 'load', timeout: 90000 });
await p.waitForFunction(() => !!window.__clock, null, { timeout: 90000 });
const out = await p.evaluate(async () => {
  const I = await import('./src/inspect.js');
  const THREE = await import('./vendor/three.module.js');
  const clock = window.__clock;
  const axis = I.AXES.find((a) => a.name === 'alarmPress');
  const unit = clock.labelEntries.find((e) => e.name === 'Alarm switch');
  // §163 — the pawl is no longer one box on the pusher. It is a shaped member
  // on the driver, and it ships as three bodies plus a nose disc: the arm is
  // CLIPPED off its own pivot bore (a post wider than a 2w arm would otherwise
  // pass through the arm's flanks whatever hole was cut), so tail and arm are
  // separate solids lapped inside the boss. The acceptance test is over ALL of
  // them, because a member that clears the saw in three pieces and fouls it in
  // a fourth has not cleared it.
  //
  // §169 — AND THE TEST IS THE SKIRT'S BAND, not the name. This measurement
  // is PLAN-ONLY: it projects into the wheel's 2D frame, which is exactly
  // right for members that share the saw's z band and says nothing at all
  // about ones that do not. §163's pawl group was entirely inside that band,
  // so the name and the band picked out the same set. §169's torsion spring
  // is not: its coil and its anchor pin stand a stratum BELOW the teeth, in
  // the driver's own, and the pin sits 0.109 inside the tip circle in plan —
  // which is unremarkable, since the whole driver does, and is the reason the
  // architecture works at all. Selecting by name alone reported that pin as
  // 0.0468 of penetration into a saw it passes a clear 0.541 underneath.
  const bodies = [], skipped = [];
  let skirt = null, wheelGroup = null, nose = null;
  unit.obj.traverse((o) => { if (o.name === 'alarmColSkirt') { skirt = o; wheelGroup = o.parent; } });
  if (!skirt) return { err: 'no alarmColSkirt — the band this test is taken in' };
  skirt.updateWorldMatrix(true, false);
  const band = new THREE.Box3().setFromObject(skirt);
  unit.obj.traverse((o) => {
    if (o.userData?.schematic || !o.isMesh) return;
    if (!/^alarmColPawl/.test(o.name)) return;
    const bb = new THREE.Box3().setFromObject(o);
    if (bb.max.z < band.min.z + 1e-9 || bb.min.z > band.max.z - 1e-9) { skipped.push(o.name); return; }
    bodies.push(o); if (o.name === 'alarmColPawlNose') nose = o;
    // (the band is re-tested per vertex below, for the one member that spans two)
  });
  if (!bodies.length) return { err: 'no alarmColPawl* meshes in the skirt band — §163 renamed the member' };
  const poly = wheelGroup.userData.ratchetPoly;
  if (!poly) return { err: 'no ratchetPoly on the wheel group' };
  // point-in-polygon and distance-to-polygon, in the wheel's local 2D
  const inPoly = (x, y) => {
    let c = false;
    for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
      const a = poly[i], d = poly[j];
      if ((a.y > y) !== (d.y > y) && x < ((d.x - a.x) * (y - a.y)) / (d.y - a.y) + a.x) c = !c;
    }
    return c;
  };
  const distToPoly = (x, y) => {
    let best = Infinity;
    for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
      const a = poly[i], d = poly[j];
      const vx = d.x - a.x, vy = d.y - a.y;
      const t = Math.max(0, Math.min(1, ((x - a.x) * vx + (y - a.y) * vy) / (vx * vx + vy * vy || 1)));
      best = Math.min(best, Math.hypot(x - (a.x + vx * t), y - (a.y + vy * t)));
    }
    return best;
  };
  const rows = [];
  const v = new THREE.Vector3();
  for (let i = 0; i <= 48; i++) {
    const f = i / 48;
    I.enterAxis(clock); clock.setPose(axis.pose(f)); clock.scene.updateMatrixWorld(true);
    // the pawl's corners, in the WHEEL's local frame (where ratchetPoly lives)
    wheelGroup.updateWorldMatrix(true, false);
    const inv = wheelGroup.matrixWorld.clone().invert();
    let deepest = 0, insideN = 0, n = 0, minGap = Infinity, noseGap = null, noseIn = 0, worstBody = null, worstAt = null, gapBody = null, gapAt = null, noseCtr = null;
    // the nose's CENTRE in the wheel's frame — the build's assert excludes an
    // (noseR + w) disc around it as the working zone, so the probe measures the
    // same exclusion and the two become comparable instead of merely different
    nose.updateWorldMatrix(true, false);
    { const c = new THREE.Vector3().applyMatrix4(inv.clone().multiply(nose.matrixWorld)); noseCtr = [c.x, c.y]; }
    let gapOut = Infinity, gapOutBody = null, gapOutAt = null;
    let rMin = Infinity, rMax = 0;
    for (const body of bodies) {
      body.updateWorldMatrix(true, false);
      const toWheel = inv.clone().multiply(body.matrixWorld);
      const pos = body.geometry.attributes.position;
      for (let k = 0; k < pos.count; k++) {
        // the band test is per VERTEX, not per mesh: §169's torsion spring is
        // ONE solid that spans two strata — its coil and anchor leg sit under
        // the teeth in the driver's, its working leg climbs into the pawl's —
        // so a mesh-level filter either measures its lower half against a saw
        // it passes 0.541 beneath, or excuses its upper half from one it is
        // genuinely in.
        v.fromBufferAttribute(pos, k).applyMatrix4(body.matrixWorld);
        if (v.z < band.min.z - 1e-9 || v.z > band.max.z + 1e-9) continue;
        v.fromBufferAttribute(pos, k).applyMatrix4(toWheel);
        n++;
        const r = Math.hypot(v.x, v.y);
        rMin = Math.min(rMin, r); rMax = Math.max(rMax, r);
        const d = distToPoly(v.x, v.y), isIn = inPoly(v.x, v.y);
        // the NOSE is the declared contact — it is meant to sit in a corner, so
        // its readings are reported apart rather than counted as penetration
        if (body === nose) { if (isIn) noseIn++; else if (noseGap === null || d < noseGap) noseGap = d; continue; }
        const fromNose = Math.hypot(v.x - noseCtr[0], v.y - noseCtr[1]);
        if (!isIn && fromNose >= 0.35 && d < gapOut) { gapOut = d; gapOutBody = body.name; gapOutAt = [+v.x.toFixed(3), +v.y.toFixed(3)]; }
        if (isIn) { insideN++; if (d > deepest) { deepest = d; worstBody = body.name; worstAt = [+v.x.toFixed(3), +v.y.toFixed(3)]; } }
        else if (d < minGap) { minGap = d; gapBody = body.name; gapAt = [+v.x.toFixed(3), +v.y.toFixed(3)]; gapFromNose = null; }
      }
    }
    rows.push({ f: +f.toFixed(3), insideN, n, inPlaneDepth: +deepest.toFixed(4),
                gap: minGap === Infinity ? null : +minGap.toFixed(4),
                noseGap: noseGap === null ? null : +noseGap.toFixed(4), noseIn,
                worstBody, worstAt, gapBody, gapAt,
                gapFromNose: (gapAt && noseCtr) ? +Math.hypot(gapAt[0] - noseCtr[0], gapAt[1] - noseCtr[1]).toFixed(3) : null,
                gapOut: gapOut === Infinity ? null : +gapOut.toFixed(4), gapOutBody, gapOutAt, rMin: +rMin.toFixed(3), rMax: +rMax.toFixed(3),
                colA: +clock.alarmDebug.alarmColShownA.toFixed(4) });
  }
  let pr=0; for(const q of poly) pr=Math.max(pr,Math.hypot(q.x,q.y));
  let prMin=Infinity; for(const q of poly) prMin=Math.min(prMin,Math.hypot(q.x,q.y));
  return { rows, skipped, bodies: bodies.map((o) => o.name), teeth: poly.length, tipR:+pr.toFixed(3), rootR:+prMin.toFixed(3) };
});
await b.close(); srv.kill();
if (out.err) { console.log(out.err); process.exit(1); }
console.log(`  saw: ${out.teeth} outline points, root circle ${out.rootR}, tip circle ${out.tipR}`);
console.log(`  in the skirt's band: ${out.bodies.join(', ')}`);
console.log(`  a stratum below it, not measured here: ${out.skipped.length ? out.skipped.join(', ') : '(none)'}\n`);
console.log('  f      colA     inside/n   IN-PLANE depth   gap      pawl r          nose');
for (const r of out.rows)
  console.log(`  ${String(r.f).padStart(5)}  ${String(r.colA).padStart(7)}  ${String(r.insideN).padStart(3)}/${r.n}`
    + `      ${String(r.inPlaneDepth).padStart(8)}   ${String(r.gap ?? '-').padStart(7)}`
    + `   ${String(r.rMin).padStart(6)}..${r.rMax}`
    + `   ${String(r.noseIn ? `in×${r.noseIn}` : (r.noseGap ?? '-')).padStart(7)}`
    + (r.inPlaneDepth > 0.15 ? '  ← past CLEAR_MARGIN' : ''));
const worst = out.rows.reduce((a, b2) => (b2.inPlaneDepth > a.inPlaneDepth ? b2 : a));
if (worst.worstBody) console.log(`  deepest body: ${worst.worstBody} at wheel-frame (${worst.worstAt}), r ${Math.hypot(...worst.worstAt).toFixed(3)}`);
console.log(`\n  worst in-plane penetration ${worst.inPlaneDepth} at f=${worst.f} (${worst.insideN} of ${worst.n} vertices inside the saw)`);

// §163's acceptance, in the terms this probe was written to answer: every body
// of the pawl BUT its nose clears the saw at every pose, and the nose is where
// the contact is. A nose reading `in×N` is the seat itself — the disc is
// solved to touch, and a corner it sits in reads a vertex or two inside by the
// tessellation's own width.
const worstGap = out.rows.reduce((a, b2) => ((b2.gap ?? Infinity) < (a.gap ?? Infinity) ? b2 : a));
console.log(`  the bodies' worst clearance to the saw ${worstGap.gap} at f=${worstGap.f}`
  + ` — ${worstGap.gapBody} at (${worstGap.gapAt}), ${worstGap.gapFromNose} from the nose's centre`);
const wOut = out.rows.reduce((a, b2) => ((b2.gapOut ?? Infinity) < (a.gapOut ?? Infinity) ? b2 : a));
console.log(`  OUTSIDE the nose's (noseR + w) working zone — the same exclusion the build's own`);
console.log(`  sweep applies — the worst is ${wOut.gapOut} at f=${wOut.f} (${wOut.gapOutBody} at ${wOut.gapOutAt})`);
process.exit(out.rows.every((r) => r.insideN === 0) ? 0 : 1);
