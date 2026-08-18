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

**Both halves of that sentence went stale, and this is the correction.**
The DEFAULT flipped on 2026-08-11 ("The control HUD is on by default —
the watch arrives driveable"): `?hud=1`'s argument won for every arrival,
not just for a link that asked, so the pad is UP on arrival and `?hud=0`
is now the interesting parameter. The ROUTE changed at §110: the panel
row moved with View into `#view-hud`'s Advanced fold, and the pad's
primary control is now the chrome bar's **Dial** button, which sits in
view at all times — the panel row and the `D` key still work and land in
the same `setHud()`, so no path can disagree with another about whether
the pad is up.

Left in place above rather than rewritten, because §57's REASONING is
still the record of why the pad exists and what its default cost; only
its last four lines stopped being true. The lesson is the cheaper half:
a shipped section states behaviour as well as design, and behaviour
moves — this pair was caught by §110 reading §57 while wiring a second
control onto the same state, which is the only reason anyone looked.
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

## §87 — The hack rod’s mast is taller than the watch, and the ceiling is the plate cut

Shipped as timesim#173, closing §85’s P1 residue: the pin is derived,
built as metal, and the mast assert is green at every spec tested. Three
of this entry’s own numbers did not survive contact and one of its
acceptance criteria was wrong — the reconciliation comes first below,
and the plan as filed is kept after it.

### What was built, against what this entry planned

**The ratio is DERIVED per movement, not the flat 0.70 proposed below — and
the flat one BREAKS the shipped watch.** The table below reasons over the
handle range and concludes "one number covers the whole range: ≈ 4.18, or
0.70 · `SL_TAIL`". Measured, 0.70 fixes every moved station and drops the
shipped one's pivot so far that the crank sweeps its own bracket at **−0.159**
and the balance cock loses its seat. So the pin's fraction is solved from the
coupling the station actually achieves — a probe solve at the post reports
`|K|`, the mast fits when the stroke is under `headroom · sin ψ_target · |K|`,
and the fraction is that ceiling over the stroke, **capped at 1**. The cap is
the whole point: a movement whose coupling already affords the full stroke
keeps the post it always used, and takes none of a reduction that is a REMEDY
rather than an improvement.

| spec | `\|K\|` achieved | `HACK_PIN_K` | pin radius | mast top vs `TQ_TOP_Z` 8.5075 |
|---|---|---|---|---|
| identity | 0.9496 | **1** (capped) | 6.000 — the tail post, no second stud | 7.963 |
| `?escstep=-77.9` | 0.6305 | 0.6963 | **4.178** | 8.275 |
| `?escstep=-66.7` | 0.6635 | 0.7376 | 4.426 | 8.320 |
| `?balstep=27.6` | 0.6812 | 0.7607 | 4.564 | 8.350 |

The entry's predicted 4.18 for the worst station is right to three figures;
what it got wrong is that the same number must not be applied everywhere.

**The acceptance criterion "identity's fingerprint moves deliberately" is
WRONG, and the build proves it.** Identity's proportions do not change,
because the cap leaves them alone: the shipped movement hashes **1307831341**,
bit for bit, before and after. `HACK_PIN_K === 1` hands the post back
untouched rather than computing `pivot + (post − pivot)·1` — `a + (b − a)` is
not `b` in IEEE754, and this is the same care `cockDiscsAt` already takes.
A fingerprint that MOVED here would have meant the pin was taking stroke
identity did not need.

**The pad drop is re-solved, and the achieved value is filed as arithmetic**
(in `src/main.js`, at the drop assert, TODO 16's format). It is two terms and
the pin moves both:

```
drop = padLZ·(1 − cos ψ0) − edgeY·sin ψ0
padLZ = HACK_CONTACT_Z − Z_STOP_PIVOT        edgeY = STOP_PAD_Y + HACK_PAD_TOP_R·sign(sin ψ0)
```

| spec | `Z_STOP_PIVOT` | `padLZ` | ψ0 | `STOP_PAD_Y` | tilt | swing | drop |
|---|---|---|---|---|---|---|---|
| identity | 7.1133 | −1.8633 | 0.5016 | −1.5694 | −0.2296 | +0.5796 | **0.3500** |
| `?escstep=-77.9` | 7.4250 | −2.1750 | 0.4852 | −1.6528 | −0.2510 | +0.6010 | **0.3500** |
| `?escstep=-66.7` | 7.4701 | −2.2201 | 0.4708 | −1.6682 | −0.2415 | +0.5915 | **0.3500** |
| `?balstep=27.6` | 7.5004 | −2.2504 | 0.4707 | −1.6755 | −0.2447 | +0.5947 | **0.3500** |

`padLZ` deepens 17–21% and ψ0 falls 3–6% at every moved station, so the entry
was right that the drop is not scale-invariant; `STOP_PAD_Y` answers by moving
0.08–0.11 outboard, and the achieved drop is `HACK_DROP_MIN` **exactly** at
every station, because `STOP_PAD_Y` is solved to bind it there. The floor is
met with no margin by construction — a drop that came out ABOVE 0.35 would
mean the solve had stopped binding, and deserves the same look as one below.

### Three things this entry did not foresee

**1. Two studs on one arm cannot have two slots.** The pin crosses the base
plate exactly as the tail post does, and its own stadium slot overlaps the
post's long before the studs overlap: at `HACK_PIN_K` 0.696 they stand 1.82
apart and their slots ask for 0.74 and 0.80 of radius. Overlapping holes in a
`THREE.Shape` are not a wider opening but a broken one — measured, the inner
stud came out with **0.05** of clearance against the 0.17 its own slot
specifies. Even drawn cleanly the land between them is **0.276**, a sliver of
a 2-thick plate, and §62's rule that the land between two openings is a MEMBER
applies here too. `makeBackPlate` gained a `sectors` opening: the arm's radial
band swept through the crown stroke, dilated by the stud radius and the
margin. Both studs now measure **0.170** — `CLEAR_MARGIN` plus the same 0.02
the post's slot always carried — across the whole stroke.

**2. The base plate's cut had to be DEFERRED.** Its last opening is not known
until the stop work has reported its coupling, which is ~1500 lines after the
plate was being built. The plate's PLANE stays where the layout needs it
(`BACK_PLATE_Z`/`BACK_PLATE_T`); the cut moved down to the linkage. Nothing
between reads the mesh, and the unchanged identity hash is the proof.

**3. The kinematics-only commit left the linkage solved for the pin and DRIVEN
from the post.** Two sites: `tick()` passed `tailPostWorldAt(crownPullT)` to
`updateStopWork`, and the reconfigure shadow spread the candidate keyless
cluster's post-level inputs over `STOPWORK_INPUTS`, overriding the reduction.
Both are fixed — the pin derivation is a FUNCTION of the inputs now
(`onHackPin`), so boot and the shadow ask the same question. Neither defect
could warn: the mast assert is a build-time constant check, and at identity
the pin IS the post, so both were invisible at the only spec the battery boots.

### What the graph says, and why the pin is not a unit

Declared on the two rows that already carried the rod's attachment —
`['Hack rod', 'Setting lever']` in `support` and `['Setting lever', 'Hack rod']`
in `drive` — both rewritten to name the pin and its derived radius. The pin is
a stud OF the lever, like the beak pin and the tail post beside it: it has no
motion of its own for `unitSignature` to detect and no fixture of its own to
reach, so a `registerLabel` of its own would be modelling fiction, and would
add fingerprint rows to a movement whose geometry did not change.

**Neither knob under "What must not happen" was touched.** `HACK_ROD_LEN` is
still calibrated at the engaged pose and the tail height still derived from
the stroke through the coupling; both differ between specs only because the
solve answers a different station, and identity's are bit-identical to what
shipped. The mast fits at the moved stations because the linkage is GIVEN
less stroke, which is the one end this entry said was legal to pull.

**And the plan's Battery note is half right.** `LOW_LINKAGE_OBSTACLES` does
shift where the pin is built — it carries the pin's swept stud and the hack
rod's route now leaves the pin rather than the post — but at identity it does
not shift at all, so the balance-cock legs and pillar seats re-seat at moved
specs only, and the shipped movement's seats are untouched. That is the same
fact as the unchanged fingerprint, seen from the corridor's side.

### §86 A, re-read afterwards — the ceiling is still the plate cut

The acceptance below asks for this, and the answer is that nothing moved: the
bearing scan's winner sits at **65° against the wedge's ±65°** at identity and
at both moved specs, after the pin landed. So the coupling ceiling is still
the plate cut and not the linkage. The wedge pricing below settles what
that costs: 25–30° of extra wedge would solve the mast, but only by opening
`TQ_CUT.phiOpen` itself (±75° → ±100–105°), through the band that carries §62's
windows, the pillar seats and pivots the plate has to CARRY. One new part on an
existing lever against a redesigned plate is not a close call, and the build
confirms the pricing's premise rather than disturbing it: the pin landed, the
winner is still on the fence, so the ceiling is still the cut. The row stays
open as §86 A's, not as §87's — and the pricing's closing note stands, that a
plate cut redesigned for any other reason hands the stop work 0.09 of mast per
degree for free.

### The plan as filed

§85 cleared the corridor. The MECHANISM still does not fit: at every
moved-escape spec the stop work's mast stands above the balance cock, and the
case-fit assert says so with its numbers — `?escstep=-77.9` achieves `|K|`
0.609 where 0.875 is needed. This is the P1 half of §85's finding, left
deliberately untouched by C1–C4 because those work in position space and this
is a question about the mechanism's own dimensions.

### The arithmetic, which is short

The pivot height is sized from the stroke through the coupling, and the mast
is the pivot plus its clevis:

```
Z_STOP_PIVOT = ROD2_PLANE_Z + POST_STROKE / (|K| · sin ψ_target)
mast top     = Z_STOP_PIVOT + 0.85   ≤ TQ_TOP_Z
```

With `TQ_TOP_Z` 8.51, `ROD2_PLANE_Z` 0.72 and `ψ_target` 0.5, the headroom
above the rod plane is **6.94**, so the stroke the movement can afford is

```
POST_STROKE ≤ 6.94 · sin(0.5) · |K| = 3.327 · |K|
```

The stroke today is **2.911**, taken at the setting lever's tail post,
`SL_TAIL` = 6.0. Measured `|K|` across the handles runs 0.609 … 0.950:

| `\|K\|` | stroke ceiling | pin radius that meets it |
|---|---|---|
| 0.950 (identity) | 3.161 | 6.51 — above `SL_TAIL`, which is why identity fits |
| 0.664 | 2.209 | 4.55 |
| 0.611 | 2.033 | 4.19 |
| 0.609 (worst measured) | 2.026 | **4.18** |

**One number covers the whole range: a dedicated hack-rod pin at ≈ 4.18, or
0.70 · `SL_TAIL`.** Round down to 4.0 and it covers `|K| ≥ 0.583`, below
anything measured.

### Two fixes, and §86 A changed which one looks primary

**1. Reduce the INPUT — the pin at reduced radius.** The fix the mast
assert's own comment already names: the hack rod stops sharing the reset rod's
tail post and takes its own pin closer to the lever pivot, stroke scaling with
`r / SL_TAIL`. This redesigns what the linkage is GIVEN, not what it produces,
which is why it is legal where re-tuning the tail height is not.

Note the force side goes the right way: the same lever torque at a smaller
radius delivers MORE force to the rod, and the brake wants force, not travel.
What must be re-solved rather than assumed is the pad drop — `STOP_PAD_Y` is
solved from ψ0 against `HACK_DROP_MIN` (0.35), and the pad's crank-local
height `HACK_CONTACT_Z − Z_STOP_PIVOT` changes when the pivot comes down, so
the drop equation is not scale-invariant. File the achieved drop as arithmetic
the way TODO 16 files its stall force.

**2. Get more coupling — and this is the new information.** §86's corner
report says the bearing scan's winner sits AT the plate cut's wedge, ±65°,
every time. That scan MAXIMISES `|K|`, so a winner on the fence means a better
coupling exists just outside the wedge and **the plate cut is what caps the
coupling** — the ceiling is not in the linkage at all. The wedge exists
because the mast crosses the plate band and needs open air, so widening it
trades directly against the three-quarter plate's own cut (§62's window
machinery is the neighbouring constraint). Worth pricing before building the
pin: if 15° of wedge buys `|K|` 0.7, the pin gets smaller or unnecessary.

### The wedge, PRICED — measured, and it settles the order

Both halves were measured by widening the bearing scan's bound and booting
`?escstep=-77.9`. **What it buys**, roughly +0.011 of `|K|` and −0.09 of mast
per degree:

| extra wedge | `\|K\|` | mast top | against the cock at 8.51 |
|---|---|---|---|
| +0° | 0.609 | 11.53 | over by 3.02 |
| +5° | 0.668 | 10.66 | over by 2.15 |
| +10° | 0.723 | 9.97 | over by 1.46 |
| +15° | 0.774 | 9.41 | over by 0.90 |
| +20° | 0.821 | 8.96 | over by 0.45 |
| +30° | — | — | **fits** |

So ~25–30° of extra wedge fully solves the mast at the worst measured spec.

**What it costs, and this is the part that decides.** Widening the SCAN's
allowance alone does not buy anything real: at +20° and +30° the mast fits and
a different assert fires instead — *the bracket reaches out of the plate cut
wedge by 1.96 … 5.14*, at IDENTITY as well. The mast needs actual air, and
`wedgeBound` is derived FROM `TQ_CUT.phiOpen`, so the coupling can only be
bought by opening the CUT by the same 25–30°: `phiOpen` from ±75° to ±100–105°.

That is not a tweak to a bound; it is a redesign of the three-quarter plate's
escapement cut, in the band where §62's windows, the pillar seats and the
pivots the plate has to CARRY all live — and the moved-station boots already
produce "the cut reaches a pivot it has to carry" warnings without any of this.

**Order this implies: build the pin.** Option 1 costs one new part on an
existing lever; option 2 costs the plate. The wedge stays worth knowing about
because it explains WHY the coupling ceiling exists — and if the plate cut is
ever redesigned for another reason, this entry is what says the stop work
would take 0.09 of mast per degree as a free side effect.

### What must not happen

`HACK_ROD_LEN` is CALIBRATED at the engaged pose and the released pad drop
follows from it; the tail height is DERIVED from the stroke through the
coupling. Neither is an adjustment knob — shortening either to fit the cock
is paying a structural problem out of the mechanism's own truth, which is
§35's failure and the reason §85 wrote this residue down instead of absorbing
it.

### Acceptance

The mast assert green across the handle range, not only at identity; the pad
drop still ≥ `HACK_DROP_MIN` with its achieved value filed; the new pin
declared in `MECH_GRAPH` with what supports and drives it; identity's
fingerprint moves deliberately (the linkage's proportions change) and the
battery is the court. §86 A's row for the bearing should be re-read
afterwards: if the pin lands and the winner still sits on the wedge, the
coupling ceiling is still there and still worth pricing.

Feasibility: the pin is a real part on an existing lever, and the stop work
solves purely now (§85 A), so a candidate radius can be evaluated without
building it · Cost: the pad-drop re-solve is the uncertain half · Battery:
fingerprint moves; `LOW_LINKAGE_OBSTACLES` shifts with the rod, so the cock
legs and pillar seats re-seat as they did for §85 C3.


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

## §90 — The HUD says what time it is and when it rings

**The need, in the owner's words.** "When the HUD is displayed, we
should see the estimated alarm time and estimated current time. This
makes it especially easier to set the alarm."

**Why §63 did not already answer it.** §57 put the *controls* in the
corner and §63 put the *result* there — hour, minute and alarm hands
that fade in with the eased stem pulls, so the ring previews what the
dial shows while a setting path is engaged. That is one step too late
for the question that sends a hand to the alarm crown in the first
place: *what is it set to now, and how far is that from the time on the
dial?* Both hands only exist once you have already committed to the
gesture, and even then they answer by angle. So §90's strip is
UNCONDITIONAL — it is up whenever the HUD is up — and §57's "only the
controls are drawn" scope guard is spent deliberately here rather than
by accident: the two times are not decoration on the plan, they are the
two numbers the pusher and the alarm crown are operated against.

**Figures, not a third and fourth hand.** The comparison the owner
named is arithmetic — "≈1:12 against 7:01" is a glance, where two more
needles on a 41 u ring is a squint, and a second alarm hand drawn under
§63's would say the same thing twice in the weaker notation. The strip
is the panel's own row idiom (dim label left, tabular value right)
under the ring, deliberately not a second typographic language in the
corner: it carries the same two rows the panel's Time and Alarm
sections carry, said where the crowns are.

**One derivation, because this row has lied before.** The panel's
"Rings at" row was already the careful one: §24 wired it to
`alarmTargetSeconds()` — the nearest quarter MARK — and it announced
3:00 for an alarm that rang at 2:52, because the trip is geometric (the
pin bottoms on the disc's notch floor) and runs off the CONTINUOUS set
angle. Copying that expression into the HUD would have been copying a
mistake that has already been made once, so the conversion moved into
`alarmRingsAtSeconds()` and both readouts consume it; the hh:mm
formatting moved with it into `fmtHM`. The time row consumes
`displayedSeconds()` — "what the HANDS read" — which is the same
accessor §63's hands read. Neither number is re-derived from τ or from
a crown angle anywhere in this feature.

**Only one of the two is estimated, and only one wears the ≈.** The
time row is exact: it is a readout of the hand positions, and the panel
clock prints the same string in the same frame. The alarm row keeps the
≈ it has always had, and now the reason is written where the conversion
is: the pin bottoms across ~2.76 min of disc travel, so the ring lands
within about ±1.4 min of the hand, and a seconds field would be
claiming a precision the notch floor does not have. Putting ≈ on both
would blur which of the two is uncertain — the seconds ticking in the
time row are the honest half of the pair.

**What it cost the box.** `#ctl-hud` loses its fixed 150 px height and
grows to fit what it carries; the SVG keeps its 1:1 aspect from the
viewBox (`height: auto`). The gesture math is untouched — `hudLocal()`
reads the SVG's own `getBoundingClientRect()`, not the box's — and the
strip is inert text with no `data-ctl`, below the only element carrying
pointer handlers. Labels resolve through `t()` at the display site
(§73) and reuse the panel's existing `Time` / `Rings at` keys, so the
feature added no translation debt in either locale — and they WRAP
rather than ellipse, §53's lesson applied before it could cost
anything: a hidden overflow is a label that silently stops saying what
it says, and this box grows to fit its contents by construction.

**The finding: a boot-order trap the §63 guard had been hiding.**
`hudUpdate()` runs on every frame, but `setHud()` also calls it
directly, and `?hud=1` reaches `setHud()` from `applyDeepLink()` during
boot. §63's hands were computed inside `if (pvT > 0 || pvA > 0)`, which
is false at boot, so nothing there had ever called `displayedSeconds()`
that early. An unconditional readout does, and `handSetOffsetNow` — a
`let` sitting with `displayedSeconds()` several thousand lines further
down — was still in its temporal dead zone: `Cannot access
'handSetOffsetNow' before initialization`, a boot that never produced a
`__clock`. The declaration now lives with τ's own tick state
(`tauIntegrated`, `lastTickRawT`), which is where a variable `tick()`
writes belongs anyway; `displayedSeconds()` keeps its comment and a
note saying where its other half went. `fmtHM` is a function
declaration rather than a `const` for the same reason, stated in place.
Worth keeping: the deep-link path is the one that finds this class of
bug, and it is cheap to test — `?hud=1` on a cold load.

**Verified.** Headless Chromium against the dev server, all three
locales: HUD and panel agree string-for-string on both rows at rest and
after setting (`7:01:36` / `≈1:14` in both places); labels resolve to
`Zeit` / `Klingelt um` and `时间` / `响铃时刻` with zero row overflow at
150 px, which is the §53 wrapping constraint met by the German column
as usual. Driven end to end through the HUD's OWN gestures — a radial
drag pulls the alarm crown, a tangential drag around the ring turns it
— the alarm row tracks the disc live (`≈12:00` → `≈1:12`) and agrees
with the §63 hand drawn above it in the same screenshot. Zero page
errors on boot and through the gestures. Battery 17/17 (3 shards,
25 min): boot silent, every gate PASS, `sweptOverlap` 0 CONFIRMED over
59 768 pairs, `clearances` 0 violations, fingerprint deterministic
across virgin boots.

**The fingerprint claim was measured, not assumed**, and the first
measurement was wrong in the instructive direction: booting this branch
against a `main` worktree gave two different hashes, which for a
DOM-only change reads as a real geometry move. The local `main` was 30
commits stale. Re-run against the branch's actual base, both trees from
a cleared state file and a fresh browser context, both hashed the same
value the battery's two virgin boots produced. The lesson is the cheap
one: a fingerprint is only a claim about the two trees you actually
compared, so name the base commit, not the branch name — and re-measure
when the base moves. This section landed on 780d41c, hashing
`1307831341`; TODO 11 tranche five moved geometry underneath it, so the
rebased pair (base `a370a6b` and this branch) both hash `3811459283`.
The claim survived the rebase; the number did not, which is exactly
what a fingerprint is for.

One pre-existing condition, re-measured rather than assumed: on a
390×740 viewport the panel (z 10) still overlaps the HUD's left sliver
the way it did before, because the box's width and x are unchanged and
only its top edge moved up 42 px into ground the panel already covered.
Both readout rows clear the panel's bottom edge there. Nothing about
that layering is new, and moving the HUD would be a different change.
## §91 — Three driven plates for the fusee, and the one that would not stay flat

**Filed from an owner request** — "improve the explainer for the fusee and
chain using animations; the alarm feeler explainer is the gold standard."
The feeler entry is the right standard: a section plate you drive with a
slider, a graph plotting `alarmPinDropNow`'s own law, and a chip vocabulary
that names the state. Beside it, the fusee entry was one static plate and a
paragraph. Everything it *claimed* — that both ends of the chain travel,
that the cone equalises, that a detent feeds the train while you wind — was
prose with a drawing next to it.

The entry now carries three plates, all driven, and the second one
disagreed with the caption it replaced. That is written up as **TODO 40**;
this section is the landing, and the finding is the reason it was worth
doing rather than a footnote to it.

### Plate 1 — elevation, scrubbed by the reserve

The plate is a true elevation projection of `rebuildChain`'s own
parametric curve onto the plane the two arbors share, not a drawing of
one. Both helices are the source's expressions, sampled:

- the cone wrap at `ang = thetaT − (wraps − s)·2π` over
  `fuseeGrooveAt(s / FUSEE_GROOVE_TURNS)`, so it climbs exactly one groove
  pitch per turn and a full 3.75-turn wind reaches `f` 0.9375;
- the drum coil hanging from its hook at `COIL_TOP − (drumTurns − s)·CHAIN_COIL_PITCH`;
- the span between the two tangent points of the same external tangent the
  build solves (`alpha = acos((r_active − DRUM_WRAP_R)/D)`), which is why it
  crosses in front of both bodies at 113° off the centre line rather than
  running from silhouette to silhouette. That looked wrong and is right.

Strands whose depth puts them behind the body are drawn faint — §71's
hidden-line convention, borrowed. **z is drawn at twice the radial scale
and the plate says so**: at one scale a 0.69 coil pitch and a 0.694 groove
pitch are the width of a stroke, and the z story is the only thing this
view exists to tell. The two planes that pin the cone are dimensioned in,
because `FUSEE_Z0` is *solved* between them — the center wheel's top face
below, the hairspring stack above.

A `play` button runs a whole let-down and the faster wind that follows it;
scrubbing the slider takes over, on the zero-reset plate's precedent.

### Plate 2 — the taper the equalisation needs, against the taper that is cut

Two panels, both plotting the shipped arithmetic: radius against reserve
(the seat the chain is on, the hyperbola a level product requires, the gap
between them shaded) and torque against reserve (`springTq`, and `trainTq`
computed both ways). Its marker follows plate 1's reserve — one input,
two views, the feeler's arrangement.

**The old caption said "train torque ≈ 1, the whole reserve" and drew a
flat red line. It is a parabola.** A linear spring needs a hyperbolic
cone; this cone's generator is straight, so the product matches at the two
ends by construction and bulges to 1.34 between them. Two more gaps came
out with it — the HUD multiplies by `FUSEE_R_SMALL` 2.6 where the wrap
stops at 2.9, and `CHAIN_ENGAGED` books the wind at `FUSEE_AVG_R` 5.0 where
the wrap's own mean radius is 5.15. All three are TODO 40.

The third one is not a paper finding. `rebuildChain` sets its link count
from the curve's length, so the chain gains and gives back about 9% of its
links over one let-down, measurable on the shipped mesh: 64,552 / 70,744 /
66,100 vertices at reserve 0 / 0.5 / 1. **A chain is a fixed length of
steel and nothing in the battery says so** — the same hole `devLen` closed
for the mainspring, still open here.

### Plate 3 — maintaining power, in its two states

The mechanism the entry had named in half a sentence for two years. Plan
view at the great wheel: the base ratchet flange keyed to the fusee, the
maintaining wheel carrying two pawls, its rim teeth, and the plate detent —
every radius derived the way the source derives it (the sandwich lives
inside the center wheel's closest approach, `MAINT_RING_R` = 16.2 − 11.25 −
0.36 − `CLEAR_MARGIN`), and the detent's aim re-solved by the same scan for
the seat closest to a working bite. `sawRadiusAt` is ported verbatim, the
pawl ride reads `windBack`, and the detent is §48's one-sided follower —
seek the seat, stop at the cam — rather than a part placed on a profile.

A `winding` toggle runs the state that makes a fusee usable: the flange
reverses under the pawls while the wheel, held by a detent that never sees
reverse motion, keeps creeping with the train. The flow strip alongside
uses the sim's own POWER FLOW verdicts and colours (amber stores, green
delivers, red holds), so the plate states which member is carrying torque
in each state instead of implying it. The rates are the movement's: 24 pawl
snaps to the fusee turn, 90 over a full wind, one detent tick per rim tooth
= one every 20 minutes.

### What this cost in localisation, and why that is the design working

Ten keys' English no longer exists, so ten German and ten Chinese entries
became unmatched — the gate's failure mode by design, and the reason
`--check` is a gate rather than a report. They are gone; the 68 new keys
are translated in both languages, three German plate labels shortened to
stay inside their plates (the fit check caught all three), and coverage is
back to 100%. `explain-quotes` gained four comparable claims and still
passes.

### The rule this landing is evidence for

The entry's own sentence, now: *the plate shows the gap rather than hiding
it, which is the point of drawing the law instead of a picture of the law.*
A picture of a law is a claim about it. Plot the expression and the claim
either holds or it does not, and this one had not held since the cone was
cut. **An explainer plate is an instrument** — the cheapest one in the
repo, since it costs no battery time — and it found something three
collision-clean sweeps could not, because none of them has an opinion about
torque.

## §93 — Reconfigure mode survives its own Apply, and its six handles stop being a secret

**Filed from an owner report on the mode itself**: "applying a
reconfiguration is usually an iterative process and after a refresh should
land you back in the same mode in which we can make other reconfigurations.
Entering reconfigure mode should also land us in non-schematic mode. It
should also be more clear which parts are draggable (i.e. fusee, escapement,
crowns, etc.)." Three findings, one mode, and none of them is about the
solver — §33's machinery was right and its front door was not.

### 1. The mode did not survive the thing it exists to do

§33 step 5 settled that a spec is a DOCUMENT: Apply is reload-tier, applies
stack in browser history, and Undo is `history.back()`. The MODE was a
`let reconfOn = false` — a variable a page load resets. So every single
apply, the operation the whole mode exists for, ended with the tool closed:
the viewer landed in the finished watch, opened the panel, found
Reconfigure, turned it on, and started again. The cost scaled with exactly
the thing the report names — iteration.

The mode is now a URL param, `?reconf=1`, written by `history.replaceState`
on entry and deleted on exit, read by `applyDeepLink` like every other mode
flag. Three consequences fall out rather than being arranged:

- **Apply, "As designed" and Load variant all carry it for free.** Each
  navigates from `location.search`, and `reconf` is not a `SPEC_URL_KEY`, so
  `navigateWithSpec`'s delete-then-set pass leaves it alone.
- **A plain refresh keeps it**, because a refresh keeps the query string —
  which is what the report asked for and what a variable never could give.
- **`replaceState`, never `pushState`.** Entering a mode is not a document
  edit; a history entry for it would put a mode change between an apply and
  its Undo, and back must mean "the previous spec" here.

The trial boot deletes the param with `inspect` and `cycle`, on the same
grounds those two are deleted: a verdict boot is a plain boot of the
candidate, not a second copy of the tool.

**And the mode's ROWS had to come back with it.** They sit inside the View
section's `<details>`, collapsed by default since §15, so a mode restored by
its own Apply arrived with its status, Apply and variant rows shut in a
drawer — the same "you cannot carry on" one level up, and invisible from the
scene where the rings had just appeared. Entering the mode opens every
ancestor `<details>`; leaving closes none of them, because a drawer the
viewer opened is theirs.

Session state was the other candidate and is the wrong one: state saves are
fire-and-forget PUTs on a 5-second autosave, so a mode entered and applied
inside one tick would not have been written yet, and the URL is already the
tier this mode does everything else in.

### 2. Entering it left you dragging metal that was not being drawn

Schematic and realistic are EXCLUSIVE views by camera layer (the owner call
that reversed §69's ghost underlay): the line tier enables layer 1 and
disables layer 0. Only the CAMERA's mask moves — the solids stay on layer 0,
and `THREE.Raycaster` carries its own mask, which is layer 0 and pays no
attention to the camera's. So in the schematic tier every handle in this
mode was still hittable and none of them was on screen: you could drag a
crown that was not being rendered, and the constellation ghost would answer.

Entering the mode now forces the solid tier and REMEMBERS the one it
interrupted; leaving puts that back. A deliberate click on Schematic while
the mode is on becomes the new remembered tier, or leaving would silently
undo the click just made.

`captureState` persists the REMEMBERED tier rather than the live one while
the mode holds it open. Without that the 5-second autosave turns a mode into
a preference: reconfigure for a minute, and the viewer's saved choice of
view has quietly become "realistic" forever.

### 3. Six handles among every other part, announced in a sentence

The affordance was one line of panel text — "Drag either crown, the pusher,
barrel, escapement or balance" — plus whatever the reader already knew about
watch trains. Each handle now wears a ring for as long as the mode is on.

**The ring is a measurement, not a decoration.** For the three train handles
its radius IS `h.grabR()`, the radius the pointer test uses, so what is
circled is exactly what is grabbable and a handle cannot advertise a
catchment it does not have. The rim handles are picked by raycast against
their own meshes, so theirs comes from the part's own bounding box at 1.2×
— an offset that scales with the part instead of being a number that looked
right at one zoom.

Drawn depth-test-free and billboarded, the §21 axes legend's precedent: a
reference must never end up buried inside the movement it refers to. The
circle is BROKEN into twelve arcs with four radial ticks, because a closed
circle at a wheel's radius reads as that wheel's rim — the one thing this
mark must never be mistaken for.

**The first cut of it was a mark you could not see, and that was found by
looking.** One near-white teal line at 0.45 opacity — §58's lesson applied
on its own — read beautifully where a handle sits against the dark page,
which is both crowns, and VANISHED over the polished plate, which is where
the fusee, the escape wheel and the balance all are. Every automated
assertion was green while three of the six handles were invisible: the
check could confirm the rings EXISTED and lit on hover, and existence is
not legibility. Two changes fixed it, both stated as constraints rather
than taste:

- **A mark that must cross two backgrounds needs both values.** Each ring
  now carries a dark backing ring 0.4 u outside it. The pale line survives
  the plate because the dark one edges it; the dark line is invisible
  against the page, where the pale one is already doing the work. The
  offset is a constant in units, not a percentage, so the outline does not
  thin as the ring grows from a crown to the great wheel.
- **Weight has to come from geometry.** `linewidth` is a no-op in WebGL and
  1 px is thinner than the guilloché underneath it, so every ring is a PAIR
  of concentric lines 0.15 u apart, reading as one bolder stroke. The hover
  state changes SIZE (1.06×) as well as opacity for the same reason: over a
  bright plate an opacity step alone is exactly the difference this mark
  cannot rely on.

Hovering lights exactly one ring and names it in its own panel row, separate
from the status span because the two answer different questions at the same
time ("what have you proposed" must survive a hover). The pick is one per
frame, §59's rule for the explore hover: `pointermove` records the position
and the raycasts happen in the frame.

**And the ring that lights is the handle that will move**, because both come
from one function. The nearest-member search moved OUT of the pointerdown
handler into `reconfHandleAt`, which the hover and the press now share; two
copies of that loop could disagree, and a handle that lies about itself is
precisely the defect this section exists to fix.

The panel also stopped saying "barrel" where the ring sits on the fusee and
great wheel — the part a viewer watches turn.

### The gate

`ci-battery.mjs`'s TODO 36 table gains a point: `?reconf=1`, expected
SILENT. §93 made the mode a boot-time path — six parts measured for rings,
the schematic tier forced, panel rows opened — before a viewer has clicked
anything, and the spec-boot harness is where a deep link that does not build
gets caught. It changes no station, so unlike its neighbours it must boot
without a warning.

### What this did not close

- **The status line still quotes the solver in English.** The new chrome —
  the hint row, the six handle sentences, the idle line — is in all three
  locales; the candidate verdicts remain the recorded `i18n.js` residue,
  because they quote boot asserts verbatim.
- **The rings are placed once per entry**, from bounding boxes. A crown
  pulled out afterwards slides a fraction of its own radius inside a ring
  drawn at 1.2× that radius, so it stays ringed; recomputing would cost a
  `Box3` traverse per handle per frame to move the mark by less than it is
  wide.
- **Hovering the alarm column wheel lights the pusher's ring**, which is on
  the pusher cap. That is the hit test being honest — `alarmColumnHitTest`
  accepts the whole switch unit as one control — rather than the ring being
  wrong.

## §94 tier A — `?d4=` : the small-seconds station becomes a spec dimension

**Ships in PART.** §94 filed three tiers; this is tier A. Tiers B (name the
alarm corner's radius, which today borrows `RESERVE_LOCAL.y`) and C (the
reserve station as spec dimensions) stay in the roadmap, gated on the
§44/§46 agreement about who owns the reserve subdial. Tier A is independent
of that decision and was always unblocked.

### What moved, and what it cost

`D4 = 15.5` — the centre→fourth distance — was already a named parameter of
`solveLayout`; nobody had lifted it to the spec. That is the whole tier:
`?d4=` joins `SPEC`, the `index.html` reader, `SPEC_URL_KEYS`,
`LAYOUT_INPUTS` and `RECONF_HANDLES`. The fourth wheel's axis IS the
small-seconds pivot, so one number moves that sub-dial — and, because
`escapePos = stepPos(fourthPos, …)`, the escape, fork and balance with it.

The null rule is load-bearing and unchanged: an absent `d4` means
`LAYOUT_INPUTS` passes no argument at all, so the solve runs on the `D4`
constant and never re-multiplies a float. **Identity fingerprints
1118637705 before and after**, and `?d4=15.5` — the same value passed
explicitly — hashes identically too, which is the stronger statement.

### The handle is RADIAL, and three of its neighbours are not

Every §33 handle before this one proposed an azimuth about a mesh point, so
`RECONF_HANDLES` rows were azimuth-shaped: `toSpec(azDeg)`, a `defDeg`, a
wrap into (−180, 180]. The small-seconds station is not an angle. The
two-bar puts the fourth EXACTLY `d4` below the centre and solves the third
wheel's wedge to get it there, so the fourth's only freedom is radial and
the pointer's reading is its DISTANCE from the anchor.

The row shape generalised rather than forked: `radial: true` selects the
reading and the candidate's label branches on it (degrees and units are not
interchangeable in a sentence either), and `defDeg` became `def`. One
consequence is worth naming — a distance is rotation-invariant, so the
radial row is the only one with no `RECONF_ROT_DEG` term: a `?crownaz=`
boot rotates the anchor and the pointer together and the reading does not
change.

`reconfCandidate.valueDeg` became `value` in the same pass. Apply and Trial
both wrote `valueDeg.toFixed(1)` into a URL, which was true of six handles
and would have been a lie in the seventh.

### The refusal, and why a NaN boot is not a bound

The centre→third→fourth two-bar is a triangle whose two fixed sides are the
mesh centre distances `d1CT` 12.75 and `d2TF` 10.80. It closes iff

    |d1CT − d2TF| ≤ d4 ≤ d1CT + d2TF        →   1.95 ≤ d4 ≤ 23.55

and outside it `acos` leaves [−1, 1] and every position downstream of the
third wheel is NaN. `d4Window(radii)` derives that from the bars, and TWO
places consume it, deliberately differently:

- **`solveLayout` falls back to `D4` and warns**, with the achieved and
  required numbers (rule 6). A NaN layout is not a degraded answer, it is
  no answer — the build has nothing to stand on — and a hand-typed URL can
  ask for one. Measured: `?d4=24`, `?d4=23.6` and `?d4=1.9` all boot, all
  warn, all hash identity, where before this tier they would have produced
  a movement with no positions.
- **The handle REFUSES**, closed form, before the drag can propose one. It
  has to be its own check rather than reading the shadow-solve's verdict:
  with the fallback in place a shadow of an impossible `d4` comes back as
  the DEFAULT layout, so the ghost would be a proposal that is not the one
  under the pointer and Apply would silently build a different watch.

Everything else the handle says arrives through the existing §85 link:
`stopWorkShadowWarns` re-solves the whole keyless frame for the candidate
`P`, and that solve is where the sub-dial wells are sized — so dragging the
fourth wheel inside the wells' inboard ceiling reports under the pointer
without the drag branch knowing anything about dials.

### Measured, not interpolated — and one of §74's figures moved

Booted headless at 29 values of `d4`, on the shipped tree with both new
asserts in place. The traps §74 measured transfer intact, with one
correction and two additions:

| `d4` | warns | what it says |
|---|---|---|
| 1.9, 1.95 | 1 | outside closure — falls back to `D4`, hashes identity |
| 2, 3.5 | 3 | **wells with no radius** (new assert) + the plate cut reaching a pivot, twice |
| 3.6, 4, 6 | 2 | the plate cut reaching a pivot the balance has walked toward |
| 8, 10, 12 | 3 | …plus §34's selector post fouling the moved seconds well (−0.31 to 0.14 against 0.15) |
| 13, 14 | 2 | the plate cut alone again |
| 15 | 3 | …plus the selector post, this time against the 12-well ring |
| 16, 16.5 | 2 | **the keyless side-sign window**, exactly as §74 measured, plus the selector post |
| 17 | 1 | still in the side-sign window, selector post now clear |
| 17.5, 18, 19 | 5 | balance cock has no seat; §62's escapement window left on a 0.12 land |
| **20**, 21, 22, 23, 23.5 | **0** | silent — §74 measured 1 warning at 20 |
| 23.55, 23.6, 24, 26 | 1 | the closure refusal, falling back to `D4`, hashing identity |

`plateR` is 42.923 for every value up to 22 and then grows: 42.968 at 23,
43.334 at 23.5. The dial follows it (39.489 → 39.868), which is the
measurement that retires the face-headroom trap below.

**Non-monotonic, confirmed**: 17 gives 1 warning, 17.5 gives 5, 20 gives 0.
Nobody bisecting this range for a clean value will be led to one.

**The dial-face bound does NOT bind for `d4` alone**, which contradicts the
plan this tier was written from. §74 measured face headroom reaching 0 at
centre ≈ 22.34 — with BOTH stations moving in lockstep, so `subDialR` grew
with them. Moving `d4` alone leaves `subDialR` pinned at 11.85 (the reserve
station is the `min`), so the seconds well's outboard edge is `d4 + 11.85`
against a `dialRadius` of 39.489: headroom would reach 0 at `d4` ≈ 27.6,
past the two-bar's 23.55. And above `d4` ≈ 22.5 the plate GROWS with the
station (42.923 → 43.334 at 23.5), so the face comes out to meet the well
rather than the well running off the face. The two-bar is the only bound
here; the trap was inherited from a different experiment and is recorded
as not applying.

### Two instruments the knob exposed on its first day

Both were invisible while both stations were literals, and both are the
same shape: an expression DERIVED to sit exactly on a limit, read at an
arbitrary value for the first time.

**The wells could have no radius at all.** `subDialR = min(stations) −
SUBDIAL_INBOARD_CLEAR`, and at `d4` 2 that returns **−1.55** — a dial built
with a negative well radius, in silence. The centre-bore assert next door
cannot see it: it measures the ring's inner edge, and a negative radius
pushes that edge back OUTSIDE the bore, so a nonsense well reads as a
compliant one. `solveKeyless` now warns with the station, the ceiling and
the achieved radius.

**And the centre-bore assert itself fired on float noise.** For whichever
station is the inner one, that web is `CLEAR_MARGIN` by algebra — so the
only real breach is a `radiusFactor` over the ceiling. While both stations
were literals the arithmetic landed on the right side of the last bit; a
spec'd `d4` re-does it at an arbitrary value, and every inward station
reported a 1e-16 breach of its own definition (measured at `d4` 6: web
0.14999999999999991 against 0.15). The comparison now carries a 1e-9
float-equality guard, which is a guard against equality, not a widened
budget.

### The instrument gap this tier had to seed shut

No `EXPECTED_CONTACT_FLOORS` row existed for any sub-dial pair, so the
three pairs the small-seconds station participates in rode TODO 6's blanket
excuse — and this tier moves that station. Three rows now:

| pair | measured | contacts declared |
|---|---|---|
| `Heart cam (seconds reset)` ⇄ `Small seconds` | 0.55 | 4 — the hand on its arbor |
| `Heart cam (seconds reset)` ⇄ `Dial` | 0.55 | 7 — the same joint re-attributed through nesting, plus the hub through the pocket floor's bore |
| `Dial` ⇄ `Small seconds` | **0.12**, WAIVED | 0 — there is no contact |

**Writing them needed the check to handle NESTED pairs, which it could
not.** 'Small seconds' is a labelled child of the `dialFace` group, so every
one of its meshes is also a 'Dial' mesh and the pair loop was measuring the
hand's blade against its own tip: 0 at every pose, at every station. That
is an intra-unit question — TODO 5's, not this check's — and it made a
floors row on any nested pair unwritable, since the row would have had to
declare a part's own meshes as contacts with each other before reaching the
real question. `checkExpectedContacts` now excludes pairs where BOTH meshes
belong to both units. The same fix makes `Dial ⇄ Power reserve` and
`Dial ⇄ Motion works` writable whenever someone wants them.

**Four meshes gained names**, because `inspect.js` couples by `.name` and an
unnamed mesh has only an index label no row can select: `secondsArborRod`,
`secondsArborHub`, the sub-dial floor decals (`secondsSubdialFace` /
`reserveSubdialFace`), and the small-seconds hand's four parts via
`makeHand`'s new `namePrefix`. Per-hand rather than per-kind, because `kind`
is not unique — the alarm hand is an `'hour'` and the reserve hand is a
`'minute'`, so kind-derived names would collide across units and a row
naming one would silently excuse the other.

The three pre-existing floors rows were re-measured against the unmodified
tree to prove the nesting change moved nothing it should not: `Alarm disc ⇄
Hour wheel` 0.15, `Hour wheel ⇄ Motion works` 0.15, `Alarm release sleeve ⇄
Alarm disc` 0.1972 — identical minima and identical mesh pairs before and
after. (One row's reported `at` pose moved between two ties at the same
minimum; the number did not.)

**And the third row is a finding, not a pass.** `Dial ⇄ Small seconds` has
no contact between the two units at all — the well, its bezel and its
printed face are Dial meshes; the unit contains only the hand — so what the
pair owes is a clearance, and it measures **0.12** against the one margin's
0.15. The hand's standoff is an authored `-(SUBDIAL_RECESS - 0.3)` and the
bur rod's keel hangs 0.18 below its mounting plane. Filed as **TODO 41**
with the derivation the 0.3 should have been, and the row ships waived
citing it. It is pre-existing and `d4`-independent: the hand's z is measured
off the pocket floor, and the pocket rides the dial.

### The gate

18/18 gates pass, fingerprint 1118637705 on both virgin boots — the same
hash the unmodified tree produces. `expectedContacts` is the one check that
moved and it moved by design: 3 pairs → 6, 0 waived → 1, and 147 s → 243 s,
because two of the new rows pair a 3-mesh and a 4-mesh unit against the
Dial's 147 meshes and the pair loop is quadratic in exactly that. The
`cost` column is updated to the measured figure; the partition does not
move, since shard 1's total is 1298 against `sweptOverlap`'s 1573 alone.

`ci-battery.mjs`'s TODO 36 table gains three points, chosen so the table
records the traps rather than avoiding them: `?d4=20` (moved and silent),
`?d4=16` (inside the side-sign window, EXPECTED to warn — documented by a
row that expects it, not suppressed), and `?d4=24` (past the closure
window: it must BOOT, because the fallback is what this tier ships in place
of a NaN).

### What this did not do

- **No `MECH_GRAPH` entry**, because no part was added. Every consequence
  of a moved station is an existing part landing somewhere else.
- **The reserve station's pairs are still unseeded.** Nothing in tier A
  moves that station; §94 tier C is where it earns its rows.
- **The status line still quotes the solver in English** — §93's recorded
  `i18n.js` residue, unchanged. The new chrome (the fourth-wheel handle's
  hint, the seven-part idle line) is in all three locales.
- **`?d4=` moves reports at non-identity specs by construction**, which is
  the point of it. Identity moves nothing: same fingerprint, same boot
  silence, same battery payloads.

## §94 tier B — the alarm corner's radius stops borrowing the reserve station's

**Ships in PART, second tranche** (tier A above). Tier C — the reserve
station as spec dimensions — stays in the roadmap, gated on the §44/§46
agreement about who owns the reserve subdial. Tier B touched no station and
waited on no agreement: it removes the alarm module's secret dependence on
one, which every OUTCOME of that agreement needs — §44's second train needs
a corner that does not follow a re-scaled station, §46's removal is
impossible while the alarm's radius is DEFINED as the removed
complication's centre distance, and tier C's move needs it by construction.

### The identity, and what it cost to keep

`ALARM_CD = RESERVE_LOCAL.y` made the reserve subdial's centre distance the
radius of the ENTIRE alarm module. Downstream of that one line: the
winding-climb station (which pierces BOTH plates, so both plates' bores
follow it), `ALARM_LOCAL` and `ALARM_ARBOR_R`, the setting train's module
solve, the stem length and its unit vector, the collar geometry and its
boot asserts, the silence-rocker ratio, the crown's tick position, the
barrel-climb span records, reconfigure mode's forbidden windows, and the
two-circle dogleg solve that has no intersection at all past
`ALARM_CD ≈ 19.9`. Any future spec that moved the reserve station would
have dragged all of it behind the indicator.

The decoupling is a rename with a default. `alarmCornerR` is derived in
`solveKeyless` beside `RESERVE_LOCAL` — deliberately the SAME
`dialRadius · 0.39` on the same input, so identity geometry is bit-exact —
and its comment states the ALARM's own bounds, which rule 1 makes the whole
point of the rename: the dogleg's ≈ 19.9 ceiling; the winding chain's
climb→barrel span, which grows ~1:1 with the corner (the idler DERIVES from
the span since the corner-16.0 measurement, i1⇄i2 at 15.408 against a
15.300 pitch sum — a chain that silently did not mesh); and the stem's
positive length inside the rim (`alarmStemLen = plateR + 2.2 − corner`).
§13 step 3b's one-solver property survives intact: the two quantities stop
sharing a NAME, not a home.

### The census

Every read site classified corner-vs-station against the build plan's
fresh line map (the tier prose's line numbers had drifted; the plan re-ran
the audit and found the stem's unit vector, the collar's boot asserts and
the barrel-climb records the prose did not list). All are corner reads and
survive the rename unchanged, except the one formula below. The one site
that legitimately reads BOTH quantities — the well-ring radius comment's
`hypot(ALARM_CD, RESERVE_LOCAL.y)` span — is after the split
self-documenting rather than a tautology. The acceptance line ("no
consumer of the alarm corner reads `RESERVE_LOCAL` any more") was checked
by enumeration: every surviving `RESERVE_LOCAL` read is a genuine station
read — `subDialR`, the per-station centre-bore assert, the dial artwork,
the stud obstacle row, `reserveGroup`, `rsvPivotXY`, the selector-corridor
and `ALARM_SET_WALLS` well rings, and the reconfigure reserve-well row.

### The one real geometry: `wellHalf`, and a premise that half held

`reconfAlarmWindows`' well term fused three distances into one name:

    asin((subDialR + margin) / ALARM_CD) + atan2(1.5, ALARM_CD)

— the well disc's angular radius read at the CORNER's distance, valid only
while every radius was the same number. Re-derived with each name in its
true role: each well DISC subtends its `asin` at ITS OWN station's centre
distance, and the corner CLUSTER's width subtends at the corner's own
sweep radius. The reconfigure windows are not fingerprinted, so the build
plan demanded verification by direct comparison and predicted exact
reproduction ("at identity the radii are equal"). Measured — booted
headless before and after, rows compared as hex-dumped doubles — the
premise held for the reserve row only:

| row | fused form | split form | |
|---|---|---|---|
| the winding crown, the alarm pusher | — | — | bit-identical |
| reserve well half | 0.9905302108927505 | 0.9905302108927505 | bit-identical |
| seconds well half | 0.9905302108927505 | 0.9826072522576832 | **−0.0079 rad (0.45°)** |

The seconds station has sat at `D4 = 15.5` since tier A lifted it to the
spec — 0.099 outboard of `dialRadius · 0.39 ≈ 15.40` — so the fused form
was reading the corner's radius for a disc that was never there, and under
a live `?d4=` the error scaled with the move. The 0.45° narrowing at
identity is the fused form's own measuring error surfacing, in the
correcting direction — not new behaviour, and invisible against the
window's 56.8° half-angle. Recorded here precisely BECAUSE the plan
predicted zero: an equivalence check that finds a delta must say where the
premise failed, and this one failed where tier A had already moved a
station out from under a shared constant.

### The gate

Full battery at identity, run locally in this container's headless
Chromium (CI's ubuntu-latest/SwiftShader path runs on the PR): **19/19
gates pass**, boot silent, fingerprint **1118637705 on both virgin
boots** — the same hash tier A recorded for the unmodified tree. `spec
boots` 16/16 with the identity control silent; no new spec key, so it
gains no rows, and the scope guard held (`?alarmaz=` already owns the
corner's azimuth; a corner-radius HANDLE stays unfiled).

The acceptance for a change that could move a report is the `--report`
diff, not the PASS column, so the same harness ran on the base tree
(`50990a1`) and both full payloads were compared leaf by leaf: **12
differing leaves, every one a per-check `ms` wall-clock field** — every
row, pose, verdict and number in every check is byte-identical. The
reconfigure windows' 0.45° seconds-row correction is invisible here by
construction: the windows are UI refusal arcs, not battery rows, which is
exactly why the plan demanded the direct comparison above instead.

## §94 tier C — `?rsvr=` : the reserve station as a spec dimension, and the entry ships whole

**Ships WHOLE.** Tier A moved the seconds station, tier B cut the alarm
module's borrowed radius, and this tier finishes the entry: the
power-reserve station is a dimension of the movement — a `rsvr` spec key,
a §33 radial handle with a closed-form refusal, derived bounds with their
constraints written in place, and the identity spec bit-exact against the
shipped fingerprint. The §44/§46 agreement that gated this landing was
settled by the owner (2026-08-09): the going-train reserve owns the
subdial while its complication exists, §46 owns the subdial's withdrawal,
and §44's alarm-reserve half is optional and never claims it. The one seam
left open is assigned, not dangling — what `rsvr` means for a station §46
has removed is §46's to define when it builds, with `d4`'s
ignore-with-warn fallback named as the pattern.

### The promotion, tier A's plumbing verbatim

`RESERVE_LOCAL` was a literal inside `solveKeyless`; it is now the
solver's own argument (`rsvR`, dial-local radius — the station sits on the
dial's 12-o'clock axis, so one key places it and an azimuth key can join
later without disturbing this one). `SPEC.rsvr` defaults null;
`KEYLESS_INPUTS` spreads it in only when present, so identity passes
nothing, evaluates the same `dialRadius · 0.39`, and fingerprints
2134288613 on both virgin boots — bit-identical to the tree it landed on
(the baseline hash moved under this tier mid-build: TODO 41's fix landed
concurrently and re-planed both well hands; this tier rebased onto it).
`index.html`, `SPEC_URL_KEYS`, variants and the trial boot all ride the
existing machinery.

### The window, derived where the radii are — and what is deliberately NOT in it

`rsvrWindow` derives in `solveKeyless` (`d4Window`'s precedent): INBOARD
the station against `SUBDIAL_INBOARD_CLEAR` 3.55 — at or inside it the
well has no radius (tier A's negative-well warn is the backstop); OUTBOARD
the well's outer edge against the dial face, `station + subDialR(station)
≤ dialRadius`, closed-form in two branches because `subDialR` is pinned by
the INNER station — a reserve station moved outward alone carries the
seconds-pinned well until the face runs out at **27.54**. Two bounds are
deliberately absent, each recorded by the tier that retired it: §74's
"headroom 0 at ≈ 22.34" was a lockstep artifact (tier A's correction), and
the ≈ 19.9 dogleg ceiling has been the ALARM corner's own dimension since
tier B — re-importing it here would undo exactly what B bought. A spec'd
`rsvr` outside the window warns with both bounds and BUILDS: an off-face
well is nonsense, not NaN, so there is no fallback to hide behind and the
battery judges the result.

### The train's own bounds, joint in (`rsvr`, `reserveh`) — and where they actually bite

`rsvModule1` solves from the barrel→pivot span and `rsvTeethW2 =
2·reserveHours/3` (§22), so each key rescales stage-two teeth the other
cannot see. `rsvTrainWarnsAt` states the bounds once, shared by the boot
assert and the handle's shadow: NO TRAIN (module ≤ 0 — the station inside
stage one's centre distance); a tooth-stock FLOOR (the pitch-line width
π·m/2 under §50's 0.12 mm wheel floor — deliberately the lenient closed
form, the census stays the instrument for marginal teeth); and two
TODO 33-class radial CEILINGS, w2's tip against the dial centre's tube
stack and against its own well's ring wall.

Measured, the geometry is kinder than the plan feared: `P.barrel` sits
13.27 off the station's axis, so the span never drops below 13.27 and the
module floor and no-train cases CANNOT fire inside the window at any
`reserveh` — both stay as dormant guards, which this record says so nobody
wonders. What does bite is the tip-vs-well ceiling, and it is genuinely
JOINT: at the default 30 h the threshold sits at `rsvr` 28.44, OUTSIDE the
27.54 window; at 48 h (w2 32 t) it moves INSIDE to 26.60. The
`reserveh=48&rsvr=27` spec-boots row is that case — tip 11.86 against the
well's 11.60 — the worst case neither key shows alone, exactly the row the
plan's C3 asked for.

### Consumers that follow, and the two that needed edits

`rsvPivotXY`, `reserveGroup`, the dial artwork, the motion-works stud
obstacle row, the selector-corridor '12-well ring' and `ALARM_SET_WALLS`'
reserve ring all derive from `RESERVE_LOCAL` and follow free —
`ALARM_SET_WALLS`' row confirmed DORMANT at every probed variant (8, 13,
20, 27, 30), not assumed. Two sites were edits: `reconfAlarmWindows`'
reserve-well row read a hard-coded `π/2` because the station's x is 0
today — it now reads the station (`atan2(y, −x)` through the dial mirror,
bit-exact at identity), so a later azimuth key finds no literal; and the
§34 selector-post corridor assert turned out to be the instrument that
polices an inward-moved station (`rsvr=8`: post vs the moved 12-well ring
at −0.27 against 0.15), the same instrument that caught `d4=16` one
station over.

### The floors rows, and the finding two builds measured on the same day

The three rows tier A left on the shelf are seeded — two by this tier,
and the third by TODO 41's fix pass, which landed CONCURRENTLY (its PR
merged while this tier's battery ran). Both builds independently measured
the same defect: the reserve hand rode **0.0014** over its well floor —
the plan's predicted finding, far worse than the seconds side's 0.12,
because the `'minute'` kind's central width law hung this short blade's
keel ≈ 0.299 below its plane under the same authored 0.3 standoff. This
tier measured it and waived citing TODO 41; the fix pass measured it,
re-planed BOTH well hands onto a derived plane (`wellHandZ`, the item's
own fix path), seeded the `Dial ⇄ Power reserve` row unwaived, and
CLOSED the item. The rebase keeps the fix and drops the waiver — the
better outcome, recorded here because "two builds, one number, hours
apart" is also evidence the instrument measures what it claims. Measured
at identity on the rebased tree:

| pair | seeded by | measured | contacts declared |
|---|---|---|---|
| `Power reserve ⇄ Power-reserve train` | this tier | 0.55 | 2 — the hand's collet and blade on the w2 output arbor |
| `Dial ⇄ Power-reserve train` | this tier | 0.55 | 4 — the same joint re-attributed through nesting, plus the arbor through the well floor's bore and across the printed floor's plane |
| `Dial ⇄ Power reserve` | TODO 41's fix pass | 0.19 | 0 — no contact exists; the pair owes clearance everywhere, and post-fix it has it (0.0014 before) |

Nine pairs, zero waived: the fix pass's derived planes retired both
TODO 41 waivers, so `expectedContacts` runs entirely unwaived for the
first time since the check existed.

The hand's meshes come named by the fix (`namePrefix: 'reserve'`); this
tier's residue on that front is the arbor's name (`rsvHandArbor`) and one
hardening — both well hands now carry their FULL build spec (`subdial`
and `namePrefix`) through the flute-slider's re-cut, where the fix had
left the recut table on the old args: a flute drag would have silently
regrown the blade the fix slimmed and unmatched every selector. Naming
the arbor also tripped a wire worth recording: `INTRA_UNIT_CONTACTS`'
"differential wheel on its stud" joint selected the arbor by its INDEX
label (`CylinderGeometry#8`) — the only handle an unnamed mesh has — and
the full battery failed `intraUnit` the moment the name landed, the
declared press-fit reading as an undeclared intersection. The
couple-by-string trap, fired exactly as designed; the joint now selects
by name, which is what index labels were always standing in for.

### The handle is keyless-tier, and that needed one honest branch

The `RECONF_HANDLES` row is tier A's radial shape verbatim — `radial:
true`, `def` = `dialRadius · 0.39`, refusal in CLOSED FORM against
`rsvrWindow` (never read from a shadow-solve; tier A's fallback lesson),
the ring on w2's real arbor at `rsvPivotXY` rather than on the printed
well. But this station never enters `solveLayout`, so the generic drag
path would shadow-solve the LAYOUT and get the identity build back — the
ghost-that-is-not-the-proposal trap, one solver down from where tier A
found it. The row therefore carries its OWN shadow: `solveKeyless` re-run
on the candidate radius (its warnings join the verdict) plus
`rsvTrainWarnsAt` on the candidate station, and no constellation paints
because the train honestly does not move. The chrome grew its eighth
ring, and the hint, idle line and handle list are in all three locales.

### The gate

Full battery at identity on this tree (local, this container's headless
Chromium): **19/19 gates pass**, boot silent, fingerprint **2134288613 on
both virgin boots** — the same hash the rebase base (`c69c0ff`, TODO 41's
fix landed) produces. `spec boots` 20/20 (16 on the base) — the four
new `rsvr` rows declared above, each measured before it was written
down. The `--report` diff against a base-tree run of the same harness
(also 19/19) shows exactly the designed delta and nothing else: 20
differing leaves, of which 13 are per-check `ms` wall clock and 7 are
`expectedContacts`' results array growing 7 → 9 by the two seeded
train rows — the seven shared pairs are byte-identical (0 waived on
both sides; the fix retired TODO 41's waivers on the base), and every
other check's rows and numbers are byte-identical.

## §95 — A primer page: the explainer for readers who don't read the source

Filed from an owner decision after timesim#189, where one hacking-seconds
plate had to serve two audiences in the same figure: a novice's misreading
("the pad's station is a circle — there is no gap to aim at") and a
contributor's derivation, three quoted constants below it.

**The problem was a page paying two audiences in one paragraph.**
`explain.html`'s whole contract is contributor-facing, deliberately: its
header promises "values quoted from src/*.js", `tools/explain-quotes.mjs`
holds that promise as an exit code, and plates quote constant names
because the § convention is "the number IS the identifier." It is, in
everything but filename, the movement's repair manual. A curious reader
with physics 101 needs a different page — torque and inertia as ideas,
`√(k/I)` as the reason a balance keeps time, gear ratios as arithmetic
you can check on your fingers — and NO identifiers, because to that
reader a constant name is noise standing where an explanation should be.

**Why a second page, not a rewrite — two rejected shapes, recorded.**
Refocusing `explain.html` on novices was rejected: its prose is keyed
into the repo's two largest translation tables (~500 de/zh keys), editing
the English invalidates translations BY DESIGN, and a novice rewrite
would strip the quotes gate of its subject while demoting a page already
doing its job. One-page-two-tiers (a collapsible "the numbers" block per
entry) was rejected: it muddies the header's one-sentence promise,
doubles every entry, and makes the i18n keys carry both registers at
once. A separate page keeps both contracts clean and each page's gate
about one thing.

### What shipped

**The page.** `primer.html` — same visual system as `explain.html` (dark
HUD styling, `details.mech` sections, SVG plates), opposite contract,
stated in its header stamp the way the technical page states its own:
*quantities rounded, with units · no source identifiers*. Nine entries in
power-flow order: the mainspring as bent steel, the fusee as
pull-times-lever-arm, the train as checkable multiplication (one turn in
8 hours becomes one turn in 6 seconds; 12:1 from 3 × 4), the escapement
as held-then-released, isochronism as the amplitude falling out of the
formula, the keyless works, the alarm, the gong's inharmonic partials,
and a closing entry that teaches the repo's modelled-vs-simulated
vocabulary in plain words — because that honesty rule binds this prose
exactly as it binds the technical page, and several entries carry their
own plain-language honesty notes (the authored strike tempo; the
scaled-down drawn amplitude). English-first; localization is a later tier
on §73's pattern (the i18n tooling hardcodes `explain.html` by name in
four places, so the primer earning translation is also the change that
gives that tool a page parameter).

**The links.** The HUD's one link site (§65's "Mechanisms · How they
work" row) now fronts the primer — the sim's default audience is the
curious visitor — and each page cross-links the other in its header
("want the numbers? →" / "just want to understand it? →"). One deviation
from the filing, in the cheap direction: the HUD row's STRINGS are
unchanged, so its existing tier-one translations carry over and
`src/i18n.js` needed nothing. The new header link on `explain.html` is a
new translatable key and was translated into both tables in the same
landing — coverage held at 100% (513/513 both languages) rather than
moving.

**The gate.** `explain-quotes.mjs` now also scans `primer.html` and
requires ZERO identifier claims — the identifier-free rule enforced by
the same instrument that enforces the opposite rule next door. It runs
the same claim extractors the explain half uses, plus a broader sweep the
primer alone gets: any SCREAMING_SNAKE token, and any ALL-CAPS name
`src/*.js` declares (STOP-listed page furniture like PLATE excepted),
because on this page an identifier is a violation even without a number
beside it. The gate was proven able to fail before it was trusted to
pass: an injected constant name produced 2 findings and exit 1.
`explain-i18n.yml`'s paths filter gains `primer.html` so the page
changing re-runs it; the explain half's verdicts were untouched.

### The shipping checklist, and where the filing's plan met the archive

The filing said: hardcode the new page into every list (`stamp-release`'s
seeds and both document loops, `build-pages`' lists, `offline-check`'s
copies, two workflows' paths filters), because nothing discovers pages
and `test-geometry.html` shipped unstamped for sixty sections. All of
that happened — with one structural correction the §88 machinery forced.

**A hard seed assert would have frozen Pages.** `pages.yml` stamps
testing and production from trees archived at their release TAGS, with
main's tooling — and every tag cut before §95 has no `primer.html`.
`stamp-release.mjs`'s seed check is a hard exit, so the filing's
unconditional list would have failed every Pages deploy (all three
environments — one artifact) until a release carrying the page was cut
AND manually promoted. `test-geometry.html` never met this in §88 because
it existed in every old tag; §95 is the first page ADDED after the
archive-stamping machinery, so it is the first to need an answer. The
answer: the primer joins as an ADOPTED seed — present, it is stamped,
precached, version-baked and scanned like the other documents; absent,
the stamper says "pre-§95 tree, stamping without it" and proceeds,
because a pre-§95 tree is a normal input, not a broken one. What absence
must never be is a silent typo, and the discriminating assert lives where
the two cases split: `offline-check.mjs` builds its trees from the SOURCE
checkout — where the page does exist, copied by a hard list that throws
if it is missing — and boots `primer.html` OFFLINE (check 10 of its 21).
A mis-listed seed drops the primer from the precache and that boot fails.
`build-pages.mjs` filters the same way for the same reason; the primer
gets `explain.html`'s environment treatment (indexable in production,
noindex elsewhere), not `test-geometry.html`'s (noindex everywhere).

**A six-section-old bug surfaced under the new page's feet.** The
stamper's app-version bake tested presence with `/name=["']app-version["']/`
— and `explain.html`'s own §79 registration script contains that exact
text, inside `querySelector('meta[name="app-version"]')`. The test read
the page's selector as "meta already present", skipped the insert, found
no actual tag to update, and shipped `explain.html` WITHOUT a baked
version in every release since §79 — meaning its release-gated worker
registration never fired on a direct landing. Invisible, because
`index.html`'s worker controls the whole scope once the app has been
visited, so every offline assert passed. The primer registers the worker
the same way and would have inherited the same dead code. Fixed at the
source: the presence test now matches the TAG (`/<meta\s+name=…/`), and a
new assert reads the bake back — every stamped document must carry its
version meta or the stamp exits 1, because this failure was silent for
six sections precisely because nothing read the result back.

### Acceptance, measured

The primer ships stamped in the change that creates it — the §88 leftover
scan covers it and reports nothing unversioned; `offline-check` 21/21,
including the primer booting offline in a release tree and the two-
environment origin; both pages cross-link; `explain-quotes` reports 0
identifier claims on `primer.html` with the explain verdicts unchanged
(26 agree, 3 opaque, 0 disagree); `explain-i18n --check` passes with
coverage not moved (100% both languages, the one new key translated in
the same landing). The battery is untouched by construction — the page is
sim-code-free, and the one `src/main.js` edit is an href in the HUD's
static template.

### §95 tier two — the primer, localized

§95 shipped English-first and said localization was a later tier on §73's
pattern. This is that tier: `primer.html` in German and Chinese, at 100%
coverage (91/91 keys in both), with the locale select in its header and the
same reload-tier resolution as everything else (`?lang` → `localStorage` →
`navigator.language`).

**One engine, not a second copy.** §73's tier two lived in
`src/explain-i18n.js`: the collector, the swap and the explainer's tables in
one file. The moment a SECOND page wanted it, the choice was one engine with
per-page tables or two copies of the collector — and two copies is the exact
failure this tier already guards against, because extraction, verification and
rendering must not be able to disagree about what "translatable" means. So the
walk and the swap moved to `src/page-i18n.js`, and each page now contributes a
dozen-line module that names its own tables and nothing else
(`explain-i18n.js`, `primer-i18n.js`). `explain.html`'s import path and public
API are unchanged; its 513 keys and 100% coverage did not move.

`tools/explain-i18n.mjs` grew the `--page` it was always going to need — the
filing predicted this, noting the tool "fetches explain.html by name in four
places." `--check` with no page checks EVERY page, because a gate that only
looks at the page you remembered to name is not a gate.

**The number rule INVERTS between the two pages, and that is the interesting
part.** `explain.html`'s numbers are identifiers being quoted: `0.15` must
survive translation byte for byte, because the page's promise is that its
numbers are greppable in `src/*.js`. CLAUDE.md called that "the one place tier
one's `fmtNum` rule deliberately does not apply" — and the primer is the case
that shows the rule was right to be stated as an exception. It quotes no
identifiers, so its numbers are quantities being READ ALOUD, and a German
reader is owed `0,024 mm` and `18.000` exactly as the app's chrome owes them
`30,0 h`.

So the gate is per page, and the page DECLARES which rule applies (its i18n
module's `NUMBERS` export; the checker reads it rather than assuming). On a
source page the check is glyph identity, as before. On a quantity page it is
VALUE identity after locale parsing — `,` and `.` swap roles per locale, so
`0,024` passes and `0,25` fails. Both directions were verified rather than
assumed: the German table's localized punctuation passes, and an injected
`0,25` fails with exit 1.

Two things fell out of doing it, both real:

- **A fixed header cannot be allowed to wrap.** Both pages' bars are
  `position: fixed` above a constant body padding, so a second line does not
  just look wrong — it covers the first paragraph. German (~30% longer) put
  the primer's bar on two lines and clipped the intro, and `explain.html` was
  already one cross-link away from the same fate after §95 added it. Every
  item is now `nowrap` and the STAMP is the one that yields — it ellipses,
  and below 820 px it leaves. It is the right thing to drop: the cross-links
  are navigation, and the stamp restates what the page says in its own first
  paragraph. Measured after: header 56 px, nothing clipped, no horizontal
  scroll, across both pages × three languages × three widths.
- **`explain-quotes` was measuring the FILE where its contract is about the
  PAGE.** The primer's new module script tripped the identifier scan on
  `import { UI_LANG }` — correct by the letter of "no identifier appears in
  primer.html", wrong by its meaning. Markup and text are now scanned whole
  while a script contributes only its STRING LITERALS, which is precisely the
  part a reader can end up looking at; stripping scripts entirely would have
  gone blind exactly when the primer gains its first interactive plate. That
  fix needed a fix of its own, and it is the better story: an apostrophe in an
  English comment (`rich blocks' innerHTML`) opens a phantom string literal
  that runs to the next quote and drags real code in with it, which is how the
  scan kept reporting a line it was supposed to have dropped. Comments come
  out first now. All three states are verified — clean passes, a prose
  identifier fails, an identifier inside a script's string literal fails.

Measured: `explain-i18n --check` PASS on both pages (explain 513/513 de and
zh, primer 91/91 de and zh, 0 unmatched, 0 markup/`<code>`/number drift, 0 new
plate-fit collisions); `explain-quotes` PASS with 0 primer identifier claims
and the explain verdicts unchanged; `offline-check` 22/22, the new check being
a GERMAN primer booting offline — the locale tables arrive by dynamic import,
the one class of URL that reaches the precache through the stamper's module
walk rather than a document's markup, and a German reader offline is exactly
who would have found that gap (precache 23 → 27).

#### The skip list is now held true by the battery itself

`battery.yml` skips the whole job when every changed file matches its
`paths-ignore` list, and §95's two pages belong on it for the reason
`explain.html` already did — sim-code-free by contract, gated by the
Explainer workflow instead. Three entries were added: `primer.html`,
`src/primer-i18n*.js`, and `src/page-i18n.js` (tier two's shared engine, which
imports `src/i18n.js` rather than being imported by it — the arrow points away
from the app, so nothing on `index.html`'s graph reaches it).

Adding them is also what exposed how sharp that list is. **The obvious glob
for the two pages' tables is `src/*i18n*.js`, and it matches `src/i18n.js` —
which `src/main.js` imports.** One character of convenience between a correct
list and one that lets every tier-one chrome change skip the battery, silently,
with a green tick. Every entry there makes the same claim ("the battery cannot
see this file"), it was kept by reading, and it is the one class of claim whose
failure is invisible by construction: a wrong entry disarms the gate on exactly
the change that needed it, and no run happens to say so.

So `ci-battery.mjs` now walks `index.html`'s transitive module graph — its
entry points, then every relative `import` and `import()`, to a fixed point —
and fails if any file the list ignores is ON that graph. It reads the list out
of the YAML rather than restating it, because a copy is a second list someone
keeps in step, which is the failure `tools/payload.sh`'s header already names.
It also fails when it cannot READ the list: a regex that stops matching yields
an empty list, an empty list intersects nothing, and that is how an
empty-set instrument passes for the wrong reason.

It lives in the harness rather than in its own workflow because
`.github/workflows/**` is deliberately absent from the ignore list — so a
change to the list always runs the battery, and therefore always runs the check
that judges it.

Verified against five dangerous entries, each caught: `src/*i18n*.js` (→
`src/i18n.js`), `src/main.js`, `src/*.json` (→ `src/aesthetics.json`, the
asymmetry the workflow's own header warns about), `vendor/*.js`, `**/*.js` —
plus both unreadable cases, a renamed key and a missing file. The current list
passes: 12 patterns against the 12 files reachable from `index.html`.

## §98 — `?alarmr=` : the alarm corner's radius as a spec dimension, §76's missing pin

Filed and built 2026-08-10, from §76's Phase A re-measure. That sweep
reduced every remaining balance wall to ONE cause: the corner's default
radius tracks the plate (`alarmCornerR = dialRadius · 0.39` since §94
tier B), so a grown balance grows the plate and carries the whole
setting cluster outward into fixed-radius neighbours — the climb pivot
into the balance's plate cut, i2 into the winding climb (azimuth-
invariant, both ride the corner), i1 into the §34 selector posts.
§94's scope guard had deliberately left this key unfiled; §76 needing
it was the trigger to file it, and tier B's decoupling is what makes it
ONE key instead of ten edits — the climb, the stem, the collar, the
dogleg and both plates' bores all follow `alarmCornerR` already.

### The build is §94 tier C's C1, one dimension over

`alarmR = null` joins `solveKeyless`; `SPEC.alarmr` defaults null and
`KEYLESS_INPUTS` spreads it in only when present, so identity passes
nothing, evaluates the same arithmetic, and fingerprints 2134288613 on
both virgin boots — bit-exact. The solver warns on the one bound IT
owns for a spec'd corner — the stem must have positive length inside
the case rim, `(0, plateR + 2.2)` — and deliberately leaves the
interior to the instruments that already state it with numbers: the
setting dogleg goes route-null past ≈ 19.9 (`i2 37 t cannot reach the
arbor — needs ≥ 38 t`, measured at `alarmr=20`), and the winding
chain's idler derives from the span with its plate ceiling asserted.
Measured before written: `alarmr=14` boots silent; 17 walks the pivot
into the shipped balance's own plate cut (reported); 20 hits the dogleg
reach; 46 fires the stem window warn and still boots. Three `spec
boots` rows declare the points. No reconfigure handle — the alarm
crown's rim grip owns the corner's AZIMUTH by angular drag, and a
radius reading on the same member is new interaction vocabulary,
deferred inside the §98 filing, stated.

### What the pin buys, measured — §76's Layer 8 in one line

With the corner pinned at its shipped value and the §94 keys doing the
rest, **a 33% larger balance boots SILENT**:
`?alarmaz=235&rsvr=14&alarmr=15.4` at R 12 — zero warns (245 likewise;
240 shows TODO 15's anti-phase mesh report, an instrument, not a
wall). The §76 record in the roadmap carries the full layer: which wall
each key retired, and the full check suite's verdict at that spec.

### The gate

Full battery at identity on the finished branch (this key plus §97
beside it, local): **19/19 gates pass**, boot silent, fingerprint
**2134288613 on both virgin boots** — bit-identical through both keys.
`spec boots` 26/26 with the identity control silent. The `--report`
diff against the §94 tier C tree: 13 leaves, all per-check `ms` wall
clock — neither key adds geometry or check rows at the default spec.

## §97 — `?subdialr=` : the sub-dial well radius as a spec dimension, and the finish knob retired

One quantity, one control, in the right tier. `radiusFactor` was §23's
finish knob over the solved radius — the right description of a finish
knob and the wrong tier for a movement dimension, in three measured ways
the filing named: the factor reached the solver as a MODULE IMPORT, so
no shadow-solve could override it and the reconfigure ghost could never
draw a candidate; a browser-local multiplier on a spec dimension let the
URL and the picture disagree silently, per machine; and the range was
one-sided at identity (the solve sits exactly on its ceiling), §74's
"every position past the incumbent is refused" shape.

### The promotion, and the floor that never existed

`subDialRadius` joins `solveKeyless`; the old expression splits into the
named CEILING (TODO 33's — `min(stations) − SUBDIAL_INBOARD_CLEAR`,
11.85 today) and the value, and the retired factor's `× 1.0` multiplies
out exactly in IEEE-754 — identity is bit-exact by construction and by
measurement (fingerprint 2134288613, double-boot). The FLOOR is new:
the pocket's own centre bore plus a wall plus the one margin —
`SUBDIAL_FLOOR = SUBDIAL_BORE_R + DIAL_WALL_HALF + CLEAR_MARGIN = 1.40`
— with the bore constants HOISTED to `layout.js` (TODO 33's hoist, one
bore over), so the solve that bounds the radius and the geometry that
drills the hole read one source. The retired knob's 0.5 minimum landed
at 5.93 — four times the geometric floor, a legibility choice wearing a
geometry reason (§86's subject) — and was not carried across. A spec'd
radius outside either bound CLAMPS with a warn, deliberately unlike
`rsvr`'s build-and-judge: a breached bore is the exact degeneracy
TODO 33 closed, so there is nothing honest to build there.

Measured before written (`spec boots` rows): `subdialr=8` boots silent;
13 clamps to the ceiling and says why; 1 clamps to the floor and the
reserve train's tip check then reports w2 reaching through even the
clamped well (5.23 against 1.05) — two instruments composing on one
nonsense spec.

### The aesthetics import leaves the solver

The one-line diff that carries the tier argument: `layout.js` no longer
imports the finish layer at all. A persisted browser-local override of
the removed key cannot crash or alter the boot — the §23 loader's TYPE
ANCHORING refuses a key the file no longer carries — and that was
PROVEN with a seeded-localStorage boot (0 warns), not assumed. The
`dial.subdials` block keeps only its contract sentence, now true about
both properties: position and size are dimensions of the SPEC, and
finish holds no sub-dial knob.

### The handle, and its stated concession

The third radial `RECONF_HANDLES` row. A radius has no arbor, so the
ring sits on the SECONDS well — whose centre IS the fourth wheel's real
arbor — at the well's own radius, and the reading is the pointer's
distance from that station. One radius serves BOTH wells, so the
proposal ghosts both (`reconfShowWellGhost`, two rings at the two
stations at the candidate radius): highlighting only the ring under the
pointer would state something false about what the drag does. The row
is keyless-tier (the radius never enters `solveLayout`), carries its own
shadow, and judges the reserve train's tip-vs-well bound against the
well being PROPOSED (`rsvTrainWarnsAt` gained the candidate-radius
argument). Refusal is closed form against both derived bounds. The
row's grab disc shares its centre with the `d4` handle's — the
tie-break gives the inner disc to the wheel and the outer annulus to
the ring, which is also what a finger would expect.

### The gate

Full battery at identity on the finished branch (this key plus §98
beside it, local): **19/19 gates pass**, boot silent, fingerprint
**2134288613 on both virgin boots** — bit-exact through the factor's
retirement and the promotion, the entry's IEEE-754 claim held by the
instrument. The persisted-override boot proved clean, every declared
spec point was probed before its row was written, and the `--report`
diff against the §94 tier C tree is 13 `ms` leaves and nothing else.

## §99 — the alarm barrel holds its own wind: wound arbor, ratchet wheel, and a hooked click (TODO 37 closed)

TODO 38's `alarmWind` axis landed a day ahead of this section, by
deliberate sequencing: the click's working direction was policed by the
battery from its first boot. This section is the "other split" §89 filed —
the true going barrel — with the state law as its P0 core and one derived
identity as its whole layout story.

### The state law

`alarmBarrelWind` and `alarmStrikePhase` become independent states. The
BODY's angle is a pure function of the phase (`bodyA = phase·2π/16`), so
the body and its striking pinion sit on the coupled mesh family at every
state — under the §25 C wind-derived law the rest pose carried the
striking wheel ~0.3 pin off-family, invisible to the pin⇄tail budget,
which sweeps only the identity-coupled axis. The ARBOR rides
`bodyA + (wind − 1.75)·2π`, so the ribbon is wound between the two rotors
and `arborA − bodyA` IS the wind: winding advances the arbor over a
parked body (the striker stands through a posed or a hand wind), and a
ring runs the body under a parked arbor (`arborA ≡ 0` across the whole
`alarmStrike` axis — the click's hold, visible in the numbers). The
ribbon's morph is untouched: `setWind` reads the relative angle, which is
bit-identical to the fixed-arbor law's value at every wind.

### The coaxial identity

TODO 37 predicted a re-derived centre distance, moved idlers, and a
re-probed lane. The arbor is coaxial with the rim, so the winding wheel
takes the rim's own count — `ALARM_WIND_W = ALARM_BARREL_TEETH` — and the
reach solve, the two-circle closure, and the crown ratio survive
bit-identical. The whole re-route is a stratum: the ARBOR TIER, each band
derived (body top + `CLEAR_MARGIN` + the float-bind centi-unit; wheel,
then ratchet, then the arbor's shoulder), the idlers and climb pinion
lifted to the same plane, and the chain solve split in two — the winding
run ends at the arbor wheel (a saw cannot be a gauge member), the body
keeps exactly one mesh into the striking pinion. The re-probed lane came
back empty: zero foreign meshes cross 11.61..13.2.

### The click, twice redesigned by measurement

The ratchet: R 6.0 from the click's grounding lane — the pivot stud at
`1.28·R` must clear the TALLER of the two toothed bands it rises past,
the body's tip circle and the arbor wheel's addendum plus its extrude
bevel (`makeGear`'s `bevelSize` expands the outline in XY; the wheel
binds at 6.9 + 0.066 over the body's 6.885), by stud + margin. The first
cut used the body alone (R 5.9) and the stud measured 0.0651 to the
wheel where the floor owed 0.15 — the two-bevel lesson the tier's
z-stack had already paid, re-learned radially. N 32 =
2 × strikes-per-barrel-turn (give-back ≤ half a strike). The click could NOT be `makeClick`'s straight blade: its
inner edge crosses the tooth annulus over more than one 32-tooth pitch
and fouls a tooth at every park (measured −0.28; the set-up click ships
the same geometry invisibly — both its sides are fixtures, the class
CLAUDE.md's blind-spot note names). The hook keeps the arm outside the
tip circle (boot-asserted per vertex) and drops a V-nosed point whose
sides are steeper than both ramp and face. And the ride could not be the
maintaining detent's fixed-azimuth read: at this lift the nose's azimuth
moves with its own rotation, and the shortcut parked it 0.24 inside a
tooth — the contact is solved per tick as "the smallest lift that clears
the metal": a coarse scan over the lift range plus bisection, because a
Newton/fixed-point iteration on the tip kinematics DIVERGES at the tooth
face (its slope, 21.5 radial per radian of azimuth against the tip's
~4.5 lever, made the map leave the nose 0.35 buried at one axis pose).
The constraint is the V's whole UNDERSIDE — thirteen points along both
edges, not the point alone — so a V edge resting on a tooth corner is a
solved contact, not a phantom penetration. Park kiss: **0.0115** against
`HANDOFF_TRACK_TOL` 0.03.

### The instruments

New unit `'Alarm click'` with support/drive rows and the `alarmWind` case
in `sourceFor`; a `click beak ⇄ arbor ratchet` handoff row; a penetration
budget on the `alarmWind` axis at `HANDOFF_TRACK_TOL`, 480 samples (the
pin⇄tail row's per-cycle density over the ride's 56 cycles) measured
BESPOKE — pawl vertices against the analytic saw the teeth were cut
from, because the generic MTV resolves a hair of edge contact on the
wrapped valley as the full 0.35 axial pop-out (§61's "a number about
the search space, not the fit", again); floors rows
that retire the winding pair's blanket excuse; declared intra-unit joints
(including two pre-existing marginal keyless wheel-on-arbor joints,
measured flickering on pristine main); stock kinds; `declareTravel` +
`declareRestoring('Alarm click', 'spring', …)`; the schematic hook line
and the ratchet drawn from its own cut outline (`userData.profile` — a
saw drawn as a pitch circle is a false glyph); a wound-at-rest
fingerprint pose (the state class the split created); and the
equalisation record's hold quantum (2π/32, half a strike).

## §100 — the going drum turns ON its arbor: the fixed member moves to the set-up work (TODO 39 closed)

The claim was always right and the model was always wrong. A fusee
movement's going barrel has a FIXED arbor: the set-up ratchet holds it,
the drum turns around it, and the mainspring's inner end is pinned to a
collar on it — which is exactly why the collar and hook have lived in the
static `Set-up work` unit since TODO 1. But the arbor CYLINDER those
parts claim to sit on was built by `makeBarrel` inside the rotating
group, so it turned with the drum — a lie no instrument could see,
because a cylinder rotating about its own axis is visually identical to
one standing still, `intraUnit` had no fixture in the unit to compare
against, and the collar's overlap lives in an EXPECTED pair. TODO 39
filed it for exactly that reason; §89 had already built the fix and
proven it on the alarm barrel.

### What moved, and why each piece belongs where it landed

`makeBarrel` gets the §89 arguments (`arbor: false`, `arborBoreR =
barrelArborR + PIVOT_BORE_CLEAR`), so the drum's floor and lid are bored
for the arbor they run on — the bearing is body-on-arbor now, the alarm
barrel's arrangement. The arbor itself is built with the set-up work,
same spans and radii the rotating copy carried, each now derived where it
lives: the working section (`barrelArborR` = 0.9) from the old `arborH`'s
own bottom up to `TQ_MID_Z`, where it stands in the plate's plain
bushing; below, it necks to the 0.6 staff the set-up square was always
filed onto (`SQ` across-corners has quoted that staff's diameter since
the square was built) and runs to the base plate's seat.

The old `addLowerPivot`/`addUpperPivot` calls on the rotating group are
deleted. On a fixed arbor those were not pivots — they were the arbor's
own ends drawn on the wrong member. The plate-bore registration moved to
the arbor build (same derived radii the calls carried as 0.9/0.95
literals), and the lower JEWEL is gone outright: a jewel bears a rotating
staff, and this one no longer rotates — the fusee arbor's own "plain
bushed bore, no jewel" argument, one member over. The bore stays a
running clearance rather than a press fit because the arbor must be able
to turn at the BENCH: lift the click and let the spring down — that is
what the let-down convention on this movement's other arbors already
models.

### The support graph now tells the fusee story

`Mainspring drum → Set-up work` (body on its arbor, measured gap 0) and
`Set-up work → Three-quarter plate` (arbor top in the bushing, gap 0.05 =
`PIVOT_BORE_CLEAR`) replace the two rows that grounded the drum on both
plates. The drum's EXPECTED grant against the plate became a `Set-up
work` row for the same reason — an EXPECTED grant on a pair that can no
longer touch is a standing excuse. Measured at landing: the arbor's world
matrix is bit-identical across the `reserve` axis while the body's
moves; support 0 failures with both new edges green.

### Residue, stated

The arbor⇄square and arbor⇄collar joints are fixture-vs-fixture inside
one unit — TODO 5's still-invisible class, recorded in the TODO rather
than as dead declarations. The drum-bore⇄arbor bearing is cross-unit
inside an EXPECTED pair with no floors row — TODO 6's catalogued residue.
The new meshes are kinded (`mainspringDrumArbor`, `mainspringDrumStaff` —
shaft stock over the pivot floor by an order of magnitude) rather than
left to swell the unit's default-kind waiver.

## §101 — the click faces the right way: reverse-cut saw, a beak cut to the tooth space, and the give-back enacted (TODO 37 follow-up)

A user report — "the click doesn't interlock with the star wheel, most
obvious when winding" — and the measurements behind it found three
defects, each of a class the instruments structurally cannot see.

### The saw ran backward, and nothing gates direction

Traced over one winding tooth-cycle: the nose's tooth coordinate climbed
the STEEP FACE (radius rising 5.56 → 5.97 over 0.28 of the pitch) and
slid slowly down the shallow ramp — the exact mirror of a ratchet's
one-way. Every gate stayed green because contact, penetration, and
clearance are all direction-blind; the interactive `aDelta > 0` guard
meant reverse was never driven, so the inversion had no behavioural
symptom at all — only a visual one (the beak spends most of each cycle
lifted high on the face). `makeRatchetAndClick` gains a `reverse` cut
((x, y) → (x, −y) with point order re-reversed, so the winding and the
extrude normals are untouched), the arbor ratchet takes it, and the
mapping's sign is mirrored at every consumer (tick's `clearAt`, the
bespoke penetration measure, the settle law) — the DIRECTION is now
derived in the build comment from the interactive law's own sign:
winding increases wA, u = (rel − az)·N/2π, du/dwA > 0, so winding
climbs the ramp. Measured after: root→tip ramp ride, snap off the face.

### The beak fills the valley it parks in

The first hooked cut dipped a narrow V (a third of a pitch, shoulders
grazing the crest circle) — measured green everywhere and still LOOKING
disengaged, because a point contact is invisible at movement scale. The
beak is now cut TO the tooth space, both profiles sampled from the same
`sawRadiusAt` the teeth were cut from: leading edge parallel to the
FACE it holds against (offset one hairline, 0.01 at the crest, touching
at the point — coincident surfaces flicker instruments); trailing
underside along the RAMP + 0.02 over 0.6 of the pitch; only the POINT
touches at seat, so the contact stays a solved kiss and the ride law is
unchanged — the underside sample points are now the pocket profile's
own vertices, densified. The arm slimmed 0.25 → 0.18 (its load is
compression against the face), and the outside-the-tips assert upgraded
from per-vertex to per-EDGE (a chord between two legal vertices can
still dip inside the tip circle — segment minimum, not endpoint
minimum).

### The give-back is a state law now

§99 reported the hold quantum (2π/32) and deferred enacting it, and the
deferral was most of the visual complaint: with no recoil, winding
leaves the beak parked mid-ramp at whatever angle the crown stopped.
`settleAlarmClick` enacts it: on the interactive wind's falling edge
(and once at boot for a restored wound state), the arbor gives back the
parked fraction of ONE pitch — at most 1/32 turn — until the face meets
the beak, taken OUT of `alarmBarrelWind` so the recoil travels the
gears and the winding train and crown visibly snap back a hair.
EDGE-triggered only: setPose'd transients (the axis sweeps) must render
exactly as posed, and an every-tick snap would quantise them into a
staircase. Measured: settle 0.0254 turns < the 0.03125 quantum, seat at
u = 0 exactly, park kiss 0.0164 against `HANDOFF_TRACK_TOL` 0.03,
pawl⇄saw penetration 0 over the fine ride.

### The post collision was real, and the instrument beat the probe

The user's "collides with the post next to it" was first dismissed as
projection on the strength of a 480-pose vertex-sampled sweep
(pawl-vertex to post-surface minimum 0.71). The `intraUnit` gate then
failed the pair at a pose-net leftover state, and dissection proved the
gate RIGHT: the graze is face-to-face — the spring HEAD's z-band
overlaps the pawl's by 0.15, and the arm's long flank has vertices only
at its ends, so vertex sampling is structurally blind to exactly this
contact. The fix is position-space: the anchor post's station is now
DERIVED from the arm's swept lane (its radius holds head + arm
half-width + `CLEAR_MARGIN` at the ride's cap lift, asserted at boot),
and the spring's radius is derived from its own chord rather than
clamped (the outboard station stretched the chord past the family
radius, and a clamped arc would have quietly reached neither end).
Method note for the next probe: a vertex-min sweep is not a clearance
measurement on long-flanked parts — use surface-to-surface
(`meshClearance`) or trust the gate.

### The class, named for next time

Nothing in the battery gates one-way-ness: a mirrored saw passes every
contact, penetration, and clearance check. The going set-up click and
the maintaining ratchet have never had their directions exercised
either — both are static or bench-only today; the TODO 37 block carries
the note.

## §102 — the lock's return: a blade the column works against (TODO 31 closed)

Item 28 made the lock lever move BECAUSE the column moved; it did not
give the lever a way back. A column pressed the beak and held the lever
engaged; when the gap arrived, the pose law said it rose and no element
in the movement did the rising — §48's audit said so every run ('Alarm
lock' in `restoredByNothing`, waived citing TODO 28, the waiver being
the finding rather than a suppression).

The fix is the item's own prescription, part for part: a flat return
blade (`alarmLockSpring`, `SPRING_FLAT_U` stock) on its own plate-top
stud, bearing on the arm's wheel-side flank with a 0.05 preload at the
lifted pose, biasing the lever toward LIFTED — so the column has
something to work against, which is what a column wheel is for. Said out
loud, as the item asked: the spring-only rest state is LOCK LIFTED (beak
seated in a gap, pad off the collar); a column overcomes the blade to
hold the brake on. `declareRestoring('Alarm lock', 'spring', …)` beside
the build; the `RESTORING_WAIVERS` row deleted — the audit's last
geometry-backed waiver, leaving only the Dial row (TODO 29's unnamed
mesh).

Two derivations rode along, both promised by the item. `ALARM_LOCK_LIFT`
was 0.085, commented "~0.4 of the radial air" — a chosen fraction of the
space available, underivable while the lift had no load path. It is now
`(CLEAR_MARGIN + 0.01) / ALARM_LOCK_L` = 0.032 rad: the pad's required
clearance at the collar over the lever's length, float-bind centi-unit
included; the beak's width bound only loosened (tangential swing
0.20 → 0.07). And the blade's BEAR STATION is position-space, not
placed: it shares the collar's z band, so the wheel-ward lane is the
scarce one — the bear point stands at the smallest arm fraction that
clears the pivot's own hardware, which is also the station farthest from
the collar; both lanes are asserted at boot, and the asserts print the
achieved clearances if either regresses (both passed silently at
landing).

P1, TODO 16's format, in the build comment: the only load the spring
carries is the lever's own lift (no counterforce meets it at the gap),
tip-force order single mN against the pusher-driven column arriving
through a 2.3 lever — three orders of headroom. The blade is sized by
its stock convention; the HOLD when braked is the column's.

## §103 — the lifter's guide stack derives downward (TODO 42 closed)

TODO 42 measured the release lifter's blade stub 0.167 inside its own
guide eye at the rest pose — invisible until TODO 38's `alarmWind` axis
became the first pose anywhere to NAME `alarmCrownPullT: 0`, so every
earlier `intraUnit` pass had inherited a pulled crown and only ever
measured the L depressed. The item prescribed re-deriving the eye's z
from the stub's rest top plus clearance, and named two bounds to check
when moving it: the head's rest bottom and the collar above.

Checking those bounds was the design. The prescription has NO solution
with the stub held at its first-cut station: the collar's pulled
underside (the fat radius under the corner, z −4.87) caps the corridor
above the stub's rest top (−5.14) at 0.25, and an eye needs
`STOCK_MIN_U + 2·CLEAR_MARGIN` = 0.62 — TODO 23's arithmetic (which
removed the lifter's LOWER guide on the same verdict), one guide up.
No station exists for the eye between the stub and the collar.

So the stack solves from the corridor's TOP down, three derived
constants with their constraints in place (`ALARM_LIFT_EYE_Z`,
`ALARM_LIFT_STUB_Z`, `ALARM_LIFT_BLADE_Z`):

- **The eye's top face sits exactly where the plunger's top arrives at
  full depression** (`headTop − headH − ALARM_SLEEVE_TRAVEL`) — the
  highest station at which the bore holds plunger at EVERY pose. Any
  higher and the bore reads the head, not the plunger, at full travel;
  the bound also keeps the head clear of the bore (measured flush at
  exactly full depression, 0.00), which makes the stub comment's old
  "riding clear of it across the full travel" claim true at last.
- **The stub drops to hold the item's inequality at equality** below
  the eye: stub top = eye bottom − `CLEAR_MARGIN`, at rest — the
  closest approach, since the L's whole travel is downward from it
  (measured 0.150 rest, 0.375 pulled).
- **The blade root keeps its as-built bearing relation to the stub** —
  bottom faces flush, the tip riding the stub's underside — made exact
  (`(STOCK_MIN_U − SPRING_FLAT_U)/2`) instead of the rounded −5.39.

The stack's two open ends are boot-asserted with the achieved numbers
(rule 6): the collar's deepest underside over the eye's top measures
0.250 at both crown parities, and the blade's bottom over the chord's
top measures 0.184 — pose-invariant, because the tip and the chord
co-travel, so the rest figure is the figure at every depression. A
third assert pins the derivation's equality (bore holds plunger at full
depression, 0 by construction) so a warn names whichever side someone
moves. The `INTRA_UNIT_WAIVERS` row is deleted; the instrument measures
the repair — the landing's whole report diff against the §102 baseline
is that one waived row leaving. No mesh was added or removed, and the
fingerprint did NOT move (284533079): all three stations travelled
inside the unit's existing AABB envelope, which is §101's coarse-box
lesson again — the hash guards the layout, and `intraUnit` is the
instrument that actually saw this repair.

## §105 — the reversal detector stops lying: five artifacts fixed, a confirm tier, ten units measured out (TODO 43 closed)

TODO 43 filed three measured mechanisms by which the §36 registry's
`reversed` flag — the §48 audit's whole population — was a function of
walk composition rather than of motion: the witness-circle fit weighted
per-pose repeats, seam-duplicated vertices biased track centroids
off-axis, and long-span axes aliased chord directions. Fixing them
exposed two more of the same class; all five are closed here, and the
landing was accepted against the item's own arbiter, not the PASS
column.

The five, each with its constraint written at the site:

- **The fit runs over DISTINCT states.** `series` shares frames per
  pose, so a part resting through nine axes had its fitted centre
  dragged toward ~100 copies of the rest frame — the registry's own
  "repeats add nothing" convention, applied to its last holdout.
- **The fit's degeneracy test is scale-relative.** The absolute
  `|det| < 1e-12` was calibrated to with-repeats moment sums; distinct
  states shrank the sums and healthy fits null-rejected.
  `det/(suu+svv)²` is a pure collinearity measure, immune to scale.
- **Track centroids average DISTINCT positions, by quantized key.** The
  builder's seam copy is computed at θ = 2π, one ulp of sin from the
  θ = 0 original, so exact keys miss exactly the copies that matter
  (measured: the collar's centroid sat 0.031 off-axis, the item's own
  2r/(segs·2+2), and orbited with the mesh). The quantum's window is
  wide open — float duplicates coincide to ~1e-11, real vertices sit
  ≥ the §50 stock floors apart.
- **Angular steps come from the witness vertex's own angle, chained
  across dwells.** The extent's `lo` is not a phase: about the true
  centre a wheel disc's extent covers the full circle and `lo` jumps by
  whole vertex gaps at the ±π wrap, promoting monotone train wheels to
  'oscillates' — the biased fit had been hiding this by reading annular
  bodies as partial lobes. And adjacent-step sign products LAUNDER a
  reciprocation through dwell zeros (the fork parks on its bankings
  between strokes) — the finer the sampling, the blinder that test got.
  The witness angle advances by exactly the rotation; dwell steps
  neither vote nor reset.
- **A flip is a candidate until it reproduces (§36 job B's shape).**
  Deferred mini-walks re-sample each flip's own axis at 4×: a true
  reciprocation flips at every sampling rate, an aliased orbit — the
  crown's knurl teeth under `alarmWind`'s 210°/step — evaporates when
  the rate resolves the path. The mini-walks run AFTER both standing
  walks (neither's cumulative pose history moves) and patch only the
  flag: hulls stay exactly what the containment walk validated.

Measured outcome: ten units left the population — Alarm crown, Alarm
setting arbor, Escape wheel, Fusee & great wheel, Heart cam, Power
reserve, Reset hammer, Setting lever, Third wheel, Yoke — every one
verified MONOTONE in every axis from its own matrices at 4× the
registry's rate, the star's ground-truth method applied wholesale. Zero
units entered; the pallet fork control held; the registry is bit-stable
across repeated builds. The ten stale declarations retired with their
mechanism truth kept as comments ('Motion works' precedent) — most were
true of the WATCH and never of the pose net, and they return the day an
axis performs the cycle they describe. No mesh moved: the fingerprint
is unchanged, and `intraUnit`'s sibling instruments are untouched.
TODO 7's caveat stands, narrowed — the confirm tier removes a class of
false positives; false negatives remain sampling's residue.

## §82 — the confirm tier stops paying for numbers nobody gates, and its arbiter stops lying (two vendor defects found and patched)

The roadmap filing measured `sweptOverlap` as fifteen BVH sweeps in a
trench coat: the confirm tier — sequential uncapped `measureClearance`
calls — was 96% of the check, computing exact distances of 15.69 and
12.88 to answer a question whose thresholds are 0 and `CLEAR_MARGIN`.
Levers 1 and 2 landed as filed; lever 3 (welding) had already shipped
as §81. What the filing could not know: the acceptance diff then moved
two rows in a direction batching cannot produce, and the chase found
the tier's ARBITER lying underneath everything.

**Levers 1+2, as filed.** One batched sweep (the pose walk paid once —
`sweepClearances` exported as the batching entry point beside
`measureClearance`), each pair capped at `refineFloor + band`
(`CLEAR_MARGIN + 0.4`): numbers below the cap stay exact, confirmed and
tight rows untouched by construction; a pair pruned everywhere reports
`gap ≥ cap` (`gapIsAtLeast`) — the filed price, paid only on rows whose
number nobody gates. The batch resets to canonical state first: the
sequential tier's fifteen walks each started from the residue the
previous pair's walk left, so residue-sensitive minima were measured
under an accident of pair order.

**The arbiter, not as filed.** Two defects in the vendored
three-mesh-bvh (0.7.8), both returning NON-MINIMAL distances from
`closestPointToGeometry` — over-estimates, the unsafe direction for a
clearance instrument, sailing over the 0.05 near-zero guard that
catches the library's known boolean lies:

1. **Queries inherited the PREVIOUS query's pruning box.** `shapecast`
   never consults `intersectsBounds` for the ROOT node, and the
   dual-tree path only seeds its inner-scorer OBB inside
   `intersectsBounds(isLeaf)` — so any query whose outer tree is a
   single leaf (the rocker's 12-triangle box) ran its whole inner
   traversal pruning against whatever OBB the previous query left in
   the shared module temp. Measured: the same pair at the same pose
   read 0.1066 cold, 0.1404 after the transposed query, 0.4110 after
   an unrelated one — history-dependent and cumulative. Patched by
   seeding the OBB from the bvh geometry's own bounding box at entry
   (a superset of every leaf: scores stay valid lower bounds).
2. **`OrientedBox.distanceToBox` built its box edge segments with
   `max[f2]` where `max[f3]` belongs**, so its edge-edge pass could
   miss the true minimum — an unsound pruning bound, independently
   measured.

Neither is fixed upstream as of master 2026-08. `vendor/README.md`
documents both diffs (the vendor is no longer verbatim, deliberately),
and `tools/check-bvh-patches.mjs` holds the three properties the
defects violated — history independence, direction symmetry, never
exceeding a vertex-sampled bound — so a future vendor bump re-verifies
them by running a command rather than by re-living this investigation.

**Accepted against the diff, per the filing's own trap.** Verdict
classes preserved exactly — 0 confirmed, 4 tight, 18 refuted — and
every moved number carries one of the named mechanisms: the
feeler ⇄ sleeve tight row reads 0.0381 where the poisoned arbiter said
0.1251 (the truth was TIGHTER — the lie had been under-reporting a
real proximity), chain ⇄ maintaining detent reads 0.222 as the
canonical solo measurement predicted, fourteen far rows wear the
documented `≥ 0.55`. The check's wall fell from ~31 min to ~6 min on
the same machine; `CHECK_TIMEOUT_MS` and the battery job cap are
re-derived from the new measurements at the constant, per the §81-era
comment's own standing caveat.

## §104 — the striking work gets its governor: the anchor is arithmetic, the fly did not survive it, and the cadence stops being a literal (TODO 32 closed)

TODO 32's recorded remainder was one line of `tick()`: the alarm spring's
stiffness was derived and published (k = 1.472e-5 N·m/rad) and READ BY
NOTHING — `spend = rawDt / ALARM_STRIKE_GAP / 16`, real time divided by
an authored 0.42, torque never entering. A real striking train cannot
hold 2.4 strikes/s by wishing: ungoverned, it accelerates until
something velocity-dependent eats the surplus. §104 built that
something, chose it by arithmetic, and closed the item where it lived:
the one line now reads `spend = rawDt / gap(θ) / 16` with gap(θ) a law
the gate measures.

### The survey — three candidates, two eliminated by their own numbers

Part of the deliverable, kept so nobody re-proposes them (the §25 A
pin-wheel rejection's precedent). At the governed arbor the working
torque is order 1e-5 N·m and the cadence implies tens of rad/s; every
candidate meets those two numbers:

- **Fly (air vane) — REFUTED at watch scale, twice over.** Balancing
  ~8e-6 N·m at ~30 rad/s needs a drag coefficient C = Γ/ω² ≈ 9e-9
  N·m·s²; flat-plate vane arithmetic (C = ρ·C_d·w·(r₂⁴−r₁⁴)/4) then
  demands vane radii of 40–50 mm at any watch-plausible width — clock
  metal, an order past the whole movement. And at watch speeds the vane
  Reynolds number is ~10, where the v² plate law itself expires. The
  fan brake TODO 32 named in passing is a CLOCK part; it does not scale
  down.
- **Centrifugal friction (the repeater's governor) — possible, and the
  heaviest build here.** Bob weights pressing a fixed brake ring govern
  hard (cadence nearly flat over the wind — the closest behavioral
  match to the old constant 0.42). But the normal-force budget
  (N = Γ/µR ≈ 5 mN at R 3 mm) against watch-mass bobs forces
  ω² ≈ 6e5 — the governor at ~125 rev/s, an ~800:1 train, TWO new
  wheel/pinion stages. Real (repeaters whir for exactly this reason),
  noted as the flat-cadence alternative, not chosen.
- **Unsprung recoil anchor — CHOSEN.** The alarm-clock strike-side
  answer: a two-pallet anchor fluttering on a saw wheel, no hairspring —
  driven BOTH ways by the tooth faces, a runaway by design, §48's
  two-way class with nothing to declare but the drive. It meets the
  numbers at a modest ×8 stage with a poising ring a balance-wheel
  workshop would recognise.

### The build, and where it reconciles the filing

One new unit ('Alarm governor'), one station off the strike arbor at
module-relative bearing 225°, CD 10.8 (the ×8 mesh dictates): the strike
arbor gained a 64T wheel (module 0.3, the train's own) on a new tier
above the whole §99 stack — the arbor tier's move repeated one level up,
its floor derived from the §99 arbor's shoulder (the tallest metal the
wheel overflies, measured before siting) — and the governor arbor
carries the 8T pinion and a 40-tooth saw wheel (§99's ratchet stock,
0.4). The anchor rides its own stud at D = 7.335 with two GENERATED
pallets and the solved poising ring. Four reconciliations against the
filing, each a re-derivation the entry's own "first-order, re-derive"
note called for:

- **φ = 0.30 rad, not ≈ 0.35.** R_p = toothArc/φ also fixes the
  anchor's centre distance D = r·cosε + √(R_p²−(r·sinε)²), and at 0.35
  the anchor's own arbor stands 0.07 outside the saw's tip circle —
  under the one margin. 0.30 is the swing at which the arbor clears its
  wheel by a full CLEAR_MARGIN with room for its radius (achieved
  0.885, boot-asserted). An internal P2 constraint of the anchor — any
  real anchor's arbor must clear its wheel — so the line spec moved,
  not the fold.
- **The pallet span is 5.5 teeth, stated.** Integer + half, so a tooth
  arrives at pallet B exactly when A releases — held as boot arithmetic
  (the half-integer rule), and the engagement crossings are derived
  onto the tip circle from (φ, span, r) rather than placed. The pallet
  FACES are generated from the swing law exactly as the §25 cam's flank
  was generated from the lift law: over each half period the engaged
  tooth's tip traces a curve in the anchor's frame, that trajectory IS
  the face, and contact is closed at every instant by construction. A
  sampled boot tripwire holds the construction true (no tip buried
  > 0.02 anywhere in the cycle).
- **I_a = 9.07e-11 kg·m², ring section 0.455 mm.** The φ re-derivation
  moved the solve from the filing's 7.7e-11 (I_a ∝ 1/φ at fixed gap);
  the ring stayed r = 2.0 mm brass and the solved square section landed
  at 0.455 mm, inside the 0.2–0.8 mm drawn-ring stock window the gate
  holds. The solve COUNTS the steel the anchor must carry anyway —
  pallets and plate arms by ∫r²dA over their own polygons (Green's
  theorem, the balance's OSC_I discipline at anchor scale), hub as an
  annulus — and bisects the ring to make up the remainder.
- **One band, ring by the plate — §39's depth envelope enforcing
  itself.** The filing imagined a stacked tower (saw, then anchor, then
  ring); built that way the assembly measured 12.71 mm against the
  2.5–12 mm real-movement window. The fold: the anchor is a flat piece
  IN the saw's plane (hub and arms outside the tip circle in plan, only
  the pallets reaching in — how a real anchor sits its wheel), and the
  poising ring dropped to the anchor corner's own column just above the
  plate (measured empty from plate to tier), riding the same arbor.
  Assembly depth as built: 11.95 mm. Position space paid for all of it;
  no mechanism quantity moved.

### The set-up companion — exactly 80 clicks

M(0) = 0 on the bare barrel and the cadence runs ∝ 1/√M, so an anchor
on an un-set-up spring crawls toward stall as it drains. The fix is the
going side's, one barrel over: a set-up of 2.5 turns held by the §99
arbor ratchet — exactly 80 integer clicks on its 32-tooth saw (the
SETUP_CLICKS convention; the equalisation gate holds the quantisation
and that the built ribbon frames carry the same sweep). The ceiling it
sits under is the ribbon's own, and since the §47 roadmap survey that
measured it is private, the measurement is re-recorded here as the
public source: re-running `mainspringFrames` on the shipped alarm
ribbon at rising sweeps, the k-solve reaches the developed length at
4.3 turns (lenErr 5e-13) and fails at 4.4 (4.3e-3 — the family's way of
saying *this spring is too short for this wind*); the annulus never
binds (capacity S = 2.99 at 4.3). Measured at 0.1-turn granularity, so
the usable total is 4.25 — and 2.5 + 1.75 IS 4.25, landing the set-up
on a round 80 clicks with the builder's own asserts standing behind the
ceiling at every boot (capacity 2.996 as built). One tripwire learned
to count: at these winds the inner coils run to bind asymptotically and
the measured minPitch − pBind is one ULP of cancellation noise
(−1.9e-16 against a 0.19 ribbon), so the coil-bind warn now tolerates
float noise (1e-9, the level product's own convention) instead of
firing on an underflow.

### The law, the tick, and what the gate holds

Per tooth the anchor is driven through φ both ways from rest under the
governed torque: t_tooth = 2·√(2φ·I_a/Γ_g), Γ_g = M(θ)·η/32 with
η = 0.9² (two cut wheel-pinion meshes at 0.90 each). Per strike the cam
turns one lobe pitch, the governor wheel RATIO/LOBES = 2 revolutions —
80 teeth — so gap(θ) = 160·t_tooth ∝ 1/√M(θ). I_a is SOLVED so the
designed 0.42 s lands at the design wind point (mid strike travel — the
slowdown spreads symmetrically about the design gap), the oscillator
gate's convention: solve the part, never re-target the beat. As built:
M runs 0.231 → 0.393 N·mm over the strike travel; the cadence runs
0.374 s (full) → 0.488 s (empty) — an audibly slowing ring, the honest
voice of a spring-driven bell — and `ALARM_RING_SECONDS` became the
law's integral over the 28 strikes: 11.86 s against the literal era's
11.76. The hammer's fall (a TIME law — TODO 14's spring, whose
`ALARM_HAMMER_W` still comes from the strike timing, that item's open
note, cross-referenced not absorbed) now exchanges into phase through
the current gap, and the gate holds the fall inside the cam's free
fraction at the FASTEST gap (0.142 s against 0.053).

The `equalisation` gate's alarm half grew from a report to HELD rows:
set-up quantisation (80/32, and the frames carry it), total wind ≤ the
4.25-turn usable ceiling with builder capacity positive, gap(design)
within the oscillator's 0.5% of the designed 0.42, the ring's section
in stock, the hammer window — and the row only a governed cadence can
have: the gate STEPS the shipped tick law at full and near-empty wind
and compares the strike rate it actually produces against the record's
law at the measured window's mid-wind (0.375/0.478 measured on the
posed metal). `cadence:` stopped saying 'authored' and states the law
with its endpoints.

### The instruments, and one stated approximation

MECH_GRAPH support ('Alarm governor' on the three-quarter plate) and
drive rows ('Alarm striking wheel' → 'Alarm governor' — a LEAF: a brake
consumes, it drives nothing downstream, and the graph gate accepts a
driven part with no output edge); EXPECTED pair with its floors row ON
ARRIVAL (no blanket excuse — the one named contact is the ×8 mesh);
seven declared intra-unit joints (sleeves and arbors coincident over
their studs, the strike sleeve's "one shaft, two meshes" idiom); stock
kinds declared for every shaft, stud and the collar, with the ring as
its OWN kind (drawn-brass ring stock, 0.2–0.8 mm — floor in the census,
ceiling in the gate); `declareTravel` ±φ/2 beside the derivation; and
`declareRestoring('Alarm governor', 'two-way')` — the pallet fork's
control-case class, nothing to declare but the drive. The anchor's
reciprocation rides the existing `alarmStrike` axis (80 swings per
strike) and survives §105's 4× confirm tier; the saw's cut outline is
its own schematic glyph (`userData.profile`, the §99 ratchet's rule —
a saw drawn as a pitch circle is a false claim). **[Corrected by §107:
that last sentence was half true when it was written. Setting
`userData.profile` performed the OPT-OUT — the rotor pass asks
`SCHEMATIC.ownGlyph`, which tests the key — but the DRAWING half of §83's
word lived at two hand-written sites, neither of them the saw's. So the
saw opted out of its pitch circle and was drawn by nothing at all; the
`hubR` and `boreR` above were dead data. §107 made the pass generic, and
every carrier now draws — three of them at that landing, four since the
striking cam joined them.]** The fingerprint moved,
deliberately: a new unit, two new strike-rotor meshes and a stud
length. The stated approximation, item 43's class: the saw wheel
advances uniformly with the train — the anchor's recoil is not kicked
back through the wheel, exactly as the escape wheel carries no draw
recoil; if wheel recoil is ever modelled, both parts readmit together.

Scope untouched, per the filing's guard: the going side's cadence
machinery, the alarm reserve indication (§44 owns that story — its
honesty limit lifts with this landing), and a stop-work arrest on the
alarm barrel (§47/TODO 37's scoped pair — note the set-up here changes
what such an arrest would protect). The explainer and primer promised
this debt in three languages; the same landing rewrote the alarm
ledger, both cross-references and the primer's governor prose in
EN/DE/ZH (§95's precedent).

## §106 — the alarm's stop-work: a Maltese cross counts the turns, and the station stops being a literal

Roadmap §106, shipped in part. Winding the alarm past full is prevented by
metal: an 11-tooth pinion on the arbor's own wheel carries a Geneva finger,
its single pin indexes an eight-station cross one station per pinion turn,
and after seven of them the cross presents its un-slotted arm and the pin
banks on it. `setPose`'s `alarmBarrelWind` branch — the one path that could
still pose a wind the metal forbids — is clamped to the same ceiling.

> **Corrected afterwards — read TODO 55 before trusting the paragraph above.**
> That sentence is true of the FIRST wind and of no other. The train is
> geared to the arbor's ABSOLUTE angle, and a stop-work has to count the
> WIND — the angle the ribbon holds between arbor and body. The two agree
> through a wind (the click parks the body) and part company through a ring
> (the click parks the arbor while the body runs), so the cross measures
> stationary across a whole run-down and the spring empties with the
> stop-work still at its full-wind bank. Measured on the second wind, the
> pin does not bank at all: the angle law indexes straight through the blank
> arm, 0.7369 deep — four pin radii. What actually holds the ceiling today is
> the `clamp` in `tick()` and `setPose`, which is the number this entry
> claimed to have replaced with metal. The mechanism, its spec, its bank and
> its solved station are all sound; what it is geared to is not, and TODO 55
> carries the four candidate re-geares with the arithmetic that closes three
> of them.

**The count is an identity, not a choice.** Full wind is
`ALARM_BARREL_TURNS` turns of a 44-tooth arbor wheel, and 1.75 × 44 = 77 =
7 × 11, so an 11-tooth pinion turns exactly seven times. A single-pin Geneva
travels N−1 turns, fixing N at eight. The stop lands on 56 clicks because
the pinion is rigidly geared at 4:1 and adds no quantisation of its own.
All three identities are boot-asserted.

**The Geneva relation was inverted in the plan, and a²+b²=d² cannot see
it.** The filing had `a = d·cos(π/N)` for the pin circle and
`b = d·sin(π/N)` for the cross. Those satisfy the Pythagorean identity —
which is why the pair survived review — but that is only the right-angle
half of the condition. At entry the pin's velocity is perpendicular to the
crank and must lie along the radial slot, so the right angle is AT THE PIN
and the crank radius is the side opposite β = π/N: `a = d·sin β` is the
SMALL radius. Built as filed the index measures 135°, i.e. 2.667 stations —
not an integer, so the 56-click landing could not survive its own geometry.
The build now asserts `2·asin(a/d) = 2π/N` rather than trusting it, and
`tools/probe-106-geneva.mjs` carries the derivation with the textbook 4- and
6-slot pairs as its controls.

**Three floors size the cross and the obvious two do not bind.** The rim
pitch must carry a slot and two walls; the web between hub and slot bottoms
must hold the arms on (0.076 at the pitch floor, against a 0.317 section
floor — arms severed at the root); and mid-engagement the cross's rim runs
past the driver's centre, so what stands there must fit the gap. The
nearest metal there is not the slot's centreline but the HORN beside it,
and what it must clear is the finger's BORE LIP, not the bare arbor —
the finger turns on that arbor and is bored a running fit larger than it.
`genevaSpec` solves that floor by bisection, since the horn's angle depends
on the radius it is setting.

**The bank is registered bank-to-bank, and the blank arm is derived.**
Travel is counted from the angle where the pin would CONTACT an un-slotted
arm, not from mid-slot: registering mid-slot puts the stop 0.1875 of a
pinion turn late, at 54.5 clicks, which no detent holds. And the bank angle
is not the slot-entry angle — the pin enters a slot when its centre reaches
`b`, but banks on its surface, so contact comes earlier. Which arm is blank
is read off the shipped law as the pin's own position in the cross's frame,
because the stations engage in DECREASING order and counting forward lands
two stations off.

**The station is solved, not placed — and that is the durable half.** It
was placed once, from a free-disc map indexed by *(azimuth, centre
distance)* whose headline number is the best over ALL distances; the
azimuth was taken without the radius that gives it meaning, and the pinion
landed 0.055 from the alarm striking wheel's axis. The build now sweeps the
three freedoms P3 grants — station azimuth on the mesh circle, the
finger/cross plane, the cross's azimuth about its arbor — scoring the
assembly as PIECES at their own radii, and asserts the winner. Four
obstacle classes are written into it, three of which the battery found
first:

- a MESH PARTNER is not an obstacle to the wheel that meshes it, and the
  exemption is per piece — scored as one, every station on the mesh circle
  caps at the distance to that wheel and the map reads "nowhere fits";
- the two COLUMNS are pieces, judged over every band they cross, or the
  sweep buys clearance with a 0.14 mm arbor standing 2.3 mm tall;
- `LOW_LINKAGE_OBSTACLES` is the declared SWEPT footprint of the setting
  linkage and cannot be seen by any scan of the built scene (standing rule
  5), which a rest-pose traverse learned by putting the cross in the hack
  rod's lane;
- a ROTOR's footprint is its ANNULUS about its axis, not its resting
  silhouette, and which groups rotate is read from the declared spin groups
  rather than inferred — an earlier geometric guess swept the base plate
  into a disc the size of the movement and reported that the corner has no
  lane at all.

**What is not shipped**, and stays filed: the demonstration half — a script
verb that winds the alarm, and a readout that can say "arrested" rather
than a percentage. And the cross is two-way driven across a wind-and-
run-down cycle by the same finger, but no pose axis reverses the wind, so
§48's audit cannot judge it and no restoring element is declared; the axis
that would exercise it is owed.

Instruments: `tools/probe-106-geneva.mjs` (the line spec),
`probe-106-parts.mjs` (the two bodies and their engagement),
`probe-106-bank.mjs` (the bank, driven past its own ceiling because both
write paths clamp), `probe-106-resite.mjs` (the axis-swept siting sweep).
Battery 21/21 local, fingerprint 2673107592.

## §107 — the anchor becomes one body, the tier learns its words, and the movement gets a check for parts held together by parentage

Filed by the owner as three asks in one sentence — label the alarm
striking wheel and governor parts, draw them in the schematic view, and
"correct the mesh for the governor fork and pallet forks, they seem
fractured". The third one was a real defect, and finding out *why nothing
had caught it* produced most of this section.

### The fracture was a joint that was never made

§104's anchor arms were built with one literal outer end,
`ALARM_GOV_PALLET_R − 0.3` = 2.842, for both arms. But the two blades do
not span the same radii: each face is its own tooth-tip trajectory, so A
runs outward from its crossing and B runs inward. Measured on the cut
polygons, in the anchor's frame:

| blade | radial span | arm end | verdict |
|---|---|---|---|
| pallet A | 3.078 – 3.607 | 2.842 | **0.236 of clear air** |
| pallet B | 2.576 – 3.142 | 2.842 | lands inside — by luck |

So the anchor shipped as three bodies: a hub with two arms, and one blade
floating beside them. On screen that is exactly a snapped-off arm with a
flake of metal near its end, which is what the owner saw.

The end is now **derived from the blade it carries**. The arm's own ray is
crossed against the cut outline and stops at the middle of the first
chord, so it finishes inside the metal and the lap is half that chord. A
radius alone will not do it, and the failed first attempt is worth keeping:
"end at the blade's mid radius" put arm B *beside* its blade, because the
blade is a thin curved ribbon and most of its radial span is the ribbon
travelling, not the ribbon being thick. The ring bisection consumes the
same `_govArmSpec`, so the steel counted is the steel cut — `I_a` is
unchanged, the poising ring re-solves to 0.4549 mm inside its 0.2–0.8 mm
stock, and the design gap still lands on 0.420000 s. The part was
re-solved; the beat was not re-targeted.

### The second defect, filed rather than fixed (TODO 45)

The blades are also **slivers**: 0.45 u of stock offset along the *wheel's*
radial, against a trajectory whose tangent runs only ~26° off that radial,
gives a true section across the face of 0.046–0.099 mm — under the 0.12 mm
floor, pallet B by 2.6×. Two fixes were tried and measured out rather than
argued about:

- **Offset along the face's own normal.** The P2 assert failed on the first
  boot: a saw tip stood **0.1995 inside the blade** against its 0.02
  budget. Every face point sits exactly `ALARM_GOV_SAW_R` from the wheel
  centre, so the radial is the one direction guaranteed to leave the body
  outside the tip circle. The direction is load-bearing.
- **Keep the direction, scale by 1/cos θ.** θ ≈ 73°, so the offset would
  need ≈ 1.58 u — and the face sits ≈ 6.0 from the wheel centre while the
  anchor's own axis is at 7.335, so the blade would swallow its own pivot.

The fix is a shape, not a scalar, so it is filed with that geometry rather
than absorbed here. `stockFloor` cannot see any of it: its thinness is a
mesh's geometry-local AABB minimum, which for an extruded blade reads the
0.40 extrude depth and passes.

### `assembly` — TODO 5's other half

Nothing caught the fracture, and nothing could have. `intraUnit` compares a
unit's MOVERS against that unit's FIXTURES; hub, arms and blades all ride
one pivot group, so no pair any instrument built ever contained two of
them. The new check's predicate is derived, not authored: **meshes whose
world MOTION agrees at every sampled pose ride one frame, so they are one
part, and a part is connected metal.**

Three things about it that were arrived at by being wrong first:

1. **Motion, not pose.** Under one rigid motion every member satisfies
   `M_p = T·M_0`, so the delta `M_p·M_0⁻¹` is the same matrix however far
   apart two members sit. Signing the member's own matrix splits a body
   into as many groups as it has members; signing `geometry.id` splits it
   into one group per mesh — the first cut did that and reported **zero
   rows on a movement it had never measured**, which looks exactly like a
   clean bill.
2. **Cluster by tolerance, not string equality.** The cancellation is
   computed, so a member sitting further out with its own rotation carries
   more float error. Keyed on rounded strings, that dropped both anchor
   arms and the governor-wheel sleeve out of their own groups — a broken
   assembly reading as a smaller one.
3. **Only a MOVING frame is evidence, and the gate is SCOPED.** Every
   fixture in the movement shares the identity frame, so run against it
   the check reports everything and means nothing. And moving frames still
   carry rows this landing has not investigated — the centre wheel reads 3
   bodies at 0.058, the pallet fork 3 at 0.05 — so §48's rule holds: `ok`
   is always true, the rows are the product, and the gate covers the units
   the landing owns. 23 rows: 0 violations in scope, 22 reported, 1 waived
   citing **TODO 44** (the §25 B lock collar, which turns with the strike
   rotor while touching no rotating member — held by parentage, not metal).

Connectivity is triangle-to-triangle rather than `meshClearance`, because
every joint is a near-zero by definition and that is the branch which hands
the pair to `sampledVerdict`'s parity raycast — the expensive path, and the
one that throws on a geometry with no normals. Pairs whose test throws are
reported in `unmeasurable` and assumed JOINED: the gate never invents a
fracture out of a measurement that failed.

### What the tier was allowed to say, and what it was not saying

§83 made `userData.profile` an `OWN_GLYPH` opt-out and drew it at two
hand-written sites. The opt-out half was generic from the start — the rotor
pass asks `SCHEMATIC.ownGlyph`, which tests the KEY — but the drawing half
never was. §104 then set the key on the saw, so **the movement's newest
wheel opted out of its pitch circle and gained nothing**, while §104's own
record said its outline was its glyph. That is §78's SKIP rule arriving
from the other side: not a wrong word drawn over, but a right word never
drawn. One pass now covers every carrier (escape wheel, §99 arbor ratchet,
§104 saw), with the hub and bore rims all three already declared and
§78's floor-warn tripwire. §104's sentence in this file is corrected in
place rather than quietly left standing.

**[A fourth carrier since: §123's striking cam.]** Its entry below records
why the cam was silent and why the lock collar beside it correctly takes
the generic circle this pass exists to override.

The anchor gets **its own word**, because the generic vocabulary would lie
about it: `discOrAxis` says "disc" or "bar" of a generated tooth-tip
trajectory (and at ~1 unit the blades sit under its 2.5 floor anyway), and
the §48 blade pass says "leaf spring" of the one part in the movement
*defined* by having no spring. Its glyph is drawn from `_govPalletPoly` —
the same array `ExtrudeGeometry` is handed — so mesh, law and glyph cannot
drift. The poising ring draws both rims, because its section is the solve's
answer and a single circle would hide it.

### Naming, at two grains

- **The anchor is promoted to its own unit.** It earns it the way every
  other unit does: its own stud on the plate, its own drive edge in from
  the saw, its own frame, its own reciprocation. Registered as a `movement`
  SIBLING, not nested — `collectUnits` does no nested-label exclusion, so a
  nested label puts every mesh in both units and buys an `EXPECTED_PAIRS`
  row for the artifact instead of for a contact (the Dial ⇄ Hour wheel
  precedent). Its stud travels with it, so the new unit is supported by the
  plate directly rather than by the unit it was cut out of.
- **The members are named on the drawing.** A callout tier keyed by mesh
  name, shown only in schematic mode — that is the view whose business is
  saying what a thing IS. Nothing is authored at the display site: names
  come from a declared table and a mesh with no entry draws no callout,
  §59's standard held exactly. Anchored at each mesh's geometry centre, not
  its origin: a pallet blade is an extrude whose origin sits on the pivot,
  so an origin-anchored callout would name the pivot and point at nothing.
- §104 had shipped `'Alarm governor'` **with no German or Chinese entry**
  at all. Both locales now carry it, the anchor, and all eighteen member
  names; and the lazy-label path — which rendered raw English for anything
  registered after UI build — now translates like the path beside it.

## §110 — the chrome gets a spine: one toggle bar, a view panel, a zoom rocker, and a class where an id used to be

Six owner asks against one surface, arriving over a single sitting: an
always-visible show/hide toggle reachable by touch; a zoom slider styled
as a camera rocker in the control HUD; the measure display flowing with
that HUD instead of fighting the panel; View and Performance moved into
their own hideable panel in the top-right, with the rarely-used rows
folded away and Finish renamed Appearance; §21's flat coin diagram
deleted; and a mode toggle switching the control HUD's face between spin
and pan.

They shipped as one entry because scoping them found a shared
prerequisite and a shared hazard. Done separately, each would have paid
the prerequisite again and each would have tripped the hazard alone.

### The prerequisite: three mechanisms were keyed to one id

`#clock-ui` was not just a panel's name. Three chrome-wide mechanisms
named that element directly:

- §72's accessibility layer — the `aria-labelledby` walk over
  `panel.querySelectorAll('.row')`, the `data-state` mutation observer,
  and the loop that seeds `aria-pressed` from it;
- §73's `localizeTree(panel)`, the one call that translates the UI;
- **48 CSS rules**, written `#clock-ui .row`, `#clock-ui button`,
  `#clock-ui select`, §53's `#clock-ui .adv-row`, and so on.

Move a row into a second root and it renders unstyled, unnamed to a
screen reader, and untranslated — **with no throw, no boot warning, and
nothing for the battery to see**. That is the failure class this repo
builds instruments against, arriving in the one layer that has none: a
control with no accessible name still looks right, and an untranslated
row looks like a missing table entry rather than a missing call.

So the shared identity became a CLASS, `.hud-panel`, and the passes now
walk a `HUD_ROOTS` list. The id keeps only what is genuinely singular
about that element — where it sits. Adding a panel is now two steps that
cannot be half-done: give it `.hud-panel`, push it onto `HUD_ROOTS`.

### The hazard: a shortcut table that rebound itself

`KEYMAP` indexed `SHORTCUTS` by POSITION, and the source already carried
the previous author's scar:

```js
['h', SHORTCUTS[15][2]], // 'Hide / show panel' — one row later since the D row above
```

Two new keys would have silently rebound `h` again. The map now looks
each row up **by its own letter**, and a missing handler throws at boot
rather than quietly running the wrong one. Adding a row can no longer
move another row's binding.

### The rocker drives distance, and the mapping is derived

Field of view was the alternative and it was rejected on two grounds: it
forks one zoom into two that can disagree (the wheel and `+`/`−` would
still dolly), and §60's life-size calibration computes its distance FROM
`camera.fov` — a moving fov makes "32 mm renders as 32 mm" false while
the mode still claims it.

So the rocker drives **distance**, and its mapping follows from what the
other inputs already do. The wheel and the keys dolly MULTIPLICATIVELY
(`position.sub(target).multiplyScalar(f)`), so a control that agrees with
them must be **linear in log(distance)**: equal travel, equal ratio. A
linear-in-units slider would crawl near the plate and leap near the far
limit while disagreeing with every other zoom in the app.

Two consequences, both load-bearing rather than decorative:

- **Both limits are read live.** `controls.minDistance` /`maxDistance`
  are derived from `plateR` (0.35 and 12) and §60's life-size mode raises
  the ceiling at runtime, so a cached ceiling would refuse the one pose
  that mode exists to reach.
- **It displays the camera; it does not own it.** Presets, the ~0.9 s
  preset tweens, the wheel, the arcball and §37's Copy view all move the
  distance, so the rocker re-reads it every frame. §57's ring is the
  precedent — a control that moves in the movement moves here too — and a
  rocker holding its own value would have been the same lie one control
  lower.

### Pan, and the decision it did not reopen

The face's second verb translates `camera.position` and `controls.target`
TOGETHER. That keeps it camera-side, which matters: §57 tried rotating
the movement group and reverted it, because §49's ruler stands in world
space and reads the plate's extents off built constants, so a tilted
watch makes the overlay state a measurement that is no longer true.
Moving both endpoints also leaves the distance the rocker reads
untouched, so the two controls in that strip are independent by
construction rather than by care.

It carries `data-mode`, not `data-state`: both values are affirmative and
there is no "off" for a gesture that always does something, so §72's
observer deliberately does not reach it and the button carries its own
`aria-label`.

**On the word — asked and SETTLED, so it is not an open question.**
*Strafing* is the more precise term: a cinematographer's pan is a
rotation about the head, which is the opposite of what this does. The
owner raised exactly that and, told the trade, **kept "Pan"** — because
it is what every 3D viewer's UI calls the operation, it is
OrbitControls' own name for the code path, and §95's audience arrives
with that vocabulary. Recorded here so the imprecision reads as a
decision someone made rather than one nobody noticed; a later reader who
spots it should not re-litigate it.

### §21's coin diagram, deleted — and the citation that went with it

The flat bottom-left panel drawing the movement against a US quarter, a
1 euro and an AA cell is gone. §49 had kept it deliberately when it
retired the 2D corner bar — *"a comparison, not a ruler"* — and that
distinction was right. What changed is the corner, not the argument:
§110 puts a persistent toggle and a second panel into the chrome, and the
diagram's own dodge was already pushing it along the bottom band into
`#ctl-hud`, the one element it never tested against. A comparison that
must be routed around three boxes to stay visible costs more corner than
it returns.

**§21's argument is not refuted and stays open**: 32 mm means nothing
until it is beside something known. If the comparison returns, it returns
IN THE SCENE, the way §49 moved the ruler.

The deletion had one consequence outside the chrome, and it is the kind
no check can see. `src/geometry.js` derived the sub-dial well captions'
TYPEFACE by citing this element:

> Type is the MEASUREMENT overlay's (§49's size-comparison readout,
> `font:11px/1.35 ui-monospace,monospace` on `#scale-ref`)…

Delete the element and the constant's stated reason points at nothing —
correct number, evaporated derivation. The citation is re-anchored to the
chrome's surviving instrument voice (`.readout`, `.hud-ro-val`), which is
what it always was; the coin panel was one place that voice appeared, not
its source.

Also erased rather than fixed, and recorded so a moving count is not read
as a regression: `'US quarter'`, `'1 euro'`, `'AA cell'` and the panel's
caption were never in `src/i18n.js` and rendered English in all three
locales.

### What the layout arithmetic is derived from

Two rules, both computed from measurements rather than typed, because a
typed breakpoint would be right in one language and wrong in another —
the failure §73's German column exists to catch. German's
"Steuerung / Ansicht / Zifferblatt" bar is 211 px against English's 161.

- **The panel drops below the bar** when the bar's measured rect would
  cover its header (its title and Hide button live in that corner).
- **The two panels become mutually exclusive** below
  `2·240 + 3·14 = 522 px` — two 240 px boxes and three 14 px insets. Below
  that they must overlap, and stacking them would bury one with no way to
  tell which was on top. §15 struck the same bargain when it made the
  panel collapsible rather than smaller.

Both are recomputed on resize, because a phone rotating produces both at
once. They are JS, not a media query, deliberately: a query setting
`display` would fight the inline `display` the toggles write, and the
winner would depend on whether the viewer had touched the button yet.

### 44 px, and why the old chip failed it

The retired ☰ chip was 14 px of glyph inside 6/11 px of padding — about
26 × 32, under the touch floor in both axes. Every bar button is `min`
44 × 44, `min-` rather than fixed so a translated face may widen rather
than clip.

### Two defects the verification caught

Neither was visible by reading, and both are the reason the acceptance
was scripted rather than eyeballed:

- **Backticks inside the stylesheet's template literal.** The CSS
  comments quoted identifiers in backticks, which ended the string.
  `node --check` PASSED — exactly as that stylesheet's own §53-era
  comment predicts, because what remains is still valid JS — and the
  browser died with `Unexpected identifier '#clock'`. The comment was
  right and was ignored; it is worth reading before editing that block.
- **The camera strip overflowed the 150 px pad.** A range input's
  intrinsic width is ~129 px, so rocker plus mode button came to 177 px
  and pushed the Spin/Pan button off the right of the screen — present in
  the DOM, reported visible, unclickable in the viewport. `min-width: 0`
  on the flex child; a flex item will not shrink below its content width
  without it.

### The refinements pass, and the two more defects it turned up

Four owner asks against the same surface, immediately after the landing
above. Each is small; each exposed something the first pass had left.

**The bar had the two panels backwards.** It shipped as
`Controls / View / Dial` and is now `Menu / View / Controls`: the left
panel is a MENU of everything the app can do, while §57's pad is the
watch's own CONTROLS — the crowns and pusher a wearer actually touches.

Dropping "Dial" was not only taste. `'Dial'` is already the i18n key for
the CAMERA PRESET of that name, so the shipped label had put two
unrelated meanings on one key in three languages — the kind of collision
that reads fine until one of the two needs a different word. **A JS
object literal overwrites a repeated key in silence**, so nothing
reported it; it was found by scanning both locale tables for duplicates,
which is worth doing after any batch of new strings (170 DE / 184 ZH
keys, no duplicates now).

**The §90 readouts moved above the ring.** A readout is what the corner
is consulted FOR and the ring is what it is used WITH, so the answer
should not sit under the hand reaching for a crown. Reading order runs
answer → instrument → viewpoint, top to bottom.

**The pad went to `rgba(15,17,20,0.46)`, from 0.72** — and it is the one
piece of chrome that should. The panels sit BESIDE the movement; the pad
sits OVER it, in the corner a viewer orbits through, so every percent of
opacity there is watch it hides. **The opacity is paid for with blur**
(6 → 12 px) rather than spent outright, and that pairing is the point:
`#scale-ref` had already learned that the plate is near-white under the
studio environment and light-on-light made its readout unreadable
exactly where it mattered. The figures now sit at the top of that same
pad, so the separation had to come from somewhere that does not cost
legibility of what is behind it.

**The slider had no grabbable thumb.** Styling
`::-webkit-slider-runnable-track` opts the whole input out of the
platform's own layout, so the thumb stopped being centred on the track
and rode low against a 2 px groove. It is now a 14 px bubble inside a
22 px grab band, offset by `(2 − 14) / 2 = −6px` — arithmetic, so change
either height and re-derive it.

The two defects:

- **Every bar title read its shortcut twice** — `"Controls (H) (H)"`.
  §72's hint loop appends the letter to every button it drives, and the
  markup spelled it out as well. The loop is the single source now, and
  it is also the half that stays true when a key is rebound.
- **The view panel covered the pad on a short viewport.** The overlap
  predates the refinements — both live in the right column, the panel
  hangs from the bar and grows down while the pad sits on the bottom
  inset and grows up — but moving the readouts up made it bury the
  TIMES rather than the camera strip. Measured at 760 × 620, "Rings at"
  showed while "Time" sat behind the panel, which is the worst possible
  half to lose. The panel's ceiling is now whatever the pad leaves it,
  read from the pad's own rect because its height is content-driven and
  a literal would go stale the first time §90's or §110's strip changed.
  Verified 0 overlaps and nothing offscreen at 1280 × 900, 760 × 620,
  900 × 560, 600 × 700 and 375 × 667.

**And the backtick trap fired a second time, in the same block, four
hours later.** Same shape exactly: CSS comments quoting identifiers,
`node --check` green, `Unexpected identifier '#clock'` in the browser.
Reading the warning was not enough — the rule that actually holds is
mechanical: **no backtick may appear anywhere inside
`style.textContent`'s template literal**, in a comment or otherwise. If
that block is edited, grep it for one before booting.

### Battery

**20/20 gates pass**, local (headless Chromium, 1246.2 s wall, checks
2171.5 s across 2 shards), boot silent.

The gate column is not the acceptance a chrome-only change owes, because
a report can move while every failure list stays empty. What this change
owed was proof the built scene did not move at all, so the geometry
fingerprint was taken on both trees from virgin boots:

| tree | fingerprint |
|---|---|
| `origin/main` | `2163870811` (52 units, 11 poses) |
| this branch | `2163870811` (52 units, 11 poses) |

Equal, as a change that touches no geometry must be. No waiver count
moved: `stockFloor`'s 48 and `assembly`'s 1 are the pre-existing accepted
debt, unchanged.

Verified by hand beyond the battery: silent boot in all three locales, no
chrome overlap at 1280×900 or 375×667, `aria-pressed` present on every
new toggle, slider and keyboard and wheel agreeing on one distance, pan
preserving distance exactly while moving the target, `H` and `V` toggling
their panels. One clipped label — "Pearl shingle direction" — reproduces
on `origin/main` and is §53's known remainder, not this change's.

## §111 — TODO 45: the governor anchor gets a bearing and a derived section, and the escapement's interference gets an instrument

The owner asked for TODO 45 — the structural review of §104's governor
anchor. The item named three strands: the blades are slivers, the pallet
faces should stay steel, the pivots run bare. Measuring before building
changed two of them, and the measurement is the entry.

### What was found before anything was changed

A standalone model of the shipped geometry, built from the source
constants and validated by reproducing §104's own boot assert (worst
tip-in-blade `0.0001`, consistent with a silent boot), was asked a
question nothing in the battery asks: **how deep does a saw tooth stand
inside a pallet blade?**

**0.245 u — 0.093 mm — throughout the cycle.** Not at handover only:
excluding each pallet's own drive window leaves the number unchanged.
Pallet B's entire face is inside a tooth for most of the period, tapering
from 0.245 at its entry corner to 0 at its exit; pallet A is intruded
0.062. The going escapement's budget for the same class of contact is
`maxDepth: 0.1`.

Four separate covers all missed it, and each hole is a general shape
worth naming:

1. `EXPECTED_PAIRS` grants `Alarm governor ⇄ Alarm governor anchor` a
   blanket excuse to the overlap sweep. The pair is *expected* to touch.
2. `EXPECTED_CONTACT_FLOORS` names `['alarmGovSaw','alarmGovPallet']` as
   the working contact, so TODO 6's `expectedContacts` deliberately
   EXCLUDES exactly the two meshes in question.
3. **There was no `PENETRATION_BUDGETS` row at all.** The going
   escapement has had one since the first of those rows; §104 shipped
   its twin one train over without one, so the depth of the governor's
   only working contact was measured by nothing.
4. §104's boot assert sampled the saw's **tips** — one point per tooth,
   one direction — and read 0.0001. A one-vertex containment test can
   only find a tip poking into a blade, which is the case the generated
   faces make impossible by construction. **It could not have failed.**

### Why it is not a blade-shape problem, measured twice

The obvious repairs were tried in the model and both are ruled out:

- **Relieve the wheel** — cut the tooth back to the pallets' swept
  envelope, the conjugate trick §104 used for the face, applied to the
  wheel instead. The pallets shadow **all 720 of 720** sampled azimuth
  bins of one tooth pitch, reaching down to radius 5.15–5.95 against a
  6.0 tip circle. The only tooth that clears them is a needle ≈0.031 u
  (0.012 mm) wide, under the degenerate floor. There is no tooth to cut.
- **Re-pick the swing** — sweeping φ over 0.08–0.30 against spans of
  4.5, 5.5, 7.5 and 9.5 teeth never gets the intrusion below 0.118 u,
  and the pallet's dip inside the tip circle stays 0.48–0.94 u against a
  0.94 u tooth pitch. A real anchor keeps that dip to a few percent.

The diagnosis points at §104's proudest claim. The pallet face is the
ENTIRE tip trajectory over a half period, generated so that *contact is
closed at every instant* — which is what makes the pallet a long body
reaching half a tooth pitch into a wheel whose teeth are one pitch
apart. A real escapement has **drop**: contact closed during impulse,
open during drop, the pallet short, entering the wheel only by the lock.
Closing it is a re-derivation of the engagement, not a reshaped blade,
and it is filed in TODO 45 with these numbers rather than absorbed here.

### What shipped: two instruments, a solve, and a bearing

**The missing budget row.** `Alarm governor ⇄ Alarm governor anchor`,
axis `alarmStrike`, `maxDepth: 0.1` **inherited** from the going
escapement rather than chosen — a budget envelope is never forkable — and
therefore **WAIVED** at the measured depth citing TODO 45. The waiver is
the finding, visible in the report.

Its `nSamples: 449` is load-bearing, and the trap it avoids is easy to
walk into. One wind is 28 strikes × `ALARM_GOV_TEETH_PER_STRIKE` (80) =
**2240 tooth periods**, and the interference lives *inside* one period. A
sample count sharing a factor with 2240 revisits the same handful of
phases forever — 240, the count the hammer row next door uses, sees 15 of
them. 449 is prime and coprime to 2240, so the samples visit 449 distinct
phases spread across the period.

**The boot assert, widened from tips to bodies.** §104's sweep now runs
the saw's whole cut outline against the whole blade outline, in BOTH
directions, over 240 phases of one tooth period (96 under-read it by
0.008). Its budget `ALARM_GOV_ENGAGE_DEBT = 0.25` is the *measured*
debt, not a design allowance, and the comment says so: tighten it, never
widen it. It exists so the interference cannot deepen unnoticed — which
is what it did between §104 and §111 with nothing to say so.

**The section, derived.** §104 offset the blade's stock along the wheel's
radial by a literal `0.45`. The direction is right and is not a style
choice — every face point sits at exactly `ALARM_GOV_SAW_R` from the
wheel centre, so that radius is the one direction guaranteed to move
metal away from the tip circle, and §107 measured what the face's own
normal costs (a tip 0.1995 inside the blade). But the trajectory's
tangent runs only ~26° off that radial, so 0.45 landed nearly edgewise:
0.046–0.099 mm of real blade, pallet B under the 0.12 mm floor by 2.6×.

The literal is now a solve — bisect the offset until the thinnest
perpendicular crossing of the CUT polygon lands on `STOCK_MIN_U`, the
same 0.12 mm `stockFloor` gates, imported from `layout.js` precisely so
geometry can be built to the number the check enforces. It lands at
**0.776**: pallet A **0.134 mm**, pallet B **0.120 mm**, both asserted at
boot against the polygon actually cut. The §107 arch's attach clearance
on the blade's back rises with it, 0.45 → 0.78 against the 0.40 it needs.

**And TODO 45's reason this was impossible was a geometry error.** The
item said scaling by 1/cos θ needs ≈1.58 u and "swallows the anchor's own
pivot", reasoning from the face at 6.0 from the wheel centre against an
anchor axis at 7.335. It does not: the offset runs nearly TANGENTIAL to
the pallet circle, so the blade's back moves from 3.08 to only 3.12 from
the anchor axis as the offset goes 0.45 → 1.2. It never heads for the
pivot. The claim is corrected in TODO 45 with the numbers that refute it.

Note what the fatter blade did NOT change: the polygon-depth
interference reads **0.2453** at §104's 0.45 and **0.2448** at §111's
0.776. The section and the interference are independent, which is the
evidence for the diagnosis above.

**The bearing.** `ALARM_GOV_ARBOR_R` was a literal 0.45 solid running on
a 0.35 solid stud — the arbor **larger than the post it turned on**, two
coincident bodies held together by an `INTRA_UNIT_CONTACTS` row, on the
fastest arbor in the movement (4.76 rev/s, reversing at 190 Hz). The
going train has answered this since its first upper pivot. So:

```
ALARM_GOV_ARBOR_BORE = ALARM_GOV_STUD_R + PIVOT_BORE_CLEAR = 0.400
ALARM_GOV_ARBOR_R    = ALARM_GOV_ARBOR_BORE + PIVOT_MIN_U  = 0.585
ALARM_GOV_HUB_R      = ALARM_GOV_ARBOR_R + STOCK_MIN_U     = 0.901
ALARM_GOV_COLLAR_R   = ALARM_GOV_ARBOR_R + PIVOT_MIN_U     = 0.769
```

Both arbors are cut with `ringGeo`, the closed lathe tube the plate's own
bearing collars use, so each stud occupies a real hole. The hub and the
ring's collar followed from their own stock floors rather than from
literals that happened to clear the old 0.45 — the hub is wheel stock,
the collar is declared pivot stock in `STOCK_KIND_BY_MESH`. The hub is
the widest thing on that axis inside the saw's band and now stands 0.434
off the tip circle, asserted at boot beside the arbor's own room check,
because both radii are now consequences: a change to `PIVOT_BORE_CLEAR`
or either floor walks them toward the wheel.

The three `INTRA_UNIT_CONTACTS` rows say "a bore cut `PIVOT_BORE_CLEAR`
wider" where they used to say "coincident solids are the bearing".

### One trap this landing walked into

`ringGeo` is a top-level function, and the governor's build block
declares a local `const ringGeo` for the poising ring's extrude. Calling
the module-level helper from inside that block is a **TDZ error, not a
shadowing win**: `Cannot access 'ringGeo' before initialization`, thrown
at module evaluation, and the page never boots. The local is renamed
`poiseRingGeo`. Worth knowing because the failure looks nothing like its
cause — the reference is 90 lines *above* the declaration that breaks it.

### What did not move, and why that was expected

The anchor's whole steel term is **~0.5% of `I_a`** (Σ∫r²dA 6.21 → 7.88
u⁵ against a target of 9.07e-11 kg·m²), so the poising ring carries the
solve and the fatter blades moved its section by about a tenth of a
percent — 0.455 mm, inside the 0.2–0.8 mm drawn-brass window
`equalisation` gates. The cadence is untouched: `gapAtDesign` still lands
on 0.42 s, the measured endpoints still reproduce the law.

### The battery, and what the report diff says

Both runs local (4-vCPU dev container, `--shards 2`), the baseline taken
from a pristine copy of `main` at `39f8a1a` so the chrome landing's own
changes could not be attributed here:

| | gates | wall | checks |
|---|---|---|---|
| base (`main` 39f8a1a) | 20/20 | 1736.1 s | 2969.1 s across 2 shards |
| this branch | 20/20 | 1821.4 s | 3102.5 s across 2 shards |

The PASS column is not the acceptance — a report can move while every
failure list stays empty. Diffed by ROW NAME (never by array index: one
added row shifts every index after it and an index diff then reports the
whole tail as changed), the two `--report` payloads differ in exactly three
places, plus the fingerprint:

- **`penetration`** — 14 → 15 rows. The one addition is this landing's:
  `Alarm governor ⇄ Alarm governor anchor`, **WAIVED**, `worstDepth 0.286`
  against the inherited `maxDepth 0.1`. All fourteen pre-existing rows are
  byte-identical, which is the claim that matters — the new row measures
  something nothing else was measuring, and disturbs nothing.
- **`expectedContacts`** — 13 rows, one changed, and it changed for the
  better: the same pair's floor headroom goes **0.1599 → 0.4269** against
  `CLEAR_MARGIN` 0.15, still on `alarmGovSaw ⇄ alarmGovAnchorArm`. That row
  was the tightest in the check; §107 landed it at 0.0099 of margin and
  §111's solved blade — which moves the arch's attach point outward with it
  — buys 0.28 more.
- **`equalisation`** — the poising ring's solved section moves
  `0.4548849 → 0.4547141` mm, −0.038%. Predicted at ~0.1% from the steel
  term being 0.5% of `I_a`; measured smaller. Still inside the 0.2–0.8 mm
  drawn-brass window, and every cadence figure identical.
- **fingerprint** `2163870811 → 1639816688` — geometry moved, so it must.

Eleven checks are byte-identical: `support`, `graph`, `alarmHandoffs`,
`stockFloor`, `intraUnit`, `assembly`, `oscillator`, `restoring`,
`inspection`, `clearances`, `sweptOverlap`.

**`stockFloor` being identical is this entry's own point, not an oversight.**
The blades got 2.4× thicker in true section and the census did not notice,
because its thinness is a geometry-local AABB minimum and an extruded blade
still reports its 0.40 u depth. That is exactly the blindness TODO 45
records, and it is why the achieved section is asserted at boot against the
cut polygon instead of left to the check.

`penetration`'s measured cost went 16.8 s → 44.5 s, which is what the
column's 17 → 45 was set from. Nothing else in the column was touched:
`expectedContacts` already read 410 against a measured 532 on the base, and
correcting other people's stale costs inside this diff would put machine
variance in the same commit as a mechanism change.

Also verified: boot silent (`bootWarns: []`), `explain-i18n --check` 530/530
in both locales with 0 markup/code/number drift, `explain-quotes` PASS, and
the governor corner shot in both tiers — the blades read as pallets rather
than splinters, and the line tier draws the arbor's two rims.

## §112 — the alarm's power tiers go under the plate: the tier-split, its gates, and the two instruments that earned it

**The ask** was "lower the alarm module under the three-quarter plate."
The answer that shipped is the TIER-SPLIT: the strike group — gong,
hammer, lifting cam, lock, switch, everything within ~2.3 of the top
face — stays on the plate, and the power tiers — barrel (body, arbor,
winding wheel, ratchet), click, governor with its anchor and poising
ring, the 64T wheel and strike pinion — live under it, the strike arbor
passing through a plate bore like every train arbor. The plate top went
from a 6.71 tower to a 2.29 strike work; every drive edge kept its
centre distance; `alarmHandoffs` measured 0 unwaived through the bore
on the first run after the descent.

**Why not the whole module.** Measured first, built second — four
instruments in `tools/` (probe-alarm-under-plate, probe-alarm-relayout,
probe-drum-azimuth, probe-alarm-placement) established that the module
AS BUILT fits nowhere below: the stack was 6.71 solid with zero air
against a 7.71 band (depth was never the refusal), but the gong band
lands in the low-linkage corridor (rod tops 1.87 vs a max-lift gong
floor of 1.44), full-height columns ring the movement at the gong's
radius, and the ceiling slack (0.85) covers neither. Zero placements
over 360 rotations × the full lift range × three drum stations, and a
fold-budget sweep with unbounded lift still found none — the refusal
was in plan, not height.

**The gate that said yes** (`probe-alarm-tier-split.mjs`) solved the
module's §33 rotation and the three §104 fold bearings TOGETHER against
a per-cell z-interval field of the under-plate band: identity 40° with
(θ_b 202°, θ_g 92°, θ_a 148°) carries 0.90 beyond every margin — with
the drum, chain and set-up work exactly where they are (the §75
re-station, first assumed a prerequisite, is not one). The gate's own
recorded wrong answer is part of the record: its first solve missed the
anchor's arbor column crossing the 64T wheel's band and reported 19,088
triples at azimuth 70 — zero survive the fix. Its field carries the
hard-won shapes: rotor meshes as discs about their `userData.r` axis,
tall rotors z-sliced (the fusee cone), long meshes sliced along their
box's longer axis (a diagonal rod's box is not thin).

**The under-plate stack derived twice, and the second order is the one
that shipped.** A rigid drop of the old stack is arithmetically
impossible (5.4 of barrel column + the rods' 2.02 floor + the wheel's
tier > 7.71), so the first order interleaved: winding tier and ratchet
in the floor band "in cells the gate proved rod-free," 64T wheel over
the rods, body high. That was true at the REST pose and false over the
rods' travel — the full battery confirmed the 44T winding wheel 0.33
inside the hack rod's swept lane, the click's spring post standing in
it, and the winding leg (climb arbor south of the sweep's diagonal,
barrel north of it) crossing it with no floor route at any bearing:
three FORBIDDEN/CONFIRMED rows, all one lesson, rule 5's swept
footprint versus a rest-pose field. The order that survives the sweep
inverts the middle of the stack: the 64T governor wheel takes the
floor (fan-clear at its own station by 6.6), ratchet + click above it,
the winding tier ABOVE the corridor's declared ceiling
(`LOW_CORRIDOR_Z_BAND[1]` + margin) — the leg crosses the rods' lane
there, wheels overflying the band, each idler stud standing clear of
the sweep in plan (i1's azimuth about the climb became a scored
variable to get its stud out of the pulled rod's path) — and the
barrel wall + body on top, 0.65 under the ceiling assert. The gate,
re-read against the swapped build (its third form — bands and reaches
now measured from the metal by mesh name, after its plan table went
stale twice), reports rot 0 as built OPEN with 36k feasible bearing
triples; every triple's spare caps at 0.35, which is the fixed
wind-wheel ⇄ strike-arbor-column margin no bearing can move, so the
solved triple (202°, 92°, 148°) stands unchanged through the swap.

**The floor placement exposed a defect the battery could not see.** The
barrel arbor is a full column standing CD_train = 8.25 from the strike
arbor, so every band the 64T wheel could occupy, that column crosses —
and at the train's 0.3 module the wheel's web reaches 9.97. The descent
had run the column straight through the wheel's metal, and no gate said
so because barrel ⇄ striking wheel is an EXPECTED pair with no floors
row (TODO 6's residue, found by measuring the wheel's radial occupancy
against the arbor's edge). The governor mesh now wears its OWN module,
derived: m ≤ (CD − arborR − margin)/(N/2 + 1 + 0.22) = 0.2259, cut
0.22 — tip + bevel 7.31 against the arbor's near edge 7.66, asserted
at the wheel's build. It is also the horological direction: the
fastest mesh of a train wears the finest module. The ratio (64/8) and
§104's cadence law are tooth-count arithmetic and did not move.

**The identity moved in the literals** (160° → 40°, each seed carrying
its −120°), keeping the default build bit-exact instead of churning
floats through a spec rotation; the §68 frozen plate openings re-synced
to their derived sites, and their tripwires fired at both wrong
azimuths this landing tried — exactly the job they were built for. The
climb arbor's jeweled upper pivot retired (the winding tier is under
the plate; the climb tops out ~3 and never reaches it), and the winding idlers took
a third floor: `KW_WIND_IDLER_TEETH`, the movement's proven idler
stock, because TODO 15's phase gauge cannot read the 12-tooth wheel the
collapsed span's reach floor alone would cut (measured: 20 gaps at
confidence 0.63, and re-aligning made it worse). The floor is the
instrument's, not the wheel's, and retires when the gauge learns small
wheels.

**The landing's own findings** are part of the record, because every one is
the same lesson: a FROZEN corridor answer is a measurement of the movement
that existed when it was taken. The first full battery on the descent
confirmed nine overlaps — §68's rod distance 10 landed on the stop lever,
§35's tab azimuth 146° made every parity-legal chord cross the centre
stack, the pillar solve planted two columns through discs whose metal
builds after the plate is cut, the winding dogleg's authored `+y` branch
swung into the hack rod at the floor tier, the barrel boss met the winding
wheel's hub (makeGear's hub is 1.5·t centred — 0.134 below the tier's
claimed lowest metal), and the poising ring's arms met the collar's
nominal circle where its tessellated metal wasn't. The fixes are the
doctrine's kind: the link's rod site AND tab azimuth are now solved
jointly at build (castellation-preserving family × distance × the §34
guard, scored against built metal with the placement gate's shapes —
and, since the band swap, the solve MODELS THE FORK BLOCK IT PLACES:
the block's plan seat collapses to tab + seat·chord − armR·perp because
the pin rests horizontal on §51's groove stratum, verified against both
built cranks to 0.005, so the stage scores the block against the
setting wheel's rim and the setting idler where the crank actually
parks it, with the fork build's corner assert as the gate behind the
model; the chord's member radius went piecewise in the same landing —
the working-end trim leaves only the lay shaft in its bushes, and a
blanket crank-sized radius had priced the honest approach corridor out
of the solve), the
pillar solve consumes a DECLARED under-plate footprint
(`ALARM_UNDER_FOOTPRINT`, one source at the plan hoist), the dogleg's
branch is scored against the low corridor's own list, and the two
structural rows re-derive from the metal's true extents. The §35 pose
sweeps and the battery remain the court over every one of these solves.

## §113 — TODO 45 finding one: the escapement gets drop — a flat-faced recoil anchor, every number a solve

§111 ended with a diagnosis it deliberately did not act on: the governor's
0.245 u interference could not be cut away because it WAS the design —
§104 generated each pallet face as the engaged tip's entire trajectory
("contact is closed at every instant"), which forces the pallet half a
tooth pitch into a wheel whose teeth are one pitch apart. The cure named
there is the real escapement's shape: **drop** — contact closed during
impulse, OPEN while the wheel free-runs to the other pallet. This entry
is that re-derivation. The `penetration` waiver §111 filed is retired;
the row reads OK.

### Phase 1 — three designs refuted by measurement before one was built

A standalone model (validated by reproducing §111's 0.245 figure against
the shipped constants) ran the candidate families:

1. **Conjugate faces, shortened, with a dwell** — keep §104's generated
   face but only a fraction of it, parking the anchor between impulses.
   Refuted: the parked anchor's own WORKING face is swept by the passing
   teeth, 0.05–0.22 u deep across the entire (φ, span, drop-fraction)
   envelope. A trajectory-shaped face is exactly the shape that cannot
   be parked near the wheel.
2. **The ψ 8–14°, dir = −1 family** — the first optimizer "winners", with
   drops of 30–43%. Refuted the moment the contact was made honestly
   unilateral: their drive phase requires the face to PULL the tooth
   (contact-normal force with the wrong sign). A press check at the
   contact point — steel can only push — killed every one.
3. **Landing corners at multiples of pitch/2** — the natural first grid.
   Refuted by phase: 2ε ≡ 0 (mod pitch) parks the two pallets exactly
   ANTI-phase, the second pallet never receives a tooth, and the wheel
   free-runs forever. No cycle exists at any ψ.

What survives is the closure form, and it is forced rather than chosen:
mirror symmetry plus steady alternation require pallet A to land at pose
+h and release at −h with B mirrored, so the swing is **φ = 2h**, each
half cycle is drive + drop = half a pitch, and the landing corners obey
the half-integer rule **2ε ≡ pitch/2 (mod pitch)** — §104's crossing rule,
re-derived for landings from closure alone. ε = pitch/4 is the smallest
azimuth satisfying it.

### The design point — four numbers, zero of them authored

| quantity | value | derivation |
|---|---|---|
| anchor distance `ALARM_GOV_ANCHOR_D` | 7.051 | = `SAW_R + HUB_R + CLEAR_MARGIN`, the §111 bearing stack's room floor. Measured, the cycle interference is monotone WORSE with distance — the floor is also the optimum. |
| landing `ALARM_GOV_LAND_EPS` | pitch/4 | the half-integer landing rule, smallest solution |
| face length `ALARM_GOV_FACE_LEN` | `STOCK_MIN_U` (0.317 u = 0.12 mm) | the §50 wheel floor itself. A rotated rectangle's AABB never reads below its smaller side, so every paddle dimension clears the census floor BY CONSTRUCTION — the inverse of §111's edgewise trap. |
| face incline `ALARM_GOV_FACE_PSI` | ≈ 11.6°, **solved at boot** | bisected until the poising ring's I_a-solved section lands a centi-mm inside the TOP of its 0.2–0.8 mm stock window. Shallower ψ → smaller swing → more inertia → thicker ring, so the ring ceiling binds ψ from below; the interference grows with ψ and wants it small — the optimum is the ceiling itself. |

Downstream of those four, everything is an output of the boot-time
closure solve (`_govClosure`): march the glued contact from the landing
corner with a unilateral press check every step (steel pushes, never
pulls — the check that killed family 2), bisect h until release lands
exactly on −h. Solved: **φ = 0.0806 rad = 4.62°**, drive **42.2%** /
drop **7.8%** of the pitch, residual at float noise, asserted at boot.
§104 authored φ = 0.30 from an alarm-clock spec note; that note described
the conjugate design, whose face had to track a tip for half a period —
a flat-face runaway solves 3.7× smaller and the poising ring absorbs the
difference.

### The tick law gains its lever ratio

§104's inertia solve `I_a = t²·Γ/(2φ)` implicitly applied the wheel's
torque to the anchor unreferred — a ρ = 1 lumping that was harmless while
the face WAS the trajectory. With a short flat face the contact's lever
ratio is real: **ρ = driveArc/φ = 0.822** (`ALARM_GOV_RHO`), and the law
becomes `I_a = (gap/(2·TPS))²·Γ(design)·ρ/(2φ)`. Because gap ∝
√(2φ·I_a/(Γ·ρ)) keeps its 1/√M shape and the solve re-pins it at the
designed 0.42 s, the CADENCE is invariant under the whole re-derivation —
an acceptance criterion checked below, not a hope. What moves is the
part: I_a 9.07e-11 → **2.78e-10 kg·m²** (×3.06), the ring's section
0.455 → **0.790 mm**, still inside — by construction at the top of — its
drawn-brass window. The equalisation record now publishes `rho`,
`driveArcRad` and `dropArcRad`, its law string names ρ, and the gate's
own reconstruction multiplies by `c.rho` with NO `?? 1` default: a
record without ρ IS the regression that line exists to catch.

### What the instruments say

- **`penetration`, the headline**: `Alarm governor ⇄ Alarm governor
  anchor` reads **OK, worst 0.032 against the inherited 0.1 — the §111
  waiver is retired**, on the same coprime 449 samples.
- **The boot cycle sweep**: `ALARM_GOV_ENGAGE_DEBT` tightened **0.25 →
  0.033** (measured 0.0314 at the solved point over 240 phases,
  grid-stable against 960; §111's tighten-never-widen instruction,
  honoured 7.6×). The 0.033 is not zero and the comment says why: the
  passing teeth run 0.031 from the parked paddles at the cycle's closest
  approach — the price of a face long enough for §50 and a swing small
  enough to poise.
- **`equalisation`**: endpoints re-MEASURED by stepping the shipped tick
  law — 0.375/0.478 s, unchanged from §104's record, which is the
  referred-torque claim landing. The ring at 0.790 mm sits a designed
  centi-mm under its ceiling, so anything that raises I_a (lower η,
  softer spring) pushes it out of stock and the gate fires — an
  early-warning, not fragility.
- **`stockFloor`**: clean with no new waivers — and the arm's row is why
  the arm is shaped the way it is (below).

### Two census traps, one walked into, one dodged by construction

The §50 census CLASSIFIES before it measures, and both of this landing's
shapes met its classifier:

- **A swinging radial bar is a revolve to the census**, and a revolve's
  thinness is its radial WALL — which for a bar is its LENGTH. The first
  arm (anchor hub to paddle, 0.223 u of bar) measured 0.0846 mm "wall"
  and failed the floor its every true section clears. The fix is honest
  rather than clever: root the arm at the ARBOR radius so the bar runs
  0.46 u like a spoke, and the number the census reads is a number that
  is true of the metal.
- **The paddles cannot be under-read the same way**: a flat quad's AABB
  minimum is at worst its smaller side, and both sides are at the floor
  exactly. §111's blades needed a boot assert against the cut polygon
  because the census could not see their edgewise section; §113's
  paddles made the census's own reading sufficient — the better fix
  where the shape allows it.

One more trap for the file: `ALARM_GOV_ENGAGE_DEBT` was first declared
beside the sweep that consumes it, 300 lines below the build asserts that
ALSO consume it — a TDZ crash at module evaluation, §111's `ringGeo`
lesson wearing a new name. Constants consumed by asserts live in the
design block, above every consumer.

### The battery caught the arm, and the fix is a shank

The first full acceptance run failed one gate, and the failure is worth
its own record because the landing's own boot asserts had PASSED it.
`expectedContacts` (TODO 6) measured `alarmGovSaw ⇄ alarmGovAnchorArm`
at **0.011** against the pair's 0.15 floor, at strike phase 0.2661. The
first cut of the arm aimed at the pallet strip's mid-point — a point
0.16 behind a face whose corner rides the tip circle, which put the
bar's wheel-side end corner all but ON the passing teeth. The build
assert didn't object because it held the arm to the 0.033
working-contact grade, on the reasoning that the bar's far end "sits at
the pallet, whose face half is legitimately inside the band" — exactly
the blanket excuse TODO 6 exists to refuse: **the pallet is the pair's
declared contact mesh; the arm is not, and a non-contact mesh owes
`CLEAR_MARGIN` everywhere.**

The fix is the bench's, not a tolerance's: the pallet strip is cut one
arm-lap DEEPER than its working section (`ALARM_GOV_PALLET_BACK =
STOCK_MIN_U + ALARM_GOV_ARM_LAP`) — a SHANK, the way a real pallet's
stone is carried by a setting the arm grips — and the arm's far corners
are now the strip's back corners pulled one lap into that shank. Both
joint corners sit a full lap inside the pallet's cut (shared metal by
construction, the §107 tripwire still asserts it) and the whole bar
stays ~0.24 clear of the tip circle over the swing. The build assert
flipped with it: the arm is held to `CLEAR_MARGIN` at boot, so the gate
never has to find this again.

