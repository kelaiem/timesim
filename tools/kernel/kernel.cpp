// §338 landing 5 — THE KERNEL'S FIRST PRIMITIVE: the closest distance between two
// triangle meshes, one placed in the other's frame by a rigid matrix.
//
// Built by tools/kernel-build.mjs to wasm32 (src/kernel-wasm.js, GENERATED; never
// edit it), and called only through src/kernel.js' `Kernel` interface. The JS path
// (three-mesh-bvh's closestPointToGeometry) stays the reference and the default;
// tools/probe-338-kernel-parity.mjs holds this to it (G3).
//
// FREESTANDING C++17: no libc, no std, no exceptions, no allocation but the bump
// arena below. The only floating point is + − × ÷ and sqrt (__builtin_sqrt is
// f64.sqrt, correctly rounded by the wasm spec), and the build passes
// -ffp-contract=off and refuses SIMD, so the result is the same bits on every host
// that runs the module. Every loop runs in index order and every tie keeps the
// FIRST minimum, so nothing depends on traversal order but the pruning, and pruning
// is sound (a box distance is a lower bound on every triangle distance under it).
//
// THE QUERY. distance(A, B, M, upper): the smallest Euclidean distance between a
// triangle of A (in A's frame) and a triangle of B mapped by M (B's frame → A's,
// three.js' column-major 4×4), or +Infinity when no pair is closer than `upper`.
// Exact where the reference is not: two triangles count as touching only when an
// edge of one PIERCES the other (Möller–Trumbore on the segment), never by a
// boolean that can report separated triangles as crossing (inspect.js'
// meshClearance comment records the reference's false-0 mode).

typedef unsigned int u32;
typedef unsigned char u8;

extern "C" unsigned char __heap_base;

static u32 heap_top = 0;
static u32 heap_start = 0;

static u32 align8(u32 x) { return (x + 7u) & ~7u; }

// Grow linear memory to hold [0, end).
static bool ensure_memory(u32 end) {
  u32 have = (u32)__builtin_wasm_memory_size(0) * 65536u;
  if (end <= have) return true;
  u32 pages = (end - have + 65535u) / 65536u;
  return __builtin_wasm_memory_grow(0, pages) != (unsigned long)-1;
}

extern "C" {

static u32 scratch_cap = 0, scratch_ptr = 0;   // the query's reusable scratch (below)

__attribute__((export_name("reset"))) void reset() {
  if (!heap_start) heap_start = align8((u32)(unsigned long)&__heap_base);
  heap_top = heap_start;
  scratch_cap = 0; scratch_ptr = 0;   // the scratch lived in the arena: it is gone with it
}

__attribute__((export_name("alloc"))) u32 alloc(u32 bytes) {
  if (!heap_start) reset();
  u32 p = align8(heap_top);
  u32 end = p + align8(bytes);
  if (end < p || !ensure_memory(end)) return 0;
  heap_top = end;
  return p;
}

__attribute__((export_name("heap_used"))) u32 heap_used() { return heap_top - heap_start; }

}  // extern "C"

// ---------------------------------------------------------------------------
// Geometry: triangles as f64 corners, and a bounding-volume tree over them.
struct Node {
  double mn[3], mx[3];
  int left;    // child index of the first child (the second is left + 1), or -1 at a leaf
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
};

static const int LEAF = 8;

static double dmin(double a, double b) { return b < a ? b : a; }
static double dmax(double a, double b) { return b > a ? b : a; }

// In-place selection of the k-th smallest of key[lo..hi) carrying idx — Hoare's
// FIND, deterministic (the pivot is the middle element, no randomness).
static void select_k(double* key, int* idx, int lo, int hi, int k) {
  while (hi - lo > 1) {
    double pv = key[lo + (hi - lo) / 2];
    int i = lo, j = hi - 1;
    while (i <= j) {
      while (key[i] < pv) i++;
      while (key[j] > pv) j--;
      if (i <= j) {
        double tk = key[i]; key[i] = key[j]; key[j] = tk;
        int ti = idx[i]; idx[i] = idx[j]; idx[j] = ti;
        i++; j--;
      }
    }
    if (k <= j) hi = j + 1;
    else if (k >= i) lo = i;
    else return;
  }
}

