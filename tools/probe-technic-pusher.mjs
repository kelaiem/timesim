// DOES THE LEGO ALARM'S PUSHER TURN THE COLUMN WHEEL'S DRIVER FROM ITS REST
// STOP TO ITS BANK STOP, ON ONE FACE, WITH EVERY PART CLEAR OF EVERY OTHER?
// Acceptance, pure Node, no browser, no network; exits non-zero on any failure.
// BUILT §288 (src/technic-alarm.js: solvePusher, pusherOf, pushFace, pushDriver).
//
// MODELLED, NOT SIMULATED: the rod's travel is the input and the driver stands
// where the rod's tip meets its half bush, a contact read off the parts. No force
// is weighed: the finger's, the driver's band (which also pushes the rod back
// out) and the friction of an axle in a pin hole are not numbers here.
//
//   · PARTS — the tip's face is flat out to the flanges the law takes as R (read
//     off 32123a's surface), the button's length is 3713's;
//   · SOLVE — solvePusher answers the declared TECHNIC_ALARM.pusher;
//   · LAW — the rod's travel 0 stands the driver on its rest stop and the whole
//     stroke on its bank stop; the law and its inverse agree; the push turns the
//     driver the press's way at every sample (the bush's height never crosses
//     W's); the contact stays on the tip's face;
//   · ON THE PARTS — at sampled travels the tip's surface stands within the
//     sampling of the driver's half bush, and backed off 0.2 and 0.5 mm along
//     the push it stands that far off (the gap is the law's, and it is along
//     the push);
//   · FRAME — each guide's hole at the rod's height; the rod in both guides over
//     the whole stroke; the collar an LDU short of the inner guide at rest (the
//     rod's out-stop) and clear of it at the bank; the button an LDU or more off
//     the outer guide at the bank;
//   · CLEAR — the pusher's and the driver's new parts over an LDU from every
//     part they do not bear on, at nine travels from rest to the bank;
//   · PRESS — through the column model, a full press (the rod's whole stroke)
//     steps one rest and a half press (s = halfAim) none, from every rest.
//
// WHAT THIS DOES NOT CLAIM: a force (how hard a finger presses, the band's
// return), that an axle in a pin hole slides with no stick, or where in its
// LDU of play a rod let go by the finger stands (it is posed on the contact).
//
// CONTROLS, each seen to fail: the rod a plate higher (the contact leaves the
// tip's face); the push run the other way (it turns the driver against the
// press); the driver posed by a straight line in the rod's travel (the parts
// part or meet); the driver's half bush left off (the tip meets nothing); the
// collar set on the inner guide (no play: it meets the brick); a half press
// taken as half the rod's travel (it is not the half the detent needs).
//
//   node tools/probe-technic-pusher.mjs
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseLibrary, LDU_MM } from '../src/ldraw.js';
import { placedParts, surfaceSamples } from '../src/technic-ldraw.js';
import { LEGO_DIM_MM as D, KEYLESS_PULL_DIM_MM } from '../src/technic-frame.js';
import * as M from '../src/technic-alarm.js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const lib = parseLibrary(readFileSync(join(ROOT, 'vendor/ldraw/technic-parts.mpd'), 'utf8'));
const deg = (r) => (r * 180 / Math.PI).toFixed(2);
const g = M.AX_CLEAR, P = M.ALARM_PARTS;
let fails = 0;
const fail = (msg) => { fails++; console.log(`  ✗ ${msg}`); };
const ctl = [];
const control = (name, caught) => { ctl.push([name, caught]); };

console.log('THE LEGO ALARM\'S PUSHER — a rod in two Technic bricks presses the driver\'s half bush (MODELLED)\n');
const frame = M.frameAlarm(lib), spec = frame.spec, pu = frame.pusher;
const S = M.alarmStates(lib, frame);
const m = M.columnModel(lib, frame, S);

