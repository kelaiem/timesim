// TODO 137 step 2 — HOW MUCH THIN METAL CAN THE STOCK RULER NOT SEE?
//
// `stockFloor` reads a mesh's geometry-LOCAL bounding box and calls its smallest
// side the stock. For a flat member cut from a bent or branching outline that is
// the wrong side: the box is the bend's ENVELOPE, so its smallest side is the
// extrude depth, which is at the floor by construction, while the metal inside
// the envelope can be narrower than anything the box shows. `slenderness` reads
// the same box. `outlines` asks only whether the ring is simple. Nobody has
// counted the class — "every ExtrudeGeometry whose authored outline is narrower
// than its box" — and it is readable at all only because TODO 100 made
// `weldGeometry` carry `parameters.shapes` through the weld.
//
// WHAT IT MEASURES. A section is not a number a polygon has; it is a property of
// a place. This asks the floor's question of the polygon, point by point: is the
// largest disc that fits inside the shape AND covers this point at least the
// floor wide? The area where it is not is the shape's THIN FRACTION. That is
// morphological OPENING — erode by r, dilate back by r — whose lost area is
// exactly the set of points no disc of radius r covers, so one opening per width
// gives the thickness spectrum: `t05`, `t10`, `t15` are the fractions of the
// shape's area thinner than 0.5, 1.0 and 1.5 x the floor.
//
// WHY A FRACTION AND NOT "ANY": a gear tooth tapers to a point by design, and a
// point is thinner than any floor. The first cut of this probe flagged on any
// area lost and returned 39 "hidden" rows, nearly all wheels and pinions — teeth,
// and the instrument could not tell a tooth tip from a thin arm. A tooth costs
// a gear 10-14% of its area at the floor (measured here); a member cut from a
// thin strip loses most of it. So a row is FLAGGED when t10 >= THIN_FRAC (a
// quarter of its metal is under the floor), or when opening at the floor SPLITS
// it into two or more pieces that each hold at least SPLIT_FRAC of the area — a
// substantial part hanging from a neck narrower than the floor. Both thresholds
// are stated here and are screen settings, not physics: the tooth tapers set
// the first just above what they cost, and the second is above one gear tooth's
// share of a pinion.
//
// THE FLOOR is each mesh's OWN kind's, resolved the way `checkStockFloor` does
// it (STOCK_KIND_BY_MESH, then STOCK_KIND_BY_PART, else 'wheel'). The first cut
// used the 'wheel' floor for every row and flagged the central hands, which are
// declared 'hand' (0.10 mm floor) and cut 0.20 mm, and passed the click pawl,
// which is declared 'spring': a screen that judges a spring against sheet stock
// is measuring its own assumption.
//
// HIDDEN = the stock ruler's number for the mesh is AT OR OVER the floor while
// wFail says the metal is not. VISIBLE = the ruler already reads it under. The
// split is the point: VISIBLE rows are known debt; HIDDEN rows are the finding.
//
// CONTROLS (a probe that reports 0 has measured nothing until these fire): a
// bent strip 0.2 u wide must FAIL at the floor; one 0.5 u wide must PASS it; a
// fat square must PASS; two blocks joined by a 0.2 u neck must FAIL by splitting.
//
// A REPORT (§40): prints and exits 0 unless a control is wrong.
// Usage: node probe-137-hidden-thin.mjs [out.json]    (from tools/)
import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import { writeFileSync } from 'node:fs';

const PORT = process.env.PORT || 8475;
const ROOT = process.env.ROOT || '..';
const srv = spawn('python3', ['-m', 'http.server', String(PORT), '--bind', '127.0.0.1'], { cwd: ROOT, stdio: 'ignore' });
await new Promise((r) => setTimeout(r, 800));
const browser = await chromium.launch();
const page = await browser.newPage();
page.on('pageerror', (e) => console.error('PAGEERROR', String(e)));
await page.goto(`http://127.0.0.1:${PORT}/index.html`, { waitUntil: 'load', timeout: 240000 });
await page.waitForFunction(() => (!!window.__clock && !!window.__clock.boot) || !!window.__bootError, null, { timeout: 240000 });

