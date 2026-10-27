// IS THE LEGO ALARM CLOCK ONE BUILD: ITS MODULES ON ONE BASEPLATE, EACH SHARED
// AXLE ONE KEYED BODY ON ONE LINE, EVERY MESH IN MESH AND EVERY MODULE CLEAR OF
// EVERY OTHER IN EVERY STATE?
// Acceptance, pure Node, no browser, no network; exits non-zero on any failure.
// BUILT §312 landings L1 and L1b (src/technic-clock.js).
//
// MODELLED, NOT SIMULATED, and display only: every reading below is geometry
// read off the vendored LDraw parts as the clock places them. Nothing is
// driven, integrated or weighed.
//
//   · PLAN — the modules, the lines (an ADAPTER where a line pairs the two grid
//     classes and neither module can stand half a stud over), the placement,
//     each module's lift the group's highest line less its own (whole plates);
//   · JOINED — every line joins, none refused: since L1b the escape line runs
//     to the escapement's DRIVE (a 1:1 transfer onto an input axle open behind,
//     src/technic-escapement.js). Controls, by measurement: the cell's own
//     escapement (no drive) in its place has its escape line REFUSED, the arbor
//     closed at both ends (L1's finding); and with its back knife taken away
//     that side reads free;
//   · STANDING — no two statics in one space; every static on the baseplate or
//     on the static under it; every foot on a baseplate and in the form the
//     frames' grid rule gives at its x (a 1×1 plate on the grid, a jumper half a
//     stud off, a 1×2 plate's studs on the grid); control: a re-footed foot put
//     back as it was;
//   · LINES — each line's Technic bricks, both modules', have their hole faces
//     on ONE line (to float noise: the line is derived); every gear of both modules on the line is on
//     one body; the joint's axles pass every brick; a joiner holds each axle
//     inside its bore short of its web; every part keyed on a line body (both
//     modules') on one of its axles (CARRIED, L1b: L1 laid each joint between
//     the bricks' far faces and left the fusee's centre pinion and the alarm's
//     hour-axle 8T on no axle); controls: one module of a line moved an LDU
//     across, the joints cut back to the bricks' far faces;
//   · MESHES — every gear pair on two bodies at its catalogue centre distance in
//     one slab is a mesh, and every one is interleaved (penetration ≤ 0.05 mm,
//     the alarm probe's bound), each gear's own plane mapped into the world (a
//     module turned 180° mirrors its parts in plan); the train's ratios read off
//     those meshes: the going group 40/8 × 60 × 7.5 from the great wheel to the
//     fourth→escape output and on, 1:1, to the escape wheel, the minute group 1,
//     in the sense kept, from the minute axle to the alarm's hour axle; the
//     SENSE: the great wheel running its going sense drives the escape wheel
//     the way its escapement escapes; controls: a line body turned half a tooth,
//     the escapement turned the other way (the layout's own judge refuses it);
//   · CLEAR — over the alarm's three states × the keyless works' three modes,
//     every part of one module over an LDU from every part of another (and the
//     joints' parts from everything but their own line), the statics held by
//     STANDING instead and a meshing pair by MESHES; control: a part of one
//     module planted where a moving part of another stands;
//   · THE FILE — the .ldr parsed back.
//
// WHAT THIS DOES NOT CLAIM: that the train turns the hands (the centre arbor and
// the minute axle are two lines, with no slip between them yet: §312's L2), any
// force, any rate kept (the escapement's beat is its own probe's, on the drive's
// balance). A module's
// OWN parts are held by its own probe; the clock moves no part of a module
// against another of its own, except that a re-phased gear turns about its own
// axle — angle-free for everything but its meshes, which MESHES holds.
//
//   node tools/probe-technic-clock.mjs [--gen technic_2026|technic_classic]
import { loadPack } from './technic-pack.mjs';
import { LDU_MM, placements, compose, walk } from '../src/ldraw.js';
import { FRAME_PARTS, KEYLESS_DIM_MM } from '../src/technic-frame.js';
import { placedParts, toLdr, placedCloud, cloudGap, rotZ } from '../src/technic-ldraw.js';
import { starProfile, goingSense } from '../src/technic-fusee.js';
import * as X from '../src/technic-escapement.js';
import * as C from '../src/technic-clock.js';

const lib = loadPack();
const args = process.argv.slice(2), gi = args.indexOf('--gen');
const GENS = gi >= 0 ? [args[gi + 1]] : ['technic_2026', 'technic_classic'];
let fails = 0;
const fail = (m) => { console.log(`  FAIL  ${m}`); fails++; };
const ctl = [];
const control = (name, caught) => ctl.push([name, caught]);
const L = (mm) => mm / LDU_MM, mm = (ldu) => (ldu * LDU_MM).toFixed(2);
const near = (a, b, tol = 1e-6) => Math.abs(a - b) <= tol;
// a line is derived, so its halves and its bricks are on it to float noise, not to a clearance
const LINE_TOL = 1e-6;
const CLEAR = C.CLOCK_CLEAR_LDU;
const MESH_DEPTH_MM = 0.05;
const TAU = 2 * Math.PI;
const T0 = Date.now(), lap = (what) => console.log(`  [${what}: ${((Date.now() - T0) / 1000).toFixed(0)} s]`);

