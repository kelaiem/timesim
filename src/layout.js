import { aesthetics } from './aesthetics.js';
// Mechanical Clock Simulation — LAYOUT SPEC (BUILT §13, step 1).
//
// The movement's geometry is genuinely parametric — barrel at the origin,
// everything stepped off it through real wheel radii — but for most of the
// project that parametricity lived tangled in `main.js`'s evaluation order:
// 6,400 lines of module-level `const` where a number could not be moved
// without knowing everything downstream of its line. §13 untangles that into
// a pure data module the builders CONSUME. This file is the first slice: the
// constants that were already pure — no `THREE`, no `scene`, no solved
// positions, just numbers DERIVED from constraints with the constraint in the
// comment. Everything here is exported as plain data; nothing here builds or
// mutates anything.
//
// Rule as this module grows: a value belongs here iff it can be computed from
// literals and other values in this file alone. The moment it needs a wheel's
// measured bounding box or a solved position it stays in `main.js` (for now —
// later steps of §13 pull the solve out too, into a `solveLayout(spec)` this
// file will host). The geometry fingerprint (`inspect.js`) guards the move: a
// pure relocation of these definitions must not change a single part's world
// position, so the hash is identical before and after.

// ---------------------------------------------------------------------------
// §22 — THE WATCH SPEC. Reserve and beat rate are KNOBS, not constants: two
// numbers a URL can set (`?reserveh=`, `?vph=`, read by index.html into
// `globalThis.__WATCH_SPEC` before any module loads — reload-tier, the §23
// subdial-size precedent) that everything below DERIVES from. The identity
// spec {30 h, 18,000 A/h} must reproduce the shipped movement bit-exactly:
// that is the regression gate, asserted by the geometry fingerprint.
//
// BEAT RATE IS A MENU, NOT A DIAL, and the menu is the honest part. The
// going train's tooth counts exist to make the fourth wheel turn once per
// minute at the chosen beat — change the beat without re-deriving the counts
// and the seconds hand lies, which is the class of shortcut this project
// exists to close. So each rate carries the fourth-wheel/escape-pinion pair
// that KEEPS fourth = 1 rev/min exactly, with the escape wheel (15 teeth,
// 24° pitch, BEAT_DEG 12) untouched:
//   fourth rev/hr = (vph/30 escape rev/hr) · (escPinion/fourthTeeth) = 60
//   ⇒ escPinion/fourthTeeth = 1800/vph — integer pairs only.
// The third mesh (fourth PINION on the third wheel) never changes, so the
// minute and hour hands are untouched by construction; only the
// fourth⇄escape mesh re-gears, and solveLayout absorbs the moved centre
// distances the way §13 built it to.
const RATE_TABLE = {
  18000: { fourthTeeth: 80, escPinion: 8 }, // 8/80 = 1/10 — the shipped movement
  21600: { fourthTeeth: 96, escPinion: 8 }, // 8/96 = 1/12
  28800: { fourthTeeth: 96, escPinion: 6 }, // 6/96 = 1/16
};
export const SPEC = (() => {
  const raw = (typeof globalThis !== 'undefined' && globalThis.__WATCH_SPEC) || {};
  const vph = RATE_TABLE[raw.vph] ? Number(raw.vph) : 18000;
  // Reserve clamped to what the STRUCTURE accepts: below ~12 h the fusee
  // loses its reason to exist; above 48 h the cone's groove stack (0.7 u per
  // turn, one turn per 8 h) grows past what the plate floor can absorb —
  // the three-quarter-plate boot assert is the backstop, this clamp is the
  // courtesy that keeps a typo from tripping it.
  // Snapped to a multiple of 3: the reserve indicator's second-stage wheel
  // takes 2h/3 teeth (TODO 18 — its ratio is derived from the scale, so the
  // spec must yield an integer wheel; see rsvTeethW2 in main.js), and a
  // tooth count is not a place for rounding error.
  const reserveHours = Number.isFinite(Number(raw.reserveHours))
    ? Math.min(48, Math.max(12, Math.round(Number(raw.reserveHours) / 3) * 3)) : 30;
  // §33 step 1 — the crown's azimuth (movement-frame world degrees of the
  // stem line; the UI speaks dial-clock and translates). null = as
  // designed: the identity spec must not even ROTATE BY ZERO — the solve
  // skips the transform entirely so identity stays bit-exact.
  const crownAzDeg = Number.isFinite(Number(raw.crownAzDeg))
    ? ((Number(raw.crownAzDeg) % 360) + 360) % 360 : null;
  // §33 step 3 — the going train's ARRANGEMENT angles as specs. These are
  // solveLayout's own inputs (they always were the arrangement's degrees
  // of freedom; step 3 only hands the viewer the knobs): the barrel's
  // step about the centre, the escape's about the fourth, the balance's
  // TARGET about the escape (the solver still owns the feasible angle —
  // a target it must move off is a warning, live and at boot). null = as
  // designed: the argument is not even passed, so identity stays on the
  // default constants bit-exactly.
  const stepDeg = (v) => Number.isFinite(Number(v)) ? Math.max(-180, Math.min(180, Number(v))) : null;
  const barrelStepDeg = stepDeg(raw.barrelStepDeg);
  const escapeStepDeg = stepDeg(raw.escapeStepDeg);
  const balanceStepDeg = stepDeg(raw.balanceStepDeg);
  // §33 step 2 — THE STEM DECOUPLED: the stem line's own azimuth (world
  // degrees), independent of the barrel. null = as designed: the stem
  // derives from the barrel's azimuth exactly as §13 built it, bit-exact.
  const stemAzDeg = Number.isFinite(Number(raw.stemAzDeg))
    ? ((Number(raw.stemAzDeg) % 360) + 360) % 360 : null;
  // §33 (alarm crown handle) — the ALARM corner's azimuth (movement-frame
  // world degrees, like crownAzDeg). null = as designed: the corner keeps
  // its solved two-candidate choice and its exact literals.
  const alarmAzDeg = Number.isFinite(Number(raw.alarmAzDeg))
    ? ((Number(raw.alarmAzDeg) % 360) + 360) % 360 : null;
  // §33 (pusher handle) — the ALARM MODULE's azimuth (world degrees): the
  // striking wheel's station, from which the whole alarm work — gong,
  // hammer, striker, barrel, lock, column, pawl, pusher — is seeded. null =
  // as designed (160°). This RETIRED ?pushaz=: an independent press axis
  // could park the pusher's chain inside the movement while the toggle it
  // drives stayed at the corner; the pusher is the module's grip, not its
  // own part, so the handle moves the module.
  const alarmModAzDeg = Number.isFinite(Number(raw.alarmModAzDeg))
    ? ((Number(raw.alarmModAzDeg) % 360) + 360) % 360 : null;
  return Object.freeze({ vph, reserveHours, crownAzDeg, barrelStepDeg, escapeStepDeg, balanceStepDeg, alarmAzDeg, alarmModAzDeg, stemAzDeg });
})();
export const SPEC_RATES = Object.freeze(Object.keys(RATE_TABLE).map(Number));

// ---------------------------------------------------------------------------
// Kinematic constants (see SPEC.md "Gear train" + "Escapement behavior")
// ---------------------------------------------------------------------------
export const F_BALANCE = SPEC.vph / 7200; // Hz — balance frequency: vph/3600 beats/s, 2 beats per oscillation
export const BEAT_DEG = 12;             // escape-wheel advance per beat (half of 24° tooth pitch)
export const AMPLITUDE_TRUE_DEG = 270;  // "true" balance swing (physical reference, unused for mesh)
export const AMPLITUDE_VISUAL_DEG = 45; // scaled-down, readable swing actually applied to the mesh
export const IMPULSE_WIDTH = 0.16;      // fraction of a beat spent in unlock+impulse (rest = locked)
export const RECOIL_FRACTION = 0.25;    // portion of the impulse window spent on the recoil/draw dip
export const RECOIL_DEG = 1.0;          // escape wheel recoil during draw
// FORK_BANK_DEG / FORK_RECOIL_DEG are DERIVED in main.js (after the pallet
// fork and balance geometry exist), from rollerR and the notch's actual
// reach — see that derivation for why they can't be picked independently of
// the balance's roller radius without the impulse pin missing the notch. They
// are NOT pure, so they stay there.

