## Recently closed

- **The alarm could not ring under fast-forward** (was item 8). The whole
  trip — pin drop, release gate, `alarmReleased` — sat inside
  `if (!fastForward && syncPhase !== 'catchup')`, so with FF on the feeler
  was never evaluated and no alarm could fire. Measured before the fix:
  armed, wound, target 12:00, 30 sim-hours crossing the coincidence twice,
  `alarmPinDrop` never leaving 0. It mattered because FF is the ONLY
  control that reaches an alarm time — the time-scale slider spans
  0.001×..1× and cannot speed the movement up — so the one path a viewer
  takes to watch the alarm fire was the one path where it could not.

  Closed by suppressing CATCH-UP only. The two are different cases: a §9
  catch-up skips THROUGH the time it covers, while fast-forward travels TO
  the alarm deliberately. The gate's own rationale was about SOUND, and
  sound already has its own gate earlier in the tick, so the trip had been
  suppressed by a rule that was never about it. Two things came with it:
  FF now DROPS OUT at the release (the move the reserve already makes when
  it runs flat), and the ring HOLDS for that one tick — the release tick
  still carries the fast-forward `rawDt`, and ringing on it alone spent 87%
  of the alarm's power before the drop-out could take effect. Rings at tick
  164 after 11.06 sim-hours where it previously never rang.

  **The residual is a margin, and it is now instrumented rather than
  assumed.** The pin only bottoms across the notch's flat floor (~2.76 min
  of the 12 h disc) while an FF tick advances ~1.5 sim-min: 1.8×, and it
  SHRINKS with any change that narrows the notch. §38 proposes a 0.92 min
  window, at which a tick would step clean over and the alarm would
  silently not ring — the same symptom this item just closed, from a
  different cause. A step-over guard warns once if the coincidence is
  crossed in one tick without the pin bottoming, so §38 will hear about it
  rather than ship it. (The guard's first version fired on the first alarm
  anyone SET, because the crown moves the disc too; it now ignores ticks
  where `alarmSetRot` moved. Its SECOND blind spot surfaced 2026-07-29:
  the boot sync moves scripted mega-motion — the 'pull' phase jumps
  `crownRotation` to the wall clock in one assignment, and the catch-up
  advances minutes per tick — so the guard fired on a **virgin boot
  whenever the boot's wall-clock path happened to cross the default
  coincidence: a boot-silence gate that failed at some hours of the day
  and passed at others**, which is why CI never saw it (and why the first
  fix, gating only `'catchup'`, passed interactively and failed in CI the
  same afternoon — the crossing had moved phases). It now ignores
  fast-forward, EVERY active sync phase, and ticks where the TIME crown's
  `setPathRot` moved — quick-setting swings the hour phase under the disc,
  so a set-drag crossing is the user's hand there too, exactly the
  `alarmSetRot` case it already knew about.)

  Also surfaced while fixing it: the panel showed only the ROUNDED fire
  time under the label "Set for", which reads like the hand position. It
  now shows both — "Hand at" (continuous, since the friction coupling has
  no detent) and "Rings at" (rounded to the quarter mark). A hand at 3:07
  fires at 3:00, and the gap between the two IS the mechanism's setting
  resolution, which is what §38 exists to improve.


- **Winding click is plate-fixed** (was item 2), closed as part of the
  keyless-works move to the dial side. The ratchet slid down the fusee
  arbor to just above the base plate (under the great wheel) so the
  dial-side winding path could cross the plate legally — and at that plane
  the honest click mount became trivial: its own labelled unit
  (`Winding click`) on a short post standing on the plate's top face, beak
  in the ratchet's teeth, at the builder's original azimuth (a multiple of
  the 15° tooth pitch, preserving the beak-in-valley registration).
  MECH_GRAPH: support `Winding click → plate`, drive
  `Fusee & great wheel → Winding click`; the graph's `todo` entry is gone.

