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

## 5. "See the minute jumper in action" — Setting preset + guided demo (BUILT)

**Goal.** One click frames the §1 jumping-minute works and walks the
pull → snap → set → push cycle, so the mechanism sells itself instead of
hiding on the dial side. Two independently shippable halves — a camera
preset and a scripted demo — that share nothing new mechanically: the demo
is a *scripted user*, driving the same inputs a viewer would.

### Half 1 — the `Setting` camera preset

- A fifth `data-cam` button in the presets row (`src/main.js` ~5040) and a
  `Setting` entry in `camTargets` (~5994). The button wiring was already
  generic (`goToPreset` reads `dataset.cam`), so this is one object literal
  and one line of markup — as the plan scoped it.
- **Target derived, not eyeballed.** The whole cluster — star, beak,
  spring, lifter — lives within `JMP_PIV_R` of the minute-wheel stud, so the
  stud IS the frame's centre. Its world position comes through the `dialFace`
  Y-flip (`dialFace.rotation.y = π` ⇒ dial-local `(x,y,z)` ↔ world
  `(P.dial.x − x, P.dial.y + y, Z_DIAL − z)`): target
  `(P.dial.x − MW_STUD.x, P.dial.y + MW_STUD.y, Z_DIAL − STAR_MID)`. Framing
  radius `R = JMP_PIV_R + STAR_R`, camera `3.8×R` off the target by the same
  42° FOV fit rule the other presets use (documented in the `camTargets`
  header), on the −Z (dial) side like the `Dial` preset.
- **Why the dial side, and `reveal: 'xray'`.** The jumper sits *between* the
  dial and the plate (mesh Z ≈ −4.6…−6.7 against the dial at Z_DIAL = −7), so
  from the dial side the only thing occluding it is the thin dial — from the
  movement side the entire going train and barrel would. So the frame is
  dial-side, and the preset carries `reveal: 'xray'`; `goToPreset` honours it
  by turning x-ray ON (never off — a camera move shouldn't silently un-glass
  a viewer's plates). Without it the button would tween to a solid dial back;
  with it, the star and jumper read through the glassed dial. Verified in the
  live app: the target lands on the stud at world `(−6, 0, −4.75)`, x-ray
  flips to On, and the cluster is centred.

### Half 2 — the guided demo (the scripted-user engine)

The `Demo` button runs a small step list through a shared engine (see §17 —
the engine was built here as the concrete case and generalised there, one
step-runner, not two). `DEMO_STEPS` (`src/main.js` ~6219):

1. `preset: 'Setting'` at `scale: 0.3` — frame + slow down.
2. `crown: 'out'` — waits for `crownPullT > 0.95` (the stem reaches the
   setting position); the seconds hack and fly to zero for free, both §1.
3. `turnMinutes: 4` — feeds a scripted setting turn (see below) so ~4
   detents snap out.
4. `crown: 'in'` at `scale: 1` — the jumper lifts, the watch runs on.

- **Setting turns travel the gears (rule 2).** A turn step converts minutes
  to crown rotation with the movement's OWN chain, exactly as §9's sync does:
  `(minutes·60·MIN_HAND_RAD_PER_SEC)/HAND_RAD_PER_SET_RAD`, fed onto
  `crownRotation` at `SCRIPT_SET_RATE` — itself derived from
  `SCRIPT_SET_MIN_S = 0.7 s` per detent (a beat is ~0.2 s and the snap eases
  over `CAM_SNAP_TAU = 0.06 s`, so 0.7 s/min leaves a clear gap between
  snaps), not a hand-picked rad/s. The feed is gated on `crownPullT > 0.5`
  so it can only ever drive the setting path, mirroring `tick()`'s own gate.
- **Real-time snap, on purpose.** The turn is fed on real dt, so — like the
  snap ease it triggers — the detents play at real cadence regardless of the
  time-scale slider. This is the slow-motion fork the plan flagged: slowing
  the snap would need a scripted multiplier on `rawDt` in that one easing; it
  reads fine at real speed since the snap is the point, so it was skipped.

**Acceptance (met).** Verified unattended via the deterministic frame hook
(`__clock.advanceFrame`, added because rAF is fully paused in a backgrounded
automation pane): the demo runs 0 → 1 → 2 → 3 → done, crown out at step 2
(`leverEngage` 0.99, `balanceRate` 0.05 — hacked), the turn produces **5
distinct whole-minute detents** (start + 4 snaps) advancing exactly 4
minutes and landing on an index, and it ends **running** (`balanceRate` 1.0,
crown in). The `Setting` button tweens to the framed, x-rayed cluster.

## 17. Guided tour — §5's demo generalised (BUILT)

**Goal.** A first-time viewer is *shown* what to try instead of being handed
24 controls. The tour is §5's guided-demo pattern generalised: a longer list
of declarative steps driven by the SAME engine — one step-runner, not two.

### The shared engine

`scriptEnterStep` / `scriptUpdate` / `scriptStart` / `scriptStop`
(`src/main.js` ~6101–6216) interpret a step's declarative fields:
`preset`, `scale`, `crown` (`'out'`/`'in'`), `turnMinutes`, `wind`, `sync`,
the view toggles (`xray`, `labels`, `powerflow`, `sound`), `explode` (eased),
`unit`, plus `caption` and `dwell`. On enter the immediate setters fire
(toggles, then camera, then crown/turn/sync — so a preset's `reveal:'xray'`
can be overridden by an explicit `xray:false` in the same step). Each frame,
the step's *dynamic* actions must settle — crown reaching position, the turn
spent, a wind drained, a sync run all the way through catch-up, the explode
eased in — before the `dwell` clock starts; then it advances. The caption
renders in a single bottom banner (`#clock-caption`, ~pointer-events:none so
a click still reaches the canvas and cancels).

**`DEMO_STEPS` and `TOUR_STEPS` are the only two lists** (~6219, ~6229);
there is no second state machine. The tour's jumper stop even reuses the
demo's own `crown`/`turnMinutes` vocabulary verbatim, proving the reuse.

### Interaction contract — §9's `syncCancel`, generalised

Any real user input ends the script at once: `scriptStop` is armed on
capture-phase `pointerdown`/`keydown`/`wheel` on `window` while a script
runs, and disarmed when it stops. A click on the Guided buttons themselves
is exempted (`e.target.closest('.script-ctrl')`), so those toggle the script
rather than cancelling it. A script never dispatches DOM events — it calls
the underlying functions — so a captured DOM event is always the user taking
over. Like `syncCancel`, `scriptStop` STOPS rather than undoing: whatever the
script last set stays. The one thing it must release is a mid-flight scripted
sync's catch-up rate (it calls `syncCancel`), or the movement would keep
running fast with no script to end it.

### The stops

Intro (whole movement, reset to a clean view) → escapement at `scale: 0.05`
(with §12's honest readout narrating "20.0× slow · 0.25 beats/s", relied on
rather than a parallel indicator) → winding (`wind: 16` at `scale: 1` — the
chain climbs the fusee cone) → the going train with power-flow on → x-ray +
explode with labels → the dial-side jumper, operated via a pull/turn/push
inline (the demo's vocabulary) → sync to the wall clock → sound → outro
(everything reset, watch running).

**One derived-constant bug found and fixed in verification.** The winding
step first inherited the escapement step's `scale: 0.05`; auto-wind drains in
*sim*-time, so at 0.05× a ~2 s wind stretched to ~43 s. Setting the winding
step's `scale: 1` explicitly (with the constraint in a comment) brought it to
3.7 s.

**Acceptance (met).** Verified unattended via `__clock.advanceFrame`: the
tour runs all 11 stops 0 → … → 10 → done in ~37 s, each framing its subject
with a caption and dwelling, and ends **running** (`balanceRate` 1.0). A
`keydown` mid-turn and a `pointerdown` during the sync catch-up each cancel
cleanly (script null, caption hidden, `balanceRate` settles to 1.0 — no
runaway catch-up).

**Battery.** Both §5 and §17 add no geometry and no parts — no `MECH_GRAPH`
entries — so the cost was boot + visual check with the inspector kept green:
support 0 failures, clearances 0 violations, full
`inspection {includeExcluded:true}` 0 FORBIDDEN, boot console clean.

### Deep links — the same two surfaces, from a URL

`applyDeepLink()` (`src/main.js` ~6354, run once at boot) reads the query
string onto the **same** two surfaces the Guided buttons drive: the script
engine (`?tour` / `?demo`) and the raw view state its steps set (`?preset`,
`?scale`, `?xray`, `?explode`, `?labels`, `?powerflow`, `?sound`, `?unit`,
`?crown`, `?reserve`, `?hud`). No new code path — the state params go through the very
setters `scriptEnterStep` calls, so a link like `?preset=Escapement&scale=0.05`
reaches the pose a script step would and then just sits there as ordinary
interactive state. `?demo=1` starts the matching script exactly as its button
would.

Ordering is deliberate. State params apply **first and unconditionally**,
before the `?tour` / `?demo` branches return, because a script's steps only
touch the fields they name (`TOUR_STEPS`/`DEMO_STEPS` never set
`barrelWindTurns`) — so a base like `?tour=1&reserve=0.3` survives into the
tour instead of being skipped. Malformed input is inert: `goToPreset` no-ops
on an unknown name, and unparseable numbers fall back via `|| ` (1 for scale,
0 for explode/reserve) — nothing throws on a bad link. `?reserve` is a
fraction of the 30 h bank (`RESERVE_BARREL_TURNS`), the same 0..1 vocabulary
`__clock.setPose`'s `p.tension` already uses, so the barrel has somewhere to
wind *to* on load instead of starting flat against the full stop.

**The tour is gated; state params are not.** `?tour=1` goes through
`askTour`'s confirm/skip overlay (`#clock-tour-gate`) before anything runs — a
deep link is not itself a user gesture the way a button click is, and must not
swing the camera/crown/sound unattended before the visitor has agreed.
Proceed calls the *same* `scriptStart(TOUR_STEPS, …)` the button uses. The
state params are lower-stakes (applied once, no camera sweep, no sound) and
need no gate.

**Audio needs a real gesture.** A restored, deep-linked, or scripted
`sound:true` can call `setSound(true)` with no trusted event behind it, and
autoplay policy then leaves the `AudioContext` `suspended` forever — §8's
`sndClick` drops every tick with nothing on screen to say why. Two fixes:
capture-phase `pointerdown`/`keydown` on `window` resume the context on the
next real input whatever it is; and `scriptStart` creates/resumes it
synchronously inside the tap that launched the script, rather than waiting for
whichever step first sets `sound:true` (which runs frames later out of
`scriptUpdate`, well outside any trusted event — exactly the resume that gets
silently ignored).

**A latent restore bug `?reserve` exposed — and closed.** `crownRotDelta` in
`tick()` is `crownRotation − lastCrownRotation`, but on load `crownRotation`
was restored from saved state while `lastCrownRotation` stayed `0`. The first
tick then replayed the *entire* restored crown history as one positive delta,
which the winding path (`barrelWindTurns += …`) clamped to full on frame one.
That silently re-wound a drained reserve on **every** reload — invisible only
because `barrelWindTurns` was normally *also* restored to full, so the phantom
wind re-clamped to the same number. `?reserve` is the first caller to start
the barrel *below* full, so the phantom wind erased it. Fix: seed
`lastCrownRotation = crownRotation` in the restore block, so the first tick
sees a zero delta. The restored angle is input already delivered to the gears
last session (and already reflected in the restored `barrelWindTurns` and hand
offset), not new turning — measuring the delta from `0` double-applies the
whole history. Adds no geometry; the battery verdicts are unchanged.

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

---

## 13. Layout as a SPEC (BUILT — PRs #8, #15–#17)

`main.js`'s evaluation order IS its architecture: 6,400+ lines of
module-level `const` where a number cannot move without knowing everything
downstream of its line. §13 untangles that in ordered, verifiable steps —
these first three shipped, each proven a pure relocation.

**Step 0 — the geometry fingerprint (`src/inspect.js`).** The battery
answers "is the movement still LEGAL?"; a refactor also needs "is it still
the SAME?", which the battery cannot answer (a part can move and stay
legal). `fingerprint()` hashes every labelled unit's world AABB over a rest
pose plus one pose per force input into one 32-bit number;
`fingerprintFull()`/`fingerprintDiff()` localise any mismatch to the unit
and pose that moved. Making it reproducible surfaced two real gaps, both
fixed rather than papered over: `setPose` inherited the persistent user
inputs that place the HANDS (raw crown angle, banked clutch rotations, the
jump-snap correction), so a hash depended on session history — closed with
`__clock.resetInputs()`; and the display-only chain is path-dependently
tessellated (~0.02 AABB wobble), so it is excluded by name, with the
reason. Baseline on the pre-§25 tree: `1605788245` (7 poses).

**Step 1 — the pure constants (`src/layout.js`).** The kinematic constants
(`F_BALANCE` … `RECOIL_DEG`) and the whole Z-stack (`CLEAR_MARGIN`,
`L_BARREL` … `Z_KEYLESS`) moved out of the evaluation order into a data
module. The rule the file establishes: a value belongs there iff it is
computable from literals and other values there — the moment it needs a
measured bbox or a solved position it stays in `main.js` until step 3
pulls the solve out too. Fingerprint bit-identical before and after.

**Step 2 — the train ratios as data.** The going train became a structured
`TRAIN` object (module + tooth count per mesh) alongside the keyless/
motion-works counts and the pure tornado step-angles; every going-train
gear BUILDER consumes `TRAIN.*`. The honest seam: gear modules flow only
through `TRAIN`, while the flat tooth counts survive solely because
`tick()`'s ratio chain still reads them by name — inlining that is step 3.
This is §22's single source: changing the beat is "edit `TRAIN` and
re-derive", not hunting ten copies. Fingerprint bit-identical; battery
clean at every step.

**Step 3 — the solves become pure functions.** Baseline re-captured first
on the post-§25 tree: `2407965539` (10 poses, 42 fingerprinted units —
two alarm poses joined the sweep). Then three slices, each a VERBATIM
expression port proven by that hash coming back bit-identical:

- **3a (PR #15) — `solveLayout(spec)`.** The tornado solve (the `stepPos`
  walks, the centre→third→fourth two-bar, the `BALANCE_STEP_DEG`
  edge-march/bisection clearance solve, fork pivot / `PIN_AIM`, the
  recentring shift) left `main.js` for `layout.js`. `main.js` keeps only
  the MEASUREMENT: swept radii read off the built meshes (vertex max)
  and passed in as declared inputs — purity means "same inputs, same
  outputs", not "pretends geometry doesn't exist". Called twice with
  different specs in one process it returns independent layouts, which
  is the regression suite §13 promised: the live spec must reproduce
  the baseline, and `d4 + 2` moving the fourth wheel proves the second
  call is really solving.
- **3b (PR #16) — `solveKeyless(spec)`.** The whole P-dependent XY frame:
  stem line (`uWind`/`vPerp`/`sideSign`), the keyless cluster's
  distances, the lever/yoke pivots with their pull-driven angle
  functions (`tailPostWorldAt` and the slot-arc bow), the plate radius
  with its keyless floor, and the dial-side locals that radius fixes
  (`dialRadius`, `RESERVE_LOCAL`, `SECONDS_LOCAL`, `subDialR`) — one
  pure function, measured outline radii as inputs. Casualty of the
  single source: `ALARM_CD`'s duplicated `plateR·0.92·0.39` at the
  plate-bore hoist and the drift assert that guarded it — both retired,
  since both sites now read the solve's one output.
- **3c (PR #17) — the flat-teeth seam.** `TRAIN` gained the pinion count per mesh;
  the pinion builders (hard-coded `10/10/10/8`) and `tick()`'s ratio
  chain (the same numbers again as `8 / fourthTeeth`, …) both read the
  table, and the flat exports `barrelTeeth`…`fourthModule` are retired.
  A ratio can no longer disagree with the geometry that carries it;
  §22's "edit `TRAIN` and re-derive" now covers the kinematics too.

Every slice: fingerprint `2407965539` bit-identical, support 0, graph
clean, boot silent. §13 is complete.

## 24. Alarm — synthesized dings, set from a second crown (BUILT)

**Goal.** The watch dings a slow bell volley when the display crosses a
settable hour, using nothing but WebAudio synthesis (same standing as §8/§11
— no audio assets), and the hour is set the way a real mechanical alarm
watch sets it: from a **second, independent crown** driving a small alarm
disc, never a UI control writing the target directly (Standing Rule 2 —
angles travel the gears).

Three interface options were weighed in the roadmap against the real keyless
code. **Option A — a second, independent crown** — shipped. Option B (a
third position on the existing time stem) and Option C (a rotating bezel)
were both recorded as considered-and-declined; the reasoning is at the end.

### The ding engine

**`sndTone` — a pitched voice, not a filtered click.** Every existing timbre
(`SND.beatEvent`, `.pawl`, `.hammer`, `.stem`) is a band-passed *noise burst*
through `sndClick` — right for a mechanical thunk, wrong for a bell. So the
alarm gets one new primitive beside `sndClick`: `sndTone(freq, decay, gain,
when, emitter)`, **two lightly detuned sine oscillators** (±4 cents, a faint
beating shimmer) into one exponential-decay `GainNode`, through the same
`masterGain → masterCompressor → destination` chain, the same
`sndSpatial(emitter)` snapshot, and the same `soundOn`/`audioCtx.state`
guard as every other source. `SND.alarm` schedules **six dings across 0.42 s
offsets** (a leisurely ring), each a two-partial strike (an A6-ish
fundamental under a softer octave-down partial), spatialized to the gong's
ringing end (see the striker below) — the same offset-scheduling idiom
`SND_BEAT_EVENTS` uses for a beat's cluster, just far longer-spaced.

**Trigger — a prev-value crossing edge, not a "fired today" flag.** Inside
the existing sound edge-detect block (`if (soundOn && !fastForward &&
syncPhase !== 'catchup')`, which already supplies the `soundOn` gate and the
fast-forward / sync-catch-up suppression the acceptance requires), the volley
fires on the frame whose displayed time crosses the set target *forward*,
gated additionally on `alarmOn`. This is the same one-shot idiom the
beat/detent already use (`alarmPrevSec`, reset to `null` in the block's
`else` branch so re-arming after a mute/FF gap stays silent until the next
real crossing) — no separate "already fired today" flag is needed. A large
forward "advance" is a backward hand-set wrapping the period, not a real
crossing, so it is ignored.

**Deviation from the roadmap: the 12-hour period, not `mod 86400`.** The
roadmap wrote the crossing as `displayedSeconds() mod 86400`. But the dial
and `formatTime` are **12-hour** (`DIAL_PERIOD_S = 43200`) and carry no
AM/PM, so a 24-hour alarm could not be set unambiguously from this face. The
alarm therefore wraps on the same 12 h period as everything else it is read
against.

**Panel.** A new `<details class="ui-section">` "Alarm" (the View section's
pattern): an `id="btn-alarm"` On/Off toggle (mirroring `setSound`/`setXray`)
and a **read-only** readout of the set time, derived from the disc angle via
`formatTime` (hours:minutes — the target quantizes to the quarter hour, so
seconds are always `00`). The panel only *arms* the alarm; it never writes
the target — that is set by turning the alarm crown (Rule 2).

### The second crown and the friction-set disc

**Where it sits — scanned, not eyeballed.** 12 o'clock is the reserve and
6 o'clock the small seconds, both on the vertical axis, so the free slots are
dial-local 3 and 9 o'clock. The *side* is chosen the way §1's `JMP_AZ` picks
a bearing: score each candidate by angular clearance from the **winding
crown's stem** (which lies along `uWind`, world ≈ 145°; the dialFace Y-flip
mirrors world x, so its dial-local bearing is `atan2(uWind.y, −uWind.x)`) and
take the clearer. That is dial-local **9 o'clock** (world +x, 145° away from
the winding crown). The well radius is derived, not chosen: the largest that
leaves a comfortable band of dial (`ALARM_WELL_GAP = 3.0`, well above the
single `CLEAR_MARGIN`, because two silvered recesses closer than that read as
one blurred cut) to each neighbour well on the perpendicular axis. The well
renders in the same family as reserve/seconds via a new `kind: 'alarm'`
branch in `makeDial` — a light 12-hour ring with Arabic hour figures and
quarter-hour ticks (a clock face in miniature). The alarm well is also fed
into `JMP_AZ`'s obstacle scan so the minute jumper still avoids it.

**Three units, not the roadmap's two.** The roadmap sketched `'Alarm crown'`
+ `'Alarm disc'`. As built the disc arbor is split into its own registered
unit so the bevel mesh is a *real swept pair between registered units*, not a
contact hidden inside one group — more honest than the two-unit sketch, and
mirroring exactly how the power reserve decomposes (hand on the dialFace, its
train on the movement side):

- **`Alarm disc`** — the pointer, riding in the well like the reserve hand;
  its dialFace rotation IS the set time read against the ring.
- **`Alarm setting arbor`** — the disc arbor carrying the mating bevel and a
  lower bearing collar; the friction-set link from crown to disc.
- **`Alarm crown`** — crown + free stem + a bevel at the stem's inner end; a
  force source, exiting the case rim (no sliding pinion, no clutch — it drives
  one thing, so it is *simpler* than the winding crown it copies).

**The coupling — a real 90° bevel pair.** The crown turns the disc through a
1:1 bevel corner (the `addBevelCorner` idiom §1's setting arbor already uses):
the horizontal stem meets the vertical disc arbor at a right angle where the
two exit-radial and disc axes cross. Rotation is threaded through in `tick()`
with the same representational coupling the setting/reserve arbors use, 1:1 and
continuously — the whole assembly (crown, stem, bevel, arbor, pointer) turns in
lockstep.

**Friction-set, not detented — and why (a bug the battery missed).** The first
build gave the disc a 48-tooth detent star + click-spring. It passed every
inspector check, and it was wrong: the star sat at z −2.3…−1.6, *buried in the
base plate* — because the base plate is not a labelled unit, so the overlap
sweep never tested anything against it (one of the two structural blind spots
`TODO.md` already names). The narrow band between the plate (bottom −2.3) and
the well floor (−6.5) cannot fit a 48-tooth star clear of the plate, the stem,
and the bevel. The fix is also the more authentic mechanism: real alarm watches
(Vulcain Cricket, JLC Memovox) **friction-set** the alarm hand — no click
detent. So the star and click-spring are gone; the disc holds wherever the
crown leaves it and is READ to the nearest quarter mark on the ring
(`ALARM_MARK_STEPS = DIAL_PERIOD_S / (15·60) = 48`, a derived reading
resolution, not a tooth count). Setting is smooth and silent. The bevel was
also shrunk and its corner lowered to −4.1 so the stem bevel clears the plate
and the disc bevel clears the well floor with `CLEAR_MARGIN` — verified by hand
against the un-swept base plate (arbor 1.8, crown 0.35). The arbor's lower pivot
runs in the well floor bore (a bearing collar), which is its route to `Dial`
(itself grounded) in the support graph — the star's collision had been silently
*satisfying* the old `Alarm setting arbor → plate` support edge.

### Angles travel the gears

`alarmCrownRotation` is the raw drag input (parallel to `crownRotation`,
written by an alarm-crown drag handler with its own hit-test — the winding
handlers are registered first and take the pointer when they hit, so the two
crowns never both capture). The pointer renders the disc angle *continuously*
(friction-set), and **`alarmTargetSeconds` is DERIVED** from that angle — the
nearest quarter mark, `round(angle) · 43200/48` — never assigned by the panel.

### The striker — a visible source for the sound

The disc only *sets* the alarm; nothing about it makes a noise. So the ding
gets a real source: a **gong** — a steel wire arc (`Alarm gong`) fixed to the
back (three-quarter) plate by a single foot, its far end ringing free — struck
by a **hammer** (`Alarm hammer`) pivoted just beyond that free end. Both sit in
the clear upper sector of the movement back (az 45–135°, away from the balance
and escapement in the lower-right), above the plate top, where a real alarm
gong lives. The bell voice spatializes to the gong's ringing end (an empty at
that point, since the gong unit's own origin is the movement axis and would
mis-place the sound at the centre), and the gong + hammer glow as it rings.

The strike is **representationally driven**, like the rest of the movement:
`SND.alarm` stamps `alarmRingStartMs`, and `frame()` swings the hammer a
half-sine onto the wire once per ding, in sync with the tones — its head closing
a 0.4-unit rest gap onto the ring. The strike direction (which way the pivot
rotates the head onto the wire) was *measured*, not guessed. It is frame-driven,
not posed by `setPose`, so it stays at rest through the entire inspector battery
— which is why `Alarm hammer`/`Alarm gong` are supported but carry no drive
edge and never trip the undriven check. What this model does **not** build is
the alarm's own power: a real Memovox has a second mainspring and striking train
driving the hammer. Here the hammer is shown and its motion is honest; its power
source is the one piece left for later.

### Persistence — and a bug fixed alongside

`captureState()` already *emitted* `soundOn`, but `state.js`'s `defaultState`
/ `sanitize()` **omitted** it, so it was stripped before saving and
`restoredSound` was effectively always false. Fixed (one line each) while
adding the alarm's own persisted fields. The alarm persists `alarmOn` and the
**raw `alarmCrownRotation`** (not the target): the disc angle and
`alarmTargetSeconds` re-derive deterministically, so a reload lands on the
exact same setting (Rule 2).

### Battery (clean)

Five units — `Alarm disc`, `Alarm setting arbor`, `Alarm crown`, `Alarm gong`,
`Alarm hammer`. Support 0 failures · graph clean (all grounded; the setting
chain — via a new `'alarm'` pose axis sweeping `alarmCrownRotation` through a
full disc revolution, with `'Alarm crown'` a new drive source — is attributed
to the alarm crown and *only* the alarm crown; the gong and hammer are static
under every pose axis, so they carry no drive edge) · full `inspection
{includeExcluded:true}` **0 FORBIDDEN** across 45 pairs (every alarm pair
EXPECTED) · clearances 0 violations · boot silent. The blind spots the sweep
structurally cannot see were measured by hand: the base plate is not a swept
unit, so the whole alarm mechanism was measured against it directly (all clear);
the hammer's strike onto the gong is a frame-time contact (verified by
measurement, not posed).

### Acceptance

