// §310 — THE CASE SHAPE'S RELOAD, one copy for the two selects that offer it:
// the panel's Appearance row (main.js) and the boot screen's (index.html),
// which runs before layout.js has loaded and so cannot ask configKey itself.
//
// A form case is cut to the movement's FITTED outline (§308), which a first
// boot only prints, so the reload carries the fit along: the generated gong
// seat's own ?formrect= (src/gong-seats.js), the fit that seat holds at. The
// seat was solved at one spec, so whether that fit applies is the CALLER's
// question (`fits(seat)`): the panel compares the seat's specKey with the live
// configKey, the boot screen asks whether the URL carries any other
// geometry-tier knob. A kind with no seat row, or a seat that does not fit,
// reloads unfitted and the boot prints the formrect= to carry (§307's
// first-boot path). Round drops every form key, ?gong= with it.
import { GONG_SEATS } from './gong-seats.js';

// §317 — A KIND'S DEFAULT SEAT. §314 made the spiral every form case's default;
// a kind whose fitted outline leaves the spiral no seat the lever reaches (the
// fitted tonneau: tools/gong-seats.mjs measured none, the case stretched 8 u lug
// to lug included) takes its BAR, the alternative seat, rather than no seat at
// all. Read off the generated table — whichever rows the tool wrote — so a kind
// whose spiral closes later takes it with no code change. `seats` is the table
// the caller reads (the designed movement's or an arrangement's).
export function defaultSeatMode(seats, kind) {
  return seats?.[kind]?.spiral || !seats?.[kind]?.bar ? 'spiral' : 'bar';
}

export function caseShapeSearch(search, kind, fits) {
  const p = new URLSearchParams(search);
  p.delete('formrect');
  if (!kind) { p.delete('case'); p.delete('gong'); return p.toString(); }
  p.set('case', kind);
  const mode = defaultSeatMode(GONG_SEATS, kind);   // §314: the spiral is the form default; §317: the bar where no spiral closes
  const seat = GONG_SEATS[kind]?.[p.get('gong') || mode] ?? GONG_SEATS[kind]?.[mode];
  if (seat && fits(seat)) p.set('formrect', seat.formrect.join(','));
  return p.toString();
}
