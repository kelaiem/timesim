# Communicating with the owner

How an agent writes to the owner of this project: how much detail, which words
get explained, and how a decision is laid out. It governs **messages to the
owner** (chat replies, questions, the summary at the top of a pull request).
It does not change how source comments, `docs/built/`, `TODO.md` or commit
messages are written; those keep the repository's own conventions.

The aim is not to simplify the engineering. It is to let the owner make the
decisions that are theirs, and to bring them up to speed a little with every
message, so that next month's messages can be denser than this month's.

Three pieces:

1. **The assessment** places the owner on a four-rung ladder in each of three
   subjects: watchmaking, mathematics and physics, and this code base.
2. **The reader profile** records the result and a ledger of terms. It is
   private: `docs/READER_PROFILE.md` in `kelaiem/timesim-roadmap`.
3. **The rules** below say what each rung means for a message.

An agent that cannot read the profile (the roadmap repository is not in its
session) writes at the **defaults** in the last section.

---

## 1. The ladders

Each subject has four rungs. A rung is "the densest sentence the owner reads
comfortably without help". The message is written **at** the owner's rung, and
anything above it is unpacked.

| Rung | Watchmaking | Mathematics and physics | Code base |
|---|---|---|---|
| **1** | Plain function: what a mechanism is *for*. "The escapement lets the gear train advance one small step per swing of the balance." | Ratios and counting. "40:8 then 16:8 gives 10:1." | Results only: runs the pages, reads summaries. |
| **2** | Named parts and what each does. "The pallet fork locks the escape wheel; the balance unlocks it." | Force, torque, proportion. "Torque is force times radius." | The map: knows the main files and that the battery is the set of checks a change must pass. |
| **3** | Mechanism roles and why they exist. "The fusee equalises mainspring torque." | Formulas read directly. "Stress is M·a/I, so it scales with thickness and not width." | The tables: reads a `MECH_GRAPH` or `LINE_SPECS` row and knows which gate reads it. |
| **4** | Design reasoning between alternatives. "Concentric lock arcs remove recoil; draw holds the fork to its banking." | Methods. "Step the equation of motion; integrate by Gauss–Legendre." | The machinery: pose nets, digests, incremental runs; could write a probe. |

What a rung changes in a message:

- **At or below the owner's rung:** write it straight, no explanation.
- **One rung above:** allowed, and wanted, but every new term carries an inline
  definition and every formula is said in words first (section 3).
- **Two or more rungs above:** it does not go in the main message. Either
  translate it down, or put it under a closing "Detail" heading the owner can
  skip (section 5).

---

## 2. The assessment

Three parts. Part A is quick and is what places the owner. Parts B and C
refine the placement and seed the term ledger; an agent runs them when the
owner asks ("run the assessment"), three questions at a time, never as a wall.

### Part A: placement

For each subject, show the four example sentences from the table above and ask
which is the densest one the owner reads comfortably. That rung is the level.

### Part B: check questions

Each question is answered in a sentence or two, in the owner's own words. The
level is the **highest rung where two of its three questions are answered**
with the idea intact; exact vocabulary does not matter. A wrong answer is
useful: it names the next thing to teach.

**Watchmaking**

| Rung | Question | The idea being listened for |
|---|---|---|
| 1 | What would happen to a watch with a spring and gears but no escapement? | It would unwind in seconds; something must meter the energy out. |
| 1 | Why does a watch have several gears between the spring and the hands rather than one? | To turn a few slow strong turns into many fast weak ones (and to give hands at different speeds). |
| 1 | What does winding the crown actually store, and where? | Energy, in a coiled spring. |
| 2 | Name the part that swings back and forth, and the part that pulls it back to centre. | The balance wheel and the hairspring. |
| 2 | What is an arbor, and what is a pivot? | The shaft a wheel sits on; its thin ends that turn in the bearings. |
| 2 | What does a click (or pawl) do on a ratchet wheel? | Lets it turn one way only. |
| 3 | A mainspring pulls hardest when fully wound. What does the fusee do about that? | A cone: the chain pulls on a small radius when the spring is strong and a large one when it is weak, so the delivered turning force stays level. |
| 3 | Why does a fusee watch need "maintaining power"? | Winding turns the fusee backwards, which would take the drive off the train; a small spring keeps it driven meanwhile. |
| 3 | What is the difference between the going train and the motion works? | One carries power to the escapement; the other gears the minute hand down to the hour hand. |
| 4 | Why does a recoil escapement disturb the rate more than a dead-beat? | The wheel is pushed backwards during part of each swing, so the push depends on drive force. |
| 4 | What is "draw", and what goes wrong without it? | The angle that pulls the fork against its stop; without it a shock can unlock the wheel at the wrong time. |
| 4 | Why is a heavier balance not simply better? | It needs more energy per swing and may not start itself; it trades stability against the power available. |

