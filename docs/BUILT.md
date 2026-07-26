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
`?crown`, `?reserve`). No new code path — the state params go through the very
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

**A diagram, at its own scale, that says so.** The first attempt drew
the reference objects at true on-screen scale, and it does not work: a
24 mm coin against a 32 mm movement is the *same order of size*, so once
the movement fills the view the coin does too and there is nothing left
to compare against. Clamping the circles to fit was worse — it drew a
wrong-size circle labelled with a real diameter, which is exactly the
decoration §21 was written to forbid. So the comparison became an
explicit diagram: everything in it is to scale with each other, at a
scale of its own, and the caption says that out loud.

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

One trap worth recording. The first check compared the bar against the
plate's width along *world X* and reported a 28% error. The bar was
right; the check was wrong — the camera was angled, so world X is
foreshortened while the bar measures screen-right. Re-run face-on, where
world X *is* screen-right, agreement was 99.94%. A verification that
measures a different quantity than the instrument does will disagree
with a correct instrument, and it is worth being sure which one is
wrong before "fixing" anything.
