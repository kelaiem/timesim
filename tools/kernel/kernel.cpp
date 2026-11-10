// §338 landing 5 — THE KERNEL: the closest distance between two triangle meshes (one
// placed in the other's frame by a matrix), and since landing 6 whether any triangle
// of one meets any of the other.
//
// Built by tools/kernel-build.mjs to wasm32 (src/kernel-wasm.js, GENERATED; never
// edit it) and called only through inspect.js' `Kernel`. Its REFERENCE is
// src/exact-mesh.js, this file ported operation for operation, and
// tools/probe-338-kernel-parity.mjs holds the two by Object.is on every answer (G3).
//
// §338 landing 10 — WRITTEN IN C++23 (where clang 18, the pinned zig's, has it) so it
// reads like the maths and checks itself as it compiles:
//   · Vec3 and Box are VALUES with constexpr operators, and a triangle array is a
//     view read as tri[t, c] (a corner) or tri[t, c, a] (a coordinate), C++23's
//     multidimensional subscript, in place of hand-counted 9·t + 3·c + a offsets;
//   · every triangle primitive is constexpr, and the parity probe's analytic pairs
//     are static_asserts on them (`ANALYTIC`, below), so a regression in the
//     geometry fails the build before any probe runs;
//   · `if consteval` gives the one function a constant expression cannot reach,
//     sqrt, a compile-time body, so pad2 and the final distance are constexpr too.
//
// WHAT MAY NOT MOVE, the contract the port depends on: every floating-point
// expression keeps the operands and the association it had in the C++17 kernel, term
// for term (a Vec3 operator is the scalar expression it replaces, written once).
// The build passes -ffp-contract=off and no fast-math and refuses SIMD; the only
// floating point is + − × ÷, comparisons and sqrt (f64.sqrt, correctly rounded by
// the wasm spec), so the module computes the same bits on every host. Every loop
// runs in index order and every tie keeps the FIRST minimum; nothing depends on the
// traversal but the pruning, and pruning is sound (a box distance is a lower bound
// on every triangle distance under it, cleared by PRUNE_PAD).
//
// FREESTANDING: no libc, no standard library (zig's wasm32-freestanding gives none
// under -nostdlib, so the few things std would supply are written here), no
// exceptions, no allocation but the bump arena below.

using u32 = unsigned int;
using u8 = unsigned char;

// ---------------------------------------------------------------------------
// The arena.
extern "C" unsigned char __heap_base;

static u32 heap_top = 0;
static u32 heap_start = 0;
static u32 scratch_cap = 0, scratch_ptr = 0;   // the query's reusable scratch (below)

static constexpr u32 align8(u32 x) { return (x + 7u) & ~7u; }

// A linear-memory address as a typed pointer, and back: wasm32's address space.
template <class T> static T* at(u32 p) { return reinterpret_cast<T*>(static_cast<unsigned long>(p)); }
template <class T> static u32 addr(const T* p) { return static_cast<u32>(reinterpret_cast<unsigned long>(p)); }

// Grow linear memory to hold [0, end).
[[nodiscard]] static bool ensure_memory(u32 end) {
  const u32 have = static_cast<u32>(__builtin_wasm_memory_size(0)) * 65536u;
  if (end <= have) return true;
  const u32 pages = (end - have + 65535u) / 65536u;
  return __builtin_wasm_memory_grow(0, pages) != static_cast<unsigned long>(-1);
}

extern "C" {

__attribute__((export_name("reset"))) void reset() {
  if (!heap_start) heap_start = align8(addr(&__heap_base));
  heap_top = heap_start;
  scratch_cap = 0; scratch_ptr = 0;   // the scratch lived in the arena: it is gone with it
}

__attribute__((export_name("alloc"))) u32 alloc(u32 bytes) {
  if (!heap_start) reset();
  const u32 p = align8(heap_top);
  const u32 end = p + align8(bytes);
  if (end < p || !ensure_memory(end)) return 0;
  heap_top = end;
  return p;
}

__attribute__((export_name("heap_used"))) u32 heap_used() { return heap_top - heap_start; }

}  // extern "C"

// ---------------------------------------------------------------------------
// Values. Each operator is the scalar expression the C++17 kernel wrote out per
// component, in the same association, so replacing a hand-written line with it
// changes no rounding.
static constexpr double INF = __builtin_inf();

[[nodiscard]] static constexpr double dmin(double a, double b) { return b < a ? b : a; }   // not fmin: −0 and NaN as the port has them
[[nodiscard]] static constexpr double dmax(double a, double b) { return b > a ? b : a; }
[[nodiscard]] static constexpr double clamp01(double x) { return x < 0 ? 0 : (x > 1 ? 1 : x); }

// sqrt, the one operation a constant expression cannot reach (clang 18 does not fold
// __builtin_sqrt). At run time it is f64.sqrt, correctly rounded; at compile time a
// Newton iteration, which the static_asserts below use only on perfect squares of
// binary fractions, where it lands exactly.
[[nodiscard]] static constexpr double root(double x) {
  if consteval {
    if (!(x > 0)) return x;
    double r = x > 1 ? x : 1;
    for (int i = 0; i < 200; i++) {
      const double n = 0.5 * (r + x / r);
      if (n == r) break;
      r = n;
    }
    return r;
  } else {
    return __builtin_sqrt(x);
  }
}

