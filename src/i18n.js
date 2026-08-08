// §73 — INTERNATIONALIZATION, tier one: the chrome. English, German, Chinese.
//
// THE TABLE IS KEYED BY THE ENGLISH SOURCE STRING. The app keeps authoring
// its UI in English exactly as before; t() (and localizeTree(), which walks
// already-built DOM) resolve through this table, and a missing entry falls
// back to English VISIBLY rather than to a blank — the honest failure. The
// German column doubles as the layout stress test (strings run ~30% longer;
// the §53 240 px column is the constraint) and Chinese as the typography one
// (CJK fallback in the system-ui stack, no-space breaking).
//
// Locale resolution, in priority order (§73): ?lang= param (per-load, not
// persisted — a shared link states what the sharer saw without re-deciding
// the viewer's browser), then the Language row's localStorage choice, then
// navigator.language, then English. Resolved ONCE at import: the panel is
// built from this value and a change reloads (the §22 reload-tier precedent —
// live re-rendering every consumer would be a second rendering path to rot).
//
// OUT OF SCOPE by contract: console.warn / boot asserts (dev-facing English),
// persisted state, deep-link params and canonical state values ('Auto',
// preset names, unit names as VALUES — display is translated, state is not),
// and the dial itself (figures, not words). The reconfigure/route TRIAL
// diagnostics quote solver asserts verbatim and stay English with them —
// recorded residue, not an oversight.
const _param = new URLSearchParams(location.search).get('lang');
let _stored = null;
try { _stored = localStorage.getItem('uiLang'); } catch { /* storage may be blocked */ }
const _norm = (v) => {
  if (!v) return null;
  v = String(v).toLowerCase();
  return v.startsWith('de') ? 'de' : v.startsWith('zh') ? 'zh' : v.startsWith('en') ? 'en' : null;
};
export const UI_LANG = _norm(_param) || _norm(_stored) || _norm(navigator.language) || 'en';
// BCP 47 tag for number formatting only — never for content negotiation.
const LANG_TAG = { en: 'en-US', de: 'de-DE', zh: 'zh-CN' }[UI_LANG];
document.documentElement.lang = UI_LANG; // screen readers pick pronunciation from this

export function setUiLang(v) {
  try { localStorage.setItem('uiLang', v); } catch { /* then the choice lasts this load */ }
  // UI_LANG's resolution above puts ?lang= FIRST, ahead of this very choice —
  // right for a shared deep link (states what the sharer saw), wrong for an
  // explicit switch made while that link's param is still in the address bar:
  // a bare reload would re-resolve to the stale param and silently discard
  // the click. An explicit switch overrides it instead: only a non-default
  // locale travels (the Copy-view convention, main.js), so 'en' drops the
  // param rather than writing the default explicitly.
  const url = new URL(location.href);
  if (v === 'en') url.searchParams.delete('lang');
  else url.searchParams.set('lang', v);
  location.href = url; // navigation to the corrected URL IS the reload
}

// Display-layer number formatting (§73 coupling 5): German reads 12,5 where
// English reads 12.5. NEVER for persisted state, deep links or JSON — those
// stay '.' by contract, which is why this is a separate function and not a
// patched toFixed.
export function fmtNum(n, digits = 0) {
  return Number(n).toLocaleString(LANG_TAG, {
    minimumFractionDigits: digits, maximumFractionDigits: digits, useGrouping: false,
  });
}

// Grouped integers — the beat-rate menu's "18,000 A/h". Separate from fmtNum
// because grouping is exactly where the locales DISAGREE most dangerously:
// English "18,000" reads as eighteen in German (where ',' is the decimal
// mark), so this is a correctness fix, not a cosmetic one. Locale grouping
// gives 18.000 (de) and 18,000 (en/zh).
export function fmtInt(n) {
  return Number(n).toLocaleString(LANG_TAG, { useGrouping: true, maximumFractionDigits: 0 });
}

