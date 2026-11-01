// §325 landing 8b — does an HOUR-hand lazy-tongs exist in free space, driven by rails applied to the dial? (src/slide-cam.js, hour half)
// ACCEPTANCE: exits non-zero when no design satisfies the constraints. Every gate has a control that must fail.
//   node tools/probe-325-hour-cam.mjs            (boots the lands preview once, ~1 min; needs the three env vars in CLAUDE.md)
// The minute hand's fixed cam stands on a stud above everything; the hour layer has no fixed member (the nose and hour tube turn between
// the stud and any cam), so the hour hand's fixed part is a pair of rails APPLIED TO THE DIAL, ridden by the first mid pivot's pin, which comes
// down through a slot in the arm. This probe holds the design to the stack it must live in, read off the built scene.
import { bootForm } from './boot-form.mjs';
import { solveTongs, solveHourFloor, hourBaseY, flooredReach, camProfile, conservativeReach, poseAt, tongsAt, closureError,
  minPivotSpacing, PIVOT_NEED, EYE_R, PIN_R, PLATE_PAD } from '../src/slide-cam.js';
import { CLEAR_MARGIN, STOCK_MIN_U, PIVOT_BORE_CLEAR } from '../src/layout.js';

const QUERY = 'case=free&alarm=0&barrelstep=-140&rsvaz=0&rsvidl=2&frame=lands&hands=slide';
const SAMPLE = `(async () => { const THREE = await import('./vendor/three.module.js'); const c = window.__clock, S = c.scene, T = c.dialTrack, N = 720, M = 8 * N;
  const D = []; for (let i = 0; i < M; i++) D.push(T.mid.exit((i / M) * 2 * Math.PI));
  let hour = null, minute = null; S.traverse((o) => { if (o.userData && o.userData.slide && !hour) hour = o; if (o.userData && o.userData.tongs && !minute) minute = o; });
  c.setPose({ tau: 0 }); S.updateMatrixWorld(true);
  const o = new THREE.Vector3(); hour.getWorldPosition(o); const hb = new THREE.Box3().setFromObject(hour);
  const meshes = []; S.traverse((m) => { if (m.isMesh && m.visible) { let q = m, skip = false; while (q) { if (q === hour || q === minute || /slideCam|slideStud/.test(q.name || '')) { skip = true; break; } q = q.parent; } if (!skip) meshes.push(m); } });
  const rc = new THREE.Raycaster(), dir = new THREE.Vector3(0, 0, 1); rc.far = 8;
  const down = (r, a) => { rc.set(new THREE.Vector3(o.x + r * Math.cos(a), o.y + r * Math.sin(a), hb.max.z - 0.01), dir); const h = rc.intersectObjects(meshes, false)[0]; return h ? h.distance : null; };
  // the dial's bore: the smallest radius at which every one of 16 rays lands on the dial face (not through to the works behind)
  let bore = null; for (let r = 2.9; r < 5; r += 0.05) { let all = true, d0 = null; for (let k = 0; k < 16; k++) { const d = down(r, (k / 16) * 2 * Math.PI); if (d === null || d > 3) { all = false; break; } d0 = d0 === null ? d : Math.min(d0, d); } if (all) { bore = r; break; } }
  let face = 1e9; for (const r of [bore + 0.5, bore + 1, bore + 2]) for (let k = 0; k < 16; k++) { const d = down(r, (k / 16) * 2 * Math.PI); if (d !== null) face = Math.min(face, d); }
  // the arm's half-width by distance along it (hour body + tip meshes, vertices at |x|)
  const prof = []; hour.updateMatrixWorld(true); const v = new THREE.Vector3();
  const inv = new THREE.Matrix4().copy(hour.matrixWorld).invert();
  for (let y = 0; y <= Math.ceil(hour.userData.length); y += 0.25) prof.push([y, 0]);
  hour.traverse((m) => { if (!m.isMesh || !/Body|Tip|Rear/.test(m.name)) return; const a = m.geometry.attributes.position;
    for (let i = 0; i < a.count; i++) { v.fromBufferAttribute(a, i).applyMatrix4(m.matrixWorld).applyMatrix4(inv); const k = Math.round(v.y / 0.25); if (prof[k]) prof[k][1] = Math.max(prof[k][1], Math.abs(v.x)); } });
  return { D, near: T.nearestMid, bore, faceGap: face, noseR: minute.userData.pipe.boreR, pipe: hour.userData.pipe, length: hour.userData.length, prof }; })()`;
