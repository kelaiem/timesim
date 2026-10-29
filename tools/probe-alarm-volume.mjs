// THE VOLUME-ADJUSTABLE ALARM'S LINE SPEC (BUILT §320) — acceptance, pure Node, a second.
//
// src/alarm-volume.js designs the volume group IN A LINE: knob → star and snail cam → follower on a hammer
// carriage → the strike station along a straight gong bar, levels read through the build's own law
// (src/gong-level.js). This holds each row to the constraint it was derived from, and each rule has a
// control that must fail:
//   V1  the wire rings its f1 and its overtone node is the cantilever's (0.7834)
//   V2  the settings are equal steps in total level, no smaller than stepMin, and as many as the range holds
//   V3  the loudest station stands the head's whole face on the wire; the quietest is mode 2's node
//   V4  the run between them is monotonic; CONTROL: past the node the level rises again (why the stop is there)
//   V5  the cam, sampled as a profile: lands concentric, every rise under the pressure ceiling;
//       CONTROL: half a millimetre smaller base radius breaks the ceiling
//   V6  statics: the jumper's force inside SELECTOR_DETENT_WINDOW_MN and its torque over the follower's worst
//       back-drive by ALARM_SPRING_HEADROOM; CONTROL: a carriage 30× heavier wants a jumper outside the window
//   V7  the carriage's positional tolerance costs every station under half a step; CONTROL: 0.2 mm does not
//   V8  a fork of one input row re-derives the rest (a 1.5 kHz bar is longer and takes the same law)
import { solveVolume, volumeWire, levelAt, VOLUME_INPUTS } from '../src/alarm-volume.js';
import { SELECTOR_DETENT_WINDOW_MN, ALARM_SPRING_HEADROOM, UNIT_MM } from '../src/layout.js';

const fails = [];
const ok = (name, cond, detail = '') => { console.log(`${cond ? 'PASS' : 'FAIL'}  ${name}${detail ? ` — ${detail}` : ''}`); if (!cond) fails.push(name); };
const V = solveVolume(), S = V.stations, f = (v, n = 3) => v.toFixed(n);

ok('V1 the wire rings its f1, the overtone node is the cantilever\'s', Math.abs(V.wire.f_Hz[0] / VOLUME_INPUTS.f1_Hz.v - 1) < 1e-3 && Math.abs(V.wire.node - 0.7834) < 5e-4,
  `f ${V.wire.f_Hz.map((x) => x.toFixed(0)).join(' / ')} Hz, L ${f(V.wire.L_mm)} mm, node ${f(V.wire.node, 4)}`);

const steps = S.slice(1).map((s, i) => S[i].dB - s.dB);
ok('V2 equal steps in total level, no smaller than stepMin', steps.every((d) => Math.abs(d - V.step) < 1e-6) && V.step >= VOLUME_INPUTS.stepMin_dB.v,
  `${V.N} settings, step ${f(V.step)} dB over ${f(V.range)} dB`);
ok('V2 as many settings as the range holds (one more would step under stepMin)', V.range / V.N < VOLUME_INPUTS.stepMin_dB.v, `${V.N + 1} would step ${f(V.range / V.N)} dB`);

ok('V3 the loudest station stands the head\'s whole face on the wire', Math.abs(S[0].inset_mm - VOLUME_INPUTS.faceW_u.v * UNIT_MM / 2) < 1e-9,
  `inset ${f(S[0].inset_mm)} mm (half the face)`);
ok('V3 the quietest station is mode 2\'s node, where f2 vanishes', Math.abs(S.at(-1).x - V.wire.node) < 2e-3 && S.at(-1).f2_dB < -40,
  `x ${f(S.at(-1).x, 4)} against ${f(V.wire.node, 4)}, f2 ${f(S.at(-1).f2_dB, 1)} dB, f1 ${f(S.at(-1).f1_dB, 2)} dB`);

let mono = true; for (let i = 1; i <= 400; i++) { const a = V.xQuiet + (V.xLoud - V.xQuiet) * (i - 1) / 400, b = V.xQuiet + (V.xLoud - V.xQuiet) * i / 400; if (!(V.rel(b) > V.rel(a))) mono = false; }
ok('V4 the level rises monotonically from the quietest station to the loudest (400 samples)', mono);
const past = V.rel(V.wire.node - 0.2);
ok('V4 control: past the node the level rises again, so the carriage must stop at the node', past > V.bottom + 10, `${f(past, 2)} dB at 0.2 of the length inboard of the node, against ${f(V.bottom, 2)} at it`);

