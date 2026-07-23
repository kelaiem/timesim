# BUILT — shipped features

How each non-obvious feature of the movement was designed and why: written
before it was built, then reconciled against the code after it shipped.
Source comments cite these by section number — `BUILT §7` in `src/main.js`
is §7 below. The numbering is non-contiguous because it is the original
filing order, kept stable so those references stay valid.

For the *mechanical-realism* debt list — honesty fixes to what already
exists, as opposed to new capability — see `../TODO.md`.

Every feature here inherited the project's standing rules: constants DERIVED
from constraints with the constraint written in a comment (`CLEAR_MARGIN =
0.15` is the one margin), every new part declared in `MECH_GRAPH`, and the
full inspector battery clean before landing (support 0 failures, graph
clean, penetration within budgets, clearances 0 violations, full
`inspection {includeExcluded:true}` 0 FORBIDDEN). Any part placed near the
low corridor must consume `LOW_LINKAGE_OBSTACLES` — the single source for
that band's swept footprint.

---

## 1. Jumping-minute setting (BUILT — PRs #28/#29)

**Goal.** Pair the existing seconds zero-reset with minute-perfect
setting: pull the crown → balance hacks and the seconds hand flies to
zero (already built); turn the crown → the minute hand advances in
whole-minute DETENTED jumps; push at the reference tick → the watch
restarts exactly synchronized. This is *setting-time* jumping only —
the running display stays continuous, so the jumper must engage only
while the crown is out.

**Why it also pays debt.** Building it properly closes `TODO.md` item 3:
the star's input angle is computed FORWARD from the crown's rotation
through the real setting-path tooth counts, replacing the assigned
`handSetOffset`.

### Mechanism

- **Star wheel**: 60-point star fixed to the MINUTE WHEEL (dial side —
  the motion works: cannon pinion → minute wheel → minute pinion → hour
  wheel; `MW_*` constants are hoisted at the top of `main.js`). One
  star point per minute of minute-hand travel; note the minute wheel
  turns once per ~3 h (cannon 3:1), so the star has 60 points per
  MINUTE-HAND minute = 180 points per wheel turn ÷ the 3:1 — derive the
  count from the actual `MW_*` tooth ratios, don't assume (acceptance
  test below pins it).
- **Jumper**: sprung detent lever (arm + rounded beak + return spring,
  date-jumper pattern; reuse the click/lyre-spring build styles) pivoted
  on the base plate's DIAL face near the minute wheel, beak seated
  between star points.
- **Engagement lifter**: the jumper only touches the star when the
  crown is OUT. Drive the lift off the existing setting-lever/yoke gang
  (the same eased `crownPullT` machinery that shifts the sliding
  pinion): crown in → jumper lifted clear by one margin; crown out →
  beak dropped into the star. One more finger on the setting lever, no
  new input path.
- **Friction**: setting slips through the cannon pinion's friction
  coupling exactly as today; the star/jumper sits downstream on the
  minute wheel, so a snap never back-drives the train.

### Implementation steps