// ── PARTS ───────────────────────────────────────────────────────────────────
console.log('parts:');
{
  const R = KEYLESS_PULL_DIM_MM.followerR / LDU_MM, s = surfaceSamples(lib, P.follower, 0.25);
  let z0 = Infinity; for (const q of s) if (q[2] < z0) z0 = q[2];
  let rFace = 0, rIn = Infinity;
  for (const q of s) if (Math.abs(q[2] - z0) < 1e-6) { const r = Math.hypot(q[0], q[1]); if (r > rFace) rFace = r; if (r < rIn) rIn = r; }
  console.log(`  the tip (${P.follower}): its end face flat from ${(rIn * LDU_MM).toFixed(3)} to ${(rFace * LDU_MM).toFixed(4)} mm; the law's R ${pu.R} mm`);
  if (Math.abs(rFace - R) > 1e-3) fail(`the tip's face reaches ${(rFace * LDU_MM).toFixed(4)} mm, not the flanges' ${pu.R}`);
  let b0 = Infinity, b1 = -Infinity; for (const q of surfaceSamples(lib, P.button, 0.5)) { if (q[2] < b0) b0 = q[2]; if (q[2] > b1) b1 = q[2]; }
  console.log(`  the button (${P.button}): ${((b1 - b0) * LDU_MM).toFixed(3)} mm along its axle; the build's ${pu.buttonW}`);
  if (Math.abs((b1 - b0) * LDU_MM - pu.buttonW) > 1e-3) fail('the button\'s length is not the part\'s');
}

// ── SOLVE ───────────────────────────────────────────────────────────────────
console.log('\nsolve:');
const sol = M.solvePusher(spec, frame.zL), pk = sol.pick;
if (!pk) fail(`solvePusher answers nothing: ${sol.why}`);
else {
  console.log(`  the push along ${pk.pd < 0 ? '−' : '+'}x in slot y ${pk.slot}, the rod at ${pk.z} mm (${pk.plates} plates under each guide), the contact at most ${pk.dev.toFixed(3)} mm off the rod's axis (the face: ${(pu.R - g).toFixed(3)})`);
  console.log(`  stroke ${pk.stroke} mm for the driver's ${deg(S.stroke)}°; guides at ${pk.guides.join(' and ')} mm from W; the collar ${pk.collar} mm out from the tip, an LDU short of the inner guide; a ${pk.rod}L rod, the button ${pk.buttonGap} mm off the outer guide at the bank`);
  const differs = (want) => pk.slot !== want.slot || pk.plates !== want.plates || pk.rod !== want.rod || pk.guides.some((u, i) => Math.abs(u - want.guides[i]) > 1e-9);
  if (differs(spec.pusher)) fail(`the solve answers ${JSON.stringify({ slot: pk.slot, plates: pk.plates, guides: pk.guides, rod: pk.rod })}, the table declares ${JSON.stringify(spec.pusher)}`);
  control('a declared rod a stud longer than the solve\'s', differs({ ...spec.pusher, rod: spec.pusher.rod + 1 }));
}

// ── LAW ─────────────────────────────────────────────────────────────────────
console.log('\nlaw:');
const N = 200, sg = S.sigma;
{
  const p0 = M.pusherDriver(pu, spec, 0), p1 = M.pusherDriver(pu, spec, pu.stroke);
  console.log(`  travel 0 → the driver at ${deg(p0)}° (its rest stop ${deg(S.psiRest)}°, off by ${Math.abs(p0 - S.psiRest).toExponential(1)} rad); the whole stroke → ${deg(p1)}° (the bank ${deg(S.psiBank)}°, off by ${Math.abs(p1 - S.psiBank).toExponential(1)})`);
  if (Math.abs(p0 - S.psiRest) > 1e-9 || Math.abs(p1 - S.psiBank) > 1e-9) fail('the rod\'s stroke is not the driver\'s, rest stop to bank stop');
  let inv = 0, back = 0, worstDz = 0, minArm = Infinity, maxArm = 0, prev = p0;
  const zW = frame.zL - spec.W[1];
  for (let i = 0; i <= N; i++) {
    const t = pu.stroke * i / N, psi = M.pusherDriver(pu, spec, t);
    inv = Math.max(inv, Math.abs(M.pusherTravel(pu, spec, psi) - t));
    if (i && sg * (psi - prev) <= 0) back++;
    prev = psi;
    const E = M.pushEnd(psi), arm = -E[1] * pu.pd * sg;            // the push's lever arm, signed the press's way
    minArm = Math.min(minArm, arm); maxArm = Math.max(maxArm, arm);
    worstDz = Math.max(worstDz, Math.abs(zW - E[1] - pu.z));
  }
  console.log(`  the law and its inverse agree to ${inv.toExponential(1)} mm; the driver turns the press's way at every one of ${N} steps (${back} back)`);
  console.log(`  the push's lever arm about W ${minArm.toFixed(2)}–${maxArm.toFixed(2)} mm (the bush's height under W), the same sign all the way; the contact at most ${worstDz.toFixed(3)} mm off the rod's axis, inside the tip's face (${(pu.R - g).toFixed(3)})`);
  console.log(`  so a millimetre of push turns the driver ${deg(1 / maxArm)}°–${deg(1 / minArm)}°`);
  if (inv > 1e-9) fail('the law and its inverse disagree');
  if (back) fail(`the driver turns back on ${back} steps of the push`);
  if (!(minArm > 0)) fail('the push turns the driver against the press somewhere on the stroke');
  if (worstDz > pu.R - g) fail('the contact leaves the tip\'s face');
  // controls: a plate higher; the push the other way
  const hi = pu.z + D.plateH;
  let dzHi = 0; for (let i = 0; i <= N; i++) dzHi = Math.max(dzHi, Math.abs(zW - M.pushEnd(M.pusherDriver(pu, spec, pu.stroke * i / N))[1] - hi));
  control('the rod a plate higher (the contact leaves the tip\'s face)', dzHi > pu.R - g);
  control('the push run the other way (it turns the driver against the press)', -M.pushEnd(S.psiRest)[1] * (-pu.pd) * sg < 0);
}