struct Vec3 {
  double x, y, z;
  // a coordinate by axis, readable and writable through the same member
  template <class Self> constexpr auto&& operator[](this Self&& s, int a) { return a == 0 ? s.x : a == 1 ? s.y : s.z; }
};
[[nodiscard]] static constexpr Vec3 operator+(Vec3 a, Vec3 b) { return { a.x + b.x, a.y + b.y, a.z + b.z }; }
[[nodiscard]] static constexpr Vec3 operator-(Vec3 a, Vec3 b) { return { a.x - b.x, a.y - b.y, a.z - b.z }; }
[[nodiscard]] static constexpr Vec3 operator*(Vec3 a, double s) { return { a.x * s, a.y * s, a.z * s }; }
[[nodiscard]] static constexpr Vec3 operator/(Vec3 a, double s) { return { a.x / s, a.y / s, a.z / s }; }
[[nodiscard]] static constexpr double dot(Vec3 a, Vec3 b) { return a.x * b.x + a.y * b.y + a.z * b.z; }
[[nodiscard]] static constexpr Vec3 cross(Vec3 a, Vec3 b) { return { a.y * b.z - a.z * b.y, a.z * b.x - a.x * b.z, a.x * b.y - a.y * b.x }; }
[[nodiscard]] static constexpr Vec3 fabs3(Vec3 a) { return { __builtin_fabs(a.x), __builtin_fabs(a.y), __builtin_fabs(a.z) }; }
[[nodiscard]] static constexpr double dist2(Vec3 a, Vec3 b) { const Vec3 d = a - b; return dot(d, d); }

// An axis-aligned box; `empty` is the identity of `grow`.
struct Box {
  Vec3 mn, mx;
  static constexpr Box empty() { return { { INF, INF, INF }, { -INF, -INF, -INF } }; }
  constexpr void grow(Vec3 p) {
    for (int a = 0; a < 3; a++) { mn[a] = dmin(mn[a], p[a]); mx[a] = dmax(mx[a], p[a]); }
  }
};

// The squared gap between two boxes (0 when they overlap).
[[nodiscard]] static constexpr double box_dist2(const Box& A, const Box& B) {
  double s = 0;
  for (int a = 0; a < 3; a++) {
    const double g = dmax(B.mn[a] - A.mx[a], A.mn[a] - B.mx[a]);
    if (g > 0) s += g * g;
  }
  return s;
}

// A triangle: three corners, read off nine contiguous doubles.
struct Tri {
  const double* p;
  constexpr Vec3 operator[](int c) const { return { p[3 * c], p[3 * c + 1], p[3 * c + 2] }; }
};
// An array of triangles, 9 doubles each: tri[t] a triangle, tri[t, c] a corner,
// tri[t, c, a] one coordinate (writable).
struct Tris {
  double* p;
  constexpr Tri operator[](int t) const { return { p + 9 * t }; }
  constexpr Vec3 operator[](int t, int c) const { return Tri{ p + 9 * t }[c]; }
  constexpr double& operator[](int t, int c, int a) const { return p[9 * t + 3 * c + a]; }
  constexpr void set(int t, int c, Vec3 v) const { (*this)[t, c, 0] = v.x; (*this)[t, c, 1] = v.y; (*this)[t, c, 2] = v.z; }
};

// The tight box of one triangle.
[[nodiscard]] static constexpr Box tri_box(Tri t) {
  Box b;
  for (int a = 0; a < 3; a++) {
    b.mn[a] = dmin(dmin(t[0][a], t[1][a]), t[2][a]);
    b.mx[a] = dmax(dmax(t[0][a], t[1][a]), t[2][a]);
  }
  return b;
}

// ---------------------------------------------------------------------------
// Triangle–triangle distance, squared.

// The squared distance from p to segment ab.
[[nodiscard]] static constexpr double point_seg2(Vec3 p, Vec3 a, Vec3 b) {
  const Vec3 ab = b - a, ap = p - a;
  const double L = dot(ab, ab);
  const double t = L > 0 ? clamp01(dot(ap, ab) / L) : 0;
  return dist2(p, a + ab * t);
}

// Ericson, Real-Time Collision Detection §5.1.5, with a degenerate triangle
// answered by its edges.
[[nodiscard]] static constexpr double point_tri2(Vec3 p, Vec3 a, Vec3 b, Vec3 c) {
  const Vec3 ab = b - a, ac = c - a, n = cross(ab, ac);
  if (!(dot(n, n) > 0)) return dmin(point_seg2(p, a, b), dmin(point_seg2(p, b, c), point_seg2(p, c, a)));
  const Vec3 ap = p - a;
  const double d1 = dot(ab, ap), d2 = dot(ac, ap);
  if (d1 <= 0 && d2 <= 0) return dist2(p, a);
  const Vec3 bp = p - b;
  const double d3 = dot(ab, bp), d4 = dot(ac, bp);
  if (d3 >= 0 && d4 <= d3) return dist2(p, b);
  const double vc = d1 * d4 - d3 * d2;
  if (vc <= 0 && d1 >= 0 && d3 <= 0) return dist2(p, a + ab * (d1 / (d1 - d3)));
  const Vec3 cp = p - c;
  const double d5 = dot(ab, cp), d6 = dot(ac, cp);
  if (d6 >= 0 && d5 <= d6) return dist2(p, c);
  const double vb = d5 * d2 - d1 * d6;
  if (vb <= 0 && d2 >= 0 && d6 <= 0) return dist2(p, a + ac * (d2 / (d2 - d6)));
  const double va = d3 * d6 - d5 * d4;
  if (va <= 0 && (d4 - d3) >= 0 && (d5 - d6) >= 0) return dist2(p, b + (c - b) * ((d4 - d3) / ((d4 - d3) + (d5 - d6))));
  const double den = 1.0 / (va + vb + vc);
  const double v = vb * den, w = vc * den;
  return dist2(p, a + ab * v + ac * w);
}

