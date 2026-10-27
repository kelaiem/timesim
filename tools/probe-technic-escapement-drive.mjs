// IS THE ESCAPEMENT'S DRIVE SOUND: does a 1:1 transfer carry the going train onto
// the escape arbor past the back knife, and does the balance on that frame keep
// the beat? Acceptance, pure Node, no browser; exits non-zero on any failure.
// BUILT §312 landing L1b (src/technic-escapement.js: solveDrive, frameEscapement's
// `drive`, TECHNIC_BALANCE_DRIVE).
//
// MODELLED, NOT SIMULATED: geometry read off the vendored LDraw parts and the
// balance's period read off their solids, as tools/probe-technic-escapement.mjs
// reads the cell's. The drive is the CLOCK's variant (src/technic-clock.js builds
// it; the escapement cell on technic.html stays undriven), which is why it is held
// here and not in the cell's probe: the cell's probe is the escapement cell's judge
// for its parts list's substitutes (BUILT §309), and the drive's balance, one
// arrangement inside the band, would answer differently under a swapped pallet.
//
//   · THE PAIR — solveDrive answers the fewest-teeth 1:1 catalogue mesh at the
//     reach the back knife leaves (its span and a half stud, 12 mm): 12:12;
//   · THE FRAME — the transfer slab behind the mass gears and the escape
//     columns; the arbor carrying the transfer gear; the input axle from its
//     gear through both its columns, their holes at the arbor's height; the back
//     knife clear of the lengthened arbor; the input axle's corridor clear of the
//     back knife's parts, measured on the parts;
//   · THE MESH — in phase by the build's law, the tooth angles measured;
//   · THE BALANCE — solveBalance on the drive's frame answers TECHNIC_BALANCE_DRIVE
//     inside RATE_BAND (the cell's balance there, its crossbar 12L, is reported).
//
// CONTROLS, each seen to fail: an 8:8 transfer's reach; the input axle stood at
// 8 mm against the knife's parts; the input body turned half a tooth; the cell's
// balance on the drive's frame.
//
//   node tools/probe-technic-escapement-drive.mjs
import { bounds, LDU_MM } from '../src/ldraw.js';
import { loadPack } from './technic-pack.mjs';
import { CATALOGUES, catalogueMesh } from '../src/layout.js';
import { LEGO_DIM_MM as D } from '../src/technic-frame.js';
import { toothPhase } from '../src/technic-ldraw.js';
import * as X from '../src/technic-escapement.js';

const lib = loadPack();
const L = (mm) => mm / LDU_MM;
const B = (p) => bounds(lib, `${p}.dat`);
let fails = 0;
const fail = (msg) => { fails++; console.log(`  ✗ ${msg}`); };
const ctl = [];
const control = (name, caught) => { ctl.push([name, caught]); };
const near = (a, b, tol = 1e-4) => Math.abs(a - b) <= tol;
const E = X.ESC_DIM_MM, S = X.TECHNIC_ESCAPEMENT, BAL = X.TECHNIC_BALANCE;
const frame = X.frameEscapement();

