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
export const Z_DIAL = -8.4;
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
  // §25 C tightened this constant: the sub-dial WELLS' walls descend through
  // the gear lane (z −7.0..−6.5), and their rings pass within (centre distance
  // − wellR) of the dial centre — the central SETTING WHEEL (tip 4.83) needs
  // wellR ≤ 15.4 − 4.83 − 0.2 (wall) − 0.15 (margin) ≈ 10.2. The old −4.5
  // (wellR 10.9) had the wall passing straight through the wheel's teeth,
  // masked in the sweep by the wheel⇄Dial EXPECTED blanket; the clearance is
  // boot-asserted at the alarm block.
  // §23: the owner's size knob — a factor over the SOLVED radius, so the
  // solve stays the source and the knob is a taste adjustment on top. The
  // §25 C boot assert still guards the wells against the setting wheel, so an
  // oversized factor warns at boot instead of silently colliding.
  const subDialR = (Math.min(RESERVE_LOCAL.y, -SECONDS_LOCAL.y) - 5.2)
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