// Ericson §5.1.9: the closest points of two segments.
[[nodiscard]] static constexpr double seg_seg2(Vec3 p1, Vec3 q1, Vec3 p2, Vec3 q2) {
  const Vec3 d1 = q1 - p1, d2 = q2 - p2, r = p1 - p2;
  const double a = dot(d1, d1), e = dot(d2, d2), f = dot(d2, r);
  double s, t;
  if (!(a > 0) && !(e > 0)) return dist2(p1, p2);
  if (!(a > 0)) { s = 0; t = clamp01(f / e); }
  else {
    const double c = dot(d1, r);
    if (!(e > 0)) { t = 0; s = clamp01(-c / a); }
    else {
      const double b = dot(d1, d2), den = a * e - b * b;
      s = den > 0 ? clamp01((b * f - c * e) / den) : 0;
      t = (b * s + f) / e;
      if (t < 0) { t = 0; s = clamp01(-c / a); }
      else if (t > 1) { t = 1; s = clamp01((b - c) / a); }
    }
  }
  return dist2(p1 + d1 * s, p2 + d2 * t);
}

// Does segment p→q pass through triangle (a, b, c)? Möller–Trumbore; a segment in
// the triangle's plane is answered by the edge and corner distances instead.
[[nodiscard]] static constexpr bool seg_pierces(Vec3 p, Vec3 q, Vec3 a, Vec3 b, Vec3 c) {
  const Vec3 dir = q - p, e1 = b - a, e2 = c - a;
  const Vec3 h = cross(dir, e2);
  const double det = dot(e1, h);
  if (det == 0) return false;
  const double inv = 1.0 / det;
  const Vec3 s = p - a;
  const double u = inv * dot(s, h);
  if (u < 0 || u > 1) return false;
  const Vec3 qv = cross(s, e1);
  const double v = inv * dot(dir, qv);
  if (v < 0 || u + v > 1) return false;
  const double t = inv * dot(e2, qv);
  return t >= 0 && t <= 1;
}

// The squared distance between two triangles, or `best` when none of their
// candidate pairs is nearer (0 as soon as an edge of one pierces the other).
[[nodiscard]] static constexpr double tri_tri2(Tri P, Tri Q, double best) {
  for (int i = 0; i < 3; i++) {
    const int j = (i + 1) % 3;
    if (seg_pierces(P[i], P[j], Q[0], Q[1], Q[2])) return 0;
    if (seg_pierces(Q[i], Q[j], P[0], P[1], P[2])) return 0;
  }
  double m = best;
  for (int i = 0; i < 3; i++) {
    m = dmin(m, point_tri2(Q[i], P[0], P[1], P[2]));
    m = dmin(m, point_tri2(P[i], Q[0], Q[1], Q[2]));
  }
  for (int i = 0; i < 3; i++)
    for (int j = 0; j < 3; j++)
      m = dmin(m, seg_seg2(P[i], P[(i + 1) % 3], Q[j], Q[(j + 1) % 3]));
  return m;
}

// §338 landing 6 — does any triangle of A meet any triangle of B? EXACT on the
// computed corners:
//   1. a separating plane: if every corner of one triangle is strictly on one side
//      of the other's plane, they cannot meet (the cheap, common answer);
//   2. otherwise two non-coplanar triangles meet exactly when an edge of one
//      pierces the other (seg_pierces, inclusive at the boundary);
//   3. a corner exactly ON the other's plane, or a degenerate triangle, is the only
//      case 1 and 2 cannot settle (coplanar overlap, an edge lying in the face,
//      touching at a point), and there the exact distance decides.
// Incidence is invariant under any invertible affine map, so B may be placed by any
// such M (inspect.js' boolean sites pass world matrices that may scale).
[[nodiscard]] static constexpr bool tri_meets(Tri P, Tri Q) {
  const Vec3 nP = cross(P[1] - P[0], P[2] - P[0]);
  const Vec3 nQ = cross(Q[1] - Q[0], Q[2] - Q[0]);
  const bool degenerate = !(dot(nP, nP) > 0) || !(dot(nQ, nQ) > 0);
  bool onPlane = false;
  if (!degenerate) {
    double dq[3], dp[3];
    for (int i = 0; i < 3; i++) dq[i] = dot(nP, Q[i] - P[0]);
    if ((dq[0] > 0 && dq[1] > 0 && dq[2] > 0) || (dq[0] < 0 && dq[1] < 0 && dq[2] < 0)) return false;
    for (int i = 0; i < 3; i++) dp[i] = dot(nQ, P[i] - Q[0]);
    if ((dp[0] > 0 && dp[1] > 0 && dp[2] > 0) || (dp[0] < 0 && dp[1] < 0 && dp[2] < 0)) return false;
    onPlane = dq[0] == 0 || dq[1] == 0 || dq[2] == 0 || dp[0] == 0 || dp[1] == 0 || dp[2] == 0;
  }
  for (int i = 0; i < 3; i++) {
    const int j = (i + 1) % 3;
    if (seg_pierces(P[i], P[j], Q[0], Q[1], Q[2])) return true;
    if (seg_pierces(Q[i], Q[j], P[0], P[1], P[2])) return true;
  }
  if (degenerate || onPlane) return tri_tri2(P, Q, INF) == 0;
  return false;
}

