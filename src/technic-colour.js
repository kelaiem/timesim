// BUILT §303 — THE COLOUR RE-PICK: choose the colour of every (role, part) so that
// BrickLink lists an element for it. Pure (no file, no pack, no DOM): the probe
// feeds it the placements and the BrickLink subset, and `LDRAW_COLOUR` is held EQUAL
// to what it returns, so the table is checked against the data and never typed.
//
// THE CONSTRAINT (hard). A parts-list line is a (part, colour). BrickLink sells a
// line only if it lists an element for that part in that colour, so every (role,
// part) the builds place must take a colour in which `listed(part, colour)` holds.
// A role can place several parts and a part can serve several roles, and a single
// part may be listed in ONE colour only (7785 White, 7861 Light Bluish Gray, 69778
// Blue), so the unit of the constraint is the (role, part) pair and the role's row is
// its DEFAULT: a part the default does not list takes an exception row "role/part".
//
// THE PREFERENCES (soft, in this order, each a tie-break of the one before):
//   1. the fewest exceptions: a role's default is the colour that lists the most of
//      the role's parts, so a role reads as one colour wherever BrickLink allows;
//   2. the BASE palette before any extension: a colour outside `base` is chosen only
//      for a part no base colour lists (an extension is the last resort, §303);
//   3. the role's CURRENT colour (the least change);
//   4. the fewest NEW same-part merges: two roles that place one part in one build
//      and had different colours must not be made one (their lines would fold and
//      their pictures would match);
//   5. the fewest roles in the same build already wearing that colour;
//   6. the colour most other roles already give that part;
//   7. the lower code (a total order, so the answer is a function of the data).
// Roles are decided tightest first (fewest base colours listing all their parts,
// then by name), each against the current colours of the roles not yet decided.
//
// input  units:   [{ role, part, builds: [key] }]   one per (role, part) the builds place
//        listed:  (part, code) => boolean           BrickLink lists an element
//        base:    [code]                            the palette in order
//        extra:   [code]                            colours held back for a part no base colour lists
//        current: { role | "role/part": code }      the table being re-picked
// output { table, exceptions, extended }            table as LDRAW_COLOUR's rows

export const partKey = (role, part) => `${role}/${part}`;
export const colourOf = (table, role, part) => table[partKey(role, part)] ?? table[role];

export function repickColours({ units, listed, base, extra = [], current, roleOrder = null }) {
  const all = [...base, ...extra];
  const byRole = new Map();
  for (const u of units) (byRole.get(u.role) ?? byRole.set(u.role, []).get(u.role)).push(u);
  const cur = (role) => current[role];
  // the colours assigned so far: undecided roles read as their current colour
  const assigned = new Map();
  for (const u of units) assigned.set(partKey(u.role, u.part), colourOf(current, u.role, u.part));
  const feasible = (part) => {
    const b = base.filter((c) => listed(part, c));
    return b.length ? b : extra.filter((c) => listed(part, c));
  };
  const share = (a, b) => a.builds.some((k) => b.builds.includes(k));
  const misses = (role, c) => byRole.get(role).filter((u) => !listed(u.part, c)).length;
  const wholeBase = (role) => base.filter((c) => misses(role, c) === 0).length;
  const order = roleOrder ?? [...byRole.keys()].sort((a, b) => wholeBase(a) - wholeBase(b) || (a < b ? -1 : a > b ? 1 : 0));
  // the cost tuple of giving unit `u` colour `c` (rules 4-6)
  const cost = (u, c) => {
    let merges = 0, crowd = new Set(), pop = 0;
    for (const v of units) {
      if (v.role === u.role) continue;
      const vc = assigned.get(partKey(v.role, v.part));
      if (v.part === u.part && vc === c) pop++;
      if (vc !== c || !share(u, v)) continue;
      crowd.add(v.role);
      if (v.part === u.part && colourOf(current, v.role, v.part) !== colourOf(current, u.role, u.part)) merges++;
    }
    return [merges, crowd.size, -pop, c];
  };
  const lex = (a, b) => { for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return a[i] - b[i]; return 0; };
  const table = {}, exceptions = [], extended = [];
  for (const role of order) {
    const us = byRole.get(role);
    const rank = (c) => [misses(role, c), extra.includes(c) ? 1 : 0, c === cur(role) ? 0 : 1, ...us.reduce((s, u) => { const x = cost(u, c); return [s[0] + x[0], s[1] + x[1], s[2] + x[2]]; }, [0, 0, 0]), c];
    const def = [...all].sort((a, b) => lex(rank(a), rank(b)))[0];
    table[role] = def;
    for (const u of us) assigned.set(partKey(role, u.part), def);
    for (const u of us) {
      if (listed(u.part, def)) continue;
      const fs = feasible(u.part);
      if (!fs.length) throw new Error(`technic-colour: no colour in the palette is listed by BrickLink for part ${u.part} (role ${role})`);
      const pick = [...fs].sort((a, b) => (a === cur(role) ? 0 : 1) - (b === cur(role) ? 0 : 1) || lex(cost(u, a), cost(u, b)))[0];
      table[partKey(role, u.part)] = pick; exceptions.push(partKey(role, u.part)); assigned.set(partKey(role, u.part), pick);
      if (extra.includes(pick)) extended.push(partKey(role, u.part));
    }
    if (extra.includes(def)) extended.push(role);
  }
  return { table, exceptions: exceptions.sort(), extended: extended.sort() };
}

// Every (role, part, build) triple an unlisted line would come from: the lines
// the table gives, and the ones among them BrickLink lists no element for.
export function unlistedUnits(units, table, listed) {
  return units.filter((u) => !listed(u.part, colourOf(table, u.role, u.part))).map((u) => ({ role: u.role, part: u.part, colour: colourOf(table, u.role, u.part) }));
}

// The role table as BUILT §300 shipped it (42 rows, before BrickLink was consulted): the
// `current` the re-pick starts from, kept so the derivation is reproducible — the probe
// re-runs `repickColours` from it and holds LDRAW_COLOUR equal to the result.
export const COLOUR_BASELINE_300 = Object.freeze({
  baseplate: 2, plate: 71, brick: 71, technicBrick: 72, axle: 0, spur: 71, doubleBevel: 19,
  joiner: 0, ring: 72, crown: 15, catch: 4, pinion: 19, rack: 14, tile: 15, detent: 25, arm: 1, follower: 4,
  cord: 0, cordEnd: 0, barrel: 72, hook: 15, knob: 15, pulley: 71, click: 19, ratchet: 25, pawl: 4, great: 14, centre: 19,
  lever: 14, pin: 72, rotor: 4, wheel: 71, driver: 1, stub: 0, pushTip: 4, collar: 4, button: 15, beam: 25, gear: 71,
  knife: 72, mass: 14, pallet: 4 });
