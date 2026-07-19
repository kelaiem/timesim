# TODO — mechanical realism backlog

Open work on the movement's mechanical honesty, kept here because it was
previously living only in chat transcripts and a session-local task list.

Most of these came out of a mechanical-engineering realism review that ranked
the movement's gaps by how badly they undermine "could this watch actually be
built". The support-structure findings (items 2, 3, 4, 7 of that review) are
closed — see *Recently closed* at the end. What remains is listed here.

**Verify any fix with the inspector** (`src/inspect.js`), not by eye:

```js
const I = await import('/src/inspect.js');
I.start(__clock, 'inspection', { includeExcluded: true });  // then poll I.status()
I.start(__clock, 'support');                                // must stay at 0 failures
I.start(__clock, 'clearances');                             // must stay at 0 violations
```

Use `start()`/`status()` rather than awaiting directly — the full sweeps take
100s+ and will blow a browser-eval timeout. Do **not** pass
`yieldEvery: Infinity` to "fix" that: it removes the cooperative yields, blocks
the main thread for the whole sweep, and wedges the tab.

---

## 1. Terminate the setting arbor at the motion works' minute wheel

**Status:** open. Causes the only 3 FORBIDDEN overlaps currently reported.

The keyless works builds a "motion-works arbor" that runs from the keyless
corner across the plate→dial gap and ends at the **dial centre**, in a small
pinion cap beside the cannon pinion (`src/main.js`: `settingB` ~1379,
`settingRise` ~1386, `settingCap` ~1423). It was a representational stand-in
for "the setting path reaches the hands".

A real motion works now occupies that space (cannon pinion → minute wheel 3:1
→ minute pinion → hour wheel 4:1, hour-wheel tube concentric over the cannon
pinion), so the stand-in collides with it. All three overlaps share this one
cause:

- `Dial ⇄ Motion works`
- `Hour wheel ⇄ Keyless works`
- `Keyless works ⇄ Motion works`

**Fix.** In a real watch the setting path drives the **minute wheel of the
motion works**, not the dial centre. Re-target `settingB`, `settingRise` and
`settingCap` onto the minute-wheel stud; size the cap off `MW_MODULE_1` /
`MW_MINUTE_TEETH` so it meshes real teeth instead of stopping beside them.
This removes a representational hop as well as the collisions.

- Minute wheel world XY = `(P.dial.x − MW_CENTER_D, P.dial.y)`. Note
  `dialFace` is Y-flipped, so dial-local `+x` maps to world `−x`.

**Hazard — this has bitten twice.** `MW_CENTER_D`, `MW_MODULE_1`,
`MW_MINUTE_TEETH` and `cannonPinionTeeth` are declared just above the dial
build (~2555), but the setting arbor is built ~1200 lines *earlier* (~1379).
Referencing them there is a temporal-dead-zone `ReferenceError` that kills the
whole module at load. Hoist the layout constants up with the other layout /
Z-stack constants near the top of `main.js` (they depend only on module and
tooth counts, so they hoist cleanly) and leave a pointer comment behind — the
file already uses that pattern for the keyless constants and the drum's lower
pivot.

**Done when:** 0 FORBIDDEN; support still 0 failures; clearances still 0
violations; and the hour-hand kinematics are unchanged — 12 sim hours ⇒ minute
−12 turns, intermediate arbor +4, hour wheel exactly −1 (ratio 12.000000).

## 2. The mainspring is not a force source

The spring spiral is a child of the drum whose rotation/scale are a direct
*readout* of tension (`main.js`, `springChild` in `tick()`). There is no
inner-end anchor to a fixed arbor and no setup ratchet, so the drum→chain
torque path never actually closes inside the drum — the one place in the
movement where power is supposed to originate.

The fusee, chain and cone geometry around it are good; they deserve a real
spring anchoring. Fix: anchor the spiral's inner end to the drum arbor and let
its wind state follow `barrelWindTurns`.

## 3. The winding click rides the rotating great wheel

Already documented in-code (`main.js`, near `fuseeRatchetGroup`) and in the
mechanical graph's `todo` list, but it breaks a primary force path: a click
anchored to the co-rotating arbor provides zero ratcheting resistance, so
nothing mechanically prevents the fusee unwinding. The existing comment
contains the right fix — mount the click on a plate-fixed post/bridge,
positioned so its beak still reaches the ratchet's tooth circle.

## 4. Hairspring has no fixed outer terminal, and no regulator

The stud rotates with the spring instead of being pinned to the balance cock,
so the oscillator has no fixed outer point — as built it could not actually
store and return energy, and the breathing animation scales about the wrong
constraint. There is also no regulator/index.

Fix: a pinned stud block on the cock with the spring's outer terminal fixed to
it, plus regulator pins straddling the terminal curve.

## 5. `handSetOffset` is assigned, not derived

The motion-works arbor now has real bevel-gear pairs at every corner, and the
hour hand's 12:1 is now real gearing — but the *driving value* for hand-setting
is still assigned directly in `tick()` rather than computed forward from the
crown's rotation through those gears' tooth ratios. Same representational
convention as the reserve train; lower priority than the items above because
the geometry is present and correct, only the number hops.

## 6. Smaller items

- **Jewel style is inconsistent.** The 3/4 plate and escape bridge use flush
  rubbed-in rubies; the 9 lower pivots in the base plate still use the older
  brass-ring-plus-torus `makeJewelSetting`. Largely hidden under the movement,
  but worth unifying.
- **Hack-pad assembly note.** The pad sits radially *inside* the balance rim's
  annulus, so the blade cannot be lowered vertically into place — it has to be
  fed in laterally below the rim plane. Tight but doable; worth a comment in
  the code so the constraint isn't lost.
- **Sweep runtime regression.** The full clearance/inspection sweeps took
  ~110 s before the z-restride and ~355 s after: the compressed stack packs
  far more part pairs into overlapping z-bands, so the AABB broad phase
  passes many more pairs to the BVH narrow phase per pose. If sweeps become
  a routine gate, revisit the tier-2 idea (batched WASM narrow phase) or
  prune EXPECTED pairs from the broad phase.
- **Inspector milestones** (`src/inspect.js` header TODO): extend
  `PENETRATION_BUDGETS` to pin-in-notch and chain-on-cone; allowed phase
  windows per budget; a continuity check for linkage branch flips; a
  known-good baseline so re-runs only flag regressions.

---

## Recently closed

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
