// WHICH AUTHORED OUTLINES DID A CHANGE MOVE, and what do they sit on?
//
// Most of this movement's cuts are not literals. A plate's openings are
// "measured off parts that already exist" (main.js's own words at the
// three-quarter plate build), the escapement VIEW is taken from the swept
// maxima of the escapement's parts, and a station solve re-runs whenever an
// input to it moves. So a change to one mechanism silently re-cuts outlines
// belonging to parts it never names — and a diff of `src/` cannot show that,
// because the source of the moved outline did not change. Only the built
// scene knows.
//
// That is not hypothetical. TODO 115 reversed the going train and its own
// scope paragraph claimed "the plates ... are untouched". The three-quarter
// plate's escape-wheel opening had gone 4.78 × 8.4271 to 4.78 × 8.035 and its
// silhouette had moved over ~40 points, because mirroring the pallet fork and
// the escape wheel moved the lobe the escapement view is cut from. The claim
// shipped in a merged PR and was corrected afterwards; this file is what would
// have caught it before.
//
// WHAT IT IS NOT, so the next search works:
//   · probe-outline-simple.mjs (TODO 100) sweeps the SAME population and asks
//     whether each ring is a simple polygon — a property of one tree. It would
//     pass on both sides of a move.
//   · probe-handedness.mjs's census sweeps the same population again and asks
//     whether a cut is HANDED, one tree at a time. Running it twice by hand and
//     diffing the output is how the plate row was noticed; this file is that
//     manoeuvre made repeatable, and it reports displacements rather than
//     mirror residuals.
//   · probe-77-census.mjs is the closest METHODOLOGICAL relative — it exists to
//     write a payload someone will diff — but its payload is meshIntegrity's.
//   · probe-104-plate.mjs regenerates explain.html's plate figures from the
//     built parts; it republishes numbers rather than comparing trees.
//
// HOW IT MEASURES. Each tree is archived to a temp dir, booted, and every
// extrude that still carries its authored `parameters.shapes` is read — the
// same route and the same conventions as the handedness census: schematic
// display is skipped, and there is ONE row per GEOMETRY, because a wheel
// instanced at four stations is one cut. Contours are sampled with
// `getPoints(64)`, which is deterministic for a given curve, so an unchanged
// outline compares EXACTLY and the epsilon below is about float, not sampling.
//
// IDENTITY ACROSS TREES is the part that can lie, and the first draft of this
// file lied. `geometry.id` is allocation order and means nothing between
// boots, so rows were keyed by `unit ∥ meshName ∥ ordinal`. Run across
// TODO 115's reversal that reported the three-quarter plate's two
// `chatonSeatLand` cuts as moved 1.2454 each and RESAMPLED reciprocally,
// 59 → 58 points and 58 → 59: the unmistakable shape of two same-named
// geometries SWAPPING traversal order, reported as movement because the
// ordinal is positional and nothing else distinguished them.
//
// So identity is geometric instead. Rows are grouped by
// `unit ∥ meshName ∥ contour role`, and within a group the two trees' members
// are paired by nearest in POSITION AND SIZE — world centroid plus bounding
// box — with an equal point count preferred outright. Centroid alone is not
// enough and the second draft proved it: two CONCENTRIC contours are
// equidistant from either candidate, so pairing on centroid mismatched the
// dial's two rings and reported 331 → 129 points and 129 → 331, a reciprocal
// resample that is the signature of a crossed pairing rather than of movement.
// Members left unpaired are reported SEPARATELY and loudly as ADDED and
// REMOVED, never allowed to masquerade as movement.
//
// The residue this leaves, named: two same-named cuts of the SAME SIZE that
// genuinely exchange positions are indistinguishable from two that did not
// move, because nearest-anything is the wrong question there. Nothing in one
// pair of dumps can tell those apart; a run that suspects it has to read the
// source. Reciprocal rows — two entries of one group whose changes mirror each
// other — are the tell, and both drafts above were caught by exactly that.
//
// AND WHAT IT SITS ON is the second half of the question, because "the plate
// moved" is not actionable and "the plate's opening at the escape station
// moved" is. Each moved contour's centroid is carried into world through the
// mesh's own matrixWorld and reported with the nearest declared station in
// `__clock.P` and its distance. hole[10] above named itself that way: centroid
// (4.92, −26.61) against the `escape` station at (4.9, −26.6), d = 0.01.
//
// CONTROLS, and their honest limit:
//   · must-MISS — a tree diffed against ITSELF must report zero moved contours,
//     AND a non-zero population that matches on both sides. The second clause
//     is the load-bearing one: comparing identical dumps reports zero whether
//     the dumper read 573 outlines or none, which is TODO 100's own recorded
//     failure ("read 3 geometries of 573 and answered 0 crossings") arriving
//     one instrument later.
//   · must-HIT — one named contour in a copy of the dump is displaced by a
//     known ε and the differ must report exactly that contour, at exactly that
//     displacement.
//   The must-hit controls the DIFFER, which is a pure function of two dumps.
//   It does not control the DUMPER end to end; nothing here can, without a
//   third tree known to differ. What guards the dumper is the population
//   assertion above — a dumper that read nothing fails loudly rather than
//   reporting a clean diff.
//
// REPORT, with an ACCEPTANCE spine: it exits non-zero only if a control fails
// or a tree cannot be read, because whether a move is RIGHT is a judgement the
// reader makes. The plate's move above was correct — a derivation doing its
// job. A station moving would not have been. The instrument's job is to put
// the row in front of someone, not to decide.
//
// Usage, from tools/, with a Playwright Chromium:
//   node probe-outline-moves.mjs [refBefore] [refAfter]     (default: origin/main HEAD)
//   node probe-outline-moves.mjs --self <ref>               (controls only)
import { chromium } from 'playwright';
import { spawn, execFileSync } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const ROOT = new URL('..', import.meta.url).pathname.replace(/\/$/, '');
const argv = process.argv.slice(2);
const selfOnly = argv.includes('--self');
const refs = argv.filter((a) => !a.startsWith('--'));
const REF_A = refs[0] ?? 'origin/main';
const REF_B = selfOnly ? REF_A : (refs[1] ?? 'HEAD');
const EPS = 1e-9;          // an unchanged curve samples EXACTLY; this is float, not tolerance
const CTRL_EPS = 0.0125;   // the must-hit displacement — no relation to any budget