const { extra, bootError } = await bootForm(QUERY, SAMPLE);
if (bootError || !extra) { console.log('BOOT ERROR', bootError); process.exit(2); }
const { D, near, bore, faceGap, noseR, pipe, length, prof } = extra, TIP = 0.6, N = 720;
const far = Math.max(...D), frac = length / near;
let fails = 0;
const gate = (name, ok, detail = '') => { console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? '  ' + detail : ''}`); if (!ok) fails++; };
const dense = (az) => D[Math.round((az / (2 * Math.PI)) * D.length) % D.length];
const raw = (az) => frac * dense(az);
console.log(`stack read off the build: nose ${noseR.toFixed(3)}, hour pipe ${pipe.outerR.toFixed(3)}, dial bore ${bore?.toFixed(2)}, dial face ${faceGap?.toFixed(3)} under the hand's back face, arm ${length.toFixed(2)} long`);
console.log(`hour law: ${frac.toFixed(4)} x the mid rail, ${(frac * near).toFixed(2)}..${(frac * far).toFixed(2)}; minute reach ${near.toFixed(2)}..${far.toFixed(2)}`);

const YB = hourBaseY(noseR);
const GH = PIN_R + PIVOT_BORE_CLEAR, WALL = STOCK_MIN_U;                                  // groove half-width and a rail's thickness (the minute cam's)
const RAIL_H = 2 * STOCK_MIN_U;                                                           // a rail stands 2T: the pin has T of engagement below the arm
const midMin = bore + CLEAR_MARGIN + GH + WALL;                                           // the groove's inner rail stands outside the bore by a margin

// 0 the unfloored law has no tongs (why a floor exists), and the floor is the smallest that solves
const noFloor = solveTongs({ near: frac * near - TIP, far: frac * far - TIP, yb: YB, midMin });
gate('CONTROL: the proportional law, unfloored, has no tongs', noFloor === null);
const sol = solveHourFloor({ raw, yb: YB, tipExt: TIP, midMin, limit: near });
if (!sol) { console.log('FAIL  no floor at or under the track\'s nearest rail gives a tongs with its pin outside the bore'); console.log('\\n1+ FAILED'); process.exit(1); }
const { floor, geo } = sol;
gate('a floor under the nearest rail solves', floor <= near, `floor ${floor.toFixed(2)} (nearest rail ${near.toFixed(2)})`);
gate('CONTROL: 0.1 under that floor does not solve', solveTongs({ near: floor - 0.1 - TIP, far: frac * far - TIP, yb: YB, midMin }) === null);
console.log(`tongs: ${geo.n} cells (bars ${(2 * geo.ell).toFixed(3)}), alpha ${geo.alphaMinDeg.toFixed(1)}..${geo.alphaMaxDeg.toFixed(1)}, rail half-width ${geo.hMin.toFixed(2)}..${geo.hMax.toFixed(2)}, base y ${YB.toFixed(3)}`);

// 1 the hour hand stays shorter than the minute hand at every bearing, and inside the track
const law = flooredReach(raw, floor);
let worstOver = -Infinity, worstShort = Infinity;
for (let i = 0; i < D.length; i++) { const az = (i / D.length) * 2 * Math.PI; worstOver = Math.max(worstOver, law(az) - D[i]); worstShort = Math.min(worstShort, D[i] - law(az)); }
gate('the hour tip stands inside the track at every bearing', worstOver <= 1e-9, `worst ${worstOver.toExponential(2)}`);
gate('the hour tip is shorter than the minute tip by at least the tip extension everywhere', worstShort >= TIP - 1e-9, `min gap ${worstShort.toFixed(2)}`);

