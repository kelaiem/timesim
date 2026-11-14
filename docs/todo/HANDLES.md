# TODO handles

A HANDLE is a two-to-four-word nickname for an item, so that a conversation, a
commit message or a review can name one in fewer words than its title takes:
TODO 293 is *spring tip overhang*, TODO 279 is *gong files ungated*. The
NUMBER is still the permanent ID and the only thing to cite in source
comments, cross-references and commit messages — a handle is for talking, not
for addressing.

Each is written to be MINIMALLY differentiated from the others: just enough to
stand apart, so related items separate on one word rather than on a clause
(*gong seats drifted* against *gong files ungated*; *spring tip overhang*
against *ring tooth cap*, which are the same tooth-count search read from two
ends). A few keep a number because the number IS the handle — *d4=16 boot
timeout*, *the 0.05–0.12 band*.

**Why they live here and not in each item's heading.** A TODO heading's title
is IDENTITY to `tools/check-item-numbers.mjs` (`titleIsIdentity`): it compares
an item's title across refs and reads a changed one as two different items
sharing a permanent number, which is the collision the whole numbering scheme
exists to refuse. Prefixing 294 headings would trip that gate on every one of
them. The headings are also what `tools/item-docs.mjs` generates TODO.md's
index from, so a handle written into one would arrive in the index's Title
column as though it were part of the title.

**A handle is authored, not derived — so what holds this file is a gate, not a
derivation.** `node tools/todo-handles.mjs --check` reads TODO.md's generated
index and holds four things: every indexed item has exactly ONE row here; no
row names a number the index does not carry (a renumbered or deleted item
leaves its handle pointing at nothing); every handle is unique, compared
case-insensitively on collapsed whitespace, since two items answering to one
name is the defect that makes handles worse than numbers; and every handle is
non-empty and at most four words, because a sixth word is a title growing back.
A missing row is reported WITH the item's title, which is what anyone needs to
write the handle. Every rule carries a control that plants its own defect and
fails the run if the rule stays silent, and `item-numbers.yml` runs the check
beside the numbering gates — so a newly filed item owes its row here, and
nothing merges without it.

Newest first. State is not repeated here — it is read from each item's own
heading, and [the index](../../TODO.md) is where it is shown.

