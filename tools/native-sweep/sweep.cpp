// §338 landing 12 — THE NATIVE SWEEP ENGINE: `inspection`'s pair sweep, run natively.
//
// JavaScript poses the movement and streams the state the sweep reads
// (src/inspect.js' exportInspectionState, through tools/native-sweep/run.mjs); this
// program runs the sweep's loops and queries on it and writes the findings and the
// census, which run.mjs assembles with inspect.js' own `inspectionPayload`. So the
// division is: JS supplies the posed state, native code supplies the queries.
//
// The queries are tools/kernel/kernel.cpp, the SAME source the wasm module is built
// from, compiled here for the host (its §338 landing 12 portability layer), so a
// distance and a meet are the kernel's bits. Everything else the sweep computes is
// ported operation for operation from the JS it replaces and cited at each site:
// three.js' Matrix4.invert and multiplyMatrices, inspect.js' boxDistance (through
// det-math's correctly rounded three-argument hypot), boxesCanTouch, unitsIntersect,
// meshesIntersect and runInspection's pair loop. The census counts LOGICAL queries,
// as the JS memo's replay does, so no memo is needed for the counts to agree.
//
// Built by tools/native-sweep/build.mjs (the pinned zig's clang, C++23 with the
// standard library, -ffp-contract=off and no fast-math: the kernel's arithmetic rules).
//
// INPUT (stdin, little-endian), a sequence of records:
//   'H' u32 len, JSON (units, pairs, axes, meshCount, CONTACT_TOUCH)
//   'G' u32 id, u32 nvert, u32 ntri, f32[nvert*3], u32[ntri*3]
//   'P' u32 axis, u32 i, f64 f, f64[nUnits*6] unit boxes, u32 nChanged, then per mesh
//       u32 mesh, u32 own, u32 view, u32 rigid, f64[16] world, f64[16] frame, f64[6] box
//   'E' end
// OUTPUT (stdout): one JSON object, { findings, census }.

#include "../kernel/kernel.cpp"

#include <array>
#include <charconv>
#include <cmath>
#include <cstdint>
#include <cstdio>
#include <cstdlib>
#include <cstring>
#include <map>
#include <memory>
#include <unordered_map>
#include <unordered_set>
#include <string>
#include <string_view>
#include <vector>