const V = await page.evaluate(async () => {
  const THREE = await import('./vendor/three.module.js');
  const I = await import('./src/inspect.js');
  const { UNIT_MM } = await import('./src/layout.js');
  const clock = window.__clock;
  const FLOOR_WHEEL_U = I.STOCK_FLOORS.wheel.mm / UNIT_MM;
  const LADDER = [0.5, 0.75, 1.0, 1.5];
  const INF = 1e20;
  const THIN_FRAC = 0.25, SPLIT_FRAC = 0.15;

  // ---- squared Euclidean distance transform (Felzenszwalb & Huttenlocher). `feat` = 1 on feature cells.
  function edt(feat, W, H) {
    const f = new Float64Array(Math.max(W, H)), d = new Float64Array(Math.max(W, H));
    const v = new Int32Array(Math.max(W, H)), z = new Float64Array(Math.max(W, H) + 1);
    const out = new Float64Array(W * H);
    for (let i = 0; i < W * H; i++) out[i] = feat[i] ? 0 : INF;
    const pass = (n, get, set) => {
      for (let q = 0; q < n; q++) f[q] = get(q);
      let k = 0; v[0] = 0; z[0] = -INF; z[1] = INF;
      for (let q = 1; q < n; q++) {
        let s;
        for (;;) {
          const p = v[k];
          s = ((f[q] + q * q) - (f[p] + p * p)) / (2 * q - 2 * p);
          if (s <= z[k] && k > 0) k--; else break;
        }
        if (s <= z[k]) { v[0] = q; z[0] = -INF; z[1] = INF; k = 0; } else { k++; v[k] = q; z[k] = s; z[k + 1] = INF; }
      }
      k = 0;
      for (let q = 0; q < n; q++) { while (z[k + 1] < q) k++; const p = v[k]; d[q] = (q - p) * (q - p) + f[p]; }
      for (let q = 0; q < n; q++) set(q, d[q]);
    };
    for (let x = 0; x < W; x++) pass(H, (q) => out[q * W + x], (q, val) => { out[q * W + x] = val; });
    for (let y = 0; y < H; y++) pass(W, (q) => out[y * W + q], (q, val) => { out[y * W + q] = val; });
    return out;
  }

  // ---- fill a shape (outer ring + holes) into a grid by even-odd scanlines.
  function raster(rings, h, pad) {
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    for (const r of rings) for (const p of r) { x0 = Math.min(x0, p.x); y0 = Math.min(y0, p.y); x1 = Math.max(x1, p.x); y1 = Math.max(y1, p.y); }
    x0 -= pad; y0 -= pad; x1 += pad; y1 += pad;
    const W = Math.ceil((x1 - x0) / h) + 1, H = Math.ceil((y1 - y0) / h) + 1;
    const m = new Uint8Array(W * H);
    for (let j = 0; j < H; j++) {
      const y = y0 + (j + 0.5) * h; const xs = [];
      for (const r of rings) for (let i = 0; i < r.length; i++) {
        const a = r[i], b = r[(i + 1) % r.length];
        if ((a.y > y) !== (b.y > y)) xs.push(a.x + ((y - a.y) / (b.y - a.y)) * (b.x - a.x));
      }
      xs.sort((p, q) => p - q);
      for (let k = 0; k + 1 < xs.length; k += 2) {
        const i0 = Math.max(0, Math.ceil((xs[k] - x0) / h - 0.5)), i1 = Math.min(W - 1, Math.floor((xs[k + 1] - x0) / h - 0.5));
        for (let i = i0; i <= i1; i++) m[j * W + i] = 1;
      }
    }
    return { m, W, H, x0, y0 };
  }
  const count = (m) => { let n = 0; for (let i = 0; i < m.length; i++) n += m[i]; return n; };
  function pieces(m, W, H, minCells, want) {
    const seen = new Uint8Array(m.length); let n = 0; const stack = [];
    for (let s = 0; s < m.length; s++) {
      if (!m[s] || seen[s]) continue;
      let c = 0, sx = 0, sy = 0; stack.push(s); seen[s] = 1;
      while (stack.length) {
        const q = stack.pop(); c++; const x = q % W, y = (q - x) / W; sx += x; sy += y;
        if (x > 0 && m[q - 1] && !seen[q - 1]) { seen[q - 1] = 1; stack.push(q - 1); }
        if (x < W - 1 && m[q + 1] && !seen[q + 1]) { seen[q + 1] = 1; stack.push(q + 1); }
        if (y > 0 && m[q - W] && !seen[q - W]) { seen[q - W] = 1; stack.push(q - W); }
        if (y < H - 1 && m[q + W] && !seen[q + W]) { seen[q + W] = 1; stack.push(q + W); }
      }
      if (c >= minCells) { n++; if (want) want.push({ cells: c, cx: sx / c, cy: sy / c }); }
    }
    return n;
  }
  // opening by a disc of radius r: the area it loses, and the pieces it leaves.
  function open(g, r) {
    const { m, W, H } = g, area = count(m);
    const out = new Uint8Array(m.length); for (let i = 0; i < m.length; i++) out[i] = m[i] ? 0 : 1;
    const dOut = edt(out, W, H);                              // squared distance (cells) to the outside
    const er = new Uint8Array(m.length); const rc2 = (r / g.h) * (r / g.h);
    for (let i = 0; i < m.length; i++) er[i] = m[i] && dOut[i] >= rc2 ? 1 : 0;
    const dEr = edt(er, W, H);
    const op = new Uint8Array(m.length);
    for (let i = 0; i < m.length; i++) op[i] = dEr[i] <= rc2 && m[i] ? 1 : 0;
    const det = []; pieces(op, W, H, 1, det);
    return { area, lost: area > 0 ? 1 - count(op) / area : 1, det };
  }
  function measure(rings, FLOOR_U) {
    const rMin = 0.5 * FLOOR_U / 2;
    let bx = Infinity, by = Infinity, bX = -Infinity, bY = -Infinity;
    for (const r of rings) for (const p of r) { bx = Math.min(bx, p.x); by = Math.min(by, p.y); bX = Math.max(bX, p.x); bY = Math.max(bY, p.y); }
    const h = Math.max(rMin / 4, Math.max(bX - bx, bY - by) / 1500);
    const g = raster(rings, h, 1.5 * FLOOR_U + 4 * h); g.h = h;
    const t = {}; let split = [];
    for (const f of LADDER) {
      const o = open(g, (f * FLOOR_U) / 2);
      t[f] = o.lost;
      if (f === 1.0) split = o.det.map((d) => d.cells / o.area).filter((x) => x >= SPLIT_FRAC).sort((a, b) => b - a);
      if (f === 1.0) t.area = o.area * h * h;
    }
    return { t05: t[0.5], t10: t[1.0], t15: t[1.5], split, areaU2: t.area, h };
  }
  const flagged = (m) => m.t10 >= THIN_FRAC || m.split.length >= 2;
  const ringsOf = (shape) => { const e = shape.extractPoints(12); return [e.shape, ...e.holes]; };
  const P = (...xy) => { const o = []; for (let i = 0; i < xy.length; i += 2) o.push(new THREE.Vector2(xy[i], xy[i + 1])); return o; };

  // ---- CONTROLS
  const strip = (w) => P(0, 0, 6, 0, 6, w, w, w, w, 6, 0, 6);               // an L, arm width w
  const neck = P(0, 0, 3, 0, 3, 1.4, 5, 1.4, 5, 0, 8, 0, 8, 3, 5, 3, 5, 1.6, 3, 1.6, 3, 3, 0, 3);  // two blocks, 0.2 u neck
  const controls = [
    { name: 'bent strip 0.2 u (under floor)', rings: [strip(0.2)], want: (m) => flagged(m) },
    { name: 'bent strip 0.5 u (over floor)', rings: [strip(0.5)], want: (m) => !flagged(m) },
    { name: 'fat square 3 u', rings: [P(0, 0, 3, 0, 3, 3, 0, 3)], want: (m) => !flagged(m) },
    { name: 'two blocks, 0.2 u neck', rings: [neck], want: (m) => flagged(m) && m.split.length >= 2 },
    { name: 'square 3 u with a sharp spike (a "tooth")', rings: [P(0, 0, 3, 0, 3, 3, 1.5, 6, 0, 3)], want: (m) => !flagged(m) },
  ].map((c) => { const m = measure(c.rings, FLOOR_WHEEL_U); return { name: c.name, t10: +m.t10.toFixed(3), split: m.split.length, ok: c.want(m) }; });

  // ---- THE CLASS: every Extrude with a readable authored shape in a labelled unit.
  const { STOCK_WAIVERS } = I;
  const rows = []; let extrudes = 0, noShape = 0, scaled = 0;
  // ONE ROW PER MESH, attributed to its nearest (deepest) labelled unit — the
  // census's own rule ("nested units otherwise list the same part twice"). A hand
  // mounted on the dial sits under both `Dial` and its own unit and would
  // otherwise be judged twice, against two kinds.
  const depthOf = (o) => { let n = 0; for (let p = o.parent; p; p = p.parent) n++; return n; };
  const owner = new Map();
  for (const e of clock.labelEntries) {
    const d = depthOf(e.obj);
    e.obj.traverse((o) => { const cur = owner.get(o); if (!cur || d > cur.d) owner.set(o, { d, name: e.name }); });
  }
  for (const e of clock.labelEntries) {
    const walk = (o) => {
      if (o.userData && o.userData.schematic) return;
      if (o.isMesh && o.geometry && o.geometry.type === 'ExtrudeGeometry' && owner.get(o).name === e.name) {
        extrudes++;
        const shapes = o.geometry.parameters && o.geometry.parameters.shapes;
        if (!shapes) { noShape++; }
        else {
          const ws = o.getWorldScale(new THREE.Vector3());
          if (Math.abs(ws.x - 1) > 1e-6 || Math.abs(ws.y - 1) > 1e-6) scaled++;
          const list = Array.isArray(shapes) ? shapes : [shapes];
          let boxMin = Infinity;
          o.geometry.computeBoundingBox(); const b = o.geometry.boundingBox;
          boxMin = Math.min((b.max.x - b.min.x) * Math.abs(ws.x), (b.max.y - b.min.y) * Math.abs(ws.y), (b.max.z - b.min.z) * Math.abs(ws.z));
          const declared = typeof o.userData.stockSection === 'number' ? o.userData.stockSection : null;
          const rulerU = declared !== null ? declared : boxMin;
          let worst = null;
          const kind = I.STOCK_KIND_BY_MESH[o.name] || I.STOCK_KIND_BY_PART[e.name] || 'wheel';
          const floorMM = I.STOCK_FLOORS[kind].mm, floorU = floorMM / UNIT_MM;
          for (const sh of list) { const m = measure(ringsOf(sh), floorU); if (worst === null || m.t10 > worst.t10) worst = m; }
          rows.push({ unit: e.name, mesh: o.name || '(unnamed)', kind, floorMM, rulerMM: +(rulerU * UNIT_MM).toFixed(4), declared: declared !== null,
            areaMM2: +(worst.areaU2 * UNIT_MM * UNIT_MM).toFixed(3), t05: +worst.t05.toFixed(3), t10: +worst.t10.toFixed(3), t15: +worst.t15.toFixed(3),
            split: worst.split.map((x) => +x.toFixed(2)), flag: flagged(worst), waived: STOCK_WAIVERS[e.name] || null });
        }
      }
      for (const c of o.children) walk(c);
    };
    walk(e.obj);
  }
  return { controls, rows, extrudes, noShape, scaled };
});