// ---------------------------------------------------------------------------
// Z-stack — the depth budget between the back plate (z≈0) and the cocks. Each
// arbor's PINION sits at the layer where it meshes with the PREVIOUS wheel;
// its own WHEEL sits one layer further along, where the NEXT pinion meshes it.
// TORNADO Z-stack — compressed to a 1.7-unit wheel stride (the old uniform
// 3-unit staircase was half air). The three offsets expressed as formulas
// are real mechanical constraints, not styling:
//  · L_FORK = L_ESCAPE + 1.5 — the fork body's underside just clears the
//    escape wheel's top face while the stones (stoneZReach below) straddle
//    the tooth band;
//  · L_BALANCE — the balance now sits IN the three-quarter plate's z-band
//    (the classic Glashütte elevation: rim level with the plate, swinging in
//    the cutaway), derived below so its rim's underside binds exactly one
//    CLEAR_MARGIN above the fork body's top face;
//  · L_HAIRSPRING and the flat balance cock ride the balance.
// Stride 2.1 is the floor set by the BRIDGES, not the wheels: each cock is
// a centred slab ±(width·0.2 + bevel) thick, and it must fit between its
// own wheel pair's planes and the next wheel up that crosses it (solved:
// feasible only for stride ≥ ~2.06 at the current cock widths).
// ---------------------------------------------------------------------------
// §39 — the unit→mm mapping. PINNED, not chosen.
//
// The tempting definition is "pick the scale that puts the case under 40 mm".
// That is circular: it makes the size target true by construction and tests
// nothing. Instead the scale is pinned to the one dimension in this movement
// that is a MANUFACTURED STANDARD rather than a style choice — fusee chain
// pitch, whose tolerance is narrow because it has to run in a groove cut to
// match.
//
// The reference chain: A. Lange & Söhne cal. L044.1 (Richard Lange Pour le
// Mérite), the modern manufactured fusee-and-chain WRISTWATCH movement —
// 31.6 mm, i.e. the same class of movement as this one. Its chain is 212
// links over 152 mm → 0.72 mm rivet-to-rivet, 0.50 mm wide, 0.25 mm thick.
// (The entry originally pinned to "~0.30 mm pitch"; that figure was wrong —
// it sits in the WIDTH band of small chains, not any pitch. Pocket-watch
// chains are coarser still: ~0.36 mm thick × 0.8 mm tall sections.)
//
// The drawn pitch below converts the real 0.72 mm through §2's mapping study,
// which proposed ~0.38 mm/unit BY EYE from overall proportions, independent
// of any chain: 0.72 / 0.38 = 1.9 u. The pin then lands UNIT_MM at 0.379 —
// the two methods agreeing to 0.3% is the argument for the number.
//
// Everything else about the movement's real size is then a PREDICTION, and is
// asserted as one at the end of the build. Those asserts are allowed to fail;
// that is the whole point of deriving the scale from something else first.
// (Plate: 85.85 u → 32.5 mm. The reference movement carrying the same chain
// is 31.6 mm — a 3% cross-check the old 0.30 mm pin failed by 2.4×: with the
// chain drawn at true proportion it predicted a 77 mm plate.)
export const CHAIN_PITCH = 1.9;        // units, rivet-to-rivet (geometry — 0.72 mm at §2's 0.38 mm/u)
export const CHAIN_PITCH_MM = 0.72;    // REAL fusee chain — the manufactured standard this pins to
export const UNIT_MM = CHAIN_PITCH_MM / CHAIN_PITCH;   // 0.379 mm per unit
export const MM = (units) => units * UNIT_MM;          // for readouts and asserts
// The chain's CROSS-SECTION, from the same reference chain through UNIT_MM
// (real mm in each comment). Lives here with the pitch — the fusee cone's
// groove pitch and base seat consume the stack height long before the chain
// itself is built, and stock that sets the movement's scale should not be
// scattered as literals at its point of use.
export const CHAIN_PIN_LEN = 0.66;     // 0.250 mm — the joint's plate stack (4 leaves), = pin length
export const CHAIN_LEAF_GAP = 0.02;    // render shim between leaves: shows the rivet, avoids z-fighting
// One plate leaf. The real stack is 4 solid leaves of ~0.06 mm; drawn with
// the two shims per half-stack folded out: (0.66/2 − 2·0.02)/2 = 0.145 u
// (0.055 mm).
export const CHAIN_PLATE_T = (CHAIN_PIN_LEN / 2 - 2 * CHAIN_LEAF_GAP) / 2;
export const CHAIN_END_R_OUT = 0.66;   // outer plate half-width: 2·0.66 u = 0.50 mm real width
export const CHAIN_END_R_IN = 0.575;   // inner plate steps in by the same 0.87 the shipped chain drew
export const CHAIN_PIN_R = 0.27;       // rivet: 0.54 u dia = 0.29·pitch, the roller-chain proportion (0.20 mm)
// THE RIVETED JOINT (TODO 27 rows 2 and 3). The pin passes through four
// drilled leaves and is upset at each end; all three numbers below are that
// sentence made buildable.
//
// The joint's running fit. The inner pair TURNS on the pin — that is what a
// chain joint is — so its bore is one running clearance over the pin: 0.01 mm
// diametral, the shake a real watch pivot runs in its jewel, at this pin's
// 0.20 mm diameter. Half of it, radially:
export const CHAIN_RIVET_FIT = 0.005 / UNIT_MM;   // 0.013 u
// The head. Formed rivet heads run 1.5x the shank across, in this movement as
// in every other riveted thing; at the outer leaf's 0.66 half-width that
// leaves 0.255 u (0.097 mm) of plate around the recess, which is why the
// proportion is affordable here at all.
export const CHAIN_RIVET_HEAD_R = CHAIN_PIN_R * 1.5;   // 0.405 u — 0.31 mm across
// ...and the head is formed INSIDE the outer leaf, not proud of it. That is
// forced, not chosen: the fusee's groove land is 0.025 u over its 0.02 crest
// floor (FUSEE_LAND_W in main.js), which is 0.005 u of extra chain width the
// movement can afford — 0.0025 a side — and the drum's coils lie only 0.03
// apart (CHAIN_COIL_PITCH below). No head worth forming fits in that. A rivet
// that may
// not stand proud is countersunk: the outer leaf is counterbored at the head
// diameter and the pin upset into the recess, flush with the face. Depth
// splits the outer leaf in half, so the formed head and the land it bears on
// are the same thickness and neither is the joint's weaker member.
export const CHAIN_RIVET_HEAD_T = CHAIN_PLATE_T / 2;   // 0.072 u — 0.027 mm
// Successive coil turns on the drum lay one stack apart plus a lay gap so
// they never bind — the gap is the 0.03 the shipped 0.65-over-0.62 implied.
export const CHAIN_COIL_PITCH = CHAIN_PIN_LEN + 0.03;
// §50/TODO 12: the wheel-and-plate stock floor, in UNITS, so a thickness can
// be built to clear it rather than measured against it after the fact.
export const STOCK_MIN_U = 0.12 / UNIT_MM;             // 0.317 u
// §54's slenderness ceiling, L/t. Lives HERE rather than in inspect.js so the
// GEOMETRY can be derived from the same number the CHECK enforces — a part
// sized against the check that measures it cannot drift away from it.
export const SLENDER_MAX = 30;
// What to BUILD to. Sizing a part at exactly `SLENDER_MAX` puts it on the
// boundary, where float rounding decides which side it lands — the beak tail
// came back at λ 30.0 and was still reported. That is `JMP_BIND_EPS`'s lesson
// in a new place: never build exactly to the limit a check compares against.
// 10% headroom, so a part that drifts slightly still passes and one that
// drifts a lot still fails.
export const SLENDER_TARGET = SLENDER_MAX * 0.9;      // 27
// FLAT-SPRING stock. §50's spring floor is 0.03 mm and its own basis says why
// that is a floor and not a target: "real hairsprings run 0.02-0.04 mm; flat
// springs THICKER". A click detent or a feeler return is a flat blade, not a
// hairspring, so it is sized at 0.05 mm — the low end of real flat-spring
// stock, clearing the floor on merit rather than grazing it.
export const SPRING_FLAT_U = 0.05 / UNIT_MM;          // 0.132 u
// §50's PIVOT floor, in units, beside the wheel floor for the same reason:
// pin and post stock should be CUT to it, not measured against it afterwards.
// Basis is the check's own — "real train pivots run 0.07-0.12 mm".
export const PIVOT_MIN_U = 0.07 / UNIT_MM;            // 0.185 u
// A ROUND BAR'S RADIUS, so that its FLATS carry a thickness floor.
//
// §50's census reads the TESSELLATED stock: a bar drawn with `n` radial
// segments is an n-gon, and its geometry-local box measures the flats
// (2·r·cos(π/n)), not the circumcircle. That is a deliberate reading, not a
// ruler bug — the mesh is what every other instrument collides against too —
// so a bar that must clear a floor has to clear it ACROSS THE FLATS. At the
// n = 10 this movement's posts and pins are drawn with, the difference is
// 4.9%: a nominal ⌀ 0.12 mm bar measures 0.114 and lands in the debt.
//
// `ALARM_A_PIN_R` was the first constant derived this way (§45's tail pin,
// against the pivot floor) and wrote the rule out longhand; this is that
// derivation named once so the next bar does not re-litigate it.
export const flatsR = (thicknessU, segments) => (thicknessU / 2) / Math.cos(Math.PI / segments);
export const STOCK_MIN_R10 = flatsR(STOCK_MIN_U, 10);  // 0.167 u — ⌀ 0.12 mm across the flats

export const CLEAR_MARGIN = 0.15; // ONE structural margin — shared by the plate
                                  // z-stack and the hack solvers, and by
                                  // the balance plane derivation itself.
// RESTRIDDEN STACK — solved BOTTOM-UP from the low-escapement layout: the
// oscillator hangs under the open plate cutaway, and the plate's own floor
// binds on the hairspring stack (the fusee was dropped to make that true —
// see FUSEE_BASE_Z). Chain, with the slim balance: L_FORK/L_ESCAPE 4.5 →
// L_BALANCE ≈ 5.94 → spring top ≈ 7.56 → cock underside = plate floor
// ≈ 7.71 (wheels that XY-overlap must never share z; each step is
// half-thickness sums + the one margin).
export const L_BARREL = 2;     // great-wheel plane (meshes center pinion) — fixed: drum/fusee/chain ride this side
// Center wheel dropped onto its own bind: one margin over the great wheel's
// top face, at the wheel's deepest feature (its hub ring, thickness·1.5/2 =
// 0.75 below the mid-plane). The old 4.85 carried ~1.2 of slack left over
// from the nest-under-the-escape era — slack the fusee now needs: the
// chain's lowest span must clear THIS wheel's top face, and every 0.1 here
// is 0.1 the cone (and with it the whole plate stack) cannot drop.
export const L_CENTER = (L_BARREL + 0.7 + 0.08) + CLEAR_MARGIN + 0.75;
export const L_THIRD = 5.95;   // = L_FOURTH − (fourth 0.4 + margin + third 0.45)
export const L_FOURTH = 6.95;
// ESCAPE WHEEL BELOW THE FOURTH WHEEL — the low-escapement layout: the
// wheel drops under the whole train while its pinion stays up in the
// fourth wheel's plane (the arbor spans the gap). The ceiling is the
// fourth arbor's PINION, which meshes the third wheel at L_THIRD and
// spans 5.15..6.75: escape wheel top (L + 0.4) stays 0.25 under it.
// Below, its own neighbourhood is clear: the nearest train discs
// (center, third) are 19+ away in XY, and the fourth arbor is bare
// staff at this depth.
export const L_ESCAPE = 4.5;
export const FORK_T = 1.2;     // pallet-fork body thickness (= makePalletFork's `thickness`)
// FORK INLINE WITH THE WHEEL: one shared plane, the way a real lever
// escapement is built — the stones engage in the fork's own z-band
// (stoneZReach = 0) instead of reaching down 1.5. The fork's outline
// clears the wheel disc everywhere except the stones (arms straddle
// outside the rim; the belly stays a full radius below it), so
// coplanarity costs nothing laterally and buys the whole stone reach
// in depth — which the balance, spring and cock all inherit.
export const L_FORK = L_ESCAPE;
export const BAL_T = 2.5;              // balance thickness (= makeBalanceWheel's `thickness`)
export const RIM_H = BAL_T * 0.55;     // rim height — mirrors makeBalanceWheel's 0.55·t rim
// Balance mid-plane: fork body top (L_FORK + FORK_T/2) + margin + half the
// rim's own height. The rim's underside is the balance's deepest full-ring
// face, so this is the lowest the wheel can sit without fouling the fork.
// With the low escapement it lands FAR BELOW the plate band — the whole
// oscillator now lives in open air under the plate's cutaway.
export const L_BALANCE = L_FORK + FORK_T / 2 + CLEAR_MARGIN + RIM_H / 2;
// Impulse-pin world mid-plane — inside the fork's z-band, VERIFIED by the
// collision audit; it is pinned to the FORK, not the balance, and must not
// move when L_BALANCE does. makeBalanceWheel takes the wheel-centre→pin
// distance as `pinDrop` so the caller can hold this plane exactly.
export const PIN_PLANE_Z = L_FORK - 0.5;
export const L_HAIRSPRING = L_BALANCE + 1.2;
export const HAIRSPRING_H = 0.6;   // makeHairspring height (its stud/terminal top out ≈0.7·H above mid-plane)
// BALANCE COCK: a LOW bridge riding one margin over the hairspring
// stack, wherever that stack lands — with the low escapement that is
// ~4 under the three-quarter plate's band, so the cock (and the
// free-sprung dress on its face) stands entirely clear of the plate: no
// nesting, no shared band, no collision. The plate keeps its cutaway
// purely for the view of the oscillator below.
export const COCK_T = 0.8;
export const SPRING_TOP_Z = L_HAIRSPRING + HAIRSPRING_H * 0.7; // stud (0.6·H), terminal (0.55·H + ribbon)
export const COCK_SLAB_BOT = SPRING_TOP_Z + CLEAR_MARGIN;
export const COCK_SLAB_TOP = COCK_SLAB_BOT + COCK_T;
export const COCK_MID_Z = COCK_SLAB_BOT + COCK_T / 2;
// Dial plane (watch front, −z side). Part of the same depth budget: the
// motion-works crossing (Z_SETTING), reserve train (Z_RSV) and cannon pinion
// all pack between the plate's back face (−2) and this.
// §51 phase B: −7 → −7.5. The dial-side band grows half a unit to fund the
// strata re-spends the plate gap could not (selector sheet, disc body and
// fingers, the feeler slices, both springs — all measured z-thin). Assembly
// depth grows ≈ 0.19 mm, inside §39's asserted 2.5–12 envelope; the §2
// shared-budget position is recorded in the roadmap entry. Every
// dial↔movement coupling is tripwired, and this edit is deliberately made
// ALONE first so the tripwire list measures the real blast radius.
// §45 stage 0: −7.5 → −8.40. The alarm-release CAM SLEEVE's band (sleeve
// envelope 0.742 + one margin — arithmetic and agreement tripwire in
// main.js's §29/§45 chain block) is funded HERE, not out of the plate-side
// end gap: the chain below the heart grows by the same amount, so every
// member below the insertion keeps its solved world plane and the landing
// assert is untouched. 0.90 is the spend 0.8915 rounded up to the 0.01
// grid; the ≤0.009 residue rides the end gap. Assembly depth grows
// ≈ 0.34 mm, still inside §39's asserted 2.5–12 mm envelope.
// TODO 26 — Z_DIAL is the dial's BACK FACE, and every dial-side work stands
// off it (cannon pinion, jumper lifter, the alarm setting plane and band, the
// dial feet). It kept that job when the dial gained thickness, which is why
// giving the dial substance moved nothing behind it: the plate grows FORWARD,
// toward the viewer, out of z the movement did not previously spend.
export const Z_DIAL = -8.4;
// The dial as MATTER. Real watch dials are brass sheet ~0.35–0.5 mm; 0.4 mm is
// mid-stock and the figure §50's own citations use for plate-like sheet. In
// §39's pin that is 0.4 / 0.379 = 1.06 units. The floor under it: a dial must
// be at least as thick as the sub-dial recess it carries (SUBDIAL_RECESS 0.5),
// or the wells punch through its back — which is precisely the defect TODO 26
// filed, a recess drawn as a protrusion because the sheet had no thickness to
// sink into.
export const DIAL_T = 0.4 / UNIT_MM;   // 1.056 u — 0.4 mm of brass
export const Z_DIAL_FACE = Z_DIAL - DIAL_T;  // the VISIBLE face, one plate forward
// TODO 26's second remaining row: the dial's thickness was ONE NUMBER, and a
// turned plate's is a profile. The profile a dial plate really carries at its
// rim is the EDGE BREAK — the chamfer that takes the arris off a turned brass
// edge — not a taper: a dial is parallel-faced over its field (the stepped and
// sector dials that are thinner in places are a STYLE, and this dial's raised
// chapter ring is applied, which is the other real way to get that look).
// 0.05 mm is the light break used on thin sheet (0.05–0.1 typical). Its
// ceiling is the stock itself: the break is taken off BOTH faces, so 2× must
// leave the rim a straight land — 0.4 − 2×0.05 = 0.30 mm, 75% of stock, and
// makeDial boot-asserts the rule rather than the number.
export const DIAL_EDGE_BREAK = 0.05 / UNIT_MM;  // 0.132 u
// KEYLESS PLANE — the stem/clutch/setting-wheel plane, on the DIAL SIDE of
// the base plate as in a real watch (it used to ride atop the barrel on the
// movement side). Bracketed by two binds and set mid-band:
//  · ceiling: the sliding pinion's axis lies ALONG the stem, so its z-reach
//    is its outer RADIUS (pitch 1.36 + addendum ≈ 1.79); that stack must
//    clear the plate's flat underside (−2) by CLEAR_MARGIN →
//    Z_KEYLESS ≤ −2 − 0.15 − 1.79 = −3.94.
//  · floor: the yoke rides below the plane (its arm passes under the
//    sliding pinion's hub collars, r 1.2) and its pivot boss must clear the
//    dial face (Z_DIAL) by the margin → Z_KEYLESS ≥ −7 + 0.15 + 0.75
//    (boss half) + 1.91 (yoke drop, see Z_YOKE) = −4.19.
export const Z_KEYLESS = -4.1;