const servers = [];
const dirs = [];
const cleanup = () => {
  for (const s of servers) { try { s.kill(); } catch { /* already gone */ } }
  for (const d of dirs) { try { rmSync(d, { recursive: true, force: true }); } catch { /* best effort */ } }
};
process.on('exit', cleanup);
process.on('SIGINT', () => { cleanup(); process.exit(130); });

// A probe that throws before reaping its server leaves an orphan holding the
// port, and the NEXT run's spawn then fails silently while `goto` succeeds
// against the orphan — a boot timeout that looks like a change this tree broke.
// Ports are picked per run and every exit path reaps; see the skill's note.
let nextPort = Number(process.env.PORT || 8760);

async function dumpTree(ref) {
  const dir = mkdtempSync(join(tmpdir(), 'outline-'));
  dirs.push(dir);
  let sha;
  try {
    sha = execFileSync('git', ['rev-parse', '--short', ref], { cwd: ROOT }).toString().trim();
    const tar = execFileSync('git', ['archive', ref], { cwd: ROOT, maxBuffer: 1 << 28 });
    execFileSync('tar', ['-x', '-C', dir], { input: tar, maxBuffer: 1 << 28 });
  } catch (e) {
    throw new Error(`cannot archive ref "${ref}": ${e.message}`);
  }
  const port = String(nextPort++);
  const srv = spawn('python3', ['-m', 'http.server', port, '--bind', '127.0.0.1'], { cwd: dir, stdio: 'ignore' });
  servers.push(srv);
  await new Promise((r) => setTimeout(r, 900));
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage();
    page.on('pageerror', (e) => console.log(`PAGEERROR [${ref}]`, String(e)));
    await page.goto(`http://127.0.0.1:${port}/index.html`, { waitUntil: 'load', timeout: 90000 });
    await page.waitForFunction(() => !!window.__clock, null, { timeout: 90000 });
    const rows = await page.evaluate(() => {
      const C = window.__clock;
      // mesh -> unit label, so a row names a part the way the census does
      const owner = new Map();
      for (const e of C.labelEntries) {
        e.obj?.traverse?.((o) => { if (o.isMesh && !owner.has(o)) owner.set(o, e.name); });
      }
      C.scene.updateMatrixWorld(true);
      const seenGeo = new Set();
      const ord = new Map();
      const out = [];
      const sample = (curve, m) => {
        const pts = curve.getPoints(64);
        let cx = 0, cy = 0, minx = Infinity, maxx = -Infinity, miny = Infinity, maxy = -Infinity;
        const flat = [];
        for (const p of pts) {
          flat.push(p.x, p.y);
          cx += p.x; cy += p.y;
          if (p.x < minx) minx = p.x; if (p.x > maxx) maxx = p.x;
          if (p.y < miny) miny = p.y; if (p.y > maxy) maxy = p.y;
        }
        const n = pts.length || 1;
        // the contour's own centroid, carried into world through the mesh —
        // this is what lets a row name the station it sits on
        const w = new (Object.getPrototypeOf(m.position).constructor)(cx / n, cy / n, 0).applyMatrix4(m.matrixWorld);
        return { n: pts.length, flat,
          cx: cx / n, cy: cy / n, w: [w.x, w.y, w.z],
          bw: maxx - minx, bh: maxy - miny };
      };
      C.scene.traverse((o) => {
        if (!o.isMesh || o.userData?.schematic) return;   // flagged display never joins a sweep
        const g = o.geometry;
        if (!g?.parameters?.shapes) return;
        if (seenGeo.has(g.id)) return;                    // ONE row per geometry — an instanced wheel is one cut
        seenGeo.add(g.id);
        const unit = owner.get(o) ?? '(unlabelled)';
        const name = o.name || '';
        const base = `${unit}‖${name}`;
        const k = (ord.get(base) ?? 0);
        ord.set(base, k + 1);
        const shapes = Array.isArray(g.parameters.shapes) ? g.parameters.shapes : [g.parameters.shapes];
        shapes.forEach((s, si) => {
          out.push({ key: `${base}‖${k}#${si}/outer`, unit, name, contour: 'outer', ...sample(s, o) });
          (s.holes || []).forEach((h, hi) => {
            out.push({ key: `${base}‖${k}#${si}/hole${hi}`, unit, name, contour: `hole${hi}`, ...sample(h, o) });
          });
        });
      });
      const stations = Object.entries(C.P || {})
        .filter(([, v]) => v && typeof v.x === 'number' && typeof v.y === 'number')
        .map(([k, v]) => ({ k, x: v.x, y: v.y }));
      return { rows: out, stations };
    });
    return { ref, sha, ...rows };
  } finally {
    await browser.close();
    srv.kill();
  }
}

