# Vendored third-party code

These files are **not** covered by the project's Apache 2.0 license (see
`../LICENSE`). They are redistributed under their own MIT terms, whose
full text is included here as required by those licenses. Two files are
verbatim; `three-mesh-bvh.module.js` carries **three local patches** (below),
all marked `PATCHED (timesim)` in place. None is fixed upstream as of
master 2026-08 (patches 1–2 checked against `src/math/OrientedBox.js` and
the changelog through 0.9.14; patch 3's unguarded dereference is present in
three.js r165's own `Mesh.js` copy of the same function, so upstream offers
no idiom to copy), so a future version bump must re-verify all three
sites — `node tools/check-bvh-patches.mjs` is that verification, runnable —
and all are worth reporting upstream:

1. **`closestPointToGeometry` (both generated copies): seed the inner-scorer
   OBB at entry.** `shapecast` never consults `intersectsBounds` for the
   ROOT node, and the dual-tree path only wrote the inner-scorer's bounds
   inside `intersectsBounds( isLeaf )` — so a query whose outer tree is a
   single leaf ran its whole inner traversal pruning against whatever OBB
   the PREVIOUS query left in the shared module temp. Measured here: the
   same mesh pair at the same pose read 0.1066 cold, 0.1404 after the
   transposed query, 0.4110 after an unrelated one. The seed is the bvh
   geometry's own bounding box — a superset of every leaf, so scores stay
   valid lower bounds and per-leaf tightening on descent is unchanged.
2. **`OrientedBox.distanceToBox`: box edge segments built with `max[ f2 ]`
   where `max[ f3 ]` belongs** (two lines), so the edge-edge pass could
   miss the true minimum and the returned distance over-estimated —
   unsound as a traversal pruning bound.
3. **`checkBufferGeometryIntersection`: guard the null
   `Triangle.getInterpolation` returns on a degenerate triangle.** A
   zero-area face has no barycentric basis, so the interpolation returns
   null and the unpatched `intersection.normal.dot( ray.direction )`
   throws — which turned a parity raycast landing on one of the alarm
   column wheel's fourteen zero-area triangles into an `unmeasurable`
   `assembly` verdict (TODO 73). Patched to report NO HIT: a face with no
   area is no countable crossing, so parity is preserved. Note three.js
   r165's own `Mesh.js` carries the same unguarded dereference — the guard
   is this repo's parity semantics, not an upstream idiom.

Defects 1–2 return non-minimal distances from `closestPointToGeometry` —
over-estimates, the unsafe direction for the clearance instruments built on
it (`src/inspect.js`, `meshClearance`). Defect 3 turns a countable crossing
into a thrown exception — not a wrong number but a missing one, which the
`assembly` check reports honestly as `unmeasurable` and then must ASSUME
joined (its safe direction).

The app vendors its dependencies so it runs from any static file server with no
build step and no network access — see the importmap in `../index.html`.

| File | Package | Version | Upstream path | License |
|---|---|---|---|---|
| `three.module.js` | [three](https://github.com/mrdoob/three.js) | r165 (0.165.0) | `build/three.module.js` | MIT — `LICENSE-three.txt` |
| `OrbitControls.js` | [three](https://github.com/mrdoob/three.js) | r165 (0.165.0) | `examples/jsm/controls/OrbitControls.js` | MIT — `LICENSE-three.txt` |
| `three-mesh-bvh.module.js` | [three-mesh-bvh](https://github.com/gkjohnson/three-mesh-bvh) | 0.7.8 | `build/index.module.js` | MIT — `LICENSE-three-mesh-bvh.txt` |

`three-mesh-bvh` provides the exact triangle-intersection tests behind the
realism inspector (`../src/inspect.js`); the other two are the renderer and the
camera controls.

## Provenance

`three.module.js` and `OrbitControls.js` are byte-identical to their
published upstream builds. **`three-mesh-bvh.module.js` is NOT** — it carries
the three patches documented at the top of this file, so it has two hashes and
both are recorded here. This paragraph used to claim all three were verbatim,
which contradicted the header six lines up and made the `cmp` step below
unreadable: a mismatch on the bvh file looked identical whether it came from
the expected patch or from a corrupted download.

SHA-256 of the files AS SHIPPED here:

```
5916c8dfb5f4e3eede312de305345868d4a0a8105383b080c6985565d6e79b46  three.module.js
f260591ef315aa04888152e7f121865214e33fb54727145cf4e4445058db1297  OrbitControls.js
0eb913b5d67dc9759455136e08f2ce61ed49bdcb39108c1b51f0df57e736ac27  three-mesh-bvh.module.js
```

SHA-256 of the upstream build the patched file was made FROM, so a version
bump can tell "the vendor changed" from "our patch changed":

```
434340fe39bb9cac3d2777ca2e479f5ac6c5a0fff8c4f62b2507511363632233  three-mesh-bvh.module.js (upstream 0.7.8, unpatched)
```

To re-verify, or to refresh a dependency:

```sh
curl -sO https://unpkg.com/three@0.165.0/build/three.module.js
curl -sO https://unpkg.com/three@0.165.0/examples/jsm/controls/OrbitControls.js
curl -s -o three-mesh-bvh.module.js https://unpkg.com/three-mesh-bvh@0.7.8/build/index.module.js
```

Then `cmp` each against the file here. **The first two must match exactly; the
bvh file must NOT** — it should differ at precisely the three patch sites, and
`node tools/check-bvh-patches.mjs` is what verifies that rather than your eye.
If you bump a version, re-fetch that package's `LICENSE` too — the copyright
years change — re-apply and re-verify all three patches, and update BOTH hash
blocks above as well as the table in `../README.md`.
