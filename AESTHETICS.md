# Aesthetics Configuration

The visual aesthetics of the clock have been extracted into a centralized configuration file (`src/aesthetics.json`) that can be edited without modifying code.

## What's Configurable

Only values that affect pure visual appearance (not mechanical behavior or calculations) are included:

### Dial
- **Face**: `dial.face.color` — the base tone of the dial's silvered radial gradient. The gradient's inner and outer stops are ratios to this tone (see `DIAL_TINT_RATIO_IN`/`DIAL_TINT_RATIO_OUT` in `geometry.js`), so any tone keeps the same soft vignette rather than going flat; the printed inks are SOLVED against it at paint time since §196 — the track and sub-dial print flip between a dark pole (`DIAL_TRACK_INK`) and its mirror-derived light pole (`DIAL_TRACK_INK_LIGHT`, ≈ `#eaeaea`) by whichever holds more contrast on this tone's own grounds, and the maker's mark re-solves to the shipped pair's ~2.8:1 relation from whichever side has room, so a black dial gets light print the way a real dial does. On the shipped tone every solve returns the shipped ink verbatim. **Live** since §157 — `makeDial` exposes `userData.recolourFace`, which repaints the face canvas and every sub-dial well that derives its tone from it, so the picker updates the running scene with no reload and no geometry rebuild. Each well's blend-in tone is derived from *its own* distance off centre, so moving a station (`?d4=`, `?rsvr=`) re-derives it. It carries no `_bounds` deliberately — a colour has no interval to bound; its real constraint is legibility, which is asserted instead as a contrast floor (`DIAL_INK_CONTRAST_MIN`, 3:1, WCAG 2.1 SC 1.4.11) against the printed track, at build and on every recolour. **Shareable** since §185 — it is the one finish value that travels, as `?dialcol=rrggbb`, and Copy view sets it whenever the colour differs from this file's. A link OVERRIDES a persisted local colour (§97's rule: the link and the picture must not disagree per machine) but never writes to the override store, so the recipient's own tuning is back on their next visit without the param. The contrast floor is unenforced at the link and since §196 has nothing left to catch there — the ink solve holds every face colour above it (worst pole ≈ 3.8:1), so a linked colour arrives legible and the floor's warn now flags a solve regression, not a viewer's taste.
- **Plate**: `dial.plate.sapphire` — the box sapphire dial (§3's remaining half). On, the dial's matter — the plate, its pocket walls and the sheets its print is laid on — takes the case crystal's own glass (`CRYSTAL_GLASS` in `materials.js`, corundum's ior), while the chapter ring, the applied numerals and the feet stay metal; the keyless works, motion works, reserve train and minute jumper read through the print from the front. **Reload-tier** (⟳): the materials are chosen at build and the x-ray map is built over them. Geometry is untouched, so the fingerprint is still. The print's ink is solved against the ground that actually stands behind it — the crystal's tint over the base plate's nickel, read off the materials — and the same 3:1 gate holds it. Not modelled: a box dial's raised rim, or glass depth beyond the plate's own thickness. Browser-local; it does not travel in a link.
- **Hour Markers**: Stroke width, relief depth, gap between strokes, slant proportions; `subdialMarginFactor` (clearance kept between a clipped numeral and a sub-dial rim); `weightBalanceExponent` (0 = uniform stroke width, 1 = strict equal ink per numeral — heavier numerals like VIII thin toward III's total ink); `minNumeralKeepFrac` / `minLetterKeepFrac` (how much of a numeral/letter must survive sub-dial clipping to render — at 0.3, XII and VI show as outer-half stubs)
- **Hands**: Proportions for hour, minute, and second hands (width, depth, tail, boss size)

### Lighting
- **Scene**: Background color, fog color
- **Hemisphere Light**: Sky and ground colors, intensity
- **Key Light**: Color, intensity, shadow bias
- **Fill Light**: Color, intensity
- **Dial Light**: Color, intensity
- **Rim Spot**: Color, intensity, penumbra, decay
- **Backdrop**: Color, roughness, metalness

### Materials
- **Steel finish**: `materials.steel.brush` — one slider from polished (0) to brushed (1), default brushed (§203 step 2). It reaches the works' steel and the case exterior's (`MATS.steel` and `MATS.caseMetal`, split in §203 step 1) alike. Both ends are constraints rather than tastes: at 0 the roughness sits on the renderer's own floor (0.0525 — three's shader clamps below it, so a smaller number does nothing) and the lobe is isotropic; at 1 the lobe is fully anisotropic and the across-grain roughness is the steel's authored 0.30, which is named as underived in `materials.js` rather than laundered. Between them both mix linearly. `materials.steel.brushAngleDeg` sets the straight grain's direction on FLATS (levers, springs, cocks, the bezel top — a face within cos 45° of the movement axis); everything else (arbors, pinion bodies, the band's flank, the crowns) is grained circumferentially about the movement axis, the way a lathe or a turning brush leaves it. The direction is a world-space law in the shader, never the UV tangent, because procedural geometry's UVs run wherever each builder's parametrisation runs. **Live**: the panel writes both materials with no reload, and the anisotropy define is held on across the whole range so a drag is never a shader recompile. `node tools/probe-203-brush.mjs` (a report) screenshots both ends and a turned grain and diffs them.
- **Case metal**: `materials.caseMetal.alloy` — a PICK, one of `steel` · `yellowGold18k` · `whiteGold18k` · `platinum`, default steel (§203 step 3). It reaches the case exterior only (`MATS.caseMetal`: band, back ring, stem sleeves and collars, both crowns, the pusher cap) and never the works — a spring or a pinion in gold would be a lie about the metal. Every colour but steel's is DERIVED: a metal's base colour is its normal-incidence reflectance F0, and `node tools/derive-203-alloys.mjs` integrates it from measured optical constants (refractiveindex.info's tables; Johnson & Christy for gold, silver and copper, Rakić for platinum, Weaver for rhodium) against the CIE observer, with two controls — the observer fit's integrals and Hoffman's published F0 table, which the shipping metals match to 0.06 or better. 18K white gold reads as its rhodium plate; 18K yellow is 3N (75/12.5/12.5 Au/Ag/Cu) under a named effective-medium approximation, to be replaced by ISO 8654's swatch when the standard is at hand; steel keeps its authored `#d6d9dd`, named as underived in `materials.js`. The finish slider above still governs the grain and polish of whatever metal is picked. **Live**, and it **travels**: `?metal=<key>` under §185's rule (a link overrides a persisted override, never writes it; Copy view sets it whenever the alloy differs from this file's), and the loader refuses any key outside `_options` — a retired alloy in a stale override is reported, never applied. Density is not modelled and is not claimed.
- **Ruby colour**: `materials.ruby.color` — bearing jewels, pallet stones and the impulse pin; live since §23.

### Camera & Rendering
- **Camera**: Damping factor (controls smoothness of orbit)
- **Rendering**: Tone mapping exposure

## How to Use

Edit values in `src/aesthetics.json` and reload the browser. For example:

```json
{
  "dial": {
    "hourMarkers": {
      "strokeWidthFactor": 0.14  // Increase to make markers thicker
    },
    "hands": {
      "hour": {
        "widthFactor": 0.09  // Adjust hand proportions
      }
    }
  },
  "lighting": {
    "keyLight": {
      "intensity": 2.4  // Brighten or dim the key light
    }
  }
}
```

## What's NOT Configurable

Values that are excluded because they affect mechanical calculations or create dependencies:
- Marker positioning and rotation (affects collision detection)
- Camera distance multipliers (tied to plate dimensions)
- Shadow camera bounds (tied to movement scale)
- Gear ratios and tooth spacing
- Kinematic constants

This separation ensures that tweaking the look of the clock won't break its mechanical behavior.

## Files Modified

- `src/geometry.js` - Imports aesthetics for hand and marker styling
- `src/main.js` - Imports aesthetics for lighting, rendering, and scene setup
- `src/materials.js` - Reads `materials.*` for the ruby's colour and the steel finish (its grain law lives there)
- `src/aesthetics.js` - Module that exports the aesthetics configuration
- `src/aesthetics.json` - Central configuration file with all aesthetic values