// the cam as a PROFILE: lands concentric, cycloidal rises, the pressure angle sampled (not the formula's peak)
const camProfile = (rBase, cam = V.cam) => { const P = cam.pitch_deg * Math.PI / 180, H = cam.land_deg * Math.PI / 360, B = P - 2 * H, travel = S.map((s) => s.inset_mm - S[0].inset_mm);
  const r = (th) => { const k = Math.min(V.N - 1, Math.floor((th + H) / P)), u = th - k * P;
    if (u <= H || k === V.N - 1) return rBase + travel[k];
    const t = Math.min(1, (u - H) / B), h = travel[k + 1] - travel[k]; return rBase + travel[k] + h * (t - Math.sin(2 * Math.PI * t) / (2 * Math.PI)); };
  let pMax = 0, landSlope = 0; const d = 1e-5;
  for (let th = 0; th <= (V.N - 1) * P; th += P / 2000) { const sl = (r(th + d) - r(th - d)) / (2 * d), u = ((th + H) % P) - H;
    if (Math.abs(u) < H - 2 * d) landSlope = Math.max(landSlope, Math.abs(sl)); pMax = Math.max(pMax, Math.atan(sl / r(th)) * 180 / Math.PI); }
  return { pMax, landSlope }; };
const cam = camProfile(V.cam.rBase_mm), camSmall = camProfile(V.cam.rBase_mm - 0.5);
ok('V5 the cam: lands concentric (a resting setting has no back-drive), every rise under the pressure ceiling',
  cam.landSlope < 1e-9 && cam.pMax <= VOLUME_INPUTS.pressureMax_deg.v + 1e-3,
  `base r ${f(V.cam.rBase_mm)} mm, pitch ${f(V.cam.pitch_deg, 1)}°, lands ${f(V.cam.land_deg, 1)}°, max pressure ${f(cam.pMax, 2)}°, land slope ${cam.landSlope.toExponential(1)}`);
ok('V5 control: half a millimetre smaller base radius breaks the pressure ceiling', camSmall.pMax > VOLUME_INPUTS.pressureMax_deg.v, `${f(camSmall.pMax, 2)}°`);

const D = V.detent;
ok('V6 the jumper\'s force inside the detent window, its torque over the follower\'s worst back-drive by the headroom',
  D.inWindow && D.margin >= ALARM_SPRING_HEADROOM, `F_j ${f(D.Fj_mN, 2)} mN in [${SELECTOR_DETENT_WINDOW_MN.join(', ')}], ${f(D.Tj_uNm, 2)} µN·m against ${f(D.Tback_uNm, 2)} µN·m (×${f(D.margin, 2)}), spring ${f(D.Fs_mN, 3)} mN`);
const heavy = solveVolume({ carriage_mg: 30 * VOLUME_INPUTS.carriage_mg.v });
ok('V6 control: a carriage 30× heavier wants a jumper outside the window', !heavy.detent.inWindow, `F_j ${f(heavy.detent.Fj_mN, 2)} mN`);

const worst = Math.max(...S.map((s) => s.tolErr_dB));
ok('V7 the carriage\'s positional tolerance costs every station under half a step', worst < V.step / 2, `worst ${f(worst)} dB at ±${VOLUME_INPUTS.posTol_mm.v} mm against ${f(V.step / 2)} dB`);
const loose = solveVolume({ posTol_mm: 0.2 });
ok('V7 control: a 0.2 mm tolerance does not', Math.max(...loose.stations.map((s) => s.tolErr_dB)) >= loose.step / 2, `worst ${f(Math.max(...loose.stations.map((s) => s.tolErr_dB)))} dB`);

const low = solveVolume({ f1_Hz: 1500 }), Wl = volumeWire({ f1_Hz: 1500 });
ok('V8 a fork of one input row re-derives the rest', Math.abs(low.wire.f_Hz[0] / 1500 - 1) < 1e-3 && low.wire.L_mm > V.wire.L_mm && Math.abs(levelAt(Wl, 1, { f1_Hz: 1500 }).mu - 1) < 1e-9 && low.N >= 2,
  `1.5 kHz: L ${f(low.wire.L_mm)} mm, ${low.N} settings at ${f(low.step)} dB, travel ${f(low.cam.travel_mm)} mm`);

console.log(`\n${fails.length ? `FAIL: ${fails.length}` : 'PASS: every check'}`);
process.exit(fails.length ? 1 : 0);
