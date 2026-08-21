// §137 — THE TWO ELBOW RODS, READ OFF THE METAL, AND THE DRUM RE-CHECK.
//
// Gate A of the §137 plan asks whether the rigid bend in the reset and hack
// rods is DEFENSIBLE as matter: moment M = F·e, peak stress at ROD_R, knuckle
// deflection δ ≈ F·e·L²/(8EI), and the chord shortening that threatens the
// two-circle pose solves the rigid link exists to keep exact. Every one of
// those needs `e`, `f`, the chord `len`, the two segment lengths and the
// stroke — and `RESET_ROD_ELBOW` / `HACK_ROD_ELBOW` are build-time locals
// behind an IIFE. Nothing exposes them, so this probe reads them BACK OUT OF
// THE BUILT GEOMETRY, which is the better source anyway: it measures what
// shipped rather than what the solver returned.
//
// How the read-back works, and why it is exact. `makeElbowRodMesh(len, f, e)`
// builds the rod in a pose frame whose local +Y is the chord, post end at
// −len/2, and puts a knuckle sphere at rod-local (e, −len/2 + f·len). So the
// knuckle's own position gives e directly and Ey = −len/2 + f·len; the first
// segment's cylinder height gives L1 = hypot(e, Ey + len/2), and
//
//     len = 2·(√(L1² − e²) − Ey),      f = (Ey + len/2) / len
//
// closes it. The second segment is then a CHECK, not an input: √(L2² − e²)
// must equal len/2 − Ey, and the probe fails if it does not — a residual
// there would mean the mesh is not the two-segment link this arithmetic
// assumes, and every number downstream would be fiction.
//
// THE STROKE IS STEPPED, NOT POSED — twice, on purpose. `setPose` ticks with
// zero dt, so anything eased cannot move under it (CLAUDE.md's first trap),
// and both rods additionally ride BRANCH-TRACKED two-circle solves
// (`prevTailTip`, `stopPsiState`) whose state is carried tick to tick: a jump
// straight to the far end of the stroke is exactly how a solve lands on the
// wrong branch and reports a travel nobody's watch performs. So the travel is
// taken two ways — a fine monotone pose sweep that keeps the branch tracking
// continuous, and a real `step(dt)` run through the crown's own ease — and
// the two are required to AGREE at the settled ends. Agreement is the
// evidence; either number alone is a claim.
//
// It also re-takes the drum separation the elbow block asserts in prose:
//
//     "the drum's set-up cluster is 15+ units off both routes — checked
//      analytically, not scanned, because drumPos is declared later."
//
// §150 hoisted that centre distance into `FUSEE_DRUM_DIST` and now SHARES it
// with the span-aware chain conservation solve. The value did not move, but
// the coupling is new: a future re-derivation of the span law moves the drum
// and silently invalidates an un-scanned analytic claim. Measuring it here is
// the cheapest place to keep it honest, and the number is measured against
// the cluster's real footprint rather than its centre.
//
// Usage: cd tools && node probe-137-elbow.mjs [out.json]
//   ROOT=../.claude/worktrees/<name>  serves a different tree
//   PORT=8461                          the default
import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import { writeFileSync } from 'node:fs';

const PORT = process.env.PORT || 8461;
const ROOT = process.env.ROOT || '..';
const OUT = process.argv[2] || 'probe137-elbow.json';

const srv = spawn('python3', ['-m', 'http.server', String(PORT), '--bind', '127.0.0.1'], { cwd: ROOT, stdio: 'ignore' });
await new Promise((r) => setTimeout(r, 900));
const browser = await chromium.launch();
const page = await browser.newPage();
const pageErrors = [];
page.on('pageerror', (e) => { pageErrors.push(String(e)); console.error('PAGEERROR', String(e)); });
await page.goto(`http://127.0.0.1:${PORT}/index.html`, { waitUntil: 'load', timeout: 90000 });
await page.waitForFunction(() => !!window.__clock, null, { timeout: 90000 });