static void box_of(const double* tri, const int* order, int start, int count, double* mn, double* mx) {
  mn[0] = mn[1] = mn[2] = __builtin_inf();
  mx[0] = mx[1] = mx[2] = -__builtin_inf();
  for (int t = start; t < start + count; t++) {
    const double* p = tri + 9 * order[t];
    for (int c = 0; c < 3; c++)
      for (int a = 0; a < 3; a++) { mn[a] = dmin(mn[a], p[3 * c + a]); mx[a] = dmax(mx[a], p[3 * c + a]); }
  }
}

struct Builder {
  const double* tri; int* order; double* key; double* cen; Node* node; int nnode; int depth;
};

// Build a subtree whose root goes in slot `slot` (already reserved); its own
// children are reserved at the end of the array.
static void build_node_into(Builder& B, int slot, int start, int count, int depth);

static void build_node_into(Builder& B, int slot, int start, int count, int depth) {
  Node& n = B.node[slot];
  if (depth > B.depth) B.depth = depth;
  box_of(B.tri, B.order, start, count, n.mn, n.mx);
  n.start = start; n.count = count; n.left = -1; n.pad = 0;
  if (count <= LEAF) return;
  double ext[3] = { n.mx[0] - n.mn[0], n.mx[1] - n.mn[1], n.mx[2] - n.mn[2] };
  int ax = 0;
  if (ext[1] > ext[ax]) ax = 1;
  if (ext[2] > ext[ax]) ax = 2;
  for (int t = start; t < start + count; t++) B.key[t] = B.cen[3 * B.order[t] + ax];
  int half = count / 2;
  select_k(B.key, B.order, start, start + count, start + half);
  int l = B.nnode; B.nnode += 2;
  B.node[slot].left = l;
  build_node_into(B, l, start, half, depth + 1);
  build_node_into(B, l + 1, start + half, count - half, depth + 1);
}

extern "C" {

// Build a geometry from three.js' buffers: `pos` f32 × 3 per vertex, `idx` u32 × 3
// per triangle (an unindexed geometry is passed with an identity index). Returns a
// handle (a pointer into linear memory) or 0 when memory ran out.
__attribute__((export_name("geom_create"))) u32 geom_create(u32 posPtr, u32 nvert, u32 idxPtr, u32 ntri) {
  const float* pos = (const float*)(unsigned long)posPtr;
  const u32* idx = (const u32*)(unsigned long)idxPtr;
  (void)nvert;
  u32 gp = alloc(sizeof(Geom));
  if (!gp) return 0;
  Geom* g = (Geom*)(unsigned long)gp;
  u32 maxNode = ntri ? 2 * ntri : 1;
  u32 triRaw = alloc(ntri * 9 * 8), triP = alloc(ntri * 9 * 8), nodeP = alloc(maxNode * sizeof(Node));
  u32 orderP = alloc(ntri * 4), keyP = alloc(ntri * 8), cenP = alloc(ntri * 3 * 8);
  if (!triRaw || !triP || !nodeP || !orderP || !keyP || !cenP) return 0;
  double* raw = (double*)(unsigned long)triRaw;
  double* cen = (double*)(unsigned long)cenP;
  int* order = (int*)(unsigned long)orderP;
  for (u32 t = 0; t < ntri; t++) {
    for (int c = 0; c < 3; c++) {
      u32 v = idx[3 * t + c];
      for (int a = 0; a < 3; a++) raw[9 * t + 3 * c + a] = (double)pos[3 * v + a];
    }
    for (int a = 0; a < 3; a++) cen[3 * t + a] = (raw[9 * t + a] + raw[9 * t + 3 + a] + raw[9 * t + 6 + a]) / 3.0;
    order[t] = (int)t;
  }
  Builder B{ raw, order, (double*)(unsigned long)keyP, cen, (Node*)(unsigned long)nodeP, 1, 0 };
  if (ntri) build_node_into(B, 0, 0, (int)ntri, 0);
  else { Node& n = B.node[0]; n.mn[0] = n.mn[1] = n.mn[2] = __builtin_inf(); n.mx[0] = n.mx[1] = n.mx[2] = -__builtin_inf(); n.left = -1; n.start = 0; n.count = 0; }
  double* tri = (double*)(unsigned long)triP;
  for (u32 t = 0; t < ntri; t++) for (int k = 0; k < 9; k++) tri[9 * t + k] = raw[9 * order[t] + k];
  g->ntri = (int)ntri; g->nnode = B.nnode; g->tri = tri; g->node = B.node; g->depth = B.depth;
  return gp;
}

}  // extern "C"