// ---------------------------------------------------------------------------
// German. Horological vocabulary is the Glashütte register (Unruh, Anker,
// Dreiviertelplatine …) — the audience this locale exists for.
const DE = {
  // -- state words (the data-state refactor's DISPLAY text; state itself is
  //    the attribute, so these are free to be any language)
  'On': 'Ein', 'Off': 'Aus',
  // -- panel: sections
  'Time': 'Zeit', 'Camera': 'Kamera', 'View': 'Ansicht', 'Alarm': 'Wecker',
  'Finish': 'Finissage', 'Performance': 'Leistung', 'State': 'Zustand', 'Advanced': 'Erweitert',
  // -- Time section
  'Pause': 'Pause', 'Beats': 'Halbschwingungen', 'Time-scale': 'Zeitraffer',
  'Wind': 'Aufziehen', 'Crown': 'Krone', 'Sync': 'Synchronisieren', 'Now': 'Jetzt',
  'Power reserve': 'Gangreserve', 'Fast-forward': 'Schnellvorlauf',
  'Beat rate': 'Schlagzahl', 'Reserve spec': 'Reserve-Spezifikation',
  'Spring torque': 'Federmoment', 'Train torque': 'Räderwerkmoment',
  'Pull out': 'Herausziehen', 'Push in': 'Hineindrücken',
  'Pulling…': 'Ziehen…', 'Setting…': 'Stellen…', 'Pushing in…': 'Drücken…', 'Catching up': 'Aufholen',
  'paused': 'pausiert', 'movement stopped': 'Werk angehalten',
  'fast-forward': 'Schnellvorlauf', '≈5400× — the whole reserve in ~20 s': '≈5400× — die ganze Reserve in ~20 s',
  'catching up to the wall clock': 'holt zur Wanduhr auf',
  'beats/s': 'Halbschw./s', 'slow': 'langsam',
  // -- Camera section
  'Escapement': 'Hemmung', 'Train': 'Räderwerk', 'Dial': 'Zifferblatt', 'Setting': 'Zeigerstellung', 'Free': 'Frei',
  'Guided': 'Geführt', 'Tour': 'Tour', 'Demo': 'Demo', 'Inspect': 'Inspektion',
  'Life size': 'Lebensgröße', 'Exit': 'Verlassen', 'Calibrate': 'Kalibrieren',
  'Share': 'Teilen', 'Copy view': 'Ansicht kopieren', 'Copied': 'Kopiert', 'Copy failed': 'Kopieren fehlgeschlagen',
  'Copy this view link:': 'Diesen Ansichts-Link kopieren:',
  'Camera:': 'Kamera:',
  // -- View section
  'Measure': 'Messen', 'Scale distance': 'Maßstab-Distanz',
  'X red · Y green · Z blue (movement axis)': 'X rot · Y grün · Z blau (Werkachse)',
  'Exploded view': 'Explosionsansicht', 'Unit': 'Baugruppe', 'All': 'Alle',
  'Assemblies': 'Baugruppen', 'Ungrouped': 'Ohne Gruppe',
  'Labels': 'Beschriftungen', 'Control HUD': 'Bedien-HUD', 'Explore': 'Erkunden',
  'Mechanisms': 'Mechanismen', 'How they work': 'So funktionieren sie',
  'Schematic': 'Schema', 'Drag parts · ⇧ drags group': 'Teile ziehen · ⇧ zieht die Gruppe',
  'Reassemble': 'Zusammensetzen', 'Reconfigure': 'Umkonfigurieren',
  'Drag the crown to a new azimuth': 'Krone auf einen neuen Azimut ziehen',
  'Trial boot': 'Teststart', 'Apply (reloads)': 'Anwenden (lädt neu)', 'As designed': 'Wie entworfen', 'Undo': 'Rückgängig',
  'Route': 'Route', 'Sketch': 'Skizzieren',
  'measuring swept volumes…': 'überstrichene Volumen werden vermessen…',
  'measuring swept volumes… (one sweep, cached for the session)': 'überstrichene Volumen werden vermessen… (einmal, für die Sitzung gepuffert)',
  'click to place the first point': 'klicken, um den ersten Punkt zu setzen',
  'click to place the first point — through metal is amber (a bore); into a sweep is refused': 'klicken, um den ersten Punkt zu setzen — durch Metall wird bernstein (eine Bohrung); in ein Schleppvolumen wird verweigert',
  'depth': 'Tiefe', 'new linkage': 'neues Gestänge', 'Solve': 'Lösen', 'Clear': 'Löschen',
  'variant name': 'Variantenname', 'Save': 'Speichern', 'Load': 'Laden',
  'Plate X-ray': 'Platinen-Röntgen', 'Tap focus': 'Tipp-Fokus',
  'Tap a part to keep its mechanism solid and ghost everything unrelated. Tap empty space, the same part, or this button to clear.': 'Ein Teil antippen: sein Mechanismus bleibt massiv, alles Unbeteiligte wird gläsern. Leere Fläche, dasselbe Teil oder diesen Knopf antippen, um aufzuheben.',
  'Power flow': 'Kraftfluss', 'Sound': 'Ton', 'Language': 'Sprache',
  // -- §49/§39 measurement overlay units
  'ticks': 'Teilstriche', 'long': 'lang', 'arm': 'Arm', 'plate': 'Platine', 'deep': 'tief',
  'tall': 'hoch', 'h reserve': 'h Reserve',
  // -- Alarm section
  'Cycle': 'Zyklus',
  'Toggle the alarm on and off repeatedly, without moving the camera': 'Den Wecker wiederholt ein- und ausschalten, ohne die Kamera zu bewegen',
  'Rings at': 'Klingelt um', 'Pull to set': 'Ziehen zum Stellen', 'Push to wind': 'Drücken zum Aufziehen',
  'Coupling': 'Kupplung', 'Show': 'Zeigen', 'The link': 'Das Gestänge', 'Trace': 'Verfolgen',
  'Alarm wind': 'Weckeraufzug',
  'Turn to wind · pull out + turn to set': 'Drehen zum Aufziehen · herausziehen + drehen zum Stellen',
  // -- Finish section
  'Light': 'Licht', 'Studio': 'Studio', 'Natural': 'Natürlich',
  'Hand flute': 'Zeigerkehlung', 'Rib pitch': 'Streifenbreite',
  'Tuned values persist in this browser': 'Angepasste Werte bleiben in diesem Browser erhalten',
  'Copy JSON': 'JSON kopieren', 'Reset': 'Zurücksetzen',
  // -- Performance
  'Frame': 'Frame', 'Ticks/frame': 'Ticks/Frame', 'Quality': 'Qualität', 'Tier': 'Stufe',
  'Auto': 'Auto', 'High': 'Hoch', 'Balanced': 'Ausgewogen', 'Low': 'Niedrig',
  // -- State section
  'Saved!': 'Gespeichert!', 'Cleared': 'Gelöscht', 'Clear saved state?': 'Gespeicherten Zustand löschen?',
  // -- panel chrome
  'Hide': 'Ausblenden', 'Hide panel (H)': 'Panel ausblenden (H)', 'Show control panel (H)': 'Bedienpanel einblenden (H)',
  // -- tour gate
  'Take a guided tour of the movement?': 'Eine geführte Tour durch das Werk?',
  'Skip': 'Überspringen', 'Start Tour': 'Tour starten',
  // -- §72 keyboard/screen-reader layer
  'Keyboard shortcuts': 'Tastaturkürzel',
  'Pause / resume': 'Pause / weiter', 'Wind the mainspring': 'Zugfeder aufziehen',
  'Crown pull / push': 'Krone ziehen / drücken', 'Alarm arm / disarm': 'Wecker scharf / entschärfen',
  'Schematic view': 'Schemaansicht', 'X-ray plate': 'Platine röntgen', 'Part labels': 'Teile beschriften',
  'Tap-focus mode': 'Tipp-Fokus-Modus', 'Sound on / off': 'Ton ein / aus',
  'Explode / reassemble': 'Explodieren / zusammensetzen', 'Camera presets': 'Kamera-Voreinstellungen',
  'Orbit camera': 'Kamera umkreisen', 'Tilt camera': 'Kamera neigen', 'Zoom': 'Zoomen',
  'Hide / show panel': 'Panel aus-/einblenden', 'This help': 'Diese Hilfe',
  'Shortcuts pause while a slider or menu has focus. Esc closes.': 'Kürzel pausieren, solange ein Regler oder Menü den Fokus hat. Esc schließt. ? ist auf deutscher Tastatur Umschalt+ß.',
  'Exploded': 'Explodiert', 'Reassembled': 'Zusammengesetzt',
  'Focus': 'Fokus', 'X-ray': 'Röntgen',
  '3D view of the watch movement. All controls are in the Watch Sim panel; keyboard shortcuts are listed under the ? key.': '3D-Ansicht des Uhrwerks. Alle Bedienelemente sind im Watch-Sim-Panel; Tastaturkürzel stehen unter der Taste ?.',
  // -- life size captions (numbers arrive via fmtNum)
  'LIFE SIZE — the plate is': 'LEBENSGRÖSSE — die Platine misst',
  'mm across, and that is how big it is on your screen.': 'mm, und genau so groß ist sie auf Ihrem Bildschirm.',
  'Hold a ruler to the glass. Yes, it is small: that is the answer.': 'Halten Sie ein Lineal ans Glas. Ja, es ist klein: Das ist die Antwort.',
  'NOMINAL LIFE SIZE —': 'NOMINELLE LEBENSGRÖSSE —',
  'mm, assuming your display is exactly 96 px/inch.': 'mm, sofern Ihr Display exakt 96 px/Zoll hat.',
  'Browsers cannot measure the screen they draw on, so this is a definition, not a measurement.': 'Browser können den Bildschirm, auf den sie zeichnen, nicht vermessen — dies ist eine Definition, keine Messung.',
  'Calibrate with a bank card to make it true.': 'Mit einer Bankkarte kalibrieren, damit es stimmt.',
};

