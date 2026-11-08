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
// The query. B's triangles are mapped into A's frame once per query, and B's tree
// refitted there (its topology kept, its boxes recomputed bottom-up), so every box
// test is between two axis-aligned boxes in one frame.
struct Query {
  const Geom* A; const Geom* B;
  double* btri;           // B's triangles in A's frame, tree order
  double* bmn; double* bmx;  // B's refitted boxes, 3 per node
  double best2;
  bool done;
  u32 pairs;
};

static u32 scratch(u32 bytes) {
  if (bytes > scratch_cap) { scratch_ptr = alloc(bytes); scratch_cap = scratch_ptr ? bytes : 0; }
  return scratch_ptr;
}

static void refit(Query& Q, int n) {
  const Node& nd = Q.B->node[n];
  double* mn = Q.bmn + 3 * n; double* mx = Q.bmx + 3 * n;
  if (nd.left < 0) {
    mn[0] = mn[1] = mn[2] = __builtin_inf();
    mx[0] = mx[1] = mx[2] = -__builtin_inf();
    for (int t = nd.start; t < nd.start + nd.count; t++) {
      const double* p = Q.btri + 9 * t;
      for (int k = 0; k < 9; k++) { int a = k % 3; mn[a] = dmin(mn[a], p[k]); mx[a] = dmax(mx[a], p[k]); }
    }
    return;
  }
  refit(Q, nd.left); refit(Q, nd.left + 1);
  for (int a = 0; a < 3; a++) {
    mn[a] = dmin(Q.bmn[3 * nd.left + a], Q.bmn[3 * (nd.left + 1) + a]);
    mx[a] = dmax(Q.bmx[3 * nd.left + a], Q.bmx[3 * (nd.left + 1) + a]);
  }
}

static void visit(Query& Q, int a, int b) {
  if (Q.done) return;
  const Node& na = Q.A->node[a];
  const Node& nb = Q.B->node[b];
  if (na.left < 0 && nb.left < 0) {
    for (int i = na.start; i < na.start + na.count; i++)
      for (int j = nb.start; j < nb.start + nb.count; j++) {
        Q.pairs++;
        double d = tri_tri2(Q.A->tri + 9 * i, Q.btri + 9 * j, Q.best2);
        if (d < Q.best2) { Q.best2 = d; if (d == 0) { Q.done = true; return; } }
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
    d0 = box_dist2(Q.A->node[c0].mn, Q.A->node[c0].mx, Q.bmn + 3 * b, Q.bmx + 3 * b);
    d1 = box_dist2(Q.A->node[c1].mn, Q.A->node[c1].mx, Q.bmn + 3 * b, Q.bmx + 3 * b);
  } else {
    c0 = nb.left; c1 = nb.left + 1;
    d0 = box_dist2(na.mn, na.mx, Q.bmn + 3 * c0, Q.bmx + 3 * c0);
    d1 = box_dist2(na.mn, na.mx, Q.bmn + 3 * c1, Q.bmx + 3 * c1);
  }
  if (d1 < d0) { int tc = c0; c0 = c1; c1 = tc; double td = d0; d0 = d1; d1 = td; }
  if (d0 < Q.best2) { if (splitA) visit(Q, c0, b); else visit(Q, a, c0); }
  if (d1 < Q.best2) { if (splitA) visit(Q, c1, b); else visit(Q, a, c1); }
}

static u32 last_pairs = 0;

extern "C" {

__attribute__((export_name("distance"))) double distance(u32 hA, u32 hB, u32 matPtr, double upper) {
  const Geom* A = (const Geom*)(unsigned long)hA;
  const Geom* B = (const Geom*)(unsigned long)hB;
  const double* m = (const double*)(unsigned long)matPtr;
  last_pairs = 0;
  if (!A->ntri || !B->ntri) return __builtin_inf();
  u32 need = (u32)B->ntri * 9 * 8 + (u32)B->nnode * 3 * 8 * 2;
  u32 sp = scratch(need);
  if (!sp) return -1;   // out of memory: the caller resets and asks again
  Query Q;
  Q.A = A; Q.B = B;
  Q.btri = (double*)(unsigned long)sp;
  Q.bmn = Q.btri + 9 * B->ntri;
  Q.bmx = Q.bmn + 3 * B->nnode;
  // three.js' Vector3.applyMatrix4, term for term (w divides, as there).
  for (int t = 0; t < B->ntri * 3; t++) {
    const double* v = B->tri + 3 * t;
    double x = v[0], y = v[1], z = v[2];
    double w = 1.0 / (m[3] * x + m[7] * y + m[11] * z + m[15]);
    Q.btri[3 * t + 0] = (m[0] * x + m[4] * y + m[8] * z + m[12]) * w;
    Q.btri[3 * t + 1] = (m[1] * x + m[5] * y + m[9] * z + m[13]) * w;
    Q.btri[3 * t + 2] = (m[2] * x + m[6] * y + m[10] * z + m[14]) * w;
  }
  refit(Q, 0);
  Q.best2 = upper < __builtin_inf() ? upper * upper : __builtin_inf();
  Q.done = false; Q.pairs = 0;
  if (box_dist2(A->node[0].mn, A->node[0].mx, Q.bmn, Q.bmx) < Q.best2) visit(Q, 0, 0);
  last_pairs = Q.pairs;
  double d = __builtin_sqrt(Q.best2);
  return d < upper ? d : __builtin_inf();
}

__attribute__((export_name("last_pairs"))) u32 last_pairs_get() { return last_pairs; }
__attribute__((export_name("geom_ntri"))) u32 geom_ntri(u32 h) { return (u32)((const Geom*)(unsigned long)h)->ntri; }

}  // extern "C"