// 2 the cam, cut from the conservative samples
const reach = conservativeReach((az) => law(az) - TIP, N);
const cam = camProfile({ reach, geo });
console.log(`groove radius ${cam.rMin.toFixed(2)}..${cam.rMax.toFixed(2)} (throw ${(cam.rMax - cam.rMin).toFixed(2)}), worst tip pull-back ${cam.maxShort.toFixed(2)}, mean ${cam.meanShort.toFixed(2)}`);
let worstClose = 0, worstTip = -Infinity, minSp = Infinity, worstMid = 0;
for (let d = 0; d < D.length; d++) {
  const b = (d / D.length) * 2 * Math.PI, p = poseAt({ cam, geo, bearing: b });
  worstTip = Math.max(worstTip, p.tongs.tip - (law(b) - TIP));
  if (d % 8 === 0) { worstClose = Math.max(worstClose, closureError({ tongs: p.tongs, ell: geo.ell })); minSp = Math.min(minSp, minPivotSpacing(p.tongs)); worstMid = Math.max(worstMid, Math.abs(p.tongs.mids[0][1] - p.r)); }
}
gate('tongs close', worstClose < 1e-9, worstClose.toExponential(2));
gate('tip inside the law at every bearing, on a grid 8x finer than the cam', worstTip <= 1e-9, worstTip.toExponential(2));
const naive = camProfile({ reach: Array.from({ length: N }, (_, i) => law((i / N) * 2 * Math.PI) - TIP), geo });
let sparse = -Infinity; for (let d = 0; d < D.length; d++) sparse = Math.max(sparse, poseAt({ cam: naive, geo, bearing: (d / D.length) * 2 * Math.PI }).tongs.tip - (law((d / D.length) * 2 * Math.PI) - TIP));
gate('CONTROL: a cam cut from the bare samples stands past the law between them', sparse > 1e-4, sparse.toExponential(2));
gate('pressure angle <= 45 degrees', cam.pressureDeg <= 45.5, cam.pressureDeg.toFixed(2) + ' deg');
gate('every pivot pair stands >= 2*EYE_R + margin apart in every pose', minSp >= PIVOT_NEED - 1e-9, `min ${minSp.toFixed(3)} (need ${PIVOT_NEED.toFixed(3)})`);
gate('CONTROL: folding to 88 degrees breaks that floor', minPivotSpacing(tongsAt({ ...geo, h: geo.ell * Math.sin((88 * Math.PI) / 180) })) < PIVOT_NEED);
gate('first mid pivot stands at the groove radius', worstMid < 1e-9, worstMid.toExponential(2));

// 3 THE STACK: the nose, the bore, the pipe, the arm, the vertical room
let minNose = Infinity;
for (let d = 0; d < D.length; d += 8) { const t = poseAt({ cam, geo, bearing: (d / D.length) * 2 * Math.PI }).tongs; for (const [x, y] of [...t.rails.flat(), ...t.mids]) minNose = Math.min(minNose, Math.hypot(x, y) - EYE_R); }
gate('every pivot eye clears the minute nose by a margin, in every pose', minNose >= noseR + CLEAR_MARGIN - 1e-9, `min ${minNose.toFixed(3)} vs ${(noseR + CLEAR_MARGIN).toFixed(3)}`);
gate('the base plate\'s near edge clears the nose by a margin', YB - EYE_R - PLATE_PAD >= noseR + CLEAR_MARGIN - 1e-9, `${(YB - EYE_R - PLATE_PAD).toFixed(3)}`);
gate('CONTROL: the minute hand\'s base height (stud-sized) would foul the nose', 1.77 - EYE_R - PLATE_PAD < noseR + CLEAR_MARGIN);
const rIn = cam.rMin - GH - WALL;
gate('the inner rail stands outside the dial\'s bore by a margin', rIn >= bore + CLEAR_MARGIN - 1e-9, `${rIn.toFixed(3)} vs bore ${bore.toFixed(2)} + margin`);
gate('the groove\'s pin stands outside the hour pipe by a margin (it comes down beside it)', cam.rMin - PIN_R >= pipe.outerR + CLEAR_MARGIN - 1e-9, `${(cam.rMin - PIN_R).toFixed(3)} vs ${(pipe.outerR + CLEAR_MARGIN).toFixed(3)}`);
const armUnder = faceGap + (pipe.eyeZLo - pipe.zLo);                                       // the arm's underside stands this far over the dial face
gate('the rails (2T) leave a margin under the arm', RAIL_H + CLEAR_MARGIN <= armUnder, `${RAIL_H.toFixed(3)} + ${CLEAR_MARGIN} <= ${armUnder.toFixed(3)}`);
gate('CONTROL: rails 3 units tall would not', 3 + CLEAR_MARGIN > armUnder);
// the slot in the arm: the pin travels groove radius rMin..rMax; where the arm exists, each side strip keeps the §50 floor
const slotHalf = PIN_R + PIVOT_BORE_CLEAR; let thin = Infinity, where = 0;
for (const [y, hw] of prof) if (hw > 0 && y >= cam.rMin - slotHalf - 0.25 && y <= cam.rMax + slotHalf + 0.25) { if (hw - slotHalf < thin) { thin = hw - slotHalf; where = y; } }
gate('the arm keeps the section floor either side of the pin slot', thin >= STOCK_MIN_U - 1e-9, `thinnest strip ${thin.toFixed(3)} at ${where.toFixed(2)} along the arm (need ${STOCK_MIN_U.toFixed(3)})`);
gate('CONTROL: a slot three times as wide would not', (() => { let t = Infinity; for (const [y, hw] of prof) if (hw > 0 && y >= cam.rMin - 1 && y <= cam.rMax + 1) t = Math.min(t, hw - 3 * slotHalf); return t < STOCK_MIN_U; })());
console.log(fails ? `\n${fails} FAILED` : '\nall gates pass');
process.exit(fails ? 1 : 0);