**Mathematics and physics**

| Rung | Question | The idea being listened for |
|---|---|---|
| 1 | A 40-tooth wheel drives an 8-tooth one. How many turns does the small one make per turn of the large? | 5. |
| 1 | Two such stages in a row give what overall? | 25: ratios multiply. |
| 1 | If the small wheel turns clockwise, which way does the large one turn? | The other way; each mesh reverses direction. |
| 2 | The same push on a spanner twice as long does what to the turning effect? | Doubles it: torque is force times distance from the centre. |
| 2 | Through a 5:1 step-up gear pair, speed goes up five times. What happens to torque? | It drops to a fifth (less friction losses). |
| 2 | A spring twice as stiff, stretched the same amount, pulls how hard? | Twice as hard: force is proportional to stretch. |
| 3 | A swinging wheel's period goes as the square root of (inertia / spring stiffness). To double the period by changing only the spring, what must the stiffness become? | A quarter. |
| 3 | A flat strip twice as thick is how many times stiffer in bending? | Eight: stiffness goes with thickness cubed. |
| 3 | Energy stored in a spring goes with the square of the wind angle. Half-wound, how much of the energy is left? | A quarter. |
| 4 | What does it mean to "step an equation of motion in time", and why would the step size matter? | Advance position and speed by small increments from the forces; too large a step gives wrong or unstable answers. |
| 4 | Why solve for a dimension (bisection, a search) instead of using a formula? | No closed formula exists; you try values until the constraint is met. |
| 4 | What is a tolerance band, and why quote three corners (favourable, nominal, adverse) instead of one number? | An uncertain quantity is a range; a design must work at the worst end, not just the middle. |

**Code base**

| Rung | Question | The idea being listened for |
|---|---|---|
| 1 | Name two of the pages the project serves and what each shows. | For example the simulator, the explainer, the LEGO page. |
| 1 | What does it mean when a pull request's checks are green? | The automated tests passed on that version. |
| 1 | What is the difference between `TODO.md` and the backlog? | Honesty fixes to what exists, against new features. |
| 2 | What is "the battery"? | The full set of inspection checks every change must pass before it lands. |
| 2 | What does "boot is silent" mean? | The build prints no warnings; a warning means something regressed. |
| 2 | What does "derived, not typed" mean for a number in the source? | It is computed from a stated constraint instead of chosen because it looked right. |
| 3 | What does a `MECH_GRAPH` row declare? | What supports a part and what drives it. |
| 3 | What is a waiver, and what must it cite? | Accepted debt on a check; a `TODO` item with a fix path. |
| 3 | What is a line spec, and what is a fork of one? | The reference numbers of a mechanism designed in a straight line; a declared, justified change to its inputs when it is folded into the watch. |
| 4 | Why can a check be skipped on an incremental run, and when can it not? | Its inputs (geometry, poses, check code) did not change; any doubt runs it whole. |
| 4 | What is a control in a probe, and why does a clean result without one mean nothing? | A known-bad case the instrument must catch; without it "0 violations" may be measuring nothing. |
| 4 | What is the difference between *modelled* and *simulated*? | Described, against driven by cause and effect through the drive edges. |

### Part C: term check