// PRUNING IS EXACT ONLY WITH A MARGIN. A box bound and a triangle distance are
// different arithmetic on the same corners, and where a triangle lies on its own
// box's face (every box is tight on its triangles) the computed bound can land an
// ulp ABOVE the computed distance and prune the very pair that holds the minimum,
// which moved one expectedContacts witness between two builds of this kernel. So a
// node is skipped only when its bound clears the best by PRUNE_PAD. The movement's
// coordinates are under 100 units, where an ulp is 2⁻⁴⁶ (1.4e-14), and a bound and
// a distance each carry under ten roundings, so their difference is under 1.4e-13;
// 1e-12 is clear of it. With the margin, the answer is the exact minimum of
// tri_tri2 over every pair under `upper`, whatever the traversal visits first.
static constexpr double PRUNE_PAD = 1e-12;
static constexpr double ULP_UNDER_100 = 0x1p-46;   // the spacing of doubles in [64, 128)
static_assert(10 * ULP_UNDER_100 < PRUNE_PAD, "PRUNE_PAD must clear ten roundings at the movement's scale");
[[nodiscard]] static constexpr double pad2(double best2) {
  if (!(best2 < INF)) return best2;
  const double r = root(best2) + PRUNE_PAD;
  return r * r;
}

// ---------------------------------------------------------------------------
// THE ANALYTIC PAIRS, checked as the file compiles: the parity probe's
// closed-form cases (every coordinate a binary fraction, so every answer is exact),
// now held by the compiler before any probe runs.
namespace analytic {
constexpr double T0[9] = { 0, 0, 0, 1, 0, 0, 0, 1, 0 };            // the unit right triangle
constexpr double LIFT[9] = { 0, 0, 0.5, 1, 0, 0.5, 0, 1, 0.5 };    // it, 0.5 above
constexpr double SIDE[9] = { 2, 0, 0, 3, 0, 0, 2, 1, 0 };          // it, 2 along x (coplanar, 1 apart)
constexpr double SLIDE[9] = { 0.125, 0.125, 0, 1.125, 0.125, 0, 0.125, 1.125, 0 };   // coplanar, overlapping
constexpr double SPIKE[9] = { 0.25, 0.25, -1, 0.25, 0.25, 1, 0.5, 0.25, 1 };         // an edge through the face
constexpr double OVER[9] = { 0.25, 0.25, 0.5, 0.25, 0.25, 2, 1, 1, 2 };              // a vertex 0.5 over the face
constexpr double SKEW_A[9] = { 0, 0, 0, 1, 0, 0, 0.5, -1, 0 };
constexpr double SKEW_B[9] = { 0.5, -0.5, 0.25, 0.5, 0.5, 0.25, 0.5, 0, 3 };          // edges 0.25 apart
constexpr double CORNER[9] = { 1, 0, 0, 2, 0, 1, 2, 1, 1 };                          // shares T0's corner (1, 0, 0)
constexpr double BESIDE[9] = { 2, 0.25, -1, 2, 0.25, 1, 2.5, 0.25, 1 };              // crosses the plane beside the face
constexpr double dist(const double* a, const double* b) { return root(tri_tri2(Tri{ a }, Tri{ b }, INF)); }
constexpr bool meets(const double* a, const double* b) { return tri_meets(Tri{ a }, Tri{ b }); }
static_assert(dist(T0, LIFT) == 0.5, "parallel faces 0.5 apart");
static_assert(dist(T0, OVER) == 0.5, "a vertex 0.5 over a face");
static_assert(dist(SKEW_A, SKEW_B) == 0.25, "skew edges 0.25 apart");
static_assert(dist(T0, SPIKE) == 0, "an edge piercing a face");
static_assert(dist(T0, SLIDE) == 0, "coplanar, overlapping");
static_assert(dist(T0, SIDE) == 1, "coplanar, 1 apart");
static_assert(meets(T0, SPIKE) && meets(SPIKE, T0), "an edge piercing a face meets, both ways round");
static_assert(!meets(T0, LIFT), "parallel faces 0.5 apart do not meet");
static_assert(meets(T0, SLIDE), "coplanar overlapping triangles meet");
static_assert(meets(T0, CORNER), "two triangles sharing one corner meet");
static_assert(!meets(T0, SIDE), "coplanar triangles 1 apart do not meet");
static_assert(!meets(T0, BESIDE), "a triangle crossing the plane beside the face does not meet it");
static_assert(pad2(0.25) == (0.5 + PRUNE_PAD) * (0.5 + PRUNE_PAD) && pad2(INF) == INF, "the pruning bound");
}  // namespace analytic

// ---------------------------------------------------------------------------
// Geometry: triangles as f64 corners, and a bounding-volume tree over them.
struct Node {
  Box box;
  int left;    // index of the first child (the second is left + 1), or -1 at a leaf
  int start;   // first triangle (leaf)
  int count;   // triangle count (leaf)
  int pad;
};