1. **geometry.js**: `makeStarWheel({ points, radius, thickness })`
   (symmetric points — the ratchet builder's saw teeth are wrong here)
   and `makeJumper({ reach, thickness })` (pivot-origined arm + beak,
   0-based extrude, caller aims it — `makeClick`'s conventions).
2. **main.js placement**: star on the minute wheel's arbor at the
   `Z_SETTING`-adjacent plane; jumper pivot seat SOLVED by obstacle scan
   (pillar-scan pattern) against the dial-side set: keyless envelope,
   motion works, reserve train, dial feet, and the setting arbor's
   traverse. Beak-in-valley registration snapped to the star pitch
   (the detent/pawl precedent).
3. **Kinematics (tick)**: derive
   `starInput = setPathRot · (windPinion/settingWheel) · (…minuteArbor
   compound…) · (…to minute wheel)` from the declared tooth counts —
   this replaces `handSetOffset`'s assignment (TODO #3). Displayed
   minute-wheel angle while the jumper is engaged =
   `quantize(starInput, pitch)` with an eased snap (the `CAM_SNAP_TAU`
   convention); jumper beak animates with the geometric ride formula
   (measured seat + profile, lift sign derived — the pawl/detent
   precedent). On crown push-in, the jumper lifts and normal creep
   resumes from the snapped phase; seconds restart is already handled
   by `secondsZeroRef`.
4. **inspect.js**: unit `'Minute jumper'` — support
   `['Minute jumper','plate']` (dial-face pivot stud), drive
   `['Setting lever','Minute jumper']` (the lifter) and
   `['Keyless works','Motion works']` (existing); EXPECTED
   `['Minute jumper','Motion works']` (beak in the star); clearance
   budgets vs Dial, Keyless works, Hour wheel.
5. **Boot asserts**: beak seats in a valley within tolerance; the
   lifter's stroke actually clears the star by the margin at crown-in;
   the derived star pitch × points ≡ one minute-hand minute (ratio
   identity, printed if violated).

### Acceptance criteria

- Pull crown: seconds → 0 and hack (existing behavior unchanged);
  minute hand sits exactly on a minute index (jumper seats it).
- Turning the crown in setting mode advances the minute hand in clean
  single-minute snaps, both directions; the hour hand follows through
  the real 12:1.
- `handSetOffset` no longer assigned in `tick()` — TODO #3 moves to
  "Recently closed".
- Full battery clean; boot silent; jumper visible on the sapphire-dial
  side (it becomes display-side furniture — make it pretty).

---

## 6. Dial x-ray — dial goes transparent with the 3/4 plate (BUILT)

**Goal.** When Plate X-ray is on, the dial also goes glassy so the
dial-side works (keyless, motion works, reserve train, §1's minute
jumper) are visible from the front — effectively a live preview of
§3's sapphire dial.

**Mechanism.** `setXray` currently swaps ONE mesh's material
(`tqPlateMesh`, solid ⇄ pre-built `tqXrayMat` clone). The dial is not
one mesh: `makeDial` builds a disc (unique canvas-textured
`MeshPhysicalMaterial`), chapter ring (`MATS.silver`), per-subdial
recessed floors (unique canvas materials), well walls (one shared
`wallMat`), and applied markers (`MATS.steel`) — plus the dial feet
in `dialGroup`. So the single-clone pattern generalizes to a
one-time traverse of `dialGroup` building a `Map<origMat, xrayClone>`
(transparent, opacity ≈ the plate's 0.28, `depthWrite: false`,
roughness nudged glassward), and `setXray` swaps every cached mesh
both ways. Ride the SAME button and the same persisted `plateXray`
flag — the request is "when the plate is transparent", not a second
toggle.

**Risks.** Coplanar transparency sorting (markers/ring sit on the
disc with `depthWrite` off — expect some draw-order shimmer, same
regime the plate already accepts); hands and subdial hands are
`dialFace` siblings, not dial children, so they correctly stay
opaque. Keep the traverse scoped to the `Dial` unit's group so
shared `MATS.steel`/`MATS.silver` clones never leak to other parts.

**Relationship to §3.** This is §3's preview: the sapphire dial makes
the dial-side show permanent and pretty; this toggle proves the view
is worth building. If §3 lands with a real transparent dial material,
this clone set is subsumed and can be deleted.

Feasibility: small · Cost: ~40–60 lines in `main.js` (clone-cache
traverse + `setXray` extension), 0 new parts, 1 derived constant at
most (shared opacity with `tqXrayMat`) · Battery: material-only —
boot + visual check only.

**Acceptance.** X-ray on: motion works, keyless, reserve train and
jumper readable through the dial from the front camera; x-ray off:
dial pixel-identical to today; toggle round-trips with no material
leak onto non-dial parts (spot-check a train wheel and the crown).

## 7. Per-unit explode selector (+ label filtering) (BUILT)

**Goal.** Pick one component group and lift only it, so a single
unit's kinematics can be inspected without the full-stack explode —
and, as a side benefit, show only that unit's label.

**Verdict on complexity (this was the user's condition):** not much
more complex than the existing explode — small/medium, UI-only.

**Mechanism.** `explodeEntries` ({obj, baseZ, layer, dir}) already
holds per-unit records and `updateExplode` is a 3-line loop —
filtering is one condition. The missing piece is NAMES: `registerExplode`
takes none. But most explode `obj`s are the very same objects passed
to `registerLabel` (barrelArbor, centerArbor, … dialGroup, handsGroup
excepted), so a one-time identity join against `labelEntries`
(`labelEntries.find(e => e.obj === entry.obj)`, falling back to an
ancestor walk) names nearly every entry without touching the ~30
`registerExplode` call sites. Unmatched entries (`backPlate`,
layer 0) group as "Structure". UI: a `<select>` (or the presets-row
button style) listing "All" + the joined names; `updateExplode`
lifts only matching entries when a unit is chosen. Label filtering:
`updateLabels` loops `labelEntries` — hide entries whose name isn't
the selected unit (one condition; "All" keeps today's behavior).

**Risks.** A lone unit lifting while neighbors stay home WILL pass
through the three-quarter plate / dial on its way out — display-only,
but visually cheap-looking; mitigation is one line (when a unit is
selected, also lift `threeQuarterPlate`/`dialGroup` per their
existing entries, or auto-enable Plate X-ray). The chain registers
its label lazily on first tick (`labelEls` grows in `updateLabels`),
so build the selector list lazily or refresh it on open. No
MECH_GRAPH impact: nothing new exists, nothing moves in sim space.

Feasibility: small/medium · Cost: ~80–120 lines in `main.js`
(identity join, selector UI, two filter conditions), 0 new parts,
0 derived constants · Battery: no geometry — boot + visual check
only (verify the inspector's pose sweeps are unaffected: explode is
render-side and already excluded).

**Acceptance.** Selecting a unit lifts exactly that unit's entries
by the slider amount, all others home; "All" reproduces today's
explode bit-for-bit; with a unit selected and Labels on, only that
unit's label renders; selector includes the lazily-registered Chain
once it exists; plate pass-through mitigated (x-ray or co-lift).

## 8. Sound — synthesized clicks off the existing discrete events (BUILT — PR #30)

**Goal.** The movement makes its noises: the escapement's tic-toc,
the maintaining pawls' click-click while winding, the minute jumper's
snap during setting, the reset hammer's thunk and the crown's stem
click — all synthesized (no audio assets), all derived from state
`tick()` already computes every frame.

**Mechanism.** No loops; hook DISCRETE edges off the continuous
phases, one module-level "last index" per source:

- *Escapement beat* — `beatPhase(tau).n` increments (`F_BALANCE =
  2.5` Hz → 5 beats/s, 18,000 vph). Alternate two timbres by `n`
  parity — that parity is already the fork's bank side
  (`forkBankAt(n)`), so the tic/toc alternation is mechanically
  honest for free.
- *Maintaining pawls (winding)* — in `updateMaintaining(windBack)`
  the pawl tooth-phase `u = ((MAINT_PAWL_TIP_AZ − windBack)·
  MAINT_TEETH / 2π) mod 1` wraps once per tooth passage; each wrap
  is one snap. The two pawls sit π apart = exactly 12 pitches
  (`MAINT_TEETH = 24`), so they land in unison — one click event,
  not two. Detect in `tick()` (which owns `windBack`) rather than
  widening `updateMaintaining`'s signature.
- *Maintaining detent (running)* — same formula on the detent's
  `net = barrelArbor.rotation.z − MAINT_DETENT_AZ`; the barrel turns
  1 rev/8 h, so 24 teeth → one soft tick per 20 minutes of movement
  time. Nearly an easter egg; costs three lines, keep it.
- *Minute jumper (setting)* — while `jmpEngaged` (`crownPullT >
  0.5`), the quantized `target` in the jumping-minute block steps by
  `MIN_PITCH = 2π/60`; each index change is one snap (the eased
  `jumpDisp` follow-through on `CAM_SNAP_TAU` is the visual half of
  the same event).
- *Reset hammer + crown* — `crownOut` flips in `setCrownOut` (stem
  click, both directions); the hammer's fall is `leverEngage`
  crossing a threshold (~0.85) on the way up — one thunk per pull.

*Synthesis*: WebAudio, one lazy `AudioContext` — per event, a short
noise burst through a bandpass into an exponential-decay gain
(center frequency/Q/decay per source: beat ~4 kHz/6 ms, pawl
~2.5 kHz/10 ms, jumper ~3 kHz, hammer ~1.2 kHz/25 ms — tuned by
ear). Zero asset files. Autoplay policy: create/`resume()` the
context on first `pointerdown` (the crown-drag handler and panel
buttons are existing gestures).

*UI*: one panel row "Sound" in the `btn-xray` toggle pattern,
**default Off**. Default-Off also keeps `__clock.step`-driven
inspector/automated runs silent for free. Optionally persist the
toggle via `captureState`/`saveState` like `plateXray`.

*Fast-forward*: `fastForward` runs 45 coarse 2 s ticks per frame
(~5400×) — beats would be a ~27 k events/s buzz. Suppress all sound
events while `fastForward` is set (winding/setting can't happen in
FF anyway). The `timeScale` slider maxes at 1×, so FF is the only
fast case to gate.

*Hidden pane*: rAF suspension stops `frame()` → `tick()` → no edges
→ silence falls out naturally; there are no loops to pause. The
transients are ≤ tens of ms, so nothing meaningfully outlives the
last frame.

**Risks.** A clamped-but-large `rawDt` (tab restore: 0.25 s) can
step several beats in one tick — cap sounds scheduled per tick (say
3) and spread them over the stride via `ctx.currentTime` offsets,
so a hiccup never machine-guns. Multiple agents' shared-checkout
port caching doesn't apply (no new module files needed if the synth
lives in `main.js`; a separate `src/audio.js` is fine too but mind
the preview browser's module sub-import caching).

Feasibility: small · Cost: ~120–180 lines in `main.js` (synth ~40,
five edge detectors ~40, gesture/resume + panel row ~30, FF gating
+ per-tick cap ~15), 0 new parts, 0 geometry, no MECH_GRAPH entries,
no derived clearance constants · Battery: no geometry — boot +
visual check only (plus confirm an `inspection` run with sound Off
stays silent).

**Acceptance.** Sound On + running: 5 alternating clicks/s that stay
phase-locked to the visible pallet events; hack the balance (pull
the crown) → beats stop with it. Winding: one click per flange tooth
passage, in step with the visible pawl hops; silent while the crown
is idle. Crown pull → stem click + hammer thunk; each detent step
while setting → one snap, matching the hand's jumps. Fast-forward →
silence. Sound Off (default) → the app is bit-for-bit silent,
including `__clock.step` runs; no AudioContext is created until the
toggle is first switched On.

## 9. Dial epoch (boot at 1:51) + "Sync to now" button (BUILT)

**Goal.** The watch boots showing 1:51:00 instead of 12:00:00, and one
panel button sets the display to the viewer's wall clock.

**Why 12:00 today.** The hands are zero-referenced against `centerAt0`
(`minuteA = centerAngle(tau) − centerAt0 + handSetOffset`, `main.js`
~5608), so τ = 0 reads noon by construction. The epoch is therefore
one constant folded into that reference — and it is the honest one:
hands are friction-fit on their arbors at whatever angle the fitter
chooses, so a `DIAL_EPOCH` offset is a real thing a real watch has.

*Rejected alternative*: starting `tauIntegrated` at 6660 s. It would
claim 1 h 51 m of running against a full barrel (`barrelWindTurns`
defaults to 3.75, integrated separately) and a beat count of zero —
three readouts disagreeing about the same history.

**The readout is already wrong, and this exposes it.** `main.js` ~5868
prints `formatTime(tauIntegrated)` — raw movement time, ignoring
`handSetOffset`. So *today*, setting the time with the crown moves the
hands and leaves the panel behind. Fix it once here: a
`displayedTime(tau, handSetOffset)` helper deriving seconds from the
SAME offset the hands use (sign derived from `centerAngle`'s −2π per
hour, not guessed), rendered 12-hour to match the dial it mirrors.

**Sync mechanism.** The setting path is the only honest input, and it
is already a forward derivation: `rawSetOffset = −minuteArborSpin ·
(minutePinionTeeth / cannonPinionTeeth)` (~5576) comes from
`crownRotation` through real tooth counts. So invert that same chain
to solve the Δ`crownRotation` that lands the hands on the target, and
write it — programmatic writes to `crownRotation` are established
practice (the auto-wind block, ~5478). The setting path only engages
with the crown out, so the button pulls the crown, applies, pushes in;
the pull hacks and zeroes the seconds for free, and the push folds the
snap into `jumpCorr`, so §1's jumper lands the minute hand on an index.

**The seconds problem (the interesting half).** A real watch cannot
*set* seconds, only zero them — the reset hammer. Two levels were
filed here: **(a)** instant, assigning `secondsZeroRef` to the wall
clock's seconds, and **(b)** the watchmaker's procedure — set to the
NEXT whole minute, wait, push in on the tick — perfectly honest but
costing the user up to 60 s of waiting.

**BUILT: neither.** A third route removes the choice. Set to the
**previous** whole minute, push in, and let the watch **catch up** —
run it fast until it agrees with the wall clock. Aiming BACKWARDS is
what buys everything: the jumper quantizes the display to whole
minutes while the crown is out anyway, so a minute that has already
passed leaves a deficit that is always positive and always under a
minute, and there is nothing to wait for. (a) needed two assignments
(`secondsZeroRef`, plus `jumpCorr` for the sub-minute residual, which
the jumper discards by design). (b) needed none but sat idle for up to
a minute. **The catch-up needs none and waits for nothing**: the hand
movement travels the gears as a write to `crownRotation`, and the
catch-up is time-scale — a rate this app already treats as a
first-class user-facing control. Catch-up law and its constraint live
in `main.js`; sound is suppressed during it for the same reason
fast-forward suppresses it.

**Drift.** A synced clock at anything below 1× is wrong again within
seconds, so Sync snaps the scale to 1× (and refuses under
`fastForward`). The scale now DEFAULTS to 1×, so that snap is a
no-op unless the viewer has moved the slider. τ still
stops when the balance hacks or the barrel runs down: this is a
one-shot correction, not a slave loop. Optional: a "drift +N s"
readout next to the time, which makes the mainspring's rate error
legible instead of embarrassing.

**Persistence gap (CLOSED).** `state.js` `sanitize()` carried
`crownRotation` and `tauIntegrated` but not `jumpCorr`, so a folded
setting correction was silently lost on reload (bounded by half a
minute of hand travel, but visible). `jumpCorr` now rides
`defaultState`/`sanitize`/`captureState`, read back with `?? 0` so
states saved before this survive. `secondsZeroRef` was never needed —
nothing assigns it.

### What was built

1. `DIAL_EPOCH_S` / `DIAL_EPOCH_ANGLE`, folded into `minuteA` only —
   not into `centerAt0`, which also feeds the gear mesh offsets, and
   not into `handSetOffset`, which drives setting-path furniture that
   has no business carrying a hand-fitting angle. Boot assert that the
   epoch is a whole number of minutes, or the jumper's index grid and
   the dial disagree.
2. `displayedSeconds()` + a 12-hour `formatTime`; the readout reads it
   instead of raw `tauIntegrated`. `__clock.displayTime` / `.dialEpoch`
   expose it, since τ alone cannot be checked against the dial once the
   crown has been turned.
3. `HAND_RAD_PER_SET_RAD` — the setting chain as one coefficient, so
   the solve can invert it, asserted at boot against the same forward
   chain `tick()` walks.
4. The sync script (`syncStart`/`syncUpdate`, phases pull → settle →
   push → catchup) and its catch-up law; `setTimeScale(1)` on start.
   Cancelled by the crown button, a crown drag, the scale slider or
   pause — a hand on the controls outranks the script.
5. One state field (`jumpCorr`), not three.
6. Panel row `Sync / Now`, disabled under fast-forward and pause.

Cost as built: ~150 lines in `main.js`, 6 in `state.js`, 0 new parts,
0 geometry, no `MECH_GRAPH` entries · Battery: no geometry — boot +
visual only; `__clock` pose-driven inspector runs are unaffected
(`setPose` ticks with zero dt, which the jumper's ease respects).

**Acceptance (met unless noted).** Cold boot with no saved state:
hands read 1:51:00, `displayTime − τ = 6660` exactly and still exactly
at τ = 3600, and the panel readout agrees with the hands. Setting-path
inversion moves the hands +600 s and −180 s exactly as asked. Sync
lands the minute hand on the wall clock's previous index, then closes
the remaining deficit by catching up — NOT "within one frame", and the
minute hand creeps off its index as it does, which is what a running
watch does. The scale reads 1× afterwards. Manual crown setting now
moves the readout with the hands. Sound stays Off by default and is
suppressed during the catch-up.

*Not verified:* that 1:51 does not mask the small-seconds or
power-reserve subdials — the framing rationale for the pose. Needs a
look from the `Dial` preset.
*Not measurable under automation:* end-to-end convergence timing. The
preview pane only renders during screenshots, so the wall-clock gap
grows faster than the catch-up closes it. The law was confirmed at
both ends (21.0× at its cap, 1.2× at a 0.12 s gap) and one convergence
was observed while frames were briefly live.

## 12. Time-scale readout — `1×` at the top, how slow below it (BUILT)

**Goal.** The scale readout currently prints a bare number
(`0.15×`) that means nothing without knowing where the slider's ends
are. At the top of the slider `1×` says everything it needs to — no
"real time" gloss, the symbol IS the statement. Every position below
it should say how slow it actually is.

**What the slider already is.** `SCALE_MIN = 0.02, SCALE_MAX = 1`, log
mapped over 0–1000 (`main.js` ~4835–4853), so the right end is exactly
1×. The whole feature is the two lines that write
`scaleValueEl.textContent` (initial + `input` handler); factor them
into one `formatScale(timeScale)` and there is exactly one place to
change. Note the top should read `1×`, not `1.00×`: the current
`toFixed(2)` is what makes the unity case look like a measurement
instead of a statement.

**What the descriptor should be derived from, not adjectives.** Two
honest facts, both already computable:

- *The ratio*: `1 / timeScale` → "6.7× slow". Direct, and it is the
  number a viewer needs to convert what they see into real seconds.
- *The beat*: `2 · F_BALANCE · timeScale` beats/s (5/s at 1×, from the
  constant §8 already hooks). This is the fact that MATTERS at these
  settings — around 0.15× is roughly where the escapement's
  unlock-impulse-drop sequence becomes followable by eye, and a readout
  of "0.75 beats/s" says that better than any adjective could. (The
  scale later defaulted to 1×: the movement should boot running at the
  speed it claims to run at, and slowing it down is then the viewer's
  deliberate act rather than a state they have to notice and undo.)

Suggested rendering, in the panel's existing two-tier style: the
`readout` line stays terse (`1×` at the top, `0.15× — 6.7× slow`
below) with the beat rate on the `label-small` line beneath it. Resist
a lookup table of words ("glacial", "study", "brisk"): the numbers are
derived, the words would be invented, and this project's standing rule
is that constants come from constraints.

**Two edges worth getting right.**

- *Detecting the top.* The unity case is the one that renders
  differently — bare `1×`, descriptor suppressed — so it has to be
  detected exactly. `sliderToScale(1000)` is `0.02 · 50^1`, which in
  floating point can land at 1.0000000000000002: do NOT compare the
  scale to 1 with `===` or invent an epsilon. Test the slider's
  integer position against its max, which is exact.
- *A THIRD edge, found in testing.* One notch below the top the scale
  is 0.9961, which `toFixed(2)` rounds to `1.00×` — the readout
  claiming a unity that position does not have, beside a slow-ratio
  that rounds to `1.0× slow` and says nothing. Unity is a distinct
  state here, so that case gains a digit (`0.996×`) rather than
  borrowing the top's identity, and the ratio clause drops out once it
  rounds to 1.0. Built that way.
- *Fast-forward outranks the slider.* `fastForward` steps ~5400×
  independently of `timeScale` (§8's note), so while FF is on a label
  reading "0.15× — 6.7× slow" is simply false. The readout must defer
  to FF (`fast-forward — 5400×`, or grey the slider) whenever it is
  engaged. Same for `paused`.

**Relationship to §9.** Sync-to-now snaps the scale to 1×; this label
is how the user sees that happen and understands why it had to.

Feasibility: trivial · Cost: ~20–30 lines in `main.js` (one
`formatScale` helper, two call sites collapsed into it, FF/pause
deference, one derived beat-rate expression), 0 new parts, 0 geometry,
0 new constants · Battery: none — boot + visual check.

**Acceptance.** Slider at maximum: reads `1×` and nothing else — no
gloss, no trailing zeros — and that rendering appears at the slider's
max position exactly (no float epsilon). Anywhere below: reads the
scale AND its slow-down ratio, with
the beat rate legible nearby; at the 0.15× default the beat rate reads
0.75 beats/s and matches the balance the user is watching. Fast-forward
on: the readout says so instead of reporting the slider. Paused: the
readout does not claim the movement is running at any rate.

## 11. Spatial sound — distance and direction for the click track (BUILT)

**Goal.** §8's click track comes from everywhere at once. The movement's
noises should come from WHERE the parts are: zoom out and it gets
quieter, orbit past the escapement and its tic-toc moves between the
ears.

**Mechanism, as built.** Every `sndClick(freq, q, decay, gain, when,
emitter)` call in `main.js` (~5515) now takes an optional sixth
argument, a `THREE.Object3D` already in scope at the call site — no new
emitter registry, since the six timbre wrappers in `SND` already close
over the objects they need: `forkGroup` for the beat, `maintDetent` for
both the winding pawls and the running detent tick (the pawls aren't
separately named objects, so their carrier stands in), `jumperUnit` for
the minute snap, `hammerGroup` for the reset thunk, and `crown` for the
stem click.

- *Direction.* `sndSpatial(emitter)` takes `v = worldPos −
  camera.position`, reads `cameraRight` off `camera.matrixWorld`'s
  first column, and clamps `v̂ · right` into a `StereoPannerNode`
  inserted between the per-click gain and the master chain. Equal-power
  panning, not an HRTF `PannerNode` — the camera framing already gives
  front/back and elevation cues, an HRTF panner would only buy those on
  headphones.
- *Distance.* The inverse law `gain = ref/(ref + rolloff·(d−ref))`,
  clamped to ≤ 1. `ref` is NOT a guessed number: it's the Escapement
  camera preset's own framing radius (cluster radius × 3.8 — the same
  rule `camTargets` uses), so the default view plays every §8 level
  exactly as tuned. `rolloff` is solved so the orbit's far limit
  (`controls.maxDistance = plateR·12`) lands at −25 dB rather than
  silence; the near limit (`plateR·0.35`) is what the ≤ 1 clamp exists
  to protect.
- *Snapshot timing.* A source can't move during its own ≤30 ms
  transient, so spatialization is captured once, synchronously, inside
  `sndClick` — not deferred to `audioCtx.currentTime + when`. The one
  wrinkle: three.js only recomputes `matrixWorld` at render time, and
  up to 12 fixed ticks can run per displayed frame, so reading a
  moving part's world position mid-tick without forcing an update
  would read last frame's pose. `movement.updateMatrixWorld(true)` runs
  once at the top of the sound edge-detection block in `tick()`
  (~6272), before any emitter positions are sampled that tick.
- *Master chain.* One `GainNode` → one `DynamicsCompressorNode` →
  `audioCtx.destination`, built lazily in `ensureAudioGraph()` alongside
  the `AudioContext` itself (same gesture-gated creation as before). All
  per-click panners connect into the master gain rather than the
  destination directly. The compressor exists because a beat cluster
  (three impacts) can land on top of a pawl click at near field; the
  gain node is also where a future volume slider would hook in.

**Dial-side occlusion, built without a hardcoded emitter list.** The
backlog's original mechanism ("a lowpass whose cutoff falls with the
dot product against the dial normal", tied to the x-ray flag) shipped
in a simpler form once actual part positions were checked: every
going-train pinion sets `position.z = 0` (`greatWheel`, `centerPinion`,
`thirdPinion`, `fourthPinion`, `escapePinion`), so world Z=0 IS the
plate baseline, and `movement` carries no rotation (`scene.add(movement)`
with none set), so world Z already is the stacking axis — no matrix
work needed. `sndSpatial` compares `emitterWorldZ * camera.position.z`:
opposite signs means the plate sits between the camera and the source,
so it gets muffled (a `BiquadFilterNode` lowpass, plus a mild gain
multiplier) unless x-ray has made the plate/dial glassy. Checking the
actual numbers first paid off: `hammerGroup`'s Z resolves to ≈+2.19
(front/train side, alongside the escapement) even though the backlog's
Risks section had grouped "jumper, keyless, hammer" together as
dial-side sources — that would have been a confidently wrong hardcoded
list (§10's own lesson). Computing each emitter's real Z instead means
the rule is fully general and symmetric: the escapement gets muffled
too, correctly, if you view it from deep on the dial's own side.
Tuning note: the first cutoff (900 Hz) nearly silenced everything, since
the `SND` timbres center as high as 5200 Hz and a narrow-Q bandpass
transient has almost nothing left below a cutoff that far under its
center — muffled has to still be clearly a SOUND, not a dropout. Settled
at 2400 Hz (above every source's low body tone) plus a 0.65× gain dip,
tuned by ear after a first pass read as broken rather than muffled.

**Sound-event highlight (not in the original backlog — added during
build).** The user asked, mid-implementation, for the part making a
sound to visibly light up. First pass was a separate glow-sprite
tracking each emitter's world position, added specifically to dodge a
real hazard: these parts' materials are shared scene-wide via `MATS.*`
and ALSO independently owned by the power-flow view (`pfApply`, which
lazily clones and tints `forkGroup`/`maintDetent`/`windSpinner`'s
meshes while it's on) — mutating emissive directly looked like it would
fight that feature for the same material slot. The overlay read as an
alarming floating blob, so it was replaced with what was actually
wanted: a direct emissive tint on the part's own cloned material
(lazy-cloned per mesh, first flash only), which turned out fine to
accept the power-flow overlap rather than engineer around it — two
optional, user-toggled features occasionally trading the last write
within one frame on `forkGroup`/`maintDetent`/`crown`'s materials is a
minor, accepted cosmetic edge case, not a crash; `jumperUnit` and
`hammerGroup` sit outside every power-flow group so they never see it
at all. Real-time decay (`SND_FLASH_DECAY`, 0.35 s) via `updateSndFlash`
in `frame()`, independent of `timeScale` — same reasoning as
`CAM_SNAP_TAU`.

**Deliberately deferred, not built.** The master volume slider was
scoped as optional in the original entry and stayed out of this pass —
the master `GainNode` it would drive already exists.

Cost as built: ~150 lines in `main.js` (master chain ~10, spatial +
occlusion helpers/constants ~45, `sndClick`/`SND` signature changes
~30, `updateMatrixWorld` forcing call ~5, sound-event highlight
~45–60), 0 new parts, 0 geometry, no `MECH_GRAPH` entries (the
highlight touches no new scene-graph nodes — it retints existing
meshes in place) · Battery: no geometry — boot + listening/looking
check only.

**Acceptance (met).** Boot console stays clean (no new warnings).
Orbiting around the movement with Sound On moves the beat between
channels, reversing as the camera crosses the escapement's axis.
Zooming from near to far drops the level smoothly without hitting
silence at the far limit. Switching between the Escapement and Dial
camera presets makes dial-side sources (jumper, crown) noticeably
duller from the train side without going silent, and un-mutes when
x-ray is on. Each click reads as a brief, subtle warm glint on the part
that made it. Sound Off and fast-forward remain exactly as silent as
§8 built them — neither code path changed.

## 15. The UI panel now fits a phone (BUILT — PR #3)

**Goal.** `#clock-ui` is usable on a phone.

**What was wrong.** The panel was `width: 240px` at fixed `top/left: 14px`
with no `max-height` and no scroll, carrying 24 `.row`s plus four `<hr/>`
rules, the camera presets row, and the state buttons. On a 667px-tall
viewport the bottom of the panel — Finish and State — sat off-screen and
unreachable. The Hide/☰ chip could push the panel out of the way but was
itself useless while small: nothing let you *use* the lower controls.

**What shipped — both the floor and the real fix, not just the floor.**
The backlog scoped a minimum (scroll floor) and a real fix (collapsible
sections). Both landed together in one pass:

- *Scroll floor.* `#clock-ui` gained `max-height: calc(100vh - 28px)` and
  `overflow-y: auto`, so the panel can never exceed the viewport and
  scrolls internally instead.
- *Collapsible sections.* Every control row is grouped into a native
  `<details>` disclosure — **Time, Camera, View, Finish, State** — with
  only **Time** open by default (`open` attribute). The panel now opens
  compact and the viewer discloses what they came for. The four `<hr/>`
  dividers and the `#clock-ui hr` rule they used are gone, replaced by a
  `.ui-section` `border-top` between sections (suppressed on the first, to
  avoid doubling the divider under the `<h1>`).

**Deviation from spec: `box-sizing: border-box` was required, and added.**
The backlog wrote the floor as exactly `max-height: calc(100vh - 28px)`.
That number is correct arithmetic (14px inset top + 14px bottom) *only* if
it sizes the whole visual box — but `#clock-ui` is default `content-box`,
so the raw floor sizes the content box and the 14px padding + 1px border
then push the rendered box ~30px past the intended inset. The panel's own
bottom lands below the fold and the lowest controls stay unreachable **even
with `overflow-y: auto` on**, because the scroll container's bottom edge is
itself off-screen. Adding `box-sizing: border-box` makes the 28px mean the
whole box, which is what the spec's arithmetic assumed. Measured on the
running app at 375×667: default (Time only) bottom at 551px; all sections
open, bottom at 653px and the body scrolls; the Save button (last control
in State) is on-screen after scrolling to the bottom — the exact control
the old layout buried. Side effect of border-box: content width narrows
240→~206px; presets wrap one button later, verified cosmetically fine.

**It stayed 0-logic, as estimated.** No behavioral JavaScript changed: no
event handlers, no open/close state machine, no measurement code — native
`<details>` owns the disclosure state, which is exactly why it was chosen.
Every `id` and `class` is preserved verbatim, so the existing
`querySelectorAll('#clock-ui .presets button')` and the ~30
`getElementById` wirings (pause, crown, sync, explode, labels, x-ray,
power-flow, sound, light, flute, save/load/clear) bind unchanged. The one
structural edit outside markup: the dynamically-built State section changed
from `document.createElement('div')` to `createElement('details')` plus a
`.ui-section` class, purely so it folds like the template sections — still
zero added logic.

**Reused by §23.** The `.ui-section` / `summary` styling — custom `▸`
disclosure marker that rotates 90° on `[open]`, hover state, section
borders — is the disclosure mechanism §23 was told to reuse, built once
here rather than inlined.

**Source.** All in `src/main.js`: the scroll floor on `#clock-ui`
(`box-sizing` + `max-height`, ~4918), the `.ui-section` disclosure styles
(~4927), the sectioned panel markup (`panel.innerHTML`, ~4986), and the
appended State `<details>` (~5800). Each site carries a `BUILT §15` comment.

Cost as built: PR #3 was +110/−66 in one file; net new markup + CSS is
~40–70 lines (the balance is existing rows re-indented into section
bodies), 0 logic, 0 geometry, no `MECH_GRAPH` entries · Battery: none —
pure UI/DOM, no parts and no geometry to sweep.

**Acceptance (met).** On a 375×667 viewport the panel opens within the
screen with only Time expanded; opening every section scrolls internally
rather than overflowing; Finish and State — unreachable before — are
reachable; every original control still responds (ids/classes unchanged);
boot console stays clean. Verified in the live app, not only in isolation.