// ---------------------------------------------------------------------------
// Triangle–triangle distance, squared.
static inline void sub(const double* a, const double* b, double* o) { o[0] = a[0] - b[0]; o[1] = a[1] - b[1]; o[2] = a[2] - b[2]; }
static inline double dot(const double* a, const double* b) { return a[0] * b[0] + a[1] * b[1] + a[2] * b[2]; }
static inline void cross(const double* a, const double* b, double* o) {
  o[0] = a[1] * b[2] - a[2] * b[1]; o[1] = a[2] * b[0] - a[0] * b[2]; o[2] = a[0] * b[1] - a[1] * b[0];
}
static inline double dist2(const double* a, const double* b) { double d[3]; sub(a, b, d); return dot(d, d); }
static inline double clamp01(double x) { return x < 0 ? 0 : (x > 1 ? 1 : x); }

static double point_seg2(const double* p, const double* a, const double* b) {
  double ab[3], ap[3]; sub(b, a, ab); sub(p, a, ap);
  double L = dot(ab, ab);
  double t = L > 0 ? clamp01(dot(ap, ab) / L) : 0;
  double q[3] = { a[0] + ab[0] * t, a[1] + ab[1] * t, a[2] + ab[2] * t };
  return dist2(p, q);
}

// Ericson, Real-Time Collision Detection §5.1.5, with a degenerate triangle
// answered by its edges.
static double point_tri2(const double* p, const double* a, const double* b, const double* c) {
  double ab[3], ac[3], ap[3], n[3];
  sub(b, a, ab); sub(c, a, ac); cross(ab, ac, n);
  if (!(dot(n, n) > 0)) return dmin(point_seg2(p, a, b), dmin(point_seg2(p, b, c), point_seg2(p, c, a)));
  sub(p, a, ap);
  double d1 = dot(ab, ap), d2 = dot(ac, ap);
  if (d1 <= 0 && d2 <= 0) return dist2(p, a);
  double bp[3]; sub(p, b, bp);
  double d3 = dot(ab, bp), d4 = dot(ac, bp);
  if (d3 >= 0 && d4 <= d3) return dist2(p, b);
  double vc = d1 * d4 - d3 * d2;
  if (vc <= 0 && d1 >= 0 && d3 <= 0) {
    double v = d1 / (d1 - d3);
    double q[3] = { a[0] + ab[0] * v, a[1] + ab[1] * v, a[2] + ab[2] * v };
    return dist2(p, q);
  }
  double cp[3]; sub(p, c, cp);
  double d5 = dot(ab, cp), d6 = dot(ac, cp);
  if (d6 >= 0 && d5 <= d6) return dist2(p, c);
  double vb = d5 * d2 - d1 * d6;
  if (vb <= 0 && d2 >= 0 && d6 <= 0) {
    double w = d2 / (d2 - d6);
    double q[3] = { a[0] + ac[0] * w, a[1] + ac[1] * w, a[2] + ac[2] * w };
    return dist2(p, q);
  }
  double va = d3 * d6 - d5 * d4;
  if (va <= 0 && (d4 - d3) >= 0 && (d5 - d6) >= 0) {
    double w = (d4 - d3) / ((d4 - d3) + (d5 - d6));
    double q[3] = { b[0] + (c[0] - b[0]) * w, b[1] + (c[1] - b[1]) * w, b[2] + (c[2] - b[2]) * w };
    return dist2(p, q);
  }
  double den = 1.0 / (va + vb + vc);
  double v = vb * den, w = vc * den;
  double q[3] = { a[0] + ab[0] * v + ac[0] * w, a[1] + ab[1] * v + ac[1] * w, a[2] + ab[2] * v + ac[2] * w };
  return dist2(p, q);
}