Show a dozen terms from the area the next piece of work touches and ask which
the owner would want defined. Every ticked term enters the ledger as `new`;
every unticked one as `known`. This is the cheapest part and the most useful
before a long piece of work. Pick the terms from the work, not from a fixed
list; `explain.html`'s Vocabulary block and `primer.html` are the source for
watch terms.

### When to re-run

- The owner asks.
- The owner uses, correctly and unprompted, terms a rung above their level
  several times in one conversation: offer Part A for that subject.
- The owner asks "what is X" about something written at their rung: lower the
  term (not the rung) in the ledger.

The levels move one subject at a time. Being rung 3 in mathematics does not
make a watch term self-explanatory.

---

## 3. Words: inline definitions

**Define a term where it is used, in the same sentence, in plain words.** Not
in a glossary at the end, and not by linking away.

> The spring sits in an **annulus** (a flat ring: the space between two circles
> that share a centre, like a washer) between the arbor and the barrel wall.

Rules:

1. **Format.** The term in bold, then a parenthesis of about fifteen words or
   fewer. Prefer a physical likeness (a washer, a bicycle chain, a door latch)
   to a formal definition. Then carry on using the proper term: the point is
   to teach the word, not to avoid it.
2. **When.** Any term above the owner's rung in its subject, any term marked
   `new` or `seen` in the ledger, and any word that is ordinary English but
   means something specific here (see the list below). Once per message, at
   first use.
3. **Repository names come second.** Say the plain thing first and give the
   identifier after it, in code type: "the table of parts and what drives each
   one (`MECH_GRAPH`)". An identifier alone is never the explanation. A `§`
   or `TODO` number is always accompanied by what it was: "the dead-beat
   study (§323)".
4. **Formulas are said in words first**, then written, then applied to this
   part with one number: "Stiffness in bending goes with the cube of the
   thickness (k ∝ t³), so the strip at 0.12 instead of 0.10 is about 1.7 times
   stiffer."
5. **A budget of new terms.** No more than about four newly defined terms in
   one message. If a message needs more, it is carrying too much: split it, or
   move the rest under "Detail".
6. **One stretch per message.** Each substantial message deliberately includes
   one idea a rung above the owner's level, defined and tied to the decision
   at hand. That is how the level rises. More than one and the message becomes
   a lesson instead of a report.

**Ordinary words with a special meaning here.** These read as plain English
and are not; define them like any other term until the ledger says otherwise.

| Word | Means here |
|---|---|
| modelled | Described: the geometry and numbers exist. Claims nothing about behaviour. |
| simulated | Driven: the behaviour arrives by cause and effect from an input. |
| posed | Placed at a position by the program, not pushed there by another part. |
| derived | Computed from a stated constraint, the opposite of typed in. |
| gate | A check that blocks a change from landing when it fails. |
| report | A check that prints a result but blocks nothing. |
| waiver | A known failure that is accepted for now, pointing at the item that will fix it. |
| landing | One shipped step of a larger piece of work. |
| fold | Packaging a mechanism designed in a straight line into the watch's real space. |
| fork | A declared, justified variation of a reference design. |
| budget, envelope | An allowed range for a quantity (a clearance, a force). |
| honest, lying | Whether what is shown matches how a real watch would do it. |

### The ledger

Agents do not remember earlier conversations, so the memory is a file: the
term ledger in the reader profile. Each term has one of three states.

| State | Meaning | How it is written |
|---|---|---|
| `new` | Not yet met, or asked about. | Full inline definition every message. |
| `seen` | Defined a few times, not yet used by the owner. | A two- or three-word reminder: "the annulus (ring)". |
| `known` | The owner uses it, or said so. | No definition. |

A term moves `new` → `seen` after it has been defined in three separate
conversations, and to `known` when the owner uses it correctly or says "I know
that one". It moves back to `new` the moment the owner asks what it means. An
agent that changed any state, or introduced a term, updates the ledger before
it finishes, in the same pull request as its other roadmap edits or in one of
its own.

---

## 4. Grounding: why this is coming up

No design choice, workaround or request is presented bare. Each one is tied
to the larger thing it serves, in this order:

1. **The goal.** What the work is trying to achieve, in one plain sentence.
2. **The constraint.** What rule or physical fact stands in the way.
3. **The consequence.** What breaks, concretely, without the workaround.

The sentence shape, which may be used word for word:

> This is needed because without it we would break **[the constraint]**, which
> exists so that **[what it protects]**. The cost is **[what we give up]**.

An illustration (invented for this guide, not a change that was made). Instead
of "added an idler at the third stage":

> The alarm's push rod now takes a detour through one extra small wheel (an
> **idler**: a gear that only passes motion along and changes nothing about
> speed). This is needed because without it the rod would pass through the
> space the hammer swings in, and the rule is that a part which only passes
> motion along moves aside for a part that does the work. The cost is one more
> part to make and one more place for friction.

### Hard and soft constraints

Every constraint named in a message says which kind it is.

- **Hard**: the change cannot ship while this is broken. No trade is on offer;
  the only question is how to satisfy it. In this repository these are the
  standing rules and the inspection gates: the mechanism must really transmit
  motion through closed contacts, parts must be strong enough to exist, parts
  must not pass through each other, and a force budget inherited from a
  reference design is never loosened.
- **Soft**: a preference, ranked against other preferences, that may be traded
  with a reason. Finish and appearance, part count, case size, build time,
  reusing a preferred pattern, the cost of the work.

`CLAUDE.md`'s design priority (P0 to P4) is the current ranking: mechanical
truth, then structural truth, then the mechanism agreeing with itself, then
fitting the watch, then finish. The first four are hard for landing; they also
rank against each other when a design must choose (a packaging problem is
never paid for by weakening the mechanism). A separate piece of work is
producing a consolidated, prioritised list of hard and soft constraints. When
it lands, a message cites a constraint by that list's name and rank instead of
describing it afresh, and this section is trimmed to a pointer.

A message never asks the owner to decide whether to break a hard constraint.
It may ask which soft constraint gives way.

---

## 5. Decisions: options and their bottom line

When the owner has a choice to make, the message is laid out in this order.
The first two items must stand alone: the owner should be able to answer after
reading only those.

1. **The decision**, as one question in plain words.
2. **The recommendation**, and the one-sentence reason.
3. **Why it is coming up**: section 4's goal, constraint, consequence.
4. **The options**, two to four, each rated on the same four yardsticks.
5. **Detail** (optional, skippable): the real identifiers, numbers and file
   names for a reader who wants them.

### The four yardsticks

Every option is rated on all four, in this order, in plain words. An option
with a blank is not ready to be offered.

| Yardstick | The question it answers |
|---|---|
| **The watch** | Does it stay true to how a real mechanism works? Is anything now shown that could not be built, or claimed that is not driven? What would the owner *see* differently? |
| **The cost** | How much work, in landings or days, and how much waiting on checks? Is it paid once or on every future change? |
| **The risk** | Which hard constraints does it come near, what could it disturb elsewhere, and can it be undone? |
| **The future** | What does it make easier or harder next? Does it create something reusable, or use up room, or close a door? |

State quantities where they exist ("about two landings", "adds 3 parts",
"moves the case from 42 to 44 wide"). Where a figure is a guess, say it is a
guess. Do not describe an option only by its mechanism; "uses a contrate
wheel" is not a bottom line.

### Preferred patterns

A **preferred pattern** is a mechanism design that has been proven here and is
worth protecting: its proportions, its parts and its measured behaviour, kept
as a named reference so the next mechanism that needs the same job reuses it
instead of inventing a variant.

The toolbox of patterns is a proposal, not yet built (the worked example below
is the decision that would start it). Two things already behave like it:

- On the steel watch, the **reference specifications** (`LINE_SPECS`): each
  records a mechanism designed in a straight line, and the check fails when
  the packaged version drifts from it.
- On the LEGO build, mechanisms that have already been reused. The detent (a
  spring-loaded catch that holds a wheel at fixed stops) built from a half
  bush on a thin liftarm held by a rubber band appears in both the keyless
  works and the alarm's column wheel.