const R = await page.evaluate(async () => {
  const c = window.__clock;
  const THREE = await import('./vendor/three.module.js');
  const UNIT_MM = 0.379;              // layout.js: CHAIN_PITCH_MM / CHAIN_PITCH
  const ELBOW_E_MAX = 28;             // layout.js — the solver's own bound (the worst case Gate A argues from)
  const fails = [];
  const base = { tau: 0.05, leverEngage: 0, tension: 1 };
  const V = (o, x, y, z) => new THREE.Vector3(x, y, z).applyMatrix4(o.matrixWorld);
  const arr = (v) => [+v.x.toFixed(4), +v.y.toFixed(4), +v.z.toFixed(4)];

  // ---- THE BUILT ELBOW, READ BACK OUT OF THE MESH ----------------------
  const readRod = (name) => {
    const e0 = c.labelEntries.find((x) => x.name === name);
    if (!e0) { fails.push(`no '${name}' unit in labelEntries`); return null; }
    const segs = [], knuckles = [];
    e0.obj.traverse((o) => {
      if (!o.isMesh) return;
      if (o.geometry.type === 'CylinderGeometry') segs.push(o);
      else if (o.geometry.type === 'SphereGeometry') knuckles.push(o);
    });
    if (segs.length !== 2 || knuckles.length !== 1) {
      fails.push(`'${name}' is not a two-segment elbow: ${segs.length} cylinders, ${knuckles.length} knuckles`);
      return null;
    }
    // seg ONE is the post-side one: its centre sits below the knuckle in local y.
    segs.sort((a, b) => a.position.y - b.position.y);
    const K = knuckles[0].position;
    const e = K.x, Ey = K.y;
    const L1 = segs[0].geometry.parameters.height, L2 = segs[1].geometry.parameters.height;
    const rodR = segs[0].geometry.parameters.radiusTop;
    const knuckleR = knuckles[0].geometry.parameters.radius;
    const len = 2 * (Math.sqrt(Math.max(0, L1 * L1 - e * e)) - Ey);
    const f = (Ey + len / 2) / len;
    // The second segment is the CHECK, never an input.
    const resid = Math.sqrt(Math.max(0, L2 * L2 - e * e)) - (len / 2 - Ey);
    if (Math.abs(resid) > 1e-6) fails.push(`'${name}' elbow read-back residual ${resid.toExponential(2)} — the mesh is not the link this arithmetic assumes`);
    if (Math.abs(segs[1].geometry.parameters.radiusTop - rodR) > 1e-9) fails.push(`'${name}' segments differ in radius`);
    return {
      unit: name, obj: e0.obj,
      e: +e.toFixed(6), f: +f.toFixed(6), len: +len.toFixed(6),
      seg1: +L1.toFixed(6), seg2: +L2.toFixed(6),
      rodR: +rodR.toFixed(4), knuckleR: +knuckleR.toFixed(4),
      readBackResidual: +resid.toExponential(3),
      e_mm: +(e * UNIT_MM).toFixed(4), len_mm: +(len * UNIT_MM).toFixed(4),
      seg1_mm: +(L1 * UNIT_MM).toFixed(4), seg2_mm: +(L2 * UNIT_MM).toFixed(4),
      rodR_mm: +(rodR * UNIT_MM).toFixed(4),
      eOverEMax: +(e / ELBOW_E_MAX).toFixed(4),
      // THE FINDING THAT DECIDES HALF OF GATE A. `solveElbow` scans e over
      // ±eMax and takes the LEAST bend that clears (§85 C3), so e = 0 is a
      // legal answer and means the rod shipped STRAIGHT — no elbow, no
      // moment, nothing for the bending arithmetic to be about. When it is
      // 0 the solver's f is meaningless (a knuckle on a straight rod is
      // anywhere) and sits at the scan's own lower bound of 0.25, which is
      // an §86 corner value rather than a solved one.
      bent: Math.abs(e) > 1e-9,
      fAtScanLowerBound: Math.abs(f - 0.25) < 1e-9,
      // the arithmetic Gate A needs, at the built e and at the solver's bound
      section: { I_m4: Math.PI * (rodR * UNIT_MM * 1e-3) ** 4 / 4, c_m: rodR * UNIT_MM * 1e-3 },
      knuckleLocal: [+K.x.toFixed(6), +K.y.toFixed(6), +K.z.toFixed(6)],
    };
  };
  const rods = [readRod('Reset rod'), readRod('Hack rod')].filter(Boolean);
  if (rods.length !== 2) return { fails, rods: rods.map(({ obj, ...r }) => r) };

  // Endpoints, in the rod's own pose frame: post end at −len/2, driven end at
  // +len/2 (the frame makeElbowRodMesh and the placement code share).
  const ends = (r) => ({ post: V(r.obj, 0, -r.len / 2, 0), driven: V(r.obj, 0, r.len / 2, 0), knuckle: V(r.obj, r.e, r.len * r.f - r.len / 2, 0) });

  // ---- STROKE, TAKEN TWICE --------------------------------------------
  // (1) A fine monotone POSE sweep. crownPullT is what tick() places both
  // rods from, so a sweep in small steps keeps the branch-tracked solves
  // continuous — which is the thing a jump breaks.
  c.setPose({ ...base, crownPullT: 0 });
  const track = rods.map(() => ({ post: [], driven: [], knuckle: [] }));
  const fs = [];
  for (let i = 0; i <= 100; i++) fs.push(i / 100);
  for (let i = 99; i >= 0; i--) fs.push(i / 100);
  for (const fr of fs) {
    c.setPose({ ...base, crownPullT: fr });
    rods.forEach((r, i) => { const E = ends(r); track[i].post.push(E.post.clone()); track[i].driven.push(E.driven.clone()); track[i].knuckle.push(E.knuckle.clone()); });
  }
  const travelOf = (pts) => {
    let straight = 0, path = 0;
    for (let i = 0; i < pts.length; i++) for (let j = i + 1; j < pts.length; j++) straight = Math.max(straight, pts[i].distanceTo(pts[j]));
    for (let i = 1; i < pts.length; i++) path += pts[i].distanceTo(pts[i - 1]);
    return { travel: +straight.toFixed(5), travel_mm: +(straight * UNIT_MM).toFixed(4), pathLength: +path.toFixed(5) };
  };
  const posed = rods.map((r, i) => ({
    unit: r.unit,
    atPushed: { post: arr(track[i].post[0]), driven: arr(track[i].driven[0]), knuckle: arr(track[i].knuckle[0]) },
    atPulled: { post: arr(track[i].post[100]), driven: arr(track[i].driven[100]), knuckle: arr(track[i].knuckle[100]) },
    postEnd: travelOf(track[i].post),
    drivenEnd: travelOf(track[i].driven),
    knuckle: travelOf(track[i].knuckle),
    samples: [0, 0.25, 0.5, 0.75, 1].map((fr) => ({ crownPullT: fr, post: arr(track[i].post[Math.round(fr * 100)]), driven: arr(track[i].driven[Math.round(fr * 100)]) })),
  }));

  // (2) The EASED run: setPose's crownOut side effect arms the ease, then
  // step(dt) integrates it exactly as the watch does. Settling is MEASURED
  // (the endpoints stop moving), never assumed after a fixed frame count.
  const runEase = (target) => {
    c.setPose({ ...base, crownPullT: target > 0.5 ? 0.51 : 0.49 });   // sets crownOut; the ease does the rest
    let prev = rods.map((r) => ends(r).driven.clone());
    let frames = 0, moved = 0;
    for (; frames < 600; frames++) {
      c.step(1 / 60);
      const now = rods.map((r) => ends(r).driven.clone());
      moved = Math.max(...now.map((p, i) => p.distanceTo(prev[i])));
      prev = now;
      if (frames > 30 && moved < 1e-7) break;
    }
    return { frames, lastFrameMove: +moved.toExponential(2), ends: rods.map((r) => { const E = ends(r); return { unit: r.unit, post: arr(E.post), driven: arr(E.driven) }; }) };
  };
  const easedOut = runEase(1);
  const easedIn = runEase(0);
  // The agreement test — this is what makes either number evidence.
  const agree = rods.map((r, i) => {
    const dPulled = new THREE.Vector3(...easedOut.ends[i].driven).distanceTo(track[i].driven[100]);
    const dPushed = new THREE.Vector3(...easedIn.ends[i].driven).distanceTo(track[i].driven[0]);
    if (dPulled > 5e-3 || dPushed > 5e-3) fails.push(`${r.unit}: the stepped stroke and the posed sweep disagree at the ends (${dPulled.toFixed(5)} / ${dPushed.toFixed(5)})`);
    return { unit: r.unit, pulledEndDelta: +dPulled.toExponential(3), pushedEndDelta: +dPushed.toExponential(3) };
  });
  const eased = rods.map((r, i) => ({
    unit: r.unit,
    framesToSettlePulled: easedOut.frames, framesToSettlePushed: easedIn.frames,
    drivenEndTravel: +new THREE.Vector3(...easedOut.ends[i].driven).distanceTo(new THREE.Vector3(...easedIn.ends[i].driven)).toFixed(5),
    postEndTravel: +new THREE.Vector3(...easedOut.ends[i].post).distanceTo(new THREE.Vector3(...easedIn.ends[i].post)).toFixed(5),
  }));

  // ---- WHICH END IS DRIVEN, MEASURED ----------------------------------
  // The frame convention (−len/2 = post, +len/2 = driven) is a claim about
  // the build; it is cheap to check that the +Y end is the one sitting on the
  // member the rod drives.
  const nearestVertex = (unitName, p) => {
    const u = c.labelEntries.find((x) => x.name === unitName);
    if (!u) return null;
    let best = Infinity;
    const w = new THREE.Vector3();
    u.obj.traverse((o) => {
      if (!o.isMesh || !o.geometry.attributes.position) return;
      const pos = o.geometry.attributes.position, stride = Math.max(1, Math.floor(pos.count / 300));
      for (let i = 0; i < pos.count; i += stride) { w.fromBufferAttribute(pos, i).applyMatrix4(o.matrixWorld); best = Math.min(best, w.distanceTo(p)); }
    });
    return +best.toFixed(4);
  };
  c.setPose({ ...base, crownPullT: 0 });
  const drivenBy = [['Reset rod', 'Reset hammer'], ['Hack rod', 'Stop lever']].map(([rodName, partner]) => {
    const r = rods.find((x) => x.unit === rodName), E = ends(r);
    const dDriven = nearestVertex(partner, E.driven), dPost = nearestVertex(partner, E.post);
    if (!(dDriven < dPost)) fails.push(`${rodName}: the +len/2 end is not the one on ${partner} (${dDriven} vs ${dPost}) — the frame convention this probe reads e and f in does not hold`);
    return { rod: rodName, partner, drivenEndToPartner: dDriven, postEndToPartner: dPost };
  });

  // ---- THE DRUM SEPARATION --------------------------------------------
  // `setupWork.position` IS drumPos (x, y, 0) — the build's own placement, so
  // the centre is read rather than restated. The footprint is the cluster's
  // real XY reach about that centre, not a nominal radius.
  const clusterOf = (name) => {
    const u = c.labelEntries.find((x) => x.name === name);
    if (!u) return null;
    const w = new THREE.Vector3();
    let rMax = 0;
    const ctr = new THREE.Vector3();
    u.obj.getWorldPosition(ctr);
    u.obj.traverse((o) => {
      if (!o.isMesh || !o.geometry.attributes.position) return;
      const pos = o.geometry.attributes.position, stride = Math.max(1, Math.floor(pos.count / 400));
      for (let i = 0; i < pos.count; i += stride) { w.fromBufferAttribute(pos, i).applyMatrix4(o.matrixWorld); rMax = Math.max(rMax, Math.hypot(w.x - ctr.x, w.y - ctr.y)); }
    });
    return { unit: name, centre: [+ctr.x.toFixed(3), +ctr.y.toFixed(3)], footprintR: +rMax.toFixed(3) };
  };
  const clusters = [clusterOf('Set-up work'), clusterOf('Mainspring drum')].filter(Boolean);
  const segXYDist = (p, a, b) => {
    const dx = b.x - a.x, dy = b.y - a.y, L = dx * dx + dy * dy;
    const t = L < 1e-16 ? 0 : Math.max(0, Math.min(1, ((p[0] - a.x) * dx + (p[1] - a.y) * dy) / L));
    return Math.hypot(p[0] - (a.x + t * dx), p[1] - (a.y + t * dy));
  };
  const drum = clusters.map((cl) => {
    const rows = rods.map((r, i) => {
      let best = Infinity, at = null;
      for (let k = 0; k < track[i].post.length; k++) {
        const A = track[i].post[k], K = track[i].knuckle[k], B = track[i].driven[k];
        const d = Math.min(segXYDist(cl.centre, A, K), segXYDist(cl.centre, K, B));
        if (d < best) { best = d; at = k; }
      }
      return {
        rod: r.unit,
        minCentreDistXY: +best.toFixed(3),
        minEdgeSeparationXY: +(best - cl.footprintR).toFixed(3),
        atCrownPullT: +(at <= 100 ? at / 100 : (200 - at) / 100).toFixed(2),
      };
    });
    return { ...cl, routes: rows };
  });
  const claim15 = drum.every((cl) => cl.routes.every((r) => r.minEdgeSeparationXY >= 15));

  c.resetInputs();
  return {
    probe: '§137 elbow rods', unitMM: UNIT_MM, elbowEMax: ELBOW_E_MAX,
    rods: rods.map(({ obj, ...r }) => r),
    drivenEndCheck: drivenBy,
    strokePosed: posed, strokeEased: eased, strokeAgreement: agree,
    drumSeparation: { claim: "the drum's set-up cluster is 15+ units off both routes", holds: claim15, clusters: drum },
    fails,
  };
});
await browser.close(); srv.kill();