// ── ON THE PARTS ────────────────────────────────────────────────────────────
// The tip's and the half bush's surfaces, placed by the build at a travel: the
// nearest two samples, and the same with the rod backed off along the push.
const cloudCache = new Map();
function cloud(p) {
  const key = `${p.part}|${p.m.join(',')}`;
  if (cloudCache.has(key)) return cloudCache.get(key);
  const m = p.m, pts = surfaceSamples(lib, p.part, 0.5).map(([x, y, z]) => [m[0] + m[3] * x + m[4] * y + m[5] * z, m[1] + m[6] * x + m[7] * y + m[8] * z, m[2] + m[9] * x + m[10] * y + m[11] * z]);
  const lo = [Infinity, Infinity, Infinity], hi = [-Infinity, -Infinity, -Infinity];
  for (const q of pts) for (let d = 0; d < 3; d++) { if (q[d] < lo[d]) lo[d] = q[d]; if (q[d] > hi[d]) hi[d] = q[d]; }
  const c = { pts, lo, hi }; cloudCache.set(key, c); return c;
}
function gap(A1, B1, reach = 4) {
  if ([0, 1, 2].some((d) => A1.lo[d] > B1.hi[d] + reach || B1.lo[d] > A1.hi[d] + reach)) return Infinity;
  const C = 2, grid = new Map(), key = (x, y, z) => `${Math.floor(x / C)},${Math.floor(y / C)},${Math.floor(z / C)}`;
  for (const q of B1.pts) {
    if (q[0] < A1.lo[0] - reach || q[0] > A1.hi[0] + reach || q[1] < A1.lo[1] - reach || q[1] > A1.hi[1] + reach || q[2] < A1.lo[2] - reach || q[2] > A1.hi[2] + reach) continue;
    const k = key(...q); if (!grid.has(k)) grid.set(k, []); grid.get(k).push(q);
  }
  let best = Infinity;
  for (const q of A1.pts) {
    const cx = Math.floor(q[0] / C), cy = Math.floor(q[1] / C), cz = Math.floor(q[2] / C);
    for (let dx = -1; dx <= 1; dx++) for (let dy = -1; dy <= 1; dy++) for (let dz = -1; dz <= 1; dz++) {
      const cell = grid.get(`${cx + dx},${cy + dy},${cz + dz}`); if (!cell) continue;
      for (const s of cell) { const d = Math.hypot(s[0] - q[0], s[1] - q[1], s[2] - q[2]); if (d < best) best = d; }
    }
  }
  return best;
}
// a press from rest 0 at travel t, every body where the column model puts it
const poseAt = (t, { linear = false, push = null } = {}) => {
  const p = M.columnPose(m, M.columnStroke(m, M.columnStart(m), t / pu.stroke));
  if (linear) p.psiDriver = S.psiRest + sg * S.stroke * t / pu.stroke;
  if (push !== null) p.pushX = push;
  return p;
};
const partOf = (b, shaft, role) => placedParts({ ...b, statics: [], shafts: [b.shafts.find((s) => s.shaft === shaft)] }).filter((p) => p.role === role);
// THE FACE, read off the placed samples: inside the tip's disc (the rod's axis,
// out to R), the driver part's farthest point along the push and the tip's
// nearest, in frame x (mm). A cloud's nearest-pair distance would only say
// "within the spacing", and could not tell touching from sitting inside. The
// law takes the bush ROUND, at its flanges' radius R; the LDraw part draws it
// as a 16-gon (4-4cyli) whose vertices stand on R, so the drawn flange stands
// between 0 and R(1 − cos(π/16)) inside the round one, as it turns: the gap
// must lie in that band, never below it (that would be the tip inside the
// bush), and must move by exactly the offset when the rod is backed off.
const inDisc = (q) => Math.hypot(q[2] * LDU_MM - pu.slot, -q[1] * LDU_MM - pu.z) <= pu.R;
const support = (p, dir) => { let best = -Infinity; for (const q of cloud(p).pts) if (inDisc(q)) best = Math.max(best, dir * q[0] * LDU_MM); return best; };
// outward (−pd): the tip's face is its least outward point, the half bush's
// contact its most; their difference is the gap along the push
const faceGap = (b, role = 'follower') => -support(partOf(b, 'pusher', 'pushTip')[0], pu.pd) - support(partOf(b, 'driver', role)[0], -pu.pd);
console.log('\non the parts:');
{
  const samples = 9, out = [], back = [], SAG = pu.R * (1 - Math.cos(Math.PI / 16));
  let lo = Infinity, hi = -Infinity, worstBack = 0, worstTip = 0;
  for (let i = 0; i < samples; i++) {
    const t = pu.stroke * i / (samples - 1), pose = poseAt(t), b = M.alarmBuild(frame, lib, pose);
    const gg = faceGap(b); out.push(gg.toFixed(4)); lo = Math.min(lo, gg); hi = Math.max(hi, gg);
    // the tip's face where the law puts it
    worstTip = Math.max(worstTip, Math.abs(-support(partOf(b, 'pusher', 'pushTip')[0], pu.pd) + pu.pd * pose.pushX));
    for (const off of [0.2, 0.5]) {
      const d = faceGap(M.alarmBuild(frame, lib, poseAt(t, { push: M.pusherX(pu, t) - pu.pd * off }))) - off - gg;
      worstBack = Math.max(worstBack, Math.abs(d)); if (i === 4) back.push(`${off} → ${(d + off + gg).toFixed(4)}`);
    }
  }
  console.log(`  at ${samples} travels, in the tip's disc: the tip's face stands ${out.join(', ')} mm off the driver's drawn half bush along the push — in [0, ${SAG.toFixed(4)}], the 16-gon's sagitta (the tip's face at the law's x to ${worstTip.toExponential(1)} mm)`);
  console.log(`  backed off along the push, mid-stroke: ${back.join(' mm, ')} mm; at every travel the gap moves by the offset to ${worstBack.toExponential(1)} mm`);
  if (lo < -1e-6) fail(`the tip stands ${(-lo).toFixed(4)} mm inside the half bush`);
  if (hi > SAG + 1e-6) fail(`the tip stands ${hi.toFixed(4)} mm off the half bush, more than the drawn flange's sagitta`);
  if (worstTip > 1e-6) fail('the tip\'s face is not where the law puts it');
  if (worstBack > 1e-6) fail('backed off along the push, the gap does not move by the offset: the contact is not the law\'s');
  // controls: a straight line in the rod's travel; the half bush left off
  let linLo = Infinity, linHi = -Infinity;
  for (let i = 1; i < samples - 1; i++) { const t = pu.stroke * i / (samples - 1), v = faceGap(M.alarmBuild(frame, lib, poseAt(t, { linear: true }))); linLo = Math.min(linLo, v); linHi = Math.max(linHi, v); }
  console.log(`  (posed by a straight line in the rod's travel instead, the gap would run ${linLo.toFixed(3)} to ${linHi.toFixed(3)} mm)`);
  control('the driver posed by a straight line in the rod\'s travel (the tip leaves or enters the half bush)', linLo < -1e-6 || linHi > SAG + 1e-6);
  control('the driver\'s half bush left off (nothing of the driver stands in the tip\'s disc)', !Number.isFinite(faceGap(M.alarmBuild(frame, lib, poseAt(pu.stroke / 2)), 'driver')));
}