// ── the meshes, read off the placed parts ────────────────────────────────────
// a gear's pose in the world: its axis (x, y LDU) and the 2×2 map from its own
// plane (part x, y) into world x, y; parallel to LDraw z or not a gear here
function gearPose(p) {
  const m = p.m;
  if (!near(Math.abs(m[11]), 1, 1e-9)) return null;          // its own z along LDraw z
  return { c: [m[0], m[1]], z: m[2], M: [m[3], m[4], m[6], m[7]], part: p.part, teeth: p.teeth };
}
const profRAt = (P, ang) => { const BINS = P.r.length, t = ((ang / TAU) % 1 + 1) % 1 * BINS, i = Math.floor(t) % BINS, f = t - Math.floor(t); return P.r[i] * (1 - f) + P.r[(i + 1) % BINS] * f; };
// the deepest any sampled tooth point of one stands inside the other's outline (mm; ≤ 0 interleaved)
function penetrationW(A, B) {
  const PA = starProfile(lib, A.part), PB = starProfile(lib, B.part);
  let worst = -Infinity;
  for (const [P, a, Q, b] of [[PA, A, PB, B], [PB, B, PA, A]]) {
    const BINS = Q.r.length;
    for (let i = 0; i < BINS; i += 2) {
      const r = Q.r[i];
      if (r < 0.6 * Q.tip) continue;
      const ph = i / BINS * TAU, lx = L(r) * Math.cos(ph), ly = L(r) * Math.sin(ph);
      const wx = b.c[0] + b.M[0] * lx + b.M[1] * ly, wy = b.c[1] + b.M[2] * lx + b.M[3] * ly;
      const dx = wx - a.c[0], dy = wy - a.c[1], d = Math.hypot(dx, dy) * LDU_MM;
      if (d > P.tip + 0.01) continue;
      // into a's own plane (its map is orthogonal: the inverse is the transpose)
      const ux = a.M[0] * dx + a.M[2] * dy, uy = a.M[1] * dx + a.M[3] * dy;
      worst = Math.max(worst, profRAt(P, Math.atan2(uy, ux)) - d);
    }
  }
  return worst;
}
const halfWidth = (part) => 10;
// THE MESH CONDITION read off the placed tips (probe-technic-build's law): each
// gear's tooth angle about LDraw z as placed, arg Σ e^{iNθ} / N over its tip
// vertices; a pair meshes when Na·(A − α) + Nb·(B − α − π) ≡ π, α the line of
// centres. The residue as a fraction of a turn (0 meshed, ½ tooth on tooth).
const tipCache = new Map();
function tipsOf(part) {
  if (tipCache.has(part)) return tipCache.get(part);
  const pts = []; let r = 0;
  walk(lib, `${part}.dat`, (k, ps) => { if (k === 'tri') for (const q of ps) { pts.push(q); r = Math.max(r, Math.hypot(q[0], q[1])); } });
  const out = pts.filter((q) => Math.hypot(q[0], q[1]) > r - 1e-6); tipCache.set(part, out); return out;
}
function toothAngle(g) {
  let c = 0, s = 0;
  for (const q of tipsOf(g.part)) { const x = g.M[0] * q[0] + g.M[1] * q[1], y = g.M[2] * q[0] + g.M[3] * q[1]; const a = g.teeth * Math.atan2(y, x); c += Math.cos(a); s += Math.sin(a); }
  return Math.atan2(s, c) / g.teeth;
}
function phaseOff(a, b) {
  const al = Math.atan2(b.c[1] - a.c[1], b.c[0] - a.c[0]);
  const r = ((a.teeth * (toothAngle(a) - al) + b.teeth * (toothAngle(b) - al - Math.PI) - Math.PI) % TAU + TAU) % TAU / TAU;
  return Math.min(r, 1 - r);
}
const PHASE_TOL = 1e-3;   // probe-technic-build's: the tips are measured off polygons     // every catalogue gear but the 24T is 20 LDU; the 24T's 19.25 is inside it
function findMeshes(build) {
  const gears = [];
  build.shafts.forEach((s, bi) => {
    const R = rotZ(s.phi), ps = placedParts({ ...build, statics: [], shafts: [s] });
    ps.forEach((p, pi) => { if (p.teeth) { const g = gearPose(p); if (g) gears.push({ ...g, body: bi, idx: pi, module: p.module }); } });
  });
  const out = [];
  for (let i = 0; i < gears.length; i++) for (let j = i + 1; j < gears.length; j++) {
    const a = gears[i], b = gears[j];
    if (a.body === b.body) continue;
    const cd = Math.hypot(a.c[0] - b.c[0], a.c[1] - b.c[1]) * LDU_MM;
    if (!near(cd, (a.teeth + b.teeth) / 2, 1e-4)) continue;
    if (Math.abs(a.z - b.z) >= halfWidth(a.part) + halfWidth(b.part) - 1e-6) continue;
    out.push({ a, b, depth: penetrationW(a, b), off: phaseOff(a, b) });
  }
  return out;
}