// ---------------------------------------------------------------------------
// Train ratios — the "ratios" third of the eventual solveLayout output. Tooth
// counts and modules per mesh: pure literals, the single source §22 (custom
// beat rate) needs to re-derive counts. The going train's counts exist to make
// the FOURTH wheel turn once per minute at F_BALANCE, so a different beat means
// re-solving THESE, not editing an angle somewhere downstream — which is the
// whole reason they want to live together as data. (SPEC.md's gear table is
// the prose version of this object.)
//
// Each entry is one MESH: a wheel of `teeth` driving a pinion of `pinion`
// teeth at `module` (the arrow in the comment). §13 step 3c retired the old
// flat names (barrelTeeth … fourthTeeth) and folded the pinion counts in —
// they used to be magic 10s and an 8 repeated in BOTH the pinion builders
// and tick()'s ratio chain; now builders and kinematics read this one table,
// so a ratio literally cannot disagree with the geometry that carries it.
export const TRAIN = {
  barrel: { module: 0.36, teeth: 80, pinion: 10 }, // great wheel → center pinion
  center: { module: 0.30, teeth: 75, pinion: 10 }, // center wheel → third pinion
  third:  { module: 0.24, teeth: 80, pinion: 10 }, // third wheel → fourth pinion
  // fourth wheel → escape pinion: the ONE mesh the beat-rate spec re-gears
  // (§22, table above) — every other count is beat-independent.
  fourth: { module: 0.21, teeth: RATE_TABLE[SPEC.vph].fourthTeeth, pinion: RATE_TABLE[SPEC.vph].escPinion },
};

// Keyless works + winding path (the SETTING side, not the going train).
export const KW_MODULE = 0.34;
export const crownWheelTeeth = 20, windPinionTeeth = 8, settingWheelTeeth = 20;
export const minuteWheelTeeth = 24, minutePinionTeeth = 8;
export const WIND_SPUR_TEETH = 24;

// Motion works — the 12:1 hour reduction. cannon → minute wheel, then minute
// pinion → hour wheel; the ratio falls out of the counts (see main.js), it is
// not asserted.
export const cannonPinionTeeth = 10;
export const MW_MODULE_1 = 0.3;                                 // cannon ⇄ minute wheel
export const MW_MINUTE_TEETH = 30, MW_PINION_TEETH = 8, MW_HOUR_TEETH = 32;

// The CO-AXIAL CENTRE STACK, and the dial bore it needs (§25 C's rattrapante
// arrangement: cannon pinion → hour tube → alarm tube, three members turning
// about one axis). Hoisted here from main.js because the solve below now
// depends on the outermost member: the sub-dial wells' inboard ceiling is the
// clearance this bore needs, so the two must not be able to drift apart.
// main.js imports these rather than recomputing them, and asserts the bore
// against the tube it is cut for.
export const HOUR_TUBE_INNER = (MW_MODULE_1 * cannonPinionTeeth) / 2 + MW_MODULE_1 + 0.25;
export const HOUR_TUBE_OUTER = HOUR_TUBE_INNER + 0.45;   // 0.45 wall
export const ALARM_TUBE_INNER = HOUR_TUBE_OUTER + 0.1;   // 0.1 running clearance on the hour tube (its bearing)
export const ALARM_TUBE_OUTER = ALARM_TUBE_INNER + 0.4;  // 0.4 wall
export const DIAL_CENTER_BORE_R = ALARM_TUBE_OUTER + 0.2; // the stack's outermost member passes with running clearance
// One wall thickness, shared by the dial's bore and its sub-dial pockets —
// the same 0.2 §25 C's well/setting-wheel form used, kept as one name so the
// two ceilings cannot disagree about how much brass a wall is.
export const DIAL_WALL_HALF = 0.2;
// The sub-dial wells' INBOARD ceiling: how close a well's ring may come to
// the dial centre. See the derivation at the subDialR solve below — this is
// the bore, plus a wall, plus the one structural margin.
export const SUBDIAL_INBOARD_CLEAR = DIAL_CENTER_BORE_R + DIAL_WALL_HALF + CLEAR_MARGIN;

// ---------------------------------------------------------------------------
// Planar layout inputs — the "positions" the tornado solve steps off. These
// are the pure ANGLES and one distance that decide where each arbor lands;
// the solve that consumes them (stepPos / the two-bar third-wheel solve /
// shift) is still interleaved in main.js and comes out in step 3. Editing one
// of these is how "move the crown to 3 o'clock" will eventually be a one-line
// change — once the solve reads a spec instead of module scope.
export const BARREL_STEP_DEG = -35;        // center sits down-right of barrel → barrel/crown exit viewed ~1:50
export const D4 = 15.5;                     // centre → fourth distance (small-seconds pivot radius, ≈0.39·dialRadius)
export const ESCAPE_STEP_DEG = -57.9;      // escape at viewed ~6:25
export const BALANCE_STEP_TARGET_DEG = 44.6; // balance at viewed ~8:00 — a TARGET; the feasible angle is solved in main.js

// ---------------------------------------------------------------------------
// solveLayout (§13 step 3) — the tornado solve as a PURE FUNCTION. Everything
// the solve consumes arrives as an argument: the walk angles and D4 (the
// spec), the mesh centre-distances (pitch-radius sums), and — crucially — the
// SWEPT RADII the balance-clearance solve binds on. Those are measured from
// the built meshes by the CALLER (vertex max: bevels and screw-tip corners
// are real, boxes over-report — the shipped lesson), because measuring is
// main.js's job and purity here means "same inputs, same outputs", not
// "pretends geometry doesn't exist". Called twice with different specs in
// one process, it returns two independent layouts — which is the §13
// regression suite: the current spec must reproduce the fingerprint
// baseline's positions exactly.
//
// Returns { P, BALANCE_STEP_DEG, forkBaseAngle, PIN_AIM } — the shifted
// position table and the three byproducts the build consumes downstream.
// Every expression is ported VERBATIM from the in-line solve so the
// floating-point sequence (and therefore the geometry fingerprint) is
// bit-identical.
export function stepPos(prev, angleDeg, dist) {
  const a = angleDeg * (Math.PI / 180);
  return { x: prev.x + Math.cos(a) * dist, y: prev.y + Math.sin(a) * dist };
}