// Ericson §5.1.9: the closest points of two segments.
static double seg_seg2(const double* p1, const double* q1, const double* p2, const double* q2) {
  double d1[3], d2[3], r[3];
  sub(q1, p1, d1); sub(q2, p2, d2); sub(p1, p2, r);
  double a = dot(d1, d1), e = dot(d2, d2), f = dot(d2, r);
  double s, t;
  if (!(a > 0) && !(e > 0)) return dist2(p1, p2);
  if (!(a > 0)) { s = 0; t = clamp01(f / e); }
  else {
    double c = dot(d1, r);
    if (!(e > 0)) { t = 0; s = clamp01(-c / a); }
    else {
      double b = dot(d1, d2), den = a * e - b * b;
      s = den > 0 ? clamp01((b * f - c * e) / den) : 0;
      t = (b * s + f) / e;
      if (t < 0) { t = 0; s = clamp01(-c / a); }
      else if (t > 1) { t = 1; s = clamp01((b - c) / a); }
    }
  }
  double c1[3] = { p1[0] + d1[0] * s, p1[1] + d1[1] * s, p1[2] + d1[2] * s };
  double c2[3] = { p2[0] + d2[0] * t, p2[1] + d2[1] * t, p2[2] + d2[2] * t };
  return dist2(c1, c2);
}

// Does segment p→q pass through triangle (a, b, c)? Möller–Trumbore; a segment in
// the triangle's plane is answered by the edge and corner distances instead.
static bool seg_pierces(const double* p, const double* q, const double* a, const double* b, const double* c) {
  double dir[3], e1[3], e2[3], h[3], s[3], qv[3];
  sub(q, p, dir); sub(b, a, e1); sub(c, a, e2);
  cross(dir, e2, h);
  double det = dot(e1, h);
  if (det == 0) return false;
  double inv = 1.0 / det;
  sub(p, a, s);
  double u = inv * dot(s, h);
  if (u < 0 || u > 1) return false;
  cross(s, e1, qv);
  double v = inv * dot(dir, qv);
  if (v < 0 || u + v > 1) return false;
  double t = inv * dot(e2, qv);
  return t >= 0 && t <= 1;
}

static double tri_tri2(const double* P, const double* Q, double best) {
  const double* p[3] = { P, P + 3, P + 6 };
  const double* q[3] = { Q, Q + 3, Q + 6 };
  for (int i = 0; i < 3; i++) {
    int j = (i + 1) % 3;
    if (seg_pierces(p[i], p[j], q[0], q[1], q[2])) return 0;
    if (seg_pierces(q[i], q[j], p[0], p[1], p[2])) return 0;
  }
  double m = best;
  for (int i = 0; i < 3; i++) {
    m = dmin(m, point_tri2(q[i], p[0], p[1], p[2]));
    m = dmin(m, point_tri2(p[i], q[0], q[1], q[2]));
  }
  for (int i = 0; i < 3; i++)
    for (int j = 0; j < 3; j++)
      m = dmin(m, seg_seg2(p[i], p[(i + 1) % 3], q[j], q[(j + 1) % 3]));
  return m;
}

static double box_dist2(const double* amn, const double* amx, const double* bmn, const double* bmx) {
  double s = 0;
  for (int a = 0; a < 3; a++) {
    double g = dmax(bmn[a] - amx[a], amn[a] - bmx[a]);
    if (g > 0) s += g * g;
  }
  return s;
}

// ---------------------------------------------------------------------------
// The query. B is mapped into A's frame LAZILY: a B node's box is the axis-aligned
// box of its own box's eight corners mapped (a superset, so a distance to it is
// still a lower bound), and a leaf's triangles are mapped only when the traversal
// reaches that leaf, each term for term as three.js' applyMatrix4 maps it (so the
// arithmetic is the reference's frame convention, B into A, and a distance the
// same function of the same rounded corners). Both are stamped per query, so a
// query costs what it visits, not B's size.
struct Query {
  const Geom* A; const Geom* B; const double* m;
  double* btri;              // B's triangles in A's frame, tree order (valid where the leaf is stamped)
  double* bmn; double* bmx;  // B's node boxes in A's frame (valid where stamped)
  u32* boxStamp; u32* triStamp;
  u32 qid;
  double ax[3][3];           // B's own axes in A's frame, unit (M's columns, normalized)
  double col[3][3];          // M's columns as they are
  double best2;
  double prune2;             // (√best2 + PRUNE_PAD)²: a node is skipped only past this
  bool done;
  u32 pairs;
};