// ── FRAME ───────────────────────────────────────────────────────────────────
console.log('\nframe:');
{
  const guides = frame.stacks.filter((s) => s.turned);
  for (const gd of guides) {
    const hole = gd.top - D.brickH + D.holeZ;
    if (Math.abs(hole - pu.z) > 1e-9) fail(`the ${gd.who}'s hole at ${hole} mm, the rod at ${pu.z}`);
    if (gd.slot !== pu.slot) fail(`the ${gd.who} in slot ${gd.slot}, the rod in ${pu.slot}`);
  }
  const o = -pu.pd, half = D.stud / 2;
  const span = (t) => [o * M.pusherX(pu, t), o * M.pusherX(pu, t) + pu.len];      // the rod, outward
  const inside = [0, pu.stroke].every((t) => guides.every((gd) => span(t)[0] <= o * gd.x - half && span(t)[1] >= o * gd.x + half));
  const inner = guides.find((gd) => gd.who === 'inner guide'), outer = guides.find((gd) => gd.who === 'outer guide');
  const collarOut = (t) => o * M.pusherX(pu, t) + pu.collar + pu.W;
  const playRest = o * inner.x - half - collarOut(0), playBank = o * inner.x - half - collarOut(pu.stroke);
  const button = o * outer.x + half, bGap = (t) => o * M.pusherX(pu, t) + pu.len - pu.buttonW - button;
  console.log(`  both guides' holes at the rod's ${pu.z} mm; the rod through both from rest to the bank: ${inside}`);
  console.log(`  the collar ${playRest.toFixed(3)} mm short of the inner guide at rest (the rod's play), ${playBank.toFixed(3)} at the bank; the button ${bGap(0).toFixed(3)} mm off the outer guide at rest, ${bGap(pu.stroke).toFixed(3)} at the bank`);
  if (!inside) fail('the rod leaves a guide over its stroke');
  if (Math.abs(playRest - g) > 1e-6) fail('the collar is not an LDU short of the inner guide at rest');
  if (bGap(pu.stroke) < g - 1e-9) fail('the button meets the outer guide before the bank');
}