writeFileSync(OUT, JSON.stringify(R, null, 2));
const f = (x, n = 4) => (x === null || x === undefined ? 'n/a' : Number(x).toFixed(n));
console.log(`\n§137 ELBOW RODS — ROOT=${ROOT}`);
console.log(`  rod                e        f        len      seg1     seg2     rodR    e/ELBOW_E_MAX  read-back residual`);
for (const r of R.rods)
  console.log(`  ${r.unit.padEnd(12)} ${f(r.e).padStart(9)} ${f(r.f).padStart(8)} ${f(r.len).padStart(9)} ${f(r.seg1).padStart(8)} ${f(r.seg2).padStart(8)} ${f(r.rodR, 3).padStart(7)} ${f(r.eOverEMax, 3).padStart(10)}   ${r.readBackResidual}`);
console.log(`  in mm:`);
for (const r of R.rods)
  console.log(`  ${r.unit.padEnd(12)} e ${f(r.e_mm, 3)} mm · len ${f(r.len_mm, 3)} mm · segments ${f(r.seg1_mm, 3)} / ${f(r.seg2_mm, 3)} mm · rod r ${f(r.rodR_mm, 4)} mm`);
for (const r of R.rods)
  console.log(`  ${r.unit.padEnd(12)} ${r.bent ? `BENT — e ${f(r.e, 3)} u (${f(r.e_mm, 3)} mm), ${f(100 * r.eOverEMax, 1)}% of ELBOW_E_MAX ${R.elbowEMax}` : 'STRAIGHT — e = 0, so M = F·e = 0 and the bend arithmetic has no subject'}` +
    (r.bent ? '' : `; f ${f(r.f, 2)} is the scan's lower bound, not a solved value`));
