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
   as debt. (**§89 built half of that split** — a FIXED arbor with the body
   wound at its rim, so the ribbon is the wound state and this paragraph's
   reason no longer holds. The conclusion does, on new grounds: the click
   would still have to hold the toothed body, which is the member the
   spring drives the strike train from. The wound-arbor form is what is
   still filed, now as TODO 37.) Winding banks wind AND un-rides the cam in lockstep (the exact
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

### Correction — the pin's real-world figure was wrong (true-scale chain)

The method survived; the datum didn't. "Real fusee chain runs ~0.30 mm
rivet-to-rivet" turned out to sit in the **width** band of small chains,
not any pitch. The best-documented manufactured reference for this class
of movement — A. Lange & Söhne cal. L044.1 (Richard Lange Pour le
Mérite), a 31.6 mm fusee-and-chain wristwatch movement — runs a chain of
212 links over 152 mm: **0.72 mm pitch, 0.50 mm wide, 0.25 mm thick**.
Antique pocket-watch chains are coarser still (~0.36 mm thick × 0.8 mm
tall sections).

The falsifiability §39 built is exactly what caught it: drawn at true
proportion against the 0.30 mm pin, the chain predicts a **77 mm plate**
— the plate envelope assert fails by 2.4×. The fix re-pins
`CHAIN_PITCH_MM = 0.72` and redraws the chain at `CHAIN_PITCH = 1.9 u`
(the real pitch through §2's independent ~0.38 mm/u by-eye estimate,
0.72 / 0.38 = 1.9), which lands `UNIT_MM` at **0.379** — the two methods
now agree to 0.3%. The chain's cross-section (stack 0.66 u = 0.25 mm,
plate width 1.32 u = 0.50 mm, rivet 0.29·pitch) moved into `layout.js`
beside the pitch, because the fusee's groove pitch, its base seat and
the drum's coil pitch are all derived from the stack — the cone consumes
the chain's stock long before the chain itself is built. Predictions
after the re-pin: plate 32.5 mm, balance 8.2 mm, depth ~9.8 mm — all
still inside the envelopes, none tuned to be.

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

### §33 addendum 3 — the pusher grips the MODULE; `?pushaz=` is retired

Addendum 2 gave the pusher its own press-axis spec, and the owner's
first real drag with it exposed the design error: the pusher slid to
45.8° and its stem, cap and pawl went with it — while the column, saw
and lock they exist to drive stayed at the corner. The handle had
manufactured a P2 self-disagreement inside the arming group and called
it a feature. The pusher is the module's GRIP, not its own part.

So `?pushaz=` is retired and the pusher handle now proposes
`?alarmmod=`: the azimuth of the whole alarm work, named by its seed —
the striking wheel's station, identity 160°. The complex is one action
group positionally (the cam lifts the hammer tail, the hammer strikes
the gong, the lock banks on the wheel, the column stands off the lock,
the pawl and pusher stand off the column), so ONE delta added to four
seed angle literals rotates all of it: the gong's free end (135°), the
striking wheel (160°), the lock pivot's outboard bearing (160°), and
the barrel's bearing off the striker (−60°). Everything else was
already derived from those, which is what all the registration-solve
work was for. Identity adds exactly 0.0 to each literal — bit-exact
without a branch, since these are pure angle sums, not rotations
through cos/sin. The press axis itself reverts to its identity
derivation, the column wheel's own station, so it can never leave the
toggle chain behind again.

What does NOT rotate: the selector rod (az 210° is a §35 corridor
solution against world-frame obstacles — the beak's long tail
re-derives to reach it), the alarm crown corner (`?alarmaz=`, its
winding run re-solving to the moved barrel by the same two-circle
construction), and the centre setting work.

**The discovery the feature forced: the column is read twice, and the
second reader is world-anchored.** The link beak reads the same
castellations as the lock beak, from the rod's direction — so rotating
the module swings the wheel around a fixed reader, and the offset
between the two reads is GEOMETRY, not the 120° literal the animation
law carried. Measured, the literal was idealizing even at identity:
the built nose centre sits 5.7° off the top's edge in profile space,
and the contact closes because the nose's 0.35 footprint spans ±3.5°
at its radius. That fact is now code: the offset derives from the
built directions (snapping to the nearest column centre — the same
idealization the literal encoded, now earned), and a footprint-credited
parity check against the wheel's own `profileAt` law — full material
under some of the box disarmed, the whole box free armed — runs at
boot AND lives in the pusher handle's drag shadow, which names the
nearest readable azimuths under the pointer. The consequence is real
horology: with one wheel and two readers, the module is only
re-placeable at DISCRETE azimuths, roughly a castellation apart.

Also collected: the click-phase tripwire measured its integer-pitch
claim as a raw modulus, which held only while `(ENGAGED + 2·pitch) −
ENGAGED` rounded back exactly — a rotated ENGAGED landed the residue at
pitch − ε and reported a phantom full-pitch disagreement made of one
ulp. It now measures distance to the NEAREST integer pitch.

**Verified.** Identity bit-exact at the recorded baseline, boot silent.
At `?alarmmod=227` (a clean azimuth, 67° from home): boot silent, the
alarm armed, and ALL SIX hand-offs of the §35 arming run measure shut —
the entire module moved and the mechanism went with it. At
`?alarmmod=200` (mid-flank): the specific refusal at boot, the same
warning live under the pointer mid-drag, and the movement still boots
and runs under the amber verdict.

## §60. Life size — render 32 mm as 32 mm, and let it be seen

Reported: zooming out far enough to see the watch at life size pushes it so
deep into the fog that it cannot be seen. That is **three limits, not one**,
and the fog is only the one you can see — `controls.maxDistance` blocks the
pose, and `camera.far` clips it.

### The distance is derived, not the 827 the entry measured

For a perspective camera the world height at distance *d* is
`2·d·tan(fov/2)`, so `px per unit = viewportPx / (2 d tan(fov/2))` and life
size is where that times the display's pitch equals `UNIT_MM`:

> **d = screenHeightMM / (2 · UNIT_MM · tan(fov/2))**

Two honest inputs — the display's pixel pitch and the live viewport — and
everything else follows. The FOV lever was checked and rejected first: at
the default distance life size needs **fov 122.8°**, a fisheye that would
distort the movement far worse than fog was hiding it.

### The honesty problem is the actual work

A browser cannot measure the display it draws on. The CSS reference pixel
is **defined** as 1/96 inch and is wrong on most panels once OS scaling is
involved, so an uncalibrated "life size" would be a label asserting a
measurement nobody made — exactly what §21 refused when it would not draw a
clamped coin against a real diameter.

So the mode says **NOMINAL** and says why, until calibrated against a
manufactured standard: the viewer sizes an outline to an **ISO/IEC 7810
ID-1 card (85.60 mm)**, which *gives* the true pitch. Same move §39 made
pinning `UNIT_MM` to real chain pitch. Persisted through `state.js`, asked
once. Absent, `null` or `NaN` all read as *not calibrated* — never guessed.

### Verified with §21's own ruler, not a second one

Measuring the plate's span along **world X** first gave ratio 0.947 — and
that was the *measurement* being wrong, not the pose: an angled camera
foreshortens it, §21's exact lesson. Measured properly, one unit along the
camera's **own screen-right axis** at the target's depth:

| | |
|---|---|
| camera distance | 917.18 (predicted 917.18) |
| mm on screen per unit | **0.375000** |
| `UNIT_MM` | 0.375 |
| ratio | **1.0000** |
| plate on screen | **32.19 mm** vs true 32.19 mm |
| fraction of viewport height | 11.6% |

### The three limits, suspended for the mode only

Fog pushed to 4×/8× the pose distance, `maxDistance` to 1.25×, `camera.far`
to 1.6× — all restored on leaving, because the normal view wants its fog:
it is a depth cue tuned for the working range, and at life size the whole
movement sits at essentially one depth where fog is only a grey wash.

Re-solves on `resize`, or the claim silently stops being true the moment
someone drags a window edge. A pose with a deep link (`?lifesize=1`) rather
than a free-orbit state, per §37. And the caption says out loud that it
will look small — a viewer who expected a zoom control and got a small
watch would read the answer as a bug.

### The remainder ships — "let it be visible" becomes true everywhere

The entry's remaining half was the report itself: arriving at the
life-size distance BY HAND still hit all three limits — the fixed
`Fog(180, 420)` buried the watch past ~400, `camera.far` (plateR·20)
clipped its far side at the ~820 pose, and `controls.maxDistance`
(plateR·12 ≈ 515) refused the distance outright. The mode dodged them
by suspending and restoring all three; navigation did not.

What shipped is simpler than the planned "per-mode fog/far/maxDistance
handling": the limits became GLOBAL functions of the camera, and the
mode lost its special cases instead of gaining more. The fixed fog band
never touched the movement at the working ~100 u standoff — it began
180−100 ≈ 1.9·plateR past the camera and ended 420−100 ≈ 7.5·plateR
past it. Those ratios ARE the depth-cue design, so `updateDepthLimits`
(run each frame after `controls.update`) carries them at every
distance: fog.near/far = camera-to-target distance + the two pads, and
the far plane holds its precision-tuned plateR·20 floor, extending with
1% hysteresis only when a pose needs the room. The clamp solves
`max(plateR·12, lifeSizeDistance()·1.25)` live (re-run on resize, since
the life-size distance depends on the viewport). `setLifeSize` shrank
to what only the mode can do — the derived pose and the honest caption —
and the save/push/restore state (`lifeSizeSaved`) is gone.

Verified: manual pose at 911 u (1400×1000 viewport) renders the
movement clear — fog band solved to 993→1233, far plane 1233 — and the
default working views are visually unchanged, which is the pad
derivation doing exactly what it was pinned to do. One knock-on comment
made honest: `SND_FAR` still equals plateR·12, but that is now the
clamp's FLOOR, not its value — a watch heard from life-size distance
fading below the −25 dB solve is correct behaviour, stated at the
constant.
## §53. Advanced Settings labels — authored, stacked, wrapping

Reported: under Finishing → Advanced Settings almost every label was
truncated. The controls worked; you could not tell what they did.

The entry predicted the shape and it was right on both counts. The name
was **derived from the schema key path** (`hands.second.counterweightOffsetFactor`),
verbose by construction; and the row put it *beside* its control in a
240 px panel under `text-overflow: ellipsis`. Two defects meeting.

**Both are fixed, because either alone is insufficient.** Short authored
names still truncate the first time one is long; stacking alone leaves 63
readable-but-ugly key paths.

1. **Authored in the schema.** `_labels` sits beside `_bounds` on the
   containing object — the same convention — so the display name lives in
   `aesthetics.json` with the value, per §23's single-source principle.
   All **63** controls are covered, asserted at generation time: a leaf
   with no `_labels` entry falls back to its key path *and warns by name*,
   so a future control cannot be added silently unlabelled.
2. **Stacked and wrapping.** `.adv-row` overrides the shared flex `.row`
   inside Advanced only, rather than restyling every row in the app. No
   `max-width`, no ellipsis — those two were the truncation — and the
   control goes full width beneath its name.

The key path stays as the `title`, but nothing *depends* on it: a tooltip
does not exist on touch, and §15 exists because this panel must work on a
phone. The panel was not widened either — that would trade a §23 defect
for a §15 regression.

**Verified at 375 × 667** (the phone case, not the desktop one): 63
controls, **0 clipped**, and the entry's own acceptance test — a
deliberately long label — **wraps to 3 lines** instead of truncating.

**One trap worth recording.** The stylesheet is a template literal, and
the first version of this CSS carried a comment mentioning the `.row`
class *in backticks*. That silently ended the string. `node --check`
stayed happy, because what remained was still valid JavaScript — just not
this CSS — and the failure surfaced only as a `TypeError` at boot. Syntax
checking cannot see a string that ends early and leaves something valid
behind it.

## §36 part three — routing as a spec

§35's corridor hunt was done **by hand**: two shafts, one knuckle, four
ray-proved bush stations, and a great deal of probing to establish that a
rod could get from the column wheel to the selector ring without hitting
anything. That hunt is what this automates — the drawn path becomes the
**spec** and the parts are solved from it.

### The rule that makes it routing and not collision testing

- **Structural metal is drillable.** A plate, a bridge, a pillar — a route
  through one is legal, because a bore gets drilled. §35 did exactly that:
  the selector rod passes a bore through *both* plates.
- **A swept volume is refused.** Anything a moving part can reach is not
  negotiable: there is nothing to drill, because the space is occupied in
  time rather than in matter.

The registry already drew that line and did not know it — `static` is a
part that never moves, `revolve`/`path` are the swept ones — so the routing
question is answerable from §36's own output with **no new sampling**. That
is why this is a §36 part and not its own entry.

Refusal is **per-segment and names the volume**, inheriting §33's
refused/warned/proposed vocabulary: a route that cannot be built says which
leg is impossible and what occupies it.

### Two findings that only appeared on running it

**1. The linkage being routed was blocking itself.** §35's real corridor
came back REFUSED, and every volume named was the alarm link's own — the
rod objecting to the space the rod occupies. Re-routing an existing linkage
means asking whether the space would be free *once it is lifted out*, so
`exclude` is not a convenience, it is what makes the check usable for the
only thing it is for.

**2. Structural metal was invisible.** A `static` volume stored only its
z band, so "through structural metal is fine" was **vacuously** true — the
check could not see a plate at all, and reported no bores. Static parts now
carry a `box` as well, which is *exact* rather than a hull because the part
does not move. 172 static volumes gained one.

### Verified against §35, both directions

| control | result |
|---|---|
| §35's real route, excluding itself | **legal**, 0 refused legs |
| …its reported bores | `Three-quarter plate/threeQuarterPlate` |
| the same route **without** `exclude` | refused — by its own parts (so the exclude is load-bearing) |
| a route driven through the balance | refused: *"leg 1 enters Pallet fork, Balance — swept volume, nothing to drill"* |

**Synthesis on the legal route: 2 arbors (16.15 u, 15.42 u), 1 knuckle,
3 bush stations.** §35 by hand was two shafts, one knuckle, four bush
stations — so shafts and knuckle reproduce exactly, and the station count
is one short. That is honest rather than matched: the polyline used here is
a 3-point simplification of §35's actual run, and stations are merged per
clear stretch, so 3 is an under-count of a coarser path rather than a
disagreement with §35.

### The sketch surface

A **Route → Sketch** mode beside the reconfigure rows, in §33's grammar
throughout: candidates are proposed / warned / refused, a refusal names
what it hit, ghosts are scene furniture and never units.

**The commit rule: a refused leg cannot be placed.** The click is rejected
with the occupant named in the row — so a committed polyline is legal *by
construction*, and Solve never has to un-refuse anything. Structural metal
is the amber middle state: the leg commits, labelled with the bore it
implies.

**A 3D route with a 2D pointer**: points land on a depth plane a slider
sets. Click at one depth, move the slider, click again — §35's rod (same
x, y, two depths) is two clicks. The pending leg re-judges on every
pointer move *and every slider change*, since depth changes what you hit.
Click-not-drag placement (a pointer that moves >5 px is an orbit), Escape
exits, and changing the re-route selector **clears the sketch** — the
committed legs were judged under the old exclusion, and keeping them
would keep verdicts that are no longer true.

The registry builds once per session on first entry, which is sound
because geometry only changes through §33's Apply, which reloads. The
live leg-judge is a synchronous twin of `checkRoute`'s sampler — same
step, same clearance, same occupant query — so the preview and the
committed verdict cannot disagree.

**Verified end to end by driving the real controls** (synthetic pointer
events on the canvas, world→screen projected): a first point placed, a
free-air leg committed as *"leg 1 clear"*, and a leg aimed into the train
refused as *"refused: leg enters Center wheel — swept volume, nothing to
drill"* with the click rejected. Solve on the legal polyline: *"1 arbor ·
0 knuckles · 1 bush station — a spec, drawn as ghosts"*, and the scene
graph agrees exactly — 2 dots, 1 committed leg, 1 ghost arbor, 1 bush
ring, 1 pending line.

**Still not built: Apply.** The ghosts are a spec. Turning a solved route
into real parts — `MECH_GRAPH` entries, bores actually drilled through the
plates it names, stock-floored sections — is Apply-shaped work in §33's
sense, and it is where this connects to the standing design-priority rule:
a routed linkage's lever ratios are still P1's business, not the router's.

## §61. True groove seating — the chain rides the cone, it does not sink into it

**Where this came from.** §39's true-scale chain kept the shipped seating
convention: the chain's centreline rode `fuseeGrooveAt(f).r` on the cone
and `DRUM_R` on the drum wall, burying half the (now 1.32 u wide) link in
the parent surface — excused by the two EXPECTED pairs, which is exactly
the per-pair blind spot TODO 6 documents, on top of TODO 4's missing
budgets. The old cone's "groove" was a proud wire ridge whose comment
claimed a channel "comfortably wider than the chain's diameter"; measured,
the channel was ~0.19 against a 0.66 stack, and the wrap's delivered
axial pitch (0.88·H·0.94/3.75 ≈ 0.65) was LESS than the stack — successive
wraps interpenetrated. Every gate was green while all of it was wrong.

### The cone: cut the groove, and the correction vanishes

The planned fix was to offset the wrap radii by the plate half-width and
carry an effective-radius correction into the torque equalisation. What
shipped is better, and is what a real fusee is: the groove is CUT into
the cone, exactly one plate half-width deep (`FUSEE_GROOVE_D =
CHAIN_END_R_OUT`). The chain's inner edge rides the groove floor, its
centreline lies ON the land-crest envelope — so the envelope constants
(`FUSEE_R_SMALL/LARGE`), the S(t)·r_f(t) equalisation, and
`CHAIN_ENGAGED` were already the centreline numbers and needed no
correction at all. `makeFusee` now lathes the core at the groove floor
and lays the land as a helical crest ribbon between wraps (grooveTurns
grooves ⇒ grooveTurns−1 lands; the first cut of the ribbon ran a half
pitch past the tip and the plate-floor boot assert caught it).

### The pitch: derived from the movement's z budget, land as the slack