export function solveLayout({
  barrelStepDeg = BARREL_STEP_DEG,
  d4 = D4,
  escapeStepDeg = ESCAPE_STEP_DEG,
  balanceStepTargetDeg = BALANCE_STEP_TARGET_DEG,
  radii,          // { barrel, centerPinion, centerWheel, thirdPinion, thirdWheel, fourthPinion, fourthWheel, escapePinion }
  escToBalance,   // escape arbor → balance arbor
  palletStone,    // escape arbor → fork pivot, along the escape→balance line
  swept,          // { great, center, third, fourth, escape, balance } — measured swept radii
  clearMargin = CLEAR_MARGIN,
  warn = () => {},
}) {
  const DEG2RAD = Math.PI / 180;
  const barrelPos = { x: 0, y: 0 };
  const centerPos = stepPos(barrelPos, barrelStepDeg, radii.barrel + radii.centerPinion);
  // centre→third→fourth two-bar: the fourth lands EXACTLY d4 below the centre.
  const d1CT = radii.centerWheel + radii.thirdPinion;
  const d2TF = radii.thirdWheel + radii.fourthPinion;
  const thirdWedgeDeg =
    Math.acos((d1CT * d1CT + d4 * d4 - d2TF * d2TF) / (2 * d1CT * d4)) / DEG2RAD;
  const thirdPos = stepPos(centerPos, -90 - thirdWedgeDeg, d1CT);
  const fourthPos = { x: centerPos.x, y: centerPos.y - d4 };
  const escapePos = stepPos(fourthPos, escapeStepDeg, radii.fourthWheel + radii.escapePinion);
  // BALANCE_STEP_DEG — solved from the swept-radius clearance constraint.
  const rBal = swept.balance;
  const obstacles = [
    { pos: barrelPos, rr: swept.great + rBal + clearMargin },
    { pos: centerPos, rr: swept.center + rBal + clearMargin },
    { pos: thirdPos, rr: swept.third + rBal + clearMargin },
    { pos: fourthPos, rr: swept.fourth + rBal + clearMargin },
    { pos: escapePos, rr: swept.escape + rBal + clearMargin },
  ];
  const ok = (deg) => {
    const p = stepPos(escapePos, deg, escToBalance);
    return obstacles.every((o) => Math.hypot(p.x - o.pos.x, p.y - o.pos.y) >= o.rr);
  };
  let BALANCE_STEP_DEG;
  if (ok(balanceStepTargetDeg)) {
    BALANCE_STEP_DEG = balanceStepTargetDeg;
  } else {
    const edge = (s) => {
      let hi = 0.25;
      while (hi <= 90 && !ok(balanceStepTargetDeg + s * hi)) hi += 0.25;
      if (hi > 90) return Infinity;
      let lo = hi - 0.25;
      for (let k = 0; k < 40; k++) {
        const m = (lo + hi) / 2;
        if (ok(balanceStepTargetDeg + s * m)) hi = m; else lo = m;
      }
      return hi;
    };
    const down = edge(-1), up = edge(1);
    if (down === Infinity && up === Infinity) {
      warn('balance step: no clear angle about the escape arbor — leaving the target');
      BALANCE_STEP_DEG = balanceStepTargetDeg;
    } else {
      BALANCE_STEP_DEG = balanceStepTargetDeg + (down <= up ? -down : up);
    }
  }
  const balancePos = stepPos(escapePos, BALANCE_STEP_DEG, escToBalance);
  // Fork pivot on the escape→balance line; pin aim at mid-swing.
  const toBalance = { x: balancePos.x - escapePos.x, y: balancePos.y - escapePos.y };
  const toBalanceLen = Math.hypot(toBalance.x, toBalance.y) || 1;
  const uBalance = { x: toBalance.x / toBalanceLen, y: toBalance.y / toBalanceLen };
  const forkPivotPos = { x: escapePos.x + uBalance.x * palletStone, y: escapePos.y + uBalance.y * palletStone };
  const forkBaseAngle = Math.atan2(uBalance.x, -uBalance.y);
  const PIN_AIM = Math.atan2(forkPivotPos.y - balancePos.y, forkPivotPos.x - balancePos.x);
  const dialCenterXY = { x: centerPos.x, y: centerPos.y };
  // Recenter on the CENTER-WHEEL arbor (dial concentric with the plate).
  const centroid = { x: centerPos.x, y: centerPos.y };
  const shift = (p) => ({ x: p.x - centroid.x, y: p.y - centroid.y });
  const P = {
    barrel: shift(barrelPos), center: shift(centerPos), third: shift(thirdPos),
    fourth: shift(fourthPos), escape: shift(escapePos), balance: shift(balancePos),
    fork: shift(forkPivotPos), dial: shift(dialCenterXY),
  };
  // §33 step 1 — CROWN AZIMUTH, by rigid rotation of the solved layout
  // about the centre arbor (the dial's axis): the movement turns in its
  // case while the dial's 12 stays up — the operation a casing watchmaker
  // actually performs. Every internal centre distance, mesh and clearance
  // is rotation-invariant, which is exactly why this is STEP 1: the train
  // stays proven, and what genuinely changes is the layout's relation to
  // the DIAL-ANCHORED world — the alarm cluster's corner, the reserve
  // sub-dial at 12, the case furniture — which is where §33's validity
  // verdicts live. (§13's "decouple the stem and re-solve the keyless
  // cluster" remains the deeper step 2.)
  //
  // The angle outputs rotate with the frame; the step angles between
  // members are relative and do not. Identity (crownAzDeg null) skips the
  // transform entirely, so the shipped spec stays BIT-exact — a rotation
  // by zero still churns floats, and the fingerprint gate would see it.
  let forkBaseOut = forkBaseAngle, pinAimOut = PIN_AIM, rotApplied = 0;
  if (SPEC.crownAzDeg !== null) {
    const dAz = SPEC.crownAzDeg * DEG2RAD - Math.atan2(P.barrel.y, P.barrel.x);
    if (dAz !== 0) {
      const c = Math.cos(dAz), s = Math.sin(dAz);
      for (const k of Object.keys(P)) {
        const p = P[k];
        P[k] = { x: p.x * c - p.y * s, y: p.x * s + p.y * c };
      }
      forkBaseOut += dAz;
      pinAimOut += dAz;
      rotApplied = dAz;
    }
  }
  // rotAppliedRad: §33 step 3's handles map pointer azimuths back into the
  // solver's (unrotated) frame — the one place the applied rotation must
  // be visible downstream.
  return { P, BALANCE_STEP_DEG, forkBaseAngle: forkBaseOut, PIN_AIM: pinAimOut, rotAppliedRad: rotApplied };
}

// ---------------------------------------------------------------------------
// Keyless-works frame constants (§13 step 3b) — the DECLARED spec of the
// stem-side cluster, hoisted beside the counts that gear it. The distances
// derived from these come out of solveKeyless below.
// ---------------------------------------------------------------------------
export const CROWN_PULL_DIST = 5; // stem/crown outward slide when pulled to set
export const SL_C = 10;        // setting-lever pivot's lateral offset from the stem axis
export const SL_TAIL = 6;      // lever tail arm length (pivot → post)
export const GROOVE_LOCAL = 4; // stem groove collars sit this far outboard of the sliding pinion
export const YK_C = 7.5;       // yoke pivot's lateral offset, opposite side of the stem