| item | handle |
|---|---|
| 308 | stud straddles cock edge |
| 305 | setting traverse crosses pinion |
| 304 | cock feet too close |
| 303 | cushion lugs proud |
| 302 | free dial ring folds |
| 301 | tonneau sagitta unlisted |
| 300 | form case unheld |
| 298 | alarm-free unswept |
| 299 | wear life unpriced |
| 297 | form dial feet |
| 296 | escape tooth tip |
| 295 | cock jewel bores |
| 294 | stop-work reserves |
| 293 | spring tip overhang |
| 292 | fast rates undriven |
| 291 | mainspring packing rule |
| 290 | hammer head short |
| 289 | fold traverses unborne |
| 288 | stop-work star stud |
| 287 | gong seats drifted |
| 286 | fusee cock twist |
| 285 | measure's round plateR |
| 284 | case stand-in box |
| 283 | free band unbored |
| 282 | meshClearance crossing blind |
| 281 | port raster staircase |
| 280 | d4=16 boot timeout |
| 279 | gong files ungated |
| 278 | round no-alarm step |
| 277 | tour panel collapsed |
| 276 | tour captions untranslated |
| 275 | pusher cap buried |
| 274 | §308 forbidden contacts |
| 273 | seam points doubled |
| 272 | gong sets pillars |
| 271 | pillar seats round |
| 270 | governor window round |
| 269 | spiral end strike |
| 268 | crowns at round radius |
| 267 | strike annulus round |
| 266 | staff and tail inside |
| 265 | Chromium 156 strike metal |
| 264 | technic overlaps and steps |
| 263 | brush grain crossed |
| 262 | lugs sized for steel |
| 261 | alarm rings on time |
| 260 | reader pin lift |
| 259 | notch drop law |
| 258 | roller's stale reason |
| 257 | hack brake early |
| 256 | ring tooth cap |
| 255 | mesh loss doubled |
| 254 | balance endstone missing |
| 253 | beak stub gap |
| 252 | fusee pivots disagree |
| 251 | seven-leaf centre pinion |
| 250 | saw couplings dry |
| 249 | reset coupling lossless |
| 248 | chain rivet wear |
| 247 | sleeve tail-pin drag |
| 246 | release return unpriced |
| 245 | K8 control dead |
| 244 | K9 control unrunnable |
| 243 | castellation breakpoints missed |
| 242 | fast rates can't start |
| 241 | press chain bottoming |
| 240 | beak arm aim |
| 239 | flank side thrust |
| 238 | impulse symmetry |
| 237 | stall reflection inverted |
| 236 | release sleeve slider |
| 235 | hairspring plane bare |
| 234 | fork cock leg |
| 233 | Latvian tables stale |
| 232 | run-down torqueless |
| 231 | back envelope per-unit |
| 230 | beak lever axial slide |
| 229 | gong receiver rigid |
| 228 | hammer rebound posed |
| 227 | skirt cone sheet |
| 226 | impulse pin entry |
| 225 | in-plane sub-floor metal |
| 224 | maintaining wind posed |
| 223 | setting lever buried |
| 222 | follower B posed lift |
| 221 | beak apex wedge |
| 220 | spider leg gap |
| 219 | maintaining spring torus |
| 218 | beak 20-degree wedge |
| 217 | maintaining hold unpriced |
| 216 | favourable swing knock |
| 215 | detent rides backwards |
| 214 | setting lever yoke |
| 213 | link chord scoring |
| 212 | geneva finger loose |
| 211 | yoke prong bears nothing |
| 210 | detent restoring misnamed |
| 209 | twelve parts off plate |
| 208 | cone too steep |
| 207 | amplitude 76–327 |
| 206 | beak press missing |
| 205 | rod-end neck gap |
| 204 | link beak post |
| 203 | tab zone scoring |
| 202 | plate face 0.3 |
| 201 | alarm ribbon overstressed |
| 200 | pillar tenons undrawn |
| 199 | strike hold flag |
| 198 | two rings cross |
| 197 | meshClearance over-reads |
| 196 | balstep rim recut |
| 195 | fork room annulus |
| 194 | follower spring bears nothing |
| 193 | ribbon over yield |
| 192 | budget doesn't close |
| 191 | selector rod gap |
| 190 | silence rocker overlay |
| 189 | release pawl reach |
| 188 | reserve scan boot block |
| 187 | plate invisible |
| 186 | only the default swept |
| 185 | cap leg margin |
| 184 | fasteners hold nothing |
| 183 | jumper refusal inert |
| 182 | jumper scan brute force |
| 181 | JMP_SITE movers |
| 180 | JMP_SITE BVH zeros |
| 179 | reader pin hub pass |
| 178 | follower stud heart pass |
| 177 | hour hand boss touch |
| 176 | barrel cavity hexagon |
| 175 | bevelled bore undersize |
| 174 | selector fork unjoined |
| 173 | feeler rocks wrong axis |
| 172 | setting lane sheet gap |
| 171 | link floors row |
| 170 | four alarm pairs |
| 169 | idler 2 flies |
| 168 | hub-less bore hexagon |
| 167 | setting pinion bevel |
| 166 | release seat post |
| 165 | non-manifold crossing missed |
| 164 | undeclared pair gate |
| 163 | clutch rim two laws |
| 162 | leg-2 corner gap |
| 161 | JMP_SITE as-built levers |
| 160 | jumper refusal order |
| 159 | scaled-frame clearance |
| 158 | deep-linked spec unswept |
| 157 | first-feasible siting |
| 156 | CAP_SOLVE blind metal |
| 155 | setting posed from offset |
| 154 | cannon pinion heart |
| 153 | motion works plate face |
| 152 | trial boot aesthetics |
| 151 | setting cap plane |
| 150 | fold counter-rotation |
| 149 | per-frame extents |
| 148 | overcoil knee straight |
| 147 | overcoil stud outboard |
| 146 | link eyes unbored |
| 145 | turning catalogue |
| 144 | setting branch hour |
| 143 | crown pull prose |
| 142 | over-press undeclared |
| 141 | alarm disc ternary |
| 140 | alarm corner pose index |
| 139 | alarm corner open loop |
| 138 | shear-cone bevels |
| 137 | column pawl arm |
| 136 | crossed-axis drive-through |
| 135 | handSet axis blind |
| 134 | reserve clamp multiple |
| 132 | six meshes mis-phased |
| 131 | pallet faces slide path |
| 130 | lock rocker pin float |
| 129 | alarm hand negation |
| 128 | hammer spring length |
| 127 | gong pitch by stud |
| 126 | gong level stops |
| 125 | keyless +0.1 |
| 124 | motion works arithmetic |
| 123 | inside-out invisible metal |
| 122 | crystals glazed by coordinates |
| 121 | strike tier descriptions |
| 120 | hand collets fictions |
| 119 | hands group dead air |
| 118 | minute hand lift |
| 117 | alarm chain ratios |
| 116 | blank phase pose |
| 115 | train counter-rotation |
| 114 | back-most metal names |
| 113 | alarm hand specs |
| 112 | reserve hand halfWidth |
| 111 | seat relief one pose |
| 110 | reset leaves eased state |
| 109 | λ catalogue parked |
| 108 | sub-body ranges BVH |
| 107 | finger disc bore caps |
| 106 | open-mesh parity census |
| 105 | lever safety unsimulated |
| 104 | declarations unaudited |
| 103 | driver hub full turn |
| 102 | return spring inside fit |
| 101 | alarm disc arm tube |
| 100 | outline soundness |
| 99 | pushed claim unseen |
| 98 | fork six solids |
| 97 | ambiguous selectors |
| 96 | band radial bores |
| 95 | sampling miss published |
| 94 | five interpenetrations |
| 93 | sampling miss, first |
| 92 | chord pusher twice |
| 91 | plate ledge keyless |
| 90 | what the column drives |
| 89 | §1 hardening bill |
| 88 | quick-set arithmetic detent |
| 87 | alarm press unswept |
| 86 | the miter that isn't |
| 85 | trapezoid builders |
| 84 | bevel-fattened teeth |
| 83 | parity ray inside |
| 82 | alarm stall prose |
| 81 | census shard-dependent |
| 80 | weld drops userData |
| 79 | rod-end chord growth |
| 78 | λ ceiling unmeasured |
| 77 | reserve meshes interpenetrate |
| 76 | chain articulation fiction |
| 75 | inside-out bodies |
| 74 | zero-area triangles |
| 73 | raycast guard residue |
| 72 | alarm one-way metalless |
| 71 | arrest pad coil model |
| 70 | jewel collar inside-out |
| 69 | three-quarter plate thickness |
| 68 | primer seconds freeze |
| 67 | spider halfHeight margin |
| 66 | four untrue statements |
| 65 | schematic save state |
| 64 | alarmCrown axis population |
| 63 | stall re-taken |
| 62 | bevel mesh phase |
| 61 | tooth form naming |
| 60 | tower arbor sleeves |
| 59 | click nose wall |
| 58 | quick-set naming |
| 57 | gold chatons claim |
| 56 | stop-work reversal unswept |
| 55 | stop-work wind count |
| 54 | canonical axis entry |
| 53 | plate floor chain |
| 52 | setPathRot unpersisted |
| 51 | finger accommodation |
| 50 | going stem saw |
| 49 | chain fusee hook |
| 48 | reserve train phase |
| 47 | heart cam early |
| 46 | first stage re-gear |
| 45 | escapement drop |
| 44 | lock collar parentage |
| 43 | detector artifacts |
| 42 | guide stack window |
| 41 | well hands plane |
| 40 | fusee equalisation |
| 39 | drum on arbor |
| 38 | wind axes swept |
| 37 | alarm barrel wind |
| 36 | spec boots |
| 35 | zero tooth count |
| 34 | sleeve validation unfailable |
| 33 | wells bounded inboard |
| 32 | both torque laws |
| 31 | lock return blade |
| 30 | walls two and three |
| 29 | no-spring audit residue |
| 28 | pillars and lock lift |
| 27 | openings cut |
| 26 | dial pockets |
| 25 | spring to balance |
| 24 | lock beak matter |
| 23 | bearing-cock arms |
| 22 | press axis stem |
| 21 | hour wheel dial-most |
| 20 | arming run driven |
| 19 | selector sensing pin |
| 18 | reserve reduction 25% |
| 17 | gong sound derived |
| 16 | alarm link impossible |
| 15 | mesh phase measurement |
| 14 | hammer fall springless |
| 13 | three followers cams |
| 12 | the 0.05–0.12 band |
| 11 | alarm quarter-scale stock |
| 10 | released beak star |
| 9 | rod seat underived |
| 7 | pose sampling bound |
| 6 | expected floors instance |
| 5 | intra-unit triage residue |
| 4 | smaller items |
| 3 | handSetOffset derived |
| 1 | mainspring winds |