// Unit + group display names (German), keyed by the canonical MECH_GRAPH
// vocabulary. VALUES stay canonical everywhere (selects, deep links, state);
// only what the viewer reads is translated.
Object.assign(DE, {
  'Fusee & great wheel': 'Schnecke & Bodenrad', 'Center wheel': 'Zentrumsrad',
  'Third wheel': 'Kleinbodenrad', 'Fourth wheel': 'Sekundenrad', 'Escape wheel': 'Ankerrad',
  'Pallet fork': 'Anker', 'Balance': 'Unruh', 'Hairspring': 'Spirale',
  'Heart cam (seconds reset)': 'Herznocken (Nullstellung)', 'Reset hammer': 'Nullstellhammer',
  'Fork cock': 'Ankerkloben', 'Keyless works': 'Aufzug- & Stellwerk', 'Setting lever': 'Winkelhebel',
  'Yoke': 'Wippe', 'Reset rod': 'Nullstellstange', 'Stop lever': 'Stopphebel', 'Hack rod': 'Stoppstange',
  'Mainspring drum': 'Federhaus', 'Chain': 'Kette', 'Maintaining detent': 'Nachspann-Klinke',
  'Set-up work': 'Vorspann-Gesperr', 'Balance cock': 'Unruhkloben',
  'Three-quarter plate': 'Dreiviertelplatine', 'pillars': 'Pfeiler',
  'Small seconds': 'Kleine Sekunde', 'Motion works': 'Zeigerwerk', 'Hour wheel': 'Stundenrad',
  'Minute jumper': 'Minutenraste', 'Power-reserve train': 'Gangreserve-Getriebe',
  'Alarm disc': 'Weckerscheibe', 'Alarm selector': 'Wählring', 'Alarm release sleeve': 'Auslösehülse',
  'Alarm setting wheel': 'Weckerstellrad', 'Alarm setting idler': 'Stell-Zwischenrad',
  'Alarm release disc': 'Auslösescheibe', 'Alarm release feeler': 'Auslösefühler',
  'Alarm setting arbor': 'Weckerstellwelle', 'Alarm crown': 'Weckerkrone',
  'Alarm release lifter': 'Auslöseheber', 'Alarm silence rocker': 'Stummschaltwippe',
  'Alarm gong': 'Tonfeder', 'Alarm hammer': 'Weckerhammer', 'Alarm winding train': 'Weckeraufzug-Getriebe',
  'Alarm lock': 'Weckersperre', 'Alarm switch': 'Schaltrad', 'Alarm link': 'Weckergestänge',
  'Alarm barrel': 'Weckerfederhaus', 'Alarm striking wheel': 'Schlagrad',
  'Hands': 'Zeiger', 'Structure': 'Werkgestell',
  'Going train': 'Gehendes Räderwerk', 'Fusee & chain': 'Schnecke & Kette',
  'Keyless & winding': 'Aufzug & Stellung', 'Zero-reset & hacking': 'Nullstellung & Sekundenstopp',
  'Dial side': 'Zifferblattseite', 'Frame & plates': 'Gestell & Platinen',
  'Alarm complication': 'Weckerkomplikation',
});

// Advanced panel labels (German) — keyed by the aesthetics.json _labels text
// (§53's single source), NOT by path: the join stays with the file.
Object.assign(DE, {
  'Marker stroke width': 'Index-Strichbreite', 'Marker relief depth': 'Index-Relieftiefe',
  'Marker relief, minimum': 'Index-Relief, Minimum', 'Marker gap': 'Index-Abstand',
  'Marker slant width': 'Index-Schrägenbreite', 'Clearance around sub-dials': 'Freiraum um Hilfszifferblätter',
  'Stroke weight balance': 'Strichgewicht-Balance', 'Keep numeral if this whole': 'Ziffer behalten, wenn ganz',
  'Keep letter if this whole': 'Buchstabe behalten, wenn ganz',
  'Hour hand width': 'Stundenzeiger-Breite', 'Hour hand tail': 'Stundenzeiger-Gegengewicht',
  'Hour hand depth': 'Stundenzeiger-Tiefe', 'Hour hand depth, minimum': 'Stundenzeiger-Tiefe, Minimum',
  'Hour hand boss': 'Stundenzeiger-Nabe', 'Minute hand width': 'Minutenzeiger-Breite',
  'Minute hand tail': 'Minutenzeiger-Gegengewicht', 'Minute hand depth': 'Minutenzeiger-Tiefe',
  'Minute hand depth, minimum': 'Minutenzeiger-Tiefe, Minimum', 'Minute hand boss': 'Minutenzeiger-Nabe',
  'Seconds hand width': 'Sekundenzeiger-Breite', 'Seconds hand tail': 'Sekundenzeiger-Gegengewicht',
  'Seconds hand depth': 'Sekundenzeiger-Tiefe', 'Seconds hand depth, minimum': 'Sekundenzeiger-Tiefe, Minimum',
  'Seconds hand boss': 'Sekundenzeiger-Nabe', 'Seconds counterweight size': 'Sekunden-Gegengewicht, Größe',
  'Seconds counterweight offset': 'Sekunden-Gegengewicht, Versatz', 'Hand stack height': 'Zeigerstapel-Höhe',
  'Hand fluting': 'Zeigerkehlung', 'Sub-dial size': 'Hilfszifferblatt-Größe',
  'Background colour': 'Hintergrundfarbe', 'Fog colour': 'Nebelfarbe',
  'Ambient sky colour': 'Umgebungslicht Himmel', 'Ambient ground colour': 'Umgebungslicht Boden',
  'Ambient strength': 'Umgebungslicht-Stärke', 'Key light colour': 'Führungslicht-Farbe',
  'Key light strength': 'Führungslicht-Stärke', 'Key light shadow bias': 'Führungslicht Schatten-Bias',
  'Fill light colour': 'Fülllicht-Farbe', 'Fill light strength': 'Fülllicht-Stärke',
  'Dial light colour': 'Zifferblattlicht-Farbe', 'Dial light strength': 'Zifferblattlicht-Stärke',
  'Rim spot colour': 'Randspot-Farbe', 'Rim spot strength': 'Randspot-Stärke',
  'Rim spot softness': 'Randspot-Weichheit', 'Rim spot falloff': 'Randspot-Abfall',
  'Rim spot shadow bias': 'Randspot Schatten-Bias', 'Backdrop colour': 'Kulissenfarbe',
  'Backdrop roughness': 'Kulissen-Rauheit', 'Backdrop metalness': 'Kulissen-Metallizität',
  'Camera damping': 'Kameradämpfung', 'Exposure': 'Belichtung',
  'Gong arc (degrees)': 'Tonfeder-Bogen (Grad)', 'Gong wire diameter': 'Tonfeder-Drahtdurchmesser',
  'Rib pitch (fewer ribs →)': 'Streifenbreite (weniger Streifen →)', 'Rib angle': 'Streifenwinkel',
  'Rib scallop depth': 'Streifen-Muscheltiefe', 'Perlage pitch': 'Perlage-Teilung',
  'Perlage ring spacing': 'Perlage-Ringabstand', 'Perlage scallop depth': 'Perlage-Muscheltiefe',
  'Pearl radius': 'Perlenradius', 'Pearl shingle direction': 'Perlen-Schuppenrichtung',
  'Pearl jitter': 'Perlen-Streuung', 'Ruby colour': 'Rubinfarbe',
});