Presentation rules that apply now, and more strongly once a toolbox exists:

- When one option reuses a proven design, it is listed **first** and labelled
  "reuses [name]".
- An option that departs from a proven design says what the departure costs
  under **The future**: a second design to maintain, a second set of checks.
- Reusing a pattern is a **soft** constraint. It gives way to any hard one,
  and to a stated reason.
- **Only the owner promotes a design to preferred.** An agent may propose
  one, with where it is already used; it never labels one preferred itself.
- **The point of a pattern is that a problem is solved once.** Patterns are
  kept in families, one per job. When the preferred design does not fit, the
  options are offered in this order: use it as it is; use it with declared
  changes; adapt the family by adding a variant others can reuse; and only
  for a job no family covers, a new design. An option that solves a covered
  job with an unrelated design must say why no member of the family could
  serve.

### Worked example

> **Decision:** should we start keeping a toolbox of preferred patterns, and
> where?
>
> **Recommendation:** yes, starting with the LEGO build, as a small table of
> three or four mechanisms that are already reused. It is cheap there and
> tells us whether the idea earns its keep before touching the steel watch.
>
> **Why it is coming up:** the goal is that a new mechanism is assembled from
> proven pieces where possible. Nothing today stops an agent designing a
> second, slightly different catch or ratchet when a proven one exists (soft
> constraint: reuse; it is currently unwritten, so it is not weighed at all).
> Without a toolbox each variant brings its own checks and its own ways to be
> wrong.
>
> | | A. LEGO first (reuses the existing detent and pawl designs) | B. Steel watch first | C. Both at once | D. Not now |
> |---|---|---|---|---|
> | **The watch** | No change to what is shown. | No change to what is shown. | No change. | No change. |
> | **The cost** | Small: about one landing. The parts are catalogue parts, so a pattern is a short list. | Larger: steel parts are cut to fit their place, so "the same design" needs a definition first. | The sum, plus keeping the two in step. | None now. |
> | **The risk** | Low. LEGO pages are display only; the main checks never see them. | Medium: touches the tables the inspection reads. | Medium. | Variants keep accumulating. |
> | **The future** | New LEGO cells are built from named pieces; gives a tested shape for the steel version. | Biggest eventual payoff, but designed without a trial run. | Fastest to full coverage. | Each later mechanism is harder to make consistent. |
>
> **Detail:** the LEGO candidates are the banded half-bush detent
> (`KEYLESS_DETENT` in `src/technic-frame.js`, and the column wheel's in
> `src/technic-alarm.js`), the
> keyed 8-tooth pawl on a thin liftarm (`pawlLock` in `src/technic-fusee.js`)
> and the half-stud adapter (`src/technic-clock.js`). The steel counterpart is
> `LINE_SPECS` in `src/inspect.js`.

---

## 6. Shape of a message

- **Lead with the outcome.** What happened or what is needed, in the first two
  sentences, in plain words. Then the reasoning.
- **Report states, not diary.** What is true now, what is left, what the owner
  must decide. Not the sequence of things tried.
- **Numbers carry their meaning.** "0.039 of clearance" is followed by what
  that is like: "about a third of a hair; too little to rely on".
- **Say what was and was not checked**, plainly, and where. "The inspection
  checks passed on my machine; the hosted run has not finished."
- **Keep the honesty words exact** even when simplifying. A simpler sentence
  may leave detail out; it may not turn *modelled* into *simulated* or
  *posed* into *driven*.
- **Length.** A routine report fits on a phone screen or two. A decision is
  allowed to be longer, but its first two items still stand alone.
- **A pull request body** follows `.github/pull_request_template.md` as
  before. What this guide adds is a short plain-language paragraph at the very
  top, written to these rules, saying what changed for the watch and why.

---

## 7. Defaults, when the profile cannot be read

Write for rung 1 in watchmaking, rung 2 in mathematics and physics, and rung 1
in the code base; treat every watch term and every repository identifier as
`new`. These are deliberately the cautious end: an unneeded definition costs
the owner four seconds, a missing one costs the message.
