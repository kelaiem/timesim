// THE FORM CASE'S CASING-CLAMP HOLD, ITS LINE SPEC (TODO 300) — acceptance, a few seconds, no boot.
//
//   node --import ./tools/native/loader.mjs tools/probe-300-casing-clamp.mjs
//
// src/casing-clamp.js designs the hold IN A LINE: a back bore locating the plate's own cut outline at SEAT_FIT, a ledge
// bearing one land on the plate's dial face, the dial inside the ledge's lip, a notch per stem, and three dogs under
// casing screws tapped into the band. Every row is an offset from the plate's authored outline. This holds each row to
// the rule it was derived from, and each rule has a control that must fail:
//   S0  the geometry rules the pure module restates by value are geometry.js' own
//   S1  the back bore locates at SEAT_FIT, wall to real reach; CONTROL: today's bore (CASE_CLEAR) reads §186's boot
//       warning, 2.3061 against 0.08 (the fit law is the build's)
//   S2  the ledge bears one land on the plate's flat dial face; CONTROL: a lip at the outline bears nothing
//   S3  the dial passes inside the lip by CLEAR_MARGIN; CONTROL: the dial as cut today (the plate's outline) stands in it
//   S4  the band holds the clamp's thread with a pitch of wall each side; CONTROL: Ø0.8 and Ø1.0 mm do not fit the band
//   S5  each dog bears one land on the flat back face and clears the counted metal; CONTROL: the head alone clamps air
//   S6  on every alarm-free box kind at its committed fit (src/form-fits.js), the three loops (back bore, lip, dial) are
//       simple convex rings at exactly their offsets, measured off the authored shape; CONTROL: the dial at offset 0
//   S7  the dogs' stations clear the stem notch by notch + head + margin and their triangle holds the plate's centroid;
//       CONTROL: three dogs bunched on one side leave the centroid outside
//   S8  a fork of one input row re-derives the rest
// The stem's azimuth (159.89° about the plate's origin) is MEASURED off alarm=0&case=fitted's caseCrownTube; the fold
// reads the build's own.
import { solveClamp, CLAMP_INPUTS, GEOMETRY_RULES, arcTable, dogStations, containsPoint, loopCentroid } from '../src/casing-clamp.js';
import { CASE_CLEAR, CASE_BAND_T, STOCK_MIN_U, CLEAR_MARGIN, PLATE_RIM_MARGIN, UNIT_MM, formShapeOf } from '../src/layout.js';
import { FORM_FITS } from '../src/form-fits.js';
import * as G from '../src/geometry.js';

const fails = [];
const ok = (name, cond, detail = '') => { console.log(`${cond ? 'PASS' : 'FAIL'}  ${name}${detail ? ` — ${detail}` : ''}`); if (!cond) fails.push(name); };
const f = (v, n = 4) => (+v).toFixed(n), mm = (u) => `${f(u * UNIT_MM, 3)} mm`;
const C = solveClamp();
const STEM_AZ = 159.88686979418557 * Math.PI / 180;

ok('S0 the restated geometry rules are geometry.js\' own', GEOMETRY_RULES.PLATE_BEVEL_F === G.PLATE_BEVEL_F && GEOMETRY_RULES.SEAT_FIT === G.SEAT_FIT && GEOMETRY_RULES.TUBE_WALL === G.TUBE_WALL);

ok('S1 the back bore locates the plate at SEAT_FIT within its tenth (wall to real reach, on the 0.01 grid)', C.fit(C.boreBack) >= G.SEAT_FIT && C.fit(C.boreBack) - G.SEAT_FIT <= G.SEAT_FIT / 10,
  `bore at outline + ${f(C.boreBack)} u (bevel ${f(C.bevel)}), fit ${f(C.fit(C.boreBack))}, against today's ${f(CASE_CLEAR)}: the band comes in ${f(C.caseIn)} u (${mm(C.caseIn)}) a side`);