// ---------------------------------------------------------------------------
// solveKeyless (§13 step 3b) — the P-dependent XY FRAME as a pure function:
// the stem line (uWind/vPerp/sideSign), the keyless cluster's distances
// along it, the setting-lever/yoke pivots with their pull-driven angle
// functions, the plate radius, and the dial-side locals that radius fixes
// (dialRadius, sub-dial positions, the shared sub-dial well radius).
// Same contract as solveLayout: everything measured arrives as an argument
// (outline — each part's own outline radius, with the drum's REAL radius
// under 'barrel'), pitch radii are closed-form from the module/teeth
// constants above, and every expression is ported VERBATIM so the geometry
// fingerprint is bit-identical. main.js destructures the result under the
// same names the in-line block used to declare, so downstream consumers —
// plate openings, keyless assembly, dial build — are unchanged.
// ---------------------------------------------------------------------------
export function solveKeyless({
  P,              // solveLayout's position table (shifted, centre-arbor origin)
  outline,        // { barrel, center, third, fourth, escape, balance, fork, dial } — outline radii for the plate bound
  stemAzRad = null, // §33 step 2 — decoupled stem azimuth; null = derive from the barrel (§13, bit-exact)
  warn = () => {},
}) {
  const barrelDist = Math.hypot(P.barrel.x, P.barrel.y) || 1;
  const uWind = stemAzRad === null
    ? { x: P.barrel.x / barrelDist, y: P.barrel.y / barrelDist }
    : { x: Math.cos(stemAzRad), y: Math.sin(stemAzRad) };
  const stemAngle = Math.atan2(uWind.y, uWind.x);
  // Which side of the stem line the balance (and hence the setting lever)
  // lives on. NOTE: with the tornado layout the balance sits
  // almost exactly ON the stem line's far extension (perpendicular distance
  // ≈ 1 unit), so this sign holds by a thin margin — nudging the balance step
  // TARGET, the solved clearances feeding BALANCE_STEP_DEG, or the barrel
  // angle can silently mirror the whole lever/yoke/hack-spring assembly.
  // Warned here (the clearance solve now MOVES the balance, so a silent
  // flip is a live failure mode, not a hypothetical): |projection| ≈ 0.79
  // after the solve, vs ≈ 0.97 at the raw target.
  const vPerp = { x: -uWind.y, y: uWind.x };
  const sideProj = P.balance.x * vPerp.x + P.balance.y * vPerp.y;
  const sideSign = Math.sign(sideProj) || 1;
  if (Math.abs(sideProj) < 0.5) {
    warn(`keyless side sign nearly degenerate (balance ${sideProj.toFixed(2)} off the stem line) — lever/yoke/hack layout may mirror`);
  }
  const barrelR = (TRAIN.barrel.module * TRAIN.barrel.teeth) / 2; // DESIGN radius — closed-form, same expression main.js derives
  const ratchetR = barrelR * 0.34;                       // matches makeBarrel's ratR
  const crownWheelR = (KW_MODULE * crownWheelTeeth) / 2;
  const windPinionR = (KW_MODULE * windPinionTeeth) / 2;
  const settingWheelR = (KW_MODULE * settingWheelTeeth) / 2;
  const minuteWheelR = (KW_MODULE * minuteWheelTeeth) / 2;
  // The transfer wheel drives a plain 24-tooth WINDING SPUR on the fusee
  // arbor (the saw-toothed ratchet lives on the plate top now, serving only
  // the click). Same tooth count as the ratchet keeps the crown→fusee ratio;
  // equal module makes the mesh honest — the old layout gear-meshed the
  // ratchet's saw teeth at an effective module of 0.408 against KW_MODULE.
  const windSpurR = (KW_MODULE * WIND_SPUR_TEETH) / 2;
  // Winding transfer arbor axis. IDENTITY: one spur-mesh distance outboard
  // of the barrel along the (barrel-derived) stem, with the same +0.1 slop
  // every keyless mesh uses (see mwFoldD) — the §13 expression, verbatim.
  //
  // §33 step 2 — with the stem DECOUPLED the crown wheel stays on the stem
  // ray but the barrel no longer lies on it, and the reach solves in two
  // regimes. DIRECT (the ray passes within one mesh distance of the
  // barrel, |Δaz| ≲ 21° at the shipped radii): slide the mesh point along
  // the ray — cwDist = along + sqrt(R0² − c²), the outboard intersection
  // of the ray with the mesh circle, exactly what the identity expression
  // degenerates to at c = 0. IDLER (beyond direct reach): the crown wheel
  // parks at the ray's nearest point to the barrel and an 18-tooth idler
  // bridges by two-circle intersection — the alarm winding train's own
  // pattern, and idler counts drop out of the ratio there as here. The
  // idler's 18 teeth are sized so the §13 motivating example ("drag the
  // crown to 3 o'clock", Δaz ≈ 35°) closes with margin: span = crownWheelR
  // + 2·idlerR + windSpurR + 0.2 ≈ 13.9 covers Δaz ≤ asin(13.9/21.3) ≈
  // 40°. Beyond THAT the solve refuses with the numbers — a warn here,
  // the amber verdict at boot, the battery as always.
  const KW_WIND_IDLER_TEETH = 18;
  const windIdlerR = (KW_MODULE * KW_WIND_IDLER_TEETH) / 2;
  let cwDist, windIdler = null;
  if (stemAzRad === null) {
    cwDist = barrelDist + windSpurR + crownWheelR + 0.1;
  } else {
    const along = uWind.x * P.barrel.x + uWind.y * P.barrel.y;
    const c = Math.abs(uWind.x * P.barrel.y - uWind.y * P.barrel.x);
    const R0 = windSpurR + crownWheelR + 0.1;
    if (c <= R0 - 0.5 && along > 0) {
      // DIRECT: oblique mesh, outboard branch (the identity's topology).
      cwDist = along + Math.sqrt(R0 * R0 - c * c);
    } else if (along > 0) {
      // IDLER: crown wheel at the ray's nearest point to the barrel.
      cwDist = along;
      const cwPos = { x: uWind.x * cwDist, y: uWind.y * cwDist };
      const rA = crownWheelR + windIdlerR + 0.1;   // crown wheel ⇄ idler
      const rB = windSpurR + windIdlerR + 0.1;     // idler ⇄ fusee spur
      const dx = P.barrel.x - cwPos.x, dy = P.barrel.y - cwPos.y;
      const d = Math.hypot(dx, dy);
      if (d > rA + rB) {
        warn(`stem azimuth: the winding idler cannot span crown wheel to fusee spur (${d.toFixed(1)} apart, reach ${(rA + rB).toFixed(1)}) — bring the stem within ~40° of the barrel`);
        cwDist = barrelDist + windSpurR + crownWheelR + 0.1; // stand the cluster up anyway; the verdicts carry the refusal
      } else {
        const a = (rA * rA - rB * rB + d * d) / (2 * d);
        const h = Math.sqrt(Math.max(0, rA * rA - a * a));
        const mx = cwPos.x + (a * dx) / d, my = cwPos.y + (a * dy) / d;
        // Two intersections; take the INBOARD one (smaller radius from the
        // centre) so the idler stays inside the plate's enclosure — the
        // trial boot and battery judge the arrangement either way.
        const cand1 = { x: mx - (h * dy) / d, y: my + (h * dx) / d };
        const cand2 = { x: mx + (h * dy) / d, y: my - (h * dx) / d };
        const pick = Math.hypot(cand1.x, cand1.y) <= Math.hypot(cand2.x, cand2.y) ? cand1 : cand2;
        windIdler = { x: pick.x, y: pick.y, r: windIdlerR, teeth: KW_WIND_IDLER_TEETH };
      }
    } else {
      warn('stem azimuth: the stem ray points away from the barrel entirely — the winding path cannot exist');
      cwDist = barrelDist + windSpurR + crownWheelR + 0.1;
    }
  }
  const pinDist = cwDist + crownWheelR + windPinionR * 0.55; // sliding pinion, pushed in (teeth overlap the wheel rim, bevel-style)
  const pinOutDist = pinDist + CROWN_PULL_DIST;              // ...pulled out → setting mesh
  const swDist = pinOutDist + windPinionR * 0.55 + settingWheelR;
  // The minute wheel FOLDS perpendicularly off the stem line (see the
  // setting-path assembly for why).
  const mwFoldD = settingWheelR + minuteWheelR + 0.1;
  const minuteArborXY = {
    x: uWind.x * swDist - sideSign * vPerp.x * mwFoldD,
    y: uWind.y * swDist - sideSign * vPerp.y * mwFoldD,
  };
  // Setting lever & yoke pivots + the pull-driven angle solves. Solved with
  // the layout: the lever's tail-post ARC is what the plate's slot is cut
  // from, and every hack/reset solver downstream keys off tailPostWorldAt.
  const slMidAlong = pinDist + CROWN_PULL_DIST / 2 + GROOVE_LOCAL;
  const settingLeverPivot = {
    x: uWind.x * slMidAlong + sideSign * vPerp.x * SL_C,
    y: uWind.y * slMidAlong + sideSign * vPerp.y * SL_C,
  };
  function settingLeverAngleAt(pull) {
    const along = pinDist + pull * CROWN_PULL_DIST + GROOVE_LOCAL;
    const gx = uWind.x * along, gy = uWind.y * along;
    return Math.atan2(gy - settingLeverPivot.y, gx - settingLeverPivot.x) - Math.PI / 2;
  }
  function tailPostWorldAt(pull) {
    const a = settingLeverAngleAt(pull);
    return {
      x: settingLeverPivot.x + Math.sin(a) * SL_TAIL,
      y: settingLeverPivot.y - Math.cos(a) * SL_TAIL,
    };
  }
  const postEng = tailPostWorldAt(1);
  const postRel = tailPostWorldAt(0);
  // The post swings on the lever's tail, so its track between the two crown
  // poses is an ARC, not the chord — both plates' slots need the bow.
  const kwPostBow = (() => {
    const chord = { x: postEng.x - postRel.x, y: postEng.y - postRel.y };
    const L = Math.hypot(chord.x, chord.y) || 1;
    let bow = 0;
    for (let i = 0; i <= 40; i++) {
      const p = tailPostWorldAt(i / 40);
      const t = ((p.x - postRel.x) * chord.x + (p.y - postRel.y) * chord.y) / (L * L);
      bow = Math.max(bow, Math.hypot(p.x - postRel.x - t * chord.x, p.y - postRel.y - t * chord.y));
    }
    return bow;
  })();
  const yokeMidAlong = pinDist + CROWN_PULL_DIST / 2;
  const yokePivot = {
    x: uWind.x * yokeMidAlong - sideSign * vPerp.x * YK_C,
    y: uWind.y * yokeMidAlong - sideSign * vPerp.y * YK_C,
  };
  function yokeAngleAt(pull) {
    const along = pinDist + pull * CROWN_PULL_DIST;
    const px = uWind.x * along, py = uWind.y * along;
    return Math.atan2(py - yokePivot.y, px - yokePivot.x) - Math.PI / 2;
  }

  // Plate radius: tightest circle (plus a rim margin) that contains each part's
  // own outline — arbor distance plus that part's radius, not a blanket maximum.
  let plateR = 20;
  for (const key in P) {
    plateR = Math.max(plateR, Math.hypot(P[key].x, P[key].y) + (outline[key] || 0));
  }
  plateR += 5;
  // Keyless floor: the plate must reach 1 unit past the setting wheel and
  // past the folded minute wheel (with the compact tornado train, this floor
  // — not the train extent — is what sizes the plate).
  plateR = Math.max(
    plateR,
    swDist + settingWheelR + 1,
    Math.hypot(swDist, mwFoldD) + minuteWheelR + 1,
  );

  // --- Dial-side locals the plate radius fixes (moved from the dial build,
  // §13 step 3b — one source; ALARM_CD's plate-bore hoist reads these too) ---
  const dialRadius = plateR * 0.92;
  // Sub-dial positions in dial-local coordinates (+y = 12 o'clock; the
  // dialFace Y-flip makes these read correctly from the front).
  // 12 o'clock — symmetric with the small-seconds sub-dial at 6 (the fourth
  // wheel sits D4 below centre); also much closer to the barrel's dial-side
  // projection than the old 6-o'clock spot, so the reserve reduction train
  // spans a shorter, cleaner run.
  const RESERVE_LOCAL = { x: 0, y: dialRadius * 0.39 };
  // Small seconds live ON the fourth wheel's axis — dial-local coordinates
  // mirror world x through the dialFace Y-flip.
  const SECONDS_LOCAL = { x: -(P.fourth.x - P.dial.x), y: P.fourth.y - P.dial.y };
  // Sub-dial radius — as large as the face allows while staying balanced:
  // one shared radius for both wells (their pivots are fixed on their
  // arbors, so only the radius can grow), capped by the clearance the
  // central hands' boss needs around the dial centre. This lands ≈ 0.30 of
  // the dial radius (up from 0.2); the bigger wells swallow the XI/I and
  // V/VII numerals symmetrically, leaving II–IIII and VIII–X.
  // The INBOARD ceiling — what the wells' rings must clear on their way
  // toward the dial centre. It has moved once, and the move is the point:
  //
  // §25 C set it to −5.2 against the central SETTING WHEEL: the well WALLS
  // descended through the gear lane (z −7.0..−6.5), so the ring had to clear
  // the wheel's tip 4.83 + 0.2 (wall) + 0.15 (margin) ≈ 5.18. (The −4.5
  // before it had the wall passing straight through the wheel's teeth, masked
  // in the sweep by the wheel⇄Dial EXPECTED blanket.)
  //
  // TODO 26 ended that geometry. The dial is a plate and the pockets are
  // machined INSIDE its own thickness, so the rings no longer reach the
  // setting lane at all — `wellsInLane` is false and the §25 C assert is
  // dormant. Its form is kept, not deleted: move the dial's stratum or the
  // setting lane back into contact and it wakes up and binds again.
  //
  // What bounds the wells inboard NOW is the dial's own CENTRE BORE, which
  // carries the co-axial hand stack (cannon → hour tube → §25 C alarm tube):
  // centerBoreR = ALARM_TUBE_OUTER + 0.2 = 3.20, plus the same wall and
  // margin the old form used. Measured before this changed: the pockets
  // overlapped that bore from factor 1.196 and the build said NOTHING — the
  // triangulator quietly dropped the overlap while boot, support, clearances
  // and inspection all stayed green (TODO 33, whose assert now enforces this
  // line rather than leaving it to a comment).
  //
  //   wellR ≤ 15.401 − (3.20 + 0.2 + 0.15) = 11.85
  //
  // §23: the owner's size knob — a factor over the SOLVED radius, so the
  // solve stays the source and the knob is a taste adjustment on top. Its
  // bound in aesthetics.json is 1.0 because the SOLVE already sits on the
  // ceiling; TODO 33's assert catches an oversized factor at boot.
  const subDialR = (Math.min(RESERVE_LOCAL.y, -SECONDS_LOCAL.y) - SUBDIAL_INBOARD_CLEAR)
    * ((aesthetics.dial.subdials && aesthetics.dial.subdials.radiusFactor) || 1);

  return {
    barrelDist, uWind, stemAngle, vPerp, sideSign,
    ratchetR, crownWheelR, windPinionR, settingWheelR, minuteWheelR, windSpurR,
    cwDist, pinDist, pinOutDist, swDist, mwFoldD, minuteArborXY, windIdler,
    settingLeverPivot, settingLeverAngleAt, tailPostWorldAt, postEng, postRel,
    kwPostBow, yokePivot, yokeAngleAt,
    plateR, dialRadius, RESERVE_LOCAL, SECONDS_LOCAL, subDialR,
  };
}