- **Setting arbor terminates at the motion works' minute wheel** (was item
  1). The dial-centre stand-in — a pinion cap beside the cannon pinion,
  meshing nothing — is gone: the arbor's traverse now ends one mesh
  distance from the minute wheel's axis (on the keyless side, the short way
  in), rises to the minute wheel's own plane, and its 8-tooth cap engages
  the wheel's real teeth at module MW_MODULE_1. The MW_* constants are
  hoisted to the top of main.js with the layout constants (the documented
  TDZ hazard), and MECH_GRAPH gained the drive edge
  `Keyless works → Motion works`. This removed all three FORBIDDEN
  overlaps (Dial⇄Motion works, Hour wheel⇄Keyless works, Keyless
  works⇄Motion works). The cap's rotation is still driven by handSetOffset
  (item 3's representational convention), with a rest phase aimed at the
  wheel.

- **Hairspring terminal fixed; swan-neck regulator added** (was item 4). The
  stud no longer belongs to the spring: it hangs from the cock slab's
  underside and clamps the terminal's end, and the spring is re-anchored so
  that end lands on the cock's own axis. Winding is now a change of
  geometry, not a rigid rotation — `makeHairspring` precomputes wind
  keyframes (inner boundary follows the staff, outer end fixed) and `tick()`
  swaps them via `userData.setWind(θ)`. On the cock's top face: an index arm
  on a collar around the jewel, swept 0.45 rad so its two curb pins drop
  over the open cutaway and straddle the terminal curve at its midpoint,
  dressed with a swan-neck spring and opposing adjuster screw. The stud is
  carried by the regulator ASSEMBLY — a concentric stud-carrier ring whose
  arm cantilevers over the open cutaway (0.9 rad off the cock axis, past
  the index at 0.45) and drops the stud to the spring plane in plain view,
  side-pinned —
  and the staff's upper pivot got a visible shock setting: hole jewel in the
  cock, capped endstone over the staff tip (0.17 endshake) held by a gold
  lyre spring. Declared in MECH_GRAPH (`Hairspring → Balance cock`,
  `Regulator → Balance cock`); support 0 failures, clearances 0 violations.


- **Jewel style unified.** `makeJewelSetting` (the 9 base-plate lower pivots
  and the balance cock stone) is no longer a brass-ring-plus-torus appliqué:
  it now builds the same flush rubbed-in look as the 3/4 plate and escape
  bridge — a low nickel collar carrying the counterbore (rim a hair proud,
  since the host meshes have no real bore cut) with the ruby annulus sunk
  below the rim on the bridge's 0.08 seat margins.

- **Balance cock level with the 3/4 plate.** The whole escapement z-stack was
  re-stridden for it (wheels thinned great 2.4→1.4 … escape 1.5→0.8, pinions
  3→1.6; L_CENTER/THIRD/FOURTH/ESCAPE dropped ~2.5), solved top-down from the
  cock goal. The plate's underside now takes the hairspring stack into its
  floor measurement, so cock and plate share one underside BY CONSTRUCTION
  (both = spring top + margin); the cock is a stepped piece — slab flush in
  the band over the cutaway, low tail block screwed to the plate top at the
  cut edge. The impulse-pin plane, hack tangency (error 0) and released gap
  (0.604) all survived the drop; sweeps clean (0 violations, no new
  FORBIDDEN pairs).

- **Hour hand had no motion works.** Was `hourHand.rotation.z = minuteA / 12` —
  the only ratio in the movement produced by an arithmetic operator. Now a real
  cannon pinion → minute wheel → minute pinion → hour wheel train, the hand
  mounted on the hour wheel's tube, with a centre bore in the dial for it to
  pass through. Verified 12.000000:1 through the tooth counts.
- **Nothing was properly supported.** 13 of 28 declared support edges had no
  geometry behind them (including all three train bridges and the balance cock,
  which floated 17.5 units off the plate it claimed to sit on). Fixed by lower
  pivots into the main plate for every arbor, a Glashütte-style three-quarter
  plate carrying the upper pivots, a base-plate-mounted combined escape/pallet
  bridge, and grounding for the lever furniture. Now 0 failures / 37 edges.
- **Pillars supported nothing**, rising to a top plate that did not exist. They
  now carry the three-quarter plate.

`checkSupportGeometry()` exists precisely because this class of defect was
invisible: the grounding check verified that declared edges formed a connected
graph, not that any geometry existed at the other end. Keep new parts declared
in `MECH_GRAPH` so they stay accountable.