// Guided-script captions (German) — keyed by the English caption verbatim,
// so the step tables never change; the display site resolves through t().
Object.assign(DE, {
  'The jumping-minute setting works, behind the dial': 'Das springende Minuten-Stellwerk, hinter dem Zifferblatt',
  'Pull the crown — the seconds hack and fly to zero, and the jumper drops into the star': 'Krone ziehen — die Sekunde stoppt und fliegt auf null, die Raste fällt in den Stern',
  'Turn to set — the beak snaps the hand one exact minute per detent': 'Drehen zum Stellen — der Schnabel schnappt den Zeiger je Raste exakt eine Minute weiter',
  'Push home — the jumper lifts and the watch runs on, synchronised': 'Hineindrücken — die Raste hebt ab und die Uhr läuft synchronisiert weiter',
  'A fusee-and-chain watch movement — every part built from geometry, no models': 'Ein Uhrwerk mit Kette und Schnecke — jedes Teil aus Geometrie gebaut, keine Modelle',
  'The Swiss lever escapement, slowed right down — the balance frees one tooth per beat': 'Die Schweizer Ankerhemmung, stark verlangsamt — die Unruh gibt je Halbschwingung einen Zahn frei',
  'Winding hauls the chain up the fusee cone; its rising radius keeps the drive torque steady': 'Das Aufziehen zieht die Kette den Schneckenkonus hinauf; der wachsende Radius hält das Antriebsmoment konstant',
  'That torque runs the going train — barrel to centre, third, fourth, escape': 'Dieses Moment treibt das Räderwerk — Federhaus, Zentrum, Kleinboden, Sekunde, Anker',
  'X-ray the plates and explode the stack to see how the layers fit': 'Platinen röntgen und den Stapel explodieren, um die Lagen zu sehen',
  'On the dial side, pull the crown and the jumping-minute works engage': 'Auf der Zifferblattseite: Krone ziehen, das springende Minutenwerk greift ein',
  'Each detent sets the minute hand one exact minute': 'Jede Raste stellt den Minutenzeiger exakt eine Minute weiter',
  'Push home and it runs on': 'Hineindrücken, und sie läuft weiter',
  'Sync sets the hands to your wall clock through the real keyless works, then catches up': 'Sync stellt die Zeiger über das echte Stellwerk auf Ihre Wanduhr und holt dann auf',
  'Every tick is synthesised from the movement’s own events — turn the volume up': 'Jedes Ticken wird aus den Ereignissen des Werks selbst synthetisiert — Lautstärke aufdrehen',
  'That’s the tour. Now explore the controls yourself.': 'Das war die Tour. Erkunden Sie die Bedienelemente nun selbst.',
  'The alarm coupling, behind the dial: a blued index WEDGE on the setting wheel, its partner LINE on the tube’s flange': 'Die Weckerkupplung hinter dem Zifferblatt: ein gebläuter Index-KEIL auf dem Stellrad, sein Partner-STRICH auf dem Rohrflansch',
  'Disarmed, pull the alarm crown…': 'Entschärft die Weckerkrone ziehen…',
  '…and set: the WHEEL turns alone — the tube stays with the hour hand (the heart holds it). The marks SPLIT: that relative angle IS the alarm time, and the wheel is what remembers it': '…und stellen: das RAD dreht allein — das Rohr bleibt beim Stundenzeiger (das Herz hält es). Die Marken TRENNEN sich: dieser Winkel IST die Weckzeit, und das Rad ist ihr Gedächtnis',
  'ARM: the tube leaves the hour hand and snaps to the wheel — the marks REGISTER at the remembered time': 'SCHÄRFEN: das Rohr verlässt den Stundenzeiger und schnappt ans Rad — die Marken DECKEN sich bei der gemerkten Zeit',
  'Set while armed: LOCKSTEP — wheel and tube move together, marks registered, the alarm hand sweeping with them': 'Stellen im scharfen Zustand: GLEICHLAUF — Rad und Rohr bewegen sich gemeinsam, Marken gedeckt, der Weckerzeiger läuft mit',
  'DISARM: the spring snaps the hand home under the hour hand — the marks split to exactly the set angle. Nothing forgot': 'ENTSCHÄRFEN: die Feder schnappt den Zeiger unter den Stundenzeiger zurück — die Marken trennen sich exakt um den gestellten Winkel. Nichts hat vergessen',
  'ARM again: it registers at the SAME marks — the wheel never forgot. The seat is REAL now: an axial heart cut into the wheel’s face, its sprung pin seeking the notch (§34)': 'Wieder SCHÄRFEN: es deckt sich an denSELBEN Marken — das Rad hat nie vergessen. Der Sitz ist jetzt ECHT: ein axiales Herz in der Radstirn, sein gefederter Stift sucht die Kerbe (§34)',
  'The PUSHER at the rim — the one thing an owner touches. A cased movement cannot reach a plate-top column wheel, so §3’s case band will bore for exactly this stem': 'Der DRÜCKER am Rand — das Einzige, was ein Besitzer berührt. Ein eingeschaltes Werk erreicht kein Schaltrad auf der Platine, also wird §3s Gehäuseband genau für diesen Stift gebohrt',
  'One press = one index = half a column pitch. A SECOND beak, 120° round — two full pitches, so identical parity — reads the same castellations the §25 D lock does': 'Ein Druck = ein Schritt = eine halbe Säulenteilung. Ein ZWEITER Schnabel, 120° weiter — zwei volle Teilungen, also gleiche Parität — liest dieselben Zinnen wie die §25-D-Sperre',
  'Its long TAIL carries that read across the south-west, clear of the keyless works, to a rod at the rim. Nothing here is decreed — every hand-off is two parts touching': 'Sein langer SCHWANZ trägt die Lesung über den Südwesten, frei vom Stellwerk, zu einer Stange am Rand. Nichts hier ist dekretiert — jede Übergabe sind zwei sich berührende Teile',
  'X-ray the plates: the beak’s fall drops the ROD through bores in both, the §29 climb in reverse. Rod down = ring down = armed': 'Platinen röntgen: der Fall des Schnabels senkt die STANGE durch Bohrungen in beiden — §29s Klettern rückwärts. Stange unten = Ring unten = scharf',
  'Under the base plate, a LAY SHAFT with a crank at each end runs the read 32 units inboard — the distance no single lever should ever span': 'Unter der Grundplatine trägt eine VORGELEGEWELLE mit je einer Kurbel die Lesung 32 Einheiten nach innen — die Distanz, die kein einzelner Hebel überspannen sollte',
  'The centre crank presses the selector ring’s DRIVE TAB and the ring slides. `alarmOn` is a READOUT of this chain now, not its cause': 'Die mittlere Kurbel drückt die MITNEHMERLASCHE des Wählrings, der Ring gleitet. `alarmOn` ist jetzt eine ANZEIGE dieser Kette, nicht ihre Ursache',
  'Press again and the whole run reverses — column, beak, rod, shaft, crank, ring. Pusher to arming, unbroken': 'Noch einmal drücken, und der ganze Lauf kehrt um — Säule, Schnabel, Stange, Welle, Kurbel, Ring. Vom Drücker zur Schärfung, ohne Bruch',
  'INSPECTION ROUTE — the places where defects have actually been found. Click anywhere to stop.': 'INSPEKTIONSROUTE — die Orte, an denen wirklich Defekte gefunden wurden. Zum Stoppen irgendwo klicken.',
  '1/9 Escapement. The fork is impulsed BOTH ways — this is §48’s control case, and it should look driven, not animated.': '1/9 Hemmung. Der Anker erhält in BEIDE Richtungen Impuls — §48s Kontrollfall; es soll getrieben aussehen, nicht animiert.',
  '2/9 Column wheel at rest. The click’s spring is GROUNDED on its own stud — it must stay still while the arm rocks.': '2/9 Schaltrad in Ruhe. Die Klinkenfeder ist auf ihrem eigenen Stift GEERDET — sie muss stillstehen, während der Arm wippt.',
  '3/9 Alarm ON. The wheel indexes as the pusher goes down. Watch the pawl drive the ratchet the way its teeth are cut.': '3/9 Wecker EIN. Das Rad schaltet, während der Drücker sinkt. Sehen Sie, wie die Klinke das Gesperr treibt, wie seine Zähne geschnitten sind.',
  '4/9 Where the beak’s tail meets the top of the vertical rod, movement side. Nose falls into a gap ⇒ tail RISES ⇒ the rod follows it up 1:1. A tail driving DOWN onto a rising rod is an inverted lever.': '4/9 Wo der Schwanz des Schnabels oben auf die senkrechte Stange trifft, Werkseite. Nase fällt in eine Lücke ⇒ Schwanz STEIGT ⇒ die Stange folgt 1:1. Ein Schwanz, der auf eine steigende Stange HERABDRÜCKT, wäre ein invertierter Hebel.',
  '5/9 The LAY SHAFT — the long horizontal arbor under the dial. The vertical rod pushes a crank at its far end, the shaft twists, and a second crank at THIS end shifts the alarm selector ring. Watch that near crank stay in the ring’s tab: it is the last step of the pusher’s force path.': '5/9 Die VORGELEGEWELLE — die lange waagerechte Welle unter dem Zifferblatt. Die senkrechte Stange drückt eine Kurbel am fernen Ende, die Welle verdreht sich, eine zweite Kurbel an DIESEM Ende verschiebt den Wählring. Achten Sie darauf, dass die nahe Kurbel in der Lasche bleibt: der letzte Schritt des Kraftwegs.',
  '6/9 Winding idlers. Tooth into GAP at the line of centres, never tooth on tooth — and the same again where they meet the barrel.': '6/9 Aufzugs-Zwischenräder. Zahn in LÜCKE auf der Zentrale, nie Zahn auf Zahn — und dasselbe dort, wo sie das Federhaus treffen.',
  '7/9 The setting train’s dogleg, dial side: setting wheel → idler → idler. Same tooth-into-gap test, and this chain crosses the dial’s Y-flip.': '7/9 Der Knick des Stellgetriebes, Zifferblattseite: Stellrad → Zwischenrad → Zwischenrad. Derselbe Zahn-in-Lücke-Test, und die Kette kreuzt den Y-Flip des Zifferblatts.',
  '8/9 The hammer. Its fall is a spring law, so a real spring now bears on the tail — grounded at the stud, moving at the arm.': '8/9 Der Hammer. Sein Fall ist ein Federgesetz, also drückt jetzt eine echte Feder auf den Schwanz — am Stift geerdet, am Arm beweglich.',
  '9/9 The alarm release feeler, dial side. Its return blade is anchored to the bracket, NOT to the arm — it should stay put while the arm rocks, and press the arm onto its cam rather than the arm being glued to the profile.': '9/9 Der Auslösefühler, Zifferblattseite. Seine Rückstellfeder ist am Bock verankert, NICHT am Arm — sie soll stillhalten, während der Arm wippt, und den Arm auf seinen Nocken drücken, statt dass der Arm am Profil klebt.',
  'End of route. Anything that looked wrong here is worth reporting — the battery cannot see this class.': 'Ende der Route. Alles, was hier falsch aussah, ist meldenswert — die Batterie sieht diese Klasse nicht.',
});