### The battery, and what the report diff says

Both runs local (4-vCPU dev container, `--shards 2`, run concurrently so
the walls are contention-inflated; the verdicts and payloads are what the
diff reads). The baseline is a pristine worktree of `main` at `90439cd` —
re-taken after the §112 tier-split merged, because the first acceptance
pair (vs `04eb435`) predated it:

| | gates | wall | checks |
|---|---|---|---|
| base (`main` 90439cd) | 20/20 | 3583.1 s | 5489.3 s across 2 shards |
| this branch | 20/20 | 3722.5 s | 5658.1 s across 2 shards |

(The first acceptance run went 19/20 — the arm catch above — and its
report is what pointed at the fix; the numbers below are the re-run on
the shank geometry.) Diffed by ROW NAME, the two `--report` payloads
differ in exactly five checks, plus the fingerprint:

- **`penetration`** — the headline. The governor row goes
  `WAIVED, worstDepth 0.298` → **`OK, worstDepth 0.031`** against the
  same inherited 0.1, and the waiver text citing TODO 45 is GONE from
  the report. (The baseline's depth reads 0.298 on the tier-split's
  siting where §111 measured 0.286 — the interference IS the §104
  design, so it travels with the module.) All fourteen other rows
  byte-identical.
- **`expectedContacts`** — the governor pair's row is almost a fixed
  point: min `0.16` against the 0.15 floor on BOTH sides, nearest
  non-contact mesh the RING on both sides (the tier-split's band swap put
  it just over the saw), with only the worst-pose label moving. The
  hub-margin identity — `D = SAW_R + HUB_R + CLEAR_MARGIN`, the hub one
  margin off the tip circle by construction — is held by the boot room
  assert rather than surfacing as this row's minimum here.