namespace sweep {

using Mat = std::array<double, 16>;
struct Box6 { double mnx, mny, mnz, mxx, mxy, mxz; };

// three.js Matrix4.invert, term for term (te is column-major; nRC is row R, column C).
static Mat invert(const Mat& te) {
  const double n11 = te[0], n21 = te[1], n31 = te[2], n41 = te[3],
    n12 = te[4], n22 = te[5], n32 = te[6], n42 = te[7],
    n13 = te[8], n23 = te[9], n33 = te[10], n43 = te[11],
    n14 = te[12], n24 = te[13], n34 = te[14], n44 = te[15],
    t11 = n23 * n34 * n42 - n24 * n33 * n42 + n24 * n32 * n43 - n22 * n34 * n43 - n23 * n32 * n44 + n22 * n33 * n44,
    t12 = n14 * n33 * n42 - n13 * n34 * n42 - n14 * n32 * n43 + n12 * n34 * n43 + n13 * n32 * n44 - n12 * n33 * n44,
    t13 = n13 * n24 * n42 - n14 * n23 * n42 + n14 * n22 * n43 - n12 * n24 * n43 - n13 * n22 * n44 + n12 * n23 * n44,
    t14 = n14 * n23 * n32 - n13 * n24 * n32 - n14 * n22 * n33 + n12 * n24 * n33 + n13 * n22 * n34 - n12 * n23 * n34;
  const double det = n11 * t11 + n21 * t12 + n31 * t13 + n41 * t14;
  Mat o{};
  if (det == 0) return o;
  const double detInv = 1 / det;
  o[0] = t11 * detInv;
  o[1] = (n24 * n33 * n41 - n23 * n34 * n41 - n24 * n31 * n43 + n21 * n34 * n43 + n23 * n31 * n44 - n21 * n33 * n44) * detInv;
  o[2] = (n22 * n34 * n41 - n24 * n32 * n41 + n24 * n31 * n42 - n21 * n34 * n42 - n22 * n31 * n44 + n21 * n32 * n44) * detInv;
  o[3] = (n23 * n32 * n41 - n22 * n33 * n41 - n23 * n31 * n42 + n21 * n33 * n42 + n22 * n31 * n43 - n21 * n32 * n43) * detInv;
  o[4] = t12 * detInv;
  o[5] = (n13 * n34 * n41 - n14 * n33 * n41 + n14 * n31 * n43 - n11 * n34 * n43 - n13 * n31 * n44 + n11 * n33 * n44) * detInv;
  o[6] = (n14 * n32 * n41 - n12 * n34 * n41 - n14 * n31 * n42 + n11 * n34 * n42 + n12 * n31 * n44 - n11 * n32 * n44) * detInv;
  o[7] = (n12 * n33 * n41 - n13 * n32 * n41 + n13 * n31 * n42 - n11 * n33 * n42 - n12 * n31 * n43 + n11 * n32 * n43) * detInv;
  o[8] = t13 * detInv;
  o[9] = (n14 * n23 * n41 - n13 * n24 * n41 - n14 * n21 * n43 + n11 * n24 * n43 + n13 * n21 * n44 - n11 * n23 * n44) * detInv;
  o[10] = (n12 * n24 * n41 - n14 * n22 * n41 + n14 * n21 * n42 - n11 * n24 * n42 - n12 * n21 * n44 + n11 * n22 * n44) * detInv;
  o[11] = (n13 * n22 * n41 - n12 * n23 * n41 - n13 * n21 * n42 + n11 * n23 * n42 + n12 * n21 * n43 - n11 * n22 * n43) * detInv;
  o[12] = t14 * detInv;
  o[13] = (n13 * n24 * n31 - n14 * n23 * n31 + n14 * n21 * n33 - n11 * n24 * n33 - n13 * n21 * n34 + n11 * n23 * n34) * detInv;
  o[14] = (n14 * n22 * n31 - n12 * n24 * n31 - n14 * n21 * n32 + n11 * n24 * n32 + n12 * n21 * n34 - n11 * n22 * n34) * detInv;
  o[15] = (n12 * n23 * n31 - n13 * n22 * n31 + n13 * n21 * n32 - n11 * n23 * n32 - n12 * n21 * n33 + n11 * n22 * n33) * detInv;
  return o;
}

// three.js Matrix4.multiplyMatrices(a, b), term for term.
static Mat multiply(const Mat& ae, const Mat& be) {
  const double a11 = ae[0], a12 = ae[4], a13 = ae[8], a14 = ae[12];
  const double a21 = ae[1], a22 = ae[5], a23 = ae[9], a24 = ae[13];
  const double a31 = ae[2], a32 = ae[6], a33 = ae[10], a34 = ae[14];
  const double a41 = ae[3], a42 = ae[7], a43 = ae[11], a44 = ae[15];
  const double b11 = be[0], b12 = be[4], b13 = be[8], b14 = be[12];
  const double b21 = be[1], b22 = be[5], b23 = be[9], b24 = be[13];
  const double b31 = be[2], b32 = be[6], b33 = be[10], b34 = be[14];
  const double b41 = be[3], b42 = be[7], b43 = be[11], b44 = be[15];
  Mat te;
  te[0] = a11 * b11 + a12 * b21 + a13 * b31 + a14 * b41;
  te[4] = a11 * b12 + a12 * b22 + a13 * b32 + a14 * b42;
  te[8] = a11 * b13 + a12 * b23 + a13 * b33 + a14 * b43;
  te[12] = a11 * b14 + a12 * b24 + a13 * b34 + a14 * b44;
  te[1] = a21 * b11 + a22 * b21 + a23 * b31 + a24 * b41;
  te[5] = a21 * b12 + a22 * b22 + a23 * b32 + a24 * b42;
  te[9] = a21 * b13 + a22 * b23 + a23 * b33 + a24 * b43;
  te[13] = a21 * b14 + a22 * b24 + a23 * b34 + a24 * b44;
  te[2] = a31 * b11 + a32 * b21 + a33 * b31 + a34 * b41;
  te[6] = a31 * b12 + a32 * b22 + a33 * b32 + a34 * b42;
  te[10] = a31 * b13 + a32 * b23 + a33 * b33 + a34 * b43;
  te[14] = a31 * b14 + a32 * b24 + a33 * b34 + a34 * b44;
  te[3] = a41 * b11 + a42 * b21 + a43 * b31 + a44 * b41;
  te[7] = a41 * b12 + a42 * b22 + a43 * b32 + a44 * b42;
  te[11] = a41 * b13 + a42 * b23 + a43 * b33 + a44 * b43;
  te[15] = a41 * b14 + a42 * b24 + a43 * b34 + a44 * b44;
  return te;
}

// src/det-math.js' Math.hypot for three arguments: m·√Σ(xᵢ/m)², m the largest |xᵢ|,
// summed in argument order; ±Infinity first, then NaN, then all zeros.
static double hypot3(double x, double y, double z) {
  const double v[3] = { x < 0 ? -x : x, y < 0 ? -y : y, z < 0 ? -z : z };
  double m = 0; bool inf = false, nan = false;
  for (double a : v) { if (a == INF) inf = true; else if (a != a) nan = true; else if (a > m) m = a; }
  if (inf) return INF;
  if (nan) return __builtin_nan("");
  if (m == 0) return 0;
  double s = 0;
  for (double a : v) { const double r = a / m; s += r * r; }
  return m * std::sqrt(s);
}

// Math.max(a, b, 0) as ECMA-262 has it: any NaN gives NaN, and +0 beats −0.
static double jsmax3(double a, double b, double c) {
  if (a != a || b != b || c != c) return __builtin_nan("");
  double r = a;
  for (double x : { b, c }) if (x > r || (x == 0 && r == 0 && !std::signbit(x))) r = x;
  return r;
}

// inspect.js' boxesCanTouch, !(boxDistance(a, b) > t), with an exact shortcut:
// det-math's hypot is m·√Σ(xᵢ/m)² with the largest term (m/m)² = 1, so √ ≥ 1 and the
// product rounds to at least m. So a gap over t on any axis is over t whatever the
// others are, and hypot is computed only when every gap is at or under t (a NaN gap
// fails every comparison and falls through to the full answer, as it should).
static double box_distance(const Box6& a, const Box6& b);
static bool boxes_can_touch(const Box6& a, const Box6& b, double t) {
  if (a.mnx - b.mxx > t || b.mnx - a.mxx > t || a.mny - b.mxy > t || b.mny - a.mxy > t || a.mnz - b.mxz > t || b.mnz - a.mxz > t) return false;
  return !(box_distance(a, b) > t);
}
// inspect.js' boxDistance.
static double box_distance(const Box6& a, const Box6& b) {
  const double dx = jsmax3(a.mnx - b.mxx, b.mnx - a.mxx, 0);
  const double dy = jsmax3(a.mny - b.mxy, b.mny - a.mxy, 0);
  const double dz = jsmax3(a.mnz - b.mxz, b.mnz - a.mxz, 0);
  return hypot3(dx, dy, dz);
}

struct Census { std::uint64_t aabbTests = 0, aabbPass = 0, exactCalls = 0, boolTrue = 0, boolFalse = 0, unitPairTests = 0, unitPairPass = 0; };

struct MeshState { std::uint32_t own = 0, view = 0; bool rigid = true; Mat world{}, frame{}; Box6 box{}, box2{}; std::uint32_t gid = 0, pv = 0; std::uint32_t ver = 0, uver = 0; };
struct Geometry { std::vector<float> pos; std::vector<std::uint32_t> idx; std::uint32_t nvert = 0, ntri = 0; u32 handle = 0; u32 gen = 0; };

class Engine {
 public:
  // The arena is calloc'd, not a std::vector: a vector zero-fills every page up front
  // (1.5 GB resident per engine before any work, and the battery runs one per worker),
  // where calloc hands out zero pages the system commits only as the arena reaches them.
  explicit Engine(std::size_t arena) : mem_(static_cast<u8*>(std::calloc(arena, 1))) {
    if (!mem_) { std::fputs("sweep: no memory for the arena\n", stderr); std::exit(2); }
    kernel_bind(mem_.get(), static_cast<u32>(arena)); reset(); mat_ = alloc(128);
  }