console.log('THE LEGO ESCAPEMENT, DRIVEN — a 1:1 transfer past the back knife (MODELLED)');
{
  const dv = X.solveDrive(), BD = X.TECHNIC_BALANCE_DRIVE;
  if (!dv) fail('no drive solves');
  else {
    if (!near(dv.reach, E.knifeHalfSpan + Math.max(D.stud / 2, D.axleR + X.AX_CLEAR), 1e-9)) fail(`the drive's reach is ${dv.reach}`);
    if (!(dv.teeth === 12 && dv.part === '69778' && dv.cd === 12)) fail(`solveDrive answers ${dv.teeth}T (${dv.part}) at ${dv.cd} mm, the record says 12T (69778) at 12`);
    // the fewer-teeth pair it passes over falls inside the knife's corridor
    const cat = CATALOGUES.technic_classic, g8 = cat.counts.find((c) => c.teeth === 8), m8 = catalogueMesh(g8, g8, cat);
    control('an 8:8 transfer (8 mm across) puts the input axle inside the knife\'s reach', m8.cd < dv.reach);
    const fd = X.frameEscapement(S, BD, { drive: true });
    if (!fd.framed) fail(`the drive does not frame: ${fd.reason}`);
    else {
      const T = fd.drive.slab, sl = fd.slabs;
      if (T.y0 < Math.max(sl.Gb ? sl.Gb.y1 : sl.wheel.y1, fd.columns.find((c) => c.shaft === 'escape' && c.end === 'back').y + D.stud / 2) + X.AX_CLEAR - 1e-9) fail('the transfer slab is not behind the mass gears and the escape columns');
      if (fd.escAxle.y1 < T.y1 - 1e-9) fail('the escape arbor does not carry the transfer gear');
      if (!(fd.drive.axle.y0 <= T.y0 + 1e-9 && fd.drive.axle.y1 >= fd.drive.columns[1] + D.stud / 2 - 1e-9)) fail('the input axle does not run from its gear through both its columns');
      for (const c of fd.columns.filter((q) => q.shaft === 'drive')) if (!near(c.holeZ, fd.zE, 1e-9)) fail(`an input column's hole is at ${c.holeZ}, the arbor at ${fd.zE}`);
      const back = fd.columns.find((c) => c.shaft === 'knife' && c.end === 'back');
      if (back.y - E.knifeHalfLength < fd.escAxle.y1 + X.AX_CLEAR - 1e-9) fail('the back knife stands on the lengthened arbor');
      // the input axle's corridor against the back knife's parts, on the parts (LDraw boxes in the build)
      const bd = X.escapementBuild(fd, lib), inBody = bd.shafts.findIndex((q) => q.shaft === 'drive');
      const xI = bd.shafts[inBody].origin[0], zI = bd.shafts[inBody].origin[1], rI = L(D.axleR + X.AX_CLEAR);
      const knifeParts = bd.statics.filter((p) => p.role !== 'baseplate' && Math.abs(p.m[2] - L(back.y)) < 1e-6 && Math.abs(p.m[0] - L(back.x)) < 1e-6);
      if (knifeParts.length !== back.boxes.length) fail(`the back knife's column reads ${knifeParts.length} parts, its frame ${back.boxes.length}`);
      const gapOf = (pts) => Math.min(...pts.map((p) => { const b = B(p.part); const lo = p.m[0] + Math.min(b.lo[0], b.hi[0]), hi = p.m[0] + Math.max(b.lo[0], b.hi[0]); return Math.max(lo - xI, xI - hi); }));
      const gapKnife = gapOf(knifeParts);
      if (!(gapKnife >= rI - 1e-6)) fail(`the input axle's corridor reaches the back knife's parts (${(gapKnife * LDU_MM).toFixed(3)} mm off its line)`);
      control('the input axle stood at the 8:8\'s 8 mm reaches the back knife', gapOf(knifeParts.map((p) => ({ ...p, m: [p.m[0] + L(dv.cd - 8), ...p.m.slice(1)] }))) < rI);
      void zI;
      // the transfer mesh in phase (Na·A + Nb·(B − π) ≡ π, the tooth angles measured)
      const off = (sh) => {
        const m = bd.meshes[0], A = sh[m.a], Bb = sh[m.b], ga = A.parts[m.ga], gb = Bb.parts[m.gb];
        const toB = Math.atan2(Bb.origin[1] - A.origin[1], Bb.origin[0] - A.origin[0]);
        const tA = A.phi + toothPhase(lib, ga.part, ga.teeth).theta - toB, tB = Bb.phi + toothPhase(lib, gb.part, gb.teeth).theta - (toB + Math.PI);
        const r = ((ga.teeth * tA + gb.teeth * (tB - Math.PI) - Math.PI) / (2 * Math.PI)) % 1;
        return Math.min(Math.abs(r), 1 - Math.abs(r));
      };
      if (!(off(bd.shafts) < 1e-9)) fail(`the transfer mesh stands ${off(bd.shafts)} of a turn off`);
      control('the input body turned half a 12T tooth is off its mesh', off(bd.shafts.map((q, i) => (i === inBody ? { ...q, phi: q.phi + Math.PI / 12 } : q))) > 0.1);
      // the balance re-solved on the drive's frame
      const sd = X.solveBalance(lib, S, { drive: true }), bb = sd.best;
      const same = (a, c) => JSON.stringify([...a].sort()) === JSON.stringify([...c].sort());
      if (!(bb.massArm === BD.massArm && bb.bobArm === BD.bobArm && same(bb.masses, BD.masses) && same(bb.bob, BD.bob))) fail('solveBalance on the drive\'s frame answers otherwise than TECHNIC_BALANCE_DRIVE');
      const md = X.balanceMoments(lib, X.framedBalance(fd, lib)), mc = X.balanceMoments(lib, X.framedBalance(X.frameEscapement(S, BAL, { drive: true }), lib));
      if (!(Math.abs(md.T / X.BEAT_PERIOD_S - 1) <= X.RATE_BAND)) fail(`the drive's balance beats ${md.T} s, outside the band`);
      control('the cell\'s balance on the drive\'s frame (its crossbar 12L) is outside the band', !(Math.abs(mc.T / X.BEAT_PERIOD_S - 1) <= X.RATE_BAND));
      console.log(`\nDRIVE: ${dv.teeth}:${dv.teeth} (${dv.part}) at ${dv.cd} mm, the reach the back knife leaves (${dv.reach} mm); the transfer slab y ${T.y0}…${T.y1}, behind the mass gears; the arbor ${frame.escAxle.lenStuds}L → ${fd.escAxle.lenStuds}L, the back knife y ${frame.columns.find((c) => c.shaft === 'knife' && c.end === 'back').y} → ${back.y}, the crossbar ${frame.crossbar.lenStuds}L → ${fd.crossbar.lenStuds}L; the input axle at x ${fd.drive.x} mm, ${(gapKnife * LDU_MM).toFixed(2)} mm off the knife's parts, its columns at y ${fd.drive.columns.join(' and ')}, open behind; the mesh ${off(bd.shafts).toExponential(1)} of a turn off`);
      console.log(`  the balance on the drive's frame: TECHNIC_BALANCE would beat ${mc.T.toFixed(5)} s (${((mc.T / X.BEAT_PERIOD_S - 1) * 100).toFixed(3)}%, outside ${X.RATE_BAND * 100}%); re-solved, ${BD.massArm} with ${BD.masses.join(', ')} a side and a ${BD.bobArm} bob of ${BD.bob.join(', ')}: ${md.T.toFixed(5)} s (${((md.T / X.BEAT_PERIOD_S - 1) * 100).toFixed(3)}%), d ${md.d.toFixed(3)} mm — ${sd.inBand} arrangement${sd.inBand === 1 ? '' : 's'} inside the band`);
    }
  }
}

console.log('\ncontrols:');
for (const [name, caught] of ctl) { console.log(`  ${caught ? 'caught ' : 'MISSED '} ${name}`); if (!caught) fails++; }
console.log(fails ? `\n${fails} FAILED` : `\nthe going train reaches the escape arbor through a 1:1 transfer past the back knife, and the balance on that frame keeps the beat — controls ${ctl.length}/${ctl.length}`);
process.exit(fails ? 1 : 0);
