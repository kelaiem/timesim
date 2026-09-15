// DO THE TEETH OF A CROSSED-AXIS MESH INTERLEAVE, OR DRIVE THROUGH EACH OTHER?
//
// The §194 registry cannot ask this. `meshCandidates` enumerates a pair only
// when its axes are PARALLEL and its centre distance closes on the pitch-radius
// sum, so every bevel and crown-wheel mesh is out of scope by construction and
// `meshCoverage`'s "0 undeclared meshes in the metal" is silent about all of
// them. Two carry the whole keyless works: `crownWheel ⇄ windingPinion`
// (engaged while WINDING) and `clutchRim ⇄ settingWheel` (engaged while SETTING
// THE HANDS). Neither has a phase solve, a ratio check or a centre-distance
// check, and their teeth sit where a half-pitch seed put them.
//
// Neither appears even in probe-194-mesh-population's out-of-scope COUNT.
// Measured: crownWheel ⇄ windingPinion stands at centre 4.1480 against
// rA+rB 4.7600 and clutchRim ⇄ settingWheel at 4.2374, so both fall outside
// that scan's 5% band — by a rule that does not govern them. A bevel pair's
// pitch cones share an APEX; the sum of pitch radii is not the constraint. The
// four pairs in that count are the ones whose numbers happen to land near a
// metric that does not apply to them.
//
// IT IS NOT probe-194-mesh-population (which ENUMERATES parallel candidates and
// is the thing that cannot see these), NOT meshPhase / `measureMeshNow` /
// probe-train-mesh-phase (anti-phase on a LINE OF CENTRES, which two crossed
// axes do not have), and NOT probe-95-interpenetration, whose parity witness
// this file tried first and had to abandon — see below.
//
// THE WITNESS IS THE AUTHORED OUTLINE, NOT THE TRIANGLES, and that is what
// makes the measurement possible at all. A parity raycast needs a CLOSED
// surface and the movement's gear bodies are not closed: measured, thirdWheel
// carries 4 boundary edges, windingPinion and clutchRim 4, fourthPinion 70,
// crownWheel and settingWheel 150 — and they are not the signed-zero seam
// artifacts probe-95's header records, because the counts are INVARIANT as the
// position weld loosens from 1e-5 to 1e-2, four orders of magnitude. So the
// first build of this probe REFUSED every pair including its controls, which
// was the correct answer to the wrong question.
//
// An `ExtrudeGeometry` keeps `parameters.shapes`, so a gear's solid is
// recoverable EXACTLY without touching the triangle soup: a polygon (contour
// plus holes) in the gear's own XY, swept through `options.depth`. Inside that
// core band the prism IS the solid — the bevel only insets the profile near the
// two faces, so testing the core is conservative in the safe direction (it can
// only UNDER-report an overlap, never invent one). Point-in-prism is a z-band
// test and a point-in-polygon test: no closedness needed, and no raycast to be
// fooled by an open wall. TODO 100's `outlines` check leans on the same
// reference, and weldGeometry carries it through the weld.
//
// The sample set is each gear's own tooth OUTLINE, densified so no edge can
// slip between another's teeth, taken at several heights across the core band
// and tested against the other gear's prism — BOTH DIRECTIONS, because a
// containment test is not symmetric (the skill's own trap) and a tooth tip
// buried in a rim reads differently from the rim's outline against the tooth.
//
// THE SWEEP IS THE MECHANISM'S OWN MOTION, and getting that wrong is what the
// must-miss control caught on the first working build. Rotating the DRIVER
// alone through its phase — measureMeshNow's injection idiom — is right for one
// pose and wrong for a sweep: it destroys the mesh phase by construction, so
// every pair collides somewhere within a pitch and the known-good control read
// 0.1779 as built against 0.1683 half-a-pitch off. It discriminated nothing.
// The question is not "is there a phase where these teeth would foul", which is
// yes for any two gears; it is whether they foul AT THE PHASE THE MOVEMENT PUTS
// THEM IN. So each subject names the input that drives it and the sim poses
// both members through the tick laws, exactly as the registry's pose net does.
// That also settles the sign question a crossed-axis pair would otherwise
// raise: nothing here has to know which way a bevel turns its mate.
//
// GUARDS against the clean-but-empty result:
//   · the polygon must DESCRIBE this mesh — its XY extent is asserted against
//     the geometry's own local bounding box, so a shape reference that no
//     longer matches the welded metal is a refusal, not a silent zero;
//   · every subject's sample count is printed, so a pair can never read clear
//     because nothing was sampled.
//
// CONTROLS, both kinds, on a pair that is NOT the subject — a solved, parallel,
// battery-green mesh, so the measure is bracketed on known metal:
//   · must-miss — third wheel ⇄ fourth pinion, as built, must read CLEAR;
//   · must-hit  — the same pair with a HALF PITCH injected into one member must
//     read DEEP, near a tooth height.
// A run whose must-hit does not fire has measured nothing, and says so.
//
// WHAT IT FOUND, on the tree that shipped it (TODO 136). A correct mesh reads
// ZERO — its flanks touch and the outline never enters the other's core — so
// the bar is not a guessed threshold, and the reference for "bad" is measured
// on the spot: a known-good mesh with HALF A PITCH injected reads 0.1707.
//
//   crownWheel ⇄ windingPinion   WINDING   0.2065   27% of a tooth   181 pts
//   clutchRim  ⇄ settingWheel    SETTING   0.1372   18% of a tooth    48 pts
//   alarmDiscBevel ⇄ alarmStemBevel ALARM  0.0000    0%                0 pts
//
// Both keyless bevels carry metal inside metal across their whole travel, and
// the winding pair is buried DEEPER than the deliberate half-pitch defect.
//
// The alarm bevel's zero was read as the reassurance that the measure is not
// simply calling every crossed-axis pair broken. IT IS NOT THAT, and tier three
// is what corrected it — see below. (An earlier draft pointed this contrast at
// `alarmSetIdler2 ⇄ alarmStemBevel`, two parts standing 2.179 apart whose boxes
// never intersect: a pair that cannot touch reads zero for a reason that has
// nothing to do with teeth. The row names the corner's real bevel pair now, and
// a NOT A PAIR line fires on any subject whose AABBs never meet.)
//
// TIER TWO asks whether INDEXING can save either keyless pair: it sweeps the one
// knob each has through a whole pitch. Neither reaches zero — floors 0.1811 and
// 0.0971 against a control that runs 0.0000 to 0.1801 — so TODO 136's prescribed
// phase fix is impossible and the item was rewritten.
//
// TIER THREE is the LINE (CLAUDE.md's "design in a line, fold to fit"): it builds
// a conjugate 90° pair in FREE SPACE from the shipped counts, at the station the
// counts demand rather than the one `layout.js` uses, and asks whether the form
// reads zero before any layout move is spent on it. The station derivation is the
// by-product worth keeping — the pinion's axis must cross the crown's PITCH
// CIRCLE, and `layout.js` sites it `windPinionR * 0.55` = 0.7480 further out.
//
// THE FORM REFUSED, and that is TODO 138. Built correctly — half-angles 68.199° +
// 21.801° = 90°, one cone distance, the convention verified off the metal — the
// pair reads floor 0.0000 AND ceiling 0.0000, at every index, both senses, all
// three mountings. `makeBevelGear` shears a flat outline onto a cone, and two
// complementary tapers satisfy tc·tp = 1 exactly, which forces the two bands to
// meet on the tangent LINE and nowhere else. So the alarm bevel's zero above is
// not a healthy mesh either: no bevel pair in this movement can transmit through
// tooth contact, which makes all three declared `bevelPair` transfers simulation
// fictions until a real bevel tooth generator lands.
//
// REPORT, not a gate, and deliberately: the failing pairs are undecided debt,
// and a check that lands red on arrival needs an owner first (§54's banner). It
// is gate-ready the day TODO 136 is fixed — the bar is zero, and nothing about it
// would need choosing — and 136 now waits on TODO 138 for a form to be cut in.
//
// cd tools && node probe-crossed-axis-mesh.mjs
import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
const ROOT = process.env.ROOT || join(dirname(fileURLToPath(import.meta.url)), '..');
const PORT = Number(process.env.PORT || 8513);
const srv = spawn('python3', ['-m', 'http.server', String(PORT), '--bind', '127.0.0.1'], { cwd: ROOT, stdio: 'ignore' });
process.on('exit', () => srv.kill());
await new Promise((r) => setTimeout(r, 1200));
const browser = await chromium.launch();
const page = await browser.newPage();
page.on('pageerror', (e) => console.log('PAGEERROR', String(e)));
await page.goto(`http://127.0.0.1:${PORT}/index.html`, { waitUntil: 'load', timeout: 90000 });
await page.waitForFunction(() => !!window.__clock, null, { timeout: 90000 });