// PRUNING IS EXACT ONLY WITH A MARGIN. A box bound and a triangle distance are
// different arithmetic on the same corners, and where a triangle lies on its own
// box's face (every box is tight on its triangles) the computed bound can land an
// ulp ABOVE the computed distance and prune the very pair that holds the minimum,
// which moved one expectedContacts witness between two builds of this kernel. So a
// node is skipped only when its bound clears the best by PRUNE_PAD: the movement's
// coordinates are under 100 units, an ulp there is 1.4e-14, a bound and a distance
// each carry under ten roundings, so their difference is under 1.4e-13, and 1e-12
// is clear of it. With the margin, the answer is the exact minimum of tri_tri2 over
// every pair under `upper`, whatever the traversal visits first.
static const double PRUNE_PAD = 1e-12;
static inline double pad2(double best2) {
  if (!(best2 < __builtin_inf())) return best2;
  double r = __builtin_sqrt(best2) + PRUNE_PAD;
  return r * r;
}

static u32 query_id = 0;
static u32 scratch(u32 bytes) {
  if (bytes > scratch_cap) {
    scratch_ptr = alloc(bytes);
    scratch_cap = scratch_ptr ? bytes : 0;
    if (scratch_ptr) { u8* z = (u8*)(unsigned long)scratch_ptr; for (u32 i = 0; i < bytes; i++) z[i] = 0; query_id = 0; }
  }
  return scratch_ptr;
}

static inline void map_point(const double* m, const double* v, double* o) {
  double x = v[0], y = v[1], z = v[2];
  double w = 1.0 / (m[3] * x + m[7] * y + m[11] * z + m[15]);
  o[0] = (m[0] * x + m[4] * y + m[8] * z + m[12]) * w;
  o[1] = (m[1] * x + m[5] * y + m[9] * z + m[13]) * w;
  o[2] = (m[2] * x + m[6] * y + m[10] * z + m[14]) * w;
}

static void leaf_tris(Query& Q, int n) {
  if (Q.triStamp[n] == Q.qid) return;
  Q.triStamp[n] = Q.qid;
  const Node& nd = Q.B->node[n];
  for (int t = nd.start; t < nd.start + nd.count; t++)
    for (int c = 0; c < 3; c++) map_point(Q.m, Q.B->tri + 9 * t + 3 * c, Q.btri + 9 * t + 3 * c);
}

// A B node's box in A's frame. A LEAF's is exact, read off its mapped triangles
// (at most LEAF of them, and a visited leaf needs them mapped anyway); an inner
// node's is the box of its own box's eight mapped corners, which is looser under
// a rotation but costs eight points, not the subtree.
static void bbox(Query& Q, int n) {
  if (Q.boxStamp[n] == Q.qid) return;
  Q.boxStamp[n] = Q.qid;
  const Node& nd = Q.B->node[n];
  double* mn = Q.bmn + 3 * n; double* mx = Q.bmx + 3 * n;
  mn[0] = mn[1] = mn[2] = __builtin_inf();
  mx[0] = mx[1] = mx[2] = -__builtin_inf();
  if (nd.left < 0) {
    leaf_tris(Q, n);
    for (int t = nd.start; t < nd.start + nd.count; t++)
      for (int k = 0; k < 9; k++) { int a = k % 3; mn[a] = dmin(mn[a], Q.btri[9 * t + k]); mx[a] = dmax(mx[a], Q.btri[9 * t + k]); }
    return;
  }
  for (int c = 0; c < 8; c++) {
    double v[3] = { (c & 1) ? nd.mx[0] : nd.mn[0], (c & 2) ? nd.mx[1] : nd.mn[1], (c & 4) ? nd.mx[2] : nd.mn[2] }, o[3];
    map_point(Q.m, v, o);
    for (int a = 0; a < 3; a++) { mn[a] = dmin(mn[a], o[a]); mx[a] = dmax(mx[a], o[a]); }
  }
}