The honest wrap pitch cannot be declared — it has to FIT. The groove band
is wedged between the center wheel (the lowest wrap's underside clears
its top face by the margin) and the hairspring stack (the plate floor's
binding member; the tip may not outgrow it). What those two binds afford,
divided by `FUSEE_GROOVE_TURNS`, is the pitch (0.695 at the 30 h
default); pitch minus the groove's own width (stack + 0.01 seating
clearance) is the LAND — 0.025, the movement's axial slack made visible,
with a 0.02 floor and a boot warn as §22's honest cost report when a
longer reserve thins it. The wrap's delivered pitch equals the groove
pitch by construction now: the active fraction is
`FUSEE_WRAP_TURNS / FUSEE_GROOVE_TURNS` (0.9375), not a hand-rounded
0.94, and the band is `GROOVE_TURNS` exact pitches. Growing H past the
old 2.96 was NOT the answer: the maintaining sandwich below re-solves off
the cone's base (§39), and the band-wedge derivation actually lands H at
≈ 2.95 with the sandwich stock back at its 0.455 ceiling-adjacent value.

### The drum: the +half-width is real and reaches the feed

On the drum there is no groove to cut, so the offset is genuine:
`DRUM_WRAP_R = DRUM_R + CHAIN_END_R_OUT` is the coil's centreline radius
(inner edge kissing the wall) AND the feed radius — one drum turn pays
out 2π·DRUM_WRAP_R of chain, so `drumGroup.rotation.z`, the takeoff
turn-count solve and the `HOOK_A` congruence all read it. The tangent
solve reads it on the drum side and the envelope on the cone side; the
hook's claw already stood at exactly this standoff, so the end link now
arrives without a radial jog.

### Then measure it — the TODO 4 rows, and why they are not MTV

Two `PENETRATION_BUDGETS` rows on the `reserve` axis close TODO 4 for
this pair family — but not with `mtvDepth`. The chain ENCIRCLES both
parents, and no translation separates a ring from what it wraps: the
first MTV attempt reported 1.2 (cone) and 1.6 (drum), numbers about the
direction-search's escape space, not the fit. The rows instead carry a
bespoke `measure` (the budget machinery grew a per-row hook): every
chain vertex AND triangle centroid — the deepest point of a chording
link is mid-edge, which vertices never visit — is checked for radial
burial below the ANALYTIC surface the parent was built from, in the
parent's own frame: `envelope(f(z)) − grooveD` on the cone (read from
the same `userData.groove` the lathe consumed, so geometry and
instrument cannot drift apart), the wall cylinder on the drum.

Budgets derived: the drum is chording alone plus tessellation slack —
1.9²/(8·10.66) + 0.03 → **0.08**. The cone has a third, dominant term:
the 4-leaf stack is a rigid VERTICAL band on a floor that follows the
cone's slope, so it contacts at its lower corner, which sits
slope·stack/2 = (4.8/2.78)·0.33 = 0.57 below the floor at its own z;
plus chording at the smallest wrap radius (0.16) and the slack → 0.76,
held at **0.8**. Measured: cone 0.67, drum 0.06.

The drum row earned its keep before it ever gated anything: its first
honest run read 0.139, and the excess was two real display defects, not
budget pessimism — the coil's last control point COINCIDED with the claw
point once the claw stood at the wrap radius (a degenerate Catmull-Rom
tangent wobbling the end links into the wall), and the coil's 14
points-per-turn let the interpolant sag measurably on a circle whose
whole budget is 0.08. The coil now stops a short arc before the hook and
runs 32 points per turn.

**Not done, deliberately.** The radial measure is registration-FREE — a
pure function of z — because the wrap's rotational phase against the
cone's spiral cannot be asserted: the chain is display-only (TODO 1/7),
and `setPose` sets `tension` and `windAccumTurns` independently, so no
pose-time phase relation exists to check. Groove-vs-land axial
registration (and the corner-on-slope term a locally square-cut spiral
thread would eliminate) therefore stays open with the chain's
torque-coupling debt. Also unbuilt: link-level articulation (the chain
stays one baked mesh, so the claw still transfixes the end link rather
than passing through a hole); a cut-thread taper on the land crest
(rectangular section, P4); and the cone's absolute radii — a real fusee
of this movement's class is fatter at the small end than our 2.6 u,
which is why the chording term is as large as it is. Those radii are
§22/§13 layout material if anyone wants them.

## §63. Setting preview in the HUD — hands you can read from the back

**The need.** Setting is a crown interaction; the crowns live on the
movement side; the dial is therefore off screen at exactly the moment
its hands matter. §57's HUD reaches the *controls* from any framing —
this makes the *result* readable: while a setting path is engaged, the
HUD's ring previews the hour, minute and alarm hands.

**§57's scope guard held.** "Only the controls are drawn" stays true at
rest: the hands and a minimal 12-tick reference ring carry their
opacity from the SAME eased pulls the crown heads already ride
(`crownPullT` for hour/minute, `alarmCrownPullT` for the alarm hand),
so they fade in and out with the physical stem. The preview is
pointer-transparent and drawn under the hit circles — every §57
gesture lands exactly as before. The boot wall-clock sync, which pulls
the crown by machinery, summons the preview too; that fell out of
reading the eased state rather than the button, and it is correct — the
watch IS setting.

**Stronger than the plan: the readouts were already unified.** The
entry required consuming "the same derived angles the dial meshes
consume." The build found the project had already distilled those into
two accessors, each carrying its own Rule 2 provenance in a comment:
`displayedSeconds()` — "what the HANDS read," the same
`handSetOffset` tick gives the hands, jumper snap included — and
`alarmDiscAngle()` — §25 C's through-the-train set angle, "the same
quantity the trip reads," which the panel's ≈alarm readout already
consumes. The preview draws those two numbers as a front-view clock
and derives nothing else. The hour hand's 12:1 against
`displayedSeconds` is the motion works' tooth counts by construction,
leaned on the same way the panel's hh:mm already leans on it.

**The Y-flip trap dissolved instead of being survived.** The entry
named the dial-side mirror as the central hazard, expecting mesh
rotations to be mapped through it. By consuming time-of-day readouts
rather than mesh angles, no rotation crosses the flip at all — the
handedness question reduces to "draw a clock": 12 up, clockwise
positive, which SVG's y-down `rotate()` gives directly. Verified both
ways regardless: dial and HUD agree on screen through a hand-set
(1:11 → 1:26, hour and minute both), and the alarm hand's transform
(`rotate(90)`) was probed against the panel readout (≈3:00) in the
same frame — after a zoomed screenshot briefly misread the dashed
hand's short tail as a 9:00 mirror, which is its own small §60-shadow
lesson in trusting instruments over squinting.

**Verified.** Boot sync shows the preview during its scripted pull and
clears it after; crown pulled → hands appear and track the dial
through setting; crown home → time hands fade while the still-out
alarm crown keeps its hand; zero page errors; full battery green with
the geometry fingerprint untouched (DOM/SVG only).

## §20. Screw slots everywhere — one screw vocabulary, merged

**Goal, met.** Screws look like screws: every screw in the movement is
now the same object — a blued tapered head with a dark slot sunk across
it — built by one shared `makeScrews` (geometry.js), whose template was
`makeChaton`'s screw loop, exactly as the entry predicted.

**The §14 warning was real and shaped the builder.** "Each screw is two
more meshes" — and §41's crown work had already measured draw calls as
the render cost that matters (69 for one knurl). So `makeScrews` MERGES:
N screws cost two draw calls (one heads mesh, one slots mesh), not 2N.
The chatons, refactored onto the shared builder with identical
dimensions, each dropped from 6 meshes to 2 — the entry's cost worry
ended up making the movement cheaper to draw than before the feature.

**Call sites.**

- `makeChaton` — the template, now a consumer; geometry unchanged.
- Balance cock T-foot screws — were bare cylinders (TODO 12's "head
  proud of the foot" note rides along); now slotted, same head radius
  and seat, slot azimuth = each foot's bearing from the cock origin (the
  derived stand-in for assembly scatter).
- Escape-bridge (fork cock) foot screws — the §-era fix gave them heads
  ("visually unfastened"), but with nothing to turn; now slotted.