Alarm On + hour set via the alarm crown → at that time `soundOn` plays a slow
multi-ding bell volley (not a click), spatialized to the gong, which the hammer
visibly strikes once per ding; Alarm Off → silent; fast-forward across the
target → silent (§8's FF rule). The disc's angle and `alarmTargetSeconds` agree
to within one quarter mark in both directions (verified across the range). State
save/load round-trips the hour and the toggle (7:45 + armed survived a reload,
re-derived to the same setting). Boot silent; full battery clean.

### Options B and C (considered, declined)

**B — a third position on the existing time stem.** `crownPullT` is not an
N-position selector; it is a continuous eased slide gated into two zones by
one threshold, and the minute jumper's lift keys off that *same* threshold.
A third position means widening the travel, adding a second threshold, and
re-deriving every `crownOut`/`crownPullT` read site per zone — while still
building the same alarm disc Option A needs anyway. Strictly more code and
more regression surface for the identical user-visible result. Not built.

**C — a rotating bezel.** `plateR` is a computed movement *envelope*, not a
case wall; there is no case, crystal, or caseback mesh today (BACKLOG §3,
deferred). A bezel is a ring on a case with nothing to attach to yet.
Parked on §3 rather than built as a case-less placeholder.


## 25. Alarm striking works + the full alarm complication (BUILT — PRs #7/#8/#12)

**Context.** §24 shipped the alarm as a real complication (second crown,
friction-set disc at 9 o'clock, gong + hammer) AND made the striker
honestly SPRING-POWERED in logic (public repo, PR #6 / branch
`claude/alarm-second-crown`, commit `50c258e`): a dedicated alarm barrel
`alarmBarrelWind` (turns) drains while ringing, the hammer angle is
DERIVED from a striking-train phase `alarmStrikePhase` that the draining
drives, one ding per whole strike, and the ring STOPS when the barrel
runs down (Rule 2 — see `tick()`'s "Alarm: release + spring-powered
strike" block, `alarmHammerAngle`, and `SND.alarmStrike`). The RELEASE
trips on the hour position crossing the set position; the `Alarm` toggle
gates it. `__clock` exposes `alarmBarrelWind` / `alarmReleased` /
`alarmStrikePhase` / `alarmHammerAngle`.

**What is still MISSING is the visible geometry** for that power chain —
today the alarm barrel, the striking train, the release feeler/lock, and
the alarm-crown winding are all logic with no parts. This entry is that
geometry, so a viewer can SEE the striker draw its energy, see it get
scheduled, and see it armed/disarmed. It mirrors how the going train is
already built (spring `barrelWindTurns` → drains as the balance turns →
gates `balanceRate` → `τ` → whole train), just for the alarm.

**A — alarm barrel + striking train. BUILT** (public repo, branch
`claude/alarm-striking-works`). Reconciled against what actually shipped:

- *A barrel and a striking wheel now stand on the plate top*, in the clear
  band outboard-left of the balance that the gong already claims. `Alarm
  barrel` is a new FORCE SOURCE in `MECH_GRAPH` (node `'alarm mainspring'`,
  the counterpart of `'mainspring'`); `Alarm striking wheel` carries its
  pinion. Both sit on studs planted in the 3/4 plate top — the gong post's
  idiom. Barrel 44 t ⇄ pinion 11 t, a 4:1 step-up at module 0.3.
- *The striking wheel is a lifting CAM, not a pin wheel* — the one real
  departure from the sketch above, and worth knowing WHY before anyone
  "fixes" it back. A pin lifts the hammer's tail by sliding out along its
  face and letting go at the tip; the hammer then falls and its face sweeps
  straight back down through where the pin still is. The pin only escapes
  radially (≈1.7 units per radian of wheel) while the hammer falls its whole
  draw in a fifth of a pin pitch. Measured: the tail buried itself 0.21–0.47
  into the pin it had just released, and thinner pins, a slower fall and tip
  relief all failed to shift it. A clean escape needs the tail to cross the
  pin circle steeply — and steep crossing and small draw are the SAME
  parameter, so it wants ≈60° of hammer swing, against §24's hammer resting
  0.4 off the gong on a 7-unit arm. A cam and follower never lose contact on
  the rise, so there is nothing to escape from.
- *The profile is GENERATED from the lift law*, not the other way round:
  sample the rise, put the nose where the law says, record where that lands
  in the wheel's own turning frame. Four lobes, 62 % rise (smoothstep), then
  the flank drops away and the hammer falls under its own spring — that free
  fall is the strike. Draw = 3 × `ALARM_STRIKE_AMP`. (Trap: the generated
  psi is already in the wheel's frame. Re-zeroing it on the release — the
  obvious tidy-up — puts every lobe a full radian off the nose that is
  supposed to ride it.)
- *The hammer gained a TAIL* whose wheel-facing side tapers from full width
  at the pivot to nothing at the point. Not styling: a parallel bar with a
  symmetric nose buries its wheel-facing SHOULDER 0.36 into the rising
  flank, because the shoulder stands nearer the wheel's centre than the
  point does. The taper puts every part of that edge further out.
- *`ALARM_RING_SECONDS` is now an OUTPUT.* §24's 6 s was a free constant no
  train can deliver at a 0.42 s cadence without the barrel creeping through
  a third of a turn. The constraint is now that the barrel must visibly
  unwind more than one revolution: `ALARM_BARREL_TURNS = 1.75` → 16 strikes
  per barrel turn → 28 strikes → ≈11.8 s. `ALARM_STRIKE_DUR` is gone, and
  restored state clamps `alarmBarrelWind` (older saves hold §24's 8).
- *The striker's pose moved from `frame()` into `tick()`*, so the inspector
  can pose it at all. New `'alarmStrike'` axis, `n: 109` — deliberately
  coprime to the 28 strikes, or every sample lands on the same few phases
  within a lobe and steps over the strike entirely.
- *New penetration budget* `['Alarm striking wheel','Alarm hammer']`, which
  earned its keep immediately: it is what caught both defects above, in a
  pair the overlap sweep is structurally blind to (EXPECTED is granted per
  unit PAIR). Calibrated at 0.12 — a cam follower TOUCHES, and `mtvDepth`
  resolves a tangential contact badly; a correct build reads 0.094 and the
  number falls ≈1:1 with an artificial shrink of the tail, reaching 0 at 0.1.
- *`makeBarrel` gained a `ratchet` option.* The alarm barrel ships with NO
  ratchet or click: there is no winding path until stage C, and a click
  riding round with the barrel it is meant to hold is a display fiction.
- *Cost:* the back stack grew from 10.2 to ≈12.1. The cam has to sit under
  the barrel — a pinion always sits closer to its wheel than the wheel's own
  tip radius, so the cam unavoidably passes over the barrel and the two can
  only be separated in z. Worth carrying into §2.

Battery at landing: support 0 · graph clean · penetration all within budget
· `inspection {includeExcluded:true}` 0 FORBIDDEN · clearances 0 · boot
silent.

**B — release mechanism.** A reduction train from the hour wheel
(`hourWheelGroup`, `mwHourA` = 1 rev / 12 h) to a 12-hour cam COAXIAL with
the alarm disc at 9 o'clock — the same span-crossing pattern as the
power-reserve train (`reserveTrain`). The set disc carries a notch, the
hour cam a finger; a feeler drops when they align and lifts a locking
lever off the striking wheel. The lock is what the shipped `alarmReleased`
flag now embodies; cross-check the cam alignment against the existing
angle crossing.

*After A:* the lock now has something real to hold. `alarmStrikePhase` is
parked at `ALARM_PHASE_REST` (the instant a lobe's rise begins, lift 0)
whenever the lock seats, so a locking lever wants to bear on the striking
wheel at that phase and free it at the trip. Note also that A left the
striking wheel's own bearing stud static and its rotor separate — the lever
has a static face to be pivoted against.

**C — alarm-crown wind/set clutch.** Mirror the time crown's
sliding-pinion clutch (`windSpinner` / `crownPullT` / `windPathRot` /
`setPathRot`, one-way ratchet banking `barrelWindTurns` in `tick()`): a
second sliding pinion on the alarm stem + `alarmCrownPullT`; PUSHED IN
winds `alarmBarrelWind` through an alarm crown wheel + ratchet, PULLED OUT
drives the disc through the existing bevel (today's setting path). An
alarm-crown pull/push toggle (like `toggleCrown`). `MECH_GRAPH` drive
`['Alarm crown','Alarm barrel']` (wind) + `['Alarm crown','Alarm setting
arbor']` (set). When this lands, change `alarmBarrelWind`'s default from
full to 0 — the alarm must be WOUND to ring.

*After A:* the barrel is built and `ALARM_BARREL_TURNS = 1.75` is what the
crown has to bank into, through whatever winding reduction the crown wheel
gives. The barrel deliberately carries no ratchet or click yet
(`makeBarrel({ ratchet: false })`) — this stage adds them, and the click
must be mounted on the PLATE, not on the barrel group, or it turns with the
thing it is holding. The crown will also need a second force-source route
in `MECH_GRAPH`, alongside the `'alarm mainspring'` node A added.

*Winding-route design, RESOLVED (the geometry study that has to happen before
any code, done — branch `claude/alarm-wind-clutch`, off the §13 tree).* The
naïve picture (dial-side crown → drop straight down to the barrel) is
IMPOSSIBLE here, and it took measurement to prove rather than assume:

- §25 A sited the alarm barrel on the plate top at world az ~173, r ~23 —
  directly OVER the fusee, great wheel, drum and chain, which fill the entire
  z-column beneath it. A winding arbor cannot drop from it.
- A full clear-column sweep of the movement (excluding the plates, which get
  bored for arbors) finds NO clear vertical channel within a gear-mesh of the
  barrel. The nearest clear column is ~15 units away, in the lower-left gap.
  Placing the barrel anywhere on its own mesh circle around the striking wheel
  does not help — the striking wheel is pinned near the hammer (upper-left),
  so every barrel position that meshes it sits over the going train.
- The crossing is therefore unavoidable: the power source (barrel, windable
  near a front crown) and the sink (hammer, on the back) are on opposite faces
  with a solid movement between. §25 A already paid the EASY crossing — barrel
  and striking wheel are both on the plate top, meshing laterally, no z-cross.
  The winding is the HARD crossing and needs a real route.

Two architectures for the STRIKER were weighed with the owner. **Rejected:
move the whole striker to the dial front.** It co-locates everything (no
crossing) but reworks all four shipped §25 A parts AND clutters the visible
dial (the owner wants the dial face clean). **CHOSEN: keep §25 A's striker on
the back untouched; make only the winding cross, through the one clear
channel.**

*The SETTING indicator — design history and the CURRENT design.* This went
through three owner-steered revisions; recording all three because each was
killed by a MEASUREMENT, and the reasons are load-bearing for whoever builds:

1. ~~§24's sub-dial disc~~ (shipped, being replaced): a 5 mm well cramps the
   12 h scale into a tiny arc — poor setting precision.
2. ~~Peripheral "orbiting train" ring at the railroad radius~~: precise
   (12 h spread over the full dial) and prototyped to an approved look — a
   subtle steel lozenge seated between the chemin-de-fer's rails (measured off
   the dial TEXTURE: the rails render at world r 31.5/34.2, not the nominal
   0.87/0.94·dialR — the canvas silver fill only reaches ~0.92R). But the
   RING behind the dial is blocked: at the keyless cluster (az 120–160°) the
   yoke and setting lever reach z −6.8, leaving 0.2 of the ≥0.45 a ring +
   margins needs above the dial plane (−7.0). A front-side floating ring on
   dial rollers was designed around it (and is still viable), but was
   superseded by 3 before build.
3. **CHOSEN — central rattrapante alarm hand.** A co-axial hand at the dial
   centre riding its own tube around the hour-wheel tube, just dial-ward of
   the hour hand. DISARMED, it mechanically FOLLOWS the hour hand — a true
   rattrapante return: heart cam on the hour wheel, spring-loaded follower on
   the alarm tube — so it hides exactly under the hour hand, invisible.
   ARMED, a clamp holds the alarm tube at the set time and the follower
   lifts; the hand stands at the alarm hour like a Tudor Advisor / Memovox
   pointer. Setting (crown pulled) drives the tube against the clamp-open
   state through a small train from the alarm corner.

   Why this converges beautifully: the rattrapante centre IS stage B's
   release. With the hour wheel and the alarm tube co-axial, "hour crosses
   set time" is a physical alignment at ONE axis — the classic Memovox
   architecture (notched cam + drop pin) falls out of the same parts, instead
   of needing a separate 12 h comparison train at 9 o'clock.

   Measured constraints for the build: the dial-gap disc (z −7.0..−6.3) is
   crowded — small-seconds display arbor crosses r 6.8–15.8 (its own azimuth),
   keyless works r 10.1–12.8, minute jumper r 12–12.6, reserve train r 11–16 —
   so the drive train from the alarm corner (r ≈ 15.4) to the centre must
   thread the az ≈ 0 corridor (measured passable). Centre surgery: the dial's
   centre bore (currently HOUR_TUBE_OUTER + 0.2) must open to pass the alarm
   tube; the tube wraps the hour-wheel tube with running clearance; the hand
   rides between the dial face and the hour hand. The heart cam mounts on the
   hour wheel (1 rev/12 h, the correct period by construction); the follower
   and clamp live in the dial gap near the centre.

   The §25 C prototype marker (revision 2's look) was removed from the tree
   when 3 was chosen — one indicator, not two.

**BUILT (branch `claude/alarm-wind-clutch`, four verified stages — this is
what shipped, reconciled against the plan above):**

1. *Centre stack* ✔ — alarm tube around the hour-wheel tube (its running fit
   IS the bearing), enlarged dial bore, steel rattrapante leaf under a
   LENGTHENED hour hand (0.5R → 0.56R, tip one unit shy of the numerals'
   measured inner edge; the minute hand moved to 0.83R, tip ON the measured
   rails). The z-budget forced two real changes: the whole hands stack rose
   0.7 (hour+minute together — at the old plane the free lane was thinner
   than any hand section, and the first mount GRAZED the blade through the
   dial sheet), and `makeHand` grew stacked-hand overrides (boreR/bossR/
   bossH — a bored collet that passes the inner tubes; defaults bit-identical
   for every existing hand). §24's sub-dial well is healed; the dialFace
   mirror bit once (a world-frame calibration put 5:00 at printed 7 — the
   printed numerals are the only reference).
2. *Heart cam + sprung follower* ✔ — the rattrapante follow. The follower
   co-rotates with the SETTING, so its swept envelope is an annulus, and the
   lane behind the dial is bounded at r 4.5 by a dial foot + the motion-works
   stud (vertex-probed): everything lives inside r ≤ 4.3 — shallow heart
   (rMin 2.75 → R 3.55; makeHeartCam gained an rMin override since the
   classic 0.32·R notch would fall inside the tube bore) and a short arm
   whose length + seated angle are derived from the same triangle tick()
   solves. Follower pose is Rule-2 derived (heart profile → law of cosines,
   two fixed-point iterations for contact-azimuth drift) and was verified
   against the closed form at four relative angles. New penetration budget
   ['Hour wheel','Alarm disc'] on the (now ARMED) alarm axis: 0.082/0.12.
   The CLAMP was NOT built as a lever — arming is the friction coupling in 3
   holding against the follower spring; the visible on/off lever remains D's.
3. *Setting train* ✔ — crown → bevels → arbor pinion (10) → plain idler (31)
   → setting wheel (30) FRICTION-riding the tube (armed: wheel ≡ tube to
   1e-9; disarmed: 1.12 rad of measured slip — the cannon-pinion precedent).
   ONE module for all three meshes (m·(30+2·31+10)/2 = ALARM_CD ≈ 0.302 —
   a plain idler cannot span two modules; the first plan wrongly borrowed
   the reserve train's two-module split, which needs a COMPOUND idler).
   The quantizer bug this exposed: alarmMarkIndex read the RAW crown angle
   (correct only at 1:1) — one crown rev read 0 h instead of 4 h. §24's
   arbor collar (riding a well-floor bore that no longer exists) became a
   plate cock; support edge 'Dial' → 'plate'.
4. *Winding path* ✔ — with a cleaner clutch than planned: the stem's own
   pull throw (CROWN_PULL_DIST) carries its sliding bevel from the setting
   corner to the CLIMB ARBOR's contrate one throw outboard — the pull IS the
   clutch, no separate sliding pinion. (The planned az-205 channel died with
   the sub-dial relocation; the climb lives at az 0, r = ALARM_CD + throw,
   rising through BOTH plates — base-plate bore + jeweled TQ pivot, the
   plates' holes hoisted with an assert since they build first. A raycast
   overruled a sparse vertex probe that claimed the TQ plate was absent
   there.) Up top: pinion + two 59 t idlers cross the vertex-probed-empty
   z 10.1..11.6 lane to the barrel rim, i2 by two-circle intersection.
   Idlers drop out: crown → barrel = 12/44, full wind ≈ 6.4 crown turns.
   `alarmBarrelWind` defaults 0 — the alarm ships unwound. NO CLICK, a
   deliberate deviation from the plan: in §25 A's single-member barrel
   (rotation IS wound state) a click would block the ring itself; the hold
   is B's lock, and the arbor/shell split that earns a real click is filed
   as debt. Winding banks wind AND un-rides the cam in lockstep (the exact
   mirror of the ring's spend), and the three phase RESETS (trip, run-down,
   switch-off) are GONE — each silently slipped the barrel⇄cam mesh.
   Verified: wind → trip → 28-strike ring lands the phase at exactly REST
   with no reset anywhere. The winding train's pose derives rigidly from
   the barrel angle, so it visibly free-spins during the ring — what rigid
   meshing implies, and what real alarm crowns famously do.
5. *tick() + UI* ✔ — crown deltas route by where the bevel physically is
   (`alarmCrownPullT`); the SET path (`alarmSetRot`) holds while winding and
   persists; pull toggle + wind-percent readout; `setAlarmCrownRotation` /
   `setAlarmCrownOut` on `__clock` for inspection parity.

**B + D — BUILT (same branch), reconciled:**

- *B, the hold:* a brake lever on the plate top (probed-clear az-160 sector
  by the striking wheel) — pivot post, steel arm, ruby pad on a new smooth
  LOCK COLLAR under the striking cam. A brake, not the sketched notched
  detent, because the winding lockstep can park the train at ANY phase —
  the stop-lever-on-balance-rim precedent. Verified: lifts by exactly the
  derived ALARM_LOCK_LIFT at the trip, re-seats to 1e-4 after run-down.
- *B, the release:* the CONVERGENCE the entry predicted came true — the
  feeler IS the rattrapante follower. The trip now derives from the
  physical alignment (wrapPi(mwHourA − alarmTubeShownA) crossing zero =
  the nose dropping into the heart's notch), §24's seconds-space
  comparison retired, its guards carried into angle space. The rod from
  the centre follower up to the plate-top lever is NOT built — declared
  in MECH_GRAPH.todo as the remaining §25 coupling debt.
- *D, the switch:* a two-position blued slide behind the lock's tail: OFF
  presses the brake closed regardless of the feeler, ON backs its 0.9
  throw away. btn-alarm eases it; pose path exact. Power-flow gained the
  alarm groups (winding lights crown-train + barrel as STORE; ringing
  lights barrel → cam → hammer → gong as DELIVER).
- *Battery for the new contact:* the alarmStrike axis now poses
  alarmOn + alarmReleased (a turning train IS a ringing one — an engaged
  pad under a spinning collar would be a false dig), and a clearance
  budget proves the lifted pad clears the turning collar by 0.22 ≥ 0.15
  through the whole ring.
- *Also:* an 'Alarm complication' explode GROUP (the §10 level-1 seed):
  per-group layer staging unfolds all ten alarm units in torque order,
  labels filter to members, boot-asserted against real label names.

*Crown-sense swap — DONE (owner's call):* pushed-in WINDS, pulled-out
SETS, the Cricket/Memovox convention. The two vertical arbors exchanged
radii; the setting train re-solved and then re-solved AGAIN when the full
sweep and the owner's own eyes caught what focused runs and an EXPECTED
blanket had hidden: a collinear idler impaled on the climb, an idler
poking through the reserve sub-dial's wall, and the setting wheel crossing
BOTH well walls since stage 3. Final geometry: asymmetric 28 t/37 t idlers
on a dogleg threading the (slightly shrunk, wellR 10.9 → 10.2) well rings,
the climb and the cock — every clearance boot-asserted, because the two
failure paths (a probe that skipped the Dial unit; an EXPECTED row
blanketing the sweep) are structural and asserts share neither.

*D, revised twice more (owner-driven):* the slide switch became a COLUMN
WHEEL (steel, ratchet skirt, castellations cut by the same profileAt the
poses ride), with a CLICK/detent arm whose tangential geometry rocks its
nose radially — 1.78 riding a column (OFF), 1.30 dropped in a gap (ON),
derived not picked — and a case PUSHER whose pawl indexes the skirt, since
a cased movement cannot reach a plate-top wheel (§3's case band bores for
its stem). Tap targets: the wheel, the click, the pusher cap, the alarm
crown (pull/push toggle), plus the panel buttons. An interference audit
prompted by the owner's eye fixed the stud-through-crown, skirt-on-plate,
pawl-in-plate, boss-in-plate and beak/nose-through-castellation set.

*Also:* an 'Alarm complication' explode group (§10's level-1 seed) unfolds
all ten alarm units in torque order with labels; arming SWEEPS the hand out
(τ 350 ms, the re-coupled friction wheel) while disarming SNAPS it home
(τ 60 ms, the spring) — the two speeds are the two mechanisms.

*Still open before the PR leaves draft:* the final full sweep on the
B+D tree, moving this entry to `docs/BUILT.md`, and the PR description.
*True remaining debt:* the follower→lock release rod, and the barrel
arbor/shell split (the honest click).

**D — on/off lever + power-flow.** A visible on/off lever the `btn-alarm`
toggle drives (holds/frees the lock; `setAlarm()` animates it). Extend the
power-flow view (`pfBuildGroups`) with an alarm group so the barrel →
striking train → hammer torque path lights while ringing — the visual
proof it is spring-powered.

*After A:* the torque path exists as real parts and real `MECH_GRAPH` drive
edges (`alarm mainspring → Alarm barrel → Alarm striking wheel → Alarm
hammer`), so the group is a lookup rather than a story. A already lights the
striking wheel alongside the gong and hammer on each strike
(`SND.alarmStrike`'s `sndFlash` targets).

**Traps carried from §24.** The **base plate is NOT a swept unit**, so
every new part must be measured against it by hand (the bug that buried
§24's first detent star). Same for the 3/4 plate top where the back-side
parts sit. The movement is crowded; geometry fitting is the bulk of the
work and is iterative against the live battery.

Feasibility: large (a full second complication in a crowded movement) ·
Cost: A came to ~330 lines across `main.js` / `geometry.js` / `inspect.js`;
B–D likely another ~300–400, still mostly iterative fitting · Battery:
full, and best landed A→D with a checkpoint after each — support 0, graph
clean, `inspection {includeExcluded:true}` 0 FORBIDDEN, clearances 0, boot
silent. A's lesson for the rest: the overlap sweep will NOT catch a bad
contact between two units that are already declared EXPECTED, so every new
working contact wants its own penetration budget, written before the
geometry is trusted. A fuller written plan (the 5-stage
version, of which Stage 1 already shipped) was drafted as
`~/.claude/plans/cozy-wandering-boot.md` on the machine where §24 was
built; this entry is the durable copy.

## 27. Crown redesign — a brand mark (infinity/hourglass) in place of the knurl (BUILT)

**Goal.** The crown stops reading as a generic prickly knurl and starts
carrying a brand signature — an infinity sign shaped to evoke an
hourglass — while getting cheaper to draw and calmer to the eye.

**What shipped (reconciled).** An end-cap brand mark on a traditional,
enlarged-knurl crown. The first cut replaced the whole barrel with a
double-lobe hourglass lathe (the grip-band carrier taken to its limit);
the owner reviewed it and kept the traditional shape instead — so the
knurl was scaled UP rather than replaced, and the mark lives on the
face:

- *The mark* is `makeBrandMark({ r, tubeR, aspect, material, … })` in
  `src/geometry.js` — a lemniscate of Bernoulli (∞) swept as a closed
  round-stroke tube, its natural 1/(2√2) height/width rescaled by
  `aspect` (default 0.52) so the lobes plump and the crossing steepens
  into an hourglass neck. It is shared and parameterised, never inlined:
  `makeCrown` is the only direct consumer today, and a caseback or
  buckle can call it tomorrow.
- *End-cap relief* (the brand read): the crown's flat outer face
  carries the ∞ raised, half-embedded — centreline ON the face plane,
  proud by exactly `tubeR` — per the house relief convention. The §27
  orientation question ("does horizontal-infinity fight
  vertical-hourglass?") dissolved on this carrier: the crown SPINS when
  wound, so one mark gives both reads a quarter-turn apart.
- *Grip* (traditional, calmed): the fine knurl (~60 bur-prism keels) and
  the six-rod face rosette are retired — `burPrismGeo` went with them —
  and the barrel keeps its classic cylinder + chamfer-cap shape with
  LARGER knurling: round, smooth-shaded rods (16 on the winding crown,
  12 on the alarm knob), the count still derived from the circumference
  at the knurl-era pitch/ridge ratio (3.5) so the coin-edge duty cycle
  survives both the size change and any future `bodyR` change. Soft
  scallops where the keels prickled.

**Derived, asserted budget.** The redesign stays INSIDE the fine-knurl
crown's proven swept envelope — radius ≤ `bodyR` + 0.112 (the old keels'
proud height; the new knurl's crest is SEATED to land exactly there,
seat = budget − `KNURL_R`), axial ≤ `bodyH` + 0.55 + 0.16·`bodyR` (the
retired rosette's proud rods) — because every standing
clearance/penetration row was proven against that envelope, so staying
inside cannot create a new contact anywhere in the pose space.
`makeCrown` asserts both at build time (boot stays silent; a warn means
the envelope regressed). `KNURL_R` = 0.61 is the one styled number (the
"larger" in the owner's brief), FLOORED by the tri budget: at 8-segment
rods the alarm knob's ridge count must stay ≤ 12 to hold under its
knurl-era spend. The mark's stroke is `tubeR` = 0.085·`bodyR` (well
under the 0.16·`bodyR` the axial envelope allows for its proud half)
and its span fills the cap's face rim minus one stroke-width of quiet
reveal: `markR + 2·tubeR = bodyR − 0.35`.

**Call sites.** Two crowns, one builder, both redesigned for free:
the winding crown (`main.js`, keyless assembly, `bodyR` 5.425/`bodyH`
4.55) and the §24/§25 alarm crown knob (`main.js`, alarm crown unit,
4.0/3.4). Same `bodyR`/`bodyH` as before at both sites — the envelope
is what the battery had already proven.

**Cost (the §14/§20 draw-call worry).** Winding crown: 1121 tris / 69
draw calls → 1056 / 19. Alarm knob: 945 / 53 → 928 / 15. The knurl's
prickly micro-noise is gone from both; the barrel/cap silhouettes
dropped from 48 to 28 segments (sagitta ≈ 0.03 at the winding crown's
radius — invisible) to buy the bigger rods their triangles.

**Untouched, verified.** `crownRotation` drag, `crownPullT`, the
setting/winding clutch and every `crownOut` read site — the `main.js`
diff is call-site comments only; `MECH_GRAPH`'s crown declaration is
unchanged. Turning the crown through the real drive path still winds
the fusee (verified live: +π/2 of `crownRotation` banked reserve).
Battery on the redesign: support 0 failures, graph clean, penetration
within budgets, clearances 0 violations, full
`inspection {includeExcluded:true}` 0 FORBIDDEN, boot silent.
## 14. Performance on slower machines (BUILT)

**Goal.** The sim stays smooth on integrated graphics and modest CPUs.
Render + scheduling only — nothing about the mechanism changed, and
`runInspection` is untouched (it drives `setPose` directly and never
enters `frame()`).

**Measure before touching anything.** This project was already burned
once by optimising the wrong thing (`TODO.md` item 4: a native-code plan
killed by a profile showing pose evaluation at 0.04 ms), so the
frame-time readout landed FIRST, alone, and gated every later step —
each one below cites the number it moved. All four steps shipped, in
order, one commit each (steps 1 and 2 were independently shippable and
were shipped that way).

**1 — Frame-time readout** (`src/main.js`, the `FRAME_EMA_ALPHA` block
by the animation-loop constants; painted in `frame()`; panel section
"Performance"). An EMA of the RAW rAF interval — unclamped, so it reads
the real display cadence — plus a ticks-per-frame counter that makes the
fixed-step spiral directly visible. Samples past `FRAME_STALL_MS`
(= tick()'s own 0.25 s clamp) are scheduling gaps, not render cost, and
are rejected. Exposed as `__clock.frameMs` / `__clock.ticksPerFrame` so
perf claims are checkable from automation; the panel text repaints only
~2×/s so the readout can't cost frames itself.

**2 — Chain rebuilds once per FRAME, not per tick**
(`updateChainIfMoved()` beside `rebuildChain`). The chain is
display-only, yet its full BufferGeometry dispose/allocate (~100k
vertices) ran inside `tick()` — up to 12× per displayed frame while
winding on a machine slow enough to hit the realDt clamp. `tick()` now
only records the tension; the rebuild happens once per rendered frame
(`advanceFrame`, `__clock.step`) or per posed frame (`setPose` — the
support sweep measures the chain's real geometry against the drum hook,
so a posed tension still rebuilds before the caller reads it, which is
why the battery stayed clean). Readout: a winding frame at the 12-tick
clamp fell 3.59 → 2.20 ms.

**3 — Tick budget** (`TICK_BUDGET_FULL` / `TICK_DT_CLAMP` by
`FIXED_DT`; the budgeted loop in `advanceFrame`). The accumulator used
to hand a SLOW machine MORE work per frame — 12 ticks at the 0.05 s
clamp, 252 during a sync catch-up. A frame now gets `tickBudget` fixed
steps, then the remainder in coarse strides: whole multiples of
`FIXED_DT` (the sub-step accumulator phase — and so all behaviour at
speed — is bit-for-bit unchanged), capped at `TICK_DT_CLAMP`, tick()'s
own rawDt clamp, so no stride is clamped away and τ never silently
loses time. Coarse strides are what fast-forward already feeds tick()
(FF's own 45×2 s path is deliberately untouched — its whole point is a
wall-time-bounded payout). Readout: catch-up worst frame 252 ticks /
11.60 ms → 16 ticks / 2.60 ms, sync still landing on the wall clock.

**4 — Quality tiers** (`QUALITY_TIERS` block after the readout vars;
"Quality" select in the Performance panel section; `quality` persisted
in `state.js`). One knob over three costs: pixel-ratio cap (High = the
original `min(dpr, 2)`; Low = 1×, a quarter of the fragments on a 2×
laptop — `antialias` is context-creation-time and can't be toggled, but
its cost scales with the same fragment count the cap controls), the two
shadow maps (Balanced halves each edge of key 2048² / rim 1024²; Low
stops casting — shadows are the scene's biggest fixed cost), and the
tick budget (12 / 6 / 3). High is the pre-§14 configuration verbatim.
Readout: the clamped-frame benchmark fell 4.13 ms (High) → 2.13 ms
(Low); in the throttled verification pane Low held the 16.7 ms vsync
floor where High sat at ~9.5–115 ms.

**Reconciliation — Auto walks DOWN only.** The plan said "chosen from a
measured frame time"; what shipped is a one-way ladder (High → Balanced
→ Low on a sustained EMA above `TIER_DOWN_MS`, with a hold after each
change), because the readout's signal is the rAF interval and that is
vsync-floored: a machine with 10× headroom and one barely keeping up
both read ~16.7 ms once they hold 60 Hz, so "fast enough to step back
up" is invisible from this signal. Stepping up is the user's call via
the panel select, and the CHOICE (Auto or a pinned tier) is what
persists — Auto re-earns its verdict each boot rather than trusting a
stale one. One verification honesty note: Auto's live downgrade is the
one path browser automation could not exercise (rAF pauses between
forced paints — the CLAUDE.md trap), so it is verified by parts: the
EMA demonstrably accumulates from real frames, all three tiers apply
correctly, and the trigger runs every frame.

Battery: support 0 failures (both Chain edges gap 0 through the moved
rebuild), graph clean, penetration within budgets, clearances 0
violations, full `inspection { includeExcluded: true }` 58 pairs all
EXPECTED / 0 FORBIDDEN, boot silent. Cost: readout ~35 lines, chain fix
~25, tick budget ~25, tier plumbing ~80.
## 29. The physical alarm release — feeler to lock, for real (BUILT)

**Goal.** Discharge §25's one declared coupling debt (`MECH_GRAPH.todo`,
`['Alarm disc','Alarm lock']`): the trip was DERIVED from the co-axial
angle alignment, but no physical linkage carried the drop to the lock.
§25's own measurement showed why a rod cannot do it — the follower rides
the alarm tube and its drop happens at whatever azimuth the alarm is set
to. The Memovox answer, built here: make the comparison's OUTPUT a
fixed-azimuth event.

**Step 0 — the gate paid before the feature existed.** Fingerprinting a
VIRGIN session (zero rendered frames) hashed differently from every
session ever run, which unravelled two shipped defects: `registerExplode`
held a stale `baseZ` literal for the handsGroup and `updateExplode`
silently teleported the minute hand 0.7 below its designed plane on frame
one (intra-unit — the battery's documented blind spot); and `resetInputs`
missed `secondsZeroRef`, so a crown-pull re-based the small seconds
forever. Both fixed structurally: `registerExplode` boot-asserts every
`baseZ` against the constructed position, and `console.warn` now collects
into `__clock.bootWarns` — "boot is silent" is a checkable, per-boot fact
(pattern-filtered console reads had been silently lying, which this same
session proved the hard way).

**Step 1 — the centre re-stratified.** The whole stack behind the dial
sheet became ONE derived top-down chain (`§29 CENTRE Z-CHAIN`): setting
lane thinned to a shared 0.18 with its plane closed-form from the sheet
gap; flange 0.08; heart 0.30 with `ALARM_HEART_Z` an expression; the
motion-works planes are where the chain LANDS (their 1.5 spacing — the
jumper's star slice — preserved by construction; the cannon pinion
lengthened to keep full mesh). The DISC BAND the § needed opens between
the heart and the minute wheel, boot-asserted from the same expressions
that place both neighbours.

**Step 2 — the differential disc.** A notched disc friction-riding the
HOUR TUBE in that band: driven with time through the seat, re-phased by
the setting train when the crown sets, its angle physically encoding
(hour − setting) so the notch passes ONE fixed azimuth exactly at
coincidence, for every setting. The re-phasing branch taps I1 as a
compound idler: i1b (28) meshes the disc's rim (30) DIRECTLY — one mesh,
the tube path's mirror ratio, with the branch module DERIVED from the
closure (m = 2·DW1/58), so the mesh cannot fail to close. The back-drive
is total and honest: the dogleg creeps with the hour in both crown
positions, the rod closes the chain, and a pulled crown visibly
back-turns through a banked accumulator owned by `resetInputs`. (The
first branch build placed an idler by a two-circle solve whose circles
never met — the closure assert fired at every boot while its own EXPECTED
row blanketed the collision in the sweep. Both § lessons in one defect.)

**Step 3 — the fixed feeler.** A rocking lever on a dial-hung bracket at
the release azimuth: ruby pin down onto the disc's raised track (the
notch is the GAP in the track — no CSG), the ride STATELESS — the pin's
lift is the surface under it, so `setPose` poses it exactly. The drop is
banked at 0.10 by a stop on the bracket, NOT by bottoming in the notch:
the dropped arm still owes the spinning rim one margin, and (static gap −
drop × lever fraction) is what the stop preserves. Proven before wiring:
the pin drops once per 12 h at every tested setting, centred exactly
where §25 B's `rel == 0` holds (the constant 1.85 h offset across
settings IS the hands' fitted epoch).

**Step 4 — the tail and the pawl.** The tail runs straight to the winding
climb one band above the gear lane (z-jogged clear of i1b's swept tips —
the sweep caught the dropped lever's rise), riser to the winding contrate
at the stem corner, beak into the tooth band's PLATE-side edge (measured:
the rock withdraws plate-ward, 0.31 at the beak). Seated, the climb — and
through the 12/44 mesh the whole striking barrel — is held; winding
clicks over the beak's SPRING-STEEL tip, which follows the saw profile
kinematically (the lever cannot bob; the pin's track contact fixes its
other end). The last FORBIDDEN here was the dropped arm kissing the
heart's extrude-bevel expansion — authored 0.30, rendered 0.42 —
`makeHeartCam` gained the `bevel:false` opt-out (the `makeGear`
precedent) and §29's heart is crisp.

**Step 5 — the trip IS the pin.** `alarmReleased` fires when the physical
chain bottoms the pin (one-shot per drop; FF/catch-up latches honestly),
and the §25 angle-crossing survives as the AGREEMENT ASSERT in target
space — a pin that bottoms outside the coincidence window is a defect,
not a ring. The brake became the pure ON/OFF stop-work (lifts at arming,
still physically gated by §25 D's column): two holds, each real, each
with its own master. The `MECH_GRAPH.todo` row is retired. The ordering
defect this step caught — the strike section reads the pin BEFORE the
disc block poses it — is why the pin computes at the trip site from the
same closed forms.

**Battery (final tree, 45 units).** `bootWarns []` · fingerprint
**1026170114** identical across virgin boot / running / dirtied session ·
support 0 · graph clean (1 declared todo — the §9 handSetOffset debt) ·
clearances 0 · inspection `{includeExcluded}` 0 FORBIDDEN · penetration
budgets (pin⇄track, beak⇄contrate) worst depth 0 · verified end-to-end:
arm → wind → coincidence → pin drops → pawl withdraws → 4-turn ring to
empty → lock re-seats → pawl re-arms as the notch passes.

## 34. Two hearts — the armed set-position becomes real geometry (BUILT)

**Goal.** Retire §25 C's one remaining asserted behaviour: on arming, the
friction setting wheel "re-coupled" and the tube swept to a REMEMBERED
state variable — friction is phase-agnostic and cannot do that. The
honest memory was always the setting wheel's own angle; §34 builds the
mechanism that lets the tube FIND it.

**First slice (shipped separately, PR #22).** The coupling made
readable before being replaced: the blued index wedge on the wheel, its
partner line on the tube's flange (registered by the armed identity at
any setting), and the `ALARM_COUPLING_STEPS` demo on the §5/§17 engine
with the alarm's own script verbs. Plus the §31 harvest: `resetInputs`
owns the explode and invalidates the chain's baked path — two battery-
hygiene defects the superseded clamp's battery found.

**Pass 1 — the chain re-opens.** `ALARM_TUBE_BACK` became an expression
again: heart-B's 0.30 band enters between the wheel and the flange, and
everything below re-derives 0.45 deeper through the §29 chain. Total
height unchanged — the slack under the hour wheel absorbs it (plate gap
1.08 → 0.62, asserted); the cannon pinion lengthened a second time
(2.1 → 2.5). The owner's offered z-height increase was never needed.

**Pass 2, as REDESIGNED mid-build.** The side-chat's radial cardioid
for heart-B is geometrically impossible where it must live: its rMin
(2.75) sits inside the 3.05 bore the alarm tube demands, and scaling it
out sweeps the cam through its own follower's pivot — the degenerate
shell was caught by the sweep as a dist-0 hit on the hour tube, and the
three-way cross-check confirmed it real. The build pivoted to the
grooved-face-cam principle, §29-style: heart-B is an AXIAL heart — a
height-varying ring on the wheel's plate-side face (the cardioid law in
z, 0.02 at the notch to 0.10, built as raised relief: the notch is the
absence of height) — and follower-B is a PIN-ARM on the flange's top
face whose sprung up-pin seeks the cam's minimum; the slopes cam the
RELATIVE ROTATION until it seats. Measured: seated rock = hMin/reach
and lifted rock = lift/reach exactly (−0.0111 / −0.0888 over the 1.83
reach).

**The selector — the choice as parts.** A flat ring (r 4.45..4.75) on
three dial posts (az 60/220/300 — each wall asserted; the first post
layout died on the 12-o'clock well ring's arc and the wheel's tips)
slides 0.19 axially — a travel SIZED BY ITS OWN ASSERT (the first cut,
0.14, measured under the required bias and was refused). A rocker on
the tube's flange rides the ring's face with a ruby sensing pin — the
one contact a fixed member can make on a co-rotating one at every
azimuth — and its single finger presses the pin-arm's tail plate-ward:
ring up = pin lifted clear (disarmed), ring down = the pin's own spring
seats it (armed). The tube's law reads the SELECTOR's state; alarmOn
only turns the column wheel. The 350 ms friction sweep is retired —
arming is a spring snap on its own rate (0.12 vs CAM_SNAP_TAU), so the
two-speed feel survives with an honest cause. The column→ring run is
§35's filed debt, carried as a MECH_GRAPH.todo row the way §25 B
carried §29's.

**Battery (final tree, 46 units).** bootWarns [] · fingerprint
session-independent · support 0 · graph clean (todo 2: §9's debt + the
§35 run) · clearances 0 · inspection {includeExcluded} 0 FORBIDDEN ·
budgets: pin-B⇄face-cam and sensing-pin⇄ring swept on the alarm axis.

### §34 postscript — the sensing pin does not ride the face it reads

Measured against the live build (2026-07-29): the pin is buried in the
ring 0.024 disarmed and 0.062 armed — it passes through the face, with
the burial changing by state. Two causes, both in the tick's one-line
rocker law: the rocker group never sets `rotation.order`, so its tip
axis is not the tangential axis this section specifies (the exact trap
§54's postscript later fixed for the beak arm), and the `0.12`
amplitude is a bare literal that moves the pin 0.152 against the
ring's 0.19 — with a sign that is right only because of the
Euler-order bug it was fitted around. The sensing-pin⇄ring budget that
declared this contact healthy allowed 0.12 of penetration — 63% of the
ring's travel — and has been tightened to the tessellation tolerance
(0.03), with the overage carried as waived debt. TODO 19 owns the fix;
the *principle* (axial contact at every azimuth) stands, the built
registration does not.

**Closed (2026-07-29).** TODO 19's fix found a third defect under the
two filed ones: the pin was built pointing AWAY from the face (the
dialFace flip maps rocker-local −z to world +z), so its root cap did
the grazing and the ruby was decoration. The pin is re-hung through the
arm to protrude on the ring side, and the rocker's angle is now solved
per tick from the contact itself — measured kissing (−0.0007/−0.0024)
at both parities, the row and its budget unwaived, the fingerprint
moved deliberately to 2748333645.

## §35 — The unbroken link: pusher to arming, as one mechanical chain

**The debt.** §34 armed and disarmed with real geometry, but the
column wheel's state reached the selector ring by decree: the tick
read the wheel's angle and posed the ring. The user's ask — before 2b
was even built — was an UNBROKEN mechanical run from the pusher's
press all the way to the ring's slide. This section is that run:
pusher → pawl → column wheel → beak → rod → lay shaft → crank →
drive tab → ring. Every hand-off is a contact between two parts.

**The corridor hunt, and the instruments that lied.** Three routes
were built and torn out before this one, each signed off by a probe
with a structural blind spot; the lessons are now general guidance
(MODELING.md, "Free-space probing"):

- Route 1 (radial, az 155, rod at the rim) — passed a
  VERTEX-occupancy scan. Vertex scans see nothing in the interior of
  a big face (slabs and wheel discs keep vertices only at hub and
  rim); the "clean" line speared the keyless works, the yoke, and ran
  the rod down the crown-stem's own azimuth.
- Route 2 (chord, rod az 164 r 36.5, straight to the ring) — passed
  5-ray bundles at rest. The reserve axis then swept the fusee
  CHAIN's drum→fusee span across the rod column (the chain's fan owns
  az 162–173 at the rim, z 7.1–7.6), and the chain is thin enough to
  thread between bundle rays: only boolean BVH against the actual
  mesh, swept over tension 0→1, sees it.
- The search itself was once gated shut by a 0.001 graze: a probe
  offset at EXACTLY radius+CLEAR_MARGIN reads a legal at-margin fit
  as a hit (the keyless piece's real top is −6.549, not the assumed
  −6.55). The corrected epsilon reopened a 3000-chord solution space.

A FOURTH instrument lesson arrived after review: the first shipped
site (az 152 r 38) stood the rod 2.97 from the minute wheel's arbor —
inside its r≈5.1 tips — and the wheel spins during HAND-SETTING
(setPathRot), an input no battery axis swept, so a spoke passed
through the rod over ~24% of the wheel's revolution and every run
was clean. The battery now has a handSet axis (one full minute-wheel
revolution, crown pulled), setPose accepts setPathRot, every check
run starts from resetInputs() (canonical state, the §34 explode
harvest generalised), and the rod site keeps out of the wheel's whole
tip circle by assert — the swept-volume principle: a turning wheel's
disc is occupied space, spokes or no spokes.

A FIFTH lesson closed the search: the crown-PULL swings the yoke and
keyless furniture over the whole belt az ~138–164 r ~24–36, and the
power-reserve train wanders with tension — so every rest-pose-clean
west corridor died on the pulled axes, and the whole west arc (the
only region with a short beak tail) is unreachable. The probes that
settled the final route sweep 11–19 poses per candidate (rest, three
crown pulls, three reserve tensions, four strike phases, four
hand-set angles), use DOWNWARD rays from free air (an upward ray
started inside the jumper's blade had its exit face backface-culled
and passed a 0.02 graze), probe at the fattest occupant's radius, and
finish with a BOOLEAN margin-inflated proxy — rays alone thread the
chain, which still nicked az 208 at one of 61 tensions.

The surviving geometry: rod column az 212° r 26 (south-west — past
the drum's chain span, outside the pulled belt, 12+ from the minute
arbor), reached by the beak's LONG TAIL, then ONE straight lay shaft
to the ring at az 146° — the knuckle died with the west routes.

**The parts.** The beak is one plate-top lever pivoted ON the
wheel→rod segment (collinear by construction: post 2.45 from the
wheel's centre — its own skirt clearance derived — nose landing
mid-castellation, tail ending exactly over the rod). The tail is
LONG (~28, its plane probed under the strike sweeps — the striking
cam spins at the same z): the nose's ~0.005 dip amplifies ~35:1 into
the full 0.19 throw, détente-style. It reads the castellations 120°
from the brake's read point (two pitches: identical parity). The rod
drops through bevel-safe r 0.45 bores in both plates (r 0.28 was
silently sealed by the plates' extrude bevel collar — MODELING.md
rule 1's revenge; the bore-drift assert now has ray-proof behind it).
ONE lay shaft runs the rod's foot to the ring at az 146° — an arbor
at z −6.26 (bottom 0.169 above the keyless piece's measured top) on
two plate-hung bushes at down-ray-proved stations, with parallel end
cranks so the centre crank repeats the rod's throw under the ring's
DRIVE TAB (a slotted boss at dial-local az 34°, the mirror of world
146°). The shaft group orders its eulers 'ZYX' — the roll must turn
about the shaft's LENGTH; the default order rolls about world-x and
tilts the arbor end-over-end (±2.3 in z at full throw, measured
before the fix).

**What the tick changed.** The column ease was HOISTED to the
selector block (its first consumer — the third one-tick-stale lesson
this feature has paid for); §25 D now only wears the eased state.
The selector's target is `1 − profileAt(colA + 120°)`: the ring's
slide IS the beak's read of the castellations, and the rod, shaft
and cranks pose from the same derived quantity — the chain is one
fact end to end. The LOW_LINKAGE_OBSTACLES record (2D by design —
its usual consumers span every z) is consumed by a z-separation
assert: the whole under-plate run tops at −5.69, the record's lowest
member rides at 0.17.

**Battery (final tree, 47 units).** bootWarns [] · support 0 ·
graph clean (todo 1: §9's debt — the §35 row is retired) ·
clearances 0 · penetration within budgets (beak⇄castellations on
alarmStrike, crank⇄ring on alarm) · inspection {includeExcluded}
0 FORBIDDEN (now including the handSet axis) · rod⇄minute-arbor:
0 intersections over 720 spin steps (was 172 of 720 at the first
site); ring slide and rod throw both 0.19 across the toggle; the
coupling demo steps the column 30°/press with profLink flipping 0/1.

### §35 postscript — "every hand-off is a contact" did not survive measurement

An adversarial audit of this section's central claim, verified against
the live build (2026-07-29), found it false as implemented — not by one
defect but as the run's architecture. Every member's pose in `tick()` is
its own closed-form function of the one scalar `alarmSelShownT`; no
member reads the transform of the member that claims to drive it. "The
chain is one fact end to end" (above) is true only in the sense that
condemns it: one *number*, fanned out to five independent animations.
The head is reversed too — `setAlarm()` writes the flag and bumps
`alarmColSteps` to match, so there is no pawl and the pusher indexes
nothing.

Signed separations at the two parities (the `alarmHandoffs` check,
which now carries these as waived debt): column⇄nose **+0.02/+0.16**
(the nose's derived dip is 0.005 of the 0.55 relief); tail⇄rod
**−0.22 both** (the tick lifts the rod by a stale `0.25` literal, not
the derived `ALARM_LINK_ROD_FOOT`); rod⇄crank **+0.07/+0.06**
(TODO 9); crank⇄tab **−0.22/−0.25**; ring⇄pin **−0.02/−0.06**
(TODO 19). A working contact should sit within ±0.03.

Why every battery line above was green while no hand-off closed: the
intra-unit contacts are invisible to the pair sweep (TODO 5), the
crank budget policed the *ring* — a mesh the crank never reaches —
instead of the tab it presses, and the 0.12 budgets were 63% of the
whole 0.19 travel, wide enough that touching and buried read the same.
The instruments, not just the geometry, had to be fixed first; TODO 20
holds the full account and the path out (an axial face cam on the
column wheel — §34's own heart-B principle — in place of the six-member
run).

**Addendum (2026-07-29, later the same day): the run is now driven.**
TODO 20's rebuild landed: the press is the primitive and the wheel's
parity the state; the castellations are cut from `profileAt` itself
(mesh and law one function); the nose rides the column tops it reads;
the rod is built between its two contacts with TODO 9's constants
retired; the cranks sit in per-crank keys; and the tick solves cam →
lever → rod → roll → ring forward, contact by contact, with the ring's
0.19 a measured OUTPUT. Four of the six hand-offs measure closed and
unwaived. Two remain as waived, measured debt — the forked tab (the
centre finger's root and the shaft transfix the tab's plane: TODO 16's
"slot", finally literal) and the pawl's park — with the ring's missing
bias spring noted beside them; TODO 20's status block carries the
numbers. One correction to this postscript's own text: "there is no
pawl" was an overclaim — the pawl and its ratchet existed; the
causality didn't.

**Addendum 2 (same day): all six close.** The fork landed — two plates
flanking a groove with side webs, built at the registration solve ON
the pin's solved engagement, the shaft ending a fixed retreat short,
the centre pin riding the groove at its working clearance and driving
the ring positively both ways (the transfixion and the phantom bias
spring retire together). The pawl parks on the tooth it drives. Every
hand-off row measures green with ZERO waivers; the one filed gap is the
pawl's index stroke, a transient that wants a pose axis of its own
(TODO 20's closing status). The §35 run — pusher to arming as one
mechanical chain — is, for the first time, what this section always
claimed it was.

## §10 level 1 — Grouped explode: the selector speaks in assemblies

**Shipped in part, on purpose.** §10 was filed as two levels: level 1
groups the flat unit list into assemblies, level 2 drills *into* a
group and separates its own sub-parts. The entry itself said to ship
level 1 alone because it is the majority of the usability win. That is
what this section is. **Level 2 is unbuilt and stays in the roadmap
under the same §10** — the sub-labels, the parent-aware
`updateExplode`, and the additive-offset refactor §32 depends on are
all still ahead.

**What it replaces.** §7 shipped a per-unit selector over a flat list;
that list had grown to 49 entries by §35, which is a wall, not a menu.
§25 D then proved the group mechanism on exactly one group ('Alarm
complication'). Level 1 generalises that one group into a total
partition and makes groups the selector's primary vocabulary.

**`UNIT_GROUPS` — a partition, not a grouping.** Eight groups over all
49 selectable names: Escapement, Going train, Fusee & chain, Keyless &
winding, Zero-reset & hacking, Dial side, Frame & plates, Alarm
complication. Each is a Map of member name → layer, where the layer
overrides the entry's registered layer only while that group is
selected. `null` means "keep your own registered staging", and it is
the honest default: an unchoreographed group then lifts as its slice
of 'All' rather than as a slab. Only the alarm group carries real
per-member layers, inherited unchanged from §25 D.

**Two departures from the plan, both forced by the code.**

- The structural group is **`Frame & plates`**, not the plan's
  'Structure'. `Structure` is already `backPlate`'s name *and* the
  catch-all `explodeEntryName` hands to any unlabelled explode entry;
  a group by that name would shadow the unit and make it unselectable,
  since the selector resolves a group first. The assert now checks for
  that collision class by name.
- **Per-unit selection stayed.** The plan's acceptance said the
  selector should list groups "not 30 parts", but part granularity is
  level 2's job, and until level 2 lands the per-unit list is the only
  way to isolate one part — removing it would have been a regression
  against §7. Groups lead under an `Assemblies` optgroup; every unit
  remains reachable under its own group's box.

**The assert is the feature.** §25 D's check only asked whether listed
members were real label names. It could not ask the converse, and the
converse is what rots: `Alarm selector`, `Alarm lock`, `Alarm switch`
and `Alarm link` — all §34/§35 parts — had joined the movement without
ever joining a group, silently, for two whole sections.
`assertUnitGroups()` checks membership, coverage AND exclusivity, plus
group-name shadowing. It found those four the first time it ran.

It runs after the first `updateChainIfMoved()`, not at the table: the
Chain registers its label lazily, so a boot-time assert would warn
about a unit that simply does not exist yet — a false alarm in a
project whose rule 6 is that boot is silent. The selector is rebuilt
at the same point for the same reason.

**One ordering trap, found by writing the fix for it.** The rebuild
reads back a current selection to preserve it, and reading it from
`unitSelect.value` is wrong: `applyDeepLink()` runs at module scope,
before the Chain's option exists, so `?unit=Chain` assigns a value the
`<select>` cannot hold, and the rebuild would quietly reset a
legitimate selection to 'All'. `selectedUnit` is the source of truth.
The same read also fixed a latent §25 D bug — a selected *group* was
reset to 'All' on every rebuild, because the old guard tested
membership against unit names only.

**Battery (47 units).** bootWarns [] · support 0 failures · graph
clean (todo 1: §9's pre-existing debt) · penetration 11 rows within
budgets · clearances 0 violations · inspection {includeExcluded} 72
pairs, all EXPECTED, 0 FORBIDDEN · geometry fingerprint 3312892754,
identical to the pre-change tree (10 poses, 46 units) · 'All' explode
positions bit-identical to pre-change across 47 units × 3 amounts,
A/B'd against a worktree of the parent commit. No geometry changed and
none could: explode is render-side, and `start()` calls
`resetInputs()` before every sweep, so the battery never sees a group
at all.

**Note for whoever runs the battery next.** Both long sweeps yield via
`setTimeout(0)`, which the automation harness throttles to ~1 s, so a
default run effectively never finishes there. `yieldEvery: 64` clears
it (clearances 299 s, inspection 46 s). 384 wedges the tab — the mild
version of the `yieldEvery: Infinity` trap CLAUDE.md already warns
about.

## §37 — Camera poses as shareable, scriptable state

**The gap, found twice in one review session.** §35's link runs from the
column wheel across the whole south-west to the ring, and neither
surface that should show it could aim at it. The script engine's
framing vocabulary was preset-only (Escapement / Train / Dial /
Setting / Free), and the deep-link scheme shared every view SETTING
(?preset, ?scale, ?xray, ?explode, …) except the one thing that frames
a discovery — the camera. Reviewing §35 meant hand-posing
`__clock.camera` in a console; sharing that view meant a screenshot.

**One primitive.** `goToPose(pos, target, { snap })` owns the single
`camTween` the frame loop already ran, and `goToPreset` became a lookup
in front of it — a preset is a NAMED pose plus its `reveal` rule,
nothing more. Everything below is a consumer, so there is one ease
(`CAM_TWEEN_DUR`), one abort-on-takeover path, and one place that
clears the preset row's highlight when the viewer leaves a named
framing.

**Snap versus tween, decided once.** A pose that is ALREADY the answer
— a restored session, a shared link — snaps; a pose the viewer is being
*taken to* tweens. Flying a recipient from Free to a shared framing
would animate 0.9 s of travel the sharer never asked for, so `?cam`
snaps and cancels any in-flight preset tween rather than racing it.

**Three consumers.**

- *Deep link* `?cam=x,y,z&look=x,y,z`. Each param is judged alone: one
  that is absent, short, long, or unparseable is ignored and the live
  value stands — `Number.isFinite` also rejects `NaN` and `Infinity`,
  which `parseFloat` happily returns. Given both `?preset` and `?cam`,
  cam wins: a literal pose is the more specific claim.
- *Script step* `camera: { pos, look }`, tweened exactly as a preset is
  because it goes through the same primitive. Keeps one-off framings
  out of the preset table, which is a menu the viewer reads, not a
  scratchpad. Wins over `preset` in the same step, matching the
  deep-link precedence.
- *Share view*, in the Camera section. Serialises the live camera plus
  only the NON-DEFAULT toggles, so a bare view link stays a view link.
  Reserve is deliberately excluded: it drains while you read, and
  baking it in would make the link mean something different by the time
  it arrives. Three decimals — at the Free preset's ~100-unit standoff
  a 42° FOV across ~1000 px puts one pixel near 0.075 units, so 0.001
  is about 1/75 px. `URLSearchParams` percent-encodes the commas, which
  are legal raw in a query and this link exists to be pasted, so they
  are put back — and only they, since a unit name like "Fusee & great
  wheel" must keep its escaping.

**Clipboard, honestly.** `navigator.clipboard` needs a secure context
and can still be refused by permissions policy, so the button falls
back to the legacy `execCommand` path and then to a prompt carrying the
URL. Verified with a REAL pointer click, not a synthetic one: a
synthetic `click()` is not a trusted gesture, so it exercises only the
fallback and would have "passed" while telling you nothing.

**First consumer — the §35 chain, traced.** A SIBLING script
(`ALARM_LINK_STEPS`, the "Trace" button), not an extension of the §34
coupling show, whose subject is correctly the centre. Seven stops:
pusher at the rim → the second beak reading the castellations → the
long tail's sweep → the x-rayed rod drop → the lay shaft under the
plate → the centre crank on the ring's drive tab → and back, reversed.
Each `alarm:` toggle in the script IS one pusher press, so the chain
really runs; the camera only follows it.

Every pose is DERIVED from the part's own site constant — never a typed
vector — so a layout change carries the camera with the part. `linkShot`
takes a framing radius and a direction in the (radial, z) plane,
normalised, at the preset block's 42°-FOV fit rule (≈3.8×R).

**Two things the framings taught, on screen.** A pose can be arithmetically
perfect and still show nothing, and only looking catches it:

- The tab stop's first draft aimed at world z −0.91 — the raw
  dial-LOCAL value. `dialFace` is Y-flipped (CLAUDE.md's standing
  trap), so the real ring sits at −6.09 and the camera was 5.2 off,
  looking at nothing. It now derives through `Z_DIAL − z` and a boot
  assert checks that derivation against the built ring, because a
  camera that misses cannot fail a test that does not exist.
- The centre is the one stop a radial standoff cannot frame: the hands
  sweep in front of it on the dial side (they sit BEYOND the dial, so
  x-ray does not help — it glassifies the dial and 3/4 plate, not the
  hands), and the going train and fusee chain fill it from the plate
  side. It borrows the Dial preset's own viewing direction, read from
  the preset table rather than copied, which is the framing §34's show
  already proves carries a centre subject.

**Battery (47 units).** bootWarns [] · support 0 · graph clean (todo 1:
§9's standing debt) · penetration within budgets · clearances 0
violations · inspection {includeExcluded} 0 FORBIDDEN · geometry
fingerprint 3312892754, unchanged — this is render and I/O, and the
sim math is untouched.

## §36 part one — The swept-volume registry, and the assert it owes

**Shipped in part.** §36 is three parts: the registry, a
pose-independent overlap check, and a routing surface. Part one is
built. Part two is not. Part three the entry itself gates behind §33's
plumbing, which does not exist. **Parts two and three stay in the
roadmap under the same §36** — the partial-ship convention §10 set.

**A first slice shipped alongside it.** `findFreeAnnulus` (the
`freeAnnulus` check) answers the narrower question "is there a clear
RING of clearance at this height", by slicing the scene and OR-ing over
every pose axis — the same swept semantics this registry generalises,
and a working precedent for the occupancy grid part three needs. It was
built to answer §38's siting question and validated against two known
answers before being trusted anywhere; see §38.

**The debt.** §35 burned three built-and-torn-out corridors on probes
that could not see what MOVES, and the battery's own axis sampling can
pass a wheel spoke between two samples (TODO items 5–7). Every fix was
a smarter one-off probe. A registry makes it structural: each part's
hull over its whole pose range, derived once, so questions get asked of
the hull instead of of a sample.

**Derived, not declared.** §36 said most volumes should be derivable,
and a hand-authored table is the thing that rots — §10 found four units
that had gone ungrouped for two sections, §16 found the same wheel
radius derived twice under two names. So `buildSweptRegistry`
classifies each mesh from its own motion:

| motion | volume | status |
|---|---|---|
| motionless | the geometry itself | proven |
| planar, fits a circle about a z-parallel axis | annulus sector (centre, r-band, z-band, θ-coverage) — exact for a rotation, pose-INDEPENDENT | proven |
| anything else (§35's lay shaft turns about a RADIAL axis) | union of per-pose bounds | **approx — explicitly not a hull** |

514 volumes on the shipped movement: 210 revolve, 167 static, 137
approx.

**The assert §36 requires.** Every volume must contain its part at
every pose, validated against a FINER, phase-shifted sample set than
the one it was derived from — checking a hull against its own samples
is vacuous, and catching a hull that has gone stale is the point. Of
the 377 PROVEN volumes, **0 escape**. All 55 escapes are `approx`,
which is the assert correctly reporting that a per-pose box union is
not a hull.

**Angular coverage cannot be an interval.** Each frame's arc bounds
come from its own `atan2` branch, so taking min/max across frames
mixes branches. That read as 74 containment failures on the first run,
every one an artefact of the bookkeeping rather than a real escape.
Coverage is a circular bitmap now, which also represents the genuinely
disjoint arcs a part occupies on different pose axes — something no
single interval can.

**The spoke rule earns its place.** A part advancing further between
two samples than its own angular width is promoted to a FULL revolve,
because the samples do not overlap and their union is not the swept
set. 59 volumes qualify. That is §36's own "a revolve fills spoke gaps:
a corridor must never thread between the spokes of a turning wheel",
and it is now a mechanism rather than a sentence.

**The finding that matters: OSCILLATORS CANNOT BE BOUNDED BY SAMPLING
AT ALL.** A part that swings out and back between two samples sweeps
further than the interval between them, and no sample count fixes it —
the balance, the pallet fork and the reset hammer each escaped their
derived arc exactly this way. They are bounded by the full circle now:
safe, and loose (122 volumes).

Tightening them is NOT derivable from poses. It needs the pose law
DECLARED — `FORK_BANK_DEG`, the balance amplitude. §36's wording,
"declares, or derives from `MECH_GRAPH` + its pose law", reads like an
either/or convenience; it is load-bearing, and part two has to be built
knowing that a meaningful fraction of the registry will always be
declared rather than measured.

**Battery.** No geometry and no sim change — the registry only reads
poses. Fingerprint 3415378947, unchanged; boot silent. Runtime ~3 s
fronted, ~55 s under the harness's yield throttling.

**Note on the rebase, because it nearly shipped broken.** The registry
and §38's free-annulus probe insert at the same point in `inspect.js`,
so they conflict. Stripping conflict markers is NOT the same as
resolving a conflict: the first resolution silently ate the probe
function's closing braces, looked clean, and surfaced only as a
`SyntaxError` on load. The check that actually proves an additive
change is `git diff <base>` showing ZERO deletions — any removed line
is a defect by definition.

## §28 — Fresh-load hygiene: never serve a stale build

**Delivery, not the movement.** Like §26 this lives outside the
mechanism, but it is the difference between a viewer seeing today's
escapement fix and last week's. Build and serving only — sim math
untouched, no geometry, no `MECH_GRAPH` impact.

Two layers, and the point is not conflating them: make a changed file
get a new URL, and give an already-open tab a way to update. Caching is
NOT disabled — the JS is large and wants to cache.

**Layer 1 is not what the entry proposed, because the premise was
wrong.** §28 assumed GitHub Pages and prescribed an esbuild step
emitting content-hashed filenames. This project does not deploy to
Pages: `release.yml` tags `main`, uploads the tree over SFTP into
`<releases>/<version>/`, and repoints a QA symlink. A bundle would also
have cost two things worth more than the caching problem — the
importmap (so `three` stays ONE shared instance) and
`await import('./src/inspect.js')` from the console, which is
CLAUDE.md's documented way to run the battery.

So `tools/stamp-release.mjs` versions URLs instead: `index.html`'s entry
point and importmap targets, plus every relative specifier in the module
graph. A module's imports resolve against its OWN url and a query does
not propagate, so each file has to carry the version itself. 14 urls.

**URLs stay RELATIVE, and that is the load-bearing decision.** The
obvious move is to rebase every asset onto an absolute
`/<releases>/<version>/` path — the release directory as fingerprint,
exact rather than content-derived. That works only if the releases
directory is itself inside the web root, and the site is distributed as
the SYMLINK: if the web root IS the symlink, `/<releases>/…` is not in
the URL space at all and every asset 404s. Fixing a caching problem by
breaking the whole app on the next release is a bad trade, and the
layout is not knowable from this repo. `?v=<version>` changes the cache
key under either layout, so nothing depends on knowing.

**The stamper asserts the sweep was TOTAL**, rather than trusting a
count — any relative asset url still lacking a version would be a file
served stale forever. It earned itself immediately: the first version
matched only `./` and silently left `inspect.js`'s
`../vendor/three-mesh-bvh` import unversioned, and the scan agreed,
because it looked for less than the rewrite did. **A check that searches
for less than the change it verifies will always pass.** Both now match
`./` and `../`.

**Layer 2 — the half nothing else can cover.** A tab already open when
the deploy landed. JS cannot purge the HTTP cache (`reload(true)`'s
`forceGet` is dead in every modern browser), so the mechanism is layer
1's changed url plus a reload the VIEWER chooses. Reloading unasked
would throw away state that took real effort to reach — a crown
mid-pull, an explode mid-drag, a tour three stops in.

**The version is BAKED into the document, not fetched at boot**, and
the first draft got this wrong in the one way that mattered. Asset urls
are per-release so assets can never go stale; `index.html` at the
unchanging symlink url is the one document that can. If a browser
replays a CACHED `index.html`, then "what am I running" fetched at boot
returns the NEW version while the loaded code is old — no mismatch, no
toast, a viewer silently pinned to a stale build with the checker
satisfied. The one case layer 2 exists for was its blind spot. The
comparison is baked-vs-live now, so stale HTML is caught on the first
check and the reload it offers revalidates the document.

Polling is gated on visibility plus a slow interval, never a tight
loop: a hidden tab costs nothing, a visible one asks at most once a
quarter hour, or the moment it is focused — which is when a stale tab
actually matters. `version.json` is fetched `no-store`; it is the one
file that must never come from a cache, since its whole job is to
reveal a stale one. An unstamped tree (development) has no
`<meta name="app-version">` and so fetches nothing at all.

**Verified against a simulated deploy** on the dev server: unstamped
tree silent and requesting nothing; stamped and matching, silent;
newer version on focus, toast appears; dismissed, the same version does
not nag; a LATER deploy re-arms it; and the stale-`index.html` case —
running 0.1.4 against a server serving 0.1.5 — detected, offering
0.1.5. Stamped tree boots clean with all 14 assets carrying `?v=` and
ZERO unversioned `src/`/`vendor/` requests.

**Battery.** None needed and none affected: fingerprint 3415378947
unchanged, boot silent, `runInspection` untouched. `version.json` is
gitignored so a local test cannot be committed; `tools/` is excluded
from the release payload while staying in the checkout the stamp step
runs from.

**Out of scope, per the entry, and not built:** offline support,
precaching, any service worker, any auto-reload.

**Still worth doing, outside this repo.** `Cache-Control: no-cache` on
`index.html` and `version.json` at the symlink path. Layer 2 RECOVERS
from a stale entry document; a no-cache header stops it happening at
all. Recovery is the safety net, not the plan — but it cannot be set
from here, since deployment is an SFTP upload into an existing server
config.

## §38 — Alarm precision: what shipped, and why the mechanism did not

**An entry that was answered rather than built.** §38 proposed a
peripheral gate ring to take the alarm's firing window from 16 min to
0.92 min. It is NOT built, and the roadmap entry recommends against it.
What shipped is everything the investigation turned up on the way, and
that is the honest bulk of it.

**The premise was wrong, in two places at once.**

`alarmTargetSeconds()` — the nearest quarter mark — has **no
behavioural role**. It feeds a panel readout and an inspection getter,
nothing else. The release is geometric: the pin bottoms when the disc's
notch floor arrives under it, and the disc angle carries the
CONTINUOUS set position. So the alarm was never settable-only-to-
quarters; the READOUT was what rounded.

And 16 min was the wrong figure for the window. 16 min is the notch's
WIDTH; the pin only bottoms across its flat FLOOR — |align| ≤ gapHalf −
pinArcHalf — which is **2.76 min**. The alarm already rings within
about **±1.4 min** of the hand.

| | |
|---|---|
| setting resolution | continuous (not 15 min) |
| firing precision | ≈±1.4 min (not ±8) |
| best free ring, probed | ±0.46 min |
| what the ring would buy | **±0.94 min** |

±0.94 min does not pay for a compound idler (1:1 across a large radius
change cannot be done in one mesh), a ~34-radius ring, a feeler out
there and a linkage back — sited in the band §29 and §34 have already
squeezed twice, with the usable rings PLATE-side at z −1..−2 while the
feeler works at ≈−6.

**What shipped, and what changed for a viewer.**

- **The panel now states the true firing time.** It announced
  "Rings at 3:00" for an alarm that rang at 2:52 — a shipped readout,
  under the label "Set for", naming a time the movement demonstrably
  does not ring at. One readout now, derived from the disc's own angle
  (Rule 2 — the same quantity the trip reads). Verified: panel ≈9:44,
  fired 9:41, inside the notch floor (±1.4) plus the fast-forward
  sampling stride (±1.5). The `≈` is load-bearing: printing a bare
  minute would be a smaller version of the same lie.
- **The alarm can ring under fast-forward at all** (TODO 8, now
  closed). The whole trip sat inside a `!fastForward` gate: 30
  sim-hours crossing the coincidence twice never rang. FF now drops out
  at the release so the ring is witnessed at real speed, and the ring
  holds the release tick, which still carried the FF `rawDt` and spent
  87% of the alarm's power on its own.
- **A step-over guard**, because the margin that makes any of this work
  is thin: the pin's floor is 1.8× one FF stride, and narrowing the
  notch consumes that. It warns once if a coincidence is crossed in a
  single tick without the pin bottoming.
- **The free-annulus probe** (`findFreeAnnulus`, registered as the
  `freeAnnulus` check) — built to answer this entry's siting question
  and useful well past it. It is §36's first slice; see that section.

**If precision is ever actually wanted, the ring is the expensive
half.** The floor is pin ÷ radius, and the pin is a ROUND 0.28 rod. A
blade or knife edge — which is what §35's beak already is — narrows it
with no new train and no new z: ≈1.5 min against today's 2.76, for one
part changed. It inherits the stride constraint above, so check that
first.

## §36 part two — Pose-independent overlap against the registry

**Built, and deliberately not wired into the standing battery.** It
would fail today on artifacts rather than on collisions — see the
finding below — and a gate that cries wolf is worse than no gate. It
runs on demand: `start(clock, 'sweptOverlap')`.

**What it is for.** The pose battery samples, so it can pass a wheel
spoke between two samples (TODO 7). This asks the same question of the
HULLS, where there is no sampling to under-do: if a fixed part lies
inside the volume a mover can reach, they meet, and no pose schedule
hides it.

**The soundness line is the design.** What the check may CLAIM is not
uniform, and pretending otherwise would be the whole bug:

- *Static vs revolve — SOUND, reported as violations.* The fixed part
  is always there and the mover reaches every point of its hull, so an
  overlap IS a collision at some reachable pose. This is the §35 class
  exactly: a rod standing in the annulus a wheel turns through.
- *Revolve vs revolve — NOT sound as a claim.* Two hulls overlapping
  means a collision only if both parts can INDEPENDENTLY reach the
  offending phases, and in a going train they cannot — phases are
  locked by the teeth, so every meshing pair's hulls overlap BY
  CONSTRUCTION. Reported separately as phase-dependent (35 pairs),
  never as violations, or the real ones would be buried under the
  movement's entire gear train.
- *Anything `approx` — not claimed at all.* Part one's assert already
  established these are per-pose boxes rather than hulls (all 55 of its
  containment escapes are theirs), so a check built on them would be
  asserting what the registry explicitly does not know. 14 units
  excluded.

Declared contacts opt out through the same `EXPECTED_PAIRS` /
`IGNORED_PAIRS` the pose battery uses — one vocabulary, not a second.

**Validated with a POSITIVE control, because zero violations on a clean
movement proves nothing.** Run with the opt-outs disabled
(`includeDeclared`), it flags 36 pairs including Balance ⇄ Balance
cock, Balance ⇄ Hairspring and Balance cock ⇄ Hairspring — pairs that
genuinely touch. The geometry test fires.

**And then the result IS the finding.** With opt-outs on it reports 17
violations, and every mover among them is bounded by a FULL REVOLVE:

| mover | revolve volumes | full | why |
|---|---|---|---|
| Setting lever | 7 | 7 | oscillates, spoke |
| Reset rod | 3 | 3 | oscillates, spoke |
| Minute jumper | 4 | 4 | oscillates |
| Keyless works | 15 | 14 | spoke, covered, annular |

A lever that truly swings a few degrees is being treated as sweeping a
complete annulus about its pivot, which overlaps half the movement. All
17 are artifacts of part one's conservatism, not collisions.

**And then it measured its own fix.** Reading those 17 sent me back to
part one, where two bugs were hiding behind the conservatism:

- *Axis boundaries were being read as motion.* The frames are every
  axis's sweep concatenated, so at each boundary the pose jumps from one
  sweep's end to the next's start — not movement the part performed.
  Both the spoke rule and the oscillation test compared across that, so
  a part monotonic within an axis and stationary elsewhere looked like
  it BOTH jumped and reversed. The setting lever and minute jumper were
  exactly that.
- *Validation only reported.* Fixing the first bug made the registry
  UNSOUND — 13 proven volumes stopped containing their own parts at the
  finer sweep. Deriving tight is only safe if failure has a fallback, so
  a failing arc is now widened to full (21 volumes), and one that still
  fails on its r or z band — proof the motion is not a rotation about
  the fitted axis at all — is DEMOTED to approx (19), where the registry
  says plainly it cannot hull the part.

Unsound volumes 13 → **0**; part two's violations 17 → **9**; positive
control still firing at 27, so the reduction is tighter hulls and not a
quieter check. 21 widened and 19 demoted is now the honest measure of
how much of this movement cannot be pinned from samples.

**The 9 that remain are a different class.** All are `Keyless works` and
`Reset rod`, which have COMPOUND motion — the reset rod translates AND
swings, both endpoints moving — so no single rotation bounds them and a
declared ARC would not help. They want a hull of their own. That, plus
the declared travels for genuine oscillators (`FORK_BANK_DEG`, the
balance amplitude), is the declaration surface, and this check is the
instrument that will measure whether it worked.

## §39 — `UNIT_MM`: pin the scale, don't choose it

**The question this answers.** Is this a wristwatch or a mantel clock?
The model had no unit→mm mapping, so nothing on screen could state a
real size without inventing one.

### The trap, which is what the entry is really about

The obvious definition is "pick the scale that puts the case under
40 mm" — §2's target. That is **circular**: it makes the size target
true by construction and tests nothing. Any scale can be made to
satisfy a budget you also chose.

So the scale is pinned to the one dimension here that is a
**manufactured standard** rather than a style choice — fusee chain
pitch. Real fusee chain runs ~0.30 mm rivet-to-rivet, and the tolerance
is narrow because the chain has to sit in a groove cut to match it:

```js
export const CHAIN_PITCH    = 0.8;                         // units, geometry
export const CHAIN_PITCH_MM = 0.30;                        // REAL, manufactured
export const UNIT_MM        = CHAIN_PITCH_MM / CHAIN_PITCH; // 0.375 mm/unit
```

`CHAIN_PITCH` moved from `main.js` into `layout.js` so the geometry and
the scale cannot drift apart — the chain the model draws and the chain
the scale is pinned to are now one constant.

**Independent cross-check.** §2's mapping study proposed ~0.38 mm/unit
by eye from overall proportions. This derivation lands at 0.375, from a
completely different direction. Two methods agreeing to within 1.5% is
the argument for the number; neither alone would be.

### Everything else became a prediction

Because the scale came from the chain, the movement's real dimensions
are now falsifiable outputs, asserted at the end of the build:

| quantity | units | mm | envelope |
|---|---|---|---|
| plate diameter | 85.85 | **32.2** | 20–40 |
| balance diameter | 21.7 | **8.1** | 6–13 |
| assembly depth | 25.94 | **9.7** | 2.5–12 |

All three pass, and none was tuned to. The envelopes are deliberately
**wide**: a narrow range would just be this model's current numbers
written down twice, which asserts nothing. Verified falsifiable — the
plate check passes at 0.375 and fails at both 0.20 and 0.60.

The chain pitch itself is deliberately **not** asserted against its own
real-world value; that would be the circularity the entry exists to
avoid. What is checked is that the geometry still reproduces it.

### Two numbers this corrected

- §2 quoted an **87.4-unit plate**; it measures **85.85**.
- §2 quoted a balance of **≈ 10 mm**; it is **8.1**.

And one it did *not* correct, because they are different quantities:
§2's "z-stack ≈ 18.6 units" is the going-train plate stack, while the
assert measures **overall assembly depth** — 25.94 units, spanning the
hands standing off the dial (the `Dial` unit reaches z −13.84, well past
`Z_DIAL = −7`) up to the alarm barrel at +12.1. That is what a case has
to swallow, so it is the one worth asserting; calling it "movement
thickness" would have quietly conflated the two.

### On screen

The axes legend (added with §35's rod work) now carries the scale as
well as the directions:

```
arm 49.4 u = 18.5 mm · 1 u = 0.375 mm · ⌀32.2 mm plate, 9.7 mm deep
```

The arm length is the `AxesHelper`'s own, so the legend is a readable
ruler rather than a caption. Showing mm is only honest **because**
`UNIT_MM` is pinned and asserted — before §39 the same text would have
been decoration, which is precisely what §21 warned against.

### What this unblocks

§21 (scale reference — silhouette overlay, stats line) was parked
"behind §2", i.e. behind a large deferred compaction job. What it
actually needed was one asserted constant. §2 keeps the compaction work
and can now, for the first time, measure its own "≤ 40 mm" target.

## §21 — Scale reference: making 32 mm mean something

§39 gave the movement a real size. Millimetres only mean something to
someone who already thinks in millimetres, so this draws the comparison.

### Two instruments, because one could not be honest at every zoom

**A scale bar, at true on-screen scale.** Pixels-per-unit is derived by
projecting two points one unit apart along the camera's *own*
screen-right axis, so it is correct at any orientation and FOV without
duplicating the projection maths:

```js
camera.getWorldDirection(_srF);
_srR.crossVectors(_srF, camera.up).normalize();
// project origin and origin+_srR, take the NDC delta
```

The bar's **length** is chosen from a 1-2-5 ladder so it always draws
60–200 px. A fixed 10 mm bar would be 4 px across zoomed out and
2000 px zoomed in; picking the step is what keeps one instrument
readable over the whole range, which is why the label is generated
rather than written.

The bar is labelled just `5 mm`. It first read `5 mm at the movement`,
carrying the perspective caveat inline — and that was wrong placement,
not wrong content. Under a perspective camera a millimetre covers more
pixels the nearer it is to the eye, so the bar is exact only at the
movement's depth; a part swung toward the camera renders slightly
larger. True, but it was the first thing the eye met, and jargon in a
headline makes a number harder to trust rather than easier. A micrograph
writes the number and footnotes the rest, so the caveat moved to the
panel's fine print.

The footnote names **the origin**, not "the movement", because the
origin is where the axes are drawn — so the caveat points at something
the viewer can see. The two instruments are in fact the same ruler:
measured at camera 60 / 120 / 300, the bar's px-per-mm and the on-screen
spacing of the 1 mm axis ticks agree to within **0.05%**. The first
wording described that relationship correctly and helped nobody; "same
scale as the axis ticks" can be checked by looking.

**A diagram, at its own scale, that says so.** The first attempt drew
the reference objects at true on-screen scale, and it does not work: a
24 mm coin against a 32 mm movement is the *same order of size*, so once
the movement fills the view the coin does too and there is nothing left
to compare against. Clamping the circles to fit was worse — it drew a
wrong-size circle labelled with a real diameter, which is exactly the
decoration §21 was written to forbid. So the comparison became an
explicit diagram: everything in it is to scale with each other, at a
scale of its own, and the caption says that out loud.

### Two corners, because only one half moves

The bar and the diagram started in one box and were split apart: the bar
re-lengths and re-labels on every camera move, the diagram never
changes, and sharing a box made the whole panel read as twitching. Bar
bottom-right, diagram bottom-left — each corner with one job.

The diagram then has to **dodge the control panel**, which owns the left
edge and grows downward as its sections open. Both moves are
conditional and recomputed, so the common case keeps the plain corner:
sideways past `#clock-ui` when it would actually overlap, then
vertically above the bar if that sideways move pushed it there.

Three bugs on the way, none of them in the layout and all in the
**checking** — each the same shape, a test that looked at less than the
thing it was testing:

1. Panel visibility read `offsetParent !== null`. `#clock-ui` is
   `position: fixed`, and a fixed element's `offsetParent` is *always*
   null. The panel was never seen, the dodge never fired once, and the
   overlap checks reported no overlap because they were measuring
   nothing. A zero-size rect is the honest test.
2. The lift condition read the diagram's **live** rect, which makes it
   self-cancelling: lifting clears the overlap, the test goes false, it
   drops back, the overlap returns — a flip every frame, and a single
   snapshot catches whichever phase it lands on. It now tests the
   prospective *unlifted* position, which does not depend on the answer.
3. The first overlap test compared the two scale elements only to each
   other, never to the control panel, so it passed while the diagram sat
   buried underneath it.

The check that finally worked samples each layout **twice** and
compares. An oscillating layout differs between frames, and one sample
cannot distinguish "correct" from "correct this frame".

### The reference sizes are standards, not impressions

| object | ⌀ | source |
|---|---|---|
| movement plate | 32.2 mm | §39's asserted prediction |
| US quarter | 24.26 mm | US Mint spec |
| 1 euro | 23.25 mm | ECB spec |
| AA cell | 14.50 mm | IEC R6 |

The backlog suggested "a fingertip". A fingertip has no defined size and
would have quietly reintroduced the very thing §39 spent its whole entry
avoiding — a number chosen because it looked right. Dropped for that
reason.

### Graduated axes

The axes legend was a caption; once `UNIT_MM` existed the arms could
carry a real rule instead. Ticks every **1 mm**, long every **5 mm**,
over an 18.5 mm arm — 18 per axis.

Graduations are in **millimetres, not units**. Units are this model's
internal bookkeeping; millimetres are the thing a viewer can judge, and
putting units on a ruler would have made it readable only by someone who
already knew the scale.

Each tick is a small **cross** — two segments perpendicular to the arm,
not one. A single flat tick disappears edge-on, which for an instrument
meant to be read while orbiting is the whole failure.

### The stats line

`⌀32.2 × 9.7 mm · 18,000 A/h · 30 h reserve` — every figure derived,
none typed. Diameter and depth are §39's asserted predictions; the beat
comes from `F_BALANCE` (A/h = Hz × 7200, two beats per cycle); the
reserve from `RELAX_SECONDS`.

### Verification

Across a 30× zoom range (camera 40 → 1200 units), the ladder steps
1 → 2 → 5 → 10 → 20 mm, the bar stays 74–115 px, and it agrees with an
**independently projected** plate width to within **0.02%** at every
level.

The tick placement was verified separately: 18 ticks per axis at exactly
1–18 mm, identical on all three, the last inside the 18.51 mm arm.
Residual error is ~1e-6 mm, which is `Float32BufferAttribute` storage
rounding rather than placement.

**Two traps worth recording**, both instances of the same thing — a
check that looks for less than the thing it verifies.

The first tick check filtered for vertices with `y ≈ 0 AND z ≈ 0` to
find points on the X axis. But a tick CROSS offsets its vertices in
exactly those two directions, so the filter matched nothing and
`.every()` returned `true` over an empty array. It reported success
while measuring no ticks at all. The fix was to test segment MIDPOINTS,
which do lie on the axis.

The second: the first bar check compared the bar against the
plate's width along *world X* and reported a 28% error. The bar was
right; the check was wrong — the camera was angled, so world X is
foreshortened while the bar measures screen-right. Re-run face-on, where
world X *is* screen-right, agreement was 99.94%. A verification that
measures a different quantity than the instrument does will disagree
with a correct instrument, and it is worth being sure which one is
wrong before "fixing" anything.

## §36 job A — Declared travels: what sampling cannot recover, the build already knows

The registry bounds a part by sampling its poses, which cannot work for
an oscillator. **A part that swings out and back between two samples
sweeps further than the interval between them**, and no sample count
fixes it. Part one therefore bounded any reversing series by the FULL
CIRCLE — sound, and for a pallet fork that banks 6.42° total, absurd.

### The declaration surface

`declareTravel(unit, radians, why)` in `main.js`, called **at the site
each constant is derived**:

| unit | travel | from |
|---|---|---|
| Pallet fork | 6.42° | `2 × (FORK_BANK_DEG + FORK_RECOIL_DEG)` |
| Balance | 90° | `2 × AMPLITUDE_VISUAL_DEG` |
| Hairspring | 90° | rides the balance arbor |
| Reset hammer | 35.39° | `HAMMER_SWING_RAD` |
| Alarm hammer | 30.94° | `2 × ALARM_DRAW_RAD` |

Declaring at the derivation site is the whole point. §10 shipped with
four units missing from a parallel group table and §16 had a wheel
radius derived twice; a second table is a second thing to forget.

`AMPLITUDE_VISUAL_DEG`, not `AMPLITUDE_TRUE_DEG` — the registry must
bound the mesh that is actually **animated**, and the true 270° swing is
a physical reference the meshes never perform.

### Why declaring is safe to attempt

The containment assert already validates every volume against a finer,
phase-shifted sweep. A travel declared too small makes the part escape
its own hull and the volume is widened back. The declaration is a
**claim, not a licence** — which is what makes it worth trying at all.

Measured: **0 declared volumes escape**, all 37 escapes are `approx`
kind and none on a declared unit.

### The dilation, and why it is deliberately loose

Each sampled arc is widened by the WHOLE declared travel **in each
direction**. Looser than necessary, but sound without assuming anything
about where the samples fell: every true and every sampled position lie
in one interval of width `travel`, so they differ by at most `travel`.
For the pallet fork that is 6.42° against 360°.

### Results — same page load, declarations off then on

| | before | after |
|---|---|---|
| `full:oscillates` | 78 | **15** |
| `full:spoke` | 45 | **26** |
| `partial:declared` | 0 | **29** |
| full-circle volumes, total | 198 | **170** |
| static-vs-swept violations | 5 | 5 |
| positive control | 19 | 19 |

Mean coverage of the declared volumes: pallet fork **0.331**, reset
hammer **0.324**, alarm hammer **0.563**, balance **0.774**.

`full:covered` and `full:annular` *rose* (40→75, 35→54). That is
relabelling, not loosening: those volumes were previously stamped
`spoke` before the later tests ran, and dilation now fills some circles
outright.

### The bug in the first version

Declarations were consulted only on direction reversal. But the **spoke**
rule fires first, and it exists for the same reason — motion between
samples the samples cannot see — so the balance, hairspring and reset
hammer were promoted to full revolves as `spoke` and never consulted
their declarations at all. Only the pallet fork and alarm hammer got
arcs. A declared travel answers both rules; it is a property of the
part, not of which test noticed it moving. Fixing that took declared
volumes from 9 to 29.

### What job A did NOT do

**The violation count did not move: 5 before, 5 after.** The entry's
success measure ("9 → 0") conflates jobs A and B, and the remaining
violations are all job B's class:

```
Maintaining detent ⇄ Reset rod      Fork cock ⇄ Reset rod
Reset rod ⇄ pillars                 Balance cock ⇄ Reset rod
Keyless works ⇄ Minute jumper
```

Four are `Reset rod`, which TRANSLATES and SWINGS — no single rotation
about any fitted axis bounds it, and **a declared arc cannot help**.
That is exactly what job B was split out to handle. Job A tightened 29
volumes and left the gate where it was; `sweptOverlap` still cannot join
the standing battery until job B lands.

Note also the baseline is **5**, not the 9 the entry records — that
number predates §35's rod work.

## §41 — Brand mark: WS monogram (replaces §27's ∞)

### §27's factoring held — the test this entry existed to run

§27's acceptance required the mark be "parameterised and CALLED, not
inlined, so a second part could reuse it". It was: `makeCrown` is the
only call site, passes `{ r, tubeR, material }`, and reads none of the
returned `userData`. So this is a **body swap with zero call-site
edits**, and both crowns (winding `bodyR` 5.425, alarm 4.0) follow
automatically. `aspect` and the tube-tessellation arguments are gone —
they described a lemniscate and nothing passed them.

**§27 has no `docs/BUILT.md` entry.** The entry says to read one first;
it does not exist — only a passing mention at the crown-tube relief
convention. The design had to be recovered from `makeCrown`'s source.

### Stroke width and relief, derived

`makeCrown` budgets exactly `tubeR` of proud height, so relief is fixed
by the caller and the only free choice is stroke WIDTH. Take it from the
shape the ∞ already proved inside the envelope — a round tube of radius
`tubeR`, i.e. **2·tubeR wide standing tubeR proud**:

> stroke width = 2 × proud height

Below that ratio the relief is a knife edge: at engraving scale a stroke
narrower than twice its relief reads as a scratch, not a mark.

**The S's counter is held at one full stroke width**, asserted at build.
Below it the two arcs read as a filled blob, which is the specific way a
monogram fails at crown size.

### Fit

The call site's budget was sized for the ∞ — a wide, flat curve using
almost none of the vertical box. Two upright letters use all of it, so
filling the same budget crowded the rim. Both glyphs are drawn inside a
box scaled by `FIT = 0.72`, with **`r` and `tubeR` scaled together** so
stroke width stays 2 × proud and the counter-to-stroke ratio the assert
tests is scale-invariant — a smaller mark cannot quietly become an
illegible one. Half-width 3.725 against a 4.614 budget; proud 0.332
against 0.461. Standing under the caller's ceiling is safe.

At `UNIT_MM = 0.375`: strokes **0.249 mm** wide standing **0.125 mm**
proud on the winding crown. Engraving scale, and among the thinnest
detail on the part exactly as §41 predicted — §40's census is the check
on whether that is too fine.

### Three bugs, all mine, all caught by looking

1. **The counter assert fired on both crowns** (0.776 against a 0.922
   stroke). Cause: `H` took the ∞'s *centreline* height when its ink
   stood one tube radius proud of that top and bottom, so the S got
   0.92 units less room than the mark being replaced. Match the ink, not
   the spine.
2. **The S was two disconnected arcs.** With centres 2·sR apart the
   upper circle's bottom and the lower's top are the same point, but my
   arcs started at unrelated angles and ended 1.36·sR apart — on screen
   a 3, not an S. Each arc must start at the tangent join.
3. **The W was written as one closed outline** offsetting the inner
   return in x only. That is not a constant-width stroke on a slanted
   limb — the offset must run along the segment normal — so the polygon
   self-intersected into slivers. Rebuilt as four separately stroked
   quads. Their winding flips with limb direction, which inverted half
   the faces; `absarc` always emits CCW, which is why the S was
   unaffected and it looked like a W-only bug. Winding is now forced CCW
   by signed area.

### Accepted, and open

**The crown rotates and WS is not symmetric**, so it sits upside down
for half of every turn. Accepted per §41 — real crowns carry brand marks
and they spin. §27's ∞ read the same either way; this trades that for
brand specificity, deliberately.

**The W reads softly, and that is ACCEPTED — owner's call.** The S is
crisp; the W is legible as a zigzag rather than sharply cut. At 0.125 mm
relief on near-white metal there is little shading contrast to carry it,
and the available fixes were §41's own prescription (fewer, heavier
strokes) or more relief via a raised caller budget. Neither was taken:
the letters do not need to be crisp. A monogram machined into a steel
crown at engraving scale IS soft in real light, so the soft read is
closer to the thing than a sharp one would be.

Recorded so nobody files it as a defect later, and so the next person
does not "fix" it — the same reason §41 wrote down the upside-down
rotation in advance.

Triangles 376 against the ∞'s 320. §41 asked for "no worse"; this is
+17.5%, one draw call either way (the glyph shapes are merged into a
single mesh). Stated rather than hidden.

## §43 part one — The alarm pusher, sized in millimetres

### Measured first, because the premise was a suspicion

§43 required the current size be reported before anything changed — §38
is the cautionary tale, having been scoped on a premise that measurement
showed did not exist. Here the premise **held, and not marginally**:

| | units | mm |
|---|---|---|
| head radius, before | 0.85 | **0.319** |
| head radius, after | 2.667 | **1.000** |

A 0.64 mm head is nearer a pinhead than a pusher — a third of the
ergonomic floor, not a near miss.

### The floor is derived, not chosen

Real watch pushers run 2–3 mm across the head; below about 2 mm a
fingertip cannot locate and press one without a tool. That is the
constraint, and the **small end** is taken deliberately — a minimum to
clear, not a target to hit:

```js
const PUSHER_HEAD_MM = 1.0;                     // RADIUS floor ⇒ a 2 mm head
const PUSHER_HEAD_R  = PUSHER_HEAD_MM / UNIT_MM; // 2.667 u at 0.375 mm/u
```

Converted through §39's `UNIT_MM` rather than written as `2.667`, so the
ergonomic claim stays legible and survives a change of scale. A build
assert fails if the head ever drops back under 1 mm.

### The head grew; the mechanism did not

The stem's throw is what indexes the column wheel one castellation per
press — mechanism, derived from the wheel's index angle and the beak.
Scaling the pusher uniformly would have changed the indexing and broken
the toggle, so only the cap's radius, depth and its own offset along the
push axis moved. Head depth follows width (`0.62 × R`) so it still reads
as a turned cap; at the old 1.1 u against a 5.3 u face it would have
been a wafer.

**Verified unchanged, by measurement rather than by argument**: each
press advances the column wheel by exactly **−30°**, identical in
magnitude and direction across two presses — half of the 60° pitch, as
the source's "one actuation = one pusher press = half a pitch" requires.
The lock beak toggles ±16.043°.

### Clearance

Focused battery over `Alarm switch`, `Alarm lock`, `Dial`, `Alarm link`
across all eight axes: support 0 failures, graph clean, penetration OK
(both pairs 0 against a 0.12 budget), clearances **0 violations**. Boot
silent.

The head now stands **2.22 mm proud of the plate rim**. There is nothing
out there to hit — it is outside the plate entirely — but "how far it
protrudes" still has no reference, because §3's case band does not
exist. That number is recorded here so it can be checked against a bezel
when there is one, rather than discovered then.

### Not done — part two

The pusher is sized to be pressed and still cannot be pressed: the alarm
toggles from the panel, and `alarmColumnHitTest` already routes clicks
on the switch unit through the same `setAlarm` path, so the remaining
work is the pointer affordance rather than a second code path. §43 filed
this as separable and it stays that way; §19's findings on whether
viewers discover the crown's 3D drag at all should inform it.

### Also here — the alarm crown matched to the winding crown

`bodyR` 4.0 → **5.425**, matching the winding crown. Height stays 3.4:
matching that too would push the knob along the alarm stem, and the
stem's length and bushing are solved elsewhere, so it is a placement
change rather than a size match.

The old comment justified the smaller crown mechanically — "this stem
drives only the light alarm disc, so it needs no winding leverage". That
is true and was not the deciding argument: leverage sets the MINIMUM a
crown may be, not the size it must be, and the two crowns share a view
where a 26% difference reads as an inconsistency rather than as a
statement about torque. Owner's call; the comment now says so instead of
asserting a rationale the geometry no longer follows.

**A warning that was not what it looked like.** The first load after this
change reported `§38/TODO 8: the alarm's coincidence was crossed in ONE
tick`. Reverting appeared to clear it — one sample each, and wrong: the
change was reinstated and boot was silent again. The warning is the
tick-advance condition firing from restored sim state, which persists
across reloads via the dev server, and a crown's diameter cannot reach
it. An A/B across two page loads is not an A/B when the state carries
over.

Boot silent. **Battery-verified after the fact** (the run at merge time
did not complete — a re-run with the documented automation setting,
`yieldEvery: 64`, finished the same unit list in 237 s; the earlier
"non-termination" was the yield-throttling trap, not the workload):
support 0 failures including the new `Alarm crown → plate` edge at
0.35, graph clean, penetration all OK, clearances 0 violations, and the
full `inspection { includeExcluded: true }` scan — the check that walks
arbitrary pairs rather than declared budgets — reports **70 contacts,
all EXPECTED, 0 FORBIDDEN**. The enlarged crown touches exactly its own
setting arbor and the alarm winding train, at every one of ~750 poses
across all eight axes.

## §40 — Stock census: the thinnest feature on every part, in millimetres

### What it is, and pointedly is not

`stockCensus(clock)` returns one ranked, thinnest-first list — every
part's thinnest dimension in mm. **It reports; it does not gate.** No
minimum, nothing fails, no part is called illegal. A thickness gate on a
movement this developed would arrive with violations and be switched
off (§36 part two arrived with 17), and a floor would take a side in the
live thinning-for-z argument that §2 owns. The report hands the numbers
to whoever is making that call.

The measure is **`min(axial extent, radial extent)`** — the thinnest way
through the part. Kind-agnostic by construction: a rod has a small
radial extent, a wheel a small axial one, and the minimum picks the
right dimension for each without a classifier to be confidently wrong.

Sourced from §36's registry, not a second scan, so the census and the
overlap check cannot disagree about a part. Each row states its ruler:

- `revolve` — faithful: `rBand`/`zBand` are real vertex extents.
- `static` — the mesh's own exact bbox (a part that never moves has one;
  the *better* ruler, not a fallback).
- `approx` — **not measured**, listed with the reason: that box spans
  every pose, so its extents are motion, not stock.

Header states: pivots are **bodies only** unless modelled as separate
meshes; every *part* is named while unnamed meshes are identified by
unit + dimensions; nothing here can fail the battery.

### What it took to make honest — four failures, in order

1. **Not reproducible** — 468 rows, then 475, same page. The registry
   depended on session state and on rAF frames racing the sweep's
   yields; fixed upstream (canonical state + the sweep hold), and that
   fix retroactively explains §36 job A's "noise". Now two consecutive
   runs are identical, 416 = 416.
2. **Zero-thickness rows ranked first.** A cylinder wall has every
   vertex at one radius, so its r-band width is 0 — an open surface in
   the mesh, not thin stock. Ranking "0.0000 mm" first presents a
   modelling artefact as the thinnest part in the movement. Moved to
   not-measured with the reason.
3. **Double counting.** Units nest, so `Alarm disc / alarmIndexLine`
   also appeared as `Dial / alarmIndexLine` (TODO 10's attribution
   overlap, inherited). Deduped by mesh **object**, attributed to the
   nearest-ancestor unit — walked, not assumed.
4. **Unnamed meshes.** The part level is fully named (46 parts); mesh
   naming is a model campaign, not a census change, and the header says
   which identification a row carries.

### The report (current main)

416 rows, 46 parts, 34 not measured. Thinnest per part:

| mm | part |
|---|---|
| **0.0075** | Alarm disc (`alarmIndexLine`) |
| **0.0150** | Alarm release feeler (`alarmFeelerSpring`) |
| 0.0375 | Alarm selector |
| 0.0375 | Alarm setting wheel |
| 0.0450 | Alarm setting idler |
| 0.0487 | Alarm barrel |

Set against real going-train wheels at roughly 0.10–0.15 mm, the thin
end is exactly where the entry predicted: the alarm work, thinned to buy
z. The two extremes deserve a word: the 0.0075 mm `alarmIndexLine` is a
printed index modelled as relief — geometry, faithfully reported, though
arguably marking rather than stock — and the feeler spring at 0.0150 mm
is a real blade at a fifth of the thinnest plausible spring steel. The
census does not judge either; that is the job it was scoped not to do.

§41's monogram strokes (0.249 mm) sit comfortably above all of this,
answering the question that entry deferred here.

### Addendum — the path-aware ruler

Once §36's sleeves closed `approx` to zero, the census's `else` branch
was measuring 148 `path` movers from a **world AABB at the reset pose**
— and a world box mixes axes under rotation: a rod posed at 45° reports
both x and y at ~(L+d)/√2, neither a dimension the part *has*.

Static and path parts now measure in the mesh's **geometry-local** box
(world scale applied per axis), which is pose-independent by
construction — verified on the §35 alarm rod: extents `[0.6, 15.819,
0.6]`, exactly 2×r, at any pose. The stated shared limit remains:
geometry with rotation **baked into its vertices** (dial markers at
azimuth, the monogram's stroked quads) still mixes axes locally, and
such rows *under*-report thinness rather than over-reporting it.

The sharper ruler moved the report: 446 rows (was 416), not-measured
34 → **4** (the zero-thickness open surfaces), and newly visible path
movers surfaced thinner features than the old list knew —
`alarmSelFingerB` at **0.0187 mm**, an Alarm switch blade at
**0.0262 mm**, the Alarm link joining the per-part table at 0.0450 mm.


## §36 job B — Path hulls, and the confirmation tier that made the gate honest

### The blocker that never existed

Job B shipped its WIP note claiming `checkSweptOverlap` "no longer
terminates — ~3 min before, past 15 after" and concluded performance was
part of the definition of done. **All of that was false.** The check was
crashing in the first minute — a path volume reaching the validation's
revolve arm and throwing on `vol.axis[0]` — and the launching promise
had no `.catch`, so the done-flag never flipped and a silent crash read
as an endless run. With the dispatch fixed (PR #45) the full check runs
in **5.5 s**, and with confirmation **61 s**. Two lessons already in
this repo's pattern language, compounded: an `else` arm that assumes one
kind inherits every kind added later, and an instrument that cannot
distinguish "crashed" from "running" reports whichever you fear less.

### What the first complete run showed

37,347 pairs tested; 11 hull violations — the 5 the entry inherited plus
6 new `via: path`. Pose-refined measurement (`measureClearance`, BVH
with refinement near minima) refuted **all eleven**: the four Reset rod
rows clear by **0.9–15.6 units** (a full-circle hull of an undeclared
spoke mover claims a disc the part never fills), and the sleeves' box
conservatism — a round rod squared off gains `(√2−1)·r` at the corners —
accounts for the rest. The tightest, `Alarm link ⇄ Three-quarter plate`
at 0.1496, is the §35 rod in its own bore: **designed** at exactly
`CLEAR_MARGIN`, measuring a tessellation hair under.

### The confirmation tier

A hull overlap is a *possible* collision. The check now says so with
three tiers, each row carrying its refined gap and pose:

- **confirmed** — refined gap ≤ 0: real contact. *The* gate number.
- **tight** — inside the one margin: no contact, reported for humans.
- **refuted** — the hull over-claims; hull depth and refined gap both
  recorded so the claim is checkable.

Pose refinement is still sampling (TODO 7) — it cannot *bound* motion —
so a refuted row keeps the hull's side of the story rather than being
deleted: the hull says "possible", the refinement says "not at any
refined pose", and both statements stand.

**Verified in both directions.** Sound run: 0 confirmed, 1 tight, 10
refuted. Positive control: with exclusions off the raw hull test fires
at 35, and a known-touching pair (`Fusee & great wheel ⇄ Maintaining
detent` — the detent riding the ratchet) **confirms at gap 0**, so the
tier that clears false positives demonstrably does not clear real
contact.

### The gate

`sweptOverlap` joins standing rule 4: **0 CONFIRMED**, with `tight` and
`refuted` as reports. This is the entry's stated finish line — "only
then can sweptOverlap join the standing battery" — reached at 5 → 11 →
**0**, with the middle number being the honest one the first "5" never
was.

### The sleeve fix — surgical, after the blanket version failed

The 42 demotions came from inter-sample bulge: a pair-union box holds
both endpoint poses, but a vertex on an ARC between them exits the
chord's box by the sagitta, which is where the finer phase-shifted sweep
landed. Two designs were built; the first was wrong in an instructive
way:

- **Blanket dilation** (every box, 0.25× its inter-sample chord) closed
  42 → 2 — and wrecked the economics. Fast movers have multi-unit
  chords, so every sleeve grew by up to a unit, raw hull hits
  multiplied, and the confirm tier ground past 20 minutes, wedging the
  tab. Sound geometry, catastrophic cost model.
- **Surgical widening** follows the check's own precedent for revolves:
  the volume that escapes is the one that grows. An escaping sleeve is
  dilated by its **own measured overshoot** (max distance of any
  escaping vertex outside the sleeve, over the whole fine sweep),
  doubled for headroom; the ~108 sleeves that already hold stay exactly
  as tight as before. The dilation is derived from the sweep that
  validates it — partly self-fulfilling, said so in the comment — so a
  second pass re-checks widened sleeves and demotes what still fails.

Result: **0 demotions, 0 `approx` volumes, `approxUnitsExcluded` empty**
— for the first time, nothing in the movement is invisible to the
overlap check. 40 sleeves widened by 0.005–0.92 units; gate unchanged at
**0 confirmed / 1 tight / 11 refuted** (one new raw hit from the
widened sleeves, refuted with its numbers). Registry 5.8 s.

### Still open, recorded

- Part three (routing as a spec) still needs §33; `LOW_LINKAGE_OBSTACLES`
  is still not subsumed.
- The census's `else` branch now measures `path` parts from a world
  bbox at the reset pose — adequate for extents, sloppy for a rotated
  part, and worth a `path`-aware ruler now that `approx` is empty.

## §36 follow-up — the low-corridor table, verified instead of trusted

`LOW_LINKAGE_OBSTACLES` is the manual 2D prototype of the swept-volume
idea: circles and stadium segments covering the low linkage's whole
crown-stroke footprint, consumed by the balance-cock and pillar seat
scans. §36 planned for the registry to subsume it.

**It cannot, structurally.** The table is consumed MID-BUILD — the seat
scans run while `main.js` is still evaluating — and the registry is an
async pose sweep over geometry that must already exist. No machinery
moves the sweep before the thing it sweeps. So the subsumption is §42's
pattern instead: the hand-written table stays the build-time input, and
**`checkLowCorridor`** (in the battery as `lowCorridor`) verifies it —
every axis swept under the sweep hold, the linkage units' world vertices
sampled, those inside the corridor's z-band (0.15–1.9, hoisted from the
pillar consumer's comment into a shared constant) required to lie inside
some table obstacle. An escape means the table under-covers and a seat
scan could place a leg inside the real swept path.

### The first run caught eighteen months of nobody noticing

`Reset hammer` escaping by **3.35 units** at crown f = 1, in-band, at
(−0.7, −17.8). The table covered only the hammer's **tail** segment; the
head-side arm — which swings across the movement as the crown pulls —
was never in it. And the pillar scan's under-plate box list does not
include the hammer either, so nothing prevented a pillar seat inside the
head's sweep. The check's first output was precisely the class of rot it
was built to catch.

Fixed in the **table**, not the check: per stroke sample, the hammer's
rotation is recovered from the already-solved tail tip (the same
inversion `solveHammerRotation` uses), and the head arm is covered by a
stadium at the lever's own half-width — read from the lever's exported
outline plus bevel, so the cover cannot drift from the mesh — with the
roller's radius added at the tip. Table 104 → 130 entries.

### Verification

- `lowCorridor`: **ok — 0 escapes** over 130,800 in-band vertices at 200
  poses across all eight axes.
- Boot silent — the seat solvers re-solved around the enlarged footprint
  and still found clean placements.
- Focused battery over the re-seated neighbourhood (`Reset hammer`,
  `Stop lever`, `Balance cock`, `Fork cock`, `pillars`, `Three-quarter
  plate`): support 0 failures, graph clean, penetration OK, clearances
  0 violations.

§36's remainder is now part three alone (needs §33).

## §49 — One measurement overlay, with the scale standing in the scene

### The merge

The axes display and the size comparison were separate overlays making
separate assertions of the same measurement — a stats line saying
"32.2 mm" and an axes legend spanning the plate, with nothing forcing
them to agree. Both now ride **one toggle** ("Measure") and read **one
derived set**: `scaleReadout`, extended to carry the raw unit extents
(`plateRUnits`, `zMinUnits`, `zMaxUnits`) alongside the mm figures the
stats line uses. Two displays of one measurement cannot drift when there
is only one display. §49 names this as the §40 argument — read from one
source, never scan twice — applied to what the viewer is shown.

Retired in the merge: the 2D corner bar. The in-scene scale is the live
ruler now, honest at every angle by construction, where the bar had to
re-derive itself per frame. The coin diagram stays — it is a comparison,
not a ruler.

### The scale, in the scene — §49's design decision, followed

A screen-space ruler must recompute its tick spacing every frame under
orbit to stay truthful, and any frame where that lags is a frame where
it lies. So the scale is ordinary 3D geometry: an **L-square** standing
east of the movement — a vertical leg reading Y extents, a foot along
world Z reading the assembly's depth — ticked every 1 mm, long every
5, the same graduation the axes carry. The renderer's projection does
the perspective work; the foot's ticks visibly converge because they
are really receding.

**Leader lines, both ends derived:** plate rim (±`plateRUnits`) to the
vertical leg, assembly faces (`zMinUnits`/`zMaxUnits`) to the foot.
Leaders land ON the spine at the measured height, read against the
adjacent ticks the way a drawing's dimension line is. Nothing is
hand-placed; a leader to a hand-placed tick would be a diagram of a
measurement.

**The slide** moves the square along its standing offset
(`plateR·1.25 … 2.25`). Tick Y/Z coordinates never change, so sliding
cannot make the scale read differently — only stand nearer or farther,
which is the depth cue arriving as a side effect of real geometry.

### Battery

The ruler is added to the scene and never registered as a unit; the
inspector walks `labelEntries`, so it is structurally invisible to every
sweep — a ruler reporting clearance violations against the plate would
be this entry's own reductio. Boot silent.

### The §10 tie-in (follow-up, shipped)

With a unit or group selected, the overlay measures the SELECTION: its
Y-span read on the vertical leg, its Z-span on the foot, via doglegged
leaders — the drafting convention for an offset feature — landing on
the spines at the measured heights. The stats line follows the same box
(`Balance: ≈9.53 mm tall · ≈3.75 mm deep · …`), so text and lines
cannot disagree. `All` restores the movement set.

Two judgment calls worth their record:

- **The leaders are live.** A selected mover's box is recomputed per
  frame, so the balance's Y-span leader breathes with its swing —
  verified moving between frames. That is honesty, not jitter: the
  extent really oscillates, and a frozen leader would be the snapshot
  pretending to be the fact. The stats line stays a snapshot and says
  `≈` for exactly that reason.
- **Explode hides the selection leaders** and falls back to the
  whole-movement set (verified: 8 segments → 4 on explode). §49's §32
  rule applied early: a ruler that measures a diagram of the watch is
  measuring nothing, and the whole-movement anchors are built constants
  immune by construction.

## §23 — Advanced controls, generated from the schema

### The shape the entry asked for

An **Advanced** disclosure inside the Finish section (on §15's own
mechanism, collapsed — the panel a first-time viewer sees is unchanged),
whose body is **generated by walking `aesthetics.json`**: numbers get a
slider spanning a heuristic range about the shipped value, hex colours a
colour input, booleans a checkbox; `_`-prefixed keys are prose and
skipped. 61 controls today, and a future schema entry gets its knob for
free — no hand-written row per parameter, the file stays the single
source.

Two schema entries were **added** rather than wired ad hoc, per the
entry's instruction: `materials.ruby.color` (every jewel retints live
through `MATS.ruby`) and `dial.subdials.radiusFactor` (a factor over the
SOLVED shared radius, so the solve stays the source and the knob is
taste on top).

### The owner's headline knob: rib count

The Glashütte stripes on the 3/4 plate and escape bridge are world-space
bands at `decoration.ribbing.widthUnits` pitch, shared by both parts in
one material — so **one first-class "Rib pitch" slider** beside Hand
flute thins the count everywhere at once. Making it live required a real
change: the ribbing and perlage uniforms were captured constants inside
`onBeforeCompile`; the compiled shader is now stashed on the material
and `applyDecorationFromAesthetics()` rewrites the uniforms in place.
Verified: 6.7 → 15 read back from the compiled shader.

### Live where live exists, honest where it does not

Each edit writes the schema value, then the best-known applier for its
subtree runs: lighting → the light objects, rendering → exposure,
camera → damping, decoration → the shader uniforms, materials → ruby,
`dial.hands.*` → the flute slider's re-cut mechanism (hoisted to
`recutHands()`). Subtrees with no live consumer — marker geometry,
subdial size — are **labelled ⟳ "applies on reload"** rather than
silently doing nothing.

And a reload knob is only honest if the value survives the reload it
asks for: tuned values persist as browser-local overrides, merged over
the file at load (guarded so corrupt state cannot brick boot), with
**Reset** clearing them and **Copy JSON** turning a tuning session into
a commit. This deliberately amends Finish's old "nothing here is
persisted" convention; the file remains the source of record.

### The battery net, demonstrated

The subdial radius solves to exactly the §25 C ceiling, so **growing it
must warn**: at factor 1.15 the well-ring boot asserts fire
(`clearance −1.33, need 0.15`, three sites), and at 0.9 boot is silent.
The knob is free to move; the constraint stays asserted; an oversized
taste choice is loud instead of a silent collision — the standing-rules
division of labour working exactly as designed.

### Safety bounds (follow-up, same PR)

Three dangers, three mechanisms, because they are different problems:

- **Declared bounds in the schema**, beside the values they bound with
  the constraint in the comment (rule 1 for bounds): the subdial factor
  caps at 1.0 *because the solved radius sits on the §25 C ceiling —
  measured, 1.15 penetrates by 1.33* — and floors at 0.5 where the wells
  would swallow their own hands; rib and perlage pitch bound [2, 30].
  Declared only where a hard constraint is KNOWN — a 61-row bounds table
  would rot, and the generic floors cover the rest.
- **Generic floors in the generator**: a range never crosses zero — a
  positive width, pitch or intensity gone negative is geometric
  nonsense, and a divisor at exactly 0 is a NaN in a shader — so
  positives floor at one step ("visually off" is reachable, true zero is
  reserved to the file), negatives cap symmetrically, everything finite
  by construction. The first-class rib slider reads the same schema
  bounds, one table.
- **Crash recovery for persisted overrides** — the danger bounds cannot
  reach: a build-breaking value would crash every boot with the reset
  panel never appearing. The merge arms a pending marker; the completed
  build confirms it; a load that finds it still armed knows the previous
  boot died mid-build and drops the overrides, warning. Value-agnostic —
  it does not need to know which value was lethal, only that one was.
  Drill verified: marker armed by hand → next load boots from the file.

The override merge is also **type-anchored** — the file's value defines
each leaf's type, and a mismatched override is refused rather than
coerced. Found the hard way: a planted `NaN` serialised to JSON `null`,
which is not `typeof 'number'`, sailed past the finite check and wrote
`null` into the exposure — the exact smuggling the merge exists to stop.
Verified: null and string refused, in-bounds number accepted, stale
over-limit values clamped on merge (1.6 → 1.0, 0.001 → 2).

Defaults unchanged → geometry unchanged at boot → the battery's standing
results carry. An owner who commits NEW values into `aesthetics.json`
inherits the usual obligation: full battery clean at boot, and the hands
re-checked against the dial furniture if the hand factors moved.

## §50 part one — The stock floor: declared, cited, and gating only where unarguable

### The 7.5-micron part, identified first as the entry required

It is a **design, not a defect**: §34's `alarmIndexLine`, the
registration marking on the alarm tube's carrier flange — a blued bar
deliberately proud only 0.02 units (7.5 µm) into a declared margin
chain. Degenerate as *stock*; legitimate as *marking*, the analog of
printed dial indices, whose real ink films run 5–10 µm. So the floor
had to be per kind before it could be a floor at all.

### The declaration surface

`STOCK_FLOORS` — every floor cited, none invented (rule 1 for floors):

| kind | mm | basis |
|---|---|---|
| wheel *(default)* | 0.12 | the entry's figure; thin end of §40's measured 0.10–0.15 going-train band |
| pivot | 0.07 | real train pivots run 0.07–0.12 |
| spring | 0.03 | real hairsprings 0.02–0.04 |
| marking | 0.005 | printed/inlaid indices are a 5–10 µm film — relief, not stock |

plus `DEGENERATE_STOCK_MM = 0.01` — the unarguable tier: below it a
solid is broken geometry, not thin metal. Kinds are declared per part
with per-mesh overrides (`MECH_GRAPH`'s table discipline); anything
undeclared defaults to wheel **and is listed**, so the table's gaps are
visible rather than silent — 45 of 46 parts ride the default today.

### Report → triage → declare → gate, honoured

`checkStockFloor` (battery: `stockFloor`) **gates only the degenerate
tier** — and it is green from day one: `ok: true`, zero rows under
0.01 mm, with the index line passing as a declared marking rather than
by mercy. The horological tier **reports**: **108 violations across 26
parts**, published for triage per the entry:

- **The alarm work dominates**, as §40 predicted: alarm disc ×15,
  feeler ×12, selector ×11, link ×11, switch ×6 — worst rows 0.015 mm
  (the feeler spring, against its own *spring* floor of 0.03) and
  0.0187 mm (the disc's selector fingers, against wheel's 0.12).
- **Going-train stragglers**: Escape wheel ×1, Balance ×1, Fusee ×2,
  Hour wheel ×1 — likely the 0.10–0.12 band the entry said "wants a
  ~20% thickening, not a redesign".
- Balance cock ×9 and Set-up work ×3 are the surprises worth a look in
  triage.

The gate for these arrives only after the owner's triage declares the
exceptions — §36 part two's precedent, followed.

## §50 part two — The triage, and the gate

All 108 horological violations dispositioned; none deleted. Three bins:

**Cleared legitimately by kind (2).** The maintaining spring (0.052 mm)
and the alarm pin spring (0.0525) are real flat springs — declared
`spring`, they clear the cited 0.03 floor on merit. Three alarm pins
were also honestly redeclared `pivot`, though two still sit under even
that floor and fall into the debt.

**TODO 11 — the alarm work, 76 rows.** Quarter-to-half-scale stock
(0.015–0.10 mm) across fourteen units, the feeler spring at half the
real-spring floor. Not a bulk scale-up: §29 bought the alarm's z
corridor *with thickness*, so thickening in place overflows the corridor
— the fix re-buys z, a design task.

**TODO 12 — the 0.05–0.12 band, 30 rows.** Correct horology at the thin
edge: the going-train stragglers, the minute jumper, small-seconds and
set-up furniture — and the balance cock's ×9, identified by probe before
disposition (the entry's own discipline): its **jewel assembly** (ruby
disc 0.0675 where real cap jewels run 0.3+, gold chaton ring 0.0525,
setting plates) and regulator furniture. A ~20–45% per-part thickening
toward each part's free side.

**A waiver is accepted debt, not a pass**: the row stays in the report
under `waived` with its TODO citation, and deleting the waiver is part
of closing the item. With every row dispositioned, the horological tier
flipped from report to gate per the entry's order: `stockFloor` now
passes only at **0 degenerate and 0 unwaived**, and joined standing
rule 4. Verified: `ok: true`, 106 waived (76 + 30), fresh boot silent.

## §51 phase A — The flange and the lane, funded from the plate gap

### Measured first, decided by number

Option 1 (slack inside the band) measured **~zero by construction** —
and the measuring taught the instrument lesson again: two occupancy
probes showed no free runs because the tube spine threads every z by
design, so a union can never show stratum gaps. §29's own chain is the
honest ruler, and it states each member sits at exactly the margin.
The one reservoir is the **plate-side end gap, 0.62** (§34's note),
0.47 spendable. Decision: spend **+0.38** of it on the centre chain's
two worst §50 debts.

### The edits — three constants, and the chain did the rest

- `ALARM_SET_T` 0.18 → `STOCK_MIN_U` (0.32) — §29 step 1's thinning,
  unwound. Hoisted into the chain block and the chain's own `0.18`
  literal replaced with the constant, so wheel and lane can never
  diverge again. One thickness clears **the setting wheel, both idlers
  and the arbor pinion** at once.
- `ALARM_FLANGE_T` 0.08 → `STOCK_MIN_U` — the census's thinnest
  structural sheet (**0.03 mm**) to floor stock.
- The cannon pinion grew a third time (2.5 → 2.9), following its own
  §29/§34 precedent as the chain's end deepened — and its end is now
  **derived and shared with the coverage assert**, so the third growth
  is the last one anybody hand-tracks.

Everything else followed by derivation: feeler, track, disc, minute
wheel planes, the star chain — the §29 top-down design absorbing +0.38
exactly as built. **One boot warning total** (the pinion coverage
tripwire, which is the system working), then silence.

### Verified, full bar

`stockFloor` ok with TODO 11 waived **67 → 62**; focused battery over
the nine affected units clean; full `inspection {includeExcluded}` **0
FORBIDDEN** (67 contact rows); `sweptOverlap` unchanged at 0 confirmed /
1 tight / 11 refuted; `Minute jumper ⇄ Dial` still exactly 0.15 — its
bind formula held through a 0.38 chain shift. Boot silent.

### What phase B still owes

The selector sheet, the disc's fingers and track, and the two
under-stock springs live outside this chain's funding — they need the
dial lowered (§51's option 2), with the §2 shared-budget position
already recorded in the entry.

## §51 phase B — The dial at −7.5, and the §35 corridor re-solved

### Step 1: the dial move measured its own blast radius

`Z_DIAL` −7 → −7.5, deliberately alone first. The result: **zero
tripwires** — boot silent, graph and pinion checks clean, the interface
battery green, `Minute jumper ⇄ Dial` riding at exactly 0.15 through
the move. The dial-relative architecture absorbed half a unit
wholesale. Assembly depth grows ≈0.19 mm, inside §39's envelope.

### The one coupling that crosses the frames — and the older sin it exposed

The §35 lay shaft (movement-frame) drives the selector tab
(dial-frame). Direct measurement found the crank jaw and tab
**separated by 0.04** after the move — invisible to every assert
because the tick poses the selector by law and TODO 5 blinds the
battery inside a unit. And the measurement exposed something older:
**the engagement had a 0.03 gap before the dial ever moved.** §35
closed the rod-end contact with great care; nobody ever measured this
end. The link has been transmitting through a gap at the ring since it
was built.

### The re-solve

- **The shaft is dial-relative now**: `Z_DIAL + 0.86`. Its partner is
  dial-frame, and so — measured — is the keyless piece its old absolute
  floor was solved against: the historic "top −6.549" was taken with
  the dial at −7 and the piece rode the move, so the floor constant is
  rewritten `Z_DIAL + 0.451` and the §35 tripwire (which fired
  correctly on the stale literal — the system working) now rides the
  dial with it. `Alarm link ⇄ Keyless works` measures **2.34 clear** at
  the new depth.
- **The inner jaw derives its length**: `0.45 + ALARM_SEL_TRAVEL +
  wrap` — it must cover the tab across the whole travel, which the
  historic 0.45 never did. The offset landed at 0.86 by measurement:
  at the historic 0.74 the rest side still gapped 0.06.
- **Both extremes now embrace**: armed overlap 0.06, disarmed 0.10 —
  the first time this engagement has had metal on metal in both
  states. The rod-end seat rode along by derivation, unchanged at 0.04.

### Verified

Boot silent; focused battery over link, selector, keyless, lock, switch
and plate clean (support 0, graph 0, penetration 0, clearances 0);
`stockFloor` still green with 73 waived; the §39 depth assert passes.
The strata spends — feeler, disc body, selector sheet, both springs —
are §51's remaining step, now with the band real and the link honest.

### §51 finale — the strata spends, with two honest reverts

**Landed:** the feeler slices (0.10 → floor), both hearts (0.30 →
floor), and the feeler spring at real spring stock — 0.03 mm, from the
0.015 that made it §40's first honesty nominee. The cannon pinion grew
a fourth time (→ 3.35), its derived end making that a one-line edit;
the §34 landing assert's plate face proved to be one more stale
dial-frame absolute and now rides `Z_DIAL`; and the §35 shaft's offset
collapsed into a real derivation — **shaft centre = the ring's
top-face world plane** (`Z_DIAL − ALARM_SEL_Z_UP`), the relationship
two hand-tuned offsets had been approximating.

**Reverted, with their numbers:** the disc body (collides with the
selector posts at 0.32 — 0.246 against the 0.12 working budget; the
§34 pass-2b corridors were solved for 0.13) and the selector sheet
(its two-sided finger slot cannot take 0.32 in any anchoring —
0.192–0.246, the excess just moving between finger sides). Root cause
for both: the §29 arm-band literals never rode the chain; re-deriving
them is the enabling step, catalogued in TODO 11.

**Verified:** boot silent; engagement embraced both ways (0.10/0.06);
penetration, clearances, support all clean; `stockFloor` green, TODO 11
waived 62 → 60 net. §51 closes with the band real, the link honest,
and the two blocked members carrying exact numbers for their own
sessions.

### §51 closed — the last two spends, landed on the derived band

With the arm-band family derived, the disc body and selector sheet took
the floor after all. The two keys were both **working-face rules**:

- The ring's anchor pins its **underside** — the face that presses the
  rocker — so the thicker sheet grows away from the solved contact,
  exactly the endstone precedent. `disc ⇄ selector` reads **0.062**
  against its 0.12 budget with the spend in.
- The §35 shaft rides the ring's **mid-plane**, not its top face: the
  top-face relationship was an artifact of the 0.10 sheet, and with
  real stock it pushed the shaft to 0.069 from the keyless floor — its
  own derived tripwire caught it — where centre-on-centre clears by
  0.229.

Final: boot silent, the link embraced 0.32/0.12 at the extremes, rod
foot 0.07, every check green, TODO 11 waived **60 → 53**. Of the 76
alarm rows the census condemned, every one now carries floor stock, an
honest kind, or a named bound — and the band that §29 bought with
thickness has bought it back.

## §52 — The battery as a CI gate

**Goal (as filed).** The inspector battery runs in this repo's CI, so a
change that breaks support, the graph, a penetration budget, a
clearance, the stock floor or the fingerprint fails before it merges —
instead of depending on whoever ships remembering to run it. Standing
rule 4 was enforced entirely by discipline, and discipline is the thing
CI exists to replace.

### The two measured risks, settled by measurement

The entry refused to scope itself until two numbers existed, and both
came in on the permissive side:

- **Runtime: ~13 min for the full bar** (measured 791 s on a 2025 dev
  container: boot 26 s, support 10 s, graph 1 s, penetration 17 s,
  stockFloor 33 s, inspection 83 s, clearances 368 s, sweptOverlap
  219 s, plus a second boot for determinism). That is per-PR-gate
  territory, so the tiered split and the nightly job the entry held in
  reserve were **not built** — the workflow carries a 45-minute budget
  (3× the measurement, for slower CI hardware on SwiftShader GL) and a
  comment naming the split as the fallback if the battery outgrows it.
- **Determinism: the fingerprint reproduces exactly.** Two *virgin*
  boots — fresh browser context, the dev server's `/__state` file
  deleted between them — hash identically on headless Chromium. That is
  the anchor the entry asked for, and it gates every run: the harness
  boots twice and fails if the hashes differ, so a §40-style
  session-state or rAF-race regression surfaces as its own named
  failure rather than as unexplained flakiness in the sweeps.

### What was built

**`tools/ci-battery.mjs`** — the battery as an exit code. It spawns
`dev_server.py` on a free port with a private `TMPDIR` (so `/__state`
starts absent and a developer's real saved state is never read or
clobbered), boots `index.html` in headless Chromium via Playwright, and
runs the checks **one at a time through `start()`/`status()`** — never
`startAll` — with `yieldEvery: 64` on the long sweeps, exactly the
regime CLAUDE.md's yield-throttling trap prescribes for automated
panes. Cheap synchronous checks run first so a broken graph fails in
seconds, sweeps last. Nine gates, most-severe payloads dumped on
failure:

1. boot silent (`__clock.bootWarns` empty — standing rule 6);
2. `support` 0 failures;
3. `graph` every violation list empty (declared `todo` edges allowed);
4. `penetration` every budget row OK;
5. `stockFloor` 0 degenerate and 0 unwaived (waived rows reported as
   the accepted debt they are);
6. `inspection { includeExcluded: true }` 0 FORBIDDEN;
7. `clearances` 0 violations;
8. `sweptOverlap` 0 CONFIRMED (`tight`/`refuted` reported, not failed);
9. fingerprint identical across the two virgin boots.

Two harness decisions worth recording. **The sweep hold is taken for
the whole run**: only `buildSweptRegistry`/`checkLowCorridor` hold it
themselves, so during the other sweeps the rAF loop would keep
painting — on CI's software GL those paints are pure overhead stolen
from the sweep, and no check needs a frame (`setPose` +
`updateMatrixWorld` is the whole measurement path). And Chromium is
launched with **background-timer throttling disabled**, so the sweeps'
cooperative `setTimeout(0)` yields cost microseconds instead of the
~1 s naps that make a default automated run read `running` forever.

**`.github/workflows/battery.yml`** — the gate itself, on every pull
request and on `main`. Playwright is pinned in `tools/package.json`
(which lives under `tools/`, not the repo root, so the app stays
dependency-free and the release payload — which excludes `tools/` —
never ships any of it); the browser download is cached keyed on the
lockfile pin; `python3` for the dev server is preinstalled on the
runner. Concurrency cancels a stale run when its branch moves — the
battery is long enough that queued duplicates would stack.

### What the plan got wrong, and one boundary restated

The entry worried the headless route might be blocked by §36's
non-terminating sweep or §40's fragility; both fixes held, and the only
genuine surprise was trivial: a virgin boot 404s `/__state` *by
design* (state.js falls back to defaults), so the harness's
"no console errors at boot" net has exactly that one exception carved
out.

The gate proves the movement is **legal, and the same twice** — it does
not widen what the battery can see. The two structural blind spots
(intra-unit collisions; second contacts inside an EXPECTED pair,
TODO.md items 5 and 6) pass through it unexamined, exactly as they pass
through a hand-run battery. CI moved the enforcement, not the
instrument.

## §43 part two — The pusher presses

### Measured first: most of "part two" was already done

The entry framed this as "a pusher sized to be pressed that cannot be
pressed." Measured before building, that was **largely false**:
`alarmColumnHitTest` already routed clicks through `setAlarm`, the
cursor already became a pointer over the control and cleared off it,
and §25 D's `alarmPusherT` pulse already drove a spring-back press.

**One real gap remained, and it is the whole change**: nothing moved
until the pointer was *released* — 0.000 on `pointerdown`, 0.626 on
click. The head moved as a consequence of the toggle rather than as
the act of pressing.

### The change

`alarmPusherHeld` pins the existing pulse at 1 while a pointer is down
on the control; release lets it fall into §25 D's decay. No second code
path — the entry's own constraint — and the **actuation deliberately
stays on `click`**, so dragging off still cancels, as any button does.

Released on `pointerup`, `pointercancel` **and** `pointerleave`, not
only the happy path: a pusher stuck in its pressed state would be a
worse lie than the late press this fixes. `resetInputs` clears it too,
so a held pointer cannot pose displaced geometry into a battery run.

### Verified

| behaviour | result |
|---|---|
| moves on pointer-down | **0.700** (was 0.000) |
| stays down while held (1 s) | 0.700 |
| springs back on release | 0.008 |
| click still actuates | ✓ toggled |
| drag-off cancels actuation, head still releases | ✓ |
| `resetInputs` clears a stuck hold | 0.000 |

Boot silent; focused battery over the switch neighbourhood clean
(support 0, graph 0, penetration 0, clearances 0); `stockFloor` green.
No geometry moved — this is input plumbing over an existing animation.

### Not done, and why

§43 cites §19's usability findings as the guide for whether a *visible*
affordance (beyond the cursor) is wanted. §19 has not shipped, so
inventing one here would be guessing at the answer it exists to
measure. The cursor affordance stands; the question stays §19's.

### §43 postscript — the pawl was driving the wheel backwards

Reported by eye ("the pusher is turning the column wheel the wrong
direction?"), and the measurement agreed. A pawl can only PUSH, so the
wheel must turn the way the pawl's contact point moves:

| | measured |
|---|---|
| pawl's tangential drive on press | **+0.619 → +z (CCW)** |
| wheel's actual index | **−30° → −z (CW)** |
| ratchet teeth, cut tip→root as angle rises | driven **−z (CW)** |

Two of the three agreed: the wheel and its own teeth. The **pusher's
pawl sat on the wrong side of the wheel centre**, so it would have had
to drag the wheel backwards.

**The fix is one sign, and the algebra says why.** With the pawl at
`chord·perp + 0.85·û` from the centre, the tangential component of its
inward press reduces to exactly the chord (the û·perp cross-term
vanishes):

> `sign(ALARM_PUSH_CHORD)` **is** the z-direction the pawl can drive.

So `makeColumnWheel` now exports `userData.ratchetDrive = -1` — which
way its teeth are cut — and the chord's sign derives from it rather
than agreeing by luck. A boot assert compares the two, which is cheap
precisely because the geometry collapses to one sign.

**Verified:** pawl drive −0.619 and index −30°, both CW, agreeing. The
pusher swung to the other side of the wheel and still clears everything
— support 0, graph 0, penetration none, clearances 0, full FORBIDDEN
scan 0 across 69 rows. Boot silent.

Worth noting what did *not* catch this: every check in the battery is
about **space** — what occupies where — and nothing was overlapping.
This was a *kinematic* lie in geometry that fit perfectly, the class
TODO 7 describes from a different angle. It took an eye on the render.

### §43 postscript, continued — indexing on the press stroke, and the saw

Two owner corrections, both mechanical rather than cosmetic.

**The wheel now indexes as the button goes IN.** The actuation moved
from `click` to `pointerdown`: a pawl drives the ratchet on the inward
stroke and slips back over the teeth on the return, so stepping on
release had the wheel driven by the one stroke that cannot drive it.
Measured across a press: **−4.6° → −23.3° → −28.2° → −29.9°**, reaching
−30° at release with **no further step on spring-back**.

This gives up the drag-off-to-cancel a screen button has, and that is
the honest trade — once a real pusher has travelled far enough to
index, sliding your finger sideways cannot undo the step.

**The saw is mirrored in y.** Measuring the tooth profile settled which
of the three parties was wrong: each tooth fell tip→root with rising
angle (r 2.352 → 1.89), so its cliff caught a pawl travelling +θ — the
teeth were cut to be driven CCW while the wheel indexes CW and the
pawl (fixed above) drives CW. **Two of three agreed and the teeth were
the odd one out**, which also means the `ratchetDrive = -1` exported in
the previous fix was aspirational; the flip makes it true.

**Honest limit on this one:** the flip is the owner's call plus the
analytic argument that mirroring y reverses a saw. My own profile probe
could not confirm it — the skirt is built at `curveSegments: 2`, so
there are about two vertices per tooth and the angular bucketing
collapses. Boot is silent and the indexing measures correctly, but the
tooth *sense* is verified by eye and by construction, not by
instrument.

### §43 postscript — why no force transfer read on screen

Reported by eye: "no obvious transfer of force from the columns to the
alarm link or the alarm switch." The followers were already reading the
wheel's real profile — `profileAt(alarmColShownA + BEAK_OFF)` — so the
mechanism was right. The problem was one line downstream:

```js
alarmSelShownT += (linkGapT - alarmSelShownT) * (1 - exp(-dt / 0.10));
```

The reading was then **eased a second time**, on top of the wheel's own
ease. A cam follower has no dynamics of its own — its position is a
pure function of the cam's angle, and the whole §35 chain (beak, rod,
cranks, ring) is rigid behind that one reading. The extra lag meant the
beak glided on its own schedule while the flank that drives it had
already passed underneath: motion that *correlated* with the wheel
instead of being *caused* by it. Rule 2's case in miniature.

**The fix is to delete the ease** and let the follower be the profile.
Measured every frame through a press, the follower now equals the cam
reading to **0.000000** error, and the trace shows the transfer:

| wheel | 34.6° | 49.0° | 55.2° | 57.9° |
|---|---|---|---|---|
| follower | 1.000 | 0.633 | 0.055 | 0.000 |

The beak falls *as the flank passes*, and every member behind it moves
because the wheel moved. Boot silent; focused battery over the switch,
link, selector and lock clean (support 0, graph 0, penetration none,
clearances 0). No geometry changed — this is a coupling fix.

### §43 postscript — the click's return spring was not grounded

Reported by eye: the click and the parts around the column wheel looked
wrong. Measuring all four followers against the wheel cleared three of
them — the click's nose rides tangent on the column face (centre 2.37 =
baseR + noseR), the link's beak sits inside the castellation band, the
lock pad is on a different wheel entirely. The **spring** was the fault,
and in two ways at once:

- It sat at arm-local **x +0.8**, on the far side of the pivot from the
  arm itself, which reaches back to the nose at **x −2.0**. It hung in
  space behind the pivot, touching nothing.
- It was a **child of `alarmClickArm`**, so it travelled with the very
  lever it exists to push. A spring that moves with its own load does no
  work — which is precisely why it read as floating.

**A return spring has to be grounded**: one end fixed, the other bearing
on the moving part. It now hangs off its own stud on the switch unit and
presses the arm's outer flank at mid-length, so the moment about the
pivot drives the nose into the wheel — the direction the click must be
biased. The bearing point, anchor and blade angle all derive from the
pivot→seat vector rather than being placed by hand.

**Verified:** the blade now moves **0.0000** while the nose rocks
**0.558** (it is genuinely static), its z-band lies inside the arm's,
and it makes contact (gap 0.000). Boot silent; focused battery over the
switch, link, lock, plate and striking wheel clean; `stockFloor` green.

The blade remains 0.026 mm — under even the spring floor, and still
carried in TODO 11 as one of the two sub-floor springs. Grounding it
fixes what it *does*, not yet what it is made of.

### TODO 11 tranche four — the two sub-floor springs, bought

The last two rows that were under the floor **for their own declared
kind**: the feeler's return blade (0.0225 mm) and the switch click's
detent blade (0.0262 mm), both against a 0.03 mm spring floor.

The fix is not "add stock until the check passes" — it is reading what
the floor actually claims. §50's spring basis says: *real hairsprings run
0.02–0.04 mm; **flat springs thicker***. Both of these are flat blades, a
return and a detent, not hairsprings. 0.03 was never their target; it was
the floor for a different class of spring. They are now sized at
`SPRING_FLAT_U = 0.05 / UNIT_MM` (0.133 u) — the low end of real
flat-spring stock — so they clear on merit instead of grazing the line.

**The feeler blade is worth recording as a miss.** §51 had already tried
to buy it, raising its **z** from 0.04 to 0.08 (0.03 mm, exactly the
floor). The row survived, because the blade's thin axis was **y** at
0.06. The census measures the *smallest* extent, so thickening a
dimension that was not the thinnest changed nothing it looks at. This is
the second-hand `widthFactor` lesson in a new costume: **before buying
stock, confirm which dimension is actually the binding one.** Both
flexing dimensions now carry it.

**Verified:** `stockFloor` `ok: true`, 0 degenerate, 0 unwaived, waived
59 → **57**, and **zero** spring-kind rows remain under floor. Boot
silent on a fresh reload (marker-delimited, so the pre-existing §38
runtime warnings from the sweep session could not be mistaken for it).
Focused check over the switch, feeler, link, lock, striking wheel and
plate: support 0, graph 0, penetration none over budget, clearances 0.

## §48. Audit the oscillators that have no spring

**The rule, stated once.** A part whose motion REVERSES needs one of
exactly two things: a **two-way drive**, where something pushes it each
way, or a **restoring element** — a spring, or gravity, declared as
acting. A part with neither is *animated*, not driven: its return is
asserted by the pose law rather than caused by the movement.

`auditOscillators()` classifies every reversing part into those three
buckets. It is a **report, not a gate** (§40's rule — an audit that fails
the battery on arrival gets switched off): `ok` is always true, and each
restored-by-nothing finding is filed to `TODO.md` against its part.

### The population is §36's, not a second pass

§36 asks what VOLUME a reversal sweeps; §48 asks what FORCE causes it.
Same set, different question — so the audit consumes `reversed` off the
registry rather than re-sampling the pose laws, which keeps the two
honest about one list.

Making that possible needed §36 to record the fact **unconditionally**.
It used to compute reversal behind `if (!full)`, so a part already
promoted by the SPOKE rule never had its direction sampled at all — and
the spoke rule fires first for exactly the fast oscillators this audit
hunts. Consuming that set would have silently excluded them: *a check
that searches for less than the thing it verifies.* Same loop, same
epsilon, same axis-boundary skip; only the guard moved.

§36 also had no reversal test at all for **compound movers** — a part
that SLIDES out and back reciprocates just as surely as one that swings.
That is now a sign change in the centroid's direction of travel, with two
self-scaling gates: the track must go somewhere real relative to the
part's own size, and steps below a thousandth of that extent are noise
and do not vote. Without them a rotating part's stationary centroid is
pure float jitter, whose direction flips at random.

### What it cannot see, said plainly

A declaration is a claim the build makes about its own pose law, and no
static check can confirm that a force is what actually produces a return
— the pose law is code, not a solver. What IS checked is the failure mode
the entry names: **a spring that exists only as geometry.** A `spring`
declaration must name a mesh really in the scene, so "there is a spring
next to it" cannot be typed in and left to look like a mechanism. Stale
declarations — for parts that no longer reverse — are reported too, since
that is how this report would otherwise rot.

### The result

**Control case PASSES:** the pallet fork is classified two-way driven.
It is impulsed alternately by the escape wheel and correctly has no
return spring, exactly as a real lever escapement does not.

Of **18** reversing parts (after §40's nearest-ancestor mesh dedupe —
before it, the feeler's meshes were filed against the Dial as well, and
that second row was not a duplicate but a FALSE finding: the dial does
not reciprocate, its tenant does):

- **12 two-way driven** — the fusee and chain (mainspring one way,
  winding the other), the escape and third wheels (recoil), the keyless
  parts and the alarm setting train (the crown drives both ways), the
  reset hammer (a positive linkage in its slot), the heart cam.
- **2 restored by a declared element** — balance and hairspring. Scope,
  stated: this asks whether a restoring element is declared, not whether
  its rate comes from stiffness. It does not, and that gap is `TODO.md`'s.
- **1 malformed** — the alarm hammer, and this is the interesting one
  (below).
- **3 restored by nothing** — the alarm release feeler, the minute jumper
  and the maintaining detent. All three are cam followers whose position
  is computed from the profile, so nothing presses them against the cam;
  all three already have a spring MESH. Filed as `TODO.md` item 13.

### The alarm hammer resolved — the opposite way round

This is the case that prompted the entry, and §25's account of it was
incomplete rather than wrong. `alarmHammerAngle()`'s free swing is
`ALARM_DRAW_RAD * cos(ALARM_HAMMER_W * t)` with exponential decay after
the strike — a **spring-and-inertia law**; `ALARM_HAMMER_W` is an angular
frequency derived so the hammer reaches the wire exactly at
`ALARM_FALL_S`. The pose law is not missing a restoring element; it
*asserts* one. No hammer spring is modelled.

So the build declares the spring the law implies, and the audit answers
that the mesh does not exist. Filed as `TODO.md` item 14. Item 13 is a
spring that exists and does nothing; this is a spring that does something
and does not exist.

**Battery beside it, unchanged:** registry 519 volumes (203 revolve, 147
path, 169 static), 0 still escaping after widening, **0 confirmed swept
overlaps**. The audit adds no geometry and cannot fail.

### TODO 14 closed — the alarm hammer's spring now exists

§48 reported the alarm hammer as a MALFORMED declaration: the build
declared the spring its pose law implies, and the audit answered that no
such mesh was in the scene. `alarmHammerAngle()`'s free swing is
`cos(ALARM_HAMMER_W · t)` with an exponential decay, and
`ALARM_HAMMER_W` is an angular frequency derived so the hammer meets the
wire exactly at `ALARM_FALL_S` — a spring-and-inertia law. §25 read that
fall as unexplained; it never was. What was missing was the **part**.

`alarmHammerSpring` is a flat blade at `SPRING_FLAT_U`, grounded on its
own stud standing plate → gong plane, bearing on the tail at 45% of its
length (inboard of the nose, so it never fouls the cam).

**The direction is derived, not chosen.** The push is minus the
derivative of the bearing point with respect to the hammer angle, and the
draw's own sign decides which way that is — so a later change to
`ALARM_DRAW_RAD` carries the spring with it instead of silently
inverting it. That is §43's chord-sign lesson, applied before the fact
rather than after. A build-time tripwire re-checks the torque opposes the
draw and is silent unless it stops doing so.

**Grounded on purpose.** The blade's free end tracks the tail every
frame while its anchored root stays fixed — the §43 postscript lesson,
where the click's spring was a child of the lever it was supposed to push
and therefore did no work. This one's stud is a child of the static
`alarmHammerUnit`, never of the rotating pivot group.

**Verified.** Root moved **0.000000** while the hammer swung **0.3162
rad**; tip-to-tail gap **0.0000** across the whole strike axis; measured
torque −5.954 against a draw of +0.27, so it opposes. The first version
of that test reported a perfectly still root — but the hammer had not
moved either, because `setPose` needs the strike axis posed explicitly.
A check that searches for less than the change it verifies always passes,
and it nearly did here too.

The audit closes its own finding: `malformedDeclarations` is now empty
and the hammer sits in `restoredByDeclaredElement ← alarmHammerSpring`.
Boot silent, `stockFloor` green (waived unchanged at 57), focused battery
clean.

**Still open, deliberately:** `ALARM_HAMMER_W` comes from the strike
timing, not from this blade's stiffness. §48's scope guard puts spring
rate and force modelling outside it, and so does this. The spring now
exists and acts; it does not yet set the frequency.

### TODO 13 closed — the three followers are sprung, not glued

§48 filed the alarm release feeler, the minute jumper and the maintaining
detent as *restored by nothing*. All three were PLACED at their cam's
profile value — `angle = profile(u)` — which reads as contact but is
really glue: the part is welded to the curve, and its return is asserted
by evaluating the profile again rather than caused by anything. All three
already had a spring MESH, which is precisely the distinction §48 exists
to draw.

**A sprung follower is a one-sided constraint.** The spring drives it
toward a *seat* it can never reach; the cam stands in the way. `Seek the
seat, stop at the cam.` The seat is preloaded one `CLEAR_MARGIN` of
travel past the deepest the cam can go — what keeps the follower loaded
at the bottom of the profile instead of merely kissing it, since a spring
that goes slack in the valley has lifted off.

**Geometry is unchanged, and that is the point rather than a caveat.**
While contact holds, the constraint evaluates to the cam: same pose,
every frame. What changes is what the law MEANS, and what it would do if
the cam fell away — the follower drops to its seat instead of tracking a
profile that is no longer there.

**The feeler needed a second fix.** Its blade was a child of
`alarmFeelerLever`, travelling with the very arm it exists to press —
the §43 postscript's defect, found a second time in a different part.
It now hangs from its own stud on the static unit, and the frame law
keeps its free end on the arm while its root stays put.

**Two verification notes worth keeping.** The first attempt at the
detent's preload read `MAINT_DET_LEVER` before the solve that assigns it
— a module-level temporal dead zone that threw before `__clock` was ever
set, with nothing in the console to say so. And the feeler's grounding
test reported a perfectly still blade root while the lever had not moved
either: the rock comes from the pin drop at coincidence, not from the
poses being set. That test was vacuous, exactly as the hammer's first
one was, and the grounding is confirmed structurally
(`bladeIsChildOfLever: false`) rather than dynamically.

**Verified by the audit that filed the item:** `restoredByNothing` is
**empty**, `malformedDeclarations` is **empty**, and all 18 reversing
parts are accounted for — 12 two-way driven, 6 restored by a declared
element. Boot silent; focused battery over the three followers plus
Dial, fusee and plate: support 0, graph 0, penetration none over budget,
clearances 0.

## §57. The control HUD — the watch's own controls, in the corner

Both crowns and the pusher have been directly interactive in the scene
since §24 and §43: the real parts take a real drag. What that costs is a
camera hunt. The crown is a 5.4 u knob on a 32 mm movement, so at any
framing that shows the whole watch it is a few pixels wide, and at any
framing where it is comfortable to grab, the dial is off screen. §57 adds
a **second way in**, not a replacement — a 150 px pad in the lower-right
corner (the one free corner: §21's comparison diagram and §28's toast own
the bottom-left, the caption owns the centre) showing the movement's ring
and **nothing but its three controls**.

Every gesture calls the SAME entry point the panel button and the 3D part
call — `toggleCrown`, `toggleAlarmCrown`, `setAlarm`, and the same
`crownRotation` / `alarmCrownRotation` the drags write. There is one set
of state and no second implementation to drift out of step with the first.

### A plan, not a projection — and it is drawn from the dial side

The ring does not track the camera. It is a plan of the movement the way a
service diagram is, and it is honest about the one thing such a plan must
be: **where each control sits**. Every marker's angle and radius is derived
from that part's own world position, and the pull and press travels are
the real `CROWN_PULL_DIST` / `ALARM_PUSH_TRAVEL` scaled by the same plate
radius, so a control that moves in the movement moves here too.

Which side it is drawn from is not a detail. The dial sits at z −7.5 and
every default framing looks back along −z, so world +x is on the **left**
of the screen; with SVG's y running down, a model azimuth lands at
az + 180°. The first build used a plain −az and drew the winding crown at
8 o'clock while the real one sat at 2 — a map that is mirrored is worse
than no map. The conversion is one constant, `HUD_AZ_OFFSET`, applied in
one place.

**The one deliberate untruth is angular spacing.** The pusher sits 16°
from the winding crown, which is fine for a fingertip on a real case and
impossible at 150 px: the heads are ~7° wide each and their hint marks
reach ±18°, so drawn true they overlap and every gesture becomes a coin
toss between hacking the watch and firing the alarm. That pair is pushed
apart to 46° about its own midpoint. Only that pair, only in angle, and
the order around the ring is preserved — a control pad is read for "which
side, and which of the two is nearer 12", and both survive.

Both heads are **side profiles**, drawn as the parts are shaped: the crown
a knurled barrel on its stem, the pusher a squat puck with the collar its
guide boss makes. §43 sized that head in millimetres precisely because it
is a thing a finger presses; a circle drawn in plan said "button on a
panel" where the part is a pushbutton on a rim.

### The gestures

A drag is classified once, on its first few units of travel, into the two
things a crown does — **slide** (radially: pull out, push in) or **turn**
(tangentially: wind or set). Classifying once and holding it is what makes
a turn survive the wobble of a real finger; re-deciding per frame had a
long turn flip into a pull halfway through. The pusher takes an inward
swipe or a plain tap; the crowns stay swipe-only, because a stray tap that
hacked the watch is a state change nobody asked for. Direction marks are
deliberately a whisper — a HUD that shouts its arrows louder than the
controls they point at is an instruction sheet, not an instrument — and
the direction the current state has already used up is dimmed further.

### The trackball moves the CAMERA, not the model

The dial face carries the affordance as a **sphere with a cross of two
double-ended arrows on its surface** — both strokes bowed off the centre
line, because that is what a great circle does when you see it on a ball.
A flat cross would read as a d-pad, and a d-pad promises four directions
where this takes any of them; heads at both ends of each say the ball
turns either way.

The face itself is an arcball: a drag across the middle tumbles the watch, a
drag around the edge rolls it on its own axis. Rotating the movement group
was the first build and it is the one that lies — §49's ruler stands in
world space and reads the plate's Y extents and the assembly's Z depth off
built constants, so the moment the watch tilts, its leaders point at where
the rim used to be and the overlay states a measurement that is no longer
true. Orbiting the camera leaves every part, every world-frame overlay and
every camera script exactly as correct as they were.

The pole clamp is inherited rather than reimplemented: OrbitControls keeps
its polar angle inside (0, π) about world +Y, so a tumble that would cross
the pole is refused here instead of being applied and then snapped back by
the controls on the next update. Roll is unbounded, as it must be.

Off by default, toggled in **View → Control HUD**, or opened on arrival
with `?hud=1` — for a link that wants the watch driveable the moment it
loads, which on a phone is the difference between a demo and an
instrument.
## §54. Slenderness — a minimum thickness is not a minimum stiffness

§50 gave every part a floor on its thinnest dimension, closing a real
class of defect: parts too thin to exist. It cannot see the next class at
all, because **stiffness goes as t⁴/L³** and the floor knows nothing
about L.

The alarm link is the case that prompted it (`TODO.md` 16, reported by
eye). Its beak tail is 0.12 mm section — **exactly `STOCK_MIN_U`, built
deliberately to the floor** — and 10.0 mm long, so it passes by
construction while being 84× longer than it is thick. Meanwhile the same
unit's centre crank, at 0.045 mm the thinnest member in the alarm work,
is **280× stiffer**, because it is short. The thickness floor ranks those
two exactly backwards.

### Which dimension, and why not the thinnest

A flat lever is wide and thin *on purpose*: it bends easily out of plane
and is stiff in the plane its load acts in. Judging it by sheet thickness
would flag every correctly-made lever in the movement. So slenderness is
measured against the **second-smallest extent** — the stiffest section
dimension available. A part slender even in its stiff direction is
slender however it is oriented, and there is no argument to have about
it. The test is deliberately conservative: it under-reports rather than
crying wolf.

Springs and markings are **exempt by kind, not waived** — a spring that
is not slender is not a spring, and a printed index is a film, not a
member. Flagging them is a category error, so they never enter the
population.

### One ceiling per kind, and the one that was found by running it

`SLENDER_MAX = 30`, on the basis that real watch arbors and levers run
L/t of roughly 5–20. The small-seconds hand then came back at **λ 31.5**
— and that is not a defect, it is what a hand *is* (real blued-steel
seconds hands run λ 30–50). `SLENDER_MAX_BY_KIND.hand = 50` covers it.
A **ceiling, not an exemption**: a hand at λ 200 would still be a real
finding. That refinement was not predicted; it came out of running the
check, which is exactly the §50 triage loop.

### Result

**4 ms** over 454 meshes — geometry-local, so unlike §50 it needs no
swept registry and no sampling. 17 exempt by kind, **8 over ceiling, 6
unwaived**:

| unit / mesh | λ | section × length | stiffness |
|---|---|---|---|
| Alarm link / `alarmLinkShaft` | **100.5** | 0.09 × 9.05 mm | 4.4 N/m |
| Alarm link / `alarmLinkBeakTail` | **83.7** | 0.12 × 10.05 mm | 10.2 N/m |
| Hack rod | 63.4 | 0.26 × 16.65 mm | 51.4 N/m |
| Reset rod | 44.7 | 0.26 × 11.74 mm | 146.9 N/m |
| Keyless works | 38.2 | 0.26 × 10.02 mm | 224.3 N/m |
| Reset rod | 36.9 | 0.26 × 9.69 mm | 261 N/m |
| Alarm crown | 35.4 | 0.32 × 11.15 mm | 355.5 N/m |
| Alarm release feeler | 35.1 | 0.10 × 3.43 mm | 43.2 N/m |

It **independently reproduces the hand-measured alarm link** at the top
of the list, then finds six more nobody had looked at. The stiffness
column is informational — a first-order cantilever estimate good to a
factor of two — because "λ = 84" means less to a reader than "10 N/m: it
bends a tenth of a millimetre under a milligram-ish load".

**A report, not a gate** — §40's rule and §50's own history. §50 reported,
was triaged over four tranches, and only then gated. Arriving as a gate is
how a check gets switched off. `ok` is always true; the rows are the
product.

Three alarm-link members were **named** in the same change
(`alarmLinkShaft`, `alarmLinkBeakBar`, `alarmLinkBeakTail`): a slenderness
row that cannot name its member is not actionable, and unnamed geometry
has been this session's most expensive recurring cost.

### §54 postscript — the alarm link fixed, and a pillar move rejected on evidence

§54's first customer, closed. Both members are now derived from
`SLENDER_TARGET`, so the geometry is sized by the same number the check
measures it against.

**The originally-proposed fix was wrong, and probing said so.** TODO 16
proposed moving the pillars: both bushes cluster at the rod end, leaving
the drive crank on a 4.5 mm cantilever. Probing every station along the
chord showed the entire inboard run sits under dial-side hardware — which
is precisely *why* the bushes are where they are. The cantilever is not
movable, so the fix had to be section.

| member | was | now |
|---|---|---|
| `alarmLinkShaft` | 0.09 mm, λ 100.5, 21 N/m | 0.335 mm, λ 27, **4075 N/m** |
| `alarmLinkBeakTail` | 0.12 mm square, λ 83.7, 10.2 N/m | 0.12 × 0.372 mm blade, λ 27, **305 N/m** |

**A lever is tall and thin, not square.** The tail's load is vertical, so
its section grew in Z, where the force acts, and stayed at floor stock in
Y. §54 measures slenderness against the stiffest available dimension
precisely so a blade earns its ratio this way.

**Two budgets agreeing is why the shaft radius is trustworthy.** §54's
ceiling gives d ≥ chord/30; the load path — holding the drive end to a
tenth of the selector's 0.071 mm stroke under a ~20 mN detent — gives
≈ 2800 N/m, i.e. the same radius to two decimals.

**`SLENDER_TARGET = SLENDER_MAX * 0.9` exists because of a rounding
miss.** Built at exactly the ceiling, the tail came back at λ 30.0 and was
still reported: sizing a part to the boundary lets float rounding pick the
side. `JMP_BIND_EPS`'s lesson in a new place — never build exactly to the
limit a check compares against.

The crank offset had to become derived (`SHAFT_R + CRANK_T/2`): at the old
literal 0.22 an arm would sit *inside* the fattened arbor. `ROD_FOOT`
followed `CRANK_TOP` automatically, as §51 arranged.

**Verified:** the alarm link is entirely off the slenderness report (8 → 6
rows, and `SLENDER_WAIVERS` is now empty — fixed, not waived);
`stockFloor` ok with waived **57 → 53**; focused battery over link,
selector, switch, dial, plate, jumper, drum and barrel: support 0, graph
0, penetration none over budget, clearances 0; boot silent. Stall force
along the chain ≈ 1.5 mN → ≈ 48 mN.

### §54 postscript 2 — the beak lever was inverted, and my verification could not see it

Reported by eye: the rod from the column wheel to the vertical rod levers
the wrong way against a shaft that should be pushed dial-side and sprung
back — with a collision to show for it.

**The same Euler-order trap the lay shaft already carries a fix for, on the
arm twelve lines above it.** The beak's aim is `rotation.z`, set at build;
its lever action is `rotation.y`, set each tick. Under the default `'XYZ'`
the tilt is applied *before* the aim — about world-Y — so the throw comes
out scaled by `cos(beakAim)`, and this arm aims at **122.4°**, where the
cosine is **negative**.

Measured under `'XYZ'`: nose **+0.0079**, tail **−0.1436** per 0.02 rad,
against a pose law whose own comment reads *"nose falls into the gap"*.
The nose **rose**. So the tail drove **down** onto a rod the same frame was
moving **up** — the two members pushed into each other — and the lever ran
at **54%** of its intended throw as a bonus.

`beakArm.rotation.order = 'ZYX'` applies the aim first, then tilts about
the arm's own axis. Verified across the alarm's on/off poses:

| | |
|---|---|
| tail tip travel | **+0.19** |
| rod travel | **+0.19** — ratio **1.000** |
| nose | −0.0065 — falls while the tail rises |
| tail↔rod contact gap | constant at both poses |

**On my own verification.** I reported the section fix as battery-clean
having run `focusedCheck` — support, graph, penetration, clearances. Those
test **declared pairs**. A brand-new overlap between an *undeclared* pair
is invisible to every one of them, and `sweptOverlap` — the check that
enumerates all pairs — is the one I skipped as "the slow one". The eye
caught what the cheap subset structurally could not. Re-run in full here:
**523 volumes, 0 still escaping, 0 confirmed, 0 tight, no Alarm link rows.**

Three of my measurements during this fix were also vacuous before they
were right — an AABB test on a long diagonal bar (its box overlaps half
the movement), a pose sweep that never moved the column wheel, and the
tail's AABB *floor*, which is pinned at the pivot end no matter how the
lever swings. The tip is what moves; measure the thing that moves.

## §55. The inspection route — a tour for the instrument that actually finds things

`TOUR_STEPS` is a **showcase**: it narrates the movement to a visitor and
never goes near the alarm work. This is a different animal — a **route to
the places defects live** — and it exists because of a pattern this
project keeps paying for.

The battery answers *"does anything overlap?"*. Every kinematic lie found
so far was caught **by eye** and was invisible to a clean run: a pawl
driving the column wheel backwards, a saw cut the wrong way, a follower
decoupled from its cam, a spring parented to the lever it should push,
gears meshing tooth-on-tooth, and a lever inverted by its Euler order.
Not one of those moves a volume anywhere it should not be, so not one of
them can fail a sweep. If the eye is the instrument that finds this class,
it deserves a systematic route rather than wherever the camera happened to
be pointing.

### Framings are derived, not typed

A stop names the **part** it wants to look at; the camera is placed off
that part's measured bounding box (`frameOn`, accepting a unit name or a
mesh name). A hand-typed pose silently stops framing its subject the first
time the subject moves — which is precisely the failure this tour exists
to catch. The tour must not need re-aiming every time the geometry it
inspects is corrected. A stop naming something that does not exist warns
by name at boot rather than quietly framing nothing.

### Nine stops, each saying what to LOOK FOR

A caption that only names the part gives the eye nothing to do, so each
one states the test:

1. **Escapement** — §48's control case: the fork is impulsed both ways and
   should read as *driven*, not animated.
2. **Column wheel at rest** — the click's spring is grounded on its own
   stud; it must stay still while the arm rocks.
3. **Column wheel indexing** — the pawl must drive the ratchet the way its
   teeth are cut.
4. **The beak on the castellations** — nose falls into a gap ⇒ tail rises
   ⇒ rod rises. *A lever inverts*; nose and tail moving together is wrong.
5. **The lay shaft's drive end** — its crank must carry the ring's tab, and
   the shaft should read as an arbor rather than a hair.
6. **Winding idlers → barrel** — tooth into gap at the line of centres.
7. **Setting train dogleg** — the same test across the dial's Y-flip.
8. **The hammer** — its fall is a spring law, so a real spring bears on the
   tail: grounded at the stud, moving at the arm.
9. **A sprung cam follower** — pressed onto its cam, not glued to it.

### The sandwich: a stop must be viewed from the side its part is on

Reported by eye: *"stop 9 is focusing on the balance wheel"*. It was. This
movement is a sandwich and half the alarm work lives **under the base
plate**, on the dial side. Three of the nine stops named dial-side parts
(crank centre z −6.7, setting idler −4.7, release feeler −5.8) while their
camera directions all had **+z** — putting the camera on the movement side
looking *through* two plates at the balance and the plate top, with not one
pixel of the subject in frame.

`frameOn` now decides which side of the plates to view from, from the
target's own centre: a stop says which way it wants to look, and a part
that later moves across the sandwich takes its camera with it. Per-stop
vectors would have needed re-tuning on every such move — the same reason
framings are derived rather than typed in the first place.

Fixing the side alone is not enough: once the camera is correctly on the
dial side, the base plate and dial are between it and the subject, so
those stops set `xray` too. Stop 9 also reframed from the whole unit onto
`alarmFeelerSpring` — the unit's radius is 6.2, which at any usable pad
puts the camera ~28 u out, a whole-movement shot for a part 0.1 mm thick.

### Stop 4 frames an END, not a centre — and the first attempt failed

`frameOn` aims at a bounding-box centre, which is right for a wheel and
wrong for a rod. The z-shaft runs 16 u through both plates, so its centre
is buried in the plate sandwich while the joint worth looking at — where
the beak's tail drives it — is 8 u away on the movement side.

The first attempt framed the **contact** between tail and rod by
intersecting their bounding boxes. It came back **empty**, and the
fallback landed at z 5.76: mid-air, below the plate top, framing nothing.
The reason is the lesson this project keeps relearning — an AABB of a long
**diagonal** member describes a volume the part is nowhere near. The tail
runs 26.8 u across the movement, so its box is enormous and its overlap
with anything says nothing about where the two actually touch. Same
instrument failure that produced a false collision reading during the
alarm-link work an hour earlier.

`frameOnEnd(target, end, axis)` takes the member's own extent and frames
the requested end, closing in by the part's **section** rather than its
length — otherwise the shot is as wide as the member is long. Stop 4 now
lands on the rod's top at z 9.45, above the plate top at 8.5, at 4.2 units.

Runs off an `Inspect` button beside `Tour` and `Demo`, through the same
`scriptStart`/`scriptEnterStep` engine, so it stops the same way and takes
the same camera tween. Dwells are 6–7 s rather than the showcase's 1–4:
this one is meant to be looked at, not watched.

### Deep links: `?inspect=1` and `?cycle=1`

`?inspect=1` starts the route, and unlike `?tour` it has **no confirm
gate**. That gate exists because a deep link is not a user gesture and
should not swing the camera, crown and *sound* at a first-time visitor
unasked. The inspection route is a working tool reached deliberately, it
makes no sound, and anyone typing the parameter has already asked for
exactly what it does.

`?cycle=1` starts the alarm cycler on arrival, which is the one worth
pairing with the existing `?cam` / `?look` / `?xray`: aim at a linkage and
watch it work without touching the page. E.g.

```
?cam=6.0,-3.0,-7.9&look=4.79,-2.26,-5.75&xray=1&cycle=1
```

### The alarm cycler — motion at the view you already chose

A `Cycle` button beside the alarm's on/off. It flips the alarm on a 1.6 s
timer and touches **nothing else**: no camera, no preset, no time scale.

**Force transfer is only legible in motion.** A single state change gives
the eye two still frames and leaves it to assume the path between them —
which is exactly how a follower decoupled from its cam and a lever
inverted by its Euler order both survived review. Watching the chain cycle
several times makes pusher → column wheel → beak → rod → shaft → crank →
ring either obviously work or obviously not.

**Deliberately not a tour stop.** A stop moves the camera, and the point
here is to inspect *the view you already framed* — park wherever you like
and let the mechanism run. It also runs off the frame loop rather than
`setInterval`, so it stops dead when the tab is backgrounded instead of
queueing a burst of toggles to replay on return, and its toggle lands in
the same pre-tick slot as the scripted crown turns so the state change is
integrated by the frame that follows it.

**Verified:** alarm state observed **On → Off** while cycling, with
`cameraMoved` **0.0000**, and holding at a single state once stopped.
Sampled across separate tool calls with forced paints — this repo's rAF
throttles hard under automation, and the first attempt to check it inside
one eval sampled 14 consecutive frames (~0.2 s) against a 1.6 s
half-period, a window in which no toggle could ever have appeared.

### Defaults: synced on arrival, ribbing at its minimum

**Synced.** The movement used to boot at an arbitrary epoch, so the first
thing a viewer saw was a watch showing the wrong time. Boot now runs the
SAME `syncStart()` the button does — crown out, set through the real
keyless works, catch up — so the default is the mechanism doing its job
rather than a number assigned to the hands. Skipped when a script owns the
view (a deep-linked tour/demo/inspection is mid-flight and `syncStart`
pulls the crown and forces scale 1 underneath it) and when `?tau` or
`?sync` says the caller already chose an epoch.

**Ribbing at a minimum.** `decoration.ribbing.widthUnits` is the band
PITCH, so larger means fewer ribs: 6.7 → **30**, the bound maximum. The
`_comment` now says which way the parameter runs, since "minimum ribbing"
and "minimum widthUnits" are opposites and the next reader will meet that
trap.

Verified: dial reads 11:56:37 against a 23:56:37 wall clock; rib slider at 30.

## §56. The gong arc is a parameter, and the gong's voice is derived from it

`decoration`-style live controls for the alarm gong: `gong.arcDeg` and
`gong.wireDiaUnits`, through §23's generated Advanced panel and its bounds
table.

### Measured back from the FREE end

The arc is defined **backwards from the struck end**, so `arcDeg` moves the
**foot**. That direction is the whole trick: the ringing end, the hammer,
its pivot azimuth (`GONG_A1 + 11°`), the head's rest radius and the strike
emitter are every one of them sited off `GONG_A1`. Anchoring at the foot
instead would drag the hammer around the rim on every edit and re-open
§25's strike geometry. **Verified: `hammerMoved` = 0.0000** across the
range.

### The voice follows the wire

The ding used to be `sndTone(1760) + sndTone(880)` — an octave pair, picked
as "A6-ish, a small bell". It is now the wire's own modes:

> f_n = (β_nL)² · (d/4) · √(E/ρ) / (2π L²),  (β_nL)² = 3.516, 22.03, 61.70

Those ratios are **1 : 6.27 : 17.55** — *inharmonic*, and that is the
point rather than a detail. A struck wire is not a bell; modelling it as an
octave modelled away the very thing that makes a gong sound like a gong.
Neither old tone was a mode of this wire at any dimension.

Measured through the live control:

| arc | fundamental | 2nd mode |
|---|---|---|
| **90°** (default) | 626 Hz | 3922 Hz |
| 60° | 1397 Hz | 8755 Hz |
| 45° | **2514 Hz** | 15756 Hz |

which closes most of `TODO.md` 17 — the tone is no longer chosen. It also
makes the entry's design point audible rather than theoretical: at 90° the
fundamental is a 626 Hz hum and the ring that carries is the 3.9 kHz second
mode, while at 45° the fundamental itself lands at 2514 Hz, right where a
real alarm sits. Note the second mode leaves the audible band on the way,
so shortening the arc changes the *character* and not just the pitch.

What remains of TODO 17: the hammer strikes **in-plane**, and a curved
bar's in-plane modes sit somewhat above these straight-bar figures, so a
curvature term would sharpen all of the above.

### §54 postscript — the shaft thickening was reverted; CI caught it

The alarm-link section fix shipped for the **beak tail** and was **reverted
for the shaft**. Taking it to `SLENDER_TARGET` (r 0.12 → 0.447) drove it
into the minute jumper: `Alarm link ⇄ Minute jumper`, FORBIDDEN across the
whole beat axis, **overlap 0.312** against a radius growth of 0.327.

The instructive part is why the local evidence looked fine. An exhaustive
per-vertex scan put the nearest non-contact neighbour at **0.97** and the
jumper at **2.86** — both correct, both beside the point, because the
minute jumper is a **mover** and the fat shaft sits in the arc its blade
sweeps. A single-pose probe cannot see a swept intrusion no matter how
finely it samples. That is the whole argument for `sweptOverlap` being a
gate, and §52's CI is what enforced it here.

Kept: the beak tail blade (λ 27, 10.2 → 305 N/m) and the inverted-lever fix,
both movement-side. Reverted: shaft, crank section and offset, bush bore,
hanger. `SLENDER_WAIVERS['Alarm link']` restored — the check goes on
reporting λ 100.5, which is the honest state.

The shaft wants a **stepped arbor** — turned down through the jumper's
sweep, full section in the span and the overhang — which recovers most of
the stiffness while respecting the corridor. Filed in `TODO.md` 16.

### §54 postscript 2 — the stepped arbor

The uniform fat shaft was rejected by CI; measuring why showed the
obstruction is the **selector ring**, symmetric at 0.16 above and below the
shaft plane. The shaft threads the plane of the ring it drives, so there is
no direction to steal room from — the clearance is a slot, not a stack-up.
That leaves exactly one shape, and it is the one a real arbor has anyway:
**turned down at the ends, full section between**.

Necking **both** ends rather than one is the better answer, not a
compromise: both cranks then sit on thin sections, so their offsets and the
`ROD_FOOT` chain derived from them do not move, leaving §25's tab
engagement and §35's corridor untouched. The body's radius derives from the
BODY's own length — it is the span that must satisfy the ceiling.

Body r 0.373 × 20.13 u at **λ 27**; necks r 0.12 × 2.0 u.

**Drive-end stiffness, by unit-load over the stepped section:** 21 → **1387
N/m**, which is **65×** the original and **70%** of an unbroken 0.373 shaft.
The code's first note claimed the tip neck would cost "very little"; that
was wrong and is now corrected in place — the neck is 17% of the length but
**30% of the compliance**, since I falls 93× where it is turned down. Under
20 mN the drive end deflects **20%** of the selector stroke, against
**1324%** before.

Verified against the two gates that failed the previous attempt:
`sweptOverlap` 0 confirmed / 0 tight / no Alarm link rows, `inspection` 0
FORBIDDEN, `stockFloor` clean, and `SLENDER_WAIVERS` empty — fixed rather
than waived.

### §54 fix — the button-restore list is gone

Reported: **Inspect reads "Stop" permanently after the route ends.**

`scriptStop()` restored each script button's idle label from four
hand-written lines, one per button — and two of them carried comments
recording this exact bug happening before:

> `// §34's button was missing from this restore — it stayed "Stop" after its run ended`
> `// §37, same restore — the lesson above, applied on the way in this time`

§54's Inspect button made it **three**. A list that must be edited in a
second place every time a button is added will eventually be missed, and
this one had been missed every single time it grew.

So the list is gone. Script buttons carry `.script-ctrl`, their idle
labels are captured **from the DOM at boot** (`SCRIPT_BTN_IDLE` — read,
not declared, so it cannot drift from the markup), and `scriptStop`
iterates. A new button is restored correctly **by existing**; there is
nothing to remember.

`btn-coupling` and `btn-link` were missing the `.script-ctrl` class and
gained it here. That also fixes them in a second place: `scriptAbort`
already used `.script-ctrl` to tell "the user is talking TO the script"
from "the user is taking over", so clicking either of those mid-run had
been counted as a takeover.

Verified across both exit paths — second click, and running to completion —
for all five buttons.

### §54 postscript 3 — the stepped arbor was rejected too, and why that is informative

The stepped arbor was built (body r 0.373 at λ 27, necks r 0.12) and CI
rejected it: `Alarm link ⇄ Minute jumper`, overlap **0.310**, against
**0.312** for the uniform r 0.447 shaft.

**The radius barely moved the number.** That is the finding. If the
shaft's section were the binding thing, 0.447 → 0.373 would have shown —
so the alarm link's swept volume enters the jumper's swept region at all,
and the reported depth belongs to that region's shape rather than to the
shaft. The earlier "selector ring is the obstruction" conclusion is
retracted: the 0.16-either-side measurement was real, but it was not what
CI was reporting.

**Local said clean; CI said no, and the gap between them is the useful
part.** CI boots **virgin**, and boot now runs `syncStart()`, which pulls
the crown — and a pulled crown puts the minute jumper **in the star**. The
local session carried persisted state with the jumper elsewhere. *A swept
check is only as good as the poses it starts from*, and "it passed
locally" meant "it passed from my saved pose". That is the same family as
every vacuous check in this session, one level up: not a check that
searched too little, but a check that started somewhere too comfortable.

Reverted to the section CI passes. The beak tail blade and the
inverted-lever fix stand — movement-side, verified, not implicated.

## §58. Explore mode — free-drag the parts as they ARE

The general case of explode (§7/§10): that layer displaces units along z
by one shared amount; this one displaces any unit — or a §10 group — by
its own XYZ vector, by pointer drag, and puts everything back with one
action. The subject is the SHIPPED watch; only the view of it moves.

### One table, and who reads it

`dragOffsets` is a single name-keyed map of world-space vectors — the
same string vocabulary `MECH_GRAPH` and the labels couple by. Only
nonzero offsets live in it, so `size > 0` **is** the "anything displaced"
test. It is view-only by construction: nothing in `tick()`'s solve,
`setPose`, or the fingerprint reads it. It is session-scoped and never
saved — §34 already caught a persisted input that moves units poisoning
a sweep (the explode amount restored from saved UI state), and a saved
drag would be that bug with three axes.

Application composes rather than overwrites, which was the §10/§32
refactor in its minimal honest form. `updateExplode` still owns z
absolutely (explode's write, unchanged); x/y are touched **only while an
entry is displaced**, with the rest position captured at first
displacement and restored on the way out, so an undragged session's
writes are bit-identical to before this feature existed. Offsets are
world-space and rotate through the inverse of the parent's world
orientation at apply time — applied raw, a dial-side drag would mirror
in x and z under the Y-flipped `dialFace`.

Three owners compose their own offset, exactly as §32's hazard list
predicted: the reset rod (tick solves its position every frame and adds
the offset after the solve), the chain (rebuilt by `updateChain`; it
rides its offset at the object level, which survives every rebuild), and
the label-only units with no explode entry (a generic capture/restore
pass). `windSpinner` and `jumperLifter` needed nothing — tick writes
their LOCAL positions inside groups that are themselves the drag
handles, so they ride for free.

### Tethers — the mode's signature, and its honesty

While a unit is displaced, a dashed line runs from it to each
`MECH_GRAPH` drive partner it has been **separated from** — offsets
differing, not merely present, so a group dragged together stays
internally silent and only the edges crossing the displacement boundary
speak. A dragged-apart mesh keeps turning in ratio, which is a lie about
contact; the tether is what makes it read as "really connected, pulled
apart for you". The drive list is the declared data, imported from
`inspect.js` on first enable (a dynamic import — the inspector and its
BVH dependency stay out of the boot path). Verified: three tethers on a
displaced fourth wheel, exactly its three drive edges; one tether on the
escapement group moved as one, exactly the fork→balance edge crossing
the boundary.

Endpoints are live bounding-box centres, recomputed per frame, so
tethers follow the drag, the explode lift and the mechanism's own
motion. Like §49's ruler, the tether object is scene furniture — never
registered as a unit, structurally invisible to the battery.

### What stays true (measured, not asserted)

- **Fingerprint**: a session with two units dragged hashes identically
  to a virgin one (3706548518 both ways — and identical to the main
  checkout's build, which is the proof this feature moved zero
  geometry). `resetInputs` clears the table first, same as it zeroes
  explode.
- **§49 fallback**: with a unit selected and Measure on, 8 selection
  leaders; drag anything and they fall back to the 4 whole-movement
  leaders (built constants, immune by construction); clear and the 8
  return.
- **Reassembly is exact**: every probed unit returned to its rest
  position to the fourth decimal, including the three special owners
  across real ticks.
- **Boot silent**, and `step()` gained tether and leader updates so the
  unattended-verification path can see what rAF sees.

### The gestures

Hover affords (grab cursor), drag moves in the camera-parallel plane
through the grab point — a pointer has two axes, and the third arrives
by orbiting and dragging again. Shift drags the §10 group. Picking
resolves the DEEPEST labelled ancestor under the ray, so the front-most
part wins, as physical occlusion would suggest. The crowns and pusher
keep first refusal — winding still works with explore on. Leaving the
mode reassembles the watch: an offset surviving with no mode chrome
around it would be a silently-displaced movement, and reset is free by
construction (clear the table; nothing else to lose).

Toggle: **View → Explore**; the row also carries Reassemble.
`__clock.dragOffsets` and `__clock.setExplore` are exposed for the
battery and for scripted verification.

## §59. Name the part under the cursor, before it is dragged

Explore mode (§58) lets a viewer pull any part out of the movement. This
says which part that is, while there is still time to change your mind:
hover in explore mode and the name appears under the cursor.

### The expensive half was already built — and one gap was not

§58's handle resolver already ran on pointer MOVE, not only on pointer
down: that is where the grab cursor comes from. So the name was being
computed on every hover before this entry existed, and the readout is a
second reader of a resolve that was already happening. Nothing here
authors a name. `explorePick` returns names that came from
`registerLabel` or an explode entry, the group name comes from
`UNIT_GROUPS`, and both are boot-asserted — so a sub-part with no true
name resolves to nothing and shows nothing, which is §10's standard kept
exactly: a confidently wrong label is worse than no label.

The gap the entry predicted was real, and it was in the resolver rather
than the readout.

### X-ray is transparency, not visibility

`setXray` swaps materials; the glass plate and dial stay in the scene and
keep swallowing rays. So the frontmost hit was still the thing the viewer
was looking THROUGH. Measured on the dial side with x-ray on, at one
probe point, the hits ran glass Dial → opaque Reset hammer → opaque Third
wheel — and the pick returned Dial. Hovering would have named the glass,
and a drag would have grabbed it: with x-ray on, nothing under the plate
could be picked up at all.

A mesh the renderer is currently drawing as glass is now DEMOTED, not
removed. The first solid hit wins; a glass hit is the fallback when there
is nothing solid behind it, which keeps the plate and dial nameable and
grabbable exactly where they are the only thing there. The test reads the
declared set of materials `setXray` installs — not an opacity heuristic,
which would be a second source and would also catch any transparent
material the finish grows later. It is self-disabling: with x-ray off
every mesh carries its solid material and nothing matches.

The test is per-MESH, never per-unit. Some `dialGroup` meshes stay solid
under x-ray, so "is this unit glassy" would be wrong for exactly those.

This corrects §58's picking as well as feeding §59's readout, which is
the honest consequence of the two sharing one resolver: what you can name
and what you can grab are the same question.

### The cost of hovering, bounded — and it needed bounding

The pick is a raycast over the whole movement, measured on this build at
**3.8 ms median, 7.5 ms worst** — about a fifth of a 60 Hz frame. Pointer
moves fire FASTER than the frame on a high-rate pointer, so §58's handler
could spend more than a frame's budget picking alone during one fast
sweep. Pointer moves now only record the position; the pick runs at most
once per frame, from where the tethers and leaders already update.
Measured after: **200 synthetic pointer moves cost 6 ms in total** (0.03
ms each) against roughly 760 ms of raycasting before, with one resolve at
8.5 ms when the frame asks for it. Coalescing loses nothing — the latest
position is the one resolved, and the skipped picks are ones no frame
would ever have drawn.

### Where it is, and why not the other two surfaces

Cursor-adjacent, as its own element. §7's label layer already solves
3D→screen, but its labels are a persistent MODE and this is a transient
answer to "what am I about to grab?" — a hover must not silently switch
labels on. §57's HUD is in the far corner, and a name that appears away
from the pointer sends the eye off the very part it is about to grab. The
grab cursor is already under the pointer, so the name goes in the same
place at the same moment: the same visual language as `.clock-label`
without being one, above the labels and below the HUD, never a pointer
target itself, and flipped at the viewport edges because a name the
window clips is a name that was not shown.

Name only. The entry's scope guard reserves anything more for a later one.

### The gestures it answers to

Shift names the §10 GROUP rather than the unit, because Shift is what
makes the grab take the group — the readout says what the gesture in your
fingers would actually pick up. It re-renders without re-picking, since
Shift changes what a grab takes, not what is under the pointer. The
crowns and the pusher keep first refusal exactly as on pointerdown: a
control the viewer is reaching for is not a part to drag, so it is not a
part to name. The readout goes quiet the moment a grab is committed (the
viewer has decided; a name chasing the cursor is noise over the thing it
names) and speaks again on release. The pointer leaving the canvas ends
it.

### What stays true (measured, not asserted)

- **Fingerprint**: 1974757747 with two units dragged and again after
  clearing — identical to the recorded baseline. Render-side only; no
  geometry, no `MECH_GRAPH`, no battery surface.
- **Boot silent.** (A `§38`/TODO 8 alarm-granularity warning appears
  after a fingerprint sweep, from its large τ jumps — verified identical
  on pristine `origin/main`, so it is neither new nor a boot warning.)
- **§7's label mode is untouched by hovering**: button still Off, layer
  still hidden, after every probe.
- **Hover outside explore mode is unchanged** — with the mode off,
  nothing resolves and nothing is shown.

`__clock.exploreHover` is exposed for scripted verification: it reports
the name as the readout shows it, and reading it RESOLVES any pending
pick synchronously, because the interactive path throttles to the frame
and a scripted check must not wait on an rAF that automation throttles to
~1 fps.
## §22. Customisable power reserve and beat rate

Both are knobs now — two URL parameters (`?reserveh=`, `?vph=`) read into
`globalThis.__WATCH_SPEC` by a pre-module script in `index.html` before
`layout.js` evaluates, and two reload-tier selects in the Time panel
(the §23 subdial-size precedent: a knob that re-derives geometry earns a
reload, not a live write). The identity spec {30 h, 18,000 A/h} is the
regression gate: it reproduces the shipped movement **bit-exactly**
(fingerprint 1974757747, equal to the recorded baseline on main).

### Reserve — the cone re-solves

`RELAX_SECONDS`, `RESERVE_BARREL_TURNS`, `FUSEE_WRAP_TURNS`, the groove
turns and the cone height all derive from `SPEC.reserveHours` — the
entry's one catch closed: `FUSEE_WRAP_TURNS` was a duplicate literal of
`RESERVE_BARREL_TURNS` and `grooveTurns: 4` / `FUSEE_H = 2.8` were sized
by hand for it. Now: wrap = hours/8, grooves = ceil(wrap + 0.25) (one
spare turn keeping the anchor off the working grooves; = 4 at default),
height = 0.7·grooves (the shipped snug pitch, unchanged).

**The indicator re-solves with it** (TODO 18, held for every spec): the
scale's graduation and figures are painted to `SPEC.reserveHours`, and
the reduction's second-stage wheel is derived — R must be 0.3·h, stage
one is fixed 4.5, so w2 = 2h/3, an integer because the spec snaps hours
to multiples of 3 (w2 = 20 at the default, the shipped count). **24 h is
a clean variant** — wrap 3 fits the same 4-groove cone, so the geometry
changes are the indicator's own; boot silent. **36 h and up do not
close at the shipped stratification**: the taller cone outgrows the
hairspring stack, the plate floor rises off its designed bind, and the
boot asserts name each consequence (plate floor, maintaining band, at
48 h the alarm cam). The spec clamp stops at 48 h as a courtesy; the
asserts are the real gate.

### Beat rate — a menu, not a dial

Rates a re-solved train can actually deliver: 18,000 / 21,600 / 28,800
A/h. Each row of the rate table carries the fourth-wheel/escape-pinion
pair that keeps the fourth wheel at exactly 1 rev/min with the escape
wheel untouched (8/80 → 8/96 → 6/96; escPinion/fourthTeeth = 1800/vph,
integer pairs only). The third mesh never changes, so minutes and hours
are untouched by construction; `solveLayout` absorbs the moved
fourth⇄escape centre distance. A boot assert measures 1 rev/min
**through the same ratio chain the hands read** — a rate row whose
counts don't divide out warns at boot, not on the dial.

The faster rates run at the correct beat (6.0 / 8.0 beats/s readouts,
seconds arithmetic asserted) but **do not close cleanly at the shipped
layout angles**: the escape wheel steps outward, the balance lands near
the stem line (keyless side-sign heuristic), and the stop-work reach
constraint misses. Real per-rate layout tuning — per-rate walk angles
and a battery run per accepted rate — is §33's validity story and is
NOT claimed here.

### The verdict is in the panel

A non-default spec that fails its boot asserts shows an amber line under
the selects — "this spec does not close: N structural asserts" — §33's
refused-with-a-reason vocabulary arriving early. The identity spec keeps
the row hidden by keeping the count at zero, which is rule 6 restated.

## §33 step 1 — Reconfigure mode: the crown's azimuth as a spec

§33's goal is a watch you can re-arrange and still trust — "drag the
crown to 3 o'clock … and get a watch that ACTUALLY WORKS at the end, or
a clear, specific refusal saying why it does not." This step ships the
loop for ONE spatial parameter, end-to-end: crown azimuth.

### The mechanism: the movement turns in its case

`?crownaz=` (degrees, movement frame) reaches `SPEC.crownAzDeg` through
§22's pre-module script, and `solveLayout` applies it as a RIGID
ROTATION of the solved position table about the centre arbor — the
dial's own axis, so the numerals stay 12-up while the train, keyless
belt and stem swing together. This is the operation a casing watchmaker
actually performs, and it is why it is step 1: every internal centre
distance, mesh and clearance is rotation-invariant, so the train stays
proven, and what genuinely changes is the layout's relation to the
DIAL-ANCHORED world — which is precisely where §33's verdicts live.
The angle outputs (`forkBaseAngle`, `PIN_AIM`) rotate with the frame;
the step angles between members are relative and do not. The
small-seconds sub-dial follows its arbor for free (`SECONDS_LOCAL`
already derives from `P.fourth`). The identity spec (param absent)
skips the transform ENTIRELY — a rotation by zero still churns floats,
and the fingerprint gate would see it; verified bit-exact at the
recorded baseline.

### Validity, in two honest layers

Pre-apply, the one conflict class this rotation can create that is
knowable in closed form is checked LIVE while dragging: the crown
sweeping into the dial-anchored alarm cluster. The forbidden windows
derive from the parts that make them (both crowns' body radii, the
pusher's head, the one margin, all as arc at the plate radius), and a
candidate inside one is REFUSED with the numbers — "fouls the alarm
crown (0.0° apart, needs 14.6°)" — Apply withheld.

Everything else is judged where it is measured, after apply: the boot
asserts name each failed consequence (§22's amber verdict row —
measured at +30°: the plate cut reaching two carried pivots, the alarm
barrel fouling the fusee let-down square; at 200°: four plate-cut
asserts), and the battery is the full court for any spec worth
keeping. A rotated movement BOOTS AND RUNS either way — the refusal is
information, not a crash.

### The mode

View → Reconfigure (teal — deliberately NOT §32's chrome: the two look
alike on screen and mean opposite things, "this IS the watch, pulled
apart" versus "this is a PROPOSED watch"; the §33 entry calls mode
identity a safety requirement). In the mode the crown is a HANDLE for
its own azimuth rather than a winding input; dragging swings a dashed
near-white-teal ghost stem/crown around the rim (the §58 ACES lesson)
with the live verdict in the panel, speaking both frames ("az 200.0°
(≈ 4 o'clock)"). Apply is reload-tier (§23/§22: a knob that re-derives
geometry earns a reload; `/__state` carries the session across) and
"As designed" clears the spec — the identity round trip verified:
apply 200° → rotated, running, 4 named asserts → reset → clean URL,
baseline hash, silent boot. Explore and Reconfigure exclude each other.

### What step 1 does NOT claim

The stem still has no azimuth of its own relative to the movement —
§13's "decouple the stem and re-solve the keyless cluster" is the
deeper step 2, and the entry's steps 3–5 (group handle set, live
validity, named variants with undo) remain. Per-spec battery runs stay
manual: the boot asserts are the gate that ships with the knob, as
they were for §22's rates.

## §33 steps 3–5 — the handle set, the solver live, the spec as a document

Step 1 shipped one handle; these steps ship the rest of the mode's
machinery. (Step 2 — §13's stem decouple — is deliberately still open:
it does not gate any of this, and this validity machinery is built to
serve it when it lands.)

### Step 3 — the train's arrangement angles are handles

`?barrelstep=`, `?escstep=`, `?balstep=` reach `SPEC` and spread into
the `solveLayout` call ONLY when present (the identity spec passes no
argument and stays on the default constants, bit-exact). They were
always the arrangement's degrees of freedom — solveLayout's own inputs;
step 3 hands the viewer the knobs. In reconfigure mode the barrel,
escapement and balance become drag handles: the barrel's step reads
about the centre, the escape's about the fourth, the balance's TARGET
about the escape — each mapped back through the step-1 rotation into
the solver's frame, so the handles compose with a re-cased crown.

### Step 4 — validity is the solver's, live

Every drag frame SHADOW-SOLVES the candidate: `solveLayout` is pure, so
the same measured inputs the boot used (captured as `LAYOUT_INPUTS`)
with the candidate angle IS the check — no second model to rot. The
ghost constellation is drawn from the shadow solve's own position
table (dashed rings at each member's solved position, sized by its
measured swept radius, chained in train order, hovering above the
movement: a proposal, not a part); the warnings under the pointer are
the ones boot would print, including the solver moving off an
infeasible balance target ("the solver settles at 42.7°") and the
train failing to close outright (the centre–third–fourth triangle's
acos going out of range arrives as NaN, reported in words). Three
verdict tiers, honestly distinct: REFUSED (no solution — Apply
withheld), WARNED amber (solver settles elsewhere, or downstream
consequences likely — appliable, and the boot asserts repeat the
verdict in the panel after reload), PROPOSED teal (solver clean — the
boot asserts still judge what the solver cannot see: measured at
barrel −35°→−10°, the solver is clean and the boot names five
structural asserts, which is the layering working, not failing).

### Step 5 — the spec is a document

Applies navigate (`location.search`), so every accepted spec is a
browser-history entry: **Undo is `history.back()`**, redo is forward,
and the identity URL stays clean. Named variants save ONLY the
spec-tier params (`vph`, `reserveh`, `crownaz`, `barrelstep`,
`escstep`, `balstep`) under their own localStorage key — never the
pose, never §26's `DisplayState`, never the boot default. Verified
round trip: apply barrel −10° → running, five named asserts → save as
a variant → As designed → identity, silent → Load → the variant back
at az 170° → Undo → identity. Sharing a variant is sharing its URL,
which the params make inherent.

### What remains of §33

Step 2 alone: the stem decoupled from the barrel, the keyless cluster
re-solved against the plate radius and `LOW_LINKAGE_OBSTACLES` — the
honest option and the bigger one, inheriting the design-priority
order (prove the cluster at P0–P2, then hunt the corridor at P3). The
roadmap entry carries it.

### §33 addendum — the alarm crown joins the handle set

The fifth handle, and structurally the most interesting: the alarm
corner is DIAL-ANCHORED (it never rotated with step 1), its setting
side reaches the CENTRE — rotationally symmetric, free to swing — and
its winding side must still reach the fixed alarm barrel. `?alarmaz=`
(world degrees) overrides `ALARM_LOCAL_AZ`, which was already a solve
(§13 picked dial-local 3 or 9 o'clock, whichever cleared the main stem
better); the spec makes the choice continuous. Everything derives:
the corner cluster, the setting idlers, and the winding run — whose
two idlers were ALWAYS solved (i1 at mesh distance toward the barrel,
i2 by two-circle intersection), so a moved corner re-routes the climb→
barrel chain by construction. Verified at 320°: the crown, climb and
idlers all follow, the movement runs, and the boot asserts name the
consequences.

Fixing one landmine on the way: the climb arbor's station (and both
plates' bores for it) was HARD-CODED at `(ALARM_CD, 0)` — a silent
duplicate of the solve's current answer that would have orphaned the
climb the day the two-candidate choice flipped (a `crownaz` spec near
the corner's own azimuth can flip it). The station now derives from
the corner's azimuth, with the solved branch mapped discretely (no
trig on π) so the identity's exact literals survive bit-for-bit.

The corner's closed-form windows differ from the main crown's: beyond
the mutual crown/pusher arcs, the setting bevel stands AT the sub-dial
wells' centre distance (`ALARM_CD ≡ RESERVE_LOCAL.y`), so each well
projects a forbidden arc — refused live with the numbers ("fouls the
reserve sub-dial's well, needs 47.8°"). And the layering earns its
keep exactly at the boundary: 320° clears the coarse window by 2°,
then boot's finer assert catches the setting idler grazing the seconds
well ring at −0.24 — the closed form is the tripwire, the asserts are
the court, as designed.

### §33 addendum 2 — the pusher joins; the park becomes a derivation

The sixth handle: `?pushaz=` sets the alarm pusher's press-axis azimuth.
The assembly was already built along one direction symbol with its base
offset to the chord circle — the tangent construction that gives the
pawl its drive geometry — and that construction is azimuth-invariant:
the line passes the column wheel at the pawl's offset for ANY azimuth,
the §43 saw-direction assert holds unchanged, and the whole pusher
(stem, cap, pawl, rim boss) follows one spec'd angle. Windows: the
pusher's head against both crowns (each azimuth spec-aware). Measured
at 195°: the pusher re-sites, the movement runs, and the spec closes
CLEAN — zero structural asserts, the first legal non-identity variant
the mode has produced.

The honest work was the PARK. TODO 20 left it a measured-once constant
(1.3557, bisected against the built skirt) — valid only at the azimuth
it was measured at, which a movable pusher retires. The saw's outline
is now EXPORTED from the same function that cuts it (`ratchetPoly`,
the `profileAt` convention), and the park is solved in closed form:
the pawl's leading face is a segment perpendicular to the press axis,
so its kiss is exactly the outermost point of the saw inside the
face's band — vertices in-band plus edge crossings, a maximum, no
sweep. The pawl's hand-off row now reads **0/0 at identity and 0/0 at
195°**: the derivation is better than the measurement it replaced, and
the row asserts it every run at whatever azimuth the spec picks.

(In the same change, the alarm crown's body height matches the main
crown's — 3.4 → 4.55, completing the earlier radius match. The
builder's origin is the knob's inner face, so the growth extends
outward past the rim into free air; the stem interface and bushing are
untouched, which is what the earlier "placement change" scoping worry
turned out to miss.)

### §33 addendum 3 — the trial boot: the court's verdict without the commitment

Live validity's honest ceiling is the solver: the boot asserts judge
what only built geometry shows, and building is reload-tier. The trial
boot packages that court as a button. "Trial boot" loads the candidate
spec in a hidden same-origin iframe with `?trial=1`; the page builds
its REAL geometry, runs its REAL asserts, and the panel reports the
verdict — count, first assert, the rest in the console — while the
session's view, camera and state stay untouched. It is the CI
battery's own pattern (virgin page → read `bootWarns`), ~15 s per
verdict: not "live", but it deletes the apply → look → undo loop for
exploratory dragging.

The one safety that matters is in `state.js`, at the choke point: a
`?trial=1` page NEITHER writes the session's state (an iframe's
fire-and-forget PUT would clobber the real `/__state`) NOR reads it —
trials boot on virgin defaults, the battery's own verdict standard,
which also keeps them deterministic. Verified: the barrel −10°
candidate reports its five asserts by name in the panel with the main
URL untouched; pusher 195° reports "CLOSES — 0 structural asserts";
the session's state file survives both.

## §33 step 2 — the stem decoupled: the keyless cluster re-solves

The last step, and the one §13 called "the honest option and the bigger
one": `?stemaz=` gives the stem line its OWN azimuth, independent of the
barrel, and the keyless cluster re-solves around it while the layout
stays put. The crown handle now proposes THIS (step 1's whole-layout
rotation remains a spec, `?crownaz=`, and composes; the handle just
stopped being its mouthpiece).

### The winding reach, in two regimes

Identity keeps §13's expression verbatim: the crown wheel one spur-mesh
distance outboard of the barrel, colinear on the stem ray — bit-exact.
Decoupled, the barrel leaves the ray and the reach solves in two
regimes. DIRECT (the ray passes within one mesh distance, |Δaz| ≲ 21°
at the shipped radii): the mesh point slides along the ray — the
outboard intersection with the mesh circle, which is exactly what the
identity expression degenerates to at zero offset. IDLER (beyond): the
crown wheel parks at the ray's nearest point to the barrel and an
18-tooth idler bridges by two-circle intersection — the alarm winding
train's own pattern, its count dropping out of the ratio there as
here. The 18 teeth are sized so §13's motivating example ("drag the
crown to 3 o'clock", Δaz ≈ 35°) closes with margin: reach ≈ 13.9
covers Δaz ≤ ~40°. Beyond that, refusal with the numbers — live under
the pointer via the crown handle's solveKeyless shadow, amber at boot,
the battery as always. The idler is built only when the spec parks one
(mesh, arbor, plate bore, and its spin in the winding display chain,
negated once for the extra mesh).

### Verified

Identity bit-exact at the recorded baseline. At `?stemaz=180` — the
motivating example — the cluster re-solves to the 3-o'clock stem, the
idler stands at its solved station, THE CROWN STILL WINDS THE BARREL
through the new chain (measured: reserve banks through the idler), and
the boot names the real costs of the arrangement: the reset-rod elbow
fouling the low corridor, the stop work losing its bearing about the
balance, its mast outgrowing the cock height. At 250° the solve
refuses honestly — "the stem ray points away from the barrel entirely"
— and the movement still boots on fallback geometry with the amber
verdict. The setting side, lever/yoke, and hack chain all re-pose from
the stem frame as §13 built them to; their downstream consequences are
exactly what the verdicts exist to name.

**§33 is complete.** Six handles, live solver validity at two depths,
the trial boot, the spec as a document, and both decoupling operations
(the movement in its case; the stem in the movement). What the
verdicts name from here is layout work, not mode work.