// A lower bound on the squared distance between A's node `a` (an axis-aligned box
// in its own frame) and B's node `b`: the larger of the two boxes' axis-aligned gap
// (B's box in A's frame) and, for an inner B node, the gap between their
// projections on each of B's own three axes. Each is a distance along a line, so
// each bounds the true distance from below and so does their maximum; the
// projections are what keep a ROTATED thin slab (the base plate seen from a turned
// part) from swelling to its rotated box's box across its thin axis.
static double lower2(Query& Q, const double* amn, const double* amx, int b) {
  double g = box_dist2(amn, amx, Q.bmn + 3 * b, Q.bmx + 3 * b);
  const Node& nb = Q.B->node[b];
  if (nb.left < 0) return g;
  double ac[3] = { (amn[0] + amx[0]) * 0.5, (amn[1] + amx[1]) * 0.5, (amn[2] + amx[2]) * 0.5 };
  double ah[3] = { (amx[0] - amn[0]) * 0.5, (amx[1] - amn[1]) * 0.5, (amx[2] - amn[2]) * 0.5 };
  double lc[3] = { (nb.mn[0] + nb.mx[0]) * 0.5, (nb.mn[1] + nb.mx[1]) * 0.5, (nb.mn[2] + nb.mx[2]) * 0.5 }, bc[3];
  map_point(Q.m, lc, bc);
  for (int k = 0; k < 3; k++) {
    const double* u = Q.ax[k];
    // B's box mapped is a parallelepiped with edges M's columns × its half extents:
    // its radius on u is the sum of each edge's projection (orthogonal or not).
    double rb = 0;
    for (int j = 0; j < 3; j++) {
      const double* cj = Q.col[j];
      rb += __builtin_fabs(u[0] * cj[0] + u[1] * cj[1] + u[2] * cj[2]) * (nb.mx[j] - nb.mn[j]) * 0.5;
    }
    double ra = __builtin_fabs(u[0]) * ah[0] + __builtin_fabs(u[1]) * ah[1] + __builtin_fabs(u[2]) * ah[2];
    double sep = __builtin_fabs(u[0] * (bc[0] - ac[0]) + u[1] * (bc[1] - ac[1]) + u[2] * (bc[2] - ac[2])) - ra - rb;
    if (sep > 0 && sep * sep > g) g = sep * sep;
  }
  return g;
}

static void visit(Query& Q, int a, int b) {
  if (Q.done) return;
  const Node& na = Q.A->node[a];
  const Node& nb = Q.B->node[b];
  if (na.left < 0 && nb.left < 0) {
    leaf_tris(Q, b);
    for (int i = na.start; i < na.start + na.count; i++)
      for (int j = nb.start; j < nb.start + nb.count; j++) {
        Q.pairs++;
        double d = tri_tri2(Q.A->tri + 9 * i, Q.btri + 9 * j, Q.best2);
        if (d < Q.best2) { Q.best2 = d; Q.prune2 = pad2(d); if (d == 0) { Q.done = true; return; } }
      }
    return;
  }
  // Descend the node with the larger box (A on a tie), nearer child first.
  bool splitA;
  if (na.left < 0) splitA = false;
  else if (nb.left < 0) splitA = true;
  else {
    double ea = 0, eb = 0;
    for (int k = 0; k < 3; k++) { ea += na.mx[k] - na.mn[k]; eb += Q.bmx[3 * b + k] - Q.bmn[3 * b + k]; }
    splitA = ea >= eb;
  }
  int c0, c1; double d0, d1;
  if (splitA) {
    c0 = na.left; c1 = na.left + 1;
    d0 = lower2(Q, Q.A->node[c0].mn, Q.A->node[c0].mx, b);
    d1 = lower2(Q, Q.A->node[c1].mn, Q.A->node[c1].mx, b);
  } else {
    c0 = nb.left; c1 = nb.left + 1;
    bbox(Q, c0); bbox(Q, c1);
    d0 = lower2(Q, na.mn, na.mx, c0);
    d1 = lower2(Q, na.mn, na.mx, c1);
  }
  if (d1 < d0) { int tc = c0; c0 = c1; c1 = tc; double td = d0; d0 = d1; d1 = td; }
  if (d0 < Q.prune2) { if (splitA) visit(Q, c0, b); else visit(Q, a, c0); }
  if (d1 < Q.prune2) { if (splitA) visit(Q, c1, b); else visit(Q, a, c1); }
}