const today = C.fit(CASE_CLEAR);
ok('S1 control: today\'s bore reads §186\'s boot warning (2.3061 measured off the metal)', Math.abs(today - 2.3061) < 2e-3 && today > G.SEAT_FIT * 1.1, `fit ${f(today)} u`);

const bears = (lip) => -lip;   // the flat dial face runs to the authored outline; a lip at offset `lip` overlaps it by −lip
ok('S2 the ledge bears at least one land on the plate\'s flat dial face', bears(C.boreFront) >= STOCK_MIN_U,
  `lip at outline − ${f(-C.boreFront)}, ledge ${f(C.ledgeW)} u (${mm(C.ledgeW)}) wide`);
ok('S2 control: a lip at the outline bears nothing', !(bears(0) >= STOCK_MIN_U));

ok('S3 the dial passes inside the lip by more than CLEAR_MARGIN', C.boreFront - C.dial > CLEAR_MARGIN, `dial at outline − ${f(-C.dial)} u (${mm(-C.dial)}), ${f(C.boreFront - C.dial)} inside the lip`);
ok('S3 control: the dial cut to the plate\'s outline stands in the ledge', !(C.boreFront - 0 > CLEAR_MARGIN), `${f(-C.boreFront)} u into it`);

ok('S4 the screw\'s hole keeps a pitch of plate wall to the outline', -C.screw - C.D / 2 >= C.pitch - 1e-12, `axis ${f(-C.screw)} u inside, wall ${f(-C.screw - C.D / 2)} against ${f(C.pitch)}`);
ok('S4 the blind hole leaves a land of plate under it', C.holeFloor >= STOCK_MIN_U, `${f(C.holeFloor)} u under a ${f(C.eng)} u engagement`);
ok('S4 the head clears the counted metal (PLATE_RIM_MARGIN inside the edge)', C.marginClear(C.headIn) >= CLEAR_MARGIN, `head edge ${f(C.headIn)} u inside, ${f(C.marginClear(C.headIn))} clear`);
{ const axis = C.boreBack + C.pitch + C.D / 2, cb = axis + C.headD / 2 + G.SEAT_FIT;
  ok('S4 control: a screw tapped into the band (step 4\'s first reading) breaks its outer wall with the head\'s counterbore', cb > C.boreBack + CASE_BAND_T,
    `counterbore to outline + ${f(cb)} against the wall at ${f(C.boreBack + CASE_BAND_T)}`); }

ok('S5 the dog\'s tongue bears one land past the bore wall, its tip a fit off the groove\'s floor', C.dogTip - C.boreBack >= STOCK_MIN_U && Math.abs(C.boreBack + C.grooveD - C.dogTip - G.SEAT_FIT) < 1e-12,
  `reach ${f(C.dogReach)} u (${mm(C.dogReach)}) from the axis; groove ${f(C.grooveD)} deep, ${f(C.grooveW)} wide, ${f(C.bandLeft)} u of band behind it`);
ok('S5 the dog stowed for casing (turned inward) clears the counted metal', C.marginClear(-C.dogStow) >= CLEAR_MARGIN, `tip ${f(-C.dogStow)} u inside, ${f(C.marginClear(-C.dogStow))} clear`);
{ const tip = CASE_CLEAR + C.land, stow = -(C.screw - (tip - C.screw));
  ok('S5 control: a dog reaching today\'s bore (CASE_CLEAR) cannot be stowed clear of the counted metal', !(C.marginClear(stow) >= CLEAR_MARGIN), `stowed tip ${f(stow)} u inside against the ${f(PLATE_RIM_MARGIN)} margin`); }