console.log(`\n  STROKE over the crown cycle (posed sweep, and the stepped ease beside it):`);
for (const p of R.strokePosed) {
  const e = R.strokeEased.find((x) => x.unit === p.unit), a = R.strokeAgreement.find((x) => x.unit === p.unit);
  console.log(`  ${p.unit.padEnd(12)} post end ${f(p.postEnd.travel)} u (${f(p.postEnd.travel_mm, 3)} mm) · driven end ${f(p.drivenEnd.travel)} u (${f(p.drivenEnd.travel_mm, 3)} mm) · knuckle ${f(p.knuckle.travel)} u`);
  console.log(`  ${''.padEnd(12)} stepped: post ${f(e.postEndTravel)} / driven ${f(e.drivenEndTravel)} u, settled in ${e.framesToSettlePulled}/${e.framesToSettlePushed} frames; agreement ${a.pulledEndDelta} / ${a.pushedEndDelta}`);
}
console.log(`\n  DRIVEN-END CHECK (the +len/2 end must be the one on the member it drives):`);
for (const d of R.drivenEndCheck) console.log(`    ${d.rod.padEnd(12)} → ${d.partner.padEnd(14)} driven ${f(d.drivenEndToPartner, 3)} u · post ${f(d.postEndToPartner, 3)} u`);
console.log(`\n  DRUM SEPARATION — "${R.drumSeparation.claim}": ${R.drumSeparation.holds ? 'HOLDS' : 'DOES NOT HOLD'}`);
for (const cl of R.drumSeparation.clusters) {
  console.log(`    ${cl.unit} at ${cl.centre.join(', ')} · footprint r ${f(cl.footprintR, 3)}`);
  for (const r of cl.routes) console.log(`       ${r.rod.padEnd(12)} centre ${f(r.minCentreDistXY, 3).padStart(8)} u · edge-to-route ${f(r.minEdgeSeparationXY, 3).padStart(8)} u (at crownPullT ${r.atCrownPullT})`);
}
console.log(`\n  written to ${OUT}`);
const fails = [...(R.fails || [])];
if (pageErrors.length) fails.push(`page errors: ${pageErrors.length}`);
console.log(fails.length ? '\nFAIL\n  ' + fails.join('\n  ') : '\nOK — both elbows read back off the metal, both strokes agree, the drum claim measured');
process.exit(fails.length ? 1 : 0);