  double touch = 1e-4;
  Census census;

  void add_geometry(std::uint32_t id, Geometry g) { if (geoms_.size() <= id) geoms_.resize(id + 1); geoms_[id] = std::move(g); }

  // inspect.js' _meshClearanceInner's kernel query: the distance between the two
  // rigid views, B's frame mapped into A's, bounded by `upper`.
  double view_distance(const MeshState& a, const MeshState& b, double upper) {
    return kdistance(a.view, b.view, multiply(invert(a.frame), b.frame), upper);
  }

  // inspect.js' _meshesIntersectInner: the running fit between rigid frames, then
  // (unless both are rigid) the meet under the world map.
  bool meshes_intersect(const MeshState& a, const MeshState& b) {
    const Mat m = multiply(invert(a.frame), b.frame);
    if (kdistance(a.view, b.view, m, touch) < touch) return true;
    if (a.rigid && b.rigid) return false;
    const Mat w = multiply(invert(a.world), b.world);
    return kmeets(a.own, b.own, w);
  }

 private:
  struct Free { void operator()(u8* p) const { std::free(p); } };
  std::unique_ptr<u8, Free> mem_;
  u32 gen_ = 1, mat_ = 0;
  std::vector<Geometry> geoms_;
  static constexpr u32 BUDGET = 512u * 1024u * 1024u;   // src/kernel.js' ARENA_BUDGET: a reset rebuilds on demand

  void reset_arena() { reset(); gen_++; mat_ = alloc(128); }
  u32 handle(std::uint32_t id) {
    Geometry& g = geoms_.at(id);
    if (g.handle && g.gen == gen_) return g.handle;
    if (heap_used() > BUDGET) reset_arena();
    const u32 pp = alloc(g.nvert * 12), ip = alloc(g.ntri * 12);
    if (!pp || !ip) { std::fputs("sweep: out of arena\n", stderr); std::exit(2); }
    std::memcpy(at<u8>(pp), g.pos.data(), g.nvert * 12);
    std::memcpy(at<u8>(ip), g.idx.data(), g.ntri * 12);
    g.handle = geom_create(pp, g.nvert, ip, g.ntri);
    if (!g.handle) { std::fputs("sweep: out of arena building a tree\n", stderr); std::exit(2); }
    g.gen = gen_;
    return g.handle;
  }
  // src/kernel.js' wasmDistance / wasmIntersects: both handles in one generation, the
  // matrix in the arena, a query whose scratch did not fit retried after a reset.
  double kdistance(std::uint32_t a, std::uint32_t b, const Mat& m, double upper) {
    for (int attempt = 0; attempt < 2; attempt++) {
      const u32 g0 = gen_, ha = handle(a), hb = handle(b);
      if (gen_ != g0 && attempt == 0) continue;
      std::memcpy(at<u8>(mat_), m.data(), 128);
      const double d = distance(ha, hb, mat_, upper);
      if (d >= 0) return d;
      reset_arena();
    }
    std::fputs("sweep: a distance query does not fit the arena\n", stderr); std::exit(2);
  }
  bool kmeets(std::uint32_t a, std::uint32_t b, const Mat& m) {
    for (int attempt = 0; attempt < 2; attempt++) {
      const u32 g0 = gen_, ha = handle(a), hb = handle(b);
      if (gen_ != g0 && attempt == 0) continue;
      std::memcpy(at<u8>(mat_), m.data(), 128);
      const int r = intersects(ha, hb, mat_);
      if (r >= 0) return r == 1;
      reset_arena();
    }
    std::fputs("sweep: an intersection query does not fit the arena\n", stderr); std::exit(2);
  }
};

// ---------------------------------------------------------------------------
// A minimal reader for the header JSON run.mjs writes (objects, arrays, strings,
// numbers, booleans; no escapes beyond \" and \\ and \uXXXX, which it never writes
// outside the BMP's ASCII-safe range).
struct Json {
  enum Kind { Null, Bool, Num, Str, Arr, Obj } kind = Null;
  bool b = false; double n = 0; std::string s; std::vector<Json> a; std::vector<std::pair<std::string, Json>> o;
  const Json& operator[](std::string_view k) const { for (auto& [key, v] : o) if (key == k) return v; static Json none; return none; }
};
static Json parse(std::string_view t, std::size_t& i);
static void ws(std::string_view t, std::size_t& i) { while (i < t.size() && (t[i] == ' ' || t[i] == '\n' || t[i] == '\t' || t[i] == '\r')) i++; }
static std::string parse_str(std::string_view t, std::size_t& i) {
  std::string out; i++;
  while (t[i] != '"') {
    if (t[i] == '\\') {
      i++;
      if (t[i] == 'u') {
        const unsigned cp = std::stoul(std::string(t.substr(i + 1, 4)), nullptr, 16); i += 5;
        if (cp < 0x80) out += static_cast<char>(cp);
        else if (cp < 0x800) { out += static_cast<char>(0xC0 | (cp >> 6)); out += static_cast<char>(0x80 | (cp & 63)); }
        else { out += static_cast<char>(0xE0 | (cp >> 12)); out += static_cast<char>(0x80 | ((cp >> 6) & 63)); out += static_cast<char>(0x80 | (cp & 63)); }
        continue;
      }
      out += t[i] == 'n' ? '\n' : t[i];
      i++;
      continue;
    }
    out += t[i++];
  }
  i++;
  return out;
}
static Json parse(std::string_view t, std::size_t& i) {
  ws(t, i); Json j;
  if (t[i] == '{') {
    j.kind = Json::Obj; i++; ws(t, i);
    if (t[i] == '}') { i++; return j; }
    for (;;) { ws(t, i); std::string k = parse_str(t, i); ws(t, i); i++; j.o.emplace_back(std::move(k), parse(t, i)); ws(t, i); if (t[i++] == '}') break; }
  } else if (t[i] == '[') {
    j.kind = Json::Arr; i++; ws(t, i);
    if (t[i] == ']') { i++; return j; }
    for (;;) { j.a.push_back(parse(t, i)); ws(t, i); if (t[i++] == ']') break; }
  } else if (t[i] == '"') { j.kind = Json::Str; j.s = parse_str(t, i); }
  else if (t.substr(i, 4) == "true") { j.kind = Json::Bool; j.b = true; i += 4; }
  else if (t.substr(i, 5) == "false") { j.kind = Json::Bool; i += 5; }
  else if (t.substr(i, 4) == "null") { i += 4; }
  else { j.kind = Json::Num; char* end = nullptr; const std::string tok(t.substr(i, 40)); j.n = std::strtod(tok.c_str(), &end); i += static_cast<std::size_t>(end - tok.c_str()); }   // libc++ 18 has no floating from_chars
  return j;
}

// Shortest round-trip decimal, which is what JSON.parse reads back to the same double.
static std::string num(double x) { char b[64]; auto r = std::to_chars(b, b + sizeof b, x); return std::string(b, r.ptr); }
static std::string quote(const std::string& s) {
  std::string o = "\"";
  for (char c : s) { if (c == '"' || c == '\\') o += '\\'; o += c; }
  return o + '"';
}

class Reader {
 public:
  explicit Reader(std::FILE* f) : f_(f) {}
  bool read(void* p, std::size_t n) { return std::fread(p, 1, n, f_) == n; }
  template <class T> T get() { T v; if (!read(&v, sizeof v)) { std::fputs("sweep: truncated input\n", stderr); std::exit(2); } return v; }
 private:
  std::FILE* f_;
};

}  // namespace sweep

