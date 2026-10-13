// §219 tier three (b), landing B — READING LDraw PARTS, the format the LEGO
// community's part library is written in. Pure: no three.js, no DOM, so the
// probes that MEASURE the parts and the page that DRAWS them read one parser.
//
// THE FORMAT, as much of it as this needs. A file is lines; the first token is
// the line type:
//   0  meta / comment (`0 FILE name` opens a sub-file in a packed .mpd)
//   1  colour  x y z  a b c d e f g h i  file — a sub-file placed by the 3×4
//      matrix [a b c x; d e f y; g h i z]
//   2  colour  two points — an edge line
//   3  colour  three points — a triangle
//   4  colour  four points — a quad
//   5  an optional (conditional) edge, drawn only in silhouette; skipped here
// Units are LDU: 1 LDU = 0.4 mm, so a stud pitch is 20 and a brick 24. +Y
// points DOWN, so a part's top face is its smallest y.
// Colour 16 is "the colour of the part that placed me", resolved on the way
// down; 24 is "this part's edge colour" and is left for the renderer.
//
// Sub-file names are normalised the way the library resolves them: lower case,
// `\` as `/`, so `s\3024s01.dat` and `S/3024S01.DAT` are one file.

export const LDU_MM = 0.4;
export const normName = (f) => f.trim().replace(/\\/g, '/').toLowerCase();

// A packed library: one text, `0 FILE <name>` sections. Returns Map(name ->
// { lines, header }) where header keeps the `0 !LDRAW_ORG` status (so an
// unofficial part says so wherever it is read).
export function parseLibrary(text) {
  const lib = new Map();
  let cur = null;
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim();
    if (line.startsWith('0 FILE ')) {
      cur = { name: normName(line.slice(7)), lines: [], org: null, title: null };
      lib.set(cur.name, cur);
      continue;
    }
    if (!cur || !line) continue;
    const t = line.split(/\s+/);
    if (t[0] === '0') {
      if (t[1] === '!LDRAW_ORG') cur.org = t.slice(2).join(' ');
      else if (cur.title === null && t.length > 1 && !t[1].startsWith('!') && t[1] !== 'Name:' && t[1] !== 'Author:' && t[1] !== 'BFC') cur.title = t.slice(1).join(' ');
      continue;
    }
    const n = t.slice(1).map(Number);
    if (t[0] === '1') cur.lines.push({ type: 1, color: n[0], m: n.slice(1, 13), file: normName(t.slice(14).join(' ')) });
    else if (t[0] === '2') cur.lines.push({ type: 2, color: n[0], p: n.slice(1, 7) });
    else if (t[0] === '3') cur.lines.push({ type: 3, color: n[0], p: n.slice(1, 10) });
    else if (t[0] === '4') cur.lines.push({ type: 4, color: n[0], p: n.slice(1, 13) });
  }
  return lib;
}

// 3×4 matrices as [x y z a b c d e f g h i] (LDraw's own order): apply and compose.
export const IDENTITY = Object.freeze([0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1]);
const apply = (m, x, y, z) => [
  m[0] + m[3] * x + m[4] * y + m[5] * z,
  m[1] + m[6] * x + m[7] * y + m[8] * z,
  m[2] + m[9] * x + m[10] * y + m[11] * z,
];
export function compose(A, B) {           // A ∘ B: B placed inside A's frame
  const [x, y, z] = apply(A, B[0], B[1], B[2]);
  const r = (i, j) => A[3 + i * 3] * B[3 + j] + A[4 + i * 3] * B[6 + j] + A[5 + i * 3] * B[9 + j];
  return [x, y, z, r(0, 0), r(0, 1), r(0, 2), r(1, 0), r(1, 1), r(1, 2), r(2, 0), r(2, 1), r(2, 2)];
}

// Walk a file down to its geometry. `emit(kind, points[], color)` receives
// 'tri' (3 points) and 'edge' (2 points) in the caller's frame, LDU. Throws on
// a reference the library does not hold: a missing sub-file is a part drawn
// with a hole in it, which is a wrong answer and not a smaller one.
export function walk(lib, name, emit, m = IDENTITY, color = 16) {
  const f = lib.get(normName(name));
  if (!f) throw new Error(`LDraw: ${name} is not in the library`);
  const col = (c) => (c === 16 ? color : c);   // 24 stays 24: the renderer's edge colour
  for (const l of f.lines) {
    if (l.type === 1) { walk(lib, l.file, emit, compose(m, l.m), col(l.color)); continue; }
    const pts = [];
    for (let i = 0; i < l.p.length; i += 3) pts.push(apply(m, l.p[i], l.p[i + 1], l.p[i + 2]));
    if (l.type === 2) emit('edge', pts, col(l.color));
    else if (l.type === 3) emit('tri', pts, col(l.color));
    else { emit('tri', [pts[0], pts[1], pts[2]], col(l.color)); emit('tri', [pts[0], pts[2], pts[3]], col(l.color)); }
  }
}

// The axis-aligned bounds of a part's surface, LDU, in its own frame.
export function bounds(lib, name) {
  const lo = [Infinity, Infinity, Infinity], hi = [-Infinity, -Infinity, -Infinity];
  walk(lib, name, (kind, pts) => {
    if (kind !== 'tri') return;
    for (const p of pts) for (let k = 0; k < 3; k++) { lo[k] = Math.min(lo[k], p[k]); hi[k] = Math.max(hi[k], p[k]); }
  });
  return { lo, hi };
}

// Every placement of a sub-file whose name matches `re`, anywhere below
// `name`, in `name`'s frame — how a probe finds where a hole or a stud IS
// rather than where a table says it is.
export function placements(lib, name, re, m = IDENTITY, out = []) {
  const f = lib.get(normName(name));
  if (!f) throw new Error(`LDraw: ${name} is not in the library`);
  for (const l of f.lines) if (l.type === 1) {
    const mm = compose(m, l.m);
    if (re.test(l.file)) out.push({ file: l.file, m: mm });
    else placements(lib, l.file, re, mm, out);
  }
  return out;
}