// ---------------------------------------------------------------------------
// STOP WORK (hacking) — the SOLVE, pure (§85 step A).
//
// Everything from the bearing scan to the hack rod's elbow used to be
// module-scope IIFEs in main.js reading module-scope constants, so nothing
// outside the build could ask the one question reconfigure mode needs to
// ask: where would this linkage STAND if the balance were somewhere else?
// It is the solveLayout / solveKeyless pattern, for the same reason — the
// same measured inputs with a candidate layout ARE the check, and there is
// no second model to rot.
//
// main.js's job here is again the MEASUREMENT: the balance's swept radius,
// the plate cut, the obstacle circles the bearing scan avoids and the low
// corridor's own table are all read from the BUILT movement and passed in
// as declared inputs. Warnings are COLLECTED, not printed — boot prints
// them (rule 6), a shadow solve reads them.
// ---------------------------------------------------------------------------
function clamp(x, lo, hi) { return Math.max(lo, Math.min(hi, x)); }

// Shared by both low-plane rods: the reset rod builds its own elbow with
// these against the same corridor table.
export function segCircleClear(p, q, c) {
  const vx = q.x - p.x, vy = q.y - p.y;
  const L2 = vx * vx + vy * vy || 1e-9;
  const t = clamp(((c.x - p.x) * vx + (c.y - p.y) * vy) / L2, 0, 1);
  return Math.hypot(c.x - p.x - t * vx, c.y - p.y - t * vy) - c.r;
}
// The obstacle table is a PARAMETER now rather than a closed-over constant:
// the solver has to be able to score a candidate route against a corridor
// its caller measured.
// The z at which a segment ENTERS a circle it fouls, and the z at which it
// leaves — the rod climbs along its run, so an obstacle standing above the
// corridor only counts where the rod is actually high enough to meet it.
// Returns the highest z the segment reaches INSIDE the circle, or null when
// it never enters. (z is linear along the segment, so the extreme is at one
// end of the inside interval; no sampling.)
function maxZInside(p, q, zp, zq, c) {
  const vx = q.x - p.x, vy = q.y - p.y;
  const fx = p.x - c.x, fy = p.y - c.y;
  const A = vx * vx + vy * vy;
  if (A < 1e-12) return Math.hypot(fx, fy) <= c.r ? Math.max(zp, zq) : null;
  const B = 2 * (fx * vx + fy * vy);
  const C = fx * fx + fy * fy - c.r * c.r;
  const disc = B * B - 4 * A * C;
  if (disc < 0) return null;                       // the line misses the circle
  const s = Math.sqrt(disc);
  const t0 = Math.max(0, (-B - s) / (2 * A));
  const t1 = Math.min(1, (-B + s) / (2 * A));
  if (t0 > t1) return null;                        // the crossing is off the segment
  return Math.max(zp + (zq - zp) * t0, zp + (zq - zp) * t1);
}
// `at` is the obstacle that BOUND the chosen route — the one a fouled run has
// to name. Tracking it changes no arithmetic: Math.min over the same two
// distances, just kept alongside the row that produced it.
//
// §85 step C1 — an obstacle row may declare `zAbove`, the height its body
// begins at. The low corridor's whole design is that the rod passes UNDER the
// great wheel (ROD2_PLANE_Z is derived as GW_UNDER_Z − CLEAR_MARGIN − ROD_R),
// and a flat 2D circle cannot express "under": give the fusee station the
// wheel's real radius unconditionally and the shipped route is forbidden;
// leave the row out, as it was, and the wheel is invisible to the check that
// exists to keep the rod clear of it. The rod does not stay in its plane —
// its far end HANGS from a raised pivot and climbs as the crank swings — so
// the test is per-segment and per-pose: a banded row bites only where the rod
// rises into its body.
export function solveElbow(len, posesAB, obstacles, rodR = 0, { fStep = 0.05, eStep = 0.2, eMax = 6, plateLimit = Infinity } = {}) {
  // §85 step C3 — WHAT THE SEARCH IS FOR. This scan used to maximise
  // worst-case clearance, and a maximiser with no cost for bending bends as
  // far as it is allowed: the shipped rod sat at f 0.25, e −6.0 — BOTH box
  // corners — holding 13.54 of clearance against a margin that asks for 0.15.
  // That is a dimension set by the search bounds rather than by a constraint,
  // §35's defect in miniature, and widening the box only moved it to the new
  // corner (e −16.0, a dogleg on a 58.7 rod).
  //
  // A rod is straight unless something makes it bend. So the objective is the
  // LEAST bend that clears the corridor by the margin the obstacle radii
  // already carry, and the bound may then be generous without buying absurd
  // geometry — extra range is only ever spent when a smaller bend cannot
  // thread. If nothing clears, the most-clearance route is still returned so
  // the caller can report how badly (C1's named warning, C2's scan).
  let best = null;                                   // least-bent route that clears
  let fallback = { clear: -Infinity, f: 0.5, e: 0, at: null };
  // A COARSE probe is a strict SUBSET of the fine grid (0.25 + k·0.25 and
  // ±k·1 both land on fine gridpoints), so a route the probe can find the
  // fine solve can only match or beat — which is what lets §85 C2 use it as
  // a feasibility test without lying to the scan.
  for (let f = 0.25; f <= 0.751; f += fStep) {
    for (let e = -eMax; e <= eMax + 0.01; e += eStep) {
      let worst = Infinity, worstAt = null;
      for (const { a, b, za = 0, zb = 0 } of posesAB) {
        const dx = b.x - a.x, dy = b.y - a.y, L = Math.hypot(dx, dy);
        // Lateral unit = the chord's RIGHT-perp — the direction the mesh's
        // local +X maps to under the placement rotation (atan2 − π/2).
        const ux = dx / L, uy = dy / L, nx = uy, ny = -ux;
        const E = { x: a.x + ux * L * f + nx * e, y: a.y + uy * L * f + ny * e };
        // The bend is a real knuckle on a real plate: it has to BE somewhere.
        // With C3's least-bend objective the search bound no longer sets the
        // geometry, so the bound may be generous and this is what actually
        // limits it — the physical constraint instead of the magic number.
        if (Math.hypot(E.x, E.y) > plateLimit) { worst = -Infinity; break; }
        const zE = za + (zb - za) * f;   // z runs with the bend, not around it
        for (const o of obstacles) {
          let d;
          if (o.zAbove === undefined) {
            d = Math.min(segCircleClear(a, E, o), segCircleClear(E, b, o));
          } else {
            // Each half is judged on its own height: the post half runs low
            // and under the wheel, the crank half is the one that climbs.
            const z1 = maxZInside(a, E, za, zE, o), z2 = maxZInside(E, b, zE, zb, o);
            const d1 = z1 !== null && z1 + rodR >= o.zAbove ? segCircleClear(a, E, o) : Infinity;
            const d2 = z2 !== null && z2 + rodR >= o.zAbove ? segCircleClear(E, b, o) : Infinity;
            d = Math.min(d1, d2);
          }
          if (d < worst) { worst = d; worstAt = o; }
        }
      }
      if (worst >= 0) {
        const bend = Math.abs(e);
        // Least bend; among equally bent routes, the one with more air.
        if (!best || bend < best.bend - 1e-9 || (bend <= best.bend + 1e-9 && worst > best.clear)) {
          best = { clear: worst, f, e, at: worstAt, bend };
        }
      }
      if (worst > fallback.clear) fallback = { clear: worst, f, e, at: worstAt };
    }
  }
  const chosen = best || fallback;
  // §86 instrument A — did the FENCE decide, or the field? A winner sitting on
  // its own search bound means the scan ran out of room rather than finding an
  // optimum, and the value is the bound wearing an answer's clothes. Reported,
  // never warned: a value legitimately at a limit is common (a floor is a
  // constraint doing its job), so the row is the product and only a row nobody
  // can explain is debt.
  chosen.atBound = [
    Math.abs(Math.abs(chosen.e) - eMax) < eStep / 2 ? `e at ±${eMax}` : null,
    chosen.f <= 0.25 + fStep / 2 ? 'f at its low bound' : null,
    chosen.f >= 0.75 - fStep / 2 ? 'f at its high bound' : null,
  ].filter(Boolean);
  return chosen;
}

// How far the search may LOOK, not how far the rod may bend — C3's objective
// decides that, and the plate decides what is reachable. Generous enough that
// a corridor needing a real detour can be threaded; the identity build spends
// 0.8 of it.
export const ELBOW_E_MAX = 16;