const out = await page.evaluate(async () => {
  const THREE = await import('three');
  const C = window.__clock;
  const log = [];

  // ---- the authored solid -------------------------------------------------
  // A gear's ExtrudeGeometry is a polygon swept through `depth`. Inside the
  // core band the prism is the solid exactly; the bevel only insets the two
  // faces, so a core test under-reports and never invents.
  // THE CONICAL SOLID IS TESTED ON ITS RING, not against an angular outline. The §136 flank is RADIAL, so in (φ, θ) the outline has vertical runs
  // and one azimuth carries several θ — measured, 40 of a 10-tooth bevel's 130
  // steps do not increase in φ. A `θ ≤ Θ(φ)` test has no well-defined Θ there
  // and put a vertex of the gear's own mesh 7.46° outside the solid containing
  // it. Developed, the same outline is the simple closed polygon TODO 100
  // already gates, and the ordinary crossing count applies.
  const toFlat = (P, x, y, z) => {
    const th = Math.atan2(Math.hypot(x, y), z), phi = Math.atan2(y, x);
    const r = P.backR + P.coneR * Math.tan(th - P.gamma);
    return [r * Math.cos(phi), r * Math.sin(phi)];
  };

  const prismOf = (mesh) => {
    // TODO 138 Landing 2 — THE CONICAL SOLID, which is neither a prism nor a
    // sheared one. Its boundary is an ANGULAR outline about the shared apex
    // between two cone distances, so there is no z-band to un-shear into and no
    // authored 2D shape to read: `makeConicalGear` hands the outline over
    // directly. The per-vertex assert below is the same covenant the prism
    // branch keeps — a declared solid is a claim about THIS mesh, so it is
    // checked against every vertex rather than trusted.
    const sc = mesh.userData && mesh.userData.solid;
    if (sc && sc.kind === 'apexCone') {
      const g2 = mesh.geometry, P2 = g2.attributes.position;
      const desc = { kind: 'apexCone', rhoLo: sc.rhoLo, rhoHi: sc.rhoHi, boreR: sc.boreR,
        outline: sc.outline, poly: sc.ringPoly, gamma: sc.gamma, backR: sc.backR, coneR: sc.coneR,
        declared: true, mesh, rPoly: sc.rhoHi, zLo: sc.rhoLo, zHi: sc.rhoHi, shearZ: 0,
        toWorld: mesh.matrixWorld, toLocal: new THREE.Matrix4() };
      // VERIFY THE DECLARATION AGAINST THE METAL, every vertex, exactly as the
      // prism branch does: developed, each vertex must land inside the polygon,
      // and its cone distance inside the band. Every term is a LENGTH.
      let worst = 0, why = '';
      for (let i = 0; i < P2.count; i++) {
        const x = P2.getX(i), y = P2.getY(i), z = P2.getZ(i);
        const rho = Math.hypot(x, y, z);
        const [fx, fy] = toFlat(desc, x, y, z);
        const out = inRing(sc.ringPoly, fx, fy) ? 0 : distRing(sc.ringPoly, fx, fy);
        const terms = [[sc.rhoLo - rho, 'inside the inner cone distance'],
          [rho - sc.rhoHi, 'outside the outer cone distance'],
          [out, 'outside the developed outline']];
        for (const [v, w] of terms) if (v > worst) { worst = v; why = w; }
      }
      const tol = 2e-3 * sc.rhoHi;
      if (worst > tol)
        return { bad: `the declared apex-cone solid (ρ ${sc.rhoLo.toFixed(3)}..${sc.rhoHi.toFixed(3)}) does not `
          + `contain this mesh: vertices run ${worst.toFixed(4)} ${why}, against a ${tol.toFixed(4)} allowance` };
      desc.fit = worst;
      return desc;
    }
    const g = mesh.geometry, pr = g.parameters;
    if (!pr || !pr.shapes) return { bad: 'no authored shape on this geometry' };
    const shapes = Array.isArray(pr.shapes) ? pr.shapes : [pr.shapes];
    if (shapes.length !== 1) return { bad: `${shapes.length} shapes — this probe reads one` };
    const depth = pr.options && pr.options.depth;
    if (!(depth > 0)) return { bad: 'no extrude depth' };
    const pts = shapes[0].extractPoints(24);
    const ring = (a) => a.map((p) => [p.x, p.y]);
    const contour = ring(pts.shape), holes = pts.holes.map(ring);
    if (contour.length < 3) return { bad: 'contour has no area' };
    // GUARD: does this polygon describe THIS mesh? Compare its XY extent with
    // the geometry's own local box. A stale shape reference would otherwise
    // test a phantom and report clear.
    g.computeBoundingBox();
    const bb = g.boundingBox;
    let rPoly = 0;
    for (const [x, y] of contour) rPoly = Math.max(rPoly, Math.hypot(x, y));
    // The mesh's own XY half-extent — NOT the box CORNER, which is r·√2 for a
    // disc and made this guard fire on every gear in the movement the first
    // time it ran. The bevel lip puts the mesh a little OUTSIDE the shape
    // (three.js grows the profile by bevelSize), so the mesh reads slightly
    // larger and the core prism stays the conservative inner solid.
    const rGeo = Math.max(Math.abs(bb.min.x), Math.abs(bb.max.x), Math.abs(bb.min.y), Math.abs(bb.max.y));
    if (Math.abs(rPoly - rGeo) > 0.15 * Math.max(rPoly, rGeo))
      return { bad: `shape extent ${rPoly.toFixed(3)} does not match the mesh's ${rGeo.toFixed(3)} — stale reference` };
    // THE SOLID IS DECLARED BY THE BUILDER, NOT INFERRED HERE (§136). The XY
    // guard above cannot see a z-shear, and `makeBevelGear` applies one AFTER
    // extruding and never centres the result, while `parameters` goes on
    // describing the flat uncentred prism. Reading only `parameters`, this
    // probe tested a band a bevel's metal does not occupy and answered CLEAR —
    // a reading TODO 136 then quoted as proof the instrument was not simply
    // calling every crossed-axis pair broken.
    //
    // So each builder records `userData.solid = { zLo, zHi, shearZ }` on the
    // mesh, and the shear is INVERTIBLE (x and y untouched), which makes
    // point-in-solid exact rather than approximate: un-shear a point and test
    // it against the flat band.
    //
    // The fallback is the old assumption — a prism centred on z = 0 — kept so
    // an undeclared builder still measures. What makes that safe is the assert
    // below rather than the assumption itself.
    const sol = (mesh.userData && mesh.userData.solid)
      || { zLo: -depth / 2, zHi: depth / 2, shearZ: 0, assumed: true };
    // VERIFY THE DECLARATION AGAINST THE METAL, every vertex of it. A declared
    // solid is a claim about this mesh, so it is asserted against the mesh the
    // way §137 requires a figure an instrument also computes to be asserted
    // rather than resembled: un-shear each position and it must land inside the
    // declared band. This catches a wrong shear, a wrong band, a builder that
    // moved its extrude, and an undeclared reshape — all as one refusal.
    const P0 = g.attributes.position;
    const tol = 0.25 * (sol.zHi - sol.zLo);   // the extrude bevel's lip lives in here
    let worstLo = 0, worstHi = 0;
    for (let i = 0; i < P0.count; i++) {
      const x = P0.getX(i), y = P0.getY(i), z = P0.getZ(i);
      const zu = z - Math.hypot(x, y) * sol.shearZ;
      if (sol.zLo - zu > worstLo) worstLo = sol.zLo - zu;
      if (zu - sol.zHi > worstHi) worstHi = zu - sol.zHi;
    }
    if (worstLo > tol || worstHi > tol)
      return { bad: `the ${sol.assumed ? 'ASSUMED' : 'declared'} solid (z ${sol.zLo.toFixed(3)}..${sol.zHi.toFixed(3)}, shear ${sol.shearZ.toFixed(3)}) `
        + `does not contain this mesh: un-sheared, its vertices run ${worstLo.toFixed(3)} below and ${worstHi.toFixed(3)} above it, against a ${tol.toFixed(3)} lip allowance` };
    return { contour, holes, hz: (sol.zHi - sol.zLo) / 2, zLo: sol.zLo, zHi: sol.zHi, shearZ: sol.shearZ,
      declared: !sol.assumed, fit: Math.max(worstLo, worstHi), mesh, rPoly,
      toWorld: mesh.matrixWorld, toLocal: new THREE.Matrix4() };
  };

  const inRing = (ring, x, y) => {
    let hit = false;
    for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
      const [xi, yi] = ring[i], [xj, yj] = ring[j];
      if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) hit = !hit;
    }
    return hit;
  };
  const distRing = (ring, x, y) => {
    let best = Infinity;
    for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
      const [xi, yi] = ring[i], [xj, yj] = ring[j];
      const dx = xj - xi, dy = yj - yi, L2 = dx * dx + dy * dy;
      let t = L2 ? ((x - xi) * dx + (y - yi) * dy) / L2 : 0;
      t = Math.max(0, Math.min(1, t));
      best = Math.min(best, Math.hypot(x - (xi + t * dx), y - (yi + t * dy)));
    }
    return best;
  };
  // depth of a LOCAL point inside the prism: 0 outside, else its distance to
  // the nearest wall or face — how far the metal is buried.
  // Depth of a point inside the solid. The point arrives in the target's LOCAL
  // frame; un-shear it (the inverse of the builder's `z += hypot(x,y)·taper`)
  // and the test is the flat band plus the authored outline. For a spur cut
  // shearZ is 0 and this is exactly what it always was.
  const depthIn = (P, v) => {
    if (P.kind === 'apexCone') {
      const rho = Math.hypot(v.x, v.y, v.z), rc = Math.hypot(v.x, v.y);
      if (rho < P.rhoLo || rho > P.rhoHi || rc < P.boreR) return 0;
      const [fx, fy] = toFlat(P, v.x, v.y, v.z);
      if (!inRing(P.poly, fx, fy)) return 0;
      // a LENGTH in the developed plane — the same currency the prism branch
      // reports, and commensurate with the movement's linear budgets.
      return Math.min(distRing(P.poly, fx, fy), rho - P.rhoLo, P.rhoHi - rho, rc - P.boreR);
    }
    const zu = v.z - Math.hypot(v.x, v.y) * P.shearZ;
    if (zu < P.zLo || zu > P.zHi) return 0;
    if (!inRing(P.contour, v.x, v.y)) return 0;
    for (const h of P.holes) if (inRing(h, v.x, v.y)) return 0;
    let d = Math.min(distRing(P.contour, v.x, v.y), zu - P.zLo, P.zHi - zu);
    for (const h of P.holes) d = Math.min(d, distRing(h, v.x, v.y));
    return d;
  };

  // A gear's own outline, densified and taken at several heights — the sample
  // set. Densified so a long edge cannot bridge a gap between another's teeth.
  // The samples are points ON THIS PART'S SURFACE in its own local frame, so
  // they carry the builder's shear FORWARD — the inverse of what depthIn does
  // to a point arriving from elsewhere. Levels are fractions of the declared
  // band, inset from both faces so a sample never sits exactly on one.
  const samplesOf = (P, step = 0.04, levels = [0.15, 0.325, 0.5, 0.675, 0.85]) => {
    const pts = [];
    if (P.kind === 'apexCone') {
      // on the toothed surface itself, at cone distances across the face band
      for (const [phi, th] of P.outline)
        for (const f of levels) {
          const rho = P.rhoLo + (P.rhoHi - P.rhoLo) * f;
          pts.push(new THREE.Vector3(rho * Math.sin(th) * Math.cos(phi),
            rho * Math.sin(th) * Math.sin(phi), rho * Math.cos(th)));
        }
      return pts;
    }
    const ring = P.contour;
    for (let i = 0; i < ring.length; i++) {
      const [x0, y0] = ring[i], [x1, y1] = ring[(i + 1) % ring.length];
      const L = Math.hypot(x1 - x0, y1 - y0);
      const n = Math.max(1, Math.ceil(L / step));
      for (let k = 0; k < n; k++) {
        const t = k / n, x = x0 + (x1 - x0) * t, y = y0 + (y1 - y0) * t;
        const shear = Math.hypot(x, y) * P.shearZ;
        for (const f of levels) pts.push(new THREE.Vector3(x, y, P.zLo + (P.zHi - P.zLo) * f + shear));
      }
    }
    return pts;
  };

  const rotors = [];
  C.scene.updateMatrixWorld(true);
  C.scene.traverse((o) => {
    if (o.userData && typeof o.userData.r === 'number' && o.userData.r > 0 && !o.userData.schematic) rotors.push(o);
  });
  const rotorByName = (n) => rotors.find((o) => o.name === n) || null;
  const bodyOf = (o) => {           // the toothed body: the largest mesh under the rotor
    let best = null;
    o.traverse((m) => {
      if (!m.isMesh || !m.geometry || !m.geometry.attributes.position) return;
      if (!best || m.geometry.attributes.position.count > best.geometry.attributes.position.count) best = m;
    });
    return best;
  };

  // DO THESE TWO PARTS EVER COME NEAR EACH OTHER? A burial of zero means
  // nothing if the pair never engages, and this probe shipped a row where it
  // meant exactly that: the alarm row paired the setting idler with the stem
  // bevel, two parts standing 2.179 apart with DISJOINT bounding boxes — not a
  // mesh at all. It read 0.0000 at every phase for that reason, and TODO 136
  // quoted the zero as proof the instrument was not simply calling every
  // crossed-axis pair broken. The skill's own rule, learned again: pick a pair
  // that genuinely overlaps, and make the probe SAY so rather than trusting the
  // choice. Boxes are a weak test for CONTACT and a decisive one for ABSENCE —
  // if two AABBs never intersect across a sweep, the solids certainly never
  // touch and any zero is vacuous.
  const boxSep = (oA, oB) => {
    const A = new THREE.Box3().setFromObject(oA), B = new THREE.Box3().setFromObject(oB);
    return Math.max(0, B.min.x - A.max.x, A.min.x - B.max.x,
      B.min.y - A.max.y, A.min.y - B.max.y, B.min.z - A.max.z, A.min.z - B.max.z);
  };

  const worstNow = (PA, PB, sA, sB) => {
    const aToB = new THREE.Matrix4().copy(PB.mesh.matrixWorld).invert().multiply(PA.mesh.matrixWorld);
    const bToA = new THREE.Matrix4().copy(PA.mesh.matrixWorld).invert().multiply(PB.mesh.matrixWorld);
    let deep = 0, n = 0;
    const v = new THREE.Vector3();
    for (const q of sA) { v.copy(q).applyMatrix4(aToB); const d = depthIn(PB, v); if (d > 0) { n++; if (d > deep) deep = d; } }
    for (const q of sB) { v.copy(q).applyMatrix4(bToA); const d = depthIn(PA, v); if (d > 0) { n++; if (d > deep) deep = d; } }
    return { deep, n };
  };

  // Sweep the MECHANISM: `pose(f)` drives the sim, the tick laws place both
  // members, and the outlines are measured where the movement actually puts
  // them. `inject` mis-phases one member by that fraction of its own pitch,
  // held across the whole sweep — the control's deliberate defect. It turns a
  // BLANK, never a spin group, so the tick cannot write it back (the going
  // train's own structure).
  const sweep = (label, aName, bName, pose, { steps = 16, inject = 0, injectInto = null } = {}) => {
    const A = rotorByName(aName), B = rotorByName(bName);
    if (!A || !B) { log.push(`  ${label}\n      NO ROTOR ${!A ? aName : bName}`); return null; }
    const ba = bodyOf(A), bb = bodyOf(B);
    const PA = prismOf(ba), PB = prismOf(bb);
    if (PA.bad || PB.bad) { log.push(`  ${label}\n      REFUSED — ${PA.bad ? `${aName}: ${PA.bad}` : `${bName}: ${PB.bad}`}`); return null; }
    const sA = samplesOf(PA), sB = samplesOf(PB);
    const T = injectInto ? rotorByName(injectInto) : A;
    const pitch = (Math.PI * 2) / (T.userData.teeth || 1);
    const z0 = T.rotation.z;
    // RESTORE BEFORE POSING, or the injection ACCUMULATES. `+=` is only right
    // for a member the tick rewrites every pose (crownWheel, settingWheel do;
    // main.js:37536, 37851). A BLANK does not — the going train writes the
    // ARBOR and the blank's index persists — so on thirdWheel the old `+=`
    // walked 0.5, 1.0, 1.5 … 8.0 pitches across the sweep's 16 steps. It
    // passed anyway, and only because a gear is periodic in one pitch: half
    // and whole alternate, so the deepest still landed on the half-pitch
    // configuration the control wanted. An accident of choosing 0.5, and it
    // would silently smear phases together for any other fraction — which is
    // precisely what the phase-floor tier below needs to get right.
    let worst = { deep: -1, n: 0 }, at = 0, moved = 0, prev = null, closest = Infinity;
    for (let i = 0; i < steps; i++) {
      const f = i / (steps - 1);
      I.enterAxis(C);
      T.rotation.z = z0;                       // undo the previous step's injection
      pose(f);                                 // the tick may overwrite it (fine) or not (z0 stands)
      if (inject) T.rotation.z += inject * pitch;
      C.scene.updateMatrixWorld(true);
      // GUARD: a sweep that poses nothing measures one pose N times. The
      // motion is read FRAME-FREE, as the angle between successive
      // orientations — an azimuth about world z was the first version and it
      // called the stem parts still, because they spin about Y. A guard that
      // only works on one axis is no guard on a crossed-axis probe.
      const q = new THREE.Quaternion();
      A.matrixWorld.decompose(new THREE.Vector3(), q, new THREE.Vector3());
      if (prev !== null) moved += 2 * Math.acos(Math.min(1, Math.abs(q.dot(prev))));
      prev = q.clone();
      const w = worstNow(PA, PB, sA, sB);
      if (w.deep > worst.deep) { worst = w; at = f; }
      const sep = boxSep(ba, bb);
      if (sep < closest) closest = sep;
    }
    T.rotation.z = z0;
    C.resetInputs();
    C.scene.updateMatrixWorld(true);
    const toothH = 2.25 * (A.userData.module || 0.34);
    log.push(`  ${label}`);
    const solidOf = (P, n) => `${n} r ${P.rPoly.toFixed(3)} z ${P.zLo.toFixed(2)}..${P.zHi.toFixed(2)}`
      + (P.shearZ ? ` sheared ${P.shearZ.toFixed(2)}` : '') + (P.declared ? '' : ' (ASSUMED)') + ` fit ${P.fit.toFixed(3)}`;
    log.push(`      outlines ${sA.length} + ${sB.length} pts   solids: ${solidOf(PA, aName)} | ${solidOf(PB, bName)}   driver swept ${moved.toFixed(3)} rad${moved < 1e-6 ? '  <-- STOOD STILL, nothing was measured' : ''}`);
    log.push(`      DEEPEST  ${worst.deep.toFixed(4)}   = ${(worst.deep / toothH * 100).toFixed(0)}% of a ${toothH.toFixed(3)} tooth height   (${worst.n} pts buried, at f=${at.toFixed(2)})`);
    if (closest > 0)
      log.push(`      NOT A PAIR — the two boxes never intersect across this sweep (closest ${closest.toFixed(3)}). A zero here says they never meet, not that they mesh.`);
    return { deep: worst.deep, moved, closest };
  };

  const I = await import('./src/inspect.js');
  const G = await import('./src/geometry.js');

  // The inputs each pair is driven by — taken from the AXES entries that pose
  // them, never invented here.
  const runTrain = (f) => C.setPose({ tau: f * (C.hoursPerFuseeTurn ?? 120 / 7) * 3600, crownPullT: 0, leverEngage: 0, tension: 1 });
  const runWind = (f) => C.setPose({ tau: 0.13, crownPullT: 0, leverEngage: 0, tension: 1 - f });
  // SETTING drives TWO quantities from one crown turn, and they must be swept
  // together or the pose is one the watch never reaches: `setPathRot` is the
  // turn delivered to the setting wheel, and `windStemSlip` is the same turn
  // arriving at the stem (tick(): both take `crownRotDelta` while set-engaged).
  // Sweeping only the first left the clutch rim standing still — which is what
  // the motion guard reported once it could see a part that spins about Y.
  const runSet = (f) => {
    const turn = f * (C.setPathPerMinuteWheelRev || 0);
    C.setPose({ tau: 0.05, crownPullT: 1, leverEngage: 1, tension: 1, setPathRot: turn, windStemSlip: turn });
  };
  const runAlarm = (f) => C.setPose({ tau: 0.13, crownPullT: 0, leverEngage: 0, tension: 1, alarmCrownRotation: f * 2 * Math.PI, alarmOn: 1, alarmCrownPullT: 1 });

  log.push('CONTROLS — a solved, parallel, battery-green mesh, swept by its own input');
  const ctrlGood = sweep('must-miss  thirdWheel ⇄ fourthPinion, as built', 'thirdWheel', 'fourthPinion', runTrain);
  const ctrlBad = sweep('must-hit   the same pair, HALF A PITCH into the third wheel blank', 'thirdWheel', 'fourthPinion', runTrain,
    { inject: 0.5, injectInto: 'thirdWheel' });

  // ---- TIER TWO — IS THERE ANY PHASE AT WHICH THESE CUTS MESH? -------------
  //
  // TODO 136 filed the burial and proposed a fix: "the phase has to be solved
  // on the contact geometry a bevel actually has — the pitch cones and their
  // shared apex". Reading the builders says that cannot be right for these two
  // pairs, because THEY HAVE NO CONES. crownWheel is G.makeGear, windingPinion
  // is G.makePinion, settingWheel and clutchRim are both G.makeGear — flat SPUR
  // cuts, mounted with one turned 90° (`rotation.x = Math.PI / 2`). The pair
  // that reads 0.0000, alarmSetIdler2 ⇄ alarmStemBevel, is the only real bevel
  // pair of the three: both members G.makeBevelGear at a 45° cone.
  //
  // So the question this tier settles is not "what is the right phase" but
  // whether a right phase EXISTS. Each pair has exactly one index knob — the
  // half-pitch seed its blank was built with (`crownWheelBase`,
  // `settingWheelBase`, `ALARM_BEVEL_PHASE`), the same freedom TODO 132 used on
  // the transfer wheel: two blanks on one arbor are indexed at whatever angle
  // the assembly calls for. Sweep that knob through a WHOLE pitch, drive the
  // mechanism at each setting, and take the deepest burial. The minimum over
  // the knob is the FLOOR: the best any indexing can do.
  //
  // A floor of zero means the fix is a phase solve. A floor well above zero
  // means no indexing saves it and the metal is the wrong KIND — which would
  // make the item's stated fix impossible rather than merely unbuilt.
  //
  // THE CONTROL IS THE LOAD-BEARING PART, per the skill: a floor above zero
  // proves nothing unless the same sweep can FIND a zero where one exists. So
  // the known-good parallel pair is run through the identical tier. Its floor
  // must reach ~0 (it is phase-solved, so some knob setting is correct) AND its
  // ceiling must reach the half-pitch burial (~0.17), which together show the
  // tier resolves a real minimum and a real maximum rather than reporting one
  // number 24 times.
  const phaseFloor = (label, aName, bName, pose, knobName, { phases = 24, steps = 10 } = {}) => {
    const A = rotorByName(aName), B = rotorByName(bName), T = rotorByName(knobName);
    if (!A || !B || !T) { log.push(`  ${label}\n      NO ROTOR ${!A ? aName : !B ? bName : knobName}`); return null; }
    const PA = prismOf(bodyOf(A)), PB = prismOf(bodyOf(B));
    if (PA.bad || PB.bad) { log.push(`  ${label}\n      REFUSED — ${PA.bad || PB.bad}`); return null; }
    const sA = samplesOf(PA), sB = samplesOf(PB);   // hoisted: the outlines do not change with phase
    const pitch = (Math.PI * 2) / (T.userData.teeth || 1);
    const z0 = T.rotation.z;
    const rows = [];
    let moved = 0, prev = null, closest = Infinity;
    for (let p = 0; p < phases; p++) {
      const frac = p / phases;
      let deep = 0;
      for (let i = 0; i < steps; i++) {
        const f = steps === 1 ? 0 : i / (steps - 1);
        I.enterAxis(C);
        T.rotation.z = z0;                     // see the note in sweep(): never `+=` twice
        pose(f);
        T.rotation.z += frac * pitch;
        C.scene.updateMatrixWorld(true);
        const q = new THREE.Quaternion();
        A.matrixWorld.decompose(new THREE.Vector3(), q, new THREE.Vector3());
        if (prev !== null) moved += 2 * Math.acos(Math.min(1, Math.abs(q.dot(prev))));
        prev = q.clone();
        const w = worstNow(PA, PB, sA, sB);
        if (w.deep > deep) deep = w.deep;
        const sep = boxSep(bodyOf(A), bodyOf(B));
        if (sep < closest) closest = sep;
      }
      rows.push({ frac, deep });
    }
    T.rotation.z = z0;
    C.resetInputs();
    C.scene.updateMatrixWorld(true);
    const floor = rows.reduce((m, r) => Math.min(m, r.deep), Infinity);
    const ceil = rows.reduce((m, r) => Math.max(m, r.deep), 0);
    const best = rows.find((r) => r.deep === floor);
    const toothH = 2.25 * (A.userData.module || 0.34);
    log.push(`  ${label}`);
    log.push(`      knob ${knobName}: ${T.userData.teeth} t, one pitch ${(pitch * 180 / Math.PI).toFixed(1)}°, swept in ${phases} steps${moved < 1e-6 ? '   <-- THE PAIR STOOD STILL, nothing was measured' : ''}`);
    // The WHOLE table, not the winner — a search whose losers are invisible is
    // a claim nobody can re-check.
    log.push(`      burial by phase: ` + rows.map((r) => (r.deep < 0.005 ? '   ·' : r.deep.toFixed(2).padStart(4))).join(''));
    log.push(`      FLOOR ${floor.toFixed(4)} at phase ${best.frac.toFixed(3)} of a pitch   ceiling ${ceil.toFixed(4)}   `
      + `(tooth ${toothH.toFixed(3)} — the floor is ${(floor / toothH * 100).toFixed(0)}% of one)`);
    if (closest > 0)
      log.push(`      NOT A PAIR — boxes never intersect at any phase (closest ${closest.toFixed(3)}); this row's zeros are vacuous.`);
    return { floor, ceil, rows, moved, closest };
  };

  log.push('\nSUBJECTS — the crossed-axis meshes, which no registry check can reach');
  const res = [];
  for (const [label, a, b, pose] of [
    ['crownWheel ⇄ windingPinion   (WINDING: the bank swept)', 'crownWheel', 'windingPinion', runWind],
    ['clutchRim ⇄ settingWheel     (SETTING: crown out, setting path swept)', 'clutchRim', 'settingWheel', runSet],
    ['alarmDiscBevel ⇄ alarmStemBevel  (ALARM: the corner\'s real bevel pair, alarm crown swept)', 'alarmDiscBevel', 'alarmStemBevel', runAlarm],
  ]) res.push([label, sweep(label, a, b, pose)]);

  // ---- TIER THREE — RETIRED, and where it went ------------------------------
  // This probe once built a conjugate pair in FREE SPACE here, at the station
  // the counts demand, and asked whether the form read zero before any layout
  // move was spent on it. It answered: floor 0.0000 AND ceiling 0.0000, at
  // every index, both senses, all three mountings — which is NOT A MESH, and
  // became TODO 138.
  //
  // That question now belongs to tools/probe-138-bevel-roll.mjs, which answers
  // it better: analytically rather than by point sampling, in pure Node with no
  // browser, at the derived phase and ratio rather than a swept index, with
  // seven controls including the one this tier lacked — a pair that never
  // touches passes any penetration column. Two answers to one question is the
  // defect this repo keeps finding, so there is one.
  //
  // What stays here is what only a browser can ask: do the pairs IN THE
  // MOVEMENT interleave, at the poses the tick laws actually put them in.

  log.push('\nTIER TWO — the phase floor: the best any indexing of the one available knob can do');
  const floors = {};
  floors.control = phaseFloor('CONTROL  thirdWheel ⇄ fourthPinion — parallel, phase-solved, battery-green',
    'thirdWheel', 'fourthPinion', runTrain, 'thirdWheel');
  floors.wind = phaseFloor('crownWheel ⇄ windingPinion   (spur ⇄ spur, axes crossed at the stem)',
    'crownWheel', 'windingPinion', runWind, 'crownWheel');
  floors.set = phaseFloor('clutchRim ⇄ settingWheel     (spur ⇄ spur, axes crossed at the stem)',
    'clutchRim', 'settingWheel', runSet, 'settingWheel');
  floors.alarm = phaseFloor('alarmDiscBevel ⇄ alarmStemBevel  (a real bevel pair, for contrast)',
    'alarmDiscBevel', 'alarmStemBevel', runAlarm, 'alarmStemBevel');

  return { log: log.join('\n'), ctrlGood, ctrlBad, res, floors };
});
await browser.close(); srv.kill();