// THE DIFFER — a pure function of two dumps, which is what the must-hit
// control below is able to exercise.
function diff(A, B) {
  const group = (rows) => {
    const g = new Map();
    for (const r of rows) {
      const k = `${r.unit}‖${r.name}‖${r.contour}`;
      if (!g.has(k)) g.set(k, []);
      g.get(k).push(r);
    }
    return g;
  };
  const gA = group(A.rows), gB = group(B.rows);
  const moved = [], resampled = [], removed = [], added = [];
  const pairs = [];
  for (const [k, as] of gA) {
    const bs = (gB.get(k) || []).slice();
    for (const a of as) {
      if (!bs.length) { removed.push(a); continue; }
      // Nearest in POSITION AND SIZE, with an equal point count preferred
      // outright. Centroid alone is a coin flip between CONCENTRIC contours —
      // two rings sharing a centre are equidistant from either candidate — and
      // that is not hypothetical: pairing on centroid alone mismatched the
      // dial's two rings and reported them as 331 → 129 points and 129 → 331,
      // a reciprocal resample that is the signature of a crossed pairing
      // rather than of any movement. Size separates them, and a differing
      // point count is strong evidence two contours are not the same cut.
      let bi = 0, bd = Infinity;
      bs.forEach((b, i) => {
        const d = Math.hypot(a.w[0] - b.w[0], a.w[1] - b.w[1], a.w[2] - b.w[2],
          a.bw - b.bw, a.bh - b.bh) + (a.n === b.n ? 0 : 1e6);
        if (d < bd) { bd = d; bi = i; }
      });
      pairs.push([a, bs.splice(bi, 1)[0]]);
    }
    for (const leftover of bs) added.push(leftover);
  }
  for (const [k, bs] of gB) if (!gA.has(k)) for (const b of bs) added.push(b);
  for (const [a, b] of pairs) {
    if (a.n !== b.n) { resampled.push({ ...a, nB: b.n }); continue; }
    let worst = 0;
    for (let i = 0; i < a.flat.length; i += 2) {
      const d = Math.hypot(a.flat[i] - b.flat[i], a.flat[i + 1] - b.flat[i + 1]);
      if (d > worst) worst = d;
    }
    if (worst > EPS) {
      moved.push({ key: a.key, unit: a.unit, name: a.name, contour: a.contour, worst,
        dc: Math.hypot(a.cx - b.cx, a.cy - b.cy),
        dbw: b.bw - a.bw, dbh: b.bh - a.bh, w: b.w });
    }
  }
  return { moved: moved.sort((p, q) => q.worst - p.worst), resampled, removed, added };
}

const nearest = (stations, w) => {
  let best = null;
  for (const s of stations) {
    const d = Math.hypot(s.x - w[0], s.y - w[1]);
    if (!best || d < best.d) best = { k: s.k, d };
  }
  return best;
};

let bad = 0;
const f = (x, w = 8) => (Number.isFinite(x) ? x.toFixed(4) : String(x)).padStart(w);

const A = await dumpTree(REF_A);
console.log(`\nBEFORE  ${REF_A} (${A.sha})   ${A.rows.length} contours over ${new Set(A.rows.map((r) => r.key.split('#')[0])).size} geometries`);