static u32 last_pairs = 0;

// One query's setup, shared by both primitives: B's scratch in A's frame, the
// stamps, and M's columns for the projection bounds. False when the scratch
// does not fit (the caller resets the arena and asks again).
static bool begin_query(Query& Q, const Geom* A, const Geom* B, u32 matPtr) {
  u32 nn = (u32)B->nnode;
  u32 need = (u32)B->ntri * 9 * 8 + nn * 3 * 8 * 2 + nn * 4 * 2;
  u32 sp = scratch(need);
  if (!sp) return false;
  Q.A = A; Q.B = B; Q.m = (const double*)(unsigned long)matPtr;
  Q.btri = (double*)(unsigned long)sp;
  Q.bmn = Q.btri + 9 * B->ntri;
  Q.bmx = Q.bmn + 3 * nn;
  Q.boxStamp = (u32*)(Q.bmx + 3 * nn);
  Q.triStamp = Q.boxStamp + nn;
  Q.qid = ++query_id;
  if (Q.qid == 0) {   // the stamp wrapped: clear and start again
    for (u32 i = 0; i < 2 * nn; i++) Q.boxStamp[i] = 0;
    Q.qid = query_id = 1;
  }
  for (int k = 0; k < 3; k++) {
    double c[3] = { Q.m[4 * k], Q.m[4 * k + 1], Q.m[4 * k + 2] };
    double L = __builtin_sqrt(dot(c, c));
    for (int a = 0; a < 3; a++) { Q.col[k][a] = c[a]; Q.ax[k][a] = L > 0 ? c[a] / L : 0; }
  }
  Q.done = false; Q.pairs = 0;
  bbox(Q, 0);
  return true;
}

// ---------------------------------------------------------------------------
// §338 landing 6 — THE SECOND PRIMITIVE: does any triangle of A meet any
// triangle of B? The reference is three-mesh-bvh's intersectsGeometry, which
// inspect.js records as having a measured false-positive mode, so this one is
// EXACT on the computed corners:
//   1. a separating plane: if every corner of one triangle is strictly on one
//      side of the other's plane, they cannot meet (the cheap, common answer);
//   2. otherwise two non-coplanar triangles meet exactly when an edge of one
//      pierces the other (seg_pierces, inclusive at the boundary);
//   3. a corner exactly ON the other's plane, or a degenerate triangle, is the
//      only case 1 and 2 cannot settle (coplanar overlap, an edge lying in the
//      face, touching at a point), and there the exact distance decides: 0 is
//      meeting, anything else is not.
// Incidence is invariant under any invertible affine map, so B may be placed by
// any such M (inspect.js' boolean sites pass world matrices that may scale).
static bool tri_meets(const double* P, const double* Q) {
  const double* p[3] = { P, P + 3, P + 6 };
  const double* q[3] = { Q, Q + 3, Q + 6 };
  double e1[3], e2[3], nP[3], nQ[3];
  sub(p[1], p[0], e1); sub(p[2], p[0], e2); cross(e1, e2, nP);
  sub(q[1], q[0], e1); sub(q[2], q[0], e2); cross(e1, e2, nQ);
  bool degenerate = !(dot(nP, nP) > 0) || !(dot(nQ, nQ) > 0);
  bool onPlane = false;
  if (!degenerate) {
    double dq[3], dp[3], v[3];
    for (int i = 0; i < 3; i++) { sub(q[i], p[0], v); dq[i] = dot(nP, v); }
    if ((dq[0] > 0 && dq[1] > 0 && dq[2] > 0) || (dq[0] < 0 && dq[1] < 0 && dq[2] < 0)) return false;
    for (int i = 0; i < 3; i++) { sub(p[i], q[0], v); dp[i] = dot(nQ, v); }
    if ((dp[0] > 0 && dp[1] > 0 && dp[2] > 0) || (dp[0] < 0 && dp[1] < 0 && dp[2] < 0)) return false;
    onPlane = dq[0] == 0 || dq[1] == 0 || dq[2] == 0 || dp[0] == 0 || dp[1] == 0 || dp[2] == 0;
  }
  for (int i = 0; i < 3; i++) {
    int j = (i + 1) % 3;
    if (seg_pierces(p[i], p[j], q[0], q[1], q[2])) return true;
    if (seg_pierces(q[i], q[j], p[0], p[1], p[2])) return true;
  }
  if (degenerate || onPlane) return tri_tri2(P, Q, __builtin_inf()) == 0;
  return false;
}