// ---------------------------------------------------------------------------
// Chinese (simplified). The typography stress test: CJK fallback in the
// system-ui stack and no-space line breaking (§53's overflow-wrap rows).
// Chrome-tier translation authored here; §73 budgets a native review pass
// before tier two (the explainer) ships in this locale.
const ZH = {
  'On': '开', 'Off': '关',
  'Time': '时间', 'Camera': '视角', 'View': '显示', 'Alarm': '闹铃',
  'Finish': '打磨', 'Performance': '性能', 'State': '存档', 'Advanced': '高级',
  'Pause': '暂停', 'Beats': '摆动次数', 'Time-scale': '时间倍率',
  'Wind': '上链', 'Crown': '表冠', 'Sync': '对时', 'Now': '现在',
  'Power reserve': '动力储存', 'Fast-forward': '快进',
  'Beat rate': '振频', 'Reserve spec': '动储规格',
  'Spring torque': '发条扭矩', 'Train torque': '轮系扭矩',
  'Pull out': '拔出', 'Push in': '推入',
  'Pulling…': '拔出中…', 'Setting…': '拨针中…', 'Pushing in…': '推入中…', 'Catching up': '追赶中',
  'paused': '已暂停', 'movement stopped': '机芯已停',
  'fast-forward': '快进', '≈5400× — the whole reserve in ~20 s': '≈5400× — 约 20 秒耗尽全部动储',
  'catching up to the wall clock': '正在追上真实时间',
  'beats/s': '次/秒', 'slow': '倍慢',
  'Escapement': '擒纵机构', 'Train': '轮系', 'Dial': '表盘', 'Setting': '拨针', 'Free': '自由',
  'Guided': '导览', 'Tour': '巡览', 'Demo': '演示', 'Inspect': '检视',
  'Life size': '实物大小', 'Exit': '退出', 'Calibrate': '校准',
  'Share': '分享', 'Copy view': '复制视角', 'Copied': '已复制', 'Copy failed': '复制失败',
  'Copy this view link:': '复制此视角链接：',
  'Camera:': '视角：',
  'Measure': '测量', 'Scale distance': '标尺距离',
  'X red · Y green · Z blue (movement axis)': 'X 红 · Y 绿 · Z 蓝（机芯轴向）',
  'Exploded view': '爆炸视图', 'Unit': '部件', 'All': '全部',
  'Assemblies': '组件', 'Ungrouped': '未分组',
  'Labels': '标签', 'Control HUD': '操控界面', 'Explore': '探索',
  'Mechanisms': '机构原理', 'How they work': '工作原理',
  'Schematic': '简图', 'Drag parts · ⇧ drags group': '拖动零件 · ⇧ 拖动整组',
  'Reassemble': '复位', 'Reconfigure': '重新布局',
  'Drag the crown to a new azimuth': '将表冠拖到新的方位角',
  'Trial boot': '试运行', 'Apply (reloads)': '应用（重新加载）', 'As designed': '恢复原设计', 'Undo': '撤销',
  'Route': '走线', 'Sketch': '勾画',
  'measuring swept volumes…': '正在测量扫掠体积…',
  'measuring swept volumes… (one sweep, cached for the session)': '正在测量扫掠体积…（一次扫掠，本次会话缓存）',
  'click to place the first point': '点击放置第一个点',
  'click to place the first point — through metal is amber (a bore); into a sweep is refused': '点击放置第一个点 — 穿过金属显示琥珀色（钻孔）；进入扫掠体积则被拒绝',
  'depth': '深度', 'new linkage': '新联动杆', 'Solve': '求解', 'Clear': '清除',
  'variant name': '方案名称', 'Save': '保存', 'Load': '载入',
  'Plate X-ray': '夹板透视', 'Tap focus': '点选聚焦',
  'Tap a part to keep its mechanism solid and ghost everything unrelated. Tap empty space, the same part, or this button to clear.': '点选零件：其机构保持实体，无关零件变为半透明。点空白处、再点同一零件或此按钮即可取消。',
  'Power flow': '动力流', 'Sound': '声音', 'Language': '语言',
  'ticks': '刻度', 'long': '长', 'arm': '臂长', 'plate': '夹板', 'deep': '厚',
  'tall': '高', 'h reserve': '小时动储',
  'Cycle': '循环',
  'Toggle the alarm on and off repeatedly, without moving the camera': '反复开关闹铃而不移动视角',
  'Rings at': '响铃时刻', 'Pull to set': '拔出定时', 'Push to wind': '推入上链',
  'Coupling': '联轴', 'Show': '演示', 'The link': '联动杆', 'Trace': '追踪',
  'Alarm wind': '闹铃上链',
  'Turn to wind · pull out + turn to set': '旋转上链 · 拔出后旋转定时',
  'Light': '灯光', 'Studio': '影棚', 'Natural': '自然',
  'Hand flute': '指针凹槽', 'Rib pitch': '条纹间距',
  'Tuned values persist in this browser': '调整值保存在本浏览器中',
  'Copy JSON': '复制 JSON', 'Reset': '重置',
  'Frame': '帧耗时', 'Ticks/frame': '每帧步数', 'Quality': '画质', 'Tier': '档位',
  'Auto': '自动', 'High': '高', 'Balanced': '均衡', 'Low': '低',
  'Saved!': '已保存！', 'Cleared': '已清除', 'Clear saved state?': '清除已保存的状态？',
  'Hide': '隐藏', 'Hide panel (H)': '隐藏面板 (H)', 'Show control panel (H)': '显示控制面板 (H)',
  'Take a guided tour of the movement?': '要开始机芯导览吗？',
  'Skip': '跳过', 'Start Tour': '开始巡览',
  'Keyboard shortcuts': '键盘快捷键',
  'Pause / resume': '暂停 / 继续', 'Wind the mainspring': '给发条上链',
  'Crown pull / push': '表冠拔出 / 推入', 'Alarm arm / disarm': '闹铃开 / 关',
  'Schematic view': '简图视图', 'X-ray plate': '夹板透视', 'Part labels': '零件标签',
  'Tap-focus mode': '点选聚焦模式', 'Sound on / off': '声音开 / 关',
  'Explode / reassemble': '爆炸 / 复位', 'Camera presets': '视角预设',
  'Orbit camera': '环绕视角', 'Tilt camera': '俯仰视角', 'Zoom': '缩放',
  'Hide / show panel': '隐藏 / 显示面板', 'This help': '本帮助',
  'Shortcuts pause while a slider or menu has focus. Esc closes.': '滑块或菜单获得焦点时快捷键暂停。Esc 关闭。',
  'Exploded': '已爆炸', 'Reassembled': '已复位',
  'Focus': '聚焦', 'X-ray': '透视',
  '3D view of the watch movement. All controls are in the Watch Sim panel; keyboard shortcuts are listed under the ? key.': '机芯 3D 视图。所有控件都在 Watch Sim 面板中；按 ? 键查看键盘快捷键。',
  'LIFE SIZE — the plate is': '实物大小 — 夹板直径为',
  'mm across, and that is how big it is on your screen.': '毫米，屏幕上显示的正是这个尺寸。',
  'Hold a ruler to the glass. Yes, it is small: that is the answer.': '拿尺子贴在屏幕上量量看。是的，它就是这么小：这正是答案。',
  'NOMINAL LIFE SIZE —': '名义实物大小 —',
  'mm, assuming your display is exactly 96 px/inch.': '毫米，假设显示器恰为 96 px/英寸。',
  'Browsers cannot measure the screen they draw on, so this is a definition, not a measurement.': '浏览器无法测量它所绘制的屏幕，因此这是定义，不是测量。',
  'Calibrate with a bank card to make it true.': '用银行卡校准即可使其准确。',
};

