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
#include <unordered_map>
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

struct MeshState { std::uint32_t own = 0, view = 0; bool rigid = true; Mat world{}, frame{}; Box6 box{}; std::uint32_t ver = 0; };
struct Geometry { std::vector<float> pos; std::vector<std::uint32_t> idx; std::uint32_t nvert = 0, ntri = 0; u32 handle = 0; u32 gen = 0; };

class Engine {
 public:
  explicit Engine(std::size_t arena) : mem_(arena) { kernel_bind(mem_.data(), static_cast<u32>(arena)); reset(); mat_ = alloc(128); }

  double touch = 1e-4;
  Census census;

  void add_geometry(std::uint32_t id, Geometry g) { if (geoms_.size() <= id) geoms_.resize(id + 1); geoms_[id] = std::move(g); }

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
  std::vector<u8> mem_;
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
      for (auto& u : h["units"].a) { Unit x; x.name = u["name"].s; for (auto& m : u["meshes"].a) x.meshes.push_back(static_cast<std::uint32_t>(m.n)); units.push_back(std::move(x)); }
      for (auto& p : h["pairs"].a) pairs.push_back({ static_cast<std::uint32_t>(p["ai"].n), static_cast<std::uint32_t>(p["bi"].n), p["key"].s, p["expected"].b });
      for (auto& a : h["axes"].a) axisNames.push_back(a["name"].s);
      state.resize(static_cast<std::size_t>(h["meshCount"].n));
      unitBox.resize(units.size());
      eng.touch = h["CONTACT_TOUCH"].n;
    } else if (tag == 'G') {
      Geometry g; const std::uint32_t id = in.get<std::uint32_t>();
      g.nvert = in.get<std::uint32_t>(); g.ntri = in.get<std::uint32_t>();
      g.pos.resize(g.nvert * 3); g.idx.resize(g.ntri * 3);
      in.read(g.pos.data(), g.pos.size() * 4); in.read(g.idx.data(), g.idx.size() * 4);
      eng.add_geometry(id, std::move(g));
    } else if (tag == 'P') {
      const std::uint32_t axis = in.get<std::uint32_t>(); in.get<std::uint32_t>();
      const double f = in.get<double>();
      for (auto& b : unitBox) in.read(&b, sizeof b);
      const std::uint32_t nch = in.get<std::uint32_t>();
      for (std::uint32_t k = 0; k < nch; k++) {
        MeshState& s = state.at(in.get<std::uint32_t>());
        MeshState n;
        n.own = in.get<std::uint32_t>(); n.view = in.get<std::uint32_t>(); n.rigid = in.get<std::uint32_t>() != 0;
        in.read(n.world.data(), 128); in.read(n.frame.data(), 128); in.read(&n.box, sizeof n.box);
        // A new version only when the state really differs, bit for bit (the exporter
        // re-sends a mesh with children every pose): the memo's rule is the inputs, not
        // whether they were sent.
        n.ver = s.ver;
        if (s.ver == 0 || n.own != s.own || n.view != s.view || n.rigid != s.rigid || std::memcmp(n.world.data(), s.world.data(), 128) ||
            std::memcmp(n.frame.data(), s.frame.data(), 128) || std::memcmp(&n.box, &s.box, sizeof n.box)) n.ver = s.ver + 1;
        s = n;
      }
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