static void visit_meets(Query& Q, int a, int b) {
  if (Q.done) return;
  const Node& na = Q.A->node[a];
  const Node& nb = Q.B->node[b];
  if (na.left < 0 && nb.left < 0) {
    leaf_tris(Q, b);
    for (int i = na.start; i < na.start + na.count; i++)
      for (int j = nb.start; j < nb.start + nb.count; j++) {
        Q.pairs++;
        if (tri_meets(Q.A->tri + 9 * i, Q.btri + 9 * j)) { Q.done = true; return; }
      }
    return;
  }
  bool splitA;
  if (na.left < 0) splitA = false;
  else if (nb.left < 0) splitA = true;
  else {
    double ea = 0, eb = 0;
    for (int k = 0; k < 3; k++) { ea += na.mx[k] - na.mn[k]; eb += Q.bmx[3 * b + k] - Q.bmn[3 * b + k]; }
    splitA = ea >= eb;
  }
  // A pair is skipped only when its boxes stand apart by more than the pruning
  // margin (PRUNE_PAD, the distance query's own reason): a bound computed an ulp
  // over 0 must not hide a touching pair.
  const double pad = PRUNE_PAD * PRUNE_PAD;
  if (splitA) {
    for (int c = na.left; c <= na.left + 1; c++)
      if (!(lower2(Q, Q.A->node[c].mn, Q.A->node[c].mx, b) > pad)) { visit_meets(Q, c, b); if (Q.done) return; }
  } else {
    for (int c = nb.left; c <= nb.left + 1; c++) {
      bbox(Q, c);
      if (!(lower2(Q, na.mn, na.mx, c) > pad)) { visit_meets(Q, a, c); if (Q.done) return; }
    }
  }
}

extern "C" {

__attribute__((export_name("distance"))) double distance(u32 hA, u32 hB, u32 matPtr, double upper) {
  const Geom* A = (const Geom*)(unsigned long)hA;
  const Geom* B = (const Geom*)(unsigned long)hB;
  last_pairs = 0;
  if (!A->ntri || !B->ntri) return __builtin_inf();
  Query Q;
  if (!begin_query(Q, A, B, matPtr)) return -1;   // out of memory: the caller resets and asks again
  Q.best2 = upper < __builtin_inf() ? upper * upper : __builtin_inf();
  Q.prune2 = pad2(Q.best2);
  if (lower2(Q, A->node[0].mn, A->node[0].mx, 0) < Q.prune2) visit(Q, 0, 0);
  last_pairs = Q.pairs;
  double d = __builtin_sqrt(Q.best2);
  return d < upper ? d : __builtin_inf();
}

// 1 when some triangle of A meets some triangle of B under M, 0 when none does,
// -1 when the scratch did not fit.
__attribute__((export_name("intersects"))) int intersects(u32 hA, u32 hB, u32 matPtr) {
  const Geom* A = (const Geom*)(unsigned long)hA;
  const Geom* B = (const Geom*)(unsigned long)hB;
  last_pairs = 0;
  if (!A->ntri || !B->ntri) return 0;
  Query Q;
  if (!begin_query(Q, A, B, matPtr)) return -1;
  Q.best2 = 0; Q.prune2 = 0;
  if (!(lower2(Q, A->node[0].mn, A->node[0].mx, 0) > PRUNE_PAD * PRUNE_PAD)) visit_meets(Q, 0, 0);
  last_pairs = Q.pairs;
  return Q.done ? 1 : 0;
}

__attribute__((export_name("last_pairs"))) u32 last_pairs_get() { return last_pairs; }
__attribute__((export_name("geom_ntri"))) u32 geom_ntri(u32 h) { return (u32)((const Geom*)(unsigned long)h)->ntri; }

}  // extern "C"