Object.assign(ZH, {
  'Fusee & great wheel': '芝麻链塔轮与头轮', 'Center wheel': '中心轮',
  'Third wheel': '三轮', 'Fourth wheel': '秒轮', 'Escape wheel': '擒纵轮',
  'Pallet fork': '擒纵叉', 'Balance': '摆轮', 'Hairspring': '游丝',
  'Heart cam (seconds reset)': '归零心形轮', 'Reset hammer': '归零锤',
  'Fork cock': '擒纵叉夹板', 'Keyless works': '上链拨针机构', 'Setting lever': '拉档',
  'Yoke': '离合杆', 'Reset rod': '归零杆', 'Stop lever': '止摆杆', 'Hack rod': '止摆连杆',
  'Mainspring drum': '发条盒', 'Chain': '链条', 'Maintaining detent': '维持力棘爪',
  'Set-up work': '预紧棘轮', 'Balance cock': '摆轮夹板',
  'Three-quarter plate': '四分之三夹板', 'pillars': '支柱',
  'Small seconds': '小秒盘', 'Motion works': '时分轮系', 'Hour wheel': '时轮',
  'Minute jumper': '分针跳档', 'Power-reserve train': '动储轮系',
  'Alarm disc': '闹铃盘', 'Alarm selector': '闹铃选择环', 'Alarm release sleeve': '释放套筒',
  'Alarm setting wheel': '闹铃定时轮', 'Alarm setting idler': '定时过轮',
  'Alarm release disc': '释放盘', 'Alarm release feeler': '释放探杆',
  'Alarm setting arbor': '闹铃定时轴', 'Alarm crown': '闹铃表冠',
  'Alarm release lifter': '释放提杆', 'Alarm silence rocker': '静音摇杆',
  'Alarm gong': '音簧', 'Alarm hammer': '闹铃锤', 'Alarm winding train': '闹铃上链轮系',
  'Alarm lock': '闹铃锁定杆', 'Alarm switch': '柱状轮开关', 'Alarm link': '闹铃联动杆',
  'Alarm barrel': '闹铃发条盒', 'Alarm striking wheel': '打铃轮',
  'Hands': '指针', 'Structure': '基板结构',
  'Going train': '传动轮系', 'Fusee & chain': '塔轮与链条',
  'Keyless & winding': '上链与拨针', 'Zero-reset & hacking': '归零与止摆',
  'Dial side': '表盘侧', 'Frame & plates': '基板与夹板',
  'Alarm complication': '闹铃复杂功能',
});