struct Geom {
  int ntri;
  int nnode;
  double* tri;     // 9 per triangle, in tree order
  Node* node;
  int depth;
  const u32* sidx;   // the vertex indices in tree order, 3 per slot: what a family member's refit reads (§338 landing 11)
};

static constexpr int LEAF = 8;

// In-place selection of the k-th smallest of key[lo..hi) carrying idx — Hoare's
// FIND, deterministic (the pivot is the middle element, no randomness).
static void select_k(double* key, int* idx, int lo, int hi, int k) {
  while (hi - lo > 1) {
    const double pv = key[lo + (hi - lo) / 2];
    int i = lo, j = hi - 1;
    while (i <= j) {
      while (key[i] < pv) i++;
      while (key[j] > pv) j--;
      if (i <= j) {
        const double tk = key[i]; key[i] = key[j]; key[j] = tk;
        const int ti = idx[i]; idx[i] = idx[j]; idx[j] = ti;
        i++; j--;
      }
    }
    if (k <= j) hi = j + 1;
    else if (k >= i) lo = i;
    else return;
  }
}

struct Builder {
  Tris raw; int* order; double* key; Vec3* cen; Node* node; int nnode; int depth;
};

// The box of the triangles order[start .. start + count).
static Box box_of(const Builder& B, int start, int count) {
  Box b = Box::empty();
  for (int t = start; t < start + count; t++)
    for (int c = 0; c < 3; c++) b.grow(B.raw[B.order[t], c]);
  return b;
}

// Build a subtree whose root goes in slot `slot` (already reserved); its own
// children are reserved at the end of the array. A node splits at the median of its
// triangles' centres along its box's longest axis.
static void build_node(Builder& B, int slot, int start, int count, int depth) {
  Node& n = B.node[slot];
  if (depth > B.depth) B.depth = depth;
  n = { .box = box_of(B, start, count), .left = -1, .start = start, .count = count, .pad = 0 };
  if (count <= LEAF) return;
  const Vec3 ext = n.box.mx - n.box.mn;
  int ax = 0;
  if (ext[1] > ext[ax]) ax = 1;
  if (ext[2] > ext[ax]) ax = 2;
  for (int t = start; t < start + count; t++) B.key[t] = B.cen[B.order[t]][ax];
  const int half = count / 2;
  select_k(B.key, B.order, start, start + count, start + half);
  const int l = B.nnode; B.nnode += 2;
  B.node[slot].left = l;
  build_node(B, l, start, half, depth + 1);
  build_node(B, l + 1, start + half, count - half, depth + 1);
}

extern "C" {

// Build a geometry from three.js' buffers: `pos` f32 × 3 per vertex, `idx` u32 × 3
// per triangle (an unindexed geometry is passed with an identity index). Returns a
// handle (a pointer into linear memory) or 0 when memory ran out.
__attribute__((export_name("geom_create"))) u32 geom_create(u32 posPtr, u32 nvert, u32 idxPtr, u32 ntri) {
  const float* pos = at<const float>(posPtr);
  const u32* idx = at<const u32>(idxPtr);
  (void)nvert;
  const u32 gp = alloc(sizeof(Geom));
  if (!gp) return 0;
  const u32 maxNode = ntri ? 2 * ntri : 1;
  const u32 rawP = alloc(ntri * 9 * 8), triP = alloc(ntri * 9 * 8), nodeP = alloc(maxNode * sizeof(Node));
  const u32 orderP = alloc(ntri * 4), keyP = alloc(ntri * 8), cenP = alloc(ntri * sizeof(Vec3)), sidxP = alloc(ntri * 12);
  if (!rawP || !triP || !nodeP || !orderP || !keyP || !cenP || !sidxP) return 0;
  const Tris raw{ at<double>(rawP) };
  Vec3* cen = at<Vec3>(cenP);
  int* order = at<int>(orderP);
  for (u32 t = 0; t < ntri; t++) {
    for (int c = 0; c < 3; c++) {
      const u32 v = idx[3 * t + c];
      for (int a = 0; a < 3; a++) raw[t, c, a] = static_cast<double>(pos[3 * v + a]);
    }
    cen[t] = (raw[t, 0] + raw[t, 1] + raw[t, 2]) / 3.0;
    order[t] = static_cast<int>(t);
  }
  Builder B{ .raw = raw, .order = order, .key = at<double>(keyP), .cen = cen, .node = at<Node>(nodeP), .nnode = 1, .depth = 0 };
  if (ntri) build_node(B, 0, 0, static_cast<int>(ntri), 0);
  else B.node[0] = { .box = Box::empty(), .left = -1, .start = 0, .count = 0, .pad = 0 };
  const Tris tri{ at<double>(triP) };
  u32* sidx = at<u32>(sidxP);
  for (u32 t = 0; t < ntri; t++) for (int c = 0; c < 3; c++) {
    tri.set(t, c, raw[order[t], c]);
    sidx[3 * t + c] = idx[3 * static_cast<u32>(order[t]) + c];
  }
  *at<Geom>(gp) = { .ntri = static_cast<int>(ntri), .nnode = B.nnode, .tri = tri.p, .node = B.node, .depth = B.depth, .sidx = sidx };
  return gp;
}

// §338 landing 11 — THE REFIT: a geometry of the family `fam` was built from, at new
// positions. The caller (src/kernel.js) has established that the new geometry holds
// exactly the family's SET of vertex triples, each once, so the triangle in slot t is
// the family's slot-t triple read at these positions, and no index is passed. The
// family's tree SHAPE is kept (left, start, count, depth); only what depends on the
// positions is recomputed: the triangles in tree order, every leaf's box from its
// triangles, every inner box as the union of its children's, in one descending pass
// (children are numbered after their parent). src/exact-mesh.js' `refit` is the same
// pass. A union of exact boxes is the exact box, and no answer depends on the shape
// (a pair is pruned only past PRUNE_PAD), so a refitted tree answers what a fresh one
// does, which G3's refit tier holds by Object.is. Returns a handle, or 0 when memory
// ran out.
__attribute__((export_name("geom_refit"))) u32 geom_refit(u32 famH, u32 posPtr) {
  const Geom& F = *at<const Geom>(famH);
  const float* pos = at<const float>(posPtr);
  const u32 ntri = static_cast<u32>(F.ntri), nnode = static_cast<u32>(F.nnode);
  const u32 gp = alloc(sizeof(Geom)), triP = alloc(ntri * 9 * 8), nodeP = alloc(nnode * sizeof(Node));
  if (!gp || !triP || !nodeP) return 0;
  const Tris tri{ at<double>(triP) };
  for (u32 t = 0; t < ntri; t++)
    for (int c = 0; c < 3; c++) {
      const u32 v = F.sidx[3 * t + c];
      for (int a = 0; a < 3; a++) tri[t, c, a] = static_cast<double>(pos[3 * v + a]);
    }
  Node* node = at<Node>(nodeP);
  for (int slot = static_cast<int>(nnode) - 1; slot >= 0; slot--) {
    const Node& f = F.node[slot];
    Box box = Box::empty();
    if (f.left < 0) {
      for (int t = f.start; t < f.start + f.count; t++) for (int c = 0; c < 3; c++) box.grow(tri[t, c]);
    } else {
      for (int ch = f.left; ch <= f.left + 1; ch++)
        for (int a = 0; a < 3; a++) {
          box.mn[a] = dmin(box.mn[a], node[ch].box.mn[a]);
          box.mx[a] = dmax(box.mx[a], node[ch].box.mx[a]);
        }
    }
    node[slot] = { .box = box, .left = f.left, .start = f.start, .count = f.count, .pad = 0 };
  }
  *at<Geom>(gp) = { .ntri = F.ntri, .nnode = F.nnode, .tri = tri.p, .node = node, .depth = F.depth, .sidx = F.sidx };
  return gp;
}

}  // extern "C"

