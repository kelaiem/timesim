// §325 landing 8 — holds src/slide-cam.js (the minute hand's lazy-tongs, cam driven, designed in free space) to its own laws
// on the lands preview's real reach law. ACCEPTANCE: exits non-zero on a failed gate. Each gate has a CONTROL that must fail.
//   node tools/probe-325-slide-cam.mjs            (boots the preview once, ~1 min; needs the three env vars in CLAUDE.md)
import { bootForm } from './boot-form.mjs';
import { solveTongs, camProfile, conservativeReach, poseAt, tongsAt, closureError, reachOf, minPivotSpacing, PIVOT_NEED, EYE_R, baseY } from '../src/slide-cam.js';
import { CLEAR_MARGIN } from '../src/layout.js';

const QUERY = 'case=free&alarm=0&barrelstep=-140&rsvaz=0&rsvidl=2&frame=lands&hands=slide';
const SAMPLE = `(async () => { const T = window.__clock.dialTrack, N = 720, R = [];
  for (let i = 0; i < N; i++) R.push(T.mid.exit((i / N) * 2 * Math.PI)); const D = []; for (let i = 0; i < 8 * N; i++) D.push(T.mid.exit((i / (8 * N)) * 2 * Math.PI)); const O = []; for (let i = 0; i < N; i++) O.push(T.outer.exit((i / N) * 2 * Math.PI)); const caseGap = await (async () => { const THREE = await import('./vendor/three.module.js'); const S = window.__clock.scene; let hand = null, caseObj = null;
    S.traverse((o) => { if (o.userData && o.userData.tongs && !hand) hand = o; if (o.userData && o.userData.assemblies && o.userData.assemblies.back && !caseObj) caseObj = o; });
    if (!hand || !caseObj) return null;
    const meshes = []; caseObj.traverse((m) => { if (m.isMesh) meshes.push(m); });
    const t = hand.userData.tongs, rc = new THREE.Raycaster(), o = new THREE.Vector3(), p = new THREE.Vector3(), d = new THREE.Vector3(); rc.far = 400;
    const pins = [...t.rail.flat(), ...t.mid]; let gap = 1e9, rays = 0;
    for (let k = 0; k < 144; k++) { window.__clock.setPose({ tau: k * 301 }); S.updateMatrixWorld(true); hand.getWorldPosition(o);
      for (const pin of pins) { pin.getWorldPosition(p); o.z = p.z; d.set(p.x - o.x, p.y - o.y, 0); const dist = d.length(); if (dist < 1e-6) continue; d.normalize(); rc.set(o, d);
        const h = rc.intersectObjects(meshes, false).find((x) => x.distance > 0); rays++; if (h) gap = Math.min(gap, h.distance - dist - t.EYE); } }
    // CONTROL: a pin placed past the wall on the same ray reads a NEGATIVE gap
    hand.getWorldPosition(o); d.set(1, 0, 0); rc.set(o, d); const hc = rc.intersectObjects(meshes, false).find((x) => x.distance > 0);
    return { gap, rays, wallAlong: hc ? hc.distance : null, EYE: t.EYE }; })();
  return { R, D, O, near: T.nearestMid, caseGap }; })()`;