namespace sweep {

// A 'G' record (its tag already read): a geometry, kept by id.
static void read_geometry(Reader& in, Engine& eng) {
  Geometry g; const std::uint32_t id = in.get<std::uint32_t>();
  g.nvert = in.get<std::uint32_t>(); g.ntri = in.get<std::uint32_t>();
  g.pos.resize(g.nvert * 3); g.idx.resize(g.ntri * 3);
  in.read(g.pos.data(), g.pos.size() * 4); in.read(g.idx.data(), g.idx.size() * 4);
  eng.add_geometry(id, std::move(g));
}

// A 'P' record (its tag already read): the pose's unit boxes and changed mesh states.
// A mesh's version moves only when its state really differs, bit for bit (the poser
// re-sends a mesh with children every pose): the memo's rule is the inputs, not
// whether they were sent. Returns the pose's f, as JS rounded it.
static double read_pose(Reader& in, std::vector<MeshState>& state, std::vector<Box6>& unitBox, std::uint32_t& axis) {
  axis = in.get<std::uint32_t>(); in.get<std::uint32_t>();
  const double f = in.get<double>();
  for (auto& b : unitBox) in.read(&b, sizeof b);
  const std::uint32_t nch = in.get<std::uint32_t>();
  for (std::uint32_t k = 0; k < nch; k++) {
    MeshState& s = state.at(in.get<std::uint32_t>());
    MeshState n;
    n.own = in.get<std::uint32_t>(); n.view = in.get<std::uint32_t>(); n.rigid = in.get<std::uint32_t>() != 0;
    in.read(n.world.data(), 128); in.read(n.frame.data(), 128); in.read(&n.box, sizeof n.box); in.read(&n.box2, sizeof n.box2);
    n.gid = in.get<std::uint32_t>(); n.pv = in.get<std::uint32_t>();
    // undeclaredClearance's own memo version: its snapshot is the geometry's JS id, its
    // position version and the world matrix compared with !== (so −0 and 0 are one)
    n.uver = s.uver;
    bool same = s.uver != 0 && n.gid == s.gid && n.pv == s.pv;
    for (int q = 0; same && q < 16; q++) if (n.world[q] != s.world[q]) same = false;
    if (!same) n.uver = s.uver + 1;
    n.ver = s.ver;
    if (s.ver == 0 || n.own != s.own || n.view != s.view || n.rigid != s.rigid || std::memcmp(n.world.data(), s.world.data(), 128) ||
        std::memcmp(n.frame.data(), s.frame.data(), 128) || std::memcmp(&n.box, &s.box, sizeof n.box)) n.ver = s.ver + 1;
    s = n;
  }
  return f;
}

// `boxDistance(a, b) >= best`, with the same exact shortcut as boxes_can_touch: det-math's
// hypot is never below its largest argument, so one gap at or past `best` decides it.
static bool box_at_least(const Box6& a, const Box6& b, double best) {
  if (a.mnx - b.mxx >= best || b.mnx - a.mxx >= best || a.mny - b.mxy >= best || b.mny - a.mxy >= best || a.mnz - b.mxz >= best || b.mnz - a.mxz >= best) return true;
  return box_distance(a, b) >= best;
}

// ---------------------------------------------------------------------------
// `clearances` — the ENGINE DRIVES. sweepClearances' algorithm (inspect.js), ported
// step for step: per axis a coarse pass every `coarse` poses (both endpoints), then a
// refinement of the skipped poses beside any coarse sample within `refineBand` of the
// pair's own per-axis minimum, the poses in ascending order; per pose every budget
// pair's unitClearance under its bound. Which poses it visits depends on its answers,
// so it asks JS for each one ('S'), in exactly the order the JS sweep sets them, and
// JS answers with the pose's changed states. And it asks JS the one question JS keeps:
// meshClearance's containment witness, sampledVerdict, wherever 0 < d < 0.05 ('V').
// Commands out (stdout, flushed): 'A' u32 axis (enter it), 'S' u32 axis u32 i,
// 'V' u32 a u32 b f64 upper, and at the end 'R' u32 len + JSON.
struct ClearanceCensus { std::uint64_t aabbTests = 0, aabbPass = 0, exactCalls = 0, verdictCalls = 0, pruned = 0, far = 0, mid = 0, near = 0, contact = 0; };

static void put(const void* p, std::size_t n) { std::fwrite(p, 1, n, stdout); }
template <class T> static void put(T v) { put(&v, sizeof v); }

static int run_clearances(Reader& in, Engine& eng, const Json& h) {
  // A pair is its two MESH LISTS (a unit's meshes, or expectedContacts' own-metal
  // subset) and the mesh pairs its exclusion rule skips (expectedContacts' declared
  // contacts, `only:` siblings and nested shared meshes), resolved by JS at setup.
  struct Pair { std::vector<std::uint32_t> Am, Bm; std::unordered_set<std::uint64_t> ex; std::vector<std::uint32_t> axes; bool anyAxis; bool hasFloor; double floor; };
  std::vector<Pair> pairs; std::vector<std::uint32_t> axisN;
  for (auto& a : h["axes"].a) axisN.push_back(static_cast<std::uint32_t>(a["n"].n));
  for (auto& p : h["pairs"].a) {
    Pair x{ {}, {}, {}, {}, p["axes"].kind != Json::Arr, p["refineFloor"].kind == Json::Num, p["refineFloor"].n };
    for (auto& m : p["Am"].a) x.Am.push_back(static_cast<std::uint32_t>(m.n));
    for (auto& m : p["Bm"].a) x.Bm.push_back(static_cast<std::uint32_t>(m.n));
    for (std::size_t k = 0; k + 1 < p["ex"].a.size(); k += 2)
      x.ex.insert((static_cast<std::uint64_t>(p["ex"].a[k].n) << 32) | static_cast<std::uint64_t>(p["ex"].a[k + 1].n));
    for (auto& a : p["axes"].a) x.axes.push_back(static_cast<std::uint32_t>(a.n));
    pairs.push_back(std::move(x));
  }
  const std::uint32_t coarse = static_cast<std::uint32_t>(h["coarse"].n);
  const double band = h["refineBand"].n;
  std::vector<MeshState> state(static_cast<std::size_t>(h["meshCount"].n));
  std::vector<Box6> unitBox(static_cast<std::size_t>(h["unitCount"].n));
  ClearanceCensus c;
  auto onAxis = [&](const Pair& p, std::uint32_t ax) { if (p.anyAxis) return true; for (auto a : p.axes) if (a == ax) return true; return false; };

  // the per-pair state sweepClearances keeps
  struct St { double min = INF; bool at = false; std::uint32_t atAxis = 0; double atF = 0; bool hasMeshes = false; std::uint32_t ma = 0, mb = 0; };
  std::vector<St> st(pairs.size());
  // the static-pair memo (exact replay): per mesh pair, the two states' versions and,
  // per bound (bit for bit, as Object.is keys it), the answer and the census it added
  struct Hit { double param, d; bool verdict; int bucket; };
  struct Slot { std::uint32_t va = 0, vb = 0; std::vector<Hit> hits; };
  std::unordered_map<std::uint64_t, Slot> memo;

  // inspect.js' meshClearance: the kernel's distance, and where 0 < d < 0.05 the
  // containment witness, asked of JS; its outcome counted in the census.
  auto mesh_clearance = [&](std::uint32_t a, std::uint32_t b, double upper, bool& verdict, int& bucket) {
    double d = eng.view_distance(state[a], state[b], upper);
    verdict = false;
    if (d > 0 && d < 0.05) {
      verdict = true;
      put('V'); put(a); put(b); put(upper); std::fflush(stdout);
      const char tag = in.get<char>();
      if (tag != 'v') { std::fprintf(stderr, "sweep: expected a verdict, read '%c'\n", tag); std::exit(2); }
      if (in.get<std::uint8_t>()) d = 0;
    }
    bucket = (d == INF || d >= upper) ? 0 : d <= 0 ? 4 : d < 0.05 ? 3 : d < 0.4 ? 2 : 1;
    return d;
  };
  auto count = [&](bool verdict, int bucket) {
    c.exactCalls++; if (verdict) c.verdictCalls++;
    (bucket == 0 ? c.pruned : bucket == 1 ? c.far : bucket == 2 ? c.mid : bucket == 3 ? c.near : c.contact)++;
  };
  // inspect.js' unitClearance: the nearest mesh pair under `upper`; an excluded pair is
  // skipped before anything is counted, then the AABB gate.
  auto unit_clearance = [&](const Pair& p, double upper, std::uint32_t& pa, std::uint32_t& pb, bool& found) {
    double best = upper; found = false;
    for (std::uint32_t a : p.Am) {
      for (std::uint32_t b : p.Bm) {
        if (!p.ex.empty() && p.ex.count((static_cast<std::uint64_t>(a) << 32) | b)) continue;
        c.aabbTests++;
        if (box_at_least(state[a].box, state[b].box, best)) continue;
        c.aabbPass++;
        Slot& sl = memo[(static_cast<std::uint64_t>(a) << 32) | b];
        if (sl.va != state[a].ver || sl.vb != state[b].ver) { sl = { state[a].ver, state[b].ver, {} }; }
        double d; const Hit* hit = nullptr;
        for (const Hit& x : sl.hits) if (std::memcmp(&x.param, &best, 8) == 0) { hit = &x; break; }
        if (hit) { d = hit->d; count(hit->verdict, hit->bucket); }
        else { bool v; int bk; d = mesh_clearance(a, b, best, v, bk); count(v, bk); sl.hits.push_back({ best, d, v, bk }); }
        if (d < best) { best = d; pa = a; pb = b; found = true; }
      }
    }
    return best;
  };

  std::vector<std::vector<double>> samples(pairs.size());   // per pair, this axis's d per pose index (NaN: not sampled)
  std::vector<double> axisMin(pairs.size());
  auto eval_pose = [&](std::uint32_t ax, std::uint32_t i, bool refined) {
    put('S'); put(ax); put(i); std::fflush(stdout);
    double f = 0;
    for (;;) {
      const char tag = in.get<char>();
      if (tag == 'G') { read_geometry(in, eng); continue; }
      if (tag == 'P') { std::uint32_t axr; f = read_pose(in, state, unitBox, axr); break; }
      std::fprintf(stderr, "sweep: expected a pose, read '%c'\n", tag); std::exit(2);
    }
    for (std::size_t p = 0; p < pairs.size(); p++) {
      const Pair& pr = pairs[p];
      if (!onAxis(pr, ax)) continue;
      St& s = st[p];
      const double cap = pr.hasFloor ? pr.floor + band : INF;
      const double want = refined ? s.min : s.min + band;
      const double bound = want < cap ? want : cap;   // Math.min of two non-NaN numbers
      std::uint32_t ma = 0, mb = 0; bool found;
      const double d = unit_clearance(pr, bound, ma, mb, found);
      if (d < axisMin[p]) axisMin[p] = d;
      if (d < s.min) { s.min = d; s.at = true; s.atAxis = ax; s.atF = f; s.hasMeshes = found; s.ma = ma; s.mb = mb; }
      samples[p][i] = d;
    }
  };

  for (std::uint32_t ax = 0; ax < axisN.size(); ax++) {
    bool live = false;
    for (auto& pr : pairs) if (onAxis(pr, ax)) { live = true; break; }
    if (!live) continue;
    put('A'); put(ax); std::fflush(stdout);
    const std::uint32_t n = axisN[ax];
    for (std::size_t p = 0; p < pairs.size(); p++) { samples[p].assign(n + 1, __builtin_nan("")); axisMin[p] = INF; }
    memo.clear();
    std::vector<std::uint32_t> coarseIdx;
    for (std::uint32_t i = 0; i <= n; i += coarse) coarseIdx.push_back(i);
    if (coarseIdx.back() != n) coarseIdx.push_back(n);
    for (std::uint32_t i : coarseIdx) eval_pose(ax, i, false);
    if (coarse > 1) {
      std::vector<bool> fine(n + 1, false);
      for (std::size_t p = 0; p < pairs.size(); p++) {
        const Pair& pr = pairs[p];
        if (!onAxis(pr, ax)) continue;
        if (pr.hasFloor && axisMin[p] > pr.floor + band) continue;
        for (std::uint32_t i : coarseIdx) {
          const double d = samples[p][i];
          if (d != d || d > axisMin[p] + band) continue;   // undefined, or not within the band
          const std::uint32_t lo = i + 1 > coarse ? i - coarse + 1 : 0, hi = i + coarse < n ? i + coarse : n;
          for (std::uint32_t j = lo; j < hi; j++) if (samples[p][j] != samples[p][j]) fine[j] = true;
        }
      }
      for (std::uint32_t j = 0; j <= n; j++) if (fine[j]) eval_pose(ax, j, true);
    }
  }

  std::string out = "{\"state\":[";
  for (std::size_t p = 0; p < st.size(); p++) {
    const St& s = st[p];
    if (p) out += ',';
    out += "{\"min\":" + (s.min == INF ? std::string("null") : num(s.min));
    out += s.at ? ",\"at\":[" + std::to_string(s.atAxis) + "," + num(s.atF) + "]" : std::string(",\"at\":null");
    out += s.hasMeshes ? ",\"meshes\":[" + std::to_string(s.ma) + "," + std::to_string(s.mb) + "]}" : std::string(",\"meshes\":null}");
  }
  out += "],\"census\":{\"aabbTests\":" + std::to_string(c.aabbTests) + ",\"aabbPass\":" + std::to_string(c.aabbPass) +
    ",\"exactCalls\":" + std::to_string(c.exactCalls) + ",\"verdictCalls\":" + std::to_string(c.verdictCalls) +
    ",\"out\":{\"pruned\":" + std::to_string(c.pruned) + ",\"far\":" + std::to_string(c.far) + ",\"mid\":" + std::to_string(c.mid) +
    ",\"near\":" + std::to_string(c.near) + ",\"contact\":" + std::to_string(c.contact) + "}}}";
  put('R'); put(static_cast<std::uint32_t>(out.size())); put(out.data(), out.size()); std::fflush(stdout);
  return 0;
}

// ---------------------------------------------------------------------------
// `undeclaredClearance` — checkUndeclaredClearance's loop (inspect.js), ported line for
// line: every pose of every axis in order; per pose the unit-group boxes (the union of
// each group's mesh boxes, three.js' Box3.union, Math.min/Math.max as ECMA-262 has them),
// then per pair the group gate, the mesh gate, the memo (its own: the geometry's JS id,
// position version and !== matrix, reset per axis, its hits COUNTED), and on a miss the
// box prune or the exact distance. The prune is three-mesh-bvh's intersectsBox, so it is
// asked of JS, and asked in one batch per pose ('Q'): which mesh pairs reach it is fixed
// before any distance (the gates read a fixed bound, the memo reads versions), so a first
// pass finds them, in the JS loop's order, and a second runs the loop with the answers.
// Commands out: 'A' u32 axis, 'S' u32 axis u32 i, 'Q' u32 n then n × (u32 a, u32 b,
// f64 bound) answered by n bytes, 'V' as clearances', and 'R' u32 len + JSON.
static double jsmin(double a, double b) { if (a != a || b != b) return __builtin_nan(""); if (a == 0 && b == 0) return std::signbit(a) ? a : b; return a < b ? a : b; }
static double jsmax(double a, double b) { if (a != a || b != b) return __builtin_nan(""); if (a == 0 && b == 0) return std::signbit(a) ? b : a; return a > b ? a : b; }

static int run_undeclared(Reader& in, Engine& eng, const Json& h) {
  struct Pair { std::uint32_t ga, gb; std::vector<std::uint32_t> Am, Bm; double bound; double min = INF; bool at = false; std::uint32_t atAxis = 0; double atF = 0; bool hasMeshes = false; std::uint32_t ma = 0, mb = 0; };
  std::vector<std::vector<std::uint32_t>> groups; std::vector<Pair> pairs; std::vector<std::uint32_t> axisN;
  for (auto& g : h["groups"].a) { std::vector<std::uint32_t> x; for (auto& m : g.a) x.push_back(static_cast<std::uint32_t>(m.n)); groups.push_back(std::move(x)); }
  for (auto& a : h["axes"].a) axisN.push_back(static_cast<std::uint32_t>(a["n"].n));
  for (auto& p : h["pairs"].a) {
    Pair x; x.ga = static_cast<std::uint32_t>(p["ga"].n); x.gb = static_cast<std::uint32_t>(p["gb"].n); x.bound = p["bound"].n;
    for (auto& m : p["Am"].a) x.Am.push_back(static_cast<std::uint32_t>(m.n));
    for (auto& m : p["Bm"].a) x.Bm.push_back(static_cast<std::uint32_t>(m.n));
    pairs.push_back(std::move(x));
  }
  std::vector<MeshState> state(static_cast<std::size_t>(h["meshCount"].n));
  std::vector<Box6> unitBox(static_cast<std::size_t>(h["unitCount"].n)), ub(groups.size());
  std::uint64_t unitPairTests = 0, unitPairPass = 0, exactCalls = 0, memoHits = 0, boxPruned = 0, poses = 0;
  struct Key { std::uint32_t a, b; std::uint64_t bound; bool operator==(const Key&) const = default; };
  struct KeyHash { std::size_t operator()(const Key& k) const { return std::hash<std::uint64_t>()((static_cast<std::uint64_t>(k.a) << 32 | k.b) ^ (k.bound * 0x9E3779B97F4A7C15ull)); } };
  struct Entry { std::uint32_t va, vb; double d; };
  std::unordered_map<Key, Entry, KeyHash> memo;
  auto bits = [](double x) { std::uint64_t u; std::memcpy(&u, &x, 8); return u; };

  for (std::uint32_t ax = 0; ax < axisN.size(); ax++) {
    put('A'); put(ax); std::fflush(stdout);
    memo.clear();
    for (std::uint32_t i = 0; i <= axisN[ax]; i++) {
      put('S'); put(ax); put(i); std::fflush(stdout);
      double f = 0;
      for (;;) {
        const char tag = in.get<char>();
        if (tag == 'G') { read_geometry(in, eng); continue; }
        if (tag == 'P') { std::uint32_t axr; f = read_pose(in, state, unitBox, axr); break; }
        std::fprintf(stderr, "sweep: expected a pose, read '%c'\n", tag); std::exit(2);
      }
      poses++;
      for (std::size_t g = 0; g < groups.size(); g++) {
        Box6 u{ INF, INF, INF, -INF, -INF, -INF };
        for (std::uint32_t m : groups[g]) {
          const Box6& b = state[m].box2;
          u = { jsmin(u.mnx, b.mnx), jsmin(u.mny, b.mny), jsmin(u.mnz, b.mnz), jsmax(u.mxx, b.mxx), jsmax(u.mxy, b.mxy), jsmax(u.mxz, b.mxz) };
        }
        ub[g] = u;
      }
      // pass 1: the misses, in the loop's order, each once (a second sight is a hit)
      std::vector<Key> ask;
      std::unordered_map<Key, std::size_t, KeyHash> askAt;
      for (const Pair& p : pairs) {
        if (box_at_least(ub[p.ga], ub[p.gb], p.bound)) continue;
        for (std::uint32_t a : p.Am) for (std::uint32_t b : p.Bm) {
          if (box_at_least(state[a].box2, state[b].box2, p.bound)) continue;
          const Key k{ a, b, bits(p.bound) };
          auto it = memo.find(k);
          if (it != memo.end() && it->second.va == state[a].uver && it->second.vb == state[b].uver) continue;
          if (askAt.count(k)) continue;
          askAt.emplace(k, ask.size()); ask.push_back(k);
        }
      }
      std::vector<std::uint8_t> pruned(ask.size(), 0);
      if (!ask.empty()) {
        put('Q'); put(static_cast<std::uint32_t>(ask.size()));
        for (const Key& k : ask) { double bd; std::memcpy(&bd, &k.bound, 8); put(k.a); put(k.b); put(bd); }
        std::fflush(stdout);
        if (!in.read(pruned.data(), pruned.size())) { std::fputs("sweep: truncated prune answers\n", stderr); std::exit(2); }
      }
      // pass 2: the loop itself
      for (Pair& p : pairs) {
        unitPairTests++;
        if (box_at_least(ub[p.ga], ub[p.gb], p.bound)) continue;
        unitPairPass++;
        double poseBest = INF; bool have = false; std::uint32_t pa = 0, pb = 0;
        for (std::uint32_t a : p.Am) for (std::uint32_t b : p.Bm) {
          if (box_at_least(state[a].box2, state[b].box2, p.bound)) continue;
          const Key k{ a, b, bits(p.bound) };
          const std::uint32_t va = state[a].uver, vb = state[b].uver;
          double d;
          auto it = memo.find(k);
          if (it != memo.end() && it->second.va == va && it->second.vb == vb) { d = it->second.d; memoHits++; }
          else {
            if (pruned[askAt.at(k)]) { d = INF; boxPruned++; }
            else {
              d = eng.view_distance(state[a], state[b], p.bound);   // meshClearance, its witness asked of JS
              if (d > 0 && d < 0.05) {
                put('V'); put(a); put(b); put(p.bound); std::fflush(stdout);
                if (in.get<char>() != 'v') { std::fputs("sweep: expected a verdict\n", stderr); std::exit(2); }
                if (in.get<std::uint8_t>()) d = 0;
              }
              exactCalls++;
            }
            memo[k] = { va, vb, d };
          }
          if (d < poseBest) { poseBest = d; have = true; pa = a; pb = b; }
        }
        if (poseBest < p.min) { p.min = poseBest; p.at = true; p.atAxis = ax; p.atF = f; p.hasMeshes = have; p.ma = pa; p.mb = pb; }
      }
    }
  }
  std::string out = "{\"state\":[";
  for (std::size_t k = 0; k < pairs.size(); k++) {
    const Pair& s = pairs[k];
    if (k) out += ',';
    out += "{\"min\":" + (s.min == INF ? std::string("null") : num(s.min));
    out += s.at ? ",\"at\":[" + std::to_string(s.atAxis) + "," + num(s.atF) + "]" : std::string(",\"at\":null");
    out += s.hasMeshes ? ",\"meshes\":[" + std::to_string(s.ma) + "," + std::to_string(s.mb) + "]}" : std::string(",\"meshes\":null}");
  }
  out += "],\"census\":{\"unitPairTests\":" + std::to_string(unitPairTests) + ",\"unitPairPass\":" + std::to_string(unitPairPass) +
    ",\"exactCalls\":" + std::to_string(exactCalls) + ",\"memoHits\":" + std::to_string(memoHits) + ",\"boxPruned\":" + std::to_string(boxPruned) +
    "},\"poses\":" + std::to_string(poses) + "}";
  put('R'); put(static_cast<std::uint32_t>(out.size())); put(out.data(), out.size()); std::fflush(stdout);
  return 0;
}

}  // namespace sweep