- **The plate screws, which did not exist**: the three-quarter plate has
  rested on its pillars since the pillars existed with nothing visibly
  holding it down. One screw per solved pillar seat (all four found at
  boot), on the plate's top face, head FLUSH with the face — the chaton
  convention, because the hack blade passes 0.18 over that face and
  nothing may stand above it. Head radius derived from the pillar's own
  widest land (capR·0.6, the bridge's head-to-seat proportion): the head
  must bear on the land it clamps, not overhang it.

**Deliberately not slotted:** the stud carrier's side pin screw
(`studPinScrew`) — its head face is ~0.1 mm; a slot there is sub-texel
at any legible zoom. Declared (TODO 12's triage note) and left. The
balance's 16 timing screws keep their headless functional form.

**Verified.** Numeric probe per site: cock 2 heads + 2 slots merged,
slots sunk 0.03 below the head tops; plate 4 heads flush at z 8.508
against the 8.51 face; bridge 1 + 1 sunk. Boot silent; battery run on
the landed tree.

## §45. The alarm hand is visible to set, and setting cannot ring — complete

**Scope shipped, both stages.** Stage 1 (the release): pulling the
alarm crown RELEASES the alarm tube from its hour coupling, so the §25 C
friction train turns it live and the hand SWEEPS while being set — in
both arm states — and re-seats by evaluation when the crown goes home.
`Hidden ⟺ ¬Armed ∧ ¬Setting` is asserted at boot as the biconditional
(all four corners, evaluated on the mechanism's own laws), not as the
three implications that would pass a permanently-visible hand. Stage 2
(the silence): with the crown pulled, the coincidence CANNOT trip the
release — silence enforced at the detection — and pulling mid-ring
arrests the train. The stage-2 record is at the end of this section.

**The mechanism.** The build correction that reshaped this section: the
selector chain is positively located end to end (TODO 19/20), so the
"trivial OR" the entry first imagined had nowhere to press — the ONLY
compliance in the whole hider is the heart-cam followers themselves.
Stage 1 therefore lifts follower A:

- **Tail pin** (`alarmTailPin`) — an axial ruby pin 0.45 past the arm's
  pivot (post radius + boss + web: the shortest tail that exists, since
  the pin's radial stroke grows with tail length), hanging plate-ward
  into a band that did not exist before this build.
- **Cam sleeve** (`Alarm release sleeve`) — a static guided ring below
  the heart/arm band: flat annulus at floor stock, 45° cone skirt whose
  face presses the pin inward at ANY tube azimuth as the sleeve rises
  `ALARM_SLEEVE_TRAVEL`; three dial posts (az 105/250/345, the §34
  selector's pattern one band deeper); a tab the lifter grips.
- **Lifter** (`Alarm release lifter`) — one rigid L from the stem to the
  tab: a bevel COLLAR on the sliding alarm stem (the keyless
  sliding-pinion idiom; the pull's 5-unit throw becomes the 0.22 sleeve
  travel as a 0.044 machined taper, not a tick() coefficient), a domed
  head under it, plunger, tangential chord az 0 → 8°, radial run at the
  tab's plane guided by a mid-cheek bracket at r 14, fork plates at the
  TODO 20 working clearance. Return is a real blade (`SPRING_FLAT_U`)
  re-seating the head — the §29 feeler's blade-onto-cam idiom — and the
  arm spring's reflection through the cone agrees. The input station
  lives OUTBOARD of the setting-corner cluster at both crown extremes
  (head r 27.8, collar tip parked one margin past the bearing-cock post
  even at rest): the first siting put the head at r 21.5 inside the disc
  bevel's reach, the sweep confirmed the transfixion, and the fix was
  position-space only — a P3 resolution, the mechanism untouched.

The tube law reads the MEMBER, not a flag: the cone's radius at the pin's
plane caps the follower's angle (`alarmPhiCapNow`, the B-side `max()`
pattern on the A side), and "released" is that cap standing above the
heart's whole profile. Re-engagement EVALUATES by construction — the max
eases back to the cam solve; nothing is latched or replayed.

**Stage 0 — the band, bought the §51 way.** No full-circle annulus
existed (the flange→heart and heart→feeler gaps were each exactly one
CLEAR_MARGIN — §51's own thinning). The chain block now owns the follower
kinematics and prices the swing: release angle at nose orbit
R + noseR + 0.05 (follower-B's lift-clearance figure), pin stroke 0.186,
envelope = stock + skirt (stroke + 0.03 first-touch) + travel (stroke +
0.05 rest gap) = 0.742. `Z_DIAL` −7.5 → −8.40 funds it exactly (spend
0.8915 rounded up to the 0.01 grid; agreement tripwired at boot), so
every member below the insertion kept its solved world plane and the
plate-side landing never moved. `CANNON_T`'s fifth growth (+0.90) and one
stale-absolute anchor tol (now riding `Z_DIAL`) were the whole blast
radius — measured by making the spend ALONE first, §51 phase B's own
discipline.

**Two latent defects found by the arithmetic, fixed in the same build.**
Both invisible to the battery behind the Alarm disc ⇄ Hour wheel
EXPECTED blanket (TODO item 6's class):

- The straight follower bar could NEVER clear the heart — the bar's
  perpendicular foot lands mid-span at `PR·sinφ`, under `R + halfWidth`
  for every reachable φ; measured 0.108 deep into the lobe during
  today's riding cycle. The bar is now BOWED +0.10 outward over the
  foot's range (full width kept — necking would thin the lever to
  0.06 mm), verified by a boot-time flank sweep across both the riding
  cycle (phase-locked) and the released free phase.
- The heart's lobe (R 3.55) swept INSIDE the old pivot post's inner edge
  (3.46) whenever armed. `ALARM_PIVOT_R` is now DERIVED as
  lobe + post r + working (3.80); the post seats 0.03 inside the flange
  rim.

**Instruments.** Three graph edges (crown→lifter→sleeve→disc), two
support edges, six EXPECTED rows; a third `alarmHandoffs` pose
(`setting`: crown pulled) and three new rows — collar⇄head and fork⇄tab
contact at every parity, cone⇄pin FREE at both crown-in parities
(riding must not feel the sleeve) and contact at setting; §45 fit
asserts at both travel extremes; the flank sweep; the biconditional.
Every new part built to its §50 floor — zero new waivers (61→60: the
bow retired the old bar's co-planarity slack, so its TODO 11 stock row
closed on merit; the tail pin's ⌀ is cut so the 10-gon's FLATS measure
the 0.07 mm pivot floor).

**Verified.** Boot silent; support/graph/penetration/stockFloor/
alarmHandoffs (9 rows, 0 waived) green through the build; full battery
on the landed tree. Functional: pose probes measure the pull sweeping
the tube from `mwHourA` to `−alarmAngle` with the arm capped at exactly
the release angle, and the push-in re-seating everything to the seated
triangle to 4 decimals.

### Stage 2 — the silence rocker

**Where the hold lives, and why.** The entry said "hold the strike
lock"; the lock lever lives at world z +8.83 by the column wheel, the
alarm stem at −4.1 — a 13-unit cross-movement corridor nobody should
build for a hold. The honest press point is the RELEASE FEELER, three
units from the lifter's run: hold the feeler's pin off its track and the
release never happens. Silence at the detection, and pulling mid-ring
physically lifts the pin out of the notch.

**The mechanism.** A seesaw (`Alarm silence rocker`) on a dial bracket:
its PADDLE rides the underside of the lifter's run at az 8° (blade-
biased, so it tracks the run at every parity), its FINGER descends onto
the feeler's TAIL from above at the release azimuth. The tail RISES when
the pin drops (the §29 banking stop's own geometry), so a finger whose
stroke ends exactly at the tail's rest height captures it: no rise, no
drop, no trip. A risen tail (mid-ring) is met early in the stroke and
pressed back to riding — the pin leaves the notch. The throw is EXACTLY
the rest gap, asserted: the first cut carried a "press-back + capture
bite" allowance and measurably buried the finger 0.055 deep in a tail
that had no rise to give back. The finger's radius is the one free slot
on the tail — mid-window between the bracket lugs' outer reach and the
spring stud's inner face, both margins exact, asserted. The lever ratio
(finger/paddle arms) is DESIGNED from throw ÷ lifter travel, not
inherited from routing.

**Why the hold arrests a running train when the natural pin-return does
not.** The release pawl is one-way (the climb's long-ramp/steep-bank
saw). Spring-seated, the running contrate cams it out ramp by ramp — it
ratchets, and a ring runs down, which is the shipped run-down story.
Held, the pawl is seated through the lever's LOCATED geometry; a ramp
cannot cam out a located member, and the train is caught on the next
tooth: arrested, not paused.

**The laws read members.** `alarmPinDropPhys` = min(the disc's law, the
rocker's cap), computed in the strike section from the same pure chain
the pose block re-derives (collar → lifter → rocker — the §29 this-tick
discipline), and it drives the trip gate, the one-shot re-arm, the
lever's pose and the pawl's seat. A held pin re-arms the one-shot, so
releasing the hold onto a still-present coincidence is a FRESH
mechanical drop and fires — re-engagement evaluates, nothing replayed.

**Verified.** Measured end to end at the poses: the armed sweep crosses
the coincidence with the crown pulled and nothing releases; push-in at
the coincidence rings; the ring spends the barrel; pulling mid-ring
arrests with ZERO further spend; pushing back at the still-present
coincidence re-fires. Two new hand-off rows (paddle: contact at every
parity; finger: free at both crown-in parities, contact at setting),
zero new stock waivers, full battery clean on the landed tree.

## §65 — The mechanism explainer, in the movement's own dress

**What.** `explain.html` at the repo root — a maintained companion page,
one entry per significant mechanism, linked from the HUD's View section
(`Mechanisms → How they work`). Served by the same dev server as the
sim; no build step, no dependencies, one file.

**Why a page and not the README.** The sim's owner reads the movement
through the sim; an explainer that lives beside it, in its visual
language, gets read. The page borrows the two HUD idioms verbatim: the
panel chrome (glass `rgba(15,17,20,0.72)` + blur, hairline borders,
uppercase spaced `#8fa6bf` section heads, §15's `<details>` disclosure
per mechanism) and the §49 scale view's dimension voice (`ui-monospace`
values, drawing-style leader lines and dimension ticks in the plates).
Single dark theme, deliberately — the sim is.

**The honesty contract, extended to prose.** Full entries carry
numbered PLATES (SVG figures) whose every number is the real constant
from `src/*.js`, with the constraint it was derived from — rule 1
applied to documentation. Entries also carry the mechanism's OPEN debt
(the motion-works entry names TODO 21 rather than hiding it): the page
tells the same truth the battery does. The footer states the priority:
if the page and the source disagree, the source is right and the page
has a bug.

**Shipped entries.** Fusee & chain, Swiss lever escapement, motion
works & minute jumper, keyless works (compact prose seeds); the alarm
release feeler (full: plan view, an interactive section driven by the
real `alarmPinDropNow` trapezoid law with the §45 silence cap, the
release chain, the crown→collar→lifter→rocker→tail silence linkage,
and the constants table); the alarm train end-to-end (compact).

**Maintenance rule.** When a significant mechanism ships or changes,
its entry is added or refreshed in the same landing — CLAUDE.md carries
the rule. Compact entries grow plates when their mechanisms get worked
on; a stale explainer is the documentation version of the abandoned
plan CLAUDE.md already forbids.

## §66 part one — The schematic tier: draw the model, not the metal

**Shipped in part** (the §10/§36 convention): the line tier and its
rotor proxies are built; contact-dot lighting from the instrument
tables and lever/spring proxies stay in the roadmap as parts two.

**What shipped.** A parallel non-Mesh line tier in the §65 explainer's
vocabulary: every rotor whose builder records its pitch/functional
radius (`userData.r` — the gear, pinion, and balance builders all do,
`geometry.js`) gets a brass `Line` circle at exactly that radius plus
one steel spoke, attached to the rotor's own posed group. The tick's
ratio laws move the proxies for free, so in schematic mode the train
visibly rolls at ratios that come from tooth counts alone — 130
proxies over 65 rotors on the shipped movement, built in one generic
traverse with no per-unit authoring.

**Two structural choices carry the honesty.** (1) Line-tier only, by
construction AND assertion: the inspectors collect `isMesh`, so
proxies are invisible to every battery instrument — asserted at boot
(a proxy that drifted into being a Mesh would silently join the
sweeps), and the full battery ran byte-identical after the tier
landed. (2) The mode swaps by CAMERA LAYER (proxies live on layer 1),
never by touching `mesh.visible` — parts whose visibility is a tick
law (the §45 alarm hand) keep their state, and their proxies inherit
it through group visibility, so toggling round-trips with no state
loss.

**Why radii and not dressed wheels.** The tick laws never consult a
tooth; a wheel IS its pitch radius and ratio as far as the model is
concerned, and the §65 plates already proved that vocabulary explains
the movement better than the metal does. Two renderings of one model
cannot drift when both consume the same constants — §49's one-display
principle at movement scale.

## §66 part two — Levers, springs, and contact dots the instruments light

**Completes §66** (part one above); the roadmap entry is retired and
this record is its reconciliation.

**Levers.** Pivot-to-contact lines attached to the moving groups the
tick already poses — the §29 feeler (tail → pivot → pin arm, with the
pin's drop leg), the §45 silence seesaw (finger arm ← pivot → paddle
arm, spans from the rocker's own userData), the §43 click, the §25 D
lock lever. Each span quotes the constant that built the solid it
abstracts; nothing is measured off the meshes.

**Springs.** Every §48-named blade/spring mesh (matched by the naming
convention) carries a ruby zigzag derived from its own bounding box —
longest local axis, amplitude from the cross axis — so spring symbols
needed no per-part authoring either.

**Contact dots — the instrument lights them.** inspect.js gained
`measureHandoffsNow`: the SAME `ALARM_HANDOFFS` rows the battery
gates, measured at the CURRENT pose (no setPose, no resetInputs — a
live display, not a gate), returning each row's gap and the closest
sample pair's midpoint. The schematic tier places one dot per row at
that point, lit when |gap| ≤ the row's own tol — no parallel boolean
anywhere, which was the entry's acceptance. inspect.js loads lazily on
first mode entry, so boot is untouched; dots re-measure on each mode
ENTRY, and live re-measure across pose changes is the recorded
residue.

**Verified.** 152 line proxies + 11 dots, zero Mesh proxies, boot
silent; the battery ran with the fingerprint unchanged (the tier is
skipped by scope, part one's rule).

## §67 — Eight explainer plates, the escapement's contact phases first

**Shipped whole across four landings** (PRs #119–#121, #123-era);
this record is the roadmap entry's reconciliation, and the entry is
retired against it.

**What was built, against what was filed.** All eight mechanisms got
their entries in `explain.html`, in the owner's priority order — the
escapement first, as asked: one figure per contact phase (lock with
draw holding the fork on its bank, unlock with the wheel's visible
1.0° recoil, impulse, drop) plus an interactive beat cycle whose
curves ARE `escapeDeltaDeg`/`forkSwingRad` ported verbatim. Then zero
reset (the heart cam in three panels, the roller-kiss correction
quoted), hacking (why the pad takes the rim's underside — the
timing-screw sweep), the column wheel (castellation law and its three
riders; ledger kept current through the TODO 11 tranche and TODO 22
closure that landed mid-arc), the gong (clamped-free mode shapes, the
6.27× second partial derived as (k₂L/k₁L)²), free-sprung regulation
(with the filed bar honored: no rate-adjuster drawn that the sim does
not model), alarm arming (TODO 20 stated plainly — posed from output),
and the show/hide biconditional as a live truth table computed by the
tube law's own OR.

**Deltas from the filing, recorded.** The planned "hack gap"
interactive landed as the truth table instead (the filing offered
either); and the four §65 seed entries (fusee & chain, motion works,
keyless, alarm train) gained plates beyond the entry's scope — the
fusee's torque graph is the HUD's own law
(`springTq = 0.35 + 0.65·reserve`, `trainTq ≈ 1` by the cone), the
12:1 drawn with its real counts (10→30, 8→32), the clutch's two
states, and an alarm overview map. Every dimension on every plate
resolves to a named, greppable constant; each entry's ledger names
its mechanism's open TODO debt. Zero console errors; the page is
sim-code-free, so the battery was untouched by all four landings.

## §68 — The switch at real scale: the azimuth, the raise, and the link re-solved

**Shipped whole.** TODO 11's layout measurement was the spec: real
chronograph scale (Ø ≥ 4.0 mm) was blocked by two independent walls,
and the entry predicted a two-move re-solve. Both moves landed, plus
one the filing scoped smaller than it turned out to be.

**Move one — the azimuth, from the sweep.** At the as-built 160° the
lock tail's ray ran outboard (min reachable centre r 41.4 vs the
real-scale bound 36.4). Swept 0..360° at 2° with the wheel's raised
band vertex-scored against every neighbouring mesh, 24° wins: centre
r 24.9 with 3.26 worst-case clearance (the gong), runners-up 22°/26°
at 2.8. `ALARM_LOCK_PIV_AZ` carries the derivation; pad, collar, and
the engaged-angle triangle are untouched derivations downstream.

**Move two — the raise, on the stud it already had.** The filing
asked for "one new bridge part"; the build got there without one.
The wheel's guide stud lengthens into the bridge: seated 0.3 INTO
the three-quarter plate's top (the §25 D expected contact), tip just
under the wheel's base — both ends derived. `ALARM_COL_RAISE` is the
constraint written as arithmetic — max(0, plate top + CLEAR_MARGIN −
as-built skirt bottom) — folded into `ALARM_COL_SPIN_REL`, which
every rider z-station already consumed: press axis, pawl, band-mid,
the TODO 24 nose all rode up automatically. Two boot asserts hold
the walls down (tips inside plate edge − margin; skirt above plate
top + margin). The wheel stands at Ø 4.32 mm (`ALARM_COL_BASE_R`
5.7), real feature depths (base 0.27 mm, castellations 0.53 mm).

**The delta worth the record — the link re-solved, not re-derived.**
The filing treated the §35 rod as corridor-fixed (az 212, r 26) and
asked only that the re-derived tail be "bounded in review". Measured,
that bound failed structurally: reaching the frozen rod from the new
station would have kept a §35-class tail. So the rod moved — P3
resolved in position space — and the move bought back the mechanism
§35 had spent: the rod now derives its site FROM the lock beak
(diametrically opposite, `ALARM_LINK_ROD_DIST` 10 — three whole
pitches, so the link beak reads the same parity BY CONSTRUCTION, no
rounding assert doing load-bearing work), and the beak's tail
collapsed 26.79 → 3.95 (~3:1 to the nose arm), retiring the 36.5×
displacement gain the P0–P3 ladder was written about. The plate
bores and the §35 tripwire moved with it to (−9.80, 26.97).

**What the battery caught that every probe missed.** With the chord
moved, the lay shaft's inner bush hanger (station t 12 of the old
chord's ray probe) stood inside the power-reserve sector's sweep —
FORBIDDEN at 41/61 reserve poses. The measurement lesson is §36-class
and now in the bush comment: a vertex-cloud scan reads a wheel's WEB
as empty (no vertices between rim and bore), and it green-lit two
stations in a row that stood inside solid matter. Re-scanned with
wheels held to their annulus footprint, the honest bands are
t 2.25–2.6 and 16.75–24; the inner bush took the inboard pocket's
peak (t 2.45, room 0.587 vs the 0.41 need) — which also shrank the
drive-end cantilever §54 sizes against from 4.5 to 0.93 mm. The
outer bush kept t 22.

**Acceptance, measured.** All 12 alarmHandoffs rows green unwaived at
both parities, including TODO 24's 'column outer face ⇄ lock beak';
boot silent; intraUnit 0 unwaived; stockFloor 0 new waivers;
fingerprint changed (real geometry moved) and deterministic across
virgin boots; the full battery 12/12.

## §69 — Tap focus, the ghost tier, and the schematic given real obstructions

**Filed and shipped in one landing** (owner request, three connected
asks), so this record is the filing: no roadmap entry preceded it.

**Tap focus.** Tap a part and everything unrelated to its mechanism
goes glassy IN PLACE — the answer to "how does the alarm selector
work in there" that §7's explode and §58's drag give by taking the
watch apart, now given without moving a part or hunting a camera
angle. What stays solid is declared data, never inference: the tapped
unit's §10 group (the hand-curated functional assembly — tapping the
alarm crown keeps the whole alarm complication) plus ONE hop of
`MECH_GRAPH` drive contact across the group boundary (the alarm rides
and is driven by the hour wheel; that context is exactly what "in
place" means). Drive edges only — support edges land on plates and
would flood the set with structure. The occluders (the
'Frame & plates' group and the dial sheet, derived from the declared
partition rather than a second hand list) always ghost unless tapped
directly: they are the accommodation, and the mode exists to see
through them — the P3 hierarchy expressed as a view. Full transitive
closure was rejected because the drive graph is CONNECTED (hour wheel
→ motion works → center wheel → everything): the closure of any tap
is nearly the whole watch, which answers nothing.

**The gesture and the resolution are inherited, not invented.**
Click-vs-drag is `CROWN_DRAG_THRESHOLD_PX`, the crowns' own rule (one
threshold — rule 1); the tap resolves through §59's pick, and the
ghost materials join §6's x-ray glass in the pick's demotion set, so
a tap resolves THROUGH the ghosted surroundings to the solid
mechanism while a ghosted part stays nameable where it is the only
thing there. The controls keep first refusal (a crown is not a part
to focus); §33 reconfigure and §22 route sketch own their canvas
clicks outright. Tapping the focused unit again, empty space, Escape,
or the panel's readout button clears. The selection persists (saved
state `focusUnit`), rides the §37 share link (`?focus=<unit>`), and
is scriptable (`__clock.setFocusUnit` / `focusUnit` — async on first
use, §58's lazy-import pattern for the drive list).

**Ghosting is §6's x-ray generalised.** Per-BASE-material glassy
clones at the ONE x-ray opacity (`tqXrayMat.opacity` — no second
translucency constant), swapped per MESH so shared `MATS` entries
never leak across units, `depthWrite:false` for §6's reason. A
material already installed as x-ray glass is left alone, so the two
modes compose instead of stacking transparency, and one walk
(`applyGhosting`) owns every ghost: restore only where the mesh still
carries OUR clone (x-ray may have re-swapped underneath — its state
is newer truth), then re-apply for the current mode. Power flow is
EXCLUSIVE with focus: both swap `mesh.material` per mesh with their
own restore bookkeeping, and two owners of one slot corrupt each
other's restores — the §33 "one spatial drag mode at a time"
precedent, applied to materials. Ownership per mesh is §59's
resolution (deepest labelled/explode-entry ancestor); a mesh no unit
claims ghosts, because solid would visibly claim a relatedness
nothing can name.

**The schematic given real obstructions.** §66's line tier used to
drop the solid camera layer entirely; now the solids STAY rendered,
and with no other translucency mode speaking (no x-ray, no focus, no
power flow) the same walk ghosts them all — the line model read
against the real metal it abstracts, previewing exactly what a
routing or a lever span is up against. X-ray, tap focus and power
flow each take the solids over when active. §66's honesty holds: the
proxies are still layer-swapped and never ghosted (the `schematic`
userData guard), `mesh.visible` is still untouched, and the tier is
still invisible to the battery.

**Schematic is now the boot default.** Restored state treats an
absent `schematic` field as ON (`?? true` — fresh visitors and
pre-§69 saves both land in the model view over ghosted metal); a save
or `?schematic=0` turns it off, and only OFF travels on the share
link. The scripted narrators (tour, demo, coupling, link, inspection
route) force `schematic: false` in their reset steps — their captions
narrate the finished watch. The one cost recorded: default-on means
§66 part two's lazy inspect.js import now happens on every boot
(async, after `__clock` exists); boot silence and the fingerprint
were re-verified with it (the fingerprint hashes posed bounding
boxes, so the BVH indexing side effect cannot touch it).

**Verified.** Headless: boot silent, both camera layers on, ghost-all
at 0.28 on boot including the lazily-built chain (the one mesh born
after the restore applies — its build re-runs the walk); alarm-crown
focus keeps all 21 alarm units + the hour wheel solid with train,
escapement and dial ghosted; clear returns the preview; x-ray
round-trips it; a 60 px drag does not focus; power flow clears focus;
`?schematic=0&focus=Alarm crown` lands focused with solids. Full
battery green (§52 gate).

## §71 — The display side and the strike work join the line tier

**Filed and shipped in one landing** (owner request: "we should see the
hands, subdials, pusher, and alarm gong, and striker in schematic view
too"), the §69 precedent — this record is the filing.

**What was added, all §66-doctrine.** Every proxy attaches to the group
the tick already poses, so nothing keeps parallel state: the five
HANDS (hour, minute, small seconds, power reserve, alarm) are blued
lines inside their own hand objects — local +Y with the real
tailFactor, so the hour hand turns with the hour wheel and the alarm
hand rides the §45 tube, parked or presented, exactly where the metal
goes. The SUBDIAL BEZELS are rings at the wells' own radii on the
hands' plane. The GONG is its arc at GONG_R across GONG_A0..A1 plus
the foot post — drawn at the boot arc, with the live-aesthetics
staleness noted in place (same residue class as the dots'
re-measure-on-entry). The STRIKER is pivot→head inside
alarmHammerPivot — the group the strike law swings — with the head at
its own ALARM_HEAD_R. The PUSHER is stem, cap face, and the
riser-to-pawl run, all group-local from spans the build records in
`userData.stem` (the userData.r convention generalized to a slider),
so the whole drawing slides on press. A follow-up ask in the same
landing added the §35 ALARM LINK — beak lever in its rotating arm, rod
and lay shaft as axis lines derived from each mesh's own longest
geometry dimension (the spring-zigzag convention, no restated
lengths), both crank keys drawn from their built children so the
registration solve's roll carries the drawing — and the ZERO-RESET
HAMMER, lever and tail bar riding hammerGroup, the group the §36A
reset law swings. And the THREE-QUARTER PLATE joined the base plate
as an occluder — not a disc but the plate's own extrude re-drawn in
the page color with its sharp edges as hairlines, so the cut, the
bores, and the slots all read. That occluder lives INSIDE its labelled
unit, which forced the §71 collector change: `collectUnits` in
inspect.js now prunes anything flagged `userData.schematic` wherever
it is parented — "invisible to all instruments" made structural in the
one collector every unit-based check flows through, the same trust the
fingerprint already extends. Flag every schematic object directly; an
unflagged child of a flagged parent is not protected.

**Third growth (owner list + sound).** The remaining mechanism units —
pallet fork, alarm selector, setting lever, yoke, stop lever,
maintaining detent, reset rod, hack rod — draw GENERICALLY: each
principal mesh (longest dimension ≥ 2.5) takes its axis line or, when
its box reads as a disc, its outline circle; every line derives from
the mesh it lives in, so the tick's poses carry the drawings. The
fork's two pallet stones draw in the event red, selected by their own
ruby material. The CHAIN draws as its actual run: rebuildChain hands
the same curve it cuts the links along to one proxy line, refreshed in
the one place the path is computed, so tension re-wraps the drawing
with the metal. And the SOUND EMITTERS are visible: the SND table is
the single source of what emits, so each distinct emitter object (fork
tick, maintaining pawl/detent, minute jump, reset hammer, crown stem,
gong strike point) carries a concentric-ring glyph in the event red,
attached inside the emitter. Deliberately still undrawn: Fork cock and
pillars (accommodation, not mechanism) and the Alarm release sleeve
(not in the owner's list; the next natural entry). And X-RAY applies
to the schematic too (owner call): the plate occluders' fills register
with setXray and lift with the same toggle — one x-ray state meaning
"see through the plates" in both views — while the rim and edge
hairlines stay, so the plates remain drawn parts rather than opaque
paper.

**Palette note.** Hands take their own blued line color — the metal is
MATS.bluedHand, and the tier mirrors the palette it abstracts; brass
stays wheels, steel stays levers/structure, red stays springs and lit
contacts.

**Battery untouched by construction**: line-only proxies (the §66 boot
assert holds), attached inside existing groups, fingerprint unchanged
by the skip rule. Verified: boot silent, per-unit proxy census (gong,
hammer, switch, both subdials, all five hands) and screenshots from
both sides with the §69-era base-plate occlusion doing its work.

## §72 — The keyboard and screen-reader layer

**Filed and shipped in one landing** (owner request: an accessibility
audit, then shortcuts). The audit found the HUD built from native
elements — buttons, ranges, selects, details/summary, all focusable —
but NAMELESS: row labels lived in sibling spans with no programmatic
link, so a screen reader heard "Off, button" forty times; state
buttons carried no aria-pressed; the canvas was an unlabelled void;
every canvas interaction (orbit, tap focus, crown, pusher) was
pointer-only; the only shortcut was H; and the 0.9 s camera sweeps
ignored prefers-reduced-motion. explain.html was already in good
shape (24 aria-labels, native disclosure, reduced-motion honored).

**Four principles, implemented.** (1) Shortcuts CLICK the same
buttons the pointer does — one path of authority, no forked state.
(2) Names derive from the panel's own row labels via aria-labelledby
with the control's own id appended, so a toggle's Off→On text change
updates its accessible name with no second copy to go stale;
aria-pressed syncs from the same text through one MutationObserver.
(3) Every shortcut announces through one polite live region.
(4) The ? help overlay is GENERATED from the shortcut table — the
list the viewer reads is the list the handler runs.

**The map**: Space pause · W wind · C crown · A alarm · S schematic ·
X x-ray · L labels · F focus · M sound · E explode/reassemble ·
1–5 camera presets · arrows orbit/tilt · +/− zoom · H panel · ? help
· Esc closes. Shortcuts stand down while an input/select has focus,
and Space/Enter keep native activation on focused controls. Mapped
buttons carry their key in their title. Focus is visible
(focus-visible outline in the blued accent, pointer users unaffected),
the canvas names itself as an image and points at the panel, and
goToPose snaps instead of flying under prefers-reduced-motion.

**Still open, honestly**: the spatial drags (crown azimuth, explore
part-drag, reconfigure) have no keyboard equivalent — they are
position-space editors, and a keyboard path there is real design
work, not a shortcut; filed as the natural next entry if wanted.

## §73 tier one — The chrome speaks German and Chinese

**Shipped in part** (the §10/§36/§66 convention): the app's chrome is
localized; `explain.html` (tier two, and the bulk of the prose) stays
English with the roadmap entry's staging note. A mixed state between
the app and its explainer was explicitly acceptable; a mixed state
WITHIN the panel was not, and there is none.

**Why these two locales.** German because the movement's whole
finishing vocabulary is Glashütte — the audience most likely to care
reads German — and because it is the LAYOUT stress test: strings run
~30% longer against a 240 px column with §53 in its history. Chinese
because it is the TYPOGRAPHY stress test: CJK fallback in the
`system-ui` stack, no-space line breaking, legibility at 11–12 px.

**The refactor that had to come first (§73 coupling 1).** "On"/"Off"
was load-bearing STATE text: §72's MutationObserver derived
`aria-pressed` by reading button text, and a dozen sites wrote the
literal. Translating it would have silently broken the screen-reader
layer. Toggles now carry `data-state="on|off"` written by one
`setBtnState`, the observer watches that ATTRIBUTE
(`attributeFilter: ['data-state']`, no more characterData walking),
and zero literal `'On'`/`'Off'` comparisons remain. Same treatment for
the light-mode button, whose click handler used to read its own face
to decide the next mode (`data-mode`), the crown, alarm crown, life
size and §69's focus button. Worth landing without any locale, which
is exactly why it is separable.

**One table, keyed by the English source** (`src/i18n.js`). The app
keeps authoring in English; `t()` resolves at the display site and
`localizeTree()` walks the already-built panel once at boot (text
nodes plus `title`/`placeholder`/`aria-label`). A missing entry falls
back to its English input — visible, never blank. `UI_LANG` resolves
ONCE at import: `?lang=` → `localStorage` → `navigator.language` →
`en`, and the Language row records the choice and RELOADS (§22's
reload-tier precedent — a second live re-render path would be a copy
to rot). Option faces are written in their own language, so a viewer
hunting for theirs need not read the current one.

**Display translates; values do not.** The line the whole landing
holds: `<option value>`, `data-cam`, unit and group names as
MECH_GRAPH vocabulary, `qualityMode`, persisted state and every
deep-link param stay canonical English. The unit and quality selects
gained explicit `value` attributes precisely because their value used
to BE their label. Verified per locale: `explode-unit` reads `All`,
`quality-select` reads `Auto`, the preset keys read
`Escapement,Train,Dial,Setting,Free` — in all three languages.

**Numbers (§73 coupling 5).** `fmtNum` at the display layer only —
German reads `30,0 h` and `5,0 Halbschw./s` while the stored value
keeps its `.`. `fmtInt` is separate and is a CORRECTNESS fix, not a
cosmetic one: the beat-rate menu's `18,000 A/h` reads as *eighteen* in
German, where `,` is the decimal mark; it now renders `18.000 A/h`
there with the option's value still `18000`. The §53 slider readouts,
the §49 measurement stats and the §60 life-size caption all route
through the same pair.

**Couplings 2–4, as filed.** The §72 shortcut table localizes its
DESCRIPTIONS in place (the list read is the list run) while key
letters stay physical — the German help note says where `?` lives on
that layout. Announcements compose from the localized row labels
through the existing aria-labelledby chains, so they localized for
free. `aesthetics.json`'s `_labels` are joined by their authored
English text rather than forked per language — §53's single source is
untouched.

**The German gate found a real defect, and it was fixed in layout.**
The acceptance sweep measures every panel element against the 240 px
column: `Lebensgröße` + `Kalibrieren` overflowed the Life-size row —
§53's failure with a new cause. The fix is `flex-wrap` on `.row` and
`.guided-btns`, locale-independent and invisible in English (whose
rows still fit one line); shortening the German would have been the
translation paying for a layout bug.

**Verified.** 42 headless checks across en/de/zh: boot silent in each,
zero page errors, `html lang` set, 14 state buttons with
`aria-pressed` agreeing with `data-state` (and still agreeing after a
keyboard-driven toggle), the help overlay generating all 17 rows,
canonical values intact, no overflow at 240 px, and the decimal /
grouping rules per locale. Full battery 12/12. "No geometry moved" is
MEASURED, not asserted: virgin boots of `origin/main` and this branch
fingerprint identically (2476672552, 49 units over 10 poses) — the
landing touches strings, attributes and CSS only.

**Residue, recorded.** `explain.html` is English (tier two). The
reconfigure/route TRIAL diagnostics quote solver assert text verbatim
and stay English with it. Console warnings, boot asserts and developer
key paths are English by contract. The Chinese chrome is authored
here and wants a native review pass before tier two ships in that
locale — §73 budgeted exactly that.

## §73 tier two — The explainer speaks them too

**Completes §73** (tier one above); the roadmap entry is retired and
this record is its reconciliation. `explain.html` — 5,411 words of
prose plus 205 SVG plate labels — now renders in German and Chinese,
100% covered in both, with the page still authored in English.

**The unit of translation changed, and that decided the design.** Tier
one keys words; a paragraph flows THROUGH its inline markup and word
order differs per language, so rich blocks are keyed by their
normalized `innerHTML` and the markup travels with the sentence.
`src/explain-i18n.js` holds the mechanism and the one definition of
"translatable"; `explain-i18n.de.js` / `.zh.js` hold the tables,
loaded on demand so a reader of the English page pays nothing for
either. The collector is imported by the tooling rather than copied,
so extraction, verification and rendering cannot drift apart, and
keys are never retyped — `--extract` regenerates them from the real
DOM, which makes the silent-typo class of error structurally
impossible.

**Editing the English invalidates its translation, on purpose.**
Change a paragraph and its key stops matching, so that block renders
English again until someone re-translates it. A stale German
paragraph confidently describing changed English is exactly the lie
this repo's maintenance rule exists to prevent; visible English is
the honest failure, and the checker reports the coverage drop.

**Four gates, because prose can break things silently.** Markup
preservation (tag sequence identical, so a translation cannot drop a
`<code>` or break a `<b>`); `<code>` byte-identity and id
preservation (an id inside a rich block is a HANDLE an interactive
plate looks up by name — dropping one would break that plate with no
error); plate-number survival (the page's promise is that its numbers
are greppable in `src/*.js`); and PLATE FIT — measured, not eyeballed.

**Numbers are NOT localized here, and that is a deliberate divergence
from tier one.** The header says "values quoted from `src/*.js`";
rendering `CLEAR_MARGIN` as "0,15" in German while the source reads
`0.15` would break exactly that promise. These are identifiers being
quoted, not quantities being read aloud. 24 keys are classified
INVARIANT (no letters outside a `<code>` span — a constant rendered as
text), excluded from the coverage denominator and counted out loud so
the exclusion is visible rather than assumed; four more (an SI unit,
a quoted arithmetic, two identifiers) carry explicit identical
entries so the record says "decided", not "missed".

**What the gates caught, all three of them real.** (a) `t` was
already a local variable in two plates — a text element in the truth
table, elapsed seconds in the beat loop — so the localized writes
threw `t is not a function` and the plates silently stopped updating;
the import is `tr` now. (b) Four Chinese paragraphs had gained an
`<em>` the English did not have. (c) EIGHTEEN German plate labels
overran their plate or collided with a neighbour — the §53
truncation problem moved from a 240 px column into a fixed-geometry
drawing. Those were fixed by shortening the German, which is right
here and was wrong in tier one: a panel is a drawing sized for its
labels, not a layout that should have flexed.

**Verified.** `--check`: 363/363 translated in both languages, 0
unmatched keys, 0 markup drift, 0 `<code>` drift, 0 plate-number
drift, 0 new overflow or collision against the English baseline. Per
locale: boot with zero page errors, `html lang` set, picker values
canonical (`en,de,zh`), and both interactive plates still live after
the innerHTML swaps (the feeler slider updates its readout, the
column wheel still indexes a step per press). No sim source changed —
the battery is untouched by construction, and the new gate runs in
its own ~1-minute workflow rather than behind the sweeps.

**And one instrument that outlived the translation job.** Rebasing
onto a main that had moved raised a question the translations could not
answer: the §73 gate checks English against its translations, never the
page against the SOURCE — yet the page's header promises "values quoted
from src/*.js" and CLAUDE.md makes it part of a §'s reconciliation.
`tools/explain-quotes.mjs` is that promise as an exit code. It reads
both sides statically (no browser, under a second), resolving source
expressions only where every identifier is already known, and treats a
plate's degrees against the source's radians as agreement rather than
false drift. What it cannot compare it REPORTS — a name the source
declares but whose value needs geometry is held apart from a name the
source has never heard of, because collapsing them would teach the
reader to skim the line that matters. Negative-tested: quoting
`IMPULSE_WIDTH = 0.20` against the source's 0.16 fails it with the
file named. Current state: 20 claims, 19 compared and agreeing, 1
(`GONG_A1`, radians plus a layout rotation) reported as not statically
comparable.

**The maintenance loop, exercised once for real.** Rebasing onto a main
that had landed TODO 25 tier two — which cuts the hairspring to the
balance so the beat becomes a consequence — showed what each instrument
can and cannot see. The quote audit passed: no NUMBER the page cites had
moved. But the free-sprung entry's ledger still said the rate "comes
from the spec's vph", which tier two had just made false, and no
mechanical check can catch a sentence going stale. It was refreshed
against the boot's own figures (I weighed at rim 84.7% / screws 10.5% /
arms 4.8%, the spring solved to a 0.0244 mm ribbon inside real stock,
√(k/I) landing on the spec), and that edit invalidated its two
translations exactly as designed — the block fell back to visible
English and `--check` reported the stale keys — until both were
re-translated. Prose still needs a reader; the instruments narrow what
the reader has to hold.

**The zero-reset plate, rebuilt (owner report: "the diagram doesn't
make sense").** It didn't. The old plate drew a leaf beside a floating
block across three static panels: no hammer pivot, no roller, no
visible notch, no zero, and an outline that was not the profile
`makeHeartCam` cuts. The replacement is GENERATED from that profile —
`r(θ) = rMin + (r − rMin)(1 − cos θ)/2`, the source line — and SOLVED
each frame rather than posed: for a cam angle the roller must sit one
roller radius off the profile it faces AND its centre must lie on the
lever's arc about the pivot, which is a 1-D root find (bisection on
the lever angle). So the linkage agrees with itself by construction.
Dimensions came from a live boot's own `userData`, not from reading
the build: r 3.36, rMin 1.08 (0.32 r), arm 7.73, roller ⌀ 1.4, pivot
at rMin + bevel + roller + arm. It plays the whole reset — run, press,
run-down, seat — and scrubs by cam angle when paused, and the
small-seconds hand IS the cam, so "the low point is cut at the
display's zero" is visible rather than asserted. Recorded
simplification: the plate's retract clears the ROLLER against the
swept disc, where the build's solved `HAMMER_SWING_RAD` clears the
whole bevel-expanded lever outline.

**Residue, stated.** The Chinese is a working translation by the same
hand that wrote the German; the roadmap has said from the start that
this repo cannot self-certify Chinese to native quality, and it ships
usable and checkable with that caveat recorded rather than as a
certified one. The reconfigure/route trial diagnostics quote solver
asserts verbatim and stay English with them, as in tier one.

## §62 — Openworked three-quarter plate: windows derived from what they frame

**The goal, and the constraint that outranks it.** The three-quarter plate
is the largest opaque surface in the movement, and everything §61 made
honest — the grooved cone, the chain seated in it, the maintaining
sandwich — turns underneath it. This carves WINDOWS through it, the way an
openworked plate does on a real movement. The entry's own priority stands:
the plate is a BEARING first, so where a wanted window and a required web
cannot coexist, the WINDOW is what gives. Every number below is a
consequence of that ordering, not a drawn dimension.

### Windows are measured, and the builder stays dumb

`makeThreeQuarterPlate` gains one input, `windows`: closed polygons, wound
clockwise by the builder whatever the solver hands over, grown by
`PLATE_BEVEL` through a new miter `offsetPolygon` exactly as holes and slots
are. A polygon rather than another parametric primitive because a window is
not one shape — an annular sector broken by webs here, whatever the shrink
leaves there. `PLATE_BEVEL` is exported now: it is 0.06, and §62's web
sections are quoted against it (an asked-for 0.80 web measures 0.80 through
its body and 0.68 across its chamfered face), which makes it a number the
caller reasons about rather than an implementation detail.

### The solve: reveal, then shrink, then web

An intent names the action it frames and MEASURES its own reveal. For a
coaxial stack that reveal is exactly a circle about the axis — a revolver's
swept silhouette is a circle, so no sample net is involved and no spoke can
slip between two samples (TODO 7's first blindness class, answered by
construction rather than by a finer net).

- **fusee** — sized to the CHAIN's outer edge where it wraps the cone
  (`max fuseeGrooveAt(f).r + CHAIN_END_R_OUT + CLEAR_MARGIN` = **8.210**),
  not to the cone. The wraps are the thing being shown, the widest of them
  (the bottom groove at `FUSEE_R_LARGE`) is occupied at every state of the
  reserve, so a window containing it shows the chain seated at any tension —
  which is the entry's acceptance criterion, met by construction rather than
  by sampling tensions. The cone's crown (6.74) and its crest lands (6.80)
  fall inside; the maintaining sandwich and great wheel are seen past the
  cone's flank. **A window onto a stack is sized to the member it is a window
  ONTO** — size it to the widest thing anywhere under it and it stops being a
  frame and becomes a hole.
- **escapement** — the entry named the escape wheel and pallet fork, and
  measured against the shipped plate most of it already WAS a framed view:
  **96%** of the fork's under-plate footprint and **45%** of the escape
  wheel's already stood in TQ_CUT's open wedge. The fork wanted nothing. The
  escape wheel is the half-covered one, and it pivots IN this plate, so the
  rest of it is a window with its own islanded boss (reveal **4.770**).

Then the outline SHRINKS, per degree, by bisection against two fields, each
with its own floor and its own reason:

- **keeps** — material the plate must carry, held off by `CLEAR_MARGIN`,
  the same standoff `checkCutVsPivots` holds the balance cut to;
- **openings** — the bores, slots, balance cut and rim, held off by
  `TQ_LAND_MIN`, because the strip between two holes is a MEMBER, not a
  clearance.

`TQ_LAND_MIN = max(STOCK_MIN_U, TQ_T)` = **0.8**, and the max is the
derivation: §54 measures slenderness against the stiffest section dimension,
which for a strip cut from a plate is `max(width, TQ_T)`, so a strip narrower
in plane than the plate is thick is a blade standing on edge — TQ_T is the
width at which an in-plane land stops being the weak direction. `STOCK_MIN_U`
(0.317) never binds today and stays inside the max so the two floors cannot
silently swap places.

The keep field is SWEPT, not listed. The hand-written obstacle lists in this
file have been patched twice for parts someone forgot, and §76's wall-list
finding is the same lesson at movement scale. A mesh is a keep if it CROSSES
the plate's z-band or is FOOTED on its top face, each mesh carrying two
footprints — an AABB and a bounding circle — with the greater distance taken,
since each is separately conservative and an AABB describes a round part
badly (the alarm column wheel's box reads 0.83 from the fusee axis where its
silhouette stands 1.65 off).

### Webs, and why three

A window about an arbor that pivots in this plate ISLANDS its boss, and the
webs are what re-attach it.

- **Width** `max(TQ_LAND_MIN, span / SLENDER_TARGET)` — §50's floor, or §54's
  ceiling where the span is long enough to bind (past 21.6 units at
  TQ_T 0.8). Both windows land on the floor: **0.800** over spans of 6.860
  (fusee) and 1.760 (escapement).
- **Shape** parallel-sided, the locus `r·sin(θ − θweb) = w/2`. A
  constant-angle wedge measures w at the boss and flares to 5.8 units by the
  reveal, spending most of the window on stock nothing asked for — that was
  the first cut, and the map of it is why this one is a straight edge.
- **Count** three, derived: a bearing reaction can arrive from any azimuth
  (the fusee arbor's reverses between running and winding), and two arms
  leave the perpendicular direction carried in BENDING alone. Three is the
  smallest number restraining an islanded boss in tension and compression
  whatever the load's bearing — the same reason a real openworked bar carries
  three arms.
- **Placement** every gap the shrink already left IS a web; runs are split
  only to make up the count, by arc length and then evenly inside each run.

The boss itself is `pivotBossR + TQ_LAND_MIN`: the window stands one LAND
outside it, not one clearance, because the boss is the annulus the staff runs
in and carries the whole bearing reaction into the webs. `pivotBossR` is
hoisted out of `checkCutVsPivots` and shared, so the cut and the windows
cannot judge one boss by two expressions — PR #140's `MW_TOP` defect, not
repeated.

### The plate is now solved LAST, because a window reaches further than a bore

The plate build's own comment has always called it "deliberately the LAST
structural step: every opening in it … measured off parts that already
exist." That was true of the openings it had and is NOT true of a window: a
window is large enough to reach the parts the plate is the FOOTING for, and
every one of those is stationed on its top face six thousand lines further
down. The first solve is blind to them by construction, and it duly cut the
fusee window straight through the alarm lock's pivot post at bearing 153°.

So the outline is solved TWICE by one function — §76's "one list, used
twice" — and the second answer is the one that gets cut: the geometry is
rebuilt in place on the same mesh object, so the chatons, bearing collars,
plate screws and §71's occluder (which shares this very geometry) follow
without being rebuilt. What makes that safe rather than merely later is that
the re-solve can only ever SHRINK, since the keep field grows monotonically
as parts are added — and that property is ASSERTED, because the pillar seats
and their screws were solved against the first outline and are only
conservative if it never grew. Measured: the re-solve closes **5** bearings
and shrinks **8** of the fusee window's 360, taking its edge from 8.21 to
7.80 under the alarm lock.

### What is asserted at build time

`checkPlateWindows(stage)`, called at each stage with the keep field
re-swept, so the late call sees the late parts: every edge off the keeps by
`CLEAR_MARGIN` and off every other opening by `TQ_LAND_MIN`; every web at or
above its derived width AND its chamfered face above `STOCK_MIN_U`; and no
islanded boss left a CANTILEVER — three arms inside one half-plane carry a
load from the other side in bending, which a count alone cannot see. Boot is
silent, so all of it is a gate.

Windows join the shared opening list: `seatClearance` reads them, so pillars
and the §20 plate screws over them keep a land against every window edge.

**Connectivity was measured, not inferred.** The web width and the
no-cantilever rule together IMPLY the plate is still one piece, and implying
is not measuring — so it was flood-filled, on a 0.2 grid (a quarter of the
0.8 web, fine enough that a web cannot be missed and read as a break) over a
box round each window. Both bosses reach the plate body, and **0** cells in
either box are material without being reached from the boss: no island, at
either window. Two probe defects on the way to that number are worth the
line, because both would have read as a broken plate — seeding the fill at
the boss's own AXIS finds the pivot's through-bore, and seeding it at a fixed
bearing on the annulus can land in TQ_CUT's open wedge, which is where the
escapement's boss sits. An instrument that reports a defect it invented is
the failure mode this repo keeps cataloguing; it is recorded here rather than
quietly fixed.

### Four defects the asserts found, all in this work

Written down because each was invisible to every other instrument and three
of them looked like working geometry:

1. **The fusee's bearing collar was 0.15 of nickel.** The first cut set the
   window's inner radius at `pivotBossR + CLEAR_MARGIN`, and for an
   unjewelled bore `pivotBossR` IS the bore — zero wall. The land check said
   so on the very solve that added it.
2. **The keep sweep enrolled the plate against itself.** On the second call
   the plate exists and its own mesh crosses its own band over the whole
   disc, so every window measured zero clearance against the material it was
   cut out of. Its screws go with it — they are seated by a scan that reads
   these windows, so enrolling them here would make the two solves argue in a
   circle rather than in an order.
3. **"Footed" was reading the z-stack, not the load path.** Taking the whole
   `CLEAR_MARGIN` above the top face enrolled the alarm column wheel, which
   clears the face by 0.152 and is carried entirely by its own stud. The band
   is half a margin deep now: nothing may legally sit closer than a whole one
   without touching, so an underside inside it is resting and one above it is
   carried elsewhere.
4. **Two sector polygons that swallowed the web between them.** The web-edge
   test took the lesser of the two edges where it needed the greater, so
   neighbouring sectors overlapped — and ExtrudeGeometry triangulates
   overlapping holes into PHANTOM PLATE rather than failing. The land
   measurement between windows is the guard that catches it, and it is why
   that check measures the built outlines rather than re-reading the angles
   that drew them.

Two further traps, both found by the boot ceasing to finish rather than by a
check, and both now commented at their site: interpolating the outer table
across a run's CLOSED neighbour drags the outline to the window's own axis
and self-intersects the polygon (the first solve shrank nothing, so no run
had an edge and nothing showed); and the parallel-web locus is only the
web's edge while the point is beside the arm — past a quarter turn `sin`
goes negative, which read as "excluded at every radius" and deleted a whole
sector.

### The acceptance, measured rather than argued

The entry asks that the fusee window show the grooves and the wraps "through
the full reserve without the plate edge clipping the view at any tension".
Measured by raycasting the real chain's own vertices against the finished
plate, at seven tensions, counting only the chain the window was SIZED to show
(under the plate, inside the reveal):

| tension | wrap vertices in the reveal | covered by plate | max wrap radius |
|---|---|---|---|
| 0 | 142 | 0 (0.0%) | 8.201 |
| 0.25 | 1052 | 79 (7.5%) | 8.188 |
| 0.5 | 1874 | 150 (8.0%) | 8.197 |
| 0.75 | 2624 | 201 (7.7%) | 8.048 |
| 1 | 3282 | 339 (10.3%) | 8.204 |

Three arms of 0.80 across a 6.86 span account for **8.0%** of the window's
annulus, so the coverage IS the webs and nothing else — which is the result
the acceptance wanted, arrived at by measurement rather than by looking.

**One residue, stated because it is thin.** The chain's measured outer reach
is **8.204** against a derived reveal of **8.210**: six thousandths of
daylight. The derivation is a CENTRELINE one — `max fuseeGrooveAt(f).r` plus
one plate half-width — and a chain link is a chord, so its corner sits outside
the circle through its pin centres by an amount that derivation cannot see.
The `CLEAR_MARGIN` of visual reveal is therefore entirely spent absorbing it
rather than being daylight. It fits today and nothing is clipped; a change to
`CHAIN_END_R_OUT`, `CHAIN_PITCH` or the groove envelope would need this
re-measured, and there is deliberately no assert standing in for that — a
tripwire at whatever tension a session happened to restore would be a partial
check wearing a complete one's clothes.

Separately, the alarm lock's pivot post closes bearings 152, 153, 155, 158,
159 outright and pulls 154, 156 and 157 in to 7.80 — **8 of 360**, a ~8° bite
out of the outermost wrap. That is the re-solve doing its job, not a defect:
the post is footing the plate owes a real part.

### What was measured and NOT taken

The going train is genuinely hidden — of their under-plate footprints, the
third wheel is **8%** open, the fusee unit 12%, the chain 22%, the fourth
24%, the centre 26%. Windows over the centre and third wheels (r 16.5 and
14) were not cut: at that size the plate stops being a bearing carrying every
upper pivot and becomes lace, which is the one trade this entry's own
priority forbids. The numbers are recorded here so a later § can argue with
them rather than re-measure.

`explain.html` gains nothing: its entries are MECHANISMS, and an openworked
plate is structure and finish. Adding prose there would have invalidated its
German and Chinese by design (§73) for a page whose subject this is not.

**Battery:** 13/13, zero waivers added — support 0 failures, graph clean,
penetration and alarmHandoffs (0 waived) OK, stockFloor 0 degenerate and 0
unwaived over 501 rows, intraUnit and expectedContacts clean, oscillator
2.5000 Hz on a 0.0244 mm ribbon, `inspection` **0 FORBIDDEN** over 50 units
and 74 contacting pairs, `clearances` 0 violations over 30 budgets, and
`sweptOverlap` **0 CONFIRMED** over 57,294 pairs (2 tight, 13 refuted). Boot
silent. The fingerprint moves by construction — the plate's mesh changes
shape — and lands deterministic at **4226139235** across two virgin boots.

### Postscript, 2026-08-05 — the outline was interpolated, and the assert was right

The solve bisects the outer edge **per degree** and step 4 walked each run
at **half** a degree, reading the table by linear interpolation. That
asserts nothing about the vertex actually emitted: between two solved
bearings a straight chord in (θ, r) rides OUTSIDE a boundary that curves
toward the window, so the vertex can land short of the land the solve
believed it had kept. Second-order in the sample spacing, and at the
shipped balance it measured zero — which is why it shipped.

It surfaced against a growing balance. Roadmap §76 (a bigger balance) had
recorded R 10 and R 11 booting silent; re-measured on this tree they did
not, and the new warning was §62's own:

```
§62 window 'escapement': edge leaves a 0.798 land
against another opening at (5.67, -27.89) — need 0.800
```

Vertex **95 of 200** — a half-degree sample, on the outer sweep. 0.002 on
0.800, from nothing but the interpolation; the growing balance cut had
brought a curved boundary close enough for the chord to matter.

**The outline is now solved at its own bearings.** The bisection that built
the per-degree table is hoisted to one `solveR(a)` and called again by the
sampler, so the polygon that gets asserted is the polygon that was solved —
the same "one function, used twice" discipline `checkPlateWindows` already
applies to the keep field. The table still binds as an upper bound
(`min(rAt(a), solveR(a))`), so the outline can only shrink against what
shipped, never grow into new territory; a bearing that bisects to zero is
pinched and its sample is dropped rather than spiking to the axis, which was
§62's original self-intersection failure.

Measured after, balance radius swept with the alarm corner at 45°:

| R | before | after |
|---|---|---|
| 9 (shipped) | silent | silent |
| 10 | 3 warns, all this | **silent** |
| 11 | 3 warns, all this | **silent** |
| 12 | 4 warns | 1 — §76's wall two only |

So §76's acceptance line (R ≥ 10.8) is met again at R 11, and this time by
measurement rather than by a claim that had gone stale.

**Battery:** 14/14 (the count grew by `restoring`), boot silent,
fingerprint **unchanged at 3682902459** — the windows move by at most the
interpolation error and the plate's extent is set by its rim, so the
per-unit boxes do not shift. The lesson is the cheerful one: a boot assert
written during §62 caught a §62 defect three days later, in a configuration
§62 never ran.

## §78 — The schematic's missing vocabulary, and an x-ray that dissolved the page

**Filed from an owner walk-through of the shipped line tier**, and
measured on the shipped tree rather than eyeballed. Four parts: three
things the drawing did not say, and one it said wrongly.

### Part one — the column wheel, drawn by nothing

The alarm column wheel is three meshes, all named `alarmColWheel`.
Probed: none of them — and no group in their ancestry up to `movement`
— carried `userData.r`, so the generic §66 rotor pass never enrolled
them; the §71 `discOrAxis` pass enrols eight named units and `Alarm
switch` is not one. The wheel was the single blank in the drawing, and
it is the worst possible blank: `alarmColSteps` is a readout of this
wheel and `alarmOn` a readout of its parity, so the tier could show the
pusher's pawl, the lock's beak and the ring it commands while omitting
the part that decides which state they are in.

**A pitch circle would not have fixed it.** A pitch circle is the
vocabulary for "a rotor of this radius"; this wheel's entire content is
its castellated profile. So the glyph is **the boundary of the cut
surface**: for each pillar, the closed outline of the top face
`makeColumnWheel` emits — height `colH·profileAt(θ)` traced at the
inner radius and back at the outer, joined by the two knife edges where
the chamfers run down to meet the base. It calls `profileAt` itself, so
TODO 20's invariant (one function for the cut surface and the ridden
law) now extends to the drawing: mesh, law and glyph cannot drift.
Both breakpoints — `colFlatHalf` and `colFlatHalf + colFlank` — are
kept exactly in the sample list, because sampling straight through them
rounds the plateau's corners and the result reads as a cam lobe rather
than a column with a flat top. The `ratchetPoly` the pusher's pawl
already casts its park against draws the skirt's saw, so the teeth in
the drawing are the teeth the pawl indexes.

**One addition the plan did not have, from looking at the render.** The
six top faces alone read as plates floating in a ring — there was no
body to hang them on. The base disc's two rims and its bore were added
(`ringExtrude` centres the disc on the group origin, which is why the
pillars' floor height is also its rim). Ten polylines in total: six
pillars, three rings, one saw.

Measured on the built glyph: plateau half-angle 0.0754 rad =
`colFlatHalf`, pillar half-arc 0.2618 rad = `colFlatHalf + colFlank`,
crest z 0.35 → 1.75 = `baseH/2` → `baseH/2 + colH`. The glyph rides the
parity — toggling the alarm rotates every vertex about the wheel's axis
with z unchanged — because it is parented to `alarmColumnWheel`, the
group `alarmColShownA` already turns.

### Part two — two of three wound springs drawn as things they are not

| spring | its solid | what the tier drew |
|---|---|---|
| Hairspring | `TubeGeometry` 15.58 × 15.26 × 0.06 — a flat spiral | a brass LOOP + spoke at r 7.92, from `userData.r` |
| Mainspring ribbons (×2) | coiled ribbons | the §48 9-point ZIGZAG along the longest local axis |

Both wrong in a specific way rather than merely absent: the hairspring
got the GEAR glyph, stating that the oscillator's restoring element is
a rotor of radius 7.92, and the ribbons got the BLADE glyph, which is
derived from a bounding box and reads as a straight leaf spring.

A spiral needed its own word. `makeHairspring` and `makeBarrel` now
export `userData.spiral = { innerR, outerR, coils }` — the exact
arguments their own `ArchimedeanSpiral` / rest-frame polyline are swept
along — and one glyph function with three consumers draws it, so coil
count and both radii are **quoted, not approximated**. The two older
passes now SKIP any part carrying a spiral plan, which is what makes
this a replacement rather than an overdraw; a boot assert holds the
count at 3, because a spring that stops exporting a plan would fall
back silently to the glyph this part exists to retire.

This matters beyond legibility: §76's balance work and TODO 25's solve
both turn on the hairspring's plan (coils, radii, height), and a
schematic that drew a circle there could not show what either was
talking about.

**Residue, declared:** the hairspring's glyph is drawn at REST. The
breathing swaps a precomputed geometry frame rather than posing a
group, so the proxy cannot ride it for free — the same residue class as
the gong's boot arc and the contact dots' re-measure-on-entry.

### Part three — the dial had no thickness

§71's hidden-line convention gives the base plate two page-colored
faces and a rim wall so its boundary reads as a part rather than a hole
in the world. The dial got flat circles at single z values while
`dialPlate` is a 1.056-thick slab spanning world z −9.46 … −8.40 — a
sheet, in a drawing whose one structural idea is that plates are solid.

It takes the **three-quarter plate's** treatment rather than the base
plate's, and for the same reason that one does: the dial is not a plain
disc. The sub-dial wells and the centre bore are holes through it, so a
bounding-box pair of faces would paper over the very openings the
wells' bezels are drawn at. Re-using `dialPlate`'s own extrude is two
faces and a rim at exactly its measured extents, with the holes, and
restates nothing — the render confirms it, the works reading through
the wells and nowhere else. The occluder lands INSIDE the labelled
`Dial` unit, which is precisely what §71's `collectUnits` prune exists
to permit; every object is flagged directly, since an unflagged child
of a flagged parent is not protected.

### Part four — x-ray must not lift the base plate

`setXray` emptied `SCHEMATIC.occluderFills`, and §71 had put the base
plate's two faces and rim wall in that array alongside the
three-quarter plate's fill. So x-ray in the schematic dissolved the
base plate — which **the realistic view's x-ray never does** (it swaps
`tqPlateMesh`'s material and the Dial unit's, and touches the base
plate nowhere). The two views disagreed about what the word meant, and
the schematic's reading destroyed the one thing the tier's own comment
says the occluder is for: *"without occlusion the line drawing reads
the dial-side works and the train as one tangle; the movement's real
partition is the base plate."*

Now there are two sets. `occluderFills` is exactly the x-ray-lifted
set — the three-quarter plate's fill and the dial's, the two parts the
realistic x-ray glasses — and `SCHEMATIC.baseFills` holds the base
plate's three, read by no toggle. Both halves are boot-asserted (no
base fill in the x-ray set; the x-ray set is exactly 2), so the
invariant is held rather than intended. Measured through the app's own
button: with x-ray on, the three-quarter and dial fills go invisible
and all three base fills stay visible.

### Scope kept out

The column wheel's own geometry defects (TODO 4's inside-out pillars,
TODO 28's remainder), anything that changes what `userData.r` means for
the solid builders, and §66 part two's recorded residue — the live
re-measure of contact dots across pose changes.

**Battery: 14/14, boot silent, no page errors, fingerprint UNCHANGED at
2943480299** — measured against `main` at the rebase base (TODO 27's
merge), which hashes the same. The hash not moving is the load-bearing
number here: the tier grew ten polylines, three spiral glyphs and a
dial occluder, and the per-unit boxes did not shift — which is the
§66/§71 skip rules doing exactly what they promise. No geometry changed and no new mesh
joined a sweep: the one new Mesh is an occluder fill
(three-quarter-plate precedent), flagged and pruned by `collectUnits`
and by the fingerprint's walk, and the five flagged meshes in the scene
are exactly three base-plate fills, one three-quarter-plate fill and one
dial fill. Both §66 boot asserts stay silent — proxies are never Meshes,
and dropping the hairspring from the rotor pass leaves 64 rotor sites
against the required 10.

## §79 — Load with the network gone: the service worker, and the two things it did not break

The app was already the hard half of an offline app — everything it needs
is static and same-origin, no CDN, no webfont, no model assets, two
runtime network calls total (`version.json` and `/__state`), both written
to survive failing. §79 spent that: a stamped release now loads cold with
the network off — `index.html` and `explain.html` both, deep links
included — from a service worker cache, once any release page has been
visited online.

**The shape.** `sw.js` at the web root plus `manifest.webmanifest`,
registered from `main.js` (index) and a small inline script
(explain.html). Cache-first for the precached release set, network-only
for everything else — the cheap strategy that is CORRECT here precisely
because §28 exists: every asset URL is stamped `?v=<version>`, so a cache
hit is exact by construction, a new release asks for new URLs out of a
new cache (`timesim-<version>`), and activation drops the old cache
whole. Cache keys stay relative to the worker's scope for §28's stated
reason (the web root may be the QA symlink). The two documents are the
exception to exact matching: they are matched on path IGNORING query, so
`?lang` / §22-spec deep links load offline too.

**The precache manifest is a by-product of the §28 stamping walk** —
`stamp-release.mjs` collects every URL it rewrites and bakes the list
plus the version into `sw.js`'s two placeholder consts, failing the
release if either placeholder is missing (a worker shipped unstamped
would be silently inert). A hand-kept list was the failure mode the
entry named; now a file cannot be shipped and forgotten. Building that
walk found two classes of URL the §28 stamp had silently missed, both
now closed: **dynamic `import()` specifiers** (`src/inspect.js` — the
documented console entry for the battery — and the two `explain-i18n`
locale tables) and **all of `explain.html`**, whose two module imports
shipped unversioned and which carried no `app-version` meta. Both
documents now get the same rewrite and the same baked meta; the leftover
scan matches everything the rewrite does, per its own rule.

**The two things it must not break, kept, explicitly.** The fetch
handler passes `version.json` through by name — it is the staleness
detector, and a worker that answers it from cache makes the app
permanently and invisibly stale — and never touches `/__state`, because
`state.js` falls back to `localStorage` exactly when that fetch FAILS,
which is what offline means. Both exclusions are written in the handler,
not left to set-membership accident.

**One toast, and the Reload that crosses the worker boundary.** A
waiting worker and a `version.json` mismatch are the same event to a
viewer, so a waiting worker feeds the EXISTING §28 toast
(`checkForUpdate(true)`) rather than a second prompt. The toast's Reload
is now `swReload()`: nudge the registration, wait for the new worker,
promote it (`skip-waiting`), and reload on `controllerchange` — because
with the active worker serving `index.html` cache-first, a bare
`location.reload()` would land on the exact stale bytes the toast warns
about. Two measured races shaped it: `update()` can resolve before
`reg.installing` is even populated (so the dance waits for the
registration to ANNOUNCE the worker via `updatefound`, bounded at
4000 ms only for the no-announcement case — sized after 1500 ms flaked
under a concurrently-running battery, and benign to overrun: a plain
reload re-shows the toast rather than losing the update), and
registration now passes
`updateViaCache: 'none'` because a host serving `sw.js` with no
`Cache-Control` leaves update checks heuristically fresh — `sw.js` is
the update signal, so it gets `version.json`'s treatment. The scripted
acceptance run also caught the toast itself sitting UNDER the HUD panel
(z-index 9 vs 10) — a prompt whose one job is to be clicked, swallowed
on short viewports; it now stacks above (11).

**Two deltas from the filing.** (1) The dev-server `Clear-Site-Data:
"storage"` belt-and-braces was NOT shipped: measured, `localStorage` on
loopback genuinely carries the §73 locale choice, `aestheticsOverrides`,
and §23's `aestheticsBootPending` reboot handshake — the directive has
no worker-only granularity and would have broken the §23 tuning reboot
on every dev load. Its job moved into the worker itself: an unstamped
`sw.js` is INERT (VERSION null caches nothing, intercepts nothing) and
self-dismantles (install → activate → `unregister()`), so a worker
hand-registered against `:8347`'s editable sources does not survive to
shadow an edit. (2) Registration is gated on the baked `app-version`
meta rather than probing `version.json` — same release-only signal,
zero network, and it works identically for both documents now that
explain.html is stamped.

**Measured — and the measurement is now an instrument:**
`tools/offline-check.mjs` builds two stamped trees from the working
tree, serves them behind a repointed symlink (the QA topology, headless
Chromium), and asserts all of the below; run it when touching `sw.js`,
`stamp-release.mjs`, the registration, or the toast. It is not in the
PR battery because it exercises the release machinery the battery's
source tree deliberately never runs. One trap it encodes: the two trees
are stamped seconds apart, so tree A is BACKDATED 10 s —
`Last-Modified` has one-second granularity, and same-second trees make
every conditional revalidation answer 304, which reads as a broken
reload dance but is an artifact no real deploy can produce. 17/17:
worker controls on first
load; one cache named for the version; `version.json` and `/__state`
absent from it; precache complete at 18 URLs; offline reload boots the
movement; offline `?lang=de` deep link boots; offline `explain.html`
renders; deploy → toast via focus poll; Reload lands on the NEW version
with the old cache dropped; the source tree registers no worker; a
hand-registered stub unregisters itself having cached nothing; console
silent throughout (rule 6) in both trees. Battery: no geometry, no
`MECH_GRAPH`, no layout change — the only `src` diffs are the
registration, the toast handler, and the toast's z-index.

## §80 — The swept registry stops paying by the vertex, and the bill turns out to be somewhere else

**The entry that planned this was right about the registry and wrong about
why it mattered**, and the second half is the more useful finding. The plan
opened "`buildSweptRegistry` is the battery's most expensive instrument."
It is not. It was 3.5% of the check that was blowing CI, and the fix below
— an 18× one, verified byte-identical — moves that check by about that
much. The other 96.5% is named at the end and filed as roadmap §82.

### What the registry was paying

Measured on the shipped tree (dev container, 4 vCPU) by instrumenting the
build rather than reasoning about it:

| phase | s | what it is |
|---|---|---|
| coarse sample | 11.6 | 108 poses × every vertex of every mesh, stored |
| derive | 3.5 | the volumes, read back out of those frames |
| fine sample | 22.7 | 261 poses × the same, stored again |
| validate + two demotion passes | 5.6 | three more reads of the fine frames |

**78% of the build is sampling**, and the shape of the storage is why. The
scene collects 608 meshes holding 640,558 vertices, so one frame is
~15.4 MB of `Float64Array` and the build holds **369 of them — about
5.7 GB — alive at its peak**: the coarse 108 stay referenced through the
whole function, and the fine 261 are read three times, so they all have to
exist at once. That is what "3.0× the vertices bought ~4× the wall clock"
was really reporting — allocation, not arithmetic.

### The two reductions, both exact

**1. A mesh's POSE STATE — its geometry object plus its world matrix.**
Equal at two poses ⇒ equal world vertices, to the last bit, because it is
the same arithmetic over the same inputs. The sweep transforms once per
state and shares the frame. It is worth so much because of how the axes are
built: each `AXES` entry PINS the state every other axis varies, so a part
only the alarm crown moves stands perfectly still through the other eight
sweeps and used to be re-transformed ~300 times into the same place.
Measured over a whole build: **26,132,459 vertex transforms against
232,495,398 — 88.8% of them were repeats.** The coarse sweep now holds
5,882 frames instead of 55,188, which is 7.27 M stored vertices (~174 MB)
against 236 M (~5.7 GB).

It rests on geometry IDENTITY standing for geometry CONTENT, which is not a
new trust: `bvhFor` caches by geometry the same way, and MODELING.md rule 6
already forbids the in-place morph ("build the states as distinct geometry
objects") for exactly that reason. The mainspring and hairspring obey it
with a pool of wind frames and the chain with a fresh geometry per rebuild,
so a morph reads here as a NEW state — which is what rule 6's "a part that
changes SHAPE is a moving part" demands.

**2. The fine sweep is streamed — it stores nothing at all.** Its three
consumers never wanted points: the containment pass wants a verdict, the
sleeve dilation wants a worst overshoot, the demotion pass wants an r band,
a z band and the sweep's own extent. So each vertex is transformed, asked
its questions and dropped. Two consequences that had to be designed rather
than fallen into:

- The containment test no longer stops at the first escaping vertex for
  path and revolve volumes, because the later passes need quantities
  measured over the WHOLE sweep. It still stops for static and approx,
  whose only product is the verdict.
- The sleeve's containment test and its dilation became one measurement.
  `best` is a vertex's Chebyshev distance to the nearest box of the sleeve
  (0 inside), so containment is `best ≤ tol` — with the same early break the
  boolean loop had — and the overshoot is the largest `best` over the sweep.
  One number, both answers.

A third, smaller reduction: `buildPathHull` takes the per-pose BOXES now
instead of the per-pose points. It always did, arithmetically — its first
act was to reduce each pose to its six extremes — so this only moves the
reduction to where the numbers are measured. Both call sites had to move
together and the first patch moved one: a 3n-long point array reads as a box
whose first six numbers happen to be vertices, which produced wrong sleeves
with every downstream count still plausible (43 escapes became 62, silently).
Six is the contract, so six is checked now.

### The rule the walk had to obey, which is this entry's real trap

The obvious way to strip the fine sweep is extra laps — one to find the
escapes, one to measure their overshoot, one to re-grade. **There is no
budget for a third lap, and not because of its cost.** Some of what
`setPose` writes is CUMULATIVE: TODO 20's alarm column advances a step each
time a pose flips the parity, so its angle is a function of how many flips
came before. The pose a walk lands on depends on the walk HISTORY as well as
on the axis fraction, and the registry's numbers depend on the coarse walk
running first and the fine walk second, exactly twice. Insert a lap and
those parts are re-posed and the result moves. That constraint is now
written at `walkPoses`, because nothing in the file said it and the next
person to optimise this will reach for another lap first.

So everything a later pass could want is accumulated on the lap already
running — including `rzWhy`, the first r-or-z escape in pose-then-vertex
order, which lets the demotion pass ask its question of numbers instead of
of a stored sweep.

### What it cost and what it bought

Same page, same order, no contention:

| | before | after |
|---|---|---|
| `sweptRegistry` (first check on a fresh boot) | 63.8 s | 3.5 s |
| frames held at peak | 369 full (~5.7 GB) | 5,882 shared coarse, 0 fine (~174 MB) |
| `stockFloor` | 44.4 s | 3.2 s |
| `restoring` | 22.6 s | 3.1 s |
| `sweptOverlap`, confirm tier off | 41.0 s | 2.8 s |

Every one of those reports is **byte-identical** on the shipped tree — the
registry's 608 volumes in the same 200 revolve / 193 path / 215 static
split, the same 43 containment escapes, the same 0 still escaping, the same
z bands and `reversed` flags; `stockFloor`'s 507 rows and 64 waivers;
`restoring`'s 24-unit population. The fingerprint is unchanged at
1436114427 and the full battery is 14/14. That identity was the acceptance
and it is the only reason the speedup is worth anything: a cheaper registry
that is also a blinder one is a regression wearing a stopwatch.

The build now reports what it saved, in a `sampling` block on the registry's
own output. The ratio is a property of the MOVEMENT — how much of the scene
each pose axis leaves standing still — not of the code, so it is measured
rather than assumed.

### What this did NOT deliver, and where the time really is

The plan's acceptance ended "wall clock is back near the pre-TODO-27 figure
or better, and `CHECK_TIMEOUT_MS` … drop it to 20 minutes again in the same
change." **That is not delivered and the guard stays at 45 minutes**,
because the premise under it was wrong. Splitting `sweptOverlap`:

| phase | before | after |
|---|---|---|
| build the §36 registry | 63.8 s | 3.5 s |
| all 59,216 static-vs-swept hull pair tests | ~0.1 s | ~0.1 s |
| the CONFIRM TIER | ~1750 s | ~1750 s |

The whole hull phase — registry plus every pair test the check exists to run
— is 2.8 s. Everything else is fifteen raw hull overlaps each re-measured by
an **uncapped** `measureClearance`: a BVH sweep over all nine pose axes with
refinement, with TODO 27's 46,144-triangle chain on two of them. The check
measured 1816 s standalone before and 1988 s inside the battery after, which
says exactly what it should — the confirm tier's own run-to-run spread is
larger than the 60 s §80 removes from it.

Nothing in §80's scope reaches that, and the two obvious ways to reach it
(capping the query at `CLEAR_MARGIN + refineBand`, or batching the fifteen
pairs into one `sweepClearances` call) both CHANGE the reported numbers,
which is the one thing this entry's own rule forbids. So it is filed whole,
with its measurement, as roadmap §82 — and the comment at `CHECK_TIMEOUT_MS`,
which used to read "the cost is the §36 registry's own", now says what the
cost is.

One further finding fell out of the reduction and is filed as **TODO 34**.
Reducing the sleeve re-validation to the single comparison that decides it
makes plain that it cannot fail: growing every box by `g` takes a vertex's
distance from `best` to `max(0, best − g)`, so "still outside" means
`best > g + tol`, and `g` is `2·over + tol` where `over` is the largest
`best` that same sweep produced. The old comment there conceded the pass was
"partly self-fulfilling" while calling it "the honest arbiter". It is
neither — it is vacuous by construction, for any geometry. The pass is kept,
with the algebra written at it, because an assertion that cannot fail should
say so rather than quietly disappear.

## §81 — The battery welds its vertices and stops running in single file, and the only thing that moved was a name

Two independent reductions, both required to leave every reported number
alone. Measured on a 4-vCPU dev container, the full battery went **3525.6 s
(58.8 min) → 1588.1 s (26.5 min)**, 2.22×, with the final report **identical
to the pre-change one — every check, every row, every number**, fingerprint
`1436114427` unchanged. That identity is the acceptance; the stopwatch on its
own would prove nothing.

On `ubuntu-latest`, where the gate actually lives, the same tree takes 36.7 min
against a job that had been **dying at its 45-minute cap** — six runs, two of
them pushes to main. The gate runs again. Read the dev-container numbers in
this section as ratios: that machine is ~1.45× faster than the runner, a
difference this entry got wrong once and paid for (see the last section).

### Tranche A — the weld, and its real ceiling

`ExtrudeGeometry`, `toNonIndexed()` and hand-written soup all store a vertex
once per adjacent triangle. `weldGeometry` merges vertex slots that are
**bit-equal across every component of every attribute** and emits an index.
Three properties make that exact rather than approximate: nothing moves (so no
clearance can be under-reported — the one error direction nothing downstream
catches); the triangle list is unchanged, so no mesh opens and TODO 27's parity
trap has no purchase; and the sampled points are the same SET, which is all
`sampledVerdict`'s min-over-vertices and or-over-containment can see.

It runs as a traversal at the end of boot, because there is no chokepoint to
run it in — 315 `new THREE.Mesh(...)` sites, no factory. The cost of a
traversal is that it only sees the graph, so `weldAssert` warns at boot
(standing rule 6) if anything reaches the scene non-indexed. Two things weld
themselves: the CHAIN welds its three TEMPLATES rather than its output (it is N
rigid copies rebuilt every frame — welding the output would move a boot cost
into the frame loop; its bore assert now reads through the index instead of
assuming soup), and the flute slider welds each re-cut hand. Already-indexed
geometry is skipped, which keeps the pass out of the mainspring's and
hairspring's wind-frame pools entirely. `mergeGeos` emits indexed output.

**The entry's ≥2× target was not reachable, and the reason is that the entry
contradicted itself.** It predicted 656k → 250–300k while also requiring that
"split normals survive by construction". Those are incompatible: the ~3–6×
duplication it costed is recoverable only by welding on POSITION. Measured over
the scene's 488 distinct geometries:

| | pre-weld | welded |
|---|---|---|
| raw vertices | 653,950 | 458,897 |
| distinct attribute tuples | 437,566 | **437,566** |
| distinct positions | 124,998 | **124,998** |

29.8% removed, against 80.9% a position-only weld would reach. The whole
difference is split normals — `ExtrudeGeometry` calls `computeVertexNormals` on
soup, so two quads meeting along a contour edge share a position and disagree
about the normal. They are not duplicates; they are the shading model, and
merging them would smooth every crease in the movement. The crease is kept and
the ceiling is written at the code.

The two bottom rows are worth more than the top one: they are **equalities**,
and they are the proof the argument above is not just an argument. Tuples
unchanged ⇒ not one split normal merged or invented. Positions unchanged ⇒
`sampledVerdict`'s sample set is exactly what it was.

A screenshot comparison was tried first and is not usable at this precision:
the same tree rendered twice through SwiftShader differs in **3.2%** of its
pixels, against 1.5% for the weld — the camera-preset tween and the software
rasteriser are noisier than the signal, so the control drowned it. The tuple
count is the instrument; the pixels are not.

### Tranche B — the shard

`ci-battery.mjs` partitions the checks across K browser contexts by a measured
`cost` column and runs them concurrently, so the wall is max(shard) rather than
sum(checks). The partition is DATA, so it re-derives itself when the column
moves instead of being re-argued; LPT greedy over it, which converges on
`{sweptOverlap}` against `{the rest}` because one check is 57% of the total.
That also bounds what sharding can ever buy: **no K goes below the slowest
single check**, since no check is subdivided.

It is sound for one reason: `start()` calls `clock.resetInputs()` before every
check, so nothing a check can observe depends on which ran before it. (It has
to — some of what `setPose` writes is CUMULATIVE, §80's finding at `walkPoses`.)
Verified rather than assumed: `--shards 1` against `--shards 2` on one tree is
byte-identical. If that ever stops being true, the check that moved is the bug.

Boots are serialised against the dev server's single `/__state` file; gates are
still evaluated in canonical `BATTERY` order so the log does not depend on the
partition; each shard catches its own failure so one dying shard does not
discard what the others measured; the fingerprint double-boot is deliberately
not sharded.

`--report FILE` writes every check's full payload. **That, not the PASS/FAIL
column, is what a performance change has to be accepted against**: a gate
reports only whether its failure list is empty, so a report that moved while
staying empty passes every gate and is still a regression. Both §80 and §81
were landed by diffing one of these.

### What actually broke, which was not geometry

The weld was geometrically exact on the first full run and **still turned a
gate red**. Diffed against the pre-weld report, the entire difference was 19
rows and not one was a distance, a count or a verdict:

- 4 `clearances` rows relabelled `ExtrudeGeometry#0` → `BufferGeometry#0`, same
  measured distances;
- 14 `intraUnit` violations — exactly the `INTRA_UNIT_CONTACTS` rows declared
  against `ExtrudeGeometry#N`, re-reporting their DECLARED joints as fresh
  interpenetrations.

`meshLabel` names an unnamed mesh `${geometry.type}#${index}` and the
hand-written tables are string-coupled to those labels. This is CLAUDE.md's own
"inspect.js couples by string" trap reached from a direction it does not list:
not by renaming a part, but by **rebuilding its geometry**. The fix is to carry
`geo.type` onto the welded copy — the tag is PROVENANCE, which builder cut this
surface, and provenance is precisely what a weld does not change. Rewriting the
tables to `BufferGeometry#N` was the alternative and would have collapsed
`CylinderGeometry#6` and `BoxGeometry#31` into the same undifferentiated name,
destroying the information the label exists to carry.

### The timings, and the two guards that DO NOT come down

| check | dev before | dev after | CI after |
|---|---|---|---|
| sweptOverlap | 2075.5 | 1532.7 | **2184.6** |
| inspection | 768.8 | 607 | 976.2 |
| clearances | 455.7 | 395 | 628.5 |
| expectedContacts | 145.4 | 147 | 211.6 |
| support | 32.4 | 22 | 37.0 |

Two of the entry's own cost-table rows were already stale before any of this
(`inspection` 985 → 769, `clearances` 497 → 456), which is the case for the
column being measured data rather than a hand-argued partition. CI is ~1.45×
slower than the dev container across the board (4082.8 s of check time against
2807.8 s for the identical tree), which does not disturb the partition — that
is decided by ratios, and the CI run splits 2184.6 s against 1898.2 s.

**The entry's last acceptance line is not delivered, and the way it failed —
twice — is the more useful half.** `battery.yml` was to return 60 → 45. It was
changed to 45, with `CHECK_TIMEOUT_MS` re-derived 45 → 40 to keep the required
ordering, and both were **reverted before shipping** when the first CI run
showed the derivation had used the dev container (battery 26.5 min,
`sweptOverlap` 25.5) while `ubuntu-latest` gave 36.7 and 36.4. A 40-minute
WEDGE guard would have had 1.10× of headroom over a healthy run, and a
45-minute cap 1.20× over a 37.5-minute job — the ratio that killed runs
188–194.

**Then the correction was wrong too.** The revert was written up as
"`ubuntu-latest` is ~1.45× slower than the dev container", a tidy ratio from
one run. The next CI run of the same harness on the same tree took **2459.1 s
of check time against 4082.8 s — a 1.66× spread between two CI runs**, wall
22.3 min against 36.7. The dev container (2807.8 s) sits *inside* CI's own
spread. There is no ratio to correct for, only a distribution.

| | checks | wall |
|---|---|---|
| dev container | 2807.8 s | 25.7 min |
| CI run A | 4082.8 s | 36.7 min |
| CI run B | 2459.1 s | 22.3 min |

So the rule, written at the constant because two successive attempts tripped on
it: **a guard is sized by the slow tail of the environment it runs in, and one
run does not measure a tail.** Both wrong answers came from a single *green*
run — which is the trap, because a green run is exactly what makes a too-tight
guard look justified right up until it fires on a healthy build.

And the structural reason sharding cannot buy those numbers, which is worth
separating from the mistake: the wall is now `max(shard)`, but both timeouts are
set by the slowest single CHECK, and no partition subdivides a check.
`sweptOverlap` is 57% of all check time and 36.4 min on CI by itself. Sharding
moved the wall 2.2× and moved neither timeout. That is roadmap §82's to move —
when it does, re-derive both together, from a CI run.

What §81 does deliver on this front is the thing the entry actually asked for
in its first paragraph: the job went from **dying at 45 minutes** — six runs,
two of them pushes to main — to finishing in 37.5. The gate runs again.

---

## §83 — Three things the schematic was already saying, two of them wrong and one of them frozen

**Filed from an owner walk-through of the line tier**, same origin as §78
and the same shape: none of these three is a part the drawing OMITTED.
Each is a part the drawing already had a mark for, and the mark was
either the wrong word or the right word held still. That distinction is
what decides the fix — an omission is closed by adding a pass, a wrong
word is closed by RETIRING one, and §78's rule is that overdrawing
leaves the wrong glyph in place underneath.

### Part one — the escape wheel, drawn as a circle through its own tooth tips

`makeEscapeWheel` records `userData.r = radius`, so §66's generic rotor
pass enrolled it and drew a brass pitch circle plus a spoke. For every
other wheel in the train that is exactly right: a gear's content IS its
pitch radius, which is what makes the tooth counts multiply. For this
one it lands a plain circle on the tooth tips at r 4.5 and says "a rotor
of radius 4.5" — true, and the least interesting true thing about the
one wheel in the train whose entire content is its profile.

Same argument §78 made for the column wheel, and the same glyph: **the
boundary of the cut**. The builder now exports

```
userData.profile = { poly: shape.getPoints(CURVE_SEGS), hubR, boreR }
```

where `shape` is the Shape the extrude is cut from and `CURVE_SEGS` is
the extrude's own `curveSegments`, so the line and the metal are one
description at one tessellation — 130 points over 15 teeth, radius
sweeping 3.06 (`baseR`, the scallop bottom) to 4.5 (the club tip).
`closePath()` already carries the polyline home, so the loop closes as
it stands. Drawn at the wheel's MID-PLANE, which is where the extrude's
own `translate(0, 0, −thickness/2)` puts z = 0 and where a section line
belongs; one line per wheel, not a face pair.

Two additions from looking at the render rather than the plan, exactly
as §78's base disc was: the hub (0.72) and bore (0.5) rims. A ring of
teeth with nothing inside it reads as an annulus, and the bore is where
the arbor it rides actually is.

It is drawn in the WHEEL palette, not the lever's. The escape wheel is
still a member of the going train, and it stops reading as one the
moment its outline is the only train part in steel.

**What the drawing now shows that it could not before:** the club heel,
the slanted impulse face and the undercut locking hook — the three
surfaces §16's pallet stones are cut against — going past the fork,
fifteen times a turn, in the mechanism a viewer opens the schematic to
watch.

### Part two — the two crowns, drawn as gears, on stems drawn as nothing

Two halves, and the worse half is not the missing one.

**The stems were absent.** Each is a plain `CylinderGeometry` in a unit
no pass covers — §71's `discOrAxis` enrols eight named units and neither
`Keyless works` nor `Alarm crown` is one — so the winding train ended at
the pinion and the alarm's bevel corner ended at its bevel, both hanging
in air at the plate rim. Each is now one axis line in its SPINNER's
frame, spanning the length the cylinder was cut to (`stemLen` /
`alarmStemLen`, each `plateR + 2.2` less its own inboard station — the
winding pinion's, the alarm climb's). Parented to
the spinner, which is the group `tick()` already both slides (the crown
pull) and spins (the winding turn), so the drawing carries both with no
second copy of either state.

**The knobs were worse than absent.** `makeCrown` records
`userData.r` — its knurl crest, which is the clearance envelope §27
proved — so the rotor pass enrolled both crowns and drew each as a pitch
circle plus a spoke in the plane ⊥ the stem. A gear, on the only two
parts of this watch a hand touches, and neither of them a gear.

The word a crown wants is a BARREL, and the builder now exports the
numbers it is cut from:

```
userData.crown = { rimR: 5.537, bodyH: 4.55, capR: 5.075, faceZ: 5.1 }
```

drawn in the knob's own frame (local +Z outward along the stem, which is
what the −π/2 mount at both call sites arranges): the two rims, the
chamfered cap's face rim, and four meridians running rim → rim → face.

Two decisions inside that are not taste:

- **The barrel radius is the knurl CREST, not `bodyR`.** The crests are
  the silhouette an eye sees and the radius every clearance row is
  written against (`R_BUDGET` in `makeCrown`); drawing `bodyR` would
  understate the part by the 0.112 the ridges stand proud of it.
- **The meridians are structural, not decoration.** A circle about the
  spin axis is invariant under the spin, so a knob drawn as rings alone
  would turn invisibly — and turning is the one thing this part DOES.
  The same reasoning as §66's spoke on every pitch circle, arriving at
  four lines instead of one because a barrel has length.

`CAP_DROP` was named in passing: the chamfer's 0.35 was spelled twice in
`makeCrown` (the cap cylinder and the face mark's span) and is now read
by a third party, and rule 1 does not survive a constant with three
readers and no name.

### Part three — the hairspring, drawn at rest while the balance swung

§78 shipped the spiral glyph and declared this residue in its own words:
"the hairspring's glyph is drawn at REST. The breathing swaps a
precomputed geometry frame rather than posing a group, so the proxy
cannot ride it for free — the same residue class as the gong's boot arc
and the contact dots' re-measure-on-entry."

That comparison was the part worth revisiting. The gong's arc is stale
only against a live aesthetics edit and the dots are stale only between
mode entries; **this one was stale against the tick**, on the movement's
only continuously moving spring, in the one view whose whole claim is
that it draws the model the tick poses. And the fix was already written
in the same section: the mainspring closed exactly this residue by
publishing its wind frames as polylines and rewriting the drawn line on
each swap.

So `makeHairspring` publishes its own. The frames' polylines are pushed
from inside `spiralGeo`, the function that builds each tube — not
re-derived alongside it — so the line and the tube for frame *k* cannot
come from different sweeps: 41 frames, 481 points each, the same
`hairspringSegs` sampling `restDevLen` is accumulated from. `setWind`
now tracks the frame INDEX rather than comparing geometry identity,
publishes it (`userData.spiralFrame`), and writes the line.

`writeSpiralLine` is the one writer, shared with the mainspring, which
is where the duplicated buffer-rewrite went. Every frame of a given
spring has the same point count — the sampling is a property of the
plan, not of the wind state — so a swap is a rewrite in place with the
bounding sphere recomputed, never a reallocation.

The plan stays what it was. `userData.spiral` is still the REST spiral,
because that is the geometry TODO 25's rate solve turns on and the
three-spring tripwire counts; `spiralFrames` is what the metal is
actually wearing. A caller that finds frames must use them — §78's own
rule, since the linear parametrisation is only true of the free coil.

**Measured**, by sweeping one full beat cycle through `setPose` and
reading the drawn line rather than the tube:

| tension | frames the line visits | θ span |
|---|---|---|
| 1.0 | 4…36 (33 of 41) | ±0.80 rad |
| 0.25 | 10…30 (21 of 41) | ±0.50 rad |

The line's points match the frame it claims to be wearing to 2.4e-7 —
Float32, i.e. exactly — and its inner end travels with the collet while
its outer end stays pinned at the stud, which is the entire mechanical
claim the spiral is making. The second row is the one worth keeping: the
amplitude falls with tension (`balanceTheta(tau, tension)`), so a
running-down watch visibly breathes less, and the drawing now says so.

### What did not change, and why that is the check

No mesh moved and no geometry changed: `capTopR` is `bodyR − 0.35`
spelled once, `CURVE_SEGS` is the 3 the extrude already used, and
`setWind`'s new early-out is index equality where it was geometry
identity — the same swap on the same frames. Every proxy this section
adds is a `Line`, which no instrument collects, and every one is flagged
`userData.schematic`, which `collectUnits` prunes.

So the acceptance instrument is the one CLAUDE.md names for a change that
should not have moved anything: `--report` before and after, diffed, not
the PASS/FAIL column. **Measured, both at 15/15 gates:**

| | baseline (`1ab933c`) | §83 |
|---|---|---|
| gates | 15/15 | 15/15 |
| geometry fingerprint | 2217227919 | 2217227919 |
| report payload, `ms` stripped | 410,933 bytes | 410,933 bytes |
| differing paths | — | **0** |

Every check's full payload matches — not just every failure list being
empty, which is all the PASS column would have told us.

Two notes for the next person who runs this comparison. Both runs used
isolated `/__state` files (`TMPDIR`): the app auto-saves every 5 simulated
seconds from `frame()`, and `dev_server.py` puts its state file in the
system temp dir, so two concurrent batteries share one — letting one run's
save reach the other's *virgin* boot, which is the one thing the
fingerprint gate depends on being virgin. And the wall clock is not
comparable between them: run them concurrently on a 4-core box and both
shards roughly halve in throughput (`inspection` 815 s, `sweptOverlap`
1963 s here, against ~46 s and ~1755 s for a run with the machine to
itself). That is why `ms` is stripped rather than compared.

The one behavioural cost is real and bounded: the hairspring's line is
rewritten whenever its frame index changes, 481 positions plus a bounding
sphere. `setWind` is called once per tick, so that is **at most once per
frame** — the 2.5 Hz swing wants ~160 index changes a second and a 60 Hz
tick can only deliver 60 of them. It happens whether or not the schematic
is on, exactly as the mainspring's has since §78, and the alternative
(teaching `geometry.js` about a view toggle that lives in `main.js`)
buys the cost back by coupling the two files.

### The rule this leaves behind

§78 established that a generic glyph is a claim and a builder may opt
out of one by exporting its own. That opt-out was a single hard-coded
test for `userData.spiral` in two passes. It is now a NAMED SET —

```
const OWN_GLYPH = ['spiral', 'profile', 'crown'];
```

— consulted through `SCHEMATIC.ownGlyph`, so the rotor pass and the §48
blade pass ask one question and a fourth word costs one string. Every
member skips the generic pass and draws its own, so a part still has
exactly one glyph and the wrong one is never merely covered up.

Both new words carry §78's tripwire shape: a FLOOR, not an equality.
The movement has two crowns and a boot warn fires below that, because a
knob that stops exporting its plan does not go undrawn — it falls back
to the very gear glyph this section retired.

### What this did NOT close

Four labelled units still draw nothing at all, and a unit's proxy count
is a weak proxy for "is drawn" besides. That census, and the instrument
that should be reporting it instead of a session's probe script, is
filed as roadmap §84.

## §88 — Three environments on one Pages site, and the cache name that could not tell them apart

The app had one deployed environment: `release.yml` cuts a tag, publishes
a GitHub Release, and uploads the tagged tree over SFTP to a QA host,
repointing a symlink at it. §88 adds three more on GitHub Pages —
development, testing, production — and the interesting part is that
almost none of the work was the deploy.

**The layout, and why it is legal.** GitHub Pages gives a repository ONE
site, so three environments are three paths, not three sites:

```
production   https://kelaiem.github.io/timesim/
testing      https://kelaiem.github.io/timesim/testing/
development  https://kelaiem.github.io/timesim/development/
```

That is only possible because §28 refused the obvious move. Its stamper
could have rebased every asset onto an absolute `/<releases>/<version>/`
path — the release directory as the fingerprint — and declined, because
whether that directory is inside the web root is not knowable from this
repo when the site is distributed as a symlink. URLs stayed RELATIVE and
carried `?v=<version>` instead. The consequence, unplanned and collected
here: the app can be served from an arbitrary subdirectory at an
arbitrary depth with no build-time knowledge of where. A subdirectory
environment needed zero changes to how a release is built.

**Where each environment comes from.** Every pointer is a git ref, so a
deploy is reproducible from the repository alone and no state hides in
Actions settings:

| environment | ref | moved by |
|---|---|---|
| development | tip of `main` | any merge |
| testing | the newest `major.minor.patch` tag | `release.yml` publishing |
| production | branch `production` | `pages.yml` run with `promote: <version>` |

The ladder is merge → cut a release → promote, and each rung is an act
somebody performs. Promotion is a `git push` of a validated tag's commit
onto `refs/heads/production` — a real branch anyone can read, log and
revert — not a setting. Development deliberately does not wait for
`battery.yml` on the same commit: it is the unstable tier and its job is
to show what `main` is right now. Testing and production carry tags, and
a tag is cut from a `main` whose battery already passed.

**Version strings are read from git, never invented** (standing rule 1,
applied to a deploy). Testing and production carry their release tag.
Development carries `git describe --tags` — `2.1.9-28-g4b64e7d`, which
states exactly what the tip of main is: twenty-eight commits past 2.1.9.
Nothing had to invent a scheme for "main's version", and because the
string changes on every merge it re-arms §28 layer 2's update toast and
rotates §79's cache for free.

**Which tooling stamps an old ref — the question this is the first thing
in the repo to have to answer.** The environment trees come from their own
refs, but `git archive` excludes `tools/`, so the stamper comes from the
CHECKOUT. `release.yml` looks like a precedent for "the release's own
tooling" — it checks out the tag and runs that tag's `stamp-release.mjs` —
but it never actually chose: it cuts the tag from `main` and deploys it in
the same run, so the two are the same bytes. Pages is the first thing here
that rebuilds an OLD ref.

Answering it "from the ref itself" is not a stricter option being declined,
it is impossible. No tag from 2.1.4 to 2.1.9 contains
`tools/build-pages.mjs`; 2.1.5 has no `offline-check.mjs` either; and
`stamp-release.mjs` genuinely differs between 2.1.7 and 2.1.9. Tag 2.1.9
does not know what an environment IS — it cannot emit `app-environment` or
the `noindex`. And a bug in the deploy layer could then only be fixed by
cutting and promoting a release, which for this particular file is not
hypothetical: §79 found the stamper silently missing two whole classes of
URL.

So the tooling is pinned to `main`, and pinning the checkout turned out to
be only half of it — on a `release: published` run the WORKFLOW FILE comes
from the tag too. `pages.yml` therefore dropped that trigger entirely and
`release.yml` DISPATCHES it on `main` instead (`gh workflow run pages.yml
--ref main`, which works under `GITHUB_TOKEN` because `workflow_dispatch`
is one of the two documented exceptions to the no-recursive-runs rule).
File and tooling now always come from the same place.

The cost, stated rather than hidden: the site is a function of the three
refs PLUS main's tooling, not of the three refs alone. Editing the stamper
moves production's bytes without production's ref moving. That is guarded
by review and by `offline.yml`, not by immutability — and the way to get
the audit trail back is to RECORD the tooling commit in `version.json`
rather than to pin it, which is deferred, not rejected.

**Why it rebuilds all three every run.** `actions/deploy-pages` publishes
one artifact that REPLACES the whole site; there is no partial deploy and
no previous state to merge into, so anything absent from the artifact is
deleted. Assembling all three from their current pointers on every run is
the only correct shape, and it buys idempotence: a re-run with no input
republishes exactly what the three pointers say, whatever the trigger
was. `tools/build-pages.mjs` finishes each extracted tree by running the
SAME `stamp-release.mjs` from inside it — the environments are stamped
releases, not a second kind of build, and a forked stamper is precisely
how the two topologies would drift apart unnoticed.

### The defect the topology exposed

`sw.js` named its cache `timesim-<version>` and, on activation, deleted
every `timesim-`-prefixed key that was not its own. That was right for
one environment per origin, which is all that had ever existed: dropping
per release IS §79's eviction policy.

**Cache Storage is partitioned by ORIGIN, not by path.** All three
environments share `kelaiem.github.io`. So each one's activation would
have deleted the other two's precaches — visiting development took
production offline-capable no more, and §79's guarantee would have held
for whichever environment was visited last and no other. Every existing
check stayed green while it did, because every existing check stood up
exactly one release at a time.

The fix is to name the cache for the thing that is distinct per
environment and identical across an environment's successive releases —
its scope path, which the worker already computed for its fetch handler:

```
const CACHE_PREFIX = `timesim-${SCOPE_PATH}-`;
const CACHE = CACHE_PREFIX + VERSION;
```

Per-release rotation within an environment is unchanged, and so is the
QA symlink (its scope is stable across releases because the symlink URL
is). Activation now drops two things and only two: ours from an older
release, and the pre-§88 flat name — recognisable because a version
string cannot contain the `/` a scope path always does. That second
clause is a one-time sweep for viewers holding a cache from a release cut
before this namespace existed; under the new scheme nothing claims those
keys, so without it they leak a whole app's worth of storage forever. It
cannot reach another environment's cache, because every one of those
begins `timesim-/`.

**The instrument, not the reasoning, is the deliverable.**
`tools/offline-check.mjs` grew a third tree — the same two stamped
releases it already builds, served at `/a/` and `/b/` on one origin,
which is the Pages topology reduced to what matters. It brings up `a`,
then `b`, and asks three things (20 checks now, from 17): one cache each
named for its own scope, both boot offline, console silent. The cache
name is also no longer writable in that file without saying where the
release is served from, which is the change stated as an API.

**And one of those three is the discriminator, which was measured rather
than assumed.** Run against the pre-§88 worker, the CACHE-KEY check fires
exactly as intended: it reads back a single key, `timesim-<b's version>`,
a's having been deleted out from under it. The OFFLINE BOOT check does
NOT fire — `a` still booted with no network in all three ways of asking
(reload; reload after a CDP `Network.clearBrowserCache`; a fresh page
after closing both), because `python3 -m http.server` sends no
`Cache-Control` and the browser answered from its own caches. That check
is kept, as a statement of the guarantee end to end, and its comment now
says it is not evidence about the service worker's cache by itself. The
alternative — leaving a cache-clearing line in that measurement says
changes nothing, so the check reads rigorous — is the failure this repo
spends most of `TODO.md` catching, one layer up.

**What it does to the SFTP release, which is the deploy that already
exists.** `sw.js` is the only functional file in this change that is
inside the release payload (`tools/` and `.github/` are excluded; the
three markdown files that ship are inert). `release.yml` and
`stamp-release.mjs` are untouched, and the two placeholder lines the
stamper rewrites are intact — a stamped tree still reports 27 URLs
versioned and 18 precached, as before.

The one behavioural change at QA is the cache rename, so the UPGRADE was
run rather than argued: tree A carrying the pre-§88 worker, the symlink
repointed at tree B carrying this one, which is exactly what `release.yml`
does. The viewer went `["timesim-0.0.0-qa-old"]` → toast → reload → lands
on the new version → `["timesim-/-0.0.0-qa-new"]`, still boots offline,
console silent. The orphan clause swept the flat cache on that first
upgrade, so nothing leaks and nothing needs doing by hand.

That sweep rests on one condition worth naming: QA's scope path is stable
across releases, because the site is distributed as a symlink whose URL
does not change. If QA were ever re-rooted at a different path, caches
left under the old scope would match neither clause — they contain a `/`,
so they are not orphans — and would sit there until the browser evicted
them.

### The payload, narrowed after the first deploy

§88 shipped serving exactly release.yml's payload, on the principle that
Pages and QA should not drift. The first real deploy showed what that
principle had actually published: the artifact listing carried `CLAUDE.md`,
`TODO.md` (213 KB of internal debt notes), `docs/BUILT.md`, `SPEC.md`,
`AESTHETICS.md`, `README.md`, `dev_server.py`, `test-geometry.html`,
`.gitignore` and both git hooks — three times, once per environment.

That was not a new policy so much as an old one meeting a new audience.
The same files already went to QA, but QA is reached by people who have
been given it and a Pages site is reached by anyone with the URL. The
deploy is what converted a payload decision into publication.

So the Pages payload is now NARROWER than the release's, and only ever
subtractively — nothing is added here that a release does not have. It
carries the app, `vendor/`, and the licences. Everything else is cut:
every `*.md` (repo documentation is not site content), `.githooks` and
`.gitignore` (clone-time tooling), and `dev_server.py` (inert when served
statically).

**`test-geometry.html` was cut and then put back, and putting it back cost
more than the line it took.** Auditing the payload turned up that it had
shipped in every release without ever being STAMPED: `stamp-release.mjs`
processed two documents, so that page's importmap and its
`./src/geometry.js` import were the only unversioned asset URLs in a
release — one page that could be served stale forever, which is precisely
what §28 exists to prevent. Cutting it made that moot; keeping it does not,
so it became a third stamped document instead. Its three URLs now version
(27 → 30 rewrites) and the page itself precaches (18 → 19), which is the
§79 count moving for a stated reason rather than drifting. Being in the
payload and being stamped are the same decision, and it had been half-made
since §28.

`build-pages.mjs` additionally marks it `noindex` in EVERY environment,
production included. The per-environment rule is about which deployment is
the canonical one to find; this is about the page — a per-part geometry
smoke test is a developer instrument, and no copy of it should turn up in a
search.

`LICENSE` and `vendor/LICENSE-*.txt` survive the `*.md` rule by being
extensionless and `.txt`, and that is not luck to be left to chance: a
published site carrying vendored three.js must carry its licences, so the
workflow asserts their PRESENCE in the same step that asserts the docs'
absence. A pathspec breaks silently — a new doc at a new path, someone
widening the archive — and the symptom, repo documentation served from the
site, looks exactly like a healthy deploy. Checked across the whole
artifact rather than per environment, so a leak into any one of the three
is caught.

**And then the same cut was made to the SFTP release, which is the better
end state.** Narrowing Pages alone bought the fix at the price of the
property the original shape was chosen for — the two deploys no longer
serving the same bytes — and left two pathspec lists to keep in step. The
question "should a deployed artifact carry the repository's documentation"
has the same answer at QA as on a public URL, so it is answered once:
`tools/payload.sh` holds the definition and BOTH workflows call it. Same
bytes by construction, and a list nobody can update in one place only.

"Same bytes" is measured, not asserted. Building tag 2.1.9 both ways —
release.yml's path and pages.yml's testing environment, same tag, same
stamper — and diffing the trees produces exactly three differences, all of
them the environment marks that are supposed to be there:

```
index.html    + <meta name="app-environment" content="testing" />
              + <meta name="robots" content="noindex" />
explain.html  (the same two)
version.json  {"version":"2.1.9"} → {"version":"2.1.9","environment":"testing"}
```

Every other file is identical, `sw.js` included — which means the two
builds agree on the precache manifest, the one thing a payload change could
plausibly have desynchronised.

Both deploys assert both halves — no doc in the payload, and `LICENSE`
plus both `vendor/LICENSE-*.txt` present. The second assertion is the one
worth keeping: those files survive the `*.md` rule only by being
extensionless and `.txt`, which is a coincidence, and a build shipping
vendored three.js must carry its licences whatever the rule happens to
match.

The obvious alternative, `.gitattributes` `export-ignore`, is the native
mechanism and would need no arguments at all. It was rejected for a
concrete reason: git reads that attribute from the tree BEING ARCHIVED,
and `pages.yml` archives old release tags. A tag cut before the file
existed carries no such attributes, so its payload would silently stay
wide — the same shape of trap as the tooling question above, and the same
answer: the definition comes from the caller, which is main.

### What this did NOT close

The environments only stop evicting each other once the release PROMOTED
to production contains this `sw.js`. Production serves an old tag by
design, and an old tag's worker still has the flat name and still sweeps
its neighbours — so between this landing and the first promote of a
release cut after it, development and testing keep losing their caches to
production's activation. It self-heals at the first such promote and
needs no action; it is written down because a green `offline-check` and a
still-evicting production are both true at the same time for a while.

`pages.yml` also cannot enable Pages on a repository where an
organisation policy forbids it — `actions/configure-pages` asks, and the
one-time Settings → Pages → Source = "GitHub Actions" remains a manual
prerequisite.

## §89 — The alarm spring stops turning with its barrel and starts winding against it

**Filed from an owner report on the line tier** — the alarm spring "doesn't
seem to wind and unwind realistically in schematic mode, but check regular
mode too; the mainspring looks realistic, model that similarly" — and the
report was right in both views, for one reason common to them. The
schematic was not the defect. It was drawing exactly what the metal was
doing, which was nothing.

### The finding — one member cannot wind

§25 A built this barrel as a SINGLE member: toothed body, arbor and ribbon
all in one rotating group, `alarmBarrelRotor`, whose angle is
`(ALARM_BARREL_TURNS − alarmBarrelWind)·2π`. So the coil turned *rigidly*
with the drum it sits in. Nothing about it changed shape between a full
wind and a dead barrel — the same spiral, at a different azimuth, at every
state of the alarm. `makeBarrel` said so in as many words, in the note on
the wind-morph arguments TODO 1 had added for the going drum:

> Omit them and the spiral is built exactly as before — which is what the
> alarm barrel wants: it is a single-member barrel whose whole body IS its
> wound state (its arbor turns with it), so it has no relative angle to
> morph against, and the two-member split that would give it one is filed
> debt.

That paragraph is the whole diagnosis, including the fix, and the "filed
debt" it points at was never actually filed anywhere — it existed only in
that comment and in the matching one at the build site.

**A ribbon with both ends on the same part cannot store anything**, and
the two views inherit that identically: the realistic view rotated a fixed
spiral behind the lid cutaway, and §78's spiral glyph quoted
`userData.spiral` — the free plan — because there were no wind frames to
draw instead. Winding is the RELATIVE angle between two members. There was
only one.

### The split taken — a fixed arbor, not a wound one

Two splits give a barrel a second member, and they are not equally priced.

A **going barrel** winds its ARBOR and holds it with a click; the body
delivers. That is the textbook alarm barrel, and it moves the winding
train's last mesh off the barrel rim and onto a ratchet on the arbor —
different centre distance, re-solved idler chain, a click and its spring,
all of it in position space with two plate lanes to re-probe. Layout work,
by the design-priority note's own definition.

A **fixed-arbor barrel** plants the arbor in the frame and winds the BODY
at its teeth. This movement already claims one: the going drum, whose
arbor is held by the set-up work while the chain winds its wall — TODO 1
built the static collar and hook that make its spring's inner end real,
and TODO 39, filed in this landing, records that the arbor CYLINDER under
them is still parented to the drum, so the drum states this arrangement
without quite modelling it.

The alarm's winding train already arrives at the barrel's rim (12/44
through two idlers), and the hold when it is not ringing is already the
striking wheel's lock, not a click. So the second split costs *nothing in position
space* — same station, same z, same two meshes — and buys the same thing
the first one would: an inner end pinned to the movement while the outer
end rides the body.

It is the second one. No part moved to get it, which is what makes this a
P0/P1 change rather than a layout change; the wound-arbor form stays filed
(TODO 37) as the thing that would earn this barrel a real click.

### What the barrel is made of now

`makeBarrel` grew two options, and one export:

- `arbor: false` — the builder stops putting an arbor inside the rotating
  group, because a static member cannot live in one.
- `arborBoreR` — floor AND lid are opened to that radius. This is the
  part that is easy to miss: the body used to be solid to r 0.33 at the
  floor and solid to the centre at the lid, and both faces were fixtures
  of the same group as the arbor, so nothing measured the fact that they
  passed straight through it. The moment the arbor stands still, those two
  faces are a MOVER against a FIXTURE, and `intraUnit` sees them.
- `export const barrelArborR = (radius) => radius · 0.09` — the arbor's own
  proportion, which the caller now needs *before* the body exists, since
  the bore is an argument to the builder.

At this barrel (pitch radius 6.6) that is an arbor of **0.594** and a bore
of **0.644** — `PIVOT_BORE_CLEAR` (0.05) over it, the same running
clearance every other journal in the movement is cut with, because that
is what the fit now is: the body turns on the arbor.

The ribbon bears **directly on the arbor**, with no collar. The drum needs
one — its ribbon is 3.24 tall over a 0.9 pivot, so the seat has to be
built up — but this arbor is already `2 × ALARM_BARREL_H` long and spans
the whole cavity, so a collar would add a second radius to justify and
nothing else. `springArborR` is therefore the arbor itself, and
`makeBarrel`'s own solve does the rest:

```
rib = q(outerR − arborR)/(1 + q),  q = 0.1/coils      ⇒ ribbonR = 0.09512
springInner = arborR + rib                             ⇒ 0.68912
```

so the inner coil's inner surface is at 0.68912 − 0.09512 = **0.594** —
the arbor's own radius, exactly. The ribbon is not near its seat; it is
on it.

`springWindSweep` is `ALARM_BARREL_TURNS · 2π` and that is not a second
literal: the body's angle IS `(TURNS − wind)·2π`, so the sweep and the
reserve are one quantity written twice. `tick()` closes the loop with the
drum's own line —

```js
alarmSpring.setWind(alarmSpring.sweepFull − alarmBarrelRotor.rotation.z);
```

— which is why the sense comes out right without choosing it:
`mainspringFrames` derives its handedness from "the body's rotation RISES
as the reserve FALLS", and this rotor's does.

### The numbers the family solved to

| quantity | value | what holds it |
|---|---|---|
| ribbon `ribbonR` / `pBind` | 0.09512 / 0.19024 | the section solve above |
| inner / outer radius | 0.68912 / 5.445 | the arbor, and the drum's bore |
| free / full sweep | 31.4159 → 42.4115 rad | 5 coils as cut, plus 1.75 turns of wind |
| developed length | 96.511 | the constraint every frame is solved against |
| `lenErr` | 4.8e-13 | the k-solve reaches that length at every frame |
| capacity `S` at full wind | 3.4718 | the annulus is nowhere near full |
| tightest coil pitch | 0.2108 vs 0.19024 bind | the turns never pass through each other |
| frames | 61 | derived: `maxStep` 0.187 stays inside one ribbon thickness |
| `cutSpread` | 0.05736 | tessellation residue, well inside the ribbon |

Every one of those is asserted at build time by the same `TODO 1` rule-6
asserts the drum answers, and boot is silent.

### The anchor, derived rather than placed

The inner end sits at a constant azimuth in the movement frame — that IS
the anchoring claim, and `makeBarrel` reports it as `innerAnchorAz`
(3π/2 here). The hook lug on the arbor is placed from it, one ribbon
thickness wide, its flank offset `atan2(lugW/2, lugR)` onto the +angle
side so the ribbon's end FACE butts it instead of overlapping it — the
going drum's `mainspringArborHook` derivation, part for part. Measured
across the wind range, the inner end holds world x within ±0.045 of its
anchor, which is the frame quantisation (half of `maxStep`) and nothing
else; the outer end sweeps the full 1.75 turns with the body.

### What the instruments say

Three rows moved in `INTRA_UNIT_CONTACTS`, and each is a real joint:

- `mainspringRibbon ⇄ alarmBarrelArbor` — the inner coil on its seat.
  Same statement the drum makes against its collar, which is invisible to
  this check there because it crosses a unit boundary (`Set-up work ⇄
  Mainspring drum`) and visible here because it does not.
- `mainspringRibbon ⇄ alarmSpringArborHook` — the butt joint above.
- `alarmBarrelArbor ⇄ CylinderGeometry#0` — the arbor planted in its
  boss, rewritten from the old `CylinderGeometry#6` label. It is now
  UNREACHABLE by a mover-vs-fixture check, because both sides are
  fixtures; the row is kept as the record, the same way TODO 1 kept the
  drum's wall-hook row.

And the §48 audit had never had an opinion about this unit, which is worth
more than the declaration that closes it. Measured on the tree before this
landing, the reversing population was 25 units and `Alarm barrel` was not
one of them: a ribbon that rotates rigidly reads to the §36 registry as one
more monotonic rotor, so the movement's second mainspring was passed *in
silence* by the audit whose whole job is to ask what brings a reciprocating
part back. This is standing rule 4's own warning arriving from a direction
it does not name — not "no axis moves it" but "nothing it does looks like
reciprocation" — and it is the same sequence TODO 1 produced on the going
drum, which also only became visible to the audit once its ribbon morphed.

The morph makes the wound↔run-down cycle a shape change; the registry flags
it (`mainspringRibbon:arc`, population 26), and the unit is asked the
question for the first time. It has an answer now, true in both directions:

> the ribbon IS the restoring element — its inner end is hooked to an
> arbor fixed in the frame and its outer end to the body, so the body's
> travel winds it; the alarm winding train (crown → climb → idlers → rim)
> is what carries it back the other way.

### The schematic got it for free, and that is the point

Nothing in `main.js`'s line tier was touched. §83 built one writer —
`spiralFrames` + `writeSpiralLine` — and the rule that a morphing part
draws its CURRENT FRAME, not its plan; the moment this ribbon publishes
frames, the spiral pass finds them, registers the line, and `setWind`
rewrites it on every swap. Both views now read the same wound state
because they are reading the same array.

### What this did NOT close

- **The torque is still authored**, exactly as TODO 32 says of the going
  spring — and now for the same reason, on a spring with the same
  published section and length. The ring's cadence is
  `ALARM_STRIKE_GAP = 0.42 s`, a literal; nothing derives it from
  `E·I·θ/L` on this ribbon. Filed under item 32, which already owns the
  class.
- **No axis WINDS this barrel.** `alarmStrike` runs it down (`setPose`
  derives the wind from the striking phase) and nothing anywhere poses the
  wind-up, so the sweeps only ever see one direction of a part that goes
  both ways. Filed as TODO 38.
- **The wound-arbor split** — arbor, ratchet and click, with the winding
  train re-routed onto it — is what would let this barrel hold its own
  wind instead of borrowing the striking lock's hold. TODO 37.