// ---------------------------------------------------------------------------
// The query. B is mapped into A's frame LAZILY: an inner B node's box is the
// axis-aligned box of its own box's eight corners mapped (a superset, so a distance
// to it is still a lower bound), and a leaf's triangles are mapped only when the
// traversal reaches that leaf, each term for term as three.js' applyMatrix4 maps it
// (so the arithmetic is the reference's frame convention, B into A, and a distance
// the same function of the same rounded corners). Both are stamped per query, so a
// query costs what it visits, not B's size.
struct Query {
  const Geom* A; const Geom* B; const double* m;
  Tris btri;                 // B's triangles in A's frame, tree order (valid where the leaf is stamped)
  Box* bbx;                  // B's node boxes in A's frame (valid where stamped)
  u32* boxStamp; u32* triStamp;
  u32 qid;
  Vec3 ax[3];                // B's own axes in A's frame, unit (M's columns, normalized)
  Vec3 col[3];               // M's columns as they are
  double best2;
  double prune2;             // (√best2 + PRUNE_PAD)²: a node is skipped only past this
  bool done;
  u32 pairs;
};

static u32 query_id = 0;
static u32 scratch(u32 bytes) {
  if (bytes > scratch_cap) {
    scratch_ptr = alloc(bytes);
    scratch_cap = scratch_ptr ? bytes : 0;
    if (scratch_ptr) { u8* z = at<u8>(scratch_ptr); for (u32 i = 0; i < bytes; i++) z[i] = 0; query_id = 0; }
  }
  return scratch_ptr;
}

// A point of B's frame in A's: three.js' applyMatrix4, term for term.
[[nodiscard]] static constexpr Vec3 map_point(const double* m, Vec3 v) {
  const double x = v.x, y = v.y, z = v.z;
  const double w = 1.0 / (m[3] * x + m[7] * y + m[11] * z + m[15]);
  return { (m[0] * x + m[4] * y + m[8] * z + m[12]) * w,
           (m[1] * x + m[5] * y + m[9] * z + m[13]) * w,
           (m[2] * x + m[6] * y + m[10] * z + m[14]) * w };
}

static void leaf_tris(Query& Q, int n) {
  if (Q.triStamp[n] == Q.qid) return;
  Q.triStamp[n] = Q.qid;
  const Node& nd = Q.B->node[n];
  const Tris src{ Q.B->tri };
  for (int t = nd.start; t < nd.start + nd.count; t++)
    for (int c = 0; c < 3; c++) Q.btri.set(t, c, map_point(Q.m, src[t, c]));
}