// ---- CONTROLS ------------------------------------------------------------
console.log('\nCONTROLS');
{
  const self = diff(A, A);
  const okPop = A.rows.length > 0;
  const okSelf = self.moved.length === 0 && self.added.length === 0 && self.removed.length === 0;
  if (!okPop) { bad++; console.log('  FAIL must-miss  the dumper read ZERO contours — everything below would compare clean for that reason alone'); }
  else console.log(`  ok   must-miss  population is ${A.rows.length} contours, not zero`);
  if (!okSelf) { bad++; console.log(`  FAIL must-miss  a tree diffed against ITSELF reports ${self.moved.length} moved — the differ invents movement`); }
  else console.log('  ok   must-miss  a tree diffed against itself reports 0 moved, 0 added, 0 removed');

  // must-HIT: displace one contour by a known amount and require it back
  const victim = A.rows.find((r) => r.n > 3) ?? A.rows[0];
  const P = { rows: A.rows.map((r) => (r.key === victim.key
    ? { ...r, flat: r.flat.map((v, i) => (i % 2 === 0 ? v + CTRL_EPS : v)) }
    : r)), stations: A.stations };
  const hit = diff(A, P);
  const one = hit.moved.length === 1 && hit.moved[0].key === victim.key;
  const rightSize = one && Math.abs(hit.moved[0].worst - CTRL_EPS) < 1e-12;
  if (!one || !rightSize) {
    bad++;
    console.log(`  FAIL must-hit   displacing one contour by ${CTRL_EPS} reported ${hit.moved.length} row(s)`
      + `${one ? ` at ${hit.moved[0].worst}` : ''} — the differ cannot see a move it was handed`);
  } else {
    console.log(`  ok   must-hit   displacing "${victim.unit}/${victim.contour}" by ${CTRL_EPS} reports exactly it, at ${hit.moved[0].worst}`);
  }
}

if (selfOnly) {
  console.log(bad === 0 ? '\nPASS — controls hold (--self: no comparison run)' : '\nFAIL — a control failed');
  process.exit(bad === 0 ? 0 : 1);
}

// ---- THE COMPARISON — a REPORT ------------------------------------------
const B = await dumpTree(REF_B);
console.log(`AFTER   ${REF_B} (${B.sha})   ${B.rows.length} contours over ${new Set(B.rows.map((r) => r.key.split('#')[0])).size} geometries`);

const d = diff(A, B);

if (d.added.length || d.removed.length) {
  console.log(`\nPOPULATION CHANGED — ${d.added.length} added, ${d.removed.length} removed. Ordinals are positional,`);
  console.log('so rows after an added or removed mesh may read as moved for that reason. Read this block first.');
  for (const r of d.removed.slice(0, 20)) console.log(`  REMOVED  ${r.unit} / ${r.name || '(unnamed)'} ${r.contour}`);
  for (const r of d.added.slice(0, 20)) console.log(`  ADDED    ${r.unit} / ${r.name || '(unnamed)'} ${r.contour}`);
}
if (d.resampled.length) {
  console.log(`\nRESAMPLED — ${d.resampled.length} contour(s) changed point count, so no point-to-point displacement exists:`);
  for (const r of d.resampled) console.log(`  ${r.unit} / ${r.name || '(unnamed)'} ${r.contour}: ${r.n} → ${r.nB} points`);
}

console.log(`\nMOVED OUTLINES — ${d.moved.length} of ${A.rows.length} contours`);
if (!d.moved.length) {
  console.log('  none: every authored outline this tree cuts is identical on both refs.');
} else {
  console.log('  (worst = greatest point displacement; Δcentroid and Δbox are the shape of the move;');
  console.log('   "sits on" is the contour\'s own centroid carried into world, against the nearest declared station)\n');
  console.log('  worst     Δcentroid  Δbox w     Δbox h   part / mesh / contour                      sits on');
  for (const m of d.moved) {
    const st = nearest(B.stations, m.w);
    const where = st ? `${st.k} d=${st.d.toFixed(2)}` : '—';
    console.log(`  ${f(m.worst)} ${f(m.dc, 10)} ${f(m.dbw, 10)} ${f(m.dbh)}   `
      + `${`${m.unit} / ${m.name || '(unnamed)'} / ${m.contour}`.padEnd(42)} ${where}`);
  }
  console.log('\n  A moved outline is not by itself a defect. Most cuts here are DERIVED —');
  console.log('  a plate\'s openings are measured off parts that already exist — so the');
  console.log('  question each row asks is whether the part it sits on is one this change');
  console.log('  had any business moving.');
}

console.log(bad === 0 ? '\nPASS — controls hold, so the table above is readable' : '\nFAIL — a control failed; the table above is not readable');
process.exit(bad === 0 ? 0 : 1);