// ── CLEAR ───────────────────────────────────────────────────────────────────
// The pusher's parts and the driver's new two against every part they do not
// bear on: the rod in its guides, the tip on the half bush, the half bush's 2L
// in it, the driver on its rest stack at rest (landing I's own skip).
const CLEAR_LDU = 1;
function clearOf(b, t) {
  const all = [];
  b.statics.forEach((p) => { if (p.role !== 'baseplate') all.push({ p, sh: null }); });
  b.shafts.forEach((s) => placedParts({ ...b, statics: [], shafts: [s] }).forEach((p) => all.push({ p, sh: s.shaft })));
  const isNew = (a) => a.sh === 'pusher' || (a.sh === 'driver' && (a.p.role === 'follower' || a.p.role === 'stub'))
    || (a.sh === null && a.p.role === 'technicBrick' && a.p.m[3] === 0);    // a brick turned a quarter round: the guides
  const errs = [], near = new Map();
  for (const a of all) if (isNew(a)) for (const c of all) {
    if (c === a || (c.sh && c.sh === a.sh) || (isNew(c) && all.indexOf(c) < all.indexOf(a))) continue;
    const r = [a.p.role, c.p.role], has = (x, y) => (r[0] === x && r[1] === y) || (r[0] === y && r[1] === x);
    if (has('axle', 'technicBrick')) continue;
    if (has('pushTip', 'follower') && [a.sh, c.sh].includes('driver')) continue;
    if ([a.sh, c.sh].includes('pusher') && [a.sh, c.sh].includes('driver') && has('axle', 'follower')) continue;   // the rod's end, flush with the tip, bears with it
    if (a.sh === null && c.sh === null) continue;
    const ca = cloud(a.p), cb = cloud(c.p);
    if ([0, 1, 2].some((d) => ca.lo[d] > cb.hi[d] + CLEAR_LDU || cb.lo[d] > ca.hi[d] + CLEAR_LDU)) continue;
    const gg = gap(ca, cb), name = `${a.sh ?? 'frame'} ${a.p.role} ${a.p.part} ⇄ ${c.sh ?? 'frame'} ${c.p.role} ${c.p.part}`;
    if (gg < (near.get(name) ?? Infinity)) near.set(name, gg);
    if (gg < CLEAR_LDU) errs.push(`travel ${t.toFixed(2)}: ${name} come ${(gg * LDU_MM).toFixed(3)} mm apart`);
  }
  return { errs, near };
}
console.log('\nclear:');
{
  const near = new Map(), errs = [];
  for (let i = 0; i <= 8; i++) {
    const t = pu.stroke * i / 8, c = clearOf(M.alarmBuild(frame, lib, poseAt(t)), t);
    errs.push(...c.errs);
    for (const [n, d] of c.near) if (d < (near.get(n) ?? Infinity)) near.set(n, d);
  }
  const top = [...near].sort((a, b) => a[1] - b[1]).slice(0, 5).map(([n, d]) => `${n} ${(d * LDU_MM).toFixed(2)} mm`);
  console.log(`  at 9 travels, rest to bank: ${errs.length ? `${errs.length} too close` : 'clear'}; nearest ${top.join('; ')}`);
  for (const e of [...new Set(errs)]) fail(e);
  // control: the collar set on the inner guide (no play)
  const b = M.alarmBuild({ ...frame, pusher: { ...pu, collar: pu.collar + g } }, lib, poseAt(0));
  control('the collar set on the inner guide (no play: it meets the brick)', clearOf(b, 0).errs.length > 0);
}