// A B node's box in A's frame. A LEAF's is exact, read off its mapped triangles (at
// most LEAF of them, and a visited leaf needs them mapped anyway); an inner node's
// is the box of its own box's eight mapped corners, which is looser under a rotation
// but costs eight points, not the subtree.
static void bbox(Query& Q, int n) {
  if (Q.boxStamp[n] == Q.qid) return;
  Q.boxStamp[n] = Q.qid;
  const Node& nd = Q.B->node[n];
  Box& b = Q.bbx[n];
  b = Box::empty();
  if (nd.left < 0) {
    leaf_tris(Q, n);
    for (int t = nd.start; t < nd.start + nd.count; t++)
      for (int c = 0; c < 3; c++) b.grow(Q.btri[t, c]);
    return;
  }
  for (int c = 0; c < 8; c++) {
    const Vec3 v{ (c & 1) ? nd.box.mx.x : nd.box.mn.x, (c & 2) ? nd.box.mx.y : nd.box.mn.y, (c & 4) ? nd.box.mx.z : nd.box.mn.z };
    b.grow(map_point(Q.m, v));
  }
}

// A lower bound on the squared distance between A's node box `a` (axis-aligned in its
// own frame) and B's node `b`: the larger of the two boxes' axis-aligned gap (B's box
// in A's frame) and, for an inner B node, the gap between their projections on each
// of B's own three axes. Each is a distance along a line, so each bounds the true
// distance from below and so does their maximum; the projections are what keep a
// ROTATED thin slab (the base plate seen from a turned part) from swelling to its
// rotated box's box across its thin axis.
[[nodiscard]] static double lower2(const Query& Q, const Box& a, int b) {
  double g = box_dist2(a, Q.bbx[b]);
  const Node& nb = Q.B->node[b];
  if (nb.left < 0) return g;
  const Vec3 ac = (a.mn + a.mx) * 0.5;
  const Vec3 ah = (a.mx - a.mn) * 0.5;
  const Vec3 bc = map_point(Q.m, (nb.box.mn + nb.box.mx) * 0.5);
  for (int k = 0; k < 3; k++) {
    const Vec3 u = Q.ax[k];
    // B's box mapped is a parallelepiped with edges M's columns × its half extents:
    // its radius on u is the sum of each edge's projection (orthogonal or not).
    double rb = 0;
    for (int j = 0; j < 3; j++) rb += __builtin_fabs(dot(u, Q.col[j])) * (nb.box.mx[j] - nb.box.mn[j]) * 0.5;
    const double ra = dot(fabs3(u), ah);
    const double sep = __builtin_fabs(dot(u, bc - ac)) - ra - rb;
    if (sep > 0 && sep * sep > g) g = sep * sep;
  }
  return g;
}

// Descend the node with the larger box (A on a tie).
[[nodiscard]] static bool split_a(const Query& Q, const Node& na, const Node& nb, int b) {
  if (na.left < 0) return false;
  if (nb.left < 0) return true;
  double ea = 0, eb = 0;
  for (int k = 0; k < 3; k++) { ea += na.box.mx[k] - na.box.mn[k]; eb += Q.bbx[b].mx[k] - Q.bbx[b].mn[k]; }
  return ea >= eb;
}

// §338 landing 7 — THE TRIANGLE PAIR'S OWN BOX, a cheap bound in front of the exact
// test. A leaf pair holds up to 64 triangle pairs and each exact test is six
// point–triangle and nine segment–segment distances, which a contact query bounded
// at 1e-4 almost never needs: a pair is skipped on the rule a node is (its box gap
// clear of the best by PRUNE_PAD, or, for the meet, over PRUNE_PAD), so for the same
// reason no skipped pair could have set the answer.
template <class PairTest>
static void leaf_pairs(Query& Q, const Node& na, const Node& nb, int b, PairTest&& test) {
  leaf_tris(Q, b);
  Box tb[LEAF];
  for (int j = 0; j < nb.count; j++) tb[j] = tri_box(Q.btri[nb.start + j]);
  const Tris atri{ Q.A->tri };
  for (int i = na.start; i < na.start + na.count; i++) {
    const Box ta = tri_box(atri[i]);
    for (int j = nb.start; j < nb.start + nb.count; j++)
      if (test(atri[i], Q.btri[j], box_dist2(ta, tb[j - nb.start]))) return;
  }
}

static void visit(Query& Q, int a, int b) {
  if (Q.done) return;
  const Node& na = Q.A->node[a];
  const Node& nb = Q.B->node[b];
  if (na.left < 0 && nb.left < 0) {
    leaf_pairs(Q, na, nb, b, [&Q](Tri p, Tri q, double gap2) {
      if (!(gap2 < Q.prune2)) return false;
      Q.pairs++;
      const double d = tri_tri2(p, q, Q.best2);
      if (d < Q.best2) { Q.best2 = d; Q.prune2 = pad2(d); if (d == 0) { Q.done = true; return true; } }
      return false;
    });
    return;
  }
  // Descend the larger node, nearer child first.
  const bool splitA = split_a(Q, na, nb, b);
  int c0, c1; double d0, d1;
  if (splitA) {
    c0 = na.left; c1 = na.left + 1;
    d0 = lower2(Q, Q.A->node[c0].box, b);
    d1 = lower2(Q, Q.A->node[c1].box, b);
  } else {
    c0 = nb.left; c1 = nb.left + 1;
    bbox(Q, c0); bbox(Q, c1);
    d0 = lower2(Q, na.box, c0);
    d1 = lower2(Q, na.box, c1);
  }
  if (d1 < d0) { const int tc = c0; c0 = c1; c1 = tc; const double td = d0; d0 = d1; d1 = td; }
  if (d0 < Q.prune2) { if (splitA) visit(Q, c0, b); else visit(Q, a, c0); }
  if (d1 < Q.prune2) { if (splitA) visit(Q, c1, b); else visit(Q, a, c1); }
}

