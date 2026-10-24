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

export function caseShapeSearch(search, kind, fits) {
  const p = new URLSearchParams(search);
  p.delete('formrect');
  if (!kind) { p.delete('case'); p.delete('gong'); return p.toString(); }
  p.set('case', kind);
  const seat = GONG_SEATS[kind]?.[p.get('gong') || 'bar'] ?? GONG_SEATS[kind]?.bar;
  if (seat && fits(seat)) p.set('formrect', seat.formrect.join(','));
  return p.toString();
}