await browser.close(); srv.kill();

const fail = V.controls.filter((c) => !c.ok);
console.log('CONTROLS'); for (const c of V.controls) console.log(`  ${c.ok ? 'PASS' : 'FAIL'}  ${c.name}  t10 ${c.t10}  pieces>=15% ${c.split}`);
const flagged = V.rows.filter((r) => r.flag).sort((a, b) => b.t10 - a.t10);
const hidden = flagged.filter((r) => r.rulerMM >= r.floorMM - 1e-9);
const visible = flagged.filter((r) => r.rulerMM < r.floorMM - 1e-9);
console.log(`\n${V.extrudes} extrudes in labelled units (${V.noShape} with no readable shape, ${V.scaled} with a scaled frame); each judged against its own kind's floor`);
console.log(`${V.rows.length} measured · ${flagged.length} flagged (>= 25% of the metal under the floor, or split by a sub-floor neck) · HIDDEN from the ruler ${hidden.length} · VISIBLE ${visible.length}`);
const line = (r) => `  ${r.unit.padEnd(26)} ${r.mesh.padEnd(26)} ${(r.kind + ' ' + r.floorMM).padEnd(12)} ruler ${String(r.rulerMM).padEnd(7)}${r.declared ? ' (declared)' : '           '} thin@0.5/1/1.5x ${r.t05}/${r.t10}/${r.t15}  split ${JSON.stringify(r.split)}${r.waived ? '  waived ' + r.waived : ''}`;
console.log('\nHIDDEN (the ruler reads >= floor, the outline says otherwise):'); for (const r of hidden) console.log(line(r));
console.log('\nVISIBLE (already under the floor on the ruler):'); for (const r of visible) console.log(line(r));
const gearish = V.rows.filter((r) => !r.flag && r.t10 >= 0.08);
console.log(`\n${gearish.length} unflagged rows lose 8-25% at the floor (tooth tips and the like); ${V.rows.filter((r) => r.t10 < 0.08).length} lose under 8%.`);
if (process.argv[2]) writeFileSync(process.argv[2], JSON.stringify(V, null, 1));
if (fail.length) { console.error(`\n${fail.length} CONTROL(S) WRONG — the instrument is not measuring what it claims`); process.exit(1); }