- **`equalisation`** — the law string gains `·ALARM_GOV_RHO`, `I_kgm2`
  goes 9.073e-11 → 2.776e-10 (×3.06), the ring's solved section
  0.455 → 0.790 mm, and the summary line follows. The cadence figures —
  design 0.42 s held, measured endpoints 0.37536/0.478 — are
  **byte-identical**, which is the referred-torque claim landing as
  measurement.
- **`restoring`** — the anchor's two-way row changes only its `why`
  prose: the §113 text names the dwell through each drop arc.
- **`inspection`** — the governor pair's EXPECTED row updates its pose
  detail; the class and the verdict do not move.
- **fingerprint** `1166767543 → 3519083211` — geometry moved, so it
  must. (The shank fix alone did NOT move it — the fingerprint samples
  unit matrices, not mesh vertices, and the shank is a vertex-only
  change. The §113 landing moved it through the anchor's new station.)

Nine checks are byte-identical: `support`, `graph`, `alarmHandoffs`,
`stockFloor`, `intraUnit`, `assembly`, `oscillator`, `clearances`,
`sweptOverlap`. **`stockFloor` identical is §111's lesson repeating on
purpose**: the pallets got 31% deeper and the census read the same
numbers, because its minimum lives on an axis the change didn't touch.
The section that matters is asserted at boot against the cut polygon —
and for the paddles it is the AABB's own smaller side by construction.

`penetration`'s measured cost went 44.5 s → 21.3 s (§113's stubby
pallets halve the row's mesh work); the cost column follows, 45 → 21.

Also verified: boot silent, both tiers shot at the governor corner — the
realistic tier shows short flat paddles clear of the tooth band, the line
tier draws the same quads — and the pages checkers green after the
explainer rewrite (`explain-i18n --check`, `explain-quotes`).

## §115 — a window onto the alarm governor: one frame, two axes, and two declarations that were not true of the metal

**§112 hid the thing it made honest.** The tier-split put the alarm's power
tiers under the three-quarter plate, and the governor went with them — the
movement's fastest-turning part and the only thing setting the strike's
cadence, sitting at z 0.35 … 4.05 in the 0 … 7.71 band with the plate closed
over it. Measured before anything was cut, by raycasting every vertex of both
governor units straight out through +z against the finished plate:

| unit | vertices with a clear path out, before |
|---|---|
| Alarm governor | **0 of 2007 (0.0%)** |
| Alarm governor anchor | **0 of 989 (0.0%)** |

Not "mostly covered" — covered. `tools/probe-107-shot.mjs` had already
recorded the consequence in its own way: since the tier-split both of its
vertical shots stare at plate metal, and they were re-aimed to near-horizontal
rakes through the tier gap. The only escape was the x-ray toggle, which
glasses the whole plate at 0.28 rather than framing anything.

§62 built the machinery for exactly this, so this entry is mostly about what
the governor is that the two shipped windows were not.

### An action is not always one axis

§62's doctrine — a window onto a coaxial stack is sized to the circle its
widest turning member sweeps, exactly a circle, no sample net — assumes one
centre. A governor escapement is **two**: the 40T saw wheel on `alarmGovPos`
and the anchor carrying its poising ring on `alarmGovAnchorPos`,
`ALARM_GOV_ANCHOR_D` = 7.051 apart, with discs of 6.216 and 6.483 after their
margin of reveal. The thing worth seeing is what happens BETWEEN them, and
framing either alone frames half a mechanism.

Two windows is not the answer. The discs overlap deeply (6.2 + 6.5 against
7.05 between the centres), so two sector polygons would overlap — §62's defect
4, where `ExtrudeGeometry` triangulates overlapping holes into PHANTOM PLATE
rather than failing — and the land between them would be negative against
`TQ_LAND_MIN`. **One window is forced, not chosen.**

So an intent may now declare several discs (`discs()`) instead of one radius
(`reveal()`), and the reveal at a bearing is the ray's exit from their UNION.
Each member's silhouette about its own axis is still exactly a circle, so
nothing is sampled and TODO 7's first blindness class stays answered by
construction at two axes as it was at one.

What the union costs is that the solve's polar centre is no longer any
member's axis, and the polar bisection only describes the union if every ray
from that centre leaves it exactly ONCE. That holds when the centre is
interior to every disc — a union of convex sets sharing an interior point is
star-shaped about it. The centre is the **midpoint of `ALARM_GOV_ANCHOR_D`**,
the escapement's own centre distance halved rather than a drawn point; it
stands 3.526 from each axis and so 2.69 and 2.96 inside the two discs. That is
a premise, so it is a gate: the solve warns if the centre comes within
`CLEAR_MARGIN` of leaving any disc.

**The two shipped windows are bit-identical after the change**, and by
construction rather than by luck — a single disc concentric with its centre
short-circuits to `d.r` by name before any float arithmetic, instead of being
routed through `Math.sqrt(d.r * d.r)`. Verified at full precision anyway, both
`rOut` tables and both `r0`: 0 of 360 bearings differ on either.

### The first bossless window, and the rule it needed

Both shipped windows island a pivot boss and hang off three webs. Neither
governor unit pivots in this plate — both stand on studs planted in the BASE
plate — so this window islands nothing, `r0` is 0, and there are no webs.
Nothing had ever exercised that path, and it had a hole in it: with no boss,
step 4 pushes no inner return, so a PARTIAL run emits its outer arc closed by
its own chord. Not a crash — a silent mis-cut, and two such runs can overlap
into phantom plate with §62 defect 4's only detector switched off beside them
(see below).

The rule is that **a bossless window is all or nothing**. What stands between
two runs of one is not an arm — there is no boss for it to be an arm OF — it
is a knife-edged spur of plate tapering to zero width at the apex where the
runs meet: under `TQ_LAND_MIN` along its length and under `STOCK_MIN_U` at its
tip, refused by §50 and §54 both, and left by no cutter. So it is cut only if
it solves open at every bearing; otherwise the row is REPORTED with its `rOut`
and not cut, and the boot says which bearing closed and whether a keep or
another opening did it. That is this entry's own priority — the plate is a
bearing first and the WINDOW is what gives — and §62's own precedent, which
measured the centre and third wheels and declined to cut them.

`checkPlateWindows` re-asserts the same rule against the sectors that were
BUILT, at every stage, because the re-solve sees keeps the first solve could
not and may pinch a window that was open when it was cut.

### Two defects in §62's own machinery, found by generalising it

Both were invisible to every instrument, and both are in shipped code rather
than in the new path.

1. **The `boss` test did not say what its comment said.** The comment claims
   "an upper pivot standing at the window's own axis"; the test was "any pivot
   inside the reveal." Those are the same thing only while every reveal is one
   circle about its own axis and the only pivot inside is that axis's own.
   This window's reveal reaches 10.009 about its centre and the strike arbor's
   bore stands **10.30** away — 0.29 from being islanded as a boss the window
   is not at, which would have drawn three webs about the wrong centre and
   emitted a polygon that means nothing. The test is now `< pivotBossR(p)`,
   which is the sentence. A pivot merely inside the reveal is a KEEP, and
   `tqKeepClearance` already subtracts its `pivotBossR` at every bearing, so
   the window shrinks around it correctly without pretending to hang off it.
   `fusee` and `escapement` sit at distance 0 from their own pivots against
   boss radii of 0.66 and 2.21, so neither moves.
2. **The overlap guard was off for exactly the new window class.** Check 3
   read `row?.webW ?? TQ_LAND_MIN`, and `webW` is `0` — not `undefined` — for a
   bossless row, so `??` never fired and a same-name pair was compared against
   zero. §62 defect 4's only detector was disabled precisely where step 4 is
   least able to emit a sane polygon. It is `row?.boss ? row.webW : TQ_LAND_MIN`
   now: an arm width where there is an arm, a land where there is not.

### The reveal is DECLARED, and the declarations were not true

This solver first runs five thousand lines before the alarm block, so the
governor's metal does not exist when its window is sized. Sizing it on the
re-cut pass instead is barred outright: that pass may only ever SHRINK,
because the pillar seats and their plate screws were solved against the first
outline. So the intent reads `ALARM_UNDER_FOOTPRINT`'s two governor rows BY
NAME — the very discs §112's pillar solve was already told to keep its columns
out of — and the window frames exactly the land the frame has been cleared of.
Two solves, one description.

That put weight on a list nothing had ever checked, so a **declared-versus-cut
assert** now measures each row against the metal that ended up inside it: the
greatest distance from the declared axis to any vertex of the meshes standing
on it. Both units are revolvers about those axes, so the reach is
pose-independent by construction — the same argument §62's escapement intent
uses, no pose net. It found two rows wrong on its first boot.

**The poising ring's disc, by 0.642.** The row read `ALARM_GOV_RING_R + 0.4`,
from "ring stock tops at 0.8, so outer ≤ R + half of that." But
`ALARM_GOV_RING_STOCK_MM` is in MILLIMETRES and the disc is in model units,
and `UNIT_MM` is 0.379. In units the ceiling is 2.111 and its half is
**1.055**, not 0.4. §113's re-solve had since taken the section to 0.790 mm =
2.085 u, so the built ring's outer edge stands at **6.320** against a declared
**5.678** — the pillar solve and now the window reveal were both told to
respect a circle **0.642 (4.3 clearance margins) smaller than the metal**. The
reasoning in that comment was always right; only its arithmetic was done in
the wrong units, which is exactly why nothing downstream ever looked wrong.
The conversion is in the expression now, `ALARM_GOV_RING_STOCK_MM` is hoisted
to the plan block so the bound and the solve it gates read one constant, and
the corrected 6.333 contains the built 6.320 with 0.013 to spare — which is
not luck either, since the section is solved to land a designed centi-mm under
its ceiling.

**The 64T wheel's disc, by 0.053** — a smaller number and a more general
finding. The row read `module·(N/2 + 1) + bevel` = 7.308 and the wheel reaches
**7.361**. Two errors in that expression pull opposite ways, so the sum looked
plausible: `makeGear`'s addendum is 0.95·module, not one module, which makes
the true tip circle smaller; but `gearOutlineShape` RELIEVES the tooth tip,
drawing it as a quadratic through a control point at `tipR × 1.02`, and that
curve stands proud of the tip circle by more than the addendum gives back.
`geometry.js` exports `gearOuterR` now, bounded by the Bézier's own control
hull — a quadratic lies inside the hull of its three control points, so no
part of the tip can pass `tipR × 1.02` whatever `curveSegments` samples — and
both the footprint row and §112's own barrel-arbor assert read it. That assert
had been guarding this wheel with a radius 0.053 smaller than the wheel that
ships; it still passes, at 7.442 against the arbor's near edge less a margin.

**Residue, stated because the check is only as wide as its list.** Three of
`ALARM_UNDER_FOOTPRINT`'s five rows are held — the striking wheel, the
governor saw and the governor ring. The barrel and click rows are not: their
members build in the barrel block and belong to it, and enumerating them here
would put a second list of mesh names somewhere they are not made. The rows
are named, so extending the check is a line each. The one failure mode that
would have made this worse is closed: a row whose declared meshes all vanish
under a rename measures nothing and would report clean forever, so an empty
match is itself a warning.

### What the plate actually left

| | value |
|---|---|
| bearings open | **360 of 360** |
| bearings at the union's full reach | **339 of 360** |
| bearings the keep field bit | **21**, worst **0.900** at 293° |
| sectors cut | **1** (bossless, as the rule requires) |
| radius from the centre | 5.307 … 10.009 |

The bite is one obstacle and it is the right one: 285–297° off the window's
centre is the bearing of the strike arbor's bore, whose boss is plate this
window may not take. Nothing else in the §112 strike work reaches it — the
gong, hammer, lifting cam, lock and switch are stationed at other azimuths —
and the rim stands 2.36 clear of the union's far edge.

The acceptance, in §62's currency, re-taken on the finished plate:

| unit | before | after |
|---|---|---|
| Alarm governor | 0 of 2007 (0.0%) | **1989 of 2007 (99.1%)** |
| Alarm governor anchor | 0 of 989 (0.0%) | **989 of 989 (100%)** |

**And the 18 vertices still covered are the strike arbor's bearing and nothing
else** — every one of them is `alarmGovSaw`, at bearings 285–297°, which is
the bite above. The window shows the saw, the pallets, the anchor and the
poising ring at every pose, and what it does not show is the corner of the saw
that runs under the plate's own bearing for the arbor driving it. That is the
frame doing its job rather than becoming a hole.

**One pillar moved**, and it was the window that moved it, not the footprint
fix: measured separately, the corrected ring disc alone leaves all four seats
where they were, because the seat scan's optimum was already outside it. The
45° seat travels 2° round its own radius, 29.376, 25.536 → 30.249, 24.495, as
`seatClearance` re-optimises against a new opening it must keep a land from.
The other three do not move.

### What the record does not owe

`explain.html` gains nothing, and §62's argument holds verbatim: its entries
are MECHANISMS, and a window in a plate is structure and finish. This one
frames a mechanism the page already explains — §113's flat-faced anchor — and
moves not one of its quoted numbers, so `explain-quotes` is untouched and the
German and Chinese stay valid rather than being invalidated by design (§73)
for a subject the page does not have. `MECH_GRAPH` gains nothing either: a
window is an absence, not a part. §71's occluder re-uses the plate's own
geometry, so the schematic tier follows the new opening for free, and
`TODO.md` gains nothing because nothing here is waived.

`TODO.md` LOSES two sentences, though. Item 45's open stone question was
written against "§107 sited it ABOVE that plate, on studs planted in the plate
top" and "the governor sits above that plate" — both true before §112 and
false since, and both now corrected, because a cock over the governor is
argued from where the governor is.

### The battery, and the three things that moved

**20/20 gates pass**, boot silent, run locally against `origin/main` and this
tree in turn on an idle machine so the cost timings mean something:

```
support 0 failures · graph clean · penetration every row OK or waived
alarmHandoffs 13 hand-offs, 0 waived · stockFloor 537 rows, 0 degenerate, 0 unwaived
intraUnit 264 movers over 55 poses, 0 unwaived · assembly 0 undeclared unwaived splits
expectedContacts 13 pairs, 0 unwaived, 0 unmatched selectors
oscillator 2.5 Hz on a 0.0244 mm ribbon · equalisation TODO 32 held, ring 0.790 mm in stock
restoring 20 reversing units, 0 unwaived, control PASS
inspection 0 FORBIDDEN over 53 units and 74 contacting pairs · clearances 0 violations over 30 budgets
sweptOverlap 0 CONFIRMED over 67943 pairs (tight 4, refuted 20)
spec boots 26/26 build, identity control silent
```

Every gate's summary line is byte-identical to base except the fingerprint.
`--report` diffed check by check: **twelve of fourteen payloads are
byte-identical** — `alarmHandoffs`, `assembly`, `clearances`, `equalisation`,
`expectedContacts`, `graph`, `inspection`, `intraUnit`, `oscillator`,
`penetration`, `restoring`, `stockFloor`. Three things moved, and all three
are the plate's new geometry showing up where it should:

1. **fingerprint `3519083211 → 761710512`.** Not the window — a window is
   strictly interior and the plate's AABB is set by its rim, so §62's
   postscript reasoning holds and the plate's own box does not shift. It is
   the PILLAR. `seatClearance` re-optimises against a new opening it must keep
   a land from, and the 45° seat travels 2° round its own radius; `pillars` is
   a labelled unit, so its box moves and the hash with it. Measured
   separately, the footprint fix alone leaves all four seats exactly where
   they were — the corrected ring disc changes no seat because the scan's
   optimum was already outside it.
2. **`support`, two gaps of 67, both against this plate, both far inside
   `SUPPORT_TOL` 0.5.** The row order moves with them because the check sorts
   by gap; no row is added, removed, or newly failing.
   - `Center wheel → Three-quarter plate` **0 → 0.048**, and the new number is
     the better one. The nearest mesh pair changed: base measured the wheel's
     body against the plate body and read 0 (contact, which for a bearing is
     what it is), head measures the upper-pivot staff against its bearing
     collar — and 0.048 is `PIVOT_BORE_CLEAR` (0.05) less the collar's
     tessellation chord. The row now reports the running fit the bore is
     actually cut to.
   - `Alarm link → Three-quarter plate` **0.147 → 0.139**, same mesh pair
     (`alarmLinkRod` ⇄ `threeQuarterPlate`) at both ends.
3. **`sweptOverlap`, one number in one `tight` row**: `refinedMinGap`
   0.1472 → 0.139 — the same alarm-link pair as above, reported twice by two
   instruments. Counts do not move (0 CONFIRMED, tight 4, refuted 20), and
   `tight` rows are reports.

The common cause of 2 and 3 is worth stating because it will happen to the
next window too: **cutting a hole in a `THREE.Shape` re-triangulates the whole
face, not just the hole.** The plate goes from 50,170 to 58,978 triangles and
126,900 to 149,144 vertices, so any measurement whose answer lands on a face
triangle can move by a triangle's worth anywhere on the plate — including
across the movement from the window. Neither number crosses anything.

Cost: `sweptOverlap` 1877 → 1913 s (+1.9%, the larger plate mesh) and the rest
inside run-to-run noise; total check time 4888 → 4823 s. The shard partition
is unchanged in shape and the cost column is left alone.

## §116 — Three more locales, and the locale list becomes a declaration

**Shipped in part, and the part is named.** Tier one (the chrome,
`src/i18n.js`) and `primer.html` now speak **French, Japanese and
Traditional Chinese** alongside English, German and Simplified Chinese —
366/366 and 91/91 in each, six locales at full parity on both. `explain.html`
is NOT translated in the three new locales: it is 530 keys of the densest
prose in the project, it is filed as its own tier (§117 in the roadmap), and
in the meantime it renders English and `--check` reports 0.0% for those
locales out loud on every run. That is the §73 shape exactly — that entry
shipped the chrome first and the explainer as a later tier — and it is
written down here rather than left to be discovered from a coverage column.

**Why these three.** Each was chosen for what it would break, in the §73
idiom where German is the layout stress test and Chinese the typography one.
**French** is the first locale whose NUMBERS are not ASCII-punctuated: fr-FR
points with `,` and groups with U+202F NARROW NO-BREAK SPACE, which no
instrument here had ever had to parse. **Japanese** is the first locale
sharing no script with English at all, so anything still leaking an
untranslated word into the panel has nowhere to hide. **Traditional Chinese**
is the one that was already wrong: `zh` was never Traditional, every Taiwanese
and Hong Kong browser resolved to Simplified, and nothing anywhere reported
it.

**The roster becomes one declaration.** It had lived in four places that
agreed by hand — the `_norm` prefix ladder and `LANG_TAG` map in
`src/i18n.js`, the `<option>` markup in the panel, and the same array typed
again into `explain.html` and `primer.html`. `LOCALES` replaces all four:
the three pickers render its faces, `_norm` resolves through its matchers,
`LANG_TAG` reads its tag, `TABLES` is keyed by its codes. The two page
modules got the same treatment one level down, where a `LOADERS` map replaced
both a ternary chain and a separately hand-kept `allTables()` list.

**Its array ORDER is the resolution ladder, and that is boot-asserted.**
Every Traditional tag begins `zh`, so the bare-language row swallows all of
them unless the script subtag is tested first — and the failure has no other
symptom. Nothing throws, nothing renders blank; a Taiwanese reader simply
gets Simplified. So nine input→output pairs are checked at boot with the
achieved and required values in the warning (standing rule 6), and the
negative was produced on purpose: swapping the two rows prints
`_norm('zh-TW') = zh, expected zh-Hant` four times over, and restoring them
returns boot to silence. Measured after the fix: `zh-Hant`, `zh-TW`, `zh-HK`,
`zh-MO`, `zh-Hant-TW` and `zh_TW` all resolve Traditional; `zh`, `zh-CN`,
`zh-Hans` and `zh-SG` still resolve Simplified.

**The Simplified entry kept its value and lost its name.** Its face is now
`简体中文`, because `中文` stopped being a distinguishing name the moment a
second Chinese existed. The VALUE stayed `zh` — tier one's display-translates,
values-do-not rule — so every `?lang=zh` link ever shared still resolves, and
no stored `uiLang` had to be migrated.

**The dynamic-import specifiers stay literal, and a comment proved why.**
`tools/stamp-release.mjs` finds dynamic imports by regex over a quoted
relative specifier, and its leftover scan uses the same pattern, so a
specifier interpolated from `UI_LANG` would be neither stamped nor precached
*and would not be reported as missed* — a 404 for an offline reader with
every gate green. That much was designed for. What was not: **that regex
reads the source file's comments too.** The comment in `src/explain-i18n.js`
explaining the hazard spelled out the call form it matches, the stamper
matched it, and `src/…` — an ellipsis — went into `PRECACHE`. `addAll` is
all-or-nothing, so the worker never activated, and `offline-check` did not
report a bad URL: it hung in `release: first load, worker install` and timed
out. The comment now describes the pattern instead of exhibiting one, and
says so. Precache went 27 → **33** (three locales × two pages), asserted.

**French made the number gate learn a character.** `primer.html` declares
`NUMBERS: 'quantity'`, so its numbers are compared by parsed VALUE — and the
tokenizer was `/\d+(?:[.,]\d+)*/`, which splits `18 000` into `18` and `000`.
Every grouped French number on that page would have reported drift while the
translation was correct. `MARKS.group` became a list and the token class is
now built from each locale's own marks, so widening French cannot widen
anybody else — and that is not asserted, it is shown: `--check` output is
**byte-identical** across the change for `de` and `zh`. U+00A0 and U+2009 are
accepted alongside U+202F because they render identically and a translator's
keyboard produces them; a plain ASCII space is deliberately REJECTED, because
`5 100` in prose is two quantities more often than one and merging them would
be the checker inventing a number rather than reading one.

**That diagnostic was in the wrong branch, and the French table found it.**
It had been written as the `else` of the value comparison, so it could only
fire when the values already matched — which, with an ASCII space, they never
can. Tested FIRST, an injected ASCII space now reports `ASCII space used as a
group separator (this locale wants U+202F)` and names the key, instead of the
arithmetic nonsense `[18000] vs [0,18]`.

**`MARKS` is a per-locale fact, not a roster, and the difference is now
enforced.** The roster comes from the page module's own `allTables()` keys —
the tool has no second list to fall behind. `MARKS` carries something the
roster cannot: which characters that locale groups and points with. A missing
row is therefore a hard failure, not a skipped check, because a locale whose
numbers cannot be parsed is a locale whose numbers are UNGATED. It fired the
first time it ran, on `ja` and `zh-Hant` — both number-transparent, both now
declared as such.

**The value check caught a claim, not a typo.** The Japanese primer rendered
English's "a millimetre" as `1 ミリメートル`, introducing a quantity the source
does not state. A word where English used a word (`一`) restores it. No reader
would have noticed; the gate is the only thing that could.

**Two French plate labels overran, and the labels moved.** Measured: 164.4 px
and 202.3 px against the plate's ~161.5. Fixed in the LABELS — terse by
nature, and French had been the wordiest of the three lines — not by widening
a tolerance and not by moving a drawing that is correct. Both now sit 4 px
inside, and the fit gate reads 0 new overflow in every locale.

### Measured

`tools/probe-116-locale-fit.mjs` is new, and exists because four fits are
load-bearing and none of them is gated — each depends on rendered text width
in a real browser at a real width. English is the baseline, the Explainer
gate's convention: only what a translation makes worse is interesting.

| | measured |
|---|---|
| page headers | **56 px in all six locales**, both pages, at 1440/1100/900/830/821/820/700/480 — one line everywhere, nothing covering the intro, no sideways scroll. 821/820 straddle the rule that hides the stamp; both sides checked. |
| `#chrome-bar` | en 170.2 · de 192.4 · fr 189.9 · ja 166.0 · zh 144.0 · zh-Hant 144.0. **German is still the widest**, so the measured-not-assumed rules at that site needed no re-derivation. |
| `.hud-ro-label` | widest 49.5 (German) against a 150 px box; all six on one line, so the "a locale that does not fit gets two lines" allowance is still unspent. |
| §53's 240 px column | no content wider than its box, in any locale. French — the German-shaped risk — took it without a layout change. |

**No geometry moved, and that is measured.** Virgin boots of `origin/main`
(781838c) and this branch fingerprint identically —
`{"hash":3519083211,"poseCount":11,"units":52}` — which is §73's own form of
evidence for a translation landing, and the whole battery reads **20/20**.

Getting that number honestly cost an hour and is worth recording, because the
failure mode impersonates the exact thing this evidence exists to rule out. An
earlier run reported `fingerprint deterministic across virgin boots` FAILED,
hashes 3519083211 and 1166767543 — which reads precisely like geometry moving
under a determinism check. It was not. `dev_server.py` keeps ONE `/__state`
file per temp dir, and `ci-battery.mjs` serialises its virgin boots for that
reason; this section's own new probe stood its server up on the DEFAULT temp
dir, so running it beside a battery made two "virgin" boots share state. The
probe now isolates `TMPDIR` as `explain-i18n.mjs` already did. **An instrument
that can break the gate it is run beside is a defect in the instrument**, and
the comment now carries the measurement so the next tool that stands up a
server inherits the reason rather than the omission.

Gates, at the landing: `explain-quotes` PASS (0 disagreements, primer still
quotes 0 identifiers); `explain-i18n --check` PASS across both pages × five
tables — 0 unmatched, 0 markup drift, 0 `<code>` drift, 0 number drift, 0 new
plate overflow; `offline-check` **27/27**, up from 22, the five new rows being
the per-locale offline primer boots and the `?lang=zh-Hant` deep link.

**Every gate was also made to fail on purpose**, since a gate only observed
passing has not been observed: mis-order the ladder → boot warns four times;
ASCII-space a grouped French number → `--check` names U+202F and the key;
introduce a quantity English does not state → the value check reports it.

### Residue, recorded

- **`explain.html` in fr/ja/zh-Hant is not translated** — 0/530 each, filed as
  §117. Named here because a coverage column read in isolation looks like
  neglect, and this is a scope decision.
- **No native review pass** happened for any of the three new locales. §73
  carried the same IOU for Chinese and it is still open; three more locales
  is three more of it. Stated rather than implied by green gates.
- **A stray-script scan, run once by hand, caught three authoring slips** no
  gate here looks for: two Cyrillic fragments and one untranslated English
  word, each inside an otherwise correct sentence, in tables whose gates were
  green. Fixed. Not turned into an instrument — a general "Latin word in CJK
  prose" check false-positives on every legitimate `Watch Sim`, `Claude` and
  `JSON` — but the class is real and worth knowing about.
- **`explain-quotes.mjs` still never reads the translation tables.** It reads
  the two HTML files from disk, so a translated primer could reintroduce a
  source identifier and no gate would notice. Pre-existing for de and zh;
  three more primer tables triple the exposure.

## §117 — The explainer in French, Japanese and Traditional Chinese

**Shipped whole — the tier §116 named and declined.** `explain.html`'s full
key set now reads 533/533 in French, Japanese and Traditional Chinese, which
closes the last coverage gap in the project: both static pages and the chrome
at 100% in all six locales. The entry was filed against a 530-key page; the
page grew to 533 while the entry waited (§113's detail view landed on it), so
the skeletons were re-extracted fresh from the DOM rather than reused —
the entry's own "never retype a key" rule applied to itself.

**Each table went 0 → 100 in a single commit, on purpose.** The tables are
live from the moment they have entries, so a partial table renders
mixed-language prose — worse than the honest English fallback an empty one
gives, which is exactly why §116 shipped them empty rather than partial. The
per-locale commit is the unit that keeps every branch state shippable.

**What the gates caught, and it is why they exist.** All three constraints
the entry predicted drew blood, and one theme ran through every locale:
**English carries emphasis as CAPITALS, and a locale with no capitals tempts
the translator into an `<em>` that does not exist in the source.** The tag
sequence is the contract — the markup gate compares it per key — so the
emphasis rides the prose instead, three times over (Japanese once, AGAINST;
Traditional Chinese twice, AGAINST and MEANS). Per locale:

- **French** — the predicted red, and it was: **28 labels** overran or
  collided where the English baseline fit (German-class expansion, no CJK
  compression), plus one dropped `<b>` in the lay-shaft paragraph. Every fix
  was in the LABEL — terse by nature, meaning kept, digits untouched — never
  in the tolerance; measured to 0 new vs English over two passes. Numbers
  stayed in source form throughout, the loud constraint for fr-FR, which
  would ordinarily write `0,15` and group with U+202F — and on the primer
  correctly does.
- **Japanese** — fit-safe (CJK compresses; 0 label work) but five per-key
  defects: two split SVG labels with their digits redistributed across the
  split differently from English, "once/hour" rendered as digits where the
  source spells a word, the CAPS `<em>`, and one `<code>CLEAR_MARGIN</code>`
  flattened to plain text.
- **Traditional Chinese** — five again, the Japanese classes replayed: the
  two CAPS `<em>`s, the saw-wheel plate's digits (40, 2) split across its
  two lines where English keeps both on the first, and one `<em>` restored
  in the wrong POSITION — English puts `<code>floorAt</code>` before
  `<em>down</em>`, so the Chinese clause was reordered to match rather than
  the checker taught to accept a permutation. Translated fresh from
  English, never converted from the Simplified table; the register tells
  hold (錶 not 表, 模擬 with 仿真 absent), checked by scan, not assumed.

**The stray-script scan ran again, by hand, and this time found nothing.**
§116's slip class — Cyrillic fragments and untranslated English inside
otherwise-correct CJK sentences, invisible to every gate — was checked over
all three tables: clean. Still not an instrument, for §116's stated reason
(a Latin-in-CJK check false-positives on every legitimate `Watch Sim` and
`JSON`), but the class is now two landings old and worth the two minutes.

Gates, at the landing: `explain-i18n --check` PASS across both pages × five
tables — 0 unmatched, 0 markup drift, 0 `<code>` drift, 0 number drift, 0
new plate overflow/collision vs English; `explain-quotes` PASS;
`offline-check` 27/27 with precache unchanged at 33 — no new files, because
§116 already shipped and precached the three tables empty. The battery is
correctly out of scope: the diff is three translation tables plus records,
none of it on `index.html`'s module graph — the invariant the harness itself
asserts against the `paths-ignore` list.

### Residue, recorded

- **No native review pass**, for any of the three — the entry's definition
  of done asked that this be said either way. §73's Chinese IOU and §116's
  three now cover this page too: six locale-tables of dense horological
  prose reviewed only by their author and their gates.
- **`explain-quotes.mjs` still never reads the translation tables** (§116's
  residue, unchanged). It holds the two HTML files; a table could
  reintroduce a source identifier into the primer's prose and no gate would
  see it. The exposure is now at its full size — every locale, both pages.
- **The stray-script scan is still manual**, two landings running.

## §118 — Camera moves to the View panel

**One question, one panel.** §110 item 4 moved View and Performance out of
`#clock-ui` into their own top-right panel, on the argument that the controls
a viewer touches most should not be the deepest rows of a scrolling 240 px
column. Camera was left behind and should not have been: a preset is not a
property of the watch, it is where the viewer is standing, which is the
question the view panel exists to answer. What remains in `#clock-ui` is now
the watch itself — its time, its alarm, its finish, its state.

The section moved WHOLE, markup unchanged: the five `data-cam` presets,
Guided (Tour / Demo / Inspect), Life size and its Calibrate, and Copy view.
It folds rather than joining the flat six, because §110's rule for that panel
is that the named six sit unfolded and everything else discloses — four more
flat rows would push Advanced and Performance off a short viewport, the exact
failure the rule exists to prevent. No new strings: `Camera` was already in
all six locale tables.

**§110's "every binding is by id" claim had exactly one exception, and this
is the change that found it.** The keyboard shortcut table's `preset()`
resolved its button with `panel.querySelector('[data-cam=…]')` — the one
selector in the app that named an ancestor. Moving the section would have
broken keys 1–5 in silence: no error, no missing element, just five keys that
stopped doing anything. It is now `document.querySelector`, which is not a
loosening — `data-cam` is unique in the document (`#state-buttons` reuses the
`.presets` class but carries no `data-cam`), so the scope was never what made
the lookup correct. The four `.hud-panel .presets button` sweeps that paint
the active preset already matched both panels and needed nothing.

**A side effect worth recording, because it is an improvement nobody asked
for.** `hidePanelForScript()` collapses `#clock-ui` while a guided script
runs, so the run is not viewed through the panel. The Tour/Demo/Inspect
buttons used to go with it — a running script's own Stop control, hidden by
the script starting. They now live in the panel that stays up.

## §119 — The pad's targets, and the crowns' gestures

Four complaints from one session, all of them about controls a finger
actually meets: three land on §57's control pad, the fourth on the crown in
the 3D view. (The fifth from that session was §118's, one entry up.)

**The alarm crown could not be tapped at all.** §57 spreads any control pair
too close to separate with a thumb — and named the pair: `crown` ⇄ `pusher`,
which was the colliding pair when it was written. §112 then rotated the alarm
module. Measured on the pad before this change: `crown` −35.00°, `alarm`
180.00°, `pusher` −175.53°. The spread ran, found its named pair 140° apart,
did nothing, and reported nothing — while the pair it was not looking at sat
**4.47° apart, a centre gap of 6.51 viewBox units against two 18-unit hit
circles**. The pusher is drawn last, so it is on top, so it took every tap
meant for the alarm crown. Every gate in the battery was green throughout,
because no gate has ever looked at the pad.

Naming the pair was the defect. The spread now sorts by azimuth and clears
every ADJACENT gap, relaxing until all of them hold (3 × 46° is 138° of 360°,
so a solution always exists and it settles in a pass or two), and then
**boot-asserts the achieved minimum** — standing rule 6, aimed squarely at
the next `?alarmmod=`. Order around the ring is preserved, which is the
property §57 said the spread must keep. Result: `alarm` 180.00° → 159.24°,
`pusher` 184.47° → 205.24°, crown untouched, and the two now measure exactly
46.00° apart.

**The targets are wedges of the ring band now, not discs on the heads.** §57's
18-unit circle was not a chosen size, it was a ceiling: the trackball's hit
circle starts at `HUD_RIM·0.72` = 41.8 and the innermost head sits at 60, so a
larger disc would have begun stealing taps from the face. That ceiling is what
kept the targets at ~27 px across on a 150 px pad, against the 44 px floor
§110 derived. A wedge escapes it rather than arguing with it — each control
owns the slice of band on its own azimuth, and all three dimensions derive:
inner radius = the trackball's own edge (so the face keeps its WHOLE circle
and the target grows outward, into a band where nothing lives); outer radius =
the viewBox rim; half-angle = `HUD_MIN_SEP/2`, so neighbouring wedges **tile**
and cannot overlap however the layout moves. The two constants are one number
apart on purpose: the spread's minimum and the target's width are the same
fact said twice.

Measured at 1440×900 with the controls at rest, by
`tools/probe-119-pad-targets.mjs`: **43.7 px along the band × 35.2 (crown) /
36.7 (pusher) / 39.1 (alarm crown) px across it**, 0 overlapping pairs, four
abutting ones — the tiling working, with no pixel wasted between two targets.
The across-band figure is **short of the 44 px floor and is reported rather
than rounded away**: closing it needs ~54° between neighbours, and 8° more lie
about where the alarm crown sits is a worse trade than 5 px of thumb.

**A crown splits by duration now, not by direction: tap to pull or push, drag
to turn.** §57 gave both jobs to the drag — radial swipe = slide, tangential =
turn — and left the tap to the pusher alone, reasoning that a stray tap that
hacked the watch would be a state change nobody asked for. Two things were
wrong with that. The radial swipe must travel `HUD_ACT` (11 units, ~8 px) in
the one direction the finger is least free, which is genuinely hard to land;
and a tap is not stray if it is MEASURED at release — the mechanism the pusher
had all along and the crowns were never given. A gesture that never passed
`HUD_CLASSIFY` moved no crown and can only have been a poke. So every drag on
a crown is now a turn, by the component ACROSS the knurling, re-based at the
classification crossing so the deadband is a deadband and not a 5-unit jump;
release with no classified drag calls the same `toggleCrown()` /
`toggleAlarmCrown()` the panel button and the 3D knob call. The pusher keeps
both of its gestures — it has no turn, so its radial push cannot be mistaken
for one.

**And that turned up a defect nobody had reported.** §57's turn branch ended
`if (id === 'crown') crownRotation = turned; else alarmCrownRotation = turned`
— an else that swept up the PUSHER, whose grab seeded `rot0` from
`alarmCrownRotation` for the same reason. So a tangential drag on the pusher
classified as a turn and set the ALARM CROWN's angle: the wrong control,
silently, from a gesture the pusher does not have. Restricting the turn to the
two crowns closes it.

**And in 3D, a crown turns with the knurling under the finger.** §24 and §27
both read the drag's screen X: `rotation = start + dx·k`. That is right for
the view a photograph of a watch is taken from — crown edge-on at 3 o'clock,
knurling running up the screen, a horizontal swipe crossing it square. It is
wrong for the view this app opens in. Turn the watch dial-first and the same
crown still answers only to horizontal, while the knurling a finger is plainly
over now runs horizontally too: the gesture that should turn it does nothing,
and the one that does nothing on a real crown turns it. No screen direction
can be right for both crowns in every view, because the stem's azimuth is a
layout choice (`?crownaz=`, `?alarmaz=`) and the camera is free.

The knurling can be, because it is a real surface. The frame is built from the
CONTACT — where the ray actually met the knob — and frozen at grab: **â** the
stem axis (the builder's +Z, which `makeCrown` revolves the barrel about),
**r̂** the contact's radial direction taken out to `rimR` (the finger grips the
knurling, which is at the barrel's own radius — and that also removes the pole
singularity of a contact on the face's exact centre), **t̂ = â × r̂** the way
that surface travels for one radian. Projected to the screen, t̂ gives both the
direction a drag must run and the pixels one radian is worth, so §24's typed
sensitivity is now read off the picture: turn the crown through its own
circumference and the finger travels that circumference on screen.
`CROWN_DRAG_SENSITIVITY` survives as the **ceiling** it always implicitly was
— however far away the camera, a full turn never costs less than the 350 px it
did before, which is what keeps a crown drawn 6 px wide from spinning wildly.
At ordinary framings the crown is small enough that the ceiling is what binds,
so **what changed in practice is the direction, not the rate**: measured at 350
px per full turn in every pose below, exactly as before. The 1:1 roll takes
over only when the crown is drawn larger than ~56 px of radius, which is
someone who has zoomed in on it. `â` is read from the knob's matrix, so it is
boot-asserted against the axis the knob's spinner actually turns about — flip
`rotation.x` at either call site and â reverses while every position stays put,
so the crown would turn the wrong way with nothing to say so.

The witness deliberately is NOT the knob's position. The obvious check — "the
knob sits out along its stem from the spinner" — is a claim about where the
knob is, which the roll never uses, and it cried wolf immediately: at
`?alarmr=46` the corner is past the case rim, the stem length goes negative,
and the knob lands on the far side of its own spinner with a perfectly correct
axis. That spec already warns five times that its alarm layout does not close;
a sixth warning about the one thing that was right would be noise on a real
signal. Caught by diffing the battery's spec-boot warning counts against the
base — the only place it showed.

Measured by `tools/probe-119-crown-roll.mjs`, which tests it as a law rather
than as a view — both crowns, three camera azimuths 72° apart, and in all six
cases the knurling's own screen direction is different: **a 60 px drag ALONG
the knurling turns 0.001–0.056 rad, ACROSS it 1.076–1.077 rad.** The old code
would have read a fixed 1.077 for screen-horizontal in every one of them.

Both handlers now measure the drag threshold on `hypot(dx, dy)` rather than
`|dx|`. That is not tidiness — with vertical drags turning the crown, an x-only
threshold would let a completed turn arrive at `pointerup` still looking like a
click, and pull the crown the viewer had just wound.

**The hands are always up; setting highlights them.** §63 faded the preview
hands in only while a setting path was engaged, which kept §57's controls-only
plan but made the corner two different things — a face while you set it, a
bare ring the rest of the time. All three now rest at `HUD_HAND_REST`, derived
from the ring's own furniture rather than picked: a hand stroke is
`rgba(255,255,255,0.85)` and the rim it sits inside is `0.26`, so 0.26/0.85 ≈
0.3 puts a resting hand at exactly the presence of the drawing it belongs to,
leaving the full 1.0 for the hand a setting path raises — a 3.3× step nobody
has to look twice at. The mapping is unchanged (`crownPullT` → the time pair,
`alarmCrownPullT` → the alarm hand); appear/disappear simply became
dim/highlight, and the angle writes lost their `pvT > 0 || pvA > 0` gate,
because a hand always shown at a stale angle is worse than no hand.

§90's figures stay, and are not now a second copy of the hands: the ring says
WHERE, the figures say HOW FAR APART. "≈7:15 against 10:24" is arithmetic a
glance can do and two angles on a 41 u ring is a squint, which was §90's
argument for figures and is still true with the hands up.

### Residue, recorded

- **No gate watches the pad.** `probe-119-pad-targets.mjs` is a probe, not a
  battery check — deliberately, on `probe-116-locale-fit.mjs`'s precedent
  (these are rendered-browser facts, measured on purpose rather than
  assumed). The boot assert covers the angle, which is the half that can go
  wrong from a layout change; the rendered geometry is checked when someone
  runs the probe.
- **Neither probe is a gate**, so both are only true when someone runs them.
  The boot asserts cover the two halves that a layout change can silently
  break — the pad's minimum separation and the roll's axis — and that is the
  part which holds itself.
- **The 1:1 roll regime is untested**, because the sensitivity ceiling binds
  at every framing the probe measured. What is measured is the direction law
  and the ceiling; the rate above it is derived, not observed.
- **The pad's wedges reach the viewBox rim**, so the corners of the pad
  within ±23° of a control are live target area for it. That is the point — it is
  most of the 43.7 px — but it does mean a tap well away from a marker still
  works it.


## §120 — TODO 45 closed: the governor's posts are turned, the stone is refused twice, and the window frames the anchor

**Item 45 was a review, and reviews close by answering.** §111 bored both
governor arbors, §113 re-derived the escapement as a flat-faced recoil anchor
with real drop, and what the item still carried was one strand — the PIVOTS —
with three named gaps: **endshake**, an **oil sink**, and the **stone**. Two
are built here and the third is refused, on measurements the item did not
have. The plate window §115 cut over the governor is re-framed in the same
landing, at the owner's direction, onto the anchor alone.

### The bearing had a bore and no other limit at all

§111's own sentence — "the arbor was LARGER than its own post" — was about the
radial direction, and it fixed that direction: a real bore, `PIVOT_BORE_CLEAR`
of side-shake, the stud genuinely occupying a hole. Nothing was ever said
about the other direction, and nothing held it. Each arbor was a tube standing
on a plain cylindrical post with **no metal above it and none below it**: dial
down, the wheel leaves the movement; dial up, it slides to the plate. Where in
z the arbor actually sat was the builder's `position.z`, not the bearing's.

No instrument could have found that. `intraUnit` looks for INTERSECTION and
there was none; `support` measures the post against the plate it stands in;
`assembly` reads meshes that ride a MOVING frame, and a post is a fixture. A
bearing with a missing degree of freedom is not a foul, it is an absence, and
absences are what this item exists to catch.

### The post, turned: three diameters and one derivation

Each post is now a lathe rather than a length of bar. Read from the plate up:

| feature | radius | z | derivation |
|---|---|---|---|
| foot collar | `ALARM_GOV_ARBOR_R` 0.585 | plate seat → arbor foot − ½ endshake | the planted length, ending in the thrust face |
| oil cup | post → bore, `PIVOT_BORE_CLEAR` wide, one deep | cut into that face | the running clearance itself, opened downward |
| bearing length | `ALARM_GOV_STUD_R` 0.35 | between the two collars | §111's bore runs on this |
| head cup | the same annulus | cut into the head's underside | the film's other end |
| formed head | `ALARM_GOV_ARBOR_R` 0.585 | arbor top + ½ endshake, `PIVOT_MIN_U` thick | it stops the arbor lifting off |

**Both collars fall out of one sentence.** A collar has to overhang the bore by
metal that can BEAR, and the width of metal that can bear is the arbor's own
wall — which §111 derived as `PIVOT_MIN_U`. So collar radius = bore + wall =
`ALARM_GOV_ARBOR_R`, exactly, and the land a collar presents is the same
annulus of arbor that lands on it. That is §77's rivet rule one level up (the
formed head and the land it bears on are the same stock), and it is why the
head's thickness is `PIVOT_MIN_U` too.

**`ALARM_GOV_END_SHAKE = 2 · PIVOT_BORE_CLEAR`** — 0.1 u, **0.038 mm**, the
arbor floating half of it off each collar. Derived, not chosen: a bench sets a
wheel's endshake at about its side-shake, and side-shake is the play measured
ACROSS the bore — the diametral figure, twice the radial fit the bore is cut
to. One fit, read the two ways a bench reads it, landing inside the real
0.02–0.04 mm band. Floating the arbor rather than seating it on the lower
collar is the same choice every other running fit in this movement already
makes: a clearance is drawn as the clearance it is cut to, never as coincident
metal (§111's whole argument, applied to the axis it did not reach).

**One lathe, one body.** The collars are not parts fitted to a pin — they are
what is left when the bar is turned down between them — so nothing here is a
joint, `INTRA_UNIT_CONTACTS` gains no row, and `assembly` has nothing new to
judge. The two existing governor rows keep their names and gain a sentence:
they describe a running fit in three directions now instead of two. The
profile touches the axis at top and bottom, so both end caps are real faces
(TODO 27: an open body reads as a COLLIDING one to the sampled verdict,
including the faces nobody can see).

### The oil sink is in the collar, and §111 is the reason it is not in the bore

A hole's oil sink is normally a countersink at the bore's mouth. Here it
cannot be, and the reason is a derivation working exactly as intended:
`ALARM_GOV_ARBOR_R = ALARM_GOV_ARBOR_BORE + PIVOT_MIN_U` puts that wall
*exactly on* §50's pivot floor, so a chamfer at the mouth takes it under, and
widening the arbor to make room re-opens `ALARM_GOV_HUB_R`, then
`ALARM_GOV_ANCHOR_D`, then §113's entire closure. A constant that cannot be
nudged is a constraint doing its job.

The other end of the same oil film is the COLLAR FACE, which is fixed metal
with stock to spare. So the sink goes there: an annulus from the post out to
the bore's own radius — `PIVOT_BORE_CLEAR` wide by construction, cut one deep
— in both the foot collar's face and the head's underside. The drop it holds
stands in the running clearance itself, and because the cup's outer wall IS the
bore, **none of the land the arbor bears on is lost**. Asserted, not asserted
by hand-waving: a boot check refuses a cup wider than the clearance.

### The stone: refused twice, and the second refusal is geometry

The item argued the governor is "the most jewellable thing in the watch",
from RATE: the saw turns 4.76 rev/s against the escape wheel's 0.167, and the
anchor reverses at 190 Hz. **Wear is not a rate. It is a rate times a time**,
and this governor's time is **11.8 seconds a day** — 28 strikes at the 0.42 s
designed gap. Integrated, the ranking inverts:

| bearing | its own work | the jewelled arbor it is measured against | ratio |
|---|---|---|---|
| governor saw arbor | **56 rev per ring**, once a day | escape wheel, **14400 rev/day** | **×257 less** |
| governor anchor pivot | **2240 reversals per ring** | balance staff, **432000 reversals/day** | **×193 less** |

That ×193 is the SAME number item 45's finding two computed for the pallet
FACES, and not by coincidence: the count of tooth contacts and the count of
anchor reversals are one count. **The pivot question and the face question had
a single answer all along**, measured twice in the same item without the two
arithmetics ever being written side by side. Real striking-train governors run
in plain steel at both places for exactly this reason, and the movement's own
`jewelR: 0` on the barrel arbor and the set-up work is that judgement already
made about a different axis.

**And on the governor arbor a stone does not fit at all.** That arbor turns
inside its OWN 8-leaf pinion, so the pinion decides. Measured on the built
gear, its root circle stands at **0.671** against an arbor of 0.585 — 0.086 of
pinion body outside the bearing. Real hole jewels carry 0.25–0.45 mm of ruby
around the hole; the thinnest is 0.660 u, which puts the arbor at **1.245**,
past the root circle by 0.574. There is no pinion left. Jewelling this axis is
not a bearing change, it is a re-cut of the ×8 mesh, its centre distance and
the tier that carries it — for a bearing that turns 56 times a day. The ANCHOR
arbor could take one geometrically, at +0.66 on the hub and therefore on
`ALARM_GOV_ANCHOR_D` and §113's closure; jewelling the slower of two axes
while the faster runs bare inverts the convention the strand argued from, so
the geometry settles both ends.

**What that leaves open, stated because a closed item hides things:**
`stockFloor` still has no `jewel` kind — nothing jewelled landed to need one —
so the trap item 45 named is intact, and the next set stone anywhere in the
movement is still judged against the 0.12 mm `wheel` floor. The movement now
carries no ruby outside the going escapement and the balance, which is the
right answer twice over and is worth knowing before someone reads it as an
omission.

### What it cost: the ring's floor, and nothing else

Retaining the governor rotor puts a collar on top of the governor post, and
the poising ring sweeps past that post's axis at **0.133** measured against the
ring's stock CEILING (the bound `ALARM_UNDER_FOOTPRINT` declares, so this
stack does not move when the section solve does) — 0.017 under the one margin.

Both members are in ONE action group, so P2 forbids paying for it out of
either, and it did not have to be paid there: the ring's radius and its section
are the two quantities the I_a solve owns, and **both are radial**. So the
answer is a z-stack answer. `ALARM_GOV_RING_BOT` rises 0.225 (1.967 → 2.192) to
clear the head it passes, the true 3D approach becomes **0.210** on the
diagonal, and the cadence solve does not move by a float. Two boot asserts hold
it — a z answer to a radial near-miss is only honest while the z gap is
asserted, and the foot collar (which the ring also fails to clear radially, in
a band 2 units below it) gets the same treatment.

The governor units' z reach grows from 4.05 to **4.511** against a
three-quarter plate underside at 7.71: 3.20 of air where §115 measured 3.66.

### The window frames the ANCHOR

§115 cut this window as the UNION of the saw's disc and the ring's, on the
argument that framing either alone frames half a mechanism. **That argument
was about the action, and the action is not divided evenly between the two
members.** The saw's rim is a circle of teeth; everything the escapement DOES
— §113's flat faces, the drop, the poising ring the cadence is an arithmetic
of, and now the located bearing under it — happens on the anchor. So the frame
is the anchor's own declared disc:

| | §115 | §120 |
|---|---|---|
| polar centre | midpoint of `ALARM_GOV_ANCHOR_D` | the anchor's axis |
| discs | governor saw + governor ring | governor ring |
| reach from the centre | 5.307 … 10.009 | **6.483, exactly, at every bearing** |
| area cut (½∮r²dθ) | 209.6 of 211.5 wanted | **132.1 of 132.1** |
| bearings at full reach | 339 of 360 | **360 of 360** |
| keeps bite | 21 bearings, worst 0.900 at 293° | **none** |
| sectors cut | 1 (bossless) | 1 (bossless) |

The keep field stops biting because the obstacle §115 named — the strike
arbor's bore, 10.30 from the old centre — stands 13.22 from this one, 6.74
beyond the window's edge. And the framed circle is exact rather than
bisected: a single disc concentric with its own centre short-circuits to `d.r`
by name in `solveTqWindows`, which is the same path §115 built so the two
older windows would stay bit-identical when the union arrived.

**The saw is still IN the frame, as the action holds it.** The tooth circle
passes 1.05 from the anchor's axis, so **117.8° of the saw's rim** — the arc
the pallets work on, with the engagement at its middle — stands inside this
window; the far side of the wheel goes back under the plate. Measured on the
finished plate, by the same +z raycast §115 used:

| unit | before §115 | §115 | §120 |
|---|---|---|---|
| Alarm governor | 0 of 2007 (0.0%) | 1989 of 2007 (99.1%) | **447 of 2087 (21.4%)** |
| Alarm governor anchor | 0 of 989 (0.0%) | 989 of 989 (100%) | **1069 of 1069 (100%)** |

The governor unit's fall is the point of the change and not a regression to
argue away: what went back under the plate is the saw's far rim, its pinion,
its arbor and its post — the drive INTO the escapement, not the escapement.
(The vertex counts rise because the posts are lathes now, not cylinders.)

What it buys is plate, and the honest measure of that is AREA rather than
reach — two windows with the same reach can take very different amounts of
metal, which is why `probe-115-window.mjs` now reports ½∮r²dθ over the solved
reveal. The opening falls from **209.6 to 132.1**: **37% of it returns** to a
plate that is a bearing first, §115's own stated priority applied to §115's own
window. One consequence lands where §115 predicted it would:
`seatClearance` re-optimises against the smaller opening and the 45° pillar
seat travels back to 29.376, 25.536 — the station it held before §115 moved it.
The other three do not move.

`explain.html` gains a paragraph on the governor entry (the bearing is a
mechanism, unlike a window — §115's own line), translated into all five
locales in this landing rather than left to fall back. `MECH_GRAPH` gains
nothing: no part was added, and the posts are the same two meshes under the
same two names.

### The battery, and the one row that moved

**20/20 gates pass**, boot silent, run locally against `origin/main` and this
tree in turn on the same idle 4-vCPU box so the two `--report` payloads are
comparable:

```
support 0 failures · graph clean · penetration every row OK or waived
alarmHandoffs 13 hand-offs, 0 waived · stockFloor 537 rows, 0 degenerate, 0 unwaived
intraUnit 264 movers over 55 poses, 0 unwaived · assembly 0 undeclared unwaived splits
expectedContacts 13 pairs, 0 unwaived, 0 unmatched selectors
oscillator 2.5 Hz on a 0.0244 mm ribbon · equalisation TODO 32 held, ring 0.790 mm in stock
restoring 20 reversing units, 0 unwaived, control PASS
inspection 0 FORBIDDEN over 53 units and 74 contacting pairs · clearances 0 violations over 30 budgets
sweptOverlap 0 CONFIRMED over 67943 pairs (tight 4, refuted 20)
spec boots 26/26 build, identity control silent
```

`--report` diffed check by check: **thirteen of fourteen payloads are
byte-identical** — `alarmHandoffs`, `assembly`, `clearances`, `equalisation`,
`graph`, `inspection`, `intraUnit`, `oscillator`, `penetration`, `restoring`,
`stockFloor`, `support`, `sweptOverlap`. Two things moved:

1. **`expectedContacts`, one row, and it OPENED.**
   `Alarm governor ⇄ Alarm governor anchor` goes **0.160 → 0.168**, and the
   binding mesh pair changes with it: `alarmGovSaw ⇄ alarmGovRing` at
   `beat f=0` becomes `alarmGovSaw ⇄ alarmGovAnchor` at `alarmStrike f=0.5321`.
   That is the ring's floor rising out of the saw's neighbourhood and the
   anchor's own hub becoming the tightest approach in the pair. Nothing about
   the new metal binds anywhere: the ring passes the post's head at 0.210 and
   the 64T wheel passes its foot collar at 0.264, both above the row's own
   0.168.
2. **fingerprint `761710512 → 1709442067`.** Two contributions, both expected:
   the governor units' own boxes grow (the posts are taller and wider), and
   `pillars` moves — `seatClearance` re-optimises against the smaller window
   and the 45° seat travels back to the station it held before §115 moved it.

Cost: total check time 2816.0 → 2768.3 s, every check inside run-to-run noise
(`sweptOverlap` 1129 → 1113 s). The shard partition is unchanged in shape and
the `cost` column is left alone.

## §121 — TODO 5's missing tiers: the inspector sees fixture pairs and cross-frame movers inside a unit, and the declared table grows a spine

**The owner prioritised this item (2026-08-12) on §107's evidence**: three
mover-vs-mover defects in one mechanism, every one invisible to a battery
whose every check is a relation between two DIFFERENT units, the worst found
by the owner looking at a screenshot past 19 green gates. The 2026-08-01
interim (`intraUnit`) had built one of the three pair classes inside a unit —
movers against fixtures. This entry builds the other two, wires the class
that guards the declarations themselves, and gates what its triage measured.

### Three tiers, one lap, one declared table

`checkIntraUnit` still derives everything and names nothing. One
classification lap over the 55-pose net now feeds three consumers:

- **MF** — movers vs their unit's fixtures, at every pose. The 2026-08-01
  tier, unchanged, still gated over EVERY unit.
- **FF** — fixture pairs, ONCE. A fixture is a mesh whose unit-relative
  signature never changed over the net, so fixture-vs-fixture geometry is
  pose-independent *by the classification's own definition* — one pose is
  the whole answer, and the Dial's C(147,2) ≈ 10.7k pairs cost one lap
  instead of 55. This is the ruby-in-slot tier: both meshes static, exactly
  the pair the mover/fixture split never compared, and the class MODELING.md
  rule 1 now carries in words (a bevel grows INWARD inside a notch).
- **MM** — mover pairs ACROSS RIGID FRAMES, at every pose. Movers on one
  frame are one part — that is `checkAssembly`'s connectivity domain (§107),
  and their mutual overlap is a joint by definition — so the tier clusters
  each unit's movers by the SAME world-motion-delta signature the assembly
  check uses. `sameFrame`/`clusterByFrame` are HOISTED to module scope: one
  predicate, two consumers, and the assembly payload is byte-identical
  across the refactor by construction and by measurement. §107's
  arm-through-saw was exactly a cross-frame pair inside the pre-promotion
  governor unit.

Two rules the tiers needed that the interim did not:

1. **A morph is always its own frame.** The mover CLASSIFICATION has carried
   `geometry.id` since MODELING.md rule 6 (a part that swaps geometry moves
   its surfaces without moving its matrix). The frame CLUSTERING needed the
   same care in a new place: two matrix-still morphs cluster as one "frame"
   on the matrix trace alone and drop out of comparison — rule 6's
   silent-exclusion class, pre-empted rather than hit. The alarm barrel's
   ribbon⇄wall and ribbon⇄hook rows reached the MM tier through exactly this
   rule.
2. **A throw arbitrates nothing.** `pointInsideTree` throws on geometry with
   no normals. `checkAssembly` assumes "joined" on a throw because inventing
   a FRACTURE is its unsafe direction; this check's unsafe direction is
   inventing a COLLISION, so all three tiers share one guard that files the
   pair under `unmeasurable` — reported, never a verdict either way.

### The declarations grew a spine, and the duplicates lost their excuse

Two structural fixes landed with the tiers because the first sweep demanded
them:

- **A stale selector is now a FAILURE.** `INTRA_UNIT_CONTACTS` and
  `INTRA_UNIT_WAIVERS` rows whose unit or labels match nothing are gated at
  0 (`unmatchedSelectors` — `expectedContacts`' convention, TODO 6). The
  class is MODELING.md rule 7's: a welded geometry changing type once
  un-declared 14 joints with not one distance moved, in silence. Silence is
  now a red gate — which also changes the naming calculus below.
- **A pair belongs to the smallest unit containing both meshes.**
  `collectUnits` does no nested-label exclusion, so the Dial holds the whole
  alarm-disc stack and every pair inside a nested unit reported twice under
  two names, wanting two declared rows for one fact. The NEAREST-UNIT dedupe
  (strictly smaller wins; a tie keeps both) is `RESTORING_WAIVERS`' own
  dedupe argument applied at the source. The Dial's 35 phantom MM rows fell
  to the real units that own them.

While in the table: the duplicated `alarmGovSleeve ⇄ CylinderGeometry#0`
rows (a §112 revision left standing beside its §104 original) collapsed into
one row keeping both citations.

### The sweep, the scope, and the triage that earned the gate

The first full sweep found **259 rows across 46 unit×tier buckets** — stable
across three runs, no arbiter flicker — against the 54 rows the 2026-08-01
session triaged. That is not one landing's triage, so the gate is SCOPED,
§107's own precedent and its own words: what is gated is what the triage
supports. `INTRA_TIER_SCOPE` is the alarm complex — eighteen units, the
ground where this class bit three times — and its **42 rows were each
measured before being declared**: `tools/probe-121-depth.mjs` re-takes every
flagged pair with the check's own parity (the BVH raycast, DoubleSide, the
fixed oblique direction — a scene-level `Raycaster` culls backfaces and its
parity is garbage on closed solids, which the probe's first cut proved by
producing impossible depths) and reports contained fraction and depth, so
every declared why cites a reading.

**Zero of the 42 were defects.** The alarm complex has been through the
§29→§120 instrument passes; what those left behind are joints and working
contacts nobody had to declare while no instrument could see them: cock arms
pressed on pillars, guide posts socketed in cheek blocks, the gong wire's
braze onto its one post, coiled spring anchors, the pusher's three-piece
lap, §45's corner posts in their turned feet, the §48 follower's bearing,
two phase-solved gear meshes (TODO 15's chain), §102's return blade riding
its stud, §28's detent ball on the column wheel, and the barrel ribbon
bearing on its drum wall — the morph rule's first customers. The 42 rows
carry those whys, each with its §.

Everything outside the scope — **202 rows** — is REPORTED in the payload
(§48's rows-are-the-product): the Balance's 23 timing-screw seats, the
plates' furniture, the Keyless works' sliding gang, the going wheels'
collets. That triage is TODO 5's filed remainder, and the item is MOSTLY
CLOSED on exactly that line: nothing previously gated became ungated, the MF
tier still covers every unit, and the reported rows are visible in every
battery run rather than invisible in principle — which is the difference
this entry exists to make.

### Naming, honestly

Four meshes were named where one edit reached them (`alarmGongArc`,
`alarmGongPost`, `alarmClimbPinion`, `alarmSetIdler` — the §121 rows they
appear in read as parts, not indexes); the remaining declarations cite
`Type#index` labels with whys that identify the part in words. The naming
sub-idea (TODO 5's) advanced but did not finish, and the selector gate
changes what the residue costs: a label that drifts now FAILS the battery
instead of silently orphaning its row, so an index label is fragile but no
longer treacherous. The 0-unmatched result on the first gated run is also
the proof that the four renames staled nothing anywhere in the tables.

### What the record does not owe

`explain.html` and `primer.html` gain nothing — an instrument is not a
mechanism, §115's argument one door down. `MECH_GRAPH` gains nothing: no
part was added. The bespoke per-group asserts STAY — the stop-lever lattice
sweep, §113's arm-vs-tip-circle, §120's 240-phase saw⇄pallet cycle — because
the general tier holds the class at the pose net and the asserts hold their
instances FINER than it (MODELING.md rule 10's closing instruction; P2's
text now says so). The §120 pairs are inter-unit since §107 promoted the
anchor anyway, which is worth stating because that assert's header still
called itself TODO 5 residue.

### The battery, and the two payloads that moved

**20/20 gates pass**, boot silent, run locally on the same idle 4-vCPU box as
the base (which is §120's accepted tree — `git diff` between the two refs is
empty, so §120's head report IS this landing's base report):

```
support 0 failures · graph clean · penetration every row OK or waived
alarmHandoffs 13 hand-offs, 0 waived · stockFloor 537 rows, 0 degenerate, 0 unwaived
intraUnit 264 movers in 77 frames over 55 poses; pairs MF 5400/FF 2092/MM 5331,
  0 unwaived, 0 unmatched selectors, 201 out of scope (reported), 0 unmeasurable
assembly 0 undeclared unwaived splits · expectedContacts 13 pairs, 0 unwaived
oscillator 2.5 Hz on a 0.0244 mm ribbon · equalisation TODO 32 held, ring 0.790 mm in stock
restoring 20 reversing units, 0 unwaived, control PASS
inspection 0 FORBIDDEN over 53 units and 74 contacting pairs · clearances 0 violations over 30 budgets
sweptOverlap 0 CONFIRMED over 67943 pairs (tight 4, refuted 20)
spec boots 26/26 build, identity control silent · fingerprint 1709442067 — UNCHANGED
```

`--report` diffed check by check: **twelve of fourteen payloads are
byte-identical**, and the fingerprint does not move at all — the landing
adds measurement and names, no geometry. The two that moved:

1. **`intraUnit`** — the change itself: the payload gains `tiers`, `frames`,
   `outOfScope`, `unmeasurable`, `unmatchedSelectors` and the per-row `tier`
   tag, cost 2.0 → 6.4 s (the FF tier's one lap over ~2k pairs; the `cost`
   column is re-measured to 6).
2. **`assembly`** — **byte-identical modulo the three renamed labels**
   (`alarmGongArc`, `alarmGongPost`, `alarmClimbPinion` appear in its member
   lists where `TorusGeometry#0`, `CylinderGeometry#1`, `ExtrudeGeometry#2`
   did; reverse the renames and the JSON strings are equal). That is the
   sameFrame/clusterByFrame extraction's acceptance: the predicate moved
   house and not one verdict, count, or separation moved with it.

**One out-of-scope row flickers run-to-run**, named so the next `--report`
diff is not a surprise: `Dial / BoxGeometry#129 ⇄ alarmSleeveWeb` sits at
the arbiter's d≈1e-4 boundary (202 rows in the seeding probe, 201 in the
battery run — the same class as the three declared Keyless boundary rows).
It is a REPORT row in an untriaged population; its triage, like the rest of
the 201, is the item's filed remainder.

Cost: total check time 2768 → 2785 s — inside run-to-run noise beside the
+4.4 s the new tiers actually cost. The shard partition is unchanged in
shape.

## §123 — the striking wheel says what it does: a cam drawn from its lift law, and a collar that earns the generic circle

Filed by the owner in one line — "add geometry to schematic mode for the
alarm gong wheel". The wheel that rings the gong was very nearly absent
from the line tier: of the whole `Alarm striking wheel` unit only the
pinion drew, and only because `makePinion` records `userData.r` and the
§66 rotor pass enrols anything that does. The lifting cam, the lock
collar and the hammer's cam-following tail drew nothing at all.

**The tell was that two of them were already NAMED.** §107's
`SCHEMATIC_CALLOUTS` table carries "Lifting cam" and "Lock collar", and
its own tripwire asserts that every name in the table finds a mesh — so
the check passed, the labels rendered, and they pointed at blank space.
That is §107's finding one turn further out: not a wrong word drawn over
(§78's SKIP rule), and not a right word never drawn (§107's own case,
where setting `profile` opted the saw out and drew nothing) — but a word
spoken by the LABEL layer while the glyph layer said nothing underneath
it. A callout is a claim that there is something there to name.

### The cam takes §83's existing word

`userData.profile` — "a wheel whose content is its cut outline" — is
already the vocabulary for this, and the cam is its clearest case in the
movement. `ALARM_CAM_RISE_PTS` is *generated from the lift law* (§25's
own record: "the profile is GENERATED from the lift law, not the other
way round"), so the flanks are the entire content of the part and a
smooth circle at any radius would be a false claim on exactly the
grounds the escape wheel and the two ratchets decline theirs. The glyph
is the very point list the `Shape` was handed, so mesh, law and glyph
cannot drift; the bore radius was hoisted to `CAM_BORE_R` so the cut and
the drawing read ONE source instead of two copies of `0.8` that a later
edit could separate. Nothing new was drawn for it — §107 made that pass
generic precisely so a carrier draws everywhere the word is spoken, and
the floor it warns beneath moves 3 → 4. It remains a FLOOR, never an
equality (§78's tripwire shape): a cam that stops exporting its plan
warns rather than falling back to silence.

### The lock collar takes the GENERIC circle, and that is the point

The pattern since §78 is that the generic vocabulary lies and a part
opts out. This is the counter-case, and it is worth the record because
the reflex by now is to give every new part its own word. §25 B's collar
is a FRICTION BRAKE — a partial wind can park the train at any phase, so
the hold cannot be a notch and the surface is deliberately smooth. A
circle claims "this rim is invariant under the spin", which is not an
approximation here but the collar's whole design intent. So the generic
glyph is drawn, from the built mesh's own radius and station rather than
from restated numbers. **A part earns its own word by being misdescribed
by the generic one, not by being new.**

The hammer's tail is the third addition and it is there for a different
reason: without it the cam's lobes sweep past nothing and the hammer
reads as lifted by magic. It draws at `ALARM_TAIL_REST_AZ` /
`ALARM_TAIL_LEN` inside the pivot group the strike law already swings —
the glyph and the follower it drives are one contact, so they draw
together or neither is legible.

### Why the reports could not move, and the check that it didn't

Everything added is a `THREE.Line` flagged `userData.schematic` on
camera layer 1. `collectUnits` prunes those from every sweep wherever
they are parented, and `fingerprintBoxes` returns early on them — the
fingerprint guards the METAL, and §66's own note records the tier's
circles inflating unit boxes and moving the hash before that skip
existed. So this landing's acceptance is not "the gates are green"
(a gate reports only that its failure list is empty, and an empty list
that MOVED still passes): the `--report` payload was diffed against base
`b419e72` and is **identical on every substantive row** — pair counts,
budgets, measured gaps, waiver counts, and the fingerprint hash
`1709442067` on both sides. The only fields that differed were
wall-clock timers. 20/20 gates locally and in CI, no new waivers, and
`TODO.md` is untouched because nothing about the metal or its laws
changed — this landing changes what the drawing SAYS, not what the
movement CLAIMS.

**Residue, stated rather than filed:** the cam's outline is written at
BOOT, so a live `aesthetics` edit that re-cut the wheel would leave the
line stale until reload. That is the tier's existing declared class —
the gong's own boot arc and the contact dots' re-measure-on-entry — and
nothing in `aesthetics.json` reaches the cam today, so it is the class
this belongs to rather than a new instance of it.
## §124 — TODO 46 closed: the first stage re-gears so the ideal cut carries its chain, and the chain leans into the flank

The owner saw it before any instrument did: *"the chain seems to float at
the largest radius."* The bottom wrap ringed the cone in 1.9–2.5 u of open
daylight at every reserve state, touching only its inner-bottom corner —
and every battery run was green, because the §61 seating row measures
BURIAL only. TODO 46 filed the confirmation (three measurements,
`tools/probe-chain-daylight.mjs` committed) and the §61 **float row**
landed report-first, born WAIVED at its measured 3.191.

### The impossibility that shaped the fix

The ideal equalising flank falls at |dr/dz| = 10.44 at the base — no
groove carries a chain against that, and the failure is not local to the
base. The decisive arithmetic: the groove pitch (0.694) was barely above
the chain's own stack (0.66), where a real fusee runs pitch ≥ 2× stack. In
the slope window m ∈ [0.4, 1.7] NO chain pose exists — an upright link
gaps 2h·m off the floor while a link leaned far enough to seat sweeps a
footprint that fouls the adjacent turn (the turn-to-turn offset runs along
the plate's diagonal there; a finer chain does not escape it). Every lever
inside the old gearing was priced and failed:

- **Exit (b), the declared torque deviation, was BUILT and measured**
  before being rejected: capping the flank at what a vertical-headroom
  tilt affords sagged the delivered torque 32% over the bottom 14% of
  reserve, moved the level product +25%, lengthened the chain 27%, and
  produced a physically impossible 45°→81° tilt cliff at the regime
  boundary. The working tree was discarded; the numbers are why.
- The z-budget cannot buy a taller band (0.0044 of land slack, zero
  chain-to-centre-wheel slack — measured in the filing).
- An everywhere-gentle cone needs a 51-click set-up (empty fraction 0.74).
- A 12:1 first stage (the cheap pinion recut) still needs 43 clicks,
  because pitch 0.926 sits just under the m ≈ 1 window's 0.95 threshold.

### What shipped

**The law** — the one lever that closes it is the first mesh itself,
because hours-per-fusee-turn IS that ratio (and `reserve/8` had it
hard-coded twice): `TRAIN.barrel` 0.36/80/10 → module 2·16.2/127 = 0.25512
(centre distance HELD, the center arbor does not move; wheel r 14.40 →
15.31), 120 teeth, 7-leaf pinion. The fusee turns once per 120/7 h; the
30 h reserve is **1.75 wraps over TWO grooves at pitch 1.389**. SETUP_CLICKS
17 → 23 — the minimum integer whose full-band best-pose seat residual
clears the float budget with 10% standoff (22 → 0.200 ✗ vs 0.198; 23 →
0.146 ✓, the worst station moving to the tip where it is pure chording).
The level product P = r₀·θ_s = 32.9344 is held as `FUSEE_LEVEL_P`, so the
train's drive torque k·P/R_wrap is bit-identical and r₀ = P/θ_s = 5.46955
stops being the bare literal 7.4. The torque law returns to the ideal
closed form, exact — level dev 2.2e-16, no declared deviation anywhere.
The reserve indicator re-geared with the arbor it reads (R = 1.75·360/150
= 4.2 = 28/8 × 12/10; TODO 18's assert is why it could not be missed), and
`FUSEE_TILT_Z = √(h²+w²) − h = 0.40790` funds the leaning chain's extra
down-reach once, in position space: the groove floor (FUSEE_Z0_MIN) and
the upper stratum (L_THIRD/L_FOURTH/L_ESCAPE) rise by the same named
constant, so FUSEE_BAND and the centre-wheel margin are spent nowhere.

**The geometry** — wrap links LEAN to `fuseeBetaAt(f)` = min(atan m,
63.43°), the lie-flat ceiling; the cut's floor generalises to the
corner-locus law at the link's own tilt (station z_c = z + w·sinβ + h·cosβ,
floor = env(f(z_c)) − (w·cosβ − h·sinβ)), which at β = 0 is exactly TODO
40's half-stack shear — a generalisation, not a fork, published through
`userData.groove.floorAt` so cut and check hold one law. Rivets ride the
mean of their neighbours' frames; the declared articulation fiction peaks
at 36.3° of per-joint twist at the wrap departure. Two boot asserts hold
the construction: tilt down-reach affordable at every station (zero slack
at f = 0 BY construction), adjacent-turn stack separation ≥ 0.02 at each
station's own tilt — the chain is one mesh, and sweptOverlap is
structurally blind exactly there.

### Measured at closure

```
§61 float row   3.191 WAIVED  →  0.202 unwaived (budget 0.25, worst at the bottom turn)
§61 burial row  0.137         →  0.217 (the honest 2.41 effective chord — stadium apexes past the rivets)
drum seating    0.062         →  0.061
probe-chain-daylight means (t = 1 / 0.5 / 0.15): 1.90 / 1.90 / 2.45  →  0.91 / 0.91 / 1.16
boot: silent, both §124 asserts quiet; equalisation green, 23/24 quantised,
windFull 10.2078 rad, K 3.2264, moments 0.60–1.02 N·mm
```

The float row's residual is chording at the honest effective chord (2.41 —
the outer plates' stadium arc apexes reach 0.253 past each rivet, a §124
correction the design sweep's pitch²/(8r) understated) plus the base's
0.024 lie-flat corner residual (the flank there is 2.109, past the cap's
tan = 2; the envelope's curvature relieves the linearized 0.032).

### What this is not

A 2-groove fusee on a 17:1 first mesh is geometrically honest and
historically alien — real fusee watches ran MORE turns of FINER chain on
TALLER cones, and this movement's height budget cannot buy that. The owner
chose full closure with that trade named. The battery diff is the
acceptance; the fingerprint legitimately moves once (cone, chain, great
wheel, drum station, lifted stratum).

## §126 — the winding arrest: overwinding stopped by a part, and the whole winding path put on one source

Roadmap §47. Winding the going mainspring past full is prevented by metal
now: the chain's last coil lifts a sprung finger, its beak drops in front
of a lug turning with the fusee, and the bank in `tick()` saturates
because of that contact. The numeric clamp is gone from the wind branch —
`RESERVE_BARREL_TURNS` does not appear in it — and the cap is a
consequence.

**What the survey found, and why it reshaped the entry.** The filing
predicted a clamp; the tree had a clamp AND a torn mesh. The winding path
was split across two accumulators — `windPathRot` raw, `windAccumTurns`
banked — so past full wind the crown wheel and transfer wheel kept turning
against a frozen spur, sliding teeth through teeth (~12 turns per press of
a Wind button that queued 16 turns against a 5.25-turn wind). The same
mesh tore the other way round during run-down, slowly, with no winding at
all: the spur rides the arbor, and the crown wheel stood still. Both close
the same way — the §104 alarm convention applied to the going crown, every
wheel posed from `barrelWindTurns` through the real tooth counts, with only
the free stem carrying raw input (plus `windStemSlip`, the rotation the
wheel never sees).

**The drain sync was a prerequisite, not adjacent debt.** The drain
removed one barrel turn per 8 h — the pre-§124 mesh ratio hard-coded —
while the train turned the cone once per `HOURS_PER_FUSEE_TURN` (120/7 h).
The reserve readout promised 30.0 h and the movement ran ~14, and the
chain slipped ~1.14 turns per cone turn on the way down. With the two rates
identical the cone's WORLD angle is a pure function of the bank
(`windLocalAt`), so full wind is ONE fixed azimuth forever — which is what
lets the lug's clocking be a construction rather than a calibration.
`windAccumTurns` then stopped being state at all: the chain cannot slip, so
the cone's angle derives, and the reload phase-snap the entry filed died by
construction rather than by a new save field.

**The arrest, as built.** A finger on a stud hung from the three-quarter
plate's underside (§29's lug idiom inverted). Its pad is the arm's own end,
at the arm's band — the wrap climbs 1.389 in z per turn, so a pad a stratum
lower sits BETWEEN turns and catches the last coil's fringe, loses it, and
re-catches; measured, that law dipped 0.44 → 0.04 → 0.40 with the beak
flapping. The pad's face leans with the wall it rides (§124's tilt) and its
contact law reads the DISCRETE layout `chainLayoutAt` bakes, because a
plate's outer edge chords between its pins and a kiss measured at
±`HANDOFF_TRACK_TOL` cannot ride a continuum that ignores it. The beak's
face is a RADIAL PLANE with a tangential normal: winding turns the cone in
−z, so the lug arrives from +θ, and a tangential reaction is the only kind
that can stop a rotating cone at all — cut perpendicular to the stud line
instead (as this first was) and the contact slides past exerting no torque,
with every collision gate green. The arm runs tangentially so the push is
compression into the pivot, and the scan holds the residual moment in the
engaging sense.

**Everything is derived, so the spec variants move it.** The engagement
turn count IS `FUSEE_WRAP_TURNS` (asserted against `RESERVE_BARREL_TURNS`
at the energy side, 1e-9); the lug rides the runout's own station; the pad
azimuth, its touch tension, the stud's outboard shove, the beak's azimuth
and the bank pin's station are all SOLVED against the chain's occupancy,
the plate's solved webs, the window's rim and the drum's coil reach — the
P3 fold spent in position space only, inside the group's own solve.

### The instruments

New unit `'Winding arrest'` with support on the three-quarter plate and a
`Chain → Winding arrest` drive LEAF (§104's precedent: an arrest consumes,
it drives nothing downstream). Three EXPECTED pairs with floors rows naming
exactly the designed contacts, the two working pairs axes-narrowed.
Wind-axis penetration budgets at `HANDOFF_TRACK_TOL`, the pad's with a
BESPOKE measure for §99's reason in a new place: MTV returns a pop-out for a
flat face bedded in a chain, and it called 0.094 of "intrusion" on a pose
with nothing inside the member. A sibling check `windArrestHandoff` — the
same instrument as the alarm rows through its own pose table (full wind =
both contacts shut, slack = both free), registered separately so the alarm
rows stay bit-identical under the report diff. Intra-unit joint rows, stock
kinds, `declareTravel`/`declareRestoring`, the §8 bank sound, a tour stop, a
schematic lever line, and five locale entries.

**And the collapse made other parts judgeable.** The crown wheel, its
companion and the transfer wheel moved on NO axis before this — the raw
accumulator was pinned 0 everywhere — so `intraUnit` could not judge them
and `restoring` could not classify them: §121's "a part no axis MOVES is a
part it cannot judge", met by parts becoming visible rather than by a
waiver. Their rigid joints on the shared arbor are declared now, and the
keyless train is declared TWO-WAY DRIVEN — the crown drives it forward, the
mainspring back-drives the same teeth through the fusee arbor as the watch
runs down.

**Debt filed, not absorbed:** the fusee-end chain hook (the support edge
claims a joint with no metal behind it), the going stem's one-way, the
setting path's un-persisted `setPathRot`, and `Chain ⇄ three-quarter plate`
at 0.117 against a 0.15 margin — the measurement §47 owed, taken, published
and under the floor.

### The accommodation, closed after the fact (TODO 51)

The entry above shipped with two `expectedContacts` rows at min 0 — the
finger's own members fouling the chain and the lug while every mechanism
gate stayed green. Closing them changed four things in this landing, and
the reason all four were needed is one finding: **the paragraph above is
right that the pad's law reads the discrete layout, and every OTHER law in
the mechanism was still reading the continuum.**

- **`ARM_STOP_R` reads the discrete links too**, and errs on a SPHERE: a
  chain point `dz` outside the arm's band demands `√(margin² − dz²)` in
  radius rather than the full margin on top of the full `dz`. It also stops
  reading the link that straddles the departure — a reach is a shell radius,
  which says nothing true about a free span crossing the same band at radii
  out to 29 (`linkOuterPtsNear` gained `wrapOnly`; the pad's law still needs
  that link and keeps it).
- **The arms are held along their whole CHORD, over their MEASURED travel.**
  A bar between two clear points dips inside the wrap by `R(1 − cos(Δaz/2))`
  plus its half-width; and the travel exceeds the designed throw, because
  the lift law is a per-interval sup and a link phase prouder than the one
  under the face at t = 1 swings the plate past `PSI_FULL`.
- **Arms stop out, tabs bridge in.** `PAD_T` and `BEAK_RAD` are the gaps
  their tabs span. The pad's lean became a SHEAR baked into the geometry —
  a rotation swings a bridging tab's corners 0.29 out of its band — with the
  pre-shear box published in `userData` so the bespoke fit measure stays
  exact about the real solid.
- **`LUG_OUTER` is derived now.** Giving the lug the chain's proudness was a
  tie to nothing that binds. What binds is the pivot: it must clear the wrap
  (`studR ≥ ARM_BAND_REACH + HUB_R`) while the beak's lever keeps its ratio
  band and an engaging reaction, and those two are compatible only for
  `Rs ≤ √(Rb² + L_max²)`. At the chain's proudness that ceiling was 4.79
  against a floor of 4.98 — empty at every legal pad azimuth (both bounds are
  radii at the same point, so turning the mechanism about the cone cannot open
  them), which is why clearing the pivot honestly kept costing the beak scan
  its candidate. The
  lug is sized by inverting it, and built to the greater of that and the
  chain's.

The azimuth solve RANKS its candidates now and carries each through the
whole finger solve until one yields a legal beak, so the stud, the arms, the
tabs and the beak are chosen together instead of in sequence — which is the
shape the debt entry asked for. What that bought is recorded honestly in
TODO 51: the surviving beak window is two scan steps wide, and the scan
publishes a per-step trace of why it rejected each azimuth so the next
person to move `ARM_BAND_REACH`, `HUB_R` or the lug's station can see it
close.

## §127 — the battery's partition atom becomes a TASK: `inspection` splits along its axis loop, and the sweeps stop inheriting each other's poses

**Roadmap §127, tiers 0 and 1, plus the free win it insisted came first.**
§81 sharded the battery across browser contexts by a measured cost column, and
wrote down what that could not buy: "K > 2 cannot go below the slowest single
check, because no check is subdivided." §82 took `sweptOverlap` out of the
dominant slot and `inspection` walked straight into it — §108 measured it at
36% of all check time and named it the shard floor. This entry subdivides it.

### What the floor actually was, measured on the landing container

A full green baseline on a 4-vCPU container (the same shape as
`ubuntu-latest`), before any of this landed — 21/21 gates, 2029.1 s of check
time, 1258.0 s wall across 2 shards:

| check | wall | note |
|---|---|---|
| `inspection` | 762.2 s | the floor |
| `clearances` | 545.1 s | |
| `expectedContacts` | 388.5 s | |
| `sweptOverlap` | 259.8 s | post-§82 |
| the eleven others together | 73.5 s | |

Two things fall straight out of that table, and the entry's own order of work
came from them. **The shipped cost column was stale** — it read 991/744/428/410
against these — and a stale column costs wall clock (§81's rule). Re-running
the same LPT partition on the measured numbers gives 1021.9 s at K=2 and
**762.2 s at K=3, which is `inspection` alone**: the floor, reached with no
code at all. Only then is subdivision worth anything, and what it is worth is
**676.7 s at K=3 and 545.1 s at K=4** — where the floor becomes `clearances`,
exactly as the entry predicted. That is the honest size of this change on one
runner, and it is written here because the roadmap entry led with it rather
than discovering it at the end.

### TODO 54 first, because the split is illegal without it

A slice runs in its own browser context and starts from `resetInputs()`, so it
can only reproduce a whole run if entering an axis lands that axis's poses
whatever ran before. It did not. `setPose` assigns ONLY the keys a pose object
NAMES; six of the eleven axes name four of the twelve it accepts; and no sweep
reset between axes. Every sweep's coverage was a function of `AXES`'
declaration order — `handSet`'s `setPathRot` rode into all four alarm axes, and
`alarmToggle` swept the parity with the alarm barrel at full inherited wind.

`enterAxis(clock)` is the guarantee, called at the top of every axis by all
five sweeps that walk `AXES`. **It is a canonical entry and not the "total pose"
TODO 54 prescribed**, and the three reasons that fix does not hold are recorded
in that item and beside `enterAxis` — the alarm writers overlap and would fight
a base pose, a base `alarmBarrelWind` silently re-means the strike axis, and no
pose object can zero `alarmColSteps`, whose count decides the column wheel's
angle. `resetInputs` is the exact statement of canonical, and it is the same
call `fingerprintBoxes` already made before every pose it hashes.

`checkAxisEntry` (battery check `axisEntry`, 2.2 s) holds both halves over all
220 ordered axis pairs: **gated**, entry reproduces the entered axis exactly;
**reported**, what rides through without it. That report is the measurement
TODO 54 filed as missing — **106 of the 220 hand-offs moved geometry**, worst
`Alarm disc` by 17.7, `Hour wheel` 7.917, `Alarm crown` 5.0. Reachable poses,
but undeclared ones, and not small.

### The split, and the three gates that hold it up

`BATTERY`'s rows may declare `slices`; `buildTasks` turns a sliced row into one
task per axis and the LPT partition balances TASKS. The gates, the canonical
report order and the report's keys are untouched: `checks.inspection` still
holds one payload, so a `--report` diff against a base stays a value diff.
`--no-split` runs the checks whole and is the reference the split must agree
with, for the same reason `--shards 1` is kept.

Three failures of a partition look exactly like a healthy smaller run, so each
is a gate rather than a convention:

- **the declared slice list must BE the page's axis roster** (read from
  `window.__I.AXES`, with each slice's pose count checked against `n + 1`) — an
  axis added to `inspect.js` and not sliced here would silently never be swept;
- **every slice must produce a payload** before the merge runs — a dead shard
  would otherwise union into a clean report of work that did not happen;
- **the merged payload is byte-identical to a whole run's.** `mergeInspection`
  rebuilds rather than concatenates: union by pair, key ORDER restored to
  `AXES` order (it is part of the payload), `summary` re-derived because a
  slice's own summary quotes only its axis, census counters summed, and the
  `units` list asserted equal across slices — the one disagreement a union
  would happily paper over.

The merge lives in `tools/battery-split.mjs` rather than inside the harness so
it can be exercised without a full battery: `tools/probe-127-split.mjs` proves
the identity on a two-axis sweep in about a minute, which is the loop to use
while iterating on any of this.

### What moved, derived row by row

Tier 0 changes which poses the sweeps visit, so it was landed as a report move
and accepted the way the repo accepts one: a `--report` diff against a green
baseline on the same container, with every moved row explained. **Six of
fifteen checks moved. Every GATE INPUT is byte-identical** — 0 rows before and
after in all six — so the movement is entirely in reported detail.

**`inspection` — the movement is a coverage GAIN, and it is the point.** No
pair was lost, no pair changed class, 74 of 78 shared pairs kept identical
per-axis hit lists. What changed:

- **`Alarm disc ⇄ Hour wheel` appears** (EXPECTED; `alarmStrike` 110/110 poses,
  `alarmToggle` 23/49). The disc follows the hour wheel when DISARMED — §25 C's
  own behaviour. `alarmStrike` had been inheriting a turned `alarmCrownRotation`
  from the `alarm` axis, so the disc sat somewhere else for that whole axis and
  the sweep never saw the two touch.
- **`Alarm crown ⇄ Alarm winding train` on `alarmStrike`: 0 → 110 poses.** The
  same inheritance carried `alarmCrownPullT: 1` — the crown PULLED OUT to the
  setting position, where it is disengaged from the winding train by design. The
  strike axis had been swept with the alarm crown pulled, which nothing declared
  and which hid a declared mesh across the entire axis.
- Two rows gain a single pose on `alarmWind` (`Alarm release feeler` and `Dial`,
  both against `Alarm winding train`), and `Alarm barrel ⇄ Alarm click` keeps
  its 82 poses at different fractions.

**The other five are reported detail, itemised.** `assembly`: one of 23
out-of-scope rows, `Dial` 45 → 44 rigid bodies with its separation 0.0029 →
0.005 — the clustering finds one less fragment, and the row does not gate.
`intraUnit`: a single `at` label, `train f=0.5` → `train f=0.25` — same row,
same verdict, extremum at a different pose. `expectedContacts`: two `at`
labels. `clearances`: `verdictCalls` 0 → 1, with all 30 budget values
unchanged. `sweptOverlap`: counters by 0.03% and one `f` label — it moves at
all because its CONFIRM tier re-measures through `measureClearance`, which is
`sweepClearances`, so it inherits canonical entry even though the registry and
hull phase are untouched. Five checks are entered; six can move.

**And the work did not grow.** `inspection`'s census moved −0.3% on exact
calls, −0.2% on AABB tests, 0.0% on unit-pair tests, for 762.2 s → 767.0 s
(+0.6%). That matters for reading the other checks' times in the same pair of
runs, which moved +8.8% to +15.5% while their own work counters moved under
0.5% — that spread is the container, not this change, and it is exactly why
the `cost` column is only ever used to balance shards and never to judge one.

### What it bought, and the identity that made it acceptable

**The split is report-neutral, measured at full scale.** `--no-split --shards 2`
against the default split run at `--shards 3`: **every check identical except
wall-clock fields** — `inspection`'s merged payload byte-for-byte, and the only
lines that differ anywhere are `sweptOverlap`'s six timing fields (`exactMs`,
`hullMs`, `confirmMs` and friends), which live outside `census` and are wall
clock by nature. Nothing else — no row, no value, no counter — moved. That one
diff proves both invariants at once: the partition's finer atom does not change
a report (§127), and neither does the shard count at a K nothing had run before
(§81's rule).

**The wall, on the landing container:** 1258.0 s → **846.9 s**, a 32.7% cut,
with check time essentially flat (2029.1 s → 2083.1 s, container noise). 24/24
gates, fingerprint unchanged, three shards at ~11 min each against the old
19/13 split.

**And the seeds were replaced by measurement, which is the part worth keeping.**
The pose-count projection erred **−25% to +44%** and mis-ranked the column:
`wind` projected 349.1 s and measured 261.7 s, `train` projected 47.0 s and
measured 66.6 s. Per-pose cost is dominated by how many pair candidates survive
the broad phase at that pose, and that is not a function of pose count. Both
numbers are kept in `INSPECTION_SLICES` so a later axis gets the same rough seed
and the same correction — what the pair does not allow is keeping a projection
while believing it was measured.

**Where the floor is now, measured rather than projected.** With real slice
costs the partition walls at 694.6 s (K=3) and 552.6 s (K=4), and K=5 buys
nothing: the largest single task is **`clearances` at 552.6 s**, then
`expectedContacts` 379.0, `sweptOverlap` 279.0, and only then `inspection`'s
`wind` slice at 261.7. `inspection` is out of the floor entirely — which is
where roadmap §127's remainder now points, and it names why those three are not
a copy of this work: their rows are extrema, so a merge is a per-row minimum
that must carry which slice won.

### What CI said, and the §81 claim it falsified

The first CI run of the split harness passed 24/24 on ubuntu-latest with three
virgin boots silent and the fingerprint deterministic — including both new
slice gates and `axisEntry`, whose leak report reproduced the dev container's
numbers exactly (106 of 220 pairs, `Alarm disc` 17.7). Three browser contexts
on a 7 GB runner with SwiftShader neither OOM'd nor dropped a shard.

**It did not establish the wall improvement, and one run cannot.** Against
`main`'s own run of the previous commit: 21/21 gates, 1276.0 s wall, 2066.2 s
of check time on two shards; the split run was 24/24, 1474.8 s wall, **3627.9 s
of check time** on three. Check time rose 75.6% while the same tree's local runs
held flat at +2.7%, and the two jobs ran on different runners — which is the
1.66x same-tree spread this harness's header already documents, arriving again.
The honest reading is that CI proves the split WORKS there and says nothing yet
about what it saves there.

**And it falsified a claim §81 left behind.** That entry wrote that CI's
absolute times do not matter because "the partition is decided by RATIOS
between checks, which are stable." Measured per task, CI against the landing
container, the ratio spreads **1.14x to 2.69x** — a 2.4x spread in the ratio
itself, with `expectedContacts` at 2.14x and `sweptOverlap` at 1.31x, so even
their relative ORDER differs between the machines. These checks are not one
workload: BVH tri-tri work, raycast arbitration and matrix walks in different
mixtures do not scale alike across a runner's cache and clock.

The cost is bounded — that run's partition landed 1329.4 s against an ideal
three-way split of 1209.3 s, 9.9% over — and it is wall clock, never a verdict.
The conclusion is recorded in the column's own comment: the answer is not a
CI-derived column, which would be equally wrong on the next runner, but MORE
AND SMALLER TASKS, so that any single mis-estimate costs less. Which is another
argument for the remainder in roadmap §127.

### K=4, measured as a controlled A/B rather than argued

The shard default landed at 3 on arithmetic and moved to 4 on measurement. The
open question was contention — four single-threaded pages plus the harness and
`dev_server.py` on four vCPU — and CI cannot answer it, because there runner
speed and contention are confounded in one number. So it was run as an A/B on
one container, K=3 then K=4, same tree:

| | K=3 | K=4 | |
|---|---|---|---|
| wall | 846.9 s | **740.5 s** | −12.6% |
| check time | 2083.1 s | 2338.6 s | **+12.3%** |

**The fourth shard buys 106 s of wall by burning 255 s of extra CPU**, and that
trade is taken on purpose: CI bills wall clock and the job cap is a wall-clock
cap. The contention is real but not uniform — `equalisation` inflates 40%,
`clearances` 16%, `inspection` 14%, `sweptOverlap` only 3% — which is the
signature of oversubscription rather than one saturated resource.

**And then CI refused it.** The default went to 4 on that A/B and came back to
3 on the runner's own measurement, which is the more useful of the two results:

| | wall | check time |
|---|---|---|
| K=3, CI run 1 | 1474.8 s | 3627.9 s |
| K=3, CI run 2 | 1483.7 s | 3695.6 s |
| **K=4, CI** | **1515.2 s** | **4713.1 s** |

Contention on ubuntu-latest is **+28.7%** against the K=3 mean — more than
double the +12.3% the dev container showed — and it eats the whole gain: the
wall comes out **2.4% WORSE** while burning ~1000 s more CPU. Four
single-threaded pages plus the harness, `dev_server.py` and SwiftShader's
software rasteriser do not fit on that runner's four vCPU the way they fit on a
dev container's.

**That is the cost column's lesson again, in a second currency.** The per-check
RATIOS differ 1.14×–2.69× between these two machines; the CONTENTION
COEFFICIENT differs by 2.3×. A local A/B can establish that a partition change
is SOUND — the report is identical, nothing broke — but it cannot establish
what the change is WORTH on the runner, and here it predicted the wrong sign.
Both findings are kept in the source rather than silently corrected, because
the next person tuning this will have exactly one machine in front of them.

**K=5 was refused by arithmetic before CI ever ran, and would be regardless.**
The largest single task (`clearances`, 552.6 s) sits just under an ideal 4-way
split of 584.7 s, so another shard cannot go below the task it cannot
subdivide. The way past K=3 is not more shards — it is slicing `clearances`,
which is exactly the remainder in roadmap §127.

The K=4 run also re-proved the invariant a third time: its report is identical
to the K=3 run's except the same six `sweptOverlap` timing fields. The battery's
payload is now known unchanged at one, two, three and four shards.

Two CI runs at K=3 bracket the local numbers and agree with each other far more
closely than this harness's documented 1.66x same-tree spread would predict —
1474.8 s and 1483.7 s wall, 3627.9 s and 3695.6 s of check time. That is two
points, not a tail, and the guards still wait for more.