console.log(out.log);
console.log('\n--- controls');
const missOk = out.ctrlGood !== null && out.ctrlGood.deep < 0.05 && out.ctrlGood.moved > 1e-6;
const hitOk = out.ctrlBad !== null && out.ctrlBad.deep > 0.15;
console.log(`  must-miss (as built, should be clear): ${out.ctrlGood === null ? 'NOT MEASURED' : out.ctrlGood.deep.toFixed(4)}  ${missOk ? 'OK' : 'CONTROL FAILED'}`);
console.log(`  must-hit  (half pitch, should be deep): ${out.ctrlBad === null ? 'NOT MEASURED' : out.ctrlBad.deep.toFixed(4)}  ${hitOk ? 'OK' : 'CONTROL FAILED'}`);
if (!(missOk && hitOk)) console.log('\n  CONTROLS DID NOT BRACKET THE MEASURE — the subject readings above mean nothing.');

// ---- tier two's verdict ------------------------------------------------------
const F = out.floors || {};
if (F.control) {
  const ctrlFloorOk = F.control.floor < 0.05;          // a solved pair HAS a good phase
  const ctrlCeilOk = F.control.ceil > 0.15;            // and a bad one, so the sweep resolves both
  const ctrlMovedOk = F.control.moved > 1e-6;
  console.log('\n--- tier two: can any phase save these pairs?');
  console.log(`  CONTROL thirdWheel ⇄ fourthPinion: floor ${F.control.floor.toFixed(4)} (want < 0.05), `
    + `ceiling ${F.control.ceil.toFixed(4)} (want > 0.15)  ${ctrlFloorOk && ctrlCeilOk && ctrlMovedOk ? 'OK' : 'CONTROL FAILED'}`);
  for (const [k, name] of [['wind', 'crownWheel ⇄ windingPinion'], ['set', 'clutchRim ⇄ settingWheel'], ['alarm', 'alarmDiscBevel ⇄ alarmStemBevel']]) {
    if (!F[k]) continue;
    console.log(`  ${name.padEnd(34)} floor ${F[k].floor.toFixed(4)}   ceiling ${F[k].ceil.toFixed(4)}`);
  }
  if (!(ctrlFloorOk && ctrlCeilOk && ctrlMovedOk)) {
    console.log('  THE TIER CANNOT FIND A ZERO WHERE ONE EXISTS — its floors below mean nothing.');
  } else {
    const verdict = (f) => (f === null ? 'not measured' : f.floor < 0.05
      ? 'a phase EXISTS — an indexing fix is possible'
      : 'NO phase clears it — indexing cannot fix this pair');
    console.log(`\n  crownWheel ⇄ windingPinion: ${verdict(F.wind)}`);
    console.log(`  clutchRim ⇄ settingWheel:   ${verdict(F.set)}`);
  }
}