int main() {
  using namespace sweep;
  std::setvbuf(stdin, nullptr, _IOFBF, 1 << 22);
  Reader in(stdin);
  Engine eng(static_cast<std::size_t>(1536) * 1024 * 1024);
  struct Unit { std::string name; std::vector<std::uint32_t> meshes; };
  struct Pair { std::uint32_t ai, bi; std::string key; bool expected; };
  struct Finding { std::string pair; bool expected; std::vector<std::pair<std::uint32_t, std::vector<double>>> axes; };
  std::vector<Unit> units; std::vector<Pair> pairs; std::vector<std::string> axisNames;
  std::vector<MeshState> state;
  std::vector<Box6> unitBox;
  std::vector<Finding> findings; std::map<std::string, std::size_t> findingAt;
  struct Memo { std::uint32_t va = 0, vb = 0; bool r = false, valid = false; };
  std::unordered_map<std::uint64_t, Memo> memo;
  Census& c = eng.census;

  for (;;) {
    const char tag = in.get<char>();
    if (tag == 'E') break;
    if (tag == 'H') {
      const std::uint32_t len = in.get<std::uint32_t>();
      std::string text(len, '\0'); in.read(text.data(), len);
      std::size_t i = 0; const Json h = parse(text, i);
      if (h["check"].s == "clearances") return run_clearances(in, eng, h);
      if (h["check"].s == "undeclared") return run_undeclared(in, eng, h);
      for (auto& u : h["units"].a) { Unit x; x.name = u["name"].s; for (auto& m : u["meshes"].a) x.meshes.push_back(static_cast<std::uint32_t>(m.n)); units.push_back(std::move(x)); }
      for (auto& p : h["pairs"].a) pairs.push_back({ static_cast<std::uint32_t>(p["ai"].n), static_cast<std::uint32_t>(p["bi"].n), p["key"].s, p["expected"].b });
      for (auto& a : h["axes"].a) axisNames.push_back(a["name"].s);
      state.resize(static_cast<std::size_t>(h["meshCount"].n));
      unitBox.resize(units.size());
      eng.touch = h["CONTACT_TOUCH"].n;
    } else if (tag == 'G') {
      read_geometry(in, eng);
    } else if (tag == 'P') {
      std::uint32_t axis;
      const double f = read_pose(in, state, unitBox, axis);
      // runInspection's pair loop: the unit broad phase, then unitsIntersect, which
      // returns at the first mesh pair in contact.
      for (const Pair& p : pairs) {
        c.unitPairTests++;
        if (!boxes_can_touch(unitBox[p.ai], unitBox[p.bi], eng.touch)) continue;
        c.unitPairPass++;
        bool hit = false;
        for (std::uint32_t a : units[p.ai].meshes) {
          for (std::uint32_t b : units[p.bi].meshes) {
            c.aabbTests++;
            if (!boxes_can_touch(state[a].box, state[b].box, eng.touch)) continue;
            c.aabbPass++;
            c.exactCalls++;
            // inspect.js' static-pair memo, the same rule: a query whose two inputs
            // are the states it last ran on returns what it returned (exact replay;
            // the census counts the logical call either way, as the JS replay does).
            Memo& mm = memo[(static_cast<std::uint64_t>(a) << 32) | b];
            bool r;
            if (mm.va == state[a].ver && mm.vb == state[b].ver && mm.valid) r = mm.r;
            else { r = eng.meshes_intersect(state[a], state[b]); mm = { state[a].ver, state[b].ver, r, true }; }
            if (r) c.boolTrue++; else c.boolFalse++;
            if (r) { hit = true; break; }
          }
          if (hit) break;
        }
        if (!hit) continue;
        auto it = findingAt.find(p.key);
        if (it == findingAt.end()) { it = findingAt.emplace(p.key, findings.size()).first; findings.push_back({ p.key, p.expected, {} }); }
        Finding& fd = findings[it->second];
        if (fd.axes.empty() || fd.axes.back().first != axis) {
          bool found = false;
          for (auto& [ax, fs] : fd.axes) if (ax == axis) { fs.push_back(f); found = true; break; }
          if (!found) fd.axes.push_back({ axis, { f } });
        } else fd.axes.back().second.push_back(f);
      }
    } else { std::fprintf(stderr, "sweep: unknown record '%c'\n", tag); return 2; }
  }

  std::string out = "{\"findings\":[";
  for (std::size_t k = 0; k < findings.size(); k++) {
    const Finding& fd = findings[k];
    if (k) out += ',';
    out += "{\"pair\":" + quote(fd.pair) + ",\"class\":" + (fd.expected ? "\"EXPECTED\"" : "\"FORBIDDEN\"") + ",\"axes\":[";
    for (std::size_t j = 0; j < fd.axes.size(); j++) {
      if (j) out += ',';
      out += "[" + quote(axisNames[fd.axes[j].first]) + ",[";
      for (std::size_t q = 0; q < fd.axes[j].second.size(); q++) { if (q) out += ','; out += num(fd.axes[j].second[q]); }
      out += "]]";
    }
    out += "]}";
  }
  out += "],\"census\":{\"aabbTests\":" + std::to_string(c.aabbTests) + ",\"aabbPass\":" + std::to_string(c.aabbPass) +
    ",\"exactCalls\":" + std::to_string(c.exactCalls) + ",\"boolTrue\":" + std::to_string(c.boolTrue) + ",\"boolFalse\":" + std::to_string(c.boolFalse) +
    ",\"unitPairTests\":" + std::to_string(c.unitPairTests) + ",\"unitPairPass\":" + std::to_string(c.unitPairPass) + "}}";
  std::fwrite(out.data(), 1, out.size(), stdout);
  return 0;
}