Object.assign(ZH, {
  'Marker stroke width': '时标笔画宽度', 'Marker relief depth': '时标浮雕深度',
  'Marker relief, minimum': '时标浮雕下限', 'Marker gap': '时标间隙',
  'Marker slant width': '时标斜面宽度', 'Clearance around sub-dials': '小表盘周边间隙',
  'Stroke weight balance': '笔画粗细平衡', 'Keep numeral if this whole': '数字完整度达此值则保留',
  'Keep letter if this whole': '字母完整度达此值则保留',
  'Hour hand width': '时针宽度', 'Hour hand tail': '时针尾部',
  'Hour hand depth': '时针厚度', 'Hour hand depth, minimum': '时针厚度下限',
  'Hour hand boss': '时针轴套', 'Minute hand width': '分针宽度',
  'Minute hand tail': '分针尾部', 'Minute hand depth': '分针厚度',
  'Minute hand depth, minimum': '分针厚度下限', 'Minute hand boss': '分针轴套',
  'Seconds hand width': '秒针宽度', 'Seconds hand tail': '秒针尾部',
  'Seconds hand depth': '秒针厚度', 'Seconds hand depth, minimum': '秒针厚度下限',
  'Seconds hand boss': '秒针轴套', 'Seconds counterweight size': '秒针配重大小',
  'Seconds counterweight offset': '秒针配重偏移', 'Hand stack height': '指针叠层高度',
  'Hand fluting': '指针凹槽', 'Sub-dial size': '小表盘大小',
  'Background colour': '背景色', 'Fog colour': '雾色',
  'Ambient sky colour': '环境光天空色', 'Ambient ground colour': '环境光地面色',
  'Ambient strength': '环境光强度', 'Key light colour': '主光颜色',
  'Key light strength': '主光强度', 'Key light shadow bias': '主光阴影偏置',
  'Fill light colour': '辅光颜色', 'Fill light strength': '辅光强度',
  'Dial light colour': '表盘光颜色', 'Dial light strength': '表盘光强度',
  'Rim spot colour': '轮缘射灯颜色', 'Rim spot strength': '轮缘射灯强度',
  'Rim spot softness': '轮缘射灯柔度', 'Rim spot falloff': '轮缘射灯衰减',
  'Rim spot shadow bias': '轮缘射灯阴影偏置', 'Backdrop colour': '幕布颜色',
  'Backdrop roughness': '幕布粗糙度', 'Backdrop metalness': '幕布金属度',
  'Camera damping': '视角阻尼', 'Exposure': '曝光',
  'Gong arc (degrees)': '音簧弧度（度）', 'Gong wire diameter': '音簧线径',
  'Rib pitch (fewer ribs →)': '条纹间距（条纹更少 →）', 'Rib angle': '条纹角度',
  'Rib scallop depth': '条纹扇贝深度', 'Perlage pitch': '珍珠纹间距',
  'Perlage ring spacing': '珍珠纹环距', 'Perlage scallop depth': '珍珠纹扇贝深度',
  'Pearl radius': '珍珠半径', 'Pearl shingle direction': '珍珠叠瓦方向',
  'Pearl jitter': '珍珠抖动', 'Ruby colour': '红宝石颜色',
});

