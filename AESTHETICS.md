# Aesthetics Configuration

The visual aesthetics of the clock have been extracted into a centralized configuration file (`src/aesthetics.json`) that can be edited without modifying code.

## What's Configurable

Only values that affect pure visual appearance (not mechanical behavior or calculations) are included:

### Dial
- **Face**: `dial.face.color` — the base tone of the dial's silvered radial gradient. The gradient's inner and outer stops are ratios to this tone (see `DIAL_TINT_RATIO_IN`/`DIAL_TINT_RATIO_OUT` in `geometry.js`), so any tone keeps the same soft vignette rather than going flat; the printed minute track and maker's mark are independent, fixed ink colors and are unaffected. **Live** since §157 — `makeDial` exposes `userData.recolourFace`, which repaints the face canvas and every sub-dial well that derives its tone from it, so the picker updates the running scene with no reload and no geometry rebuild. Each well's blend-in tone is derived from *its own* distance off centre, so moving a station (`?d4=`, `?rsvr=`) re-derives it. It carries no `_bounds` deliberately — a colour has no interval to bound; its real constraint is legibility, which is asserted instead as a contrast floor (`DIAL_INK_CONTRAST_MIN`, 3:1, WCAG 2.1 SC 1.4.11) against the printed track, at build and on every recolour. **Shareable** since §185 — it is the one finish value that travels, as `?dialcol=rrggbb`, and Copy view sets it whenever the colour differs from this file's. A link OVERRIDES a persisted local colour (§97's rule: the link and the picture must not disagree per machine) but never writes to the override store, so the recipient's own tuning is back on their next visit without the param. The contrast floor is unchanged and unenforced at the link — a colour the panel allows, a link may carry, warnings and all.
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
- `src/aesthetics.js` - Module that exports the aesthetics configuration
- `src/aesthetics.json` - Central configuration file with all aesthetic values