// S6, S7 on the four alarm-free box kinds at their committed fits
const rows = Object.entries(FORM_FITS).map(([k, row]) => ({ kind: JSON.parse(k.slice(5)).spec.caseShape, row }));
ok('S6 every alarm-free box kind has a committed fit', ['cushion', 'fitted', 'rect', 'tonneau'].every((k) => rows.some((r) => r.kind === k)));
const warns = []; const cw = console.warn; console.warn = (m) => warns.push(String(m));
for (const { kind, row } of rows) {
  const shape = formShapeOf(kind, row);
  const loops = { back: shape.loop({ grow: C.boreBack }), lip: shape.loop({ grow: C.boreFront }), dial: shape.loop({ grow: C.dial }) };
  const offs = Object.fromEntries(Object.entries(loops).map(([n, L]) => { const d = L.map(([x, y]) => -shape.inset(x, y)); return [n, [Math.min(...d), Math.max(...d)]]; }));
  const want = { back: C.boreBack, lip: C.boreFront, dial: C.dial };
  // OFF_TOL: the cushion is a 1024-segment polyline whose inward offset runs along vertex normals, so a grown vertex errs
  // by the chord's sagitta, 1.8e-5 u at the dial's −0.47 (measured; 1.1e-4 at −3). The arcs and segments of the other
  // kinds offset to float noise. 1e-4 u is 0.04 µm, three orders under CLEAR_MARGIN.
  const OFF_TOL = 1e-4;
  const exact = Object.keys(want).every((n) => Math.abs(offs[n][0] - want[n]) < OFF_TOL && Math.abs(offs[n][1] - want[n]) < OFF_TOL);
  ok(`S6 ${kind}: back bore, lip and dial are rings at exactly their offsets`, exact && !warns.length,
    Object.keys(want).map((n) => `${n} ${f(offs[n][0], 6)}..${f(offs[n][1], 6)}`).join(', ') + (warns.length ? `; ${warns.join(' | ')}` : ''));
  const dial0 = shape.loop({ grow: 0 }), inLip = Math.max(...dial0.map(([x, y]) => -shape.inset(x, y))) - C.boreFront;
  ok(`S6 ${kind} control: the dial at the outline stands ${f(inLip)} into the lip`, !(inLip <= -CLEAR_MARGIN));
  // S7 the dogs, on the back bore's ring
  const T = arcTable(loops.back), notch = T.exitAt(STEM_AZ);
  const D = dogStations(loops.back, [notch], C.N), pts = D.stations.map(D.at), cen = loopCentroid(shape.loop({ grow: 0 }));
  ok(`S7 ${kind}: the dogs clear the stem notch by notch + head + margin`, D.near >= C.dogSpacing, `nearest ${f(D.near, 2)} against ${f(C.dogSpacing, 3)}, period ${f(D.period, 2)}`);
  ok(`S7 ${kind}: the dogs' triangle holds the plate's centroid`, containsPoint(pts, cen),
    `dogs at ${pts.map(([x, y]) => `(${f(x, 1)}, ${f(y, 1)})`).join(' ')}, centroid (${f(cen[0], 2)}, ${f(cen[1], 2)})`);
  const bunch = [0, 1, 2].map((j) => T.at(D.stations[0] + j * D.period / 6));
  ok(`S7 ${kind} control: three dogs bunched within a third of the period leave the centroid outside`, !containsPoint(bunch, cen));
  warns.length = 0;
}
console.warn = cw;

const F = solveClamp({ plateR_u: 50 });
ok('S8 a fork of the plate\'s radius re-derives every row from the same rules', Math.abs(F.boreBack - Math.ceil((50 * G.PLATE_BEVEL_F + G.SEAT_FIT) / 0.01 - 1e-9) * 0.01) < 1e-12
  && Math.abs(F.ledgeW - (F.boreBack + F.land)) < 1e-12 && Math.abs(F.caseIn - (CASE_CLEAR - F.boreBack)) < 1e-12 && F.boreBack > C.boreBack,
  `bore ${f(F.boreBack)}, ledge ${f(F.ledgeW)}, in ${f(F.caseIn)}`);
console.log(`\ninputs: ${Object.entries(CLAMP_INPUTS).map(([k, r]) => `${k} ${f(r.v)}`).join(', ')}`);
console.log(fails.length ? `\n${fails.length} FAILED: ${fails.join('; ')}` : '\nall PASS');
process.exit(fails.length ? 1 : 0);