for (const gen of GENS) {
  console.log(`\n══ ${gen} ══`);
  const t0 = Date.now();
  const Mods = C.clockModules(lib, gen);
  if (!Mods.framed) { fail(`${gen}: the modules do not build: ${Mods.reason}`); continue; }
  const lay = C.solveClockLayout(lib, Mods);
  if (!lay.framed) { fail(`${gen}: no layout: ${lay.reason}`); continue; }
  console.log(`  solved in ${((Date.now() - t0) / 1000).toFixed(0)} s`);

  // ── PLAN ───────────────────────────────────────────────────────────────────
  console.log('\nplan (the modules, the lines, where each stands):');
  for (const ln of Mods.lines) console.log(`  line ${ln.key}: ${ln.a.join(' ')} ⇄ ${ln.b.join(' ')} — ${ln.why}`);
  for (const [k, m] of Object.entries(Mods.modules)) if (m.adapter) console.log(`  ADAPTER on the ${m.adapter} line: ${m.chain.map(([a, b]) => `${a}:${b}`).join(' × ')} (${C.solveAdapter(gen).why})`);
  for (const [k, p] of Object.entries(lay.placement))
    console.log(`  ${k.padEnd(16)} ${p.rot ? 'turned 180°' : 'as built   '}  at x ${mm(p.tx).padStart(7)} z ${mm(p.tz).padStart(7)} mm, lifted ${p.lift} mm${p.shift ? ', half a stud over' : ''}`);
  // the lifts: each group to its highest line, whole plates
  for (const g of lay.groups) {
    const hs = lay.lines.filter((ln) => g.includes(ln.ends[0].mk)).flatMap((ln) => ln.ends.map((e) => ({ mk: e.mk, h: e.ex.geometry.height })));
    const top = Math.max(...hs.map((x) => x.h));
    for (const { mk, h } of hs) {
      const want = Math.round((top - h) * 1e6) / 1e6, got = lay.placement[mk].lift;
      if (!near(got, want, 1e-6)) fail(`${mk}: lifted ${got} mm, its group's highest line less its own is ${want}`);
      if (!near(got / 3.2, Math.round(got / 3.2), 1e-6)) fail(`${mk}: a lift of ${got} mm is not whole plates`);
    }
    console.log(`  group ${g.join(' + ')}: every line at ${top} mm`);
  }
  console.log(`  ${Object.keys(lay.placement).length} modules on ${lay.areaStuds} studs of plan; not in the cell: ${Mods.order.filter((k) => !lay.placement[k]).join(', ') || 'none'}`);

  lap('JOINED');
  // ── JOINED ─────────────────────────────────────────────────────────────────
  console.log('\njoined (every line, none refused):');
  for (const r of lay.refused) fail(`the ${r.key} line was refused: ${r.reason}`);
  if (!lay.joints.some((j) => j.line === 'escape')) fail('the escape line is not joined');
  {
    const em = Mods.modules.escapement, de = C.lineExits(lib, em, C.lineBody(em, 'drive'));
    console.log(`  escape: through the escapement's ${em.frame.drive.teeth}:${em.frame.drive.teeth} transfer onto its input axle at ${mm(C.lineGeometry(lib, em, C.lineBody(em, 'drive')).x)} mm, open ${de.back.blocked ? 'in front' : 'behind'} (${de.front.blocked ? `in front ${de.front.blocked}` : `behind ${de.back.blocked}`})`);
    if (de.front.blocked && de.back.blocked) fail('the escapement\'s input axle is closed at both ends');
    // controls, by measurement: the cell's own escapement (no drive) is closed at both ends, and open behind once
    // its back knife is taken away
    const cell = X.frameEscapement(), cm = { ...em, frame: cell, build: X.escapementBuild(cell, lib) }, ci = C.lineBody(cm, 'escape');
    const ce = C.lineExits(lib, cm, ci);
    console.log(`  the cell's own escapement, undriven: ${ce.front.blocked && ce.back.blocked ? `closed at both ends (in front ${ce.front.blocked}; behind ${ce.back.blocked})` : 'open'}`);
    control('the cell\'s undriven escapement in the drive\'s place has its escape arbor closed at both ends', !!(ce.front.blocked && ce.back.blocked));
    const cb = cm.build, span = C.lineGeometry(lib, cm, ci).span;
    const backKnife = new Set(cb.statics.map((p, i) => [p, i]).filter(([p]) => p.m[2] > span[1] + 1e-6 && (p.role === 'knife' || p.role === 'brick' || p.role === 'plate') && Math.abs(p.m[0] - cb.shafts[ci].origin[0]) < 21).map(([, i]) => i));
    const cut = { ...cm, build: { ...cb, statics: cb.statics.filter((_, i) => !backKnife.has(i)) } };
    control('that escapement with its back knife taken away is open behind', !C.lineExits(lib, cut, ci).back.blocked);
  }

  lap('THE NINE STATES');
  // ── THE NINE STATES ────────────────────────────────────────────────────────
  const states = C.TECHNIC_CLOCK.alarmStates.flatMap((a) => C.TECHNIC_CLOCK.keylessModes.map((k) => ({ alarm: a, keyless: k })));
  const builds = states.map((s) => C.clockBuild(lib, Mods, lay, s));
  const rest = builds[states.findIndex((s) => s.alarm === C.TECHNIC_CLOCK.rest.alarm && s.keyless === C.TECHNIC_CLOCK.rest.keyless)];
  console.log(`\n${builds.length} states built: ${rest.statics.length} statics, ${rest.shafts.length} bodies, ${placedParts(rest).length} parts, on ${rest.base.plates.length} baseplates of 32×32 (${rest.base.studsX}×${rest.base.studsZ} studs)`);

  lap('STANDING');
  // ── STANDING ───────────────────────────────────────────────────────────────
  console.log('\nstanding:');
  const standErrs = (b) => {
    // (the fusee's cord is a braided string drawn as segments that overlap where they join: not bricks)
    const errs = [], S = b.statics.filter((s) => !['baseplate', 'cord', 'cordEnd'].includes(s.role)).map((s) => ({ s, box: C.boxOf(lib, s.part, s.m, { body: true }) }));
    const plates = b.statics.filter((s) => s.role === 'baseplate').map((s) => C.boxOf(lib, s.part, s.m, { body: true }));
    const ov = (a, c, d) => Math.min(a.hi[d], c.hi[d]) - Math.max(a.lo[d], c.lo[d]);
    for (let i = 0; i < S.length; i++) for (let j = i + 1; j < S.length; j++)
      if ([0, 1, 2].every((d) => ov(S[i].box, S[j].box, d) > 1e-6)) errs.push(`${S[i].s.module} ${S[i].s.part} and ${S[j].s.module} ${S[j].s.part} stand in one space`);
    for (const { s, box } of S) {
      const bottom = box.hi[1];
      if (Math.abs(bottom) < 1e-6) {
        const on = plates.find((p) => box.lo[0] >= p.lo[0] - 1e-6 && box.hi[0] <= p.hi[0] + 1e-6 && box.lo[2] >= p.lo[2] - 1e-6 && box.hi[2] <= p.hi[2] + 1e-6);
        if (!on) errs.push(`${s.module} ${s.part} at x ${mm(s.m[0])} z ${mm(s.m[2])} is off every baseplate`);
        if (!C.footStands(s.part, s.m[0])) errs.push(`${s.module} ${s.part} at x ${mm(s.m[0])} does not stand on the baseplate's studs there`);
        continue;
      }
      const under = S.find((o) => o.s !== s && Math.abs(o.box.lo[1] - bottom) < 1e-6 && ov(o.box, box, 0) > 1e-6 && ov(o.box, box, 2) > 1e-6);
      if (!under && s.role !== 'cord' && s.role !== 'cordEnd') {
        // a part the module itself hangs from a body or a pin (none is a foot) is the module's own business
        if (!s.filler && s.static !== undefined) continue;
        errs.push(`${s.module} ${s.part} at x ${mm(s.m[0])} z ${mm(s.m[2])} stands on nothing`);
      }
    }
    return errs;
  };
  const se = standErrs(rest);
  for (const e of se) fail(e);
  const feet = rest.statics.filter((s) => s.refooted), fill = rest.statics.filter((s) => s.filler !== undefined);
  console.log(`  ${rest.statics.length - rest.base.plates.length} statics, none in another's space; ${feet.length} feet re-footed (${[...new Set(feet.map((s) => `${s.refooted}→${s.part}`))].join(', ') || 'none'}), ${fill.length} fillers under the lifted modules`);
  if (feet.length) {
    // the foot put back as its module built it, and (on a lifted module) the fillers under it re-derived from that
    // foot, as standModule derives them: the stack's lowest part then stands off the studs at its x
    const f0 = feet[0], under = rest.statics.filter((s) => s.module === f0.module && s.filler === f0.static);
    const lift = under.reduce((h, s) => h + (s.role === 'brick' ? 9.6 : 3.2), 0), was = C.fillers(f0.refooted, lift) ?? [];
    const undo = { ...rest, statics: rest.statics.map((s) => (s === f0 ? { ...s, part: s.refooted } : under.includes(s) ? { ...s, part: was[under.indexOf(s)].part } : s)) };
    control(`a re-footed foot put back as its module built it${under.length ? ', its fillers with it' : ''}`, standErrs(undo).some((e) => e.includes('does not stand on the baseplate')));
  }

  lap('LINES');
  // ── LINES ──────────────────────────────────────────────────────────────────
  console.log('\nlines (both modules\' bricks on one line, one body, the joint through them):');
  const holeFaces = (s) => placements(lib, `${s.part}.dat`, /^(peghole|connhol\w*)\.dat$/).map((h) => compose(s.m, h.m));
  const lineErrs = (b, layout) => {
    const errs = [];
    for (const ln of b.lines) {
      const body = b.shafts[ln.body];
      const mods = [ln.a, ln.b];
      // the bricks the two modules hold the line with, read back through the placement
      const bricks = b.statics.filter((s) => s.part === FRAME_PARTS.technicBrick1x1 && mods.includes(s.module)
        && layout.lines.find((l) => l.key === ln.key).ends.some((e) => e.mk === s.module && e.ex.geometry.bricks.includes(s.static)));
      if (bricks.length !== 4) errs.push(`${ln.key}: ${bricks.length} Technic bricks on the line, not 4`);
      for (const s of bricks) for (const w of holeFaces(s))
        if (Math.hypot(w[0] - body.origin[0], w[1] - body.origin[1]) > LINE_TOL) errs.push(`${ln.key}: ${s.module}'s brick hole stands ${mm(Math.hypot(w[0] - body.origin[0], w[1] - body.origin[1]))} mm off the line`);
      // the joint's axles pass every brick
      const axles = body.parts.filter((p) => p.role === 'axle').map((p) => { const h = (C.boxOf(lib, p.part, p.m).hi[2] - C.boxOf(lib, p.part, p.m).lo[2]) / 2; return [p.m[2] + body.origin[2] - h, p.m[2] + body.origin[2] + h]; });
      for (const s of bricks) {
        const zs = holeFaces(s).map((w) => w[2]), lo = Math.min(...zs), hi = Math.max(...zs);
        // (an axle is 20·N − 1 LDU: the library trims half an LDU each end, so it stops that short of an outer face)
        if (!axles.some(([a0, a1]) => a0 <= lo + 0.5 + 1e-6 && a1 >= hi - 0.5 - 1e-6)) errs.push(`${ln.key}: no axle passes ${s.module}'s brick at z ${mm(lo)}–${mm(hi)}`);
      }
      // a joiner holds each axle inside its bore, short of its web
      const jn = body.parts.find((p) => p.role === 'joiner');
      if (jn) {
        const jz = jn.m[2] + body.origin[2], JH = L(KEYLESS_DIM_MM.joinerHalf), JS = L(KEYLESS_DIM_MM.joinerStop);
        const ends = axles.flatMap(([a0, a1]) => [a0, a1]).filter((z) => Math.abs(z - jz) < JH);
        if (ends.length !== 2 || ends.some((z) => Math.abs(z - jz) < JS - 1e-6) || !(Math.min(...ends) < jz && Math.max(...ends) > jz)) errs.push(`${ln.key}: the joiner does not hold one axle from each side short of its web`);
      }
      // every gear of both modules on the line is on this one body
      const gears = b.shafts.flatMap((s, i) => s.parts.filter((p) => p.teeth && mods.includes(p.module) && i !== ln.body && !s.idles && !s.clutch
        && Math.hypot(s.origin[0] - body.origin[0], s.origin[1] - body.origin[1]) < 1e-6).map(() => s.shaft));
      if (gears.length) errs.push(`${ln.key}: ${gears.join(', ')} stand on the line as other bodies`);
      for (const e of carriedErrs(body, ln)) errs.push(e);
    }
    return errs;
  };
  // CARRIED: every part keyed on a line body on one of its axles (an axle stops half an LDU short of the face it
  // is laid to, the library's trim)
  function carriedErrs(body, ln, axlesOf = (bd) => bd.parts.filter((p) => p.role === 'axle').map((p) => { const bx = C.boxOf(lib, p.part, p.m); return [bx.lo[2], bx.hi[2]]; })) {
    const out = [], ax = axlesOf(body);
    for (const p of body.parts.filter((q) => q.role !== 'axle' && q.role !== 'joiner')) {
      const bx = C.boxOf(lib, p.part, p.m);
      if (!ax.some(([a0, a1]) => a0 <= bx.lo[2] + 0.5 + 1e-6 && a1 >= bx.hi[2] - 0.5 - 1e-6)) out.push(`${ln.key}: ${p.module}'s ${p.role} ${p.part} is on no axle`);
    }
    return out;
  }
  for (const e of lineErrs(rest, lay)) fail(e);
  {
    // control: the joints laid as L1 laid them, each axle cut back to the bricks' far faces
    const cutBack = (bd, ln) => bd.parts.filter((p) => p.role === 'axle').map((p) => { const bx = C.boxOf(lib, p.part, p.m), lo = Math.min(...ln.spans.flat()) - bd.origin[2], hi = Math.max(...ln.spans.flat()) - bd.origin[2]; return [Math.max(bx.lo[2], lo + 0.5), Math.min(bx.hi[2], hi - 0.5)]; });
    const floats = rest.lines.flatMap((ln) => carriedErrs(rest.shafts[ln.body], ln, (bd) => cutBack(bd, ln)));
    control(`the joints cut back to the bricks' far faces leave a keyed part on no axle (${floats.length}: ${floats.slice(0, 2).join('; ')})`, floats.length > 0);
  }
  for (const ln of rest.lines) {
    const j = ln.joint;
    console.log(`  ${ln.key}: x ${mm(ln.x)} at ${mm(-ln.y)} mm, ${j.kind === 'axle' ? `one ${j.axles[0].lenStuds}L axle through both` : `${j.axles.map((a) => `${a.lenStuds}L`).join(' and ')} in a joiner, ${mm(j.joiner.engagement)} mm into its bore`} (gap ${mm(j.gap)} mm)`);
  }
  {
    // control: one module of a line an LDU across
    const ln = rest.lines[0], moved = { ...rest, statics: rest.statics.map((s) => (s.module === ln.b ? { ...s, m: [s.m[0] + 1, ...s.m.slice(1)] } : s)) };
    control(`the ${ln.b} moved an LDU across the ${ln.key} line`, lineErrs(moved, lay).some((e) => e.includes('off the line')));
  }

  lap('MESHES');
  // ── MESHES ─────────────────────────────────────────────────────────────────
  console.log('\nmeshes (every gear pair at its centre distance in one slab, interleaved):');
  const meshesOf = (b) => findMeshes(b);
  let worstMesh = 0, deepest = -Infinity;
  const deep = new Map();
  for (const [si, b] of builds.entries()) for (const m of meshesOf(b)) {
    worstMesh = Math.max(worstMesh, m.off); deepest = Math.max(deepest, m.depth);
    if (m.off > PHASE_TOL) fail(`${states[si].alarm}/${states[si].keyless}: ${m.a.module} ${m.a.teeth}T and ${m.b.module} ${m.b.teeth}T stand ${m.off.toFixed(4)} of a turn off mesh`);
    if (m.depth > MESH_DEPTH_MM) deep.set(`${m.a.module} ${m.a.part} ${m.a.teeth}T ⇄ ${m.b.module} ${m.b.part} ${m.b.teeth}T`, m.depth);
  }
  const restMeshes = meshesOf(rest);
  const byModule = {};
  for (const m of restMeshes) { const k = m.a.module === m.b.module ? m.a.module : `${m.a.module}⇄${m.b.module}`; byModule[k] = (byModule[k] ?? 0) + 1; }
  console.log(`  ${restMeshes.length} meshes at rest (${Object.entries(byModule).map(([k, n]) => `${k} ${n}`).join(', ')}); the worst over every state ${worstMesh.toExponential(1)} of a turn off mesh (≤ ${PHASE_TOL})`);
  // REPORTED, not gated: at the mesh the LDraw models' own teeth can stand in each other (a model's tooth is not a
  // module-1 involute); a pair in mesh by the condition above whose outlines still cross is the parts' own geometry
  console.log(`  tooth outlines, at mesh: the deepest ${deepest.toFixed(3)} mm${deep.size ? `; over ${MESH_DEPTH_MM} mm (the parts' own teeth, in every state): ${[...deep].map(([k, d]) => `${k} ${d.toFixed(3)}`).join('; ')}` : ''}`);
  // the ratios, read off the meshes: a graph of bodies, each edge −Na/Nb
  const ratioBetween = (b, from, to) => {
    const ms = meshesOf(b), q = [[from, 1]], seen = new Map([[from, 1]]);
    while (q.length) {
      const [u, r] = q.shift();
      for (const m of ms) {
        const [x, y] = m.a.body === u ? [m.a, m.b] : m.b.body === u ? [m.b, m.a] : [];
        if (!x || seen.has(y.body)) continue;
        const v = -r * x.teeth / y.teeth; seen.set(y.body, v); q.push([y.body, v]);
      }
    }
    return seen.get(to);
  };
  const bodyOf = (b, pred) => b.shafts.findIndex(pred);
  const great = bodyOf(rest, (s) => s.shaft === 'fusee/great');
  const escLine = rest.lines.find((l) => l.key === 'escape'), out = escLine ? escLine.body : -1;
  const wheel = bodyOf(rest, (s) => s.shaft === 'escapement/escape');
  if (great >= 0 && out >= 0 && wheel >= 0) {
    const r = ratioBetween(rest, great, out), rw = ratioBetween(rest, great, wheel);
    console.log(`  the going group: the fourth→escape output turns ${r?.toFixed(6)} per great-wheel turn (40/8 × 60 × 7.5 = 2250), the escape wheel ${rw?.toFixed(6)} (through the 1:1 transfer)`);
    if (!r || !near(Math.abs(r), 2250, 1e-6)) fail(`the going group's ratio is ${r}, not 2250`);
    if (!rw || !near(rw, -r, 1e-6)) fail(`the escape wheel turns ${rw} per great-wheel turn, not the output's ${r} through one 1:1 mesh`);
    // THE SENSE: the great wheel running its going sense in its own frame drives the escape wheel the way its
    // escapement escapes in its own (a module turned 180° sees its turns about z reversed)
    const s = (k) => (lay.placement[k].rot ? -1 : 1), g = goingSense(Mods.modules.fusee.frame), sense = Mods.modules.escapement.frame.spec.sense;
    const runs = Math.sign(rw) * s('fusee') * g, must = s('escapement') * sense;
    console.log(`  the sense: the great wheel runs ${g > 0 ? '+' : '−'} in the fusee's frame${lay.placement.fusee.rot ? ' (turned)' : ''}, the escape wheel ${runs * s('escapement') > 0 ? '+' : '−'} in the escapement's${lay.placement.escapement.rot ? ' (turned)' : ''}; it escapes ${sense > 0 ? '+' : '−'}`);
    if (runs !== must) fail('the train drives the escape wheel backwards');
    const flipped = { ...Object.fromEntries(Object.entries(lay.placement).map(([k, p]) => [k, [p.rot, p.tx, p.tz]])) };
    flipped.escapement = [1 - flipped.escapement[0], flipped.escapement[1], flipped.escapement[2]];
    control('the escapement turned the other way: the layout\'s judge finds the train driving it backwards', (C.layoutFrom(lib, Mods, flipped).findings ?? []).some((f) => f.includes('backwards')));
  } else fail('the going group\'s great wheel, output or escape wheel is not in the cell');
  const minute = rest.lines.find((l) => l.key === 'minute'), hourLine = rest.lines.find((l) => l.key === 'minute (adapted)') ?? minute;
  if (minute && hourLine) {
    const r = ratioBetween(rest, minute.body, hourLine.body);
    console.log(`  the minute group: the alarm's hour axle turns ${r} per minute-axle turn (1, the same way)`);
    if (minute.body !== hourLine.body && (!r || !near(r, 1, 1e-9))) fail(`the minute group's ratio is ${r}, not +1`);
  }
  {
    const ln = rest.lines[0], turned = { ...rest, shafts: rest.shafts.map((s, i) => (i === ln.body ? { ...s, phi: s.phi + Math.PI / 24 } : s)) };
    control(`the ${ln.key} line body turned half a 24T tooth`, meshesOf(turned).some((m) => m.off > PHASE_TOL && (m.a.body === ln.body || m.b.body === ln.body)));
  }

  lap('CLEAR');
  // ── CLEAR ──────────────────────────────────────────────────────────────────
  console.log('\nclear (every module from every other, every state):');
  const cache = new Map(), gapCache = new Map();
  const cloud = (p) => { const k = `${p.part}|${p.m.join(',')}`; if (!cache.has(k)) cache.set(k, placedCloud(lib, p, 0.5)); return cache.get(k); };
  const tagged = (b) => {
    const out = [];
    b.statics.forEach((s) => { if (s.role !== 'baseplate') out.push({ p: s, body: null, mod: s.module, moves: s.role === 'cord' || s.role === 'cordEnd' }); });
    b.shafts.forEach((s, bi) => placedParts({ ...b, statics: [], shafts: [s] }).forEach((p) => out.push({ p, body: bi, mod: p.module, moves: true, line: s.line })));
    return out;
  };
  const clearOf = (b, meshPairs) => {
    const all = tagged(b), errs = [], near2 = new Map(), boxNear = { g: Infinity, who: null };
    const meshKey = new Set(meshPairs.map((m) => `${m.a.body}.${m.a.idx}|${m.b.body}.${m.b.idx}`));
    // the line bricks a joint passes
    // a line's bricks: on its axis AND inside its own spans (two lines may share an
    // x and a height at different depths: the centre line and the adapter's output)
    const lineBrick = new Map(), onLine = (ln, w) => Math.hypot(w[0] - b.shafts[ln.body].origin[0], w[1] - b.shafts[ln.body].origin[1]) < LINE_TOL
      && w[2] >= Math.min(...ln.spans.flat()) - LINE_TOL && w[2] <= Math.max(...ln.spans.flat()) + LINE_TOL;
    for (const ln of b.lines) for (const s of b.statics) if (s.part === FRAME_PARTS.technicBrick1x1 && holeFaces(s).every((w) => onLine(ln, w))) lineBrick.set(s, ln.body);
    // a body IDLING on a line (the hour wheel on the minute axle: its bore round) bears on the line's axle
    const idler = new Map();
    for (const ln of b.lines) b.shafts.forEach((sh, bi) => { if ((sh.idles || sh.clutch) && onLine(ln, sh.origin.map((v, i) => (i === 2 ? (Math.min(...ln.spans.flat()) + Math.max(...ln.spans.flat())) / 2 : v)))) idler.set(bi, ln.body); });
    const partIdx = new Map();
    b.shafts.forEach((s, bi) => placedParts({ ...b, statics: [], shafts: [s] }).forEach((p, pi) => partIdx.set(p, pi)));
    for (let i = 0; i < all.length; i++) for (let j = i + 1; j < all.length; j++) {
      const A = all[i], B = all[j];
      if (A.body === null && B.body === null) continue;                     // statics: STANDING holds them
      if (A.body !== null && A.body === B.body) continue;                   // one rigid body
      const joint = A.mod === 'clock' || B.mod === 'clock';
      if (A.mod === B.mod && !joint) continue;                              // a module's own: its own probe
      // a joint's parts bear on their own line's bricks and on the line's own parts
      if (joint) {
        const J = A.mod === 'clock' ? A : B, O = J === A ? B : A;
        if (O.body === null && lineBrick.get(O.p) === J.body) continue;
        if (O.body !== null && idler.get(O.body) === J.body) continue;
      }
      // a line body's parts (both modules') against their own line's bricks
      if (A.body !== null && B.body === null && lineBrick.get(B.p) === A.body) continue;
      if (B.body !== null && A.body === null && lineBrick.get(A.p) === B.body) continue;
      // a meshing pair: MESHES holds it
      if (A.body !== null && B.body !== null && (meshKey.has(`${A.body}.${partIdx.get(A.p)}|${B.body}.${partIdx.get(B.p)}`) || meshKey.has(`${B.body}.${partIdx.get(B.p)}|${A.body}.${partIdx.get(A.p)}`))) continue;
      const ca = cloud(A.p), cb = cloud(B.p);
      const boxGap = Math.max(...[0, 1, 2].map((d) => Math.max(ca.lo[d] - cb.hi[d], cb.lo[d] - ca.hi[d], 0)));
      if (boxGap < boxNear.g) Object.assign(boxNear, { g: boxGap, who: `${A.mod} ${A.p.role} ${A.p.part} ⇄ ${B.mod} ${B.p.role} ${B.p.part}` });
      if (boxGap > CLEAR) continue;
      // the same two placements in another state: measured once
      const gk = `${A.p.part}|${A.p.m.join(',')}#${B.p.part}|${B.p.m.join(',')}`;
      if (!gapCache.has(gk)) gapCache.set(gk, cloudGap(ca, cb));
      const g = gapCache.get(gk), name = `${A.mod} ${A.p.role} ${A.p.part} ⇄ ${B.mod} ${B.p.role} ${B.p.part}`;
      if (g < (near2.get(name) ?? Infinity)) near2.set(name, g);
      if (g < CLEAR) errs.push(`${name} come ${mm(g)} mm apart`);
    }
    return { errs: [...new Set(errs)], near: [...near2].sort((a, c) => a[1] - c[1]).slice(0, 3).map(([n, d]) => `${n} ${mm(d)} mm`), boxNear };
  };
  for (const [si, b] of builds.entries()) {
    const c = clearOf(b, meshesOf(b));
    console.log(`  ${states[si].alarm}/${states[si].keyless}: ${c.errs.length ? `${c.errs.length} too close` : 'clear'}; measured: ${c.near.join('; ') || 'no pair within an LDU of its boxes'}; nearest boxes ${c.boxNear.who} ${mm(c.boxNear.g)} mm`);
    for (const e of c.errs) fail(`${states[si].alarm}/${states[si].keyless}: ${e}`);
  }
  {
    // control: a part of one module planted where a moving part of another
    // stands (the fusee's great wheel on the centre→fourth row's 40T): the tier
    // must measure the pair and find it in contact
    const target = rest.shafts.findIndex((sh) => sh.module === 'centre→fourth' && sh.parts.some((p) => p.teeth === 40));
    const tgt = rest.shafts[target], g40 = tgt.parts.find((p) => p.teeth === 40);
    const plant = { shaft: 'planted', module: 'fusee', origin: tgt.origin, phi: tgt.phi, speed: 0, parts: [{ ...g40, module: 'fusee', role: 'great' }] };
    const planted = { ...rest, shafts: [...rest.shafts, plant] };
    control('the fusee\'s great wheel planted on the centre→fourth row\'s 40T', clearOf(planted, meshesOf(rest)).errs.length > 0);
  }
  // ── THE FILE ───────────────────────────────────────────────────────────────
  const ldr = toLdr(rest), lines = ldr.split('\n').filter((l) => l.startsWith('1 ')), want = placedParts(rest);
  if (lines.length !== want.length) fail(`the .ldr has ${lines.length} parts, the build ${want.length}`);
  for (const [k, l] of lines.entries()) {
    const t = l.split(/\s+/), file = t[14];
    if (!lib.get(file)) { fail(`the .ldr names ${file}, which the pack does not hold`); break; }
    if (`${want[k].part}.dat` !== file || t.slice(2, 14).some((v, i) => Math.abs(Number(v) - want[k].m[i]) > 1e-4)) { fail(`the .ldr's line ${k + 1} is not the build's placement`); break; }
  }
  console.log(`\n  the .ldr: ${lines.length} parts, each a placement of the build, every file in the pack`);
}

console.log('\ncontrols:');
for (const [n, ok] of ctl) { console.log(`  ${ok ? 'caught' : 'NOT CAUGHT'}  ${n}`); if (!ok) fails++; }
console.log(fails ? `\n${fails} FAILED` : '\nthe clock stands on one base of baseplates, every line joined, each one keyed body through both modules\' bricks carrying every part keyed on it, every mesh interleaved, the train driving the escape wheel its own way, every module clear of every other in all nine states');
process.exit(fails ? 1 : 0);