Object.assign(ZH, {
  'The jumping-minute setting works, behind the dial': '表盘背后的跳分拨针机构',
  'Pull the crown — the seconds hack and fly to zero, and the jumper drops into the star': '拔出表冠 — 秒针止停并飞回零位，跳档落入星轮',
  'Turn to set — the beak snaps the hand one exact minute per detent': '旋转拨针 — 卡口每一档让指针精确跳动一分钟',
  'Push home — the jumper lifts and the watch runs on, synchronised': '推回表冠 — 跳档抬起，手表同步继续走时',
  'A fusee-and-chain watch movement — every part built from geometry, no models': '一枚芝麻链机芯 — 每个零件都由几何生成，没有模型素材',
  'The Swiss lever escapement, slowed right down — the balance frees one tooth per beat': '瑞士杠杆式擒纵，大幅放慢 — 摆轮每次摆动释放一个齿',
  'Winding hauls the chain up the fusee cone; its rising radius keeps the drive torque steady': '上链把链条沿塔轮锥面卷起；渐增的半径使驱动扭矩保持恒定',
  'That torque runs the going train — barrel to centre, third, fourth, escape': '该扭矩驱动传动轮系 — 从发条盒到中心轮、三轮、秒轮、擒纵轮',
  'X-ray the plates and explode the stack to see how the layers fit': '透视夹板并展开层叠，观察各层如何装配',
  'On the dial side, pull the crown and the jumping-minute works engage': '在表盘侧拔出表冠，跳分机构随即啮合',
  'Each detent sets the minute hand one exact minute': '每一档让分针精确前进一分钟',
  'Push home and it runs on': '推回表冠，继续走时',
  'Sync sets the hands to your wall clock through the real keyless works, then catches up': '对时通过真实的拨针机构把指针拨到墙上时钟，然后追赶补齐',
  'Every tick is synthesised from the movement’s own events — turn the volume up': '每一声滴答都由机芯自身的事件合成 — 请调大音量',
  'That’s the tour. Now explore the controls yourself.': '巡览到此结束。现在请自行探索各项控件。',
  'The alarm coupling, behind the dial: a blued index WEDGE on the setting wheel, its partner LINE on the tube’s flange': '表盘背后的闹铃联轴：定时轮上有蓝钢楔形标记，套管法兰上有与之配对的线形标记',
  'Disarmed, pull the alarm crown…': '在关闹状态下拔出闹铃表冠…',
  '…and set: the WHEEL turns alone — the tube stays with the hour hand (the heart holds it). The marks SPLIT: that relative angle IS the alarm time, and the wheel is what remembers it': '…然后定时：轮单独转动 — 套管跟随时针（心形轮扣住它）。两个标记分开：这个相对角度就是闹铃时刻，由轮记住它',
  'ARM: the tube leaves the hour hand and snaps to the wheel — the marks REGISTER at the remembered time': '开闹：套管离开时针并吸附到轮上 — 两标记在记住的时刻重合',
  'Set while armed: LOCKSTEP — wheel and tube move together, marks registered, the alarm hand sweeping with them': '开闹状态下定时：同步 — 轮与套管一起转动，标记保持重合，闹铃针随之扫动',
  'DISARM: the spring snaps the hand home under the hour hand — the marks split to exactly the set angle. Nothing forgot': '关闹：弹簧把闹铃针弹回时针下方 — 标记按设定角度分开。没有任何遗忘',
  'ARM again: it registers at the SAME marks — the wheel never forgot. The seat is REAL now: an axial heart cut into the wheel’s face, its sprung pin seeking the notch (§34)': '再次开闹：仍在同一标记处重合 — 轮从未遗忘。落座如今是真实的：轮面上切有轴向心形槽，弹压销自动寻找凹口（§34）',
  'The PUSHER at the rim — the one thing an owner touches. A cased movement cannot reach a plate-top column wheel, so §3’s case band will bore for exactly this stem': '表壳边缘的按钮 — 佩戴者唯一触碰的零件。装壳后的机芯够不到夹板顶的柱状轮，所以 §3 的表壳中层将正好为这根按杆开孔',
  'One press = one index = half a column pitch. A SECOND beak, 120° round — two full pitches, so identical parity — reads the same castellations the §25 D lock does': '按一次 = 进一格 = 半个柱距。第二个卡爪在 120° 处 — 相隔两个整柱距，奇偶相同 — 读取与 §25 D 锁定杆相同的城垛齿',
  'Its long TAIL carries that read across the south-west, clear of the keyless works, to a rod at the rim. Nothing here is decreed — every hand-off is two parts touching': '长尾把读数横越西南方、避开拨针机构，送到边缘的竖杆。这里没有任何硬性指定 — 每次传递都是两个零件的真实接触',
  'X-ray the plates: the beak’s fall drops the ROD through bores in both, the §29 climb in reverse. Rod down = ring down = armed': '透视夹板：卡爪落下使竖杆穿过两块夹板的孔下沉 — §29 攀升的逆过程。杆下 = 环下 = 开闹',
  'Under the base plate, a LAY SHAFT with a crank at each end runs the read 32 units inboard — the distance no single lever should ever span': '基板之下，一根两端带曲柄的过桥轴把读数向内传递 32 个单位 — 任何单根杠杆都不该跨越的距离',
  'The centre crank presses the selector ring’s DRIVE TAB and the ring slides. `alarmOn` is a READOUT of this chain now, not its cause': '中央曲柄推压选择环的驱动凸耳，环随之滑动。`alarmOn` 如今是这条链的读数，而非其原因',
  'Press again and the whole run reverses — column, beak, rod, shaft, crank, ring. Pusher to arming, unbroken': '再按一次，整条链反向运行 — 柱、爪、杆、轴、曲柄、环。从按钮到开闹，环环相扣',
  'INSPECTION ROUTE — the places where defects have actually been found. Click anywhere to stop.': '检视路线 — 这些位置曾真正发现过缺陷。点击任意处停止。',
  '1/9 Escapement. The fork is impulsed BOTH ways — this is §48’s control case, and it should look driven, not animated.': '1/9 擒纵。擒纵叉双向受冲 — 这是 §48 的对照案例，它应当看起来是被驱动的，而非动画。',
  '2/9 Column wheel at rest. The click’s spring is GROUNDED on its own stud — it must stay still while the arm rocks.': '2/9 静止的柱状轮。棘爪弹簧固定在自己的柱销上 — 摇臂摆动时它必须保持不动。',
  '3/9 Alarm ON. The wheel indexes as the pusher goes down. Watch the pawl drive the ratchet the way its teeth are cut.': '3/9 闹铃开。按钮下压时柱状轮进格。注意棘爪按齿形方向驱动棘轮。',
  '4/9 Where the beak’s tail meets the top of the vertical rod, movement side. Nose falls into a gap ⇒ tail RISES ⇒ the rod follows it up 1:1. A tail driving DOWN onto a rising rod is an inverted lever.': '4/9 机芯侧，卡爪尾部与竖杆顶端相接处。爪尖落入间隙 ⇒ 尾部上升 ⇒ 竖杆 1:1 跟随上行。尾部下压而杆上升，那就是杠杆装反了。',
  '5/9 The LAY SHAFT — the long horizontal arbor under the dial. The vertical rod pushes a crank at its far end, the shaft twists, and a second crank at THIS end shifts the alarm selector ring. Watch that near crank stay in the ring’s tab: it is the last step of the pusher’s force path.': '5/9 过桥轴 — 表盘下方的长横轴。竖杆推动远端曲柄，轴扭转，近端的第二个曲柄推移闹铃选择环。注意近端曲柄始终留在环的凸耳中：这是按钮力路径的最后一步。',
  '6/9 Winding idlers. Tooth into GAP at the line of centres, never tooth on tooth — and the same again where they meet the barrel.': '6/9 上链过轮。在中心连线上齿入齿隙，绝不齿顶齿 — 与发条盒啮合处亦然。',
  '7/9 The setting train’s dogleg, dial side: setting wheel → idler → idler. Same tooth-into-gap test, and this chain crosses the dial’s Y-flip.': '7/9 表盘侧定时轮系的折线：定时轮 → 过轮 → 过轮。同样的齿入齿隙检验，且这条链跨越表盘的 Y 翻转。',
  '8/9 The hammer. Its fall is a spring law, so a real spring now bears on the tail — grounded at the stud, moving at the arm.': '8/9 闹铃锤。它的落下由弹簧定律决定，现在有真实的弹簧压在尾部 — 固定于柱销，作用于摆臂。',
  '9/9 The alarm release feeler, dial side. Its return blade is anchored to the bracket, NOT to the arm — it should stay put while the arm rocks, and press the arm onto its cam rather than the arm being glued to the profile.': '9/9 表盘侧的释放探杆。它的回位簧片固定在支架上，而非摆臂上 — 摆臂摆动时它应保持不动，把摆臂压向凸轮，而不是摆臂粘在轮廓上。',
  'End of route. Anything that looked wrong here is worth reporting — the battery cannot see this class.': '路线结束。这里任何看着不对的地方都值得报告 — 检测组看不到这一类缺陷。',
});

// ---------------------------------------------------------------------------
const TABLE = UI_LANG === 'de' ? DE : UI_LANG === 'zh' ? ZH : null;

// Translate one English source string. English (or a missing entry) returns
// the input — visible fallback, never a blank.
export function t(s) {
  return (TABLE && TABLE[s]) || s;
}

// Localize an already-built DOM subtree: every text node plus the readable
// attributes (title, placeholder, aria-label), matched by trimmed content so
// the template's indentation survives. Runs once per subtree at build time —
// the chrome is STATIC per load (locale changes reload, §22-tier).
export function localizeTree(root) {
  if (!TABLE) return;
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  for (let n = walker.nextNode(); n; n = walker.nextNode()) {
    const k = n.nodeValue.trim();
    if (!k || !TABLE[k]) continue;
    n.nodeValue = n.nodeValue.replace(k, TABLE[k]);
  }
  const els = root.querySelectorAll ? [root, ...root.querySelectorAll('[title], [placeholder], [aria-label]')] : [root];
  for (const el of els) {
    if (!el.getAttribute) continue;
    for (const a of ['title', 'placeholder', 'aria-label']) {
      const v = el.getAttribute(a);
      if (v && TABLE[v.trim()]) el.setAttribute(a, TABLE[v.trim()]);
    }
  }
}