// A pair is skipped only when its boxes stand apart by more than the pruning margin
// (PRUNE_PAD, the distance query's own reason): a bound computed an ulp over 0 must
// not hide a touching pair.
static constexpr double MEET_PAD2 = PRUNE_PAD * PRUNE_PAD;

static void visit_meets(Query& Q, int a, int b) {
  if (Q.done) return;
  const Node& na = Q.A->node[a];
  const Node& nb = Q.B->node[b];
  if (na.left < 0 && nb.left < 0) {
    leaf_pairs(Q, na, nb, b, [&Q](Tri p, Tri q, double gap2) {
      if (gap2 > MEET_PAD2) return false;
      Q.pairs++;
      if (tri_meets(p, q)) { Q.done = true; return true; }
      return false;
    });
    return;
  }
  if (split_a(Q, na, nb, b)) {
    for (int c = na.left; c <= na.left + 1; c++)
      if (!(lower2(Q, Q.A->node[c].box, b) > MEET_PAD2)) { visit_meets(Q, c, b); if (Q.done) return; }
  } else {
    for (int c = nb.left; c <= nb.left + 1; c++) {
      bbox(Q, c);
      if (!(lower2(Q, na.box, c) > MEET_PAD2)) { visit_meets(Q, a, c); if (Q.done) return; }
    }
  }
}

static u32 last_pairs = 0;

// One query's setup, shared by both primitives: B's scratch in A's frame, the
// stamps, and M's columns for the projection bounds. False when the scratch does not
// fit (the caller resets the arena and asks again).
[[nodiscard]] static bool begin_query(Query& Q, const Geom* A, const Geom* B, u32 matPtr) {
  const u32 nn = static_cast<u32>(B->nnode);
  const u32 need = static_cast<u32>(B->ntri) * 9 * 8 + nn * sizeof(Box) + nn * 4 * 2;
  const u32 sp = scratch(need);
  if (!sp) return false;
  Q.A = A; Q.B = B; Q.m = at<const double>(matPtr);
  Q.btri = Tris{ at<double>(sp) };
  Q.bbx = reinterpret_cast<Box*>(Q.btri.p + 9 * B->ntri);
  Q.boxStamp = reinterpret_cast<u32*>(Q.bbx + nn);
  Q.triStamp = Q.boxStamp + nn;
  Q.qid = ++query_id;
  if (Q.qid == 0) {   // the stamp wrapped: clear and start again
    for (u32 i = 0; i < 2 * nn; i++) Q.boxStamp[i] = 0;
    Q.qid = query_id = 1;
  }
  for (int k = 0; k < 3; k++) {
    const Vec3 c{ Q.m[4 * k], Q.m[4 * k + 1], Q.m[4 * k + 2] };
    const double L = root(dot(c, c));
    Q.col[k] = c;
    Q.ax[k] = L > 0 ? c / L : Vec3{ 0, 0, 0 };
  }
  Q.done = false; Q.pairs = 0;
  bbox(Q, 0);
  return true;
}

extern "C" {

// The closest distance between A (its own frame) and B placed by the matrix at
// `matPtr` (B's frame → A's, column-major), +Infinity when no pair is closer than
// `upper`, or -1 when the scratch did not fit.
__attribute__((export_name("distance"))) double distance(u32 hA, u32 hB, u32 matPtr, double upper) {
  const Geom* A = at<const Geom>(hA);
  const Geom* B = at<const Geom>(hB);
  last_pairs = 0;
  if (!A->ntri || !B->ntri) return INF;
  Query Q;
  if (!begin_query(Q, A, B, matPtr)) return -1;   // out of memory: the caller resets and asks again
  Q.best2 = upper < INF ? upper * upper : INF;
  Q.prune2 = pad2(Q.best2);
  if (lower2(Q, A->node[0].box, 0) < Q.prune2) visit(Q, 0, 0);
  last_pairs = Q.pairs;
  const double d = root(Q.best2);
  return d < upper ? d : INF;
}

// 1 when some triangle of A meets some triangle of B under M, 0 when none does, -1
// when the scratch did not fit.
__attribute__((export_name("intersects"))) int intersects(u32 hA, u32 hB, u32 matPtr) {
  const Geom* A = at<const Geom>(hA);
  const Geom* B = at<const Geom>(hB);
  last_pairs = 0;
  if (!A->ntri || !B->ntri) return 0;
  Query Q;
  if (!begin_query(Q, A, B, matPtr)) return -1;
  Q.best2 = 0; Q.prune2 = 0;
  if (!(lower2(Q, A->node[0].box, 0) > MEET_PAD2)) visit_meets(Q, 0, 0);
  last_pairs = Q.pairs;
  return Q.done ? 1 : 0;
}

__attribute__((export_name("last_pairs"))) u32 last_pairs_get() { return last_pairs; }
__attribute__((export_name("geom_ntri"))) u32 geom_ntri(u32 h) { return static_cast<u32>(at<const Geom>(h)->ntri); }

}  // extern "C"