export function solveStopWork({
  P,                  // solved layout stations (balance, fork, escape, fourth)
  balanceR,           // measured: the balance wheel's own rim radius
  BAL_OUTER_R,        // measured: its swept outer radius (screw heads included)
  postEng, postRel,   // keyless: the setting lever's tail post, engaged / released
  tailPostWorldAt,    // keyless: the post's position across the crown stroke
  plateR,
  TQ_CUT,             // the three-quarter plate's open wedge { aim, phiOpen }
  TQ_TOP_Z,           // the balance cock's height — the mast's case-fit ceiling
  ROD2_PLANE_Z,       // the low rod plane
  rodR,               // the rod's own radius — the height a banded row is met at
  bearingObstaclesAt, // (P) → circles the bearing scan must keep the crank clear of
  lowRodObstacles,    // the corridor table the rod's elbow is scored against
  rubyFlare,          // geometry.js's HACK_RUBY_FLARE
  warn = () => {},
}) {
  const DEG2RAD = Math.PI / 180;
  const corners = [];   // §86 instrument A — values their own search bound chose

  // ---------------------------------------------------------------------------
  // STOP WORK (hacking) — a local stop crank at the balance, driven by a
  // thin LOW hack rod (the corridor under the great wheel — the whole
  // reset/hack linkage lives between the plates now). The crown's motion
  // still has to travel from the keyless corner to the balance — that span
  // is irreducible — but it travels as a thin elbow rod in the low band
  // instead of over the plate. At the balance end the rod drives a SEE-SAW
  // CRANK standing in the plate cut's open wedge: a HANGING tail down to
  // the rod plane, and a pad arm dropped from the raised pivot to reach
  // under the rim, pivoted in a clevis bracket on the base plate about the
  // RADIAL axis (balance-centre → bracket). The hinge axis is forced by the
  // keyless kinematics: releasing the crown moves the tail post AWAY from
  // the crank (measured stroke ≈ 2.9 outward along the rod), so the rigid
  // rod can only PULL the tail toward the post on release. A tangential
  // hinge would turn that pull into the pad camming UP through the rim
  // (any pad reaching inward from a below-pivot arm rises when its tail is
  // pulled — dz/dψ = −x_pad > 0, no placement escapes it); the radial
  // hinge turns the same pull into a TANGENTIAL tail swing, which never
  // moves anything on the crank toward the balance axis (hypot(R, y) ≥ R),
  // and a solved tangential pad offset converts the swing into the pad
  // DROP the release needs. Because the rod is rigid and pinned at both
  // ends, the linkage is positively controlled in both directions: no
  // preload spring needed.
  //
  // The brake itself is unchanged in kind: an UNDERSIDE pad. The rim's side
  // face is not a usable contact — the timing screws' heads sweep proud of
  // the rim across its whole z-band — so the pad must press up from below,
  // on the same screw-standoff annulus as before (derivation kept verbatim).
  const HACK_CLEAR_MARGIN = CLEAR_MARGIN; // one named margin; the solves below bind exactly at it

  // --- Pad ↔ balance geometry, derived from the balance's OWN build
  // constants (slim rim: height 0.55·t, width 0.5·t; screws base 0.24·t,
  // embedded 0.16·t past the rim face — see makeBalanceWheel) so reshaping
  // the balance moves the brake with it.
  // (BAL_T itself is declared with the Z-stack constants — the balance plane
  // derivation needs it first.)
  const HACK_RIM_I = balanceR - BAL_T * 0.5;             // rim's inner radius
  const HACK_SCREW_IN_R = balanceR - BAL_T * 0.16;       // timing screws' inner tips (rimO − screwLen + protrusion)
  // The rim's underside hangs only this far below the screws' deepest sweep
  // (0.275·t rim half-height vs 0.24·t screw base radius) — far less than
  // the margin, so z alone cannot keep the pad clear of the screws:
  const HACK_SCREW_DROP = (0.55 / 2 - 0.24) * BAL_T;
  // ...the rest of the separation must come radially. Corner-to-corner:
  // √(standoff² + drop²) = margin ⇒
  const HACK_SCREW_STANDOFF = Math.sqrt(Math.max(0, HACK_CLEAR_MARGIN ** 2 - HACK_SCREW_DROP ** 2));
  // Size the ruby's top face to fill exactly the annulus that is both fully
  // ON the rim's underside (≥ rim inner edge — full-face seating, lesson:
  // surface-to-surface) and radially inside the screws' standoff:
  const HACK_PAD_TOP_R = (HACK_SCREW_IN_R - HACK_SCREW_STANDOFF - HACK_RIM_I) / 2;
  const HACK_PAD_R = HACK_PAD_TOP_R / rubyFlare; // pad post / ruby-base radius
  const HACK_CONTACT_R = (HACK_RIM_I + HACK_SCREW_IN_R - HACK_SCREW_STANDOFF) / 2;
  const HACK_CONTACT_Z = L_BALANCE - RIM_H / 2;          // the rim's underside plane
  // Minimum acceptable pad gap below the rim when released — the linkage's
  // actual released drop is DERIVED (the rod's rigid length maps the post's
  // crown travel onto the crank), asserted against this floor below.
  const HACK_DROP_MIN = 0.35;

  // --- Crank geometry. The PAD ARM still sits level at full engagement
  // with its ruby's top face exactly on the contact plane — the engaged
  // pose is the calibration zero — but the arm's plane is a build DATUM
  // now (Z_STOP_PIVOT_LOW below), not the pivot height: the pivot moved up
  // so the tail can hang to the low rod plane, and a drop leg connects the
  // raised pivot hub to the arm.
  const STOP_ARM_T = 0.8;     // pad arm thickness
  const STOP_ARM_W = 0.9;     // pad arm width
  const STOP_PAD_RISE = 0.9;  // arm top face → ruby top face (post 0.5 + ruby 0.4)
  const STOP_TAIL_W = 0.5;    // tail bar section
  const STOP_LEG_W = 0.7;     // drop-leg section (local x): pivot hub → pad-arm plane
  // The drop leg — and with it the pad arm's root — is IN LINE with the tail
  // bar, not stood off beside it. The crank hinges about local X, so every
  // point of it keeps its x for ever: a leg hanging off-axis makes the crank
  // asymmetric about its own swing plane, and then there is no pair of
  // positions where a clevis can straddle it (the old +x leg ran straight
  // through the +x cheek). With the root ON the axis the crank's whole hub
  // band is |x| ≤ STOP_HUB_HALF_X, which is what the cheeks are derived from.
  const STOP_ARM_ROOT_X = 0;
  const STOP_HUB_HALF_X = Math.max(STOP_TAIL_W, STOP_LEG_W) / 2;
  // Bracket axis stand-off from the balance axis. With the RADIAL hinge the
  // crank's tangential swing only ever moves it AWAY from the balance axis,
  // so the binding constraint is the STATIC hardware: the clevis cheeks
  // straddle the crank along that same radial axis and reach
  // STOP_CHEEK_X + STOP_CHEEK_T/2 ≈ 0.82 inward of the pivot, so the
  // allowance must cover that + CLEAR_MARGIN ≈ 0.97; the 2.0 keeps the extra
  // so the pad arm's diagonal run down to the contact annulus stays shallow.
  const STOP_LEAN_ALLOW = 2.0;
  const STOP_PIVOT_R = BAL_OUTER_R + STOP_LEAN_ALLOW;
  // The tail now HANGS: the hack rod runs on the LOW plane (under the
  // great wheel), so the crank's driven arm reaches DOWN from the pivot to
  // the rod. The pivot height is therefore no longer set by the pad-arm
  // stack — it is SIZED FROM THE STROKE: the released crank angle is what
  // the rod's crown travel maps onto the tail's length, and a small-angle
  // crank (real-watch scale) needs the pivot high enough that the hanging
  // tail is long. The rod only couples through the TANGENTIAL component of
  // its run (STOP_TANG_K below), so the pivot-height formula carries that
  // factor — omitting it is exactly how the old solve overshot its target
  // swing. The bracket stands in the plate cut's open wedge, where there
  // is no plate to hide below — its slim post is the one piece of this
  // linkage that still shows above the plate line.
  const STOP_PSI_TARGET = 0.5; // ~29° released swing sizes the tail lever (with K ≈ 0.6 the mast stays near its old height)
  const POST_STROKE = Math.hypot(postEng.x - postRel.x, postEng.y - postRel.y);
  const Z_STOP_PIVOT_LOW = HACK_CONTACT_Z - STOP_PAD_RISE - STOP_ARM_T / 2; // the pad arm's own plane (build datum)

  // --- Bearing: scanned around the plate cut's open-wedge centre (the wedge
  // aims plate-centre → balance and is open to the rim, so the OUTWARD
  // bearing is open air from base plate to sky by construction — the crank's
  // tall tail needs exactly that). The scan walks away from the ideal only
  // far enough to clear the escapement-side hardware, and requires the hack
  // rod's approach to keep a strong component along the crank's tilt plane —
  // TANGENTIAL now (the see-saw only converts motion in its own hinge
  // plane, and the hinge is radial). The released tail sweeps tangentially
  // toward the post, so the whole swept segment is tested, not the pivot
  // point alone.
  // §85 step C2 — the pose maths takes its FRAME as an argument. The build
  // binds the chosen station's frame (stopTailTopAt / stopSolvePsi below);
  // the bearing scan binds a CANDIDATE's, so it can ask the same questions of
  // a station it is only considering. One model, two callers — the same rule
  // step A moved this whole solve into layout.js for.
  const tailTopIn = (fr, psi) => {
    const sw = -fr.tailH * Math.sin(psi); // tangential swing (H < 0)
    return {
      x: fr.pivot.x + fr.tHat.x * sw,
      y: fr.pivot.y + fr.tHat.y * sw,
      z: fr.zPivot + fr.tailH * Math.cos(psi),
    };
  };
  const solvePsiIn = (fr, len, post, prev) => {
    const wx = post.x - fr.pivot.x, wy = post.y - fr.pivot.y, wz = ROD2_PLANE_Z - fr.zPivot;
    const a = -(wx * fr.tHat.x + wy * fr.tHat.y), b = wz;
    const c = (wx * wx + wy * wy + wz * wz + fr.tailH * fr.tailH - len * len)
      / (2 * fr.tailH);
    const m = Math.hypot(a, b) || 1e-9;
    const base = Math.atan2(a, b);
    const off = Math.acos(clamp(c / m, -1, 1));
    const c1 = base - off, c2 = base + off;
    return Math.abs(c1 - prev) <= Math.abs(c2 - prev) ? c1 : c2;
  };
  // A station's whole linkage, derived the way the build derives it: pivot,
  // coupling, the pivot height the stroke buys through that coupling, and the
  // hanging tail it implies.
  const frameAt = (phi) => {
    const rHat = { x: Math.cos(phi), y: Math.sin(phi) };
    const tHat = { x: -rHat.y, y: rHat.x };
    const pivot = {
      x: P.balance.x + rHat.x * STOP_PIVOT_R,
      y: P.balance.y + rHat.y * STOP_PIVOT_R,
    };
    const dx = pivot.x - postEng.x, dy = pivot.y - postEng.y;
    const tangK = (dx * tHat.x + dy * tHat.y) / Math.hypot(dx, dy);
    const zPivot = ROD2_PLANE_Z + POST_STROKE / (Math.abs(tangK) * Math.sin(STOP_PSI_TARGET));
    return { rHat, tHat, pivot, tangK, zPivot, tailH: ROD2_PLANE_Z - zPivot };
  };
  // The ROUTE that station commits the rod to: calibrate the length at the
  // engaged pose, track ψ across the crown stroke, and ask the corridor
  // whether any elbow threads it. Coarse grid — a strict subset of the fine
  // one, so a pass here is a pass there.
  const routeAt = (fr, coarse) => {
    const len = (() => {
      const t = tailTopIn(fr, 0);
      return Math.hypot(postEng.x - t.x, postEng.y - t.y, ROD2_PLANE_Z - t.z);
    })();
    const poses = [];
    let prev = solvePsiIn(fr, len, postRel, 0);
    for (let t = 0; t <= 1.0001; t += 0.125) {
      const post = tailPostWorldAt(t);
      const psi = solvePsiIn(fr, len, post, prev);
      prev = psi;
      const tt = tailTopIn(fr, psi);
      poses.push({ a: post, b: { x: tt.x, y: tt.y }, za: ROD2_PLANE_Z, zb: tt.z });
    }
    const opts = { eMax: ELBOW_E_MAX, plateLimit: plateR - rodR - CLEAR_MARGIN };
    return solveElbow(len, poses, lowRodObstacles, rodR,
      coarse ? { ...opts, fStep: 0.25, eStep: 1 } : opts);
  };
  const STOP_BEARING = (() => {
    const ideal = Math.atan2(P.balance.y, P.balance.x);
    const obstacles = bearingObstaclesAt(P);
    let best = null, bestAny = null;
    // Scan bound: the plate cut's open wedge (±phiOpen about the same
    // balance-centred aim), less the bracket's own angular half-width —
    // the mast crosses the plate band and must stay in open air. The old
    // ±28° window was leftover conservatism from the tall-mast design and
    // capped the achievable coupling ~0.62.
    const wedgeBound = TQ_CUT.phiOpen / DEG2RAD - Math.atan2(1.65 + HACK_CLEAR_MARGIN, STOP_PIVOT_R) / DEG2RAD;
    for (let d = -Math.floor(wedgeBound); d <= Math.floor(wedgeBound); d += 1) {
      const phi = ideal + d * DEG2RAD;
      const bx = P.balance.x + Math.cos(phi) * STOP_PIVOT_R;
      const by = P.balance.y + Math.sin(phi) * STOP_PIVOT_R;
      const dxp = bx - postEng.x, dyp = by - postEng.y, mp = Math.hypot(dxp, dyp) || 1;
      const tx = -Math.sin(phi), ty = Math.cos(phi);
      const rodK = (dxp * tx + dyp * ty) / mp;
      if (Math.abs(rodK) < 0.6) continue;
      // Released tail-end sweep, tangential, TOWARD the post: first-order
      // stroke/|K|, inflated 25% for the pin's cosine rise (covers ψ0 ≲ 40°).
      const sw = -Math.sign(rodK) * 1.25 * POST_STROKE / Math.abs(rodK);
      const swept = { x: bx + tx * sw, y: by + ty * sw };
      if (Math.hypot(bx, by) > plateR - 2) continue;        // bracket fully on the plate
      if (Math.hypot(swept.x, swept.y) > plateR - 1) continue; // swept tail stays over the plate
      let clr = Infinity;
      for (const o of obstacles)
        clr = Math.min(clr, segCircleClear({ x: bx, y: by }, swept, o) - 2);
      if (clr < HACK_CLEAR_MARGIN) continue;
      // §85 step C2 — AND the rod must be able to GET here. The scan used to
      // choose the station on the crank's own merits and discover the route
      // afterwards, which is how a station whose corridor is impossible could
      // win on coupling alone. Probing the route costs one coarse elbow solve
      // per candidate; the station is a position-space choice, so paying for
      // routability with it is legal where paying with the rod's dimensions
      // would not be.
      const routable = routeAt(frameAt(phi), true).clear >= 0;
      // MAXIMIZE the coupling, with clearance as the constraint it always
      // really was (the old clearance-maximizing score let K sit at its
      // 0.6 gate, inflating the tail lever — and the mast — by ~40%: the
      // pivot height divides by |K|, see Z_STOP_PIVOT). Tiny clearance
      // tiebreak so equal-K bearings still prefer open air.
      const score = Math.abs(rodK) + clr * 0.01;
      if (routable && (!best || score > best.score)) best = { phi, score, d };
      if (!bestAny || score > bestAny.score) bestAny = { phi, score, d };
    }
    // Degrade in ONE step at a time, and say which step was taken. A station
    // that cannot route is still better than the outward ideal, which meets
    // none of the constraints — so an unroutable movement keeps the
    // best-coupled station (what this scan chose before C2) and says the
    // corridor is the thing that failed. That is a LAYOUT finding, not a
    // reason to accept a station nothing was checked against; C4 turns it
    // into a refusal, and C1's elbow warning names the body in the way.
    if (!best && bestAny) {
      warn('stop work: no station about the balance can route the hack rod through the low corridor — keeping the best-coupled one');
      best = bestAny;
    }
    if (!best) {
      warn('stop work: no clear bearing about the balance — using the outward ideal');
      best = { phi: ideal };
    }
    // §86 A — the wedge is this scan's fence. A winner at its edge means the
    // plate cut chose the station, not the coupling the scan is scoring for.
    if (best.d !== undefined && Math.abs(Math.abs(best.d) - Math.floor(wedgeBound)) < 0.5)
      corners.push({ what: 'the stop work\'s bearing', value: `${best.d.toFixed(0)}° off the ideal`,
        bound: `the plate cut's wedge, ±${Math.floor(wedgeBound)}°` });
    return best.phi;
  })();
  // The chosen station's frame, from the same derivation every candidate was
  // judged by (§85 C2): pivot, coupling |K| (≥ 0.6 by the scan), the pivot
  // height the stroke buys through that coupling —
  //   |STOP_TAIL_H| · sin(ψ_target) · |K| = POST_STROKE
  // — and the tail that hangs from it (NEGATIVE: down to the rod plane).
  const STOP_FRAME = frameAt(STOP_BEARING);
  const STOP_R_HAT = STOP_FRAME.rHat;
  const STOP_T_HAT = STOP_FRAME.tHat; // hinge plane's horizontal axis
  const STOP_PIVOT = STOP_FRAME.pivot;
  const STOP_TANG_K = STOP_FRAME.tangK;
  const Z_STOP_PIVOT = STOP_FRAME.zPivot;
  const STOP_TAIL_H = STOP_FRAME.tailH;
  // CASE-FIT assert: the mast (pivot + clevis cheeks, top = pivot + 0.85)
  // must not stand above the balance cock's own height — the cock sets the
  // display side's silhouette, and the K-maximizing bearing scan above is
  // what earns this. If it fires, the achieved coupling is printed: the
  // fallback is a dedicated hack-rod pin at reduced radius on the setting
  // lever's tail (stroke scales with r/SL_TAIL).
  const STOP_MAST_TOP = Z_STOP_PIVOT + 0.85;
  if (STOP_MAST_TOP > TQ_TOP_Z)
    warn(`stop work: mast top ${STOP_MAST_TOP.toFixed(2)} above the cock height ${TQ_TOP_Z.toFixed(2)} — achieved |K| = ${Math.abs(STOP_TANG_K).toFixed(3)}, needed ≥ ${(POST_STROKE / ((TQ_TOP_Z - 0.85 - ROD2_PLANE_Z) * Math.sin(STOP_PSI_TARGET))).toFixed(3)}`);

  const PAD_ARM_LOCAL_Z = Z_STOP_PIVOT_LOW - Z_STOP_PIVOT;

  // --- Hack-rod linkage: rigid rod, length CALIBRATED at the engaged pose
  // (crank at ψ = 0, pad tangent to the rim by the z-stack above); the
  // released crank angle then FOLLOWS from the post's crown travel through
  // the rod constraint — derived, not styled — and the released pad drop is
  // asserted against HACK_DROP_MIN. Per-frame the crank angle is solved from
  // the same constraint (a·sinψ + b·cosψ = c, branch nearest the previous
  // frame), mirroring the reset hammer's rod solve; ψ is clamped at 0
  // because the rim itself is the hard stop the pad presses against.
  // Rotation about local X maps (y, z) → (y·cosψ − z·sinψ, y·sinψ + z·cosψ):
  // the tail-end pin swings in the TANGENTIAL-vertical plane.
  function stopTailTopAt(psi) { return tailTopIn(STOP_FRAME, psi); }
  function stopSolvePsi(post, prev) { return solvePsiIn(STOP_FRAME, HACK_ROD_LEN, post, prev); }
  const HACK_ROD_LEN = (() => {
    const t = stopTailTopAt(0);
    return Math.hypot(postEng.x - t.x, postEng.y - t.y, ROD2_PLANE_Z - t.z);
  })();
  const STOP_PSI0 = stopSolvePsi(postRel, 0); // released crank angle (sign follows the post's tangential side)

  // --- Pad placement on the crank, DERIVED. Under the radial hinge the pad
  // moves only in (tangential, vertical): z(ψ) = y·sinψ + z_top·cosψ.
  // The cosine term alone would RAISE a below-pivot pad as |ψ| grows, so
  // the tangential offset PAD_Y is solved from the release constraint. The
  // released pad face TILTS with the crank, so the constraint binds at the
  // face's WORST point — the top-face edge a pad radius toward the swing
  // (y = PAD_Y + r·sign(sinψ0)), not the centre:
  //   drop(ψ0) = −(PAD_Y + r·sgn)·sinψ0 + z_top·(1 − cosψ0) = HACK_DROP_MIN
  const STOP_PAD_TOP_LZ = HACK_CONTACT_Z - Z_STOP_PIVOT; // ruby top face, crank-local (negative)
  const STOP_PAD_Y = (STOP_PAD_TOP_LZ * (1 - Math.cos(STOP_PSI0)) - HACK_DROP_MIN) / Math.sin(STOP_PSI0)
    - HACK_PAD_TOP_R * Math.sign(Math.sin(STOP_PSI0));
  // Radial coordinate: the contact annulus is rotationally symmetric about
  // the balance axis, so the tangential offset just shifts the contact
  // azimuth — the pad's top-face centre stays at the derived radius:
  //   hypot(STOP_PIVOT_R + PAD_X, PAD_Y) = HACK_CONTACT_R
  const STOP_PAD_X = Math.sqrt(Math.max(0, HACK_CONTACT_R ** 2 - STOP_PAD_Y ** 2)) - STOP_PIVOT_R; // negative: inward
  if (Math.abs(STOP_PAD_Y) >= HACK_CONTACT_R)
    warn(`stop work: pad tangential offset exceeds the contact radius ${STOP_PAD_Y.toFixed(2)}`);

  // Hack rod: elbow link on the low plane, solved exactly like the reset
  // rod's (the endpoints here come from the crank solve; the slight z-slope
  // toward the crank end is carried by the placement quaternion).
  const HACK_ROD_ELBOW = (() => {
    const poses = [];
    let prev = STOP_PSI0;
    for (let t = 0; t <= 1.0001; t += 0.125) {
      const post = tailPostWorldAt(t);
      const psi = stopSolvePsi(post, prev);
      prev = psi;
      const tt = stopTailTopAt(psi);
      // §85 C1 — the pose carries its HEIGHTS as well as its plan: the post
      // end is pinned to the rod plane, the crank end rides the hanging
      // tail's top and climbs with ψ. That climb is the whole reason a flat
      // corridor model could not see the great wheel.
      poses.push({ a: post, b: { x: tt.x, y: tt.y }, za: ROD2_PLANE_Z, zb: tt.z });
    }
    const best = solveElbow(HACK_ROD_LEN, poses, lowRodObstacles, rodR,
      { eMax: ELBOW_E_MAX, plateLimit: plateR - rodR - CLEAR_MARGIN });
    if (best.atBound?.length)
      corners.push({ what: 'the hack rod\'s bend', value: `f ${best.f.toFixed(2)}, e ${best.e.toFixed(1)}`,
        bound: best.atBound.join(' and ') });
    if (best.clear < 0)
      warn(`hack rod elbow: best clearance ${best.clear.toFixed(2)} — the low corridor is fouled${best.at?.what ? ` at ${best.at.what}` : ''}`);
    return best;
  })();

  return {
    // declared spec + pad geometry
    HACK_CLEAR_MARGIN, HACK_RIM_I, HACK_SCREW_IN_R, HACK_SCREW_DROP, HACK_SCREW_STANDOFF,
    HACK_PAD_TOP_R, HACK_PAD_R, HACK_CONTACT_R, HACK_CONTACT_Z, HACK_DROP_MIN,
    STOP_ARM_T, STOP_ARM_W, STOP_PAD_RISE, STOP_TAIL_W, STOP_LEG_W,
    STOP_ARM_ROOT_X, STOP_HUB_HALF_X, STOP_LEAN_ALLOW, STOP_PSI_TARGET,
    // the station and the lever it sizes
    STOP_PIVOT_R, POST_STROKE, Z_STOP_PIVOT_LOW,
    STOP_BEARING, STOP_R_HAT, STOP_T_HAT, STOP_PIVOT, STOP_TANG_K,
    Z_STOP_PIVOT, STOP_TAIL_H, STOP_MAST_TOP, PAD_ARM_LOCAL_Z,
    // §86 A — which of these were decided by a fence rather than a field
    corners,
    // the linkage: its pose functions, its calibrated length, its route
    stopTailTopAt, stopSolvePsi, HACK_ROD_LEN, STOP_PSI0,
    STOP_PAD_TOP_LZ, STOP_PAD_Y, STOP_PAD_X,
    HACK_ROD_ELBOW,
  };
}