// ── PRESS ───────────────────────────────────────────────────────────────────
console.log('\npress:');
{
  const pressTo = (st0, aim) => {
    let st = M.columnCommand(m, st0, aim === 1 ? 'press' : 'half');
    st = { ...st, aim };
    for (let i = 0; i < 4000 && st.act !== 'idle' && st.act !== 'hour'; i++) st = M.columnAdvance(m, st, 1 / 240);
    return m.atRest(M.columnWheel(m, st));
  };
  let ok = 0, halfOk = 0;
  for (let k = 0; k < 12; k++) {
    const st0 = M.columnStart(m, { k });
    if (pressTo(st0, 1) === k + 1) ok++;
    if (pressTo(st0, m.halfAim) === k) halfOk++;
  }
  const hp = M.pusherDriver(pu, spec, m.halfAim * pu.stroke), w = sg * (hp - S.psiRest) - m.pickup;
  console.log(`  a full press (the rod's ${pu.stroke.toFixed(3)} mm) steps one rest from ${ok} of 12; a half press (${(m.halfAim * pu.stroke).toFixed(3)} mm, s = ${m.halfAim.toFixed(4)}) none from ${halfOk} of 12`);
  console.log(`  the half press turns the wheel ${deg(w)}°, short of the near crest ${deg(S.crest)}° by ${deg(S.crest - w)}° (PRESS_MARGIN ${deg(M.PRESS_MARGIN)}°)`);
  if (ok !== 12) fail(`a full press steps one rest from only ${ok} of 12`);
  if (halfOk !== 12) fail(`a half press falls back from only ${halfOk} of 12`);
  if (Math.abs(S.crest - w - M.PRESS_MARGIN) > 1e-9) fail('the half press does not stop PRESS_MARGIN short of the near crest');
  const naive = (S.crest - M.PRESS_MARGIN + m.pickup) / S.stroke;
  const wN = sg * (M.pusherDriver(pu, spec, naive * pu.stroke) - S.psiRest) - m.pickup;
  control('a half press taken as a fraction of the driver\'s turn (not the rod\'s travel)', Math.abs(S.crest - wN - M.PRESS_MARGIN) > 1e-6);
}

console.log('\ncontrols:');
for (const [n, c] of ctl) { console.log(`  ${c ? 'caught' : 'NOT CAUGHT'}  ${n}`); if (!c) fails++; }
console.log(fails ? `\n${fails} FAILED` : `\nthe rod's ${pu.stroke.toFixed(2)} mm stroke turns the driver its ${deg(S.stroke)}°, rest stop to bank stop, on the tip's face, every part clear — controls ${ctl.length}/${ctl.length}`);
process.exit(fails ? 1 : 0);