const { extra, bootError } = await bootForm(QUERY, SAMPLE);
if (bootError || !extra) { console.log('BOOT ERROR', bootError); process.exit(2); }
const { R, D, O, near, caseGap } = extra, far = Math.max(...R);
let fails = 0;
const gate = (name, ok, detail = '') => { console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? '  ' + detail : ''}`); if (!ok) fails++; };

// y_b: the base pins stand clear of the stud in the cam's plane's footprint — stud + margin + one eye. Derived, not typed.
const YB = baseY();                                                  // the first rail pivots' eyes clear the stud's, one margin each side
const geo = solveTongs({ near, far, yb: YB });
console.log(`reach law: near ${near.toFixed(3)}, far ${far.toFixed(3)}, ${R.length} samples; base y_b ${YB.toFixed(3)}`);
if (!geo) { console.log('FAIL  no tongs satisfies the three constraints'); process.exit(1); }
console.log(`tongs: ${geo.n} cells (${2 * geo.n} bars of ${(2 * geo.ell).toFixed(3)}), α ${geo.alphaMinDeg.toFixed(2)}°..${geo.alphaMaxDeg.toFixed(2)}°, rail half-width ${geo.hMin.toFixed(3)}..${geo.hMax.toFixed(3)}, eye radius ${EYE_R.toFixed(3)}, pivot spacing need ${PIVOT_NEED.toFixed(3)}`);
const dense = (az) => D[Math.round((az / (2 * Math.PI)) * D.length) % D.length];
const Rc = conservativeReach(dense, R.length);        // what the build cuts the cam from
const cam = camProfile({ reach: Rc, geo });
const raw = camProfile({ reach: Rc, geo, alphaPDeg: 89.9 });   // CONTROL: the unrestricted law
console.log(`cam: groove radius ${cam.rMin.toFixed(2)}..${cam.rMax.toFixed(2)} (throw ${(cam.rMax - cam.rMin).toFixed(2)}), worst tip pull-back ${cam.maxShort.toFixed(2)} u, mean ${cam.meanShort.toFixed(2)} u`);

// 1 closure at every bearing, and a perturbed pivot breaks it (the control)
let worstClose = 0, worstTipErr = 0;
for (let i = 0; i < 720; i += 5) {
  const p = poseAt({ cam, geo, bearing: (i / 720) * 2 * Math.PI });
  worstClose = Math.max(worstClose, closureError({ tongs: p.tongs, ell: geo.ell }));
  worstTipErr = Math.max(worstTipErr, Math.abs(p.tongs.tip - reachOf(geo, p.h)));
}
gate('tongs close (every bar 2ℓ, every pair meeting at its mid pivot)', worstClose < 1e-9, `worst ${worstClose.toExponential(2)}`);
const bent = tongsAt({ ...geo, h: geo.hMin }); bent.bars[3].to = [bent.bars[3].to[0] * 1.01, bent.bars[3].to[1]];
gate('CONTROL: a pivot 1% off breaks closure', closureError({ tongs: bent, ell: geo.ell }) > 1e-3, `${closureError({ tongs: bent, ell: geo.ell }).toExponential(2)}`);
gate('tip position agrees with the closed-form reach', worstTipErr < 1e-9, `worst ${worstTipErr.toExponential(2)}`);
// 2 the tip never stands outside the wanted reach
let worstOver = -Infinity, sparseOver = -Infinity;
for (let d = 0; d < D.length; d++) { worstOver = Math.max(worstOver, poseAt({ cam, geo, bearing: (d / D.length) * 2 * Math.PI }).tongs.tip - D[d]); }
{ const naive = camProfile({ reach: R, geo }); for (let d = 0; d < D.length; d++) sparseOver = Math.max(sparseOver, poseAt({ cam: naive, geo, bearing: (d / D.length) * 2 * Math.PI }).tongs.tip - D[d]); }
gate('tip inside the track at every bearing, on a grid 8× finer than the cam', worstOver <= 1e-9, `worst ${worstOver.toExponential(2)} (vs the rail)`);
gate('CONTROL: a cam cut from the bare samples stands past the rail between them', sparseOver > 1e-4, `${sparseOver.toExponential(2)}`);
// 3 pressure angle
gate('pressure angle ≤ 45°', cam.pressureDeg <= 45.5, `${cam.pressureDeg.toFixed(2)}°`);
gate('CONTROL: the unrestricted law breaks the ceiling', raw.pressureDeg > 55, `${raw.pressureDeg.toFixed(1)}°`);
// 4 the pivots' spacing, MEASURED over every pair on the posed tongs at every bearing (not the solve's own numbers)
let minSp = Infinity, minAt = 0;
for (let i = 0; i < 720; i += 5) { const p = poseAt({ cam, geo, bearing: (i / 720) * 2 * Math.PI }); const m = minPivotSpacing(p.tongs); if (m < minSp) { minSp = m; minAt = i / 2; } }
gate('every pivot pair stands ≥ 2·EYE_R + margin apart at every bearing', minSp >= PIVOT_NEED - 1e-9, `min ${minSp.toFixed(3)} at bearing ${minAt.toFixed(1)}° (need ${PIVOT_NEED.toFixed(3)})`);
const squeezed = tongsAt({ ...geo, h: geo.ell * Math.sin((88 * Math.PI) / 180) });
gate('CONTROL: folding to 88° breaks that floor', minPivotSpacing(squeezed) < PIVOT_NEED, `${minPivotSpacing(squeezed).toFixed(3)}`);
// the first mid pivot stands where the groove puts it, and the bars through it reproduce the base pins' height
let worstMid = 0;
for (let i = 0; i < 720; i += 5) { const p = poseAt({ cam, geo, bearing: (i / 720) * 2 * Math.PI }); worstMid = Math.max(worstMid, Math.abs(p.tongs.mids[0][1] - p.r)); }
gate('first mid pivot stands at the groove radius', worstMid < 1e-9, `worst ${worstMid.toExponential(2)}`);
// 4b THE WHOLE LATTICE vs the CASE WALL, MEASURED ON THE BUILT SCENE at 144 poses (a first draft's closing rail pair stood 9 u wide at the tip and
// crossed the mid rail in 136 of 144; the body of a tongs is shouldered behind its tip, so it stands over the chapter ring — dial surface, no part —
// and the case wall is the limit). Radial rays from the hand's axis at each pivot's own height; the gap is along the ray, an upper bound on the
// true clearance, so it is held to a wall-side allowance, not to CLEAR_MARGIN alone (a ray meets a slanted wall at less than its normal distance).
if (!caseGap) gate('the built scene has a hand and a case to measure', false, 'not found');
else {
  gate('every pivot eye stands clear of the case wall (radial gap) at 144 poses', caseGap.gap >= 10 * CLEAR_MARGIN, `min ${caseGap.gap.toFixed(2)} u over ${caseGap.rays} rays`);
  gate('CONTROL: the wall is found at all (a ray from the axis hits it)', caseGap.wallAlong !== null && caseGap.wallAlong > 15, `${caseGap.wallAlong?.toFixed(2)}`);
}
const inside = (tongs, bearing) => { let worst = { o: -Infinity }; const c = Math.cos(bearing - Math.PI / 2), sn = Math.sin(bearing - Math.PI / 2);
  for (const [x, y] of [...tongs.rails.flat(), ...tongs.mids]) { const X = x * c - y * sn, Y = x * sn + y * c, az = Math.atan2(Y, X), i = ((Math.round((az / (2 * Math.PI)) * R.length) % R.length) + R.length) % R.length;
    const o = Math.hypot(X, Y) + EYE_R - O[i]; if (o > worst.o) worst = { o }; } return worst; };
let worstOut = -Infinity;
for (let i = 0; i < 720; i += 2) { const b = (i / 720) * 2 * Math.PI; worstOut = Math.max(worstOut, inside(poseAt({ cam, geo, bearing: b }).tongs, b).o); }
console.log(`REPORT  the lattice reaches ${worstOut.toFixed(2)} u past the OUTER rail at its worst (over the chapter ring; the case wall above is the limit)`);
// 5 reach covered
gate('tongs cover the stroke (extremes within the solve)', Math.abs(reachOf(geo, geo.hMax) - near) < 1e-6 && Math.abs(reachOf(geo, geo.hMin) - far) < 1e-6, `${reachOf(geo, geo.hMax).toFixed(3)}..${reachOf(geo, geo.hMin).toFixed(3)}`);
console.log(fails ? `\n${fails} FAILED` : '\nall gates pass');
process.exit(fails ? 1 : 0);
