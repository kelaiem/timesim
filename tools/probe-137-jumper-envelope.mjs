// §137 — THE MINUTE JUMPER'S SWEPT ENVELOPE, ALONG THE ALARM LINK'S CHORD.
//
// TODO 16's prescribed measurement, and the reason it is prescribed: the lay
// shaft's section has been attacked twice and both attempts died in CI on the
// SAME row —
//
//   uniform r 0.447        → Alarm link ⇄ Minute jumper, overlap 0.312
//   stepped, body r 0.373  → the same pair, overlap 0.310
//
// A 16% radius cut moved the overlap by 0.002. That refutes the diagnosis it
// was made under (that the shaft's SECTION is the lever) and leaves the real
// question unanswered: WHERE along the chord, and against WHAT, does the alarm
// link enter the jumper's swept region at all? A third attempt sized against
// another guess would be a third revert, so nothing is resized until this has
// been measured. Gate B of the §137 plan is decided on this file's output.
//
// What it measures, and why each part of it is here rather than convenient:
//
//   · IT USES `buildSweptRegistry`, NOT A HAND SWEEP. Its `_volumes` are the
//     very hulls `checkSweptOverlap` judges, so a radius sized against these
//     numbers predicts CI by construction rather than by resemblance.
//   · IT ASSERTS THE CROWN GETS PULLED AT BOOT, measured off the metal (the
//     setting lever's angle, calibrated against posed crownPullT 0 and 1) and
//     not assumed. This is the exact hole the post-mortem names: a local run
//     with a saved pose measured the pair CLEAN while CI, booting virgin with
//     syncStart() pulling the crown, measured it CONFIRMED. A pulled crown
//     puts the minute jumper IN the star. It also names the axes that pose a
//     pulled crown, because those are what put the engaged jumper into the
//     hull the stations are measured against.
//   · IT REPORTS THE JUMPER HULL'S WORLD BOX AND ITS DIAL-LOCAL CENTRE.
//     `dialFace` is Y-flipped (dial-local (x, y) ↔ world (P.dial.x − x,
//     P.dial.y + y)), so a frame error is the cheapest way to produce a
//     confident wrong table — it has to be visible on the report's face.
//   · IT MEASURES EVERY ALARM-LINK MESH'S OWN HULL against the jumper's, not
//     just the shaft's axis. The two reverts are evidence that the binding
//     member may not be the shaft at all — a crank, a bush or a hanger would
//     never show up in a shaft-radius table, and would keep on not showing up
//     in the next one.
//   · IT MEASURES THE WHOLE ENVELOPE, NOT JUST THE JUMPER'S SIDE OF IT. A
//     resize that clears one CONFIRMED pair and fouls the next has bought
//     nothing, so every unit whose hull comes inside the candidate band
//     (r ≤ 0.6) is measured at every station and the binding one is named.
//     Declared partners of the link — MECH_GRAPH's own edges, so the split is
//     derived and not asserted here — are reported apart from walls: a
//     working contact's gap is not a bound on the section, though growing
//     into it does move a GATED penetration row.
//   · IT REPORTS TWO DISTANCES PER STATION. `dEuclid` is the true geometric
//     gap (what a cylinder of radius r consumes). `dCheb` — the largest
//     single-axis gap — is what the AABB test inside `staticHitsPath` actually
//     resolves, and it is the more permissive of the two. A verdict that
//     quotes only one of them is quoting the wrong check half the time.
//
// Both bands are measured fine, and the report says which is which, because
// the source's two ends disagree about the word "drive": the §54 section note
// sizes against a cantilever of "12 → 2.45 chord-units, 4.5 → 0.93 mm", and
// 2.45 u × UNIT_MM = 0.9286 mm — so the 0.93 mm overhang is the INNER end
// (fork mid-plane out to bush station one), the end that drives the selector
// against its detent. The rod end carries the input crank and has an overhang
// of its own. Neither is assumed: the bush stations are found in the built
// unit and the bands are derived from them.
//
// Usage: cd tools && node probe-137-jumper-envelope.mjs [out.json]
//   ROOT=../.claude/worktrees/<name>  serves a different tree (before/after)
//   PORT=8460                          the default
// Needs `npm ci` in tools/ and a Playwright Chromium. Exit 0 only if every
// assertion holds; the verdict block is printed either way.
import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import { writeFileSync } from 'node:fs';

const PORT = process.env.PORT || 8460;
const ROOT = process.env.ROOT || '..';
const OUT = process.argv[2] || 'probe137-envelope.json';

const srv = spawn('python3', ['-m', 'http.server', String(PORT), '--bind', '127.0.0.1'], { cwd: ROOT, stdio: 'ignore' });
await new Promise((r) => setTimeout(r, 900));
const browser = await chromium.launch();
const page = await browser.newPage();
const pageErrors = [];
page.on('pageerror', (e) => { pageErrors.push(String(e)); console.error('PAGEERROR', String(e)); });
const warns = [];
page.on('console', (m) => { if (m.type() === 'warning' || m.type() === 'error') warns.push(m.text()); });
await page.goto(`http://127.0.0.1:${PORT}/index.html`, { waitUntil: 'load', timeout: 90000 });
await page.waitForFunction(() => !!window.__clock, null, { timeout: 90000 });

// The work runs DETACHED and is polled, not awaited inside one evaluate: the
// registry build takes tens of seconds and an evaluate that long is a coin
// flip against the harness's own timeouts (CLAUDE.md's standing advice for
// every long sweep in this repo).
await page.evaluate(() => { window.__P = { done: false }; });
await page.evaluate(() => {
  const run = async () => {
    const c = window.__clock;
    const I = await import('./src/inspect.js');
    const THREE = await import('./vendor/three.module.js');
    const CLEAR_MARGIN = 0.15;      // layout.js — the ONE structural margin
    const UNIT_MM = 0.379;          // layout.js: CHAIN_PITCH_MM / CHAIN_PITCH
    const E_PA = 200e9;             // inspect.js SLENDER_E_PA / main.js OSC_STEEL_E

    // ---- 1. THE CROWN, MEASURED OFF THE METAL ---------------------------
    // The setting lever's angle is a monotone function of crownPullT
    // (settingLeverAngleAt), so calibrating it at posed 0 and 1 turns it into
    // a crownPullT readout — which is what "assert the crown reads pulled"
    // needs, since crownPullT itself is a module-local.
    const lever = c.labelEntries.find((e) => e.name === 'Setting lever');
    if (!lever) throw new Error('no Setting lever unit — cannot read the crown pose');
    const theta = () => lever.obj.rotation.z;
    const bootTheta = theta();
    // Drive real FRAMES (never a timed loop — rAF throttles under automation)
    // so boot's syncStart() sequence actually runs: pull, settle, push.
    let peak = bootTheta, trough = bootTheta;
    const trace = [];
    for (let i = 0; i < 420; i++) {
      c.advanceFrame(1 / 60);
      const t = theta();
      if (i % 20 === 0) trace.push(+t.toFixed(5));
      peak = Math.max(peak, t); trough = Math.min(trough, t);
    }
    const base = { tau: 0.05, leverEngage: 0, tension: 1 };
    c.setPose({ ...base, crownPullT: 0 }); const th0 = theta();
    c.setPose({ ...base, crownPullT: 1 }); const th1 = theta();
    const asPull = (t) => (th1 === th0 ? null : (t - th0) / (th1 - th0));
    const crown = {
      readout: 'Setting lever rotation.z, calibrated at posed crownPullT 0 and 1',
      thetaPushed: +th0.toFixed(6), thetaPulled: +th1.toFixed(6),
      atBoot: asPull(bootTheta) === null ? null : +asPull(bootTheta).toFixed(4),
      maxOverBootFrames: +Math.max(asPull(peak), asPull(trough)).toFixed(4),
      minOverBootFrames: +Math.min(asPull(peak), asPull(trough)).toFixed(4),
      trace: trace.map((t) => +asPull(t).toFixed(3)),
    };
    // The axes that pose a pulled crown — these are what put the ENGAGED
    // jumper into the swept hull every station below is measured against.
    const pulledAxes = [];
    for (const a of I.AXES) {
      let hi = 0;
      for (let s = 0; s <= 8; s++) { const p = a.pose(s / 8, c) || {}; if (p.crownPullT > hi) hi = p.crownPullT; }
      if (hi >= 0.95) pulledAxes.push({ axis: a.name, crownPullT: +hi.toFixed(3) });
    }

    // ---- 2. THE CHORD, OFF THE BUILD ------------------------------------
    const byName = (n) => { let f = null; c.scene.traverse((o) => { if (!f && o.name === n) f = o; }); return f; };
    const shaftRod = byName('alarmLinkShaft');
    const centrePin = byName('alarmLinkCentrePin');
    if (!shaftRod || !centrePin) throw new Error('alarmLinkShaft / alarmLinkCentrePin not in the scene');
    c.setPose({ ...base, crownPullT: 0 });
    c.scene.updateMatrixWorld(true);
    const gp = shaftRod.geometry.parameters;
    const chordLen = gp.height, shaftR = gp.radiusTop;
    const wv = (m, x, y, z) => new THREE.Vector3(x, y, z).applyMatrix4(m.matrixWorld);
    const endA = wv(shaftRod, 0, -chordLen / 2, 0), endB = wv(shaftRod, 0, chordLen / 2, 0);
    const pinC = wv(centrePin, 0, 0, 0);
    // The INNER tip is the end the centre crank's pin reaches from.
    const [inner, rodEnd] = pinC.distanceTo(endA) < pinC.distanceTo(endB) ? [endA, endB] : [endB, endA];
    const u = rodEnd.clone().sub(inner).normalize();
    const retreat = centrePin.geometry.parameters.height;     // ALARM_FORK_RETREAT
    const origin = inner.clone().addScaledVector(u, -retreat); // ALARM_LINK_INNER_XY at the shaft plane
    const chordFull = chordLen + retreat;
    const at = (t) => [origin.x + u.x * t, origin.y + u.y * t, origin.z + u.z * t];

    // Bush stations, found in the built unit (LatheGeometry rings on the
    // chord) rather than restated from the source's literals.
    const linkUnit = c.labelEntries.find((e) => e.name === 'Alarm link');
    if (!linkUnit) throw new Error('no Alarm link unit');
    const linkMeshes = [];
    linkUnit.obj.traverse((o) => { if (o.isMesh && !(o.userData && o.userData.schematic)) linkMeshes.push(o); });
    const bushT = [];
    for (const m of linkMeshes) {
      if (m.geometry.type !== 'LatheGeometry') continue;
      const p = wv(m, 0, 0, 0).sub(origin);
      const t = p.dot(u);
      if (Math.abs(p.clone().addScaledVector(u, -t).length()) < 0.05) bushT.push(+t.toFixed(3));
    }
    bushT.sort((a, b) => a - b);
    const bushesFound = bushT.length === 2;
    const bushes = bushesFound ? bushT : [2.45, 22];   // source literals, if detection missed

    // ---- 3. THE REGISTRY ------------------------------------------------
    const reg = await I.buildSweptRegistry(c, { yieldEvery: 64 });
    const vols = reg._volumes;

    // ---- 4. HULLS AS BOXES ---------------------------------------------
    // A revolve's covered sector is turned into annular-sector AABBs. That is
    // a SUPERSET of the solid, so it under-reports distance: the error runs
    // toward calling space occupied, never toward clearing it.
    const sectorBox = (cx, cy, rLo, rHi, a0, a1, zLo, zHi) => {
      const pts = [];
      for (const a of [a0, a1]) for (const r of [rLo, rHi]) pts.push([cx + Math.cos(a) * r, cy + Math.sin(a) * r]);
      for (let k = -4; k <= 8; k++) {
        const a = k * Math.PI / 2;
        if (a >= a0 - 1e-12 && a <= a1 + 1e-12) pts.push([cx + Math.cos(a) * rHi, cy + Math.sin(a) * rHi]);
      }
      let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
      for (const p of pts) { x0 = Math.min(x0, p[0]); x1 = Math.max(x1, p[0]); y0 = Math.min(y0, p[1]); y1 = Math.max(y1, p[1]); }
      return [x0, y0, zLo, x1, y1, zHi];
    };
    const boxCache = new Map();
    const boxesOf = (v) => {
      let b = boxCache.get(v);
      if (b) return b;
      if (v.kind === 'path') b = (v.boxes && v.boxes.length) ? v.boxes : (v.box ? [v.box] : []);
      else if (v.kind === 'static' || v.kind === 'approx') b = v.box ? [v.box] : [];
      else if (v.kind === 'revolve') {
        const [cx, cy] = v.axis, [rLo, rHi] = v.rBand, [zLo, zHi] = v.zBand;
        b = [];
        if (v.full || !v.bins) {
          for (let k = 0; k < 8; k++) b.push(sectorBox(cx, cy, rLo, rHi, k * Math.PI / 4, (k + 1) * Math.PI / 4, zLo, zHi));
        } else {
          const N = v.bins.length, w = Math.PI * 2 / N;
          let s = -1;
          for (let i = 0; i <= N; i++) {
            const on = i < N && v.bins[i] === 1;
            if (on && s < 0) s = i;
            if (!on && s >= 0) {
              const a0 = s * w, a1 = i * w, span = a1 - a0, n = Math.max(1, Math.ceil(span / (Math.PI / 8)));
              for (let k = 0; k < n; k++) b.push(sectorBox(cx, cy, rLo, rHi, a0 + span * k / n, a0 + span * (k + 1) / n, zLo, zHi));
              s = -1;
            }
          }
        }
      } else b = [];
      boxCache.set(v, b);
      return b;
    };
    const hullBoxOf = (v) => {
      const bs = boxesOf(v);
      const a = [Infinity, Infinity, Infinity, -Infinity, -Infinity, -Infinity];
      for (const b of bs) for (let k = 0; k < 3; k++) { if (b[k] < a[k]) a[k] = b[k]; if (b[3 + k] > a[3 + k]) a[3 + k] = b[3 + k]; }
      return a;
    };
    const gaps = (p, b) => [
      Math.max(b[0] - p[0], p[0] - b[3], 0),
      Math.max(b[1] - p[1], p[1] - b[4], 0),
      Math.max(b[2] - p[2], p[2] - b[5], 0)];
    const boxGaps = (a, b) => [
      Math.max(b[0] - a[3], a[0] - b[3], 0),
      Math.max(b[1] - a[4], a[1] - b[4], 0),
      Math.max(b[2] - a[5], a[2] - b[5], 0)];
    const eu = (g) => Math.hypot(g[0], g[1], g[2]);
    const ch = (g) => Math.max(g[0], g[1], g[2]);
    // Point → volume. `dEuclid` is the true gap; `dCheb` is the largest single
    // axis gap, which is what the AABB test in staticHitsPath resolves.
    const pointToVol = (p, v) => {
      let bE = Infinity, bC = Infinity;
      for (const b of boxesOf(v)) { const g = gaps(p, b); const e = eu(g); if (e < bE) bE = e; const k = ch(g); if (k < bC) bC = k; }
      return { e: bE, c: bC };
    };
    const volToVol = (a, b) => {
      let bE = Infinity, bC = Infinity;
      for (const x of boxesOf(a)) for (const y of boxesOf(b)) { const g = boxGaps(x, y); const e = eu(g); if (e < bE) bE = e; const k = ch(g); if (k < bC) bC = k; }
      return { e: bE, c: bC };
    };

    // WHO IS A PARTNER AND WHO IS A WALL. `Alarm link ⇄ Alarm selector` (and
    // the same tab re-attributed through the Dial's nesting) is a DECLARED
    // contact — MECH_GRAPH carries the edge and a penetration budget polices
    // its depth — so its 0.296 is the crank's own working gap, not a wall the
    // section has to respect. It still is not free: growing into it moves a
    // GATED row. Both envelopes are therefore reported, and which is which is
    // derived from MECH_GRAPH rather than asserted here.
    const partnerUnits = new Set();
    for (const list of Object.values(I.MECH_GRAPH)) {
      if (!Array.isArray(list)) continue;
      for (const e of list) if (Array.isArray(e) && e.includes('Alarm link')) for (const n of e) if (n !== 'Alarm link') partnerUnits.add(n);
    }
    const partnerMeshes = new Set();
    for (const v of vols) if (partnerUnits.has(v.unit) && v.meshName) partnerMeshes.add(v.meshName);
    const isPartner = (unit, mesh) => partnerUnits.has(unit) || partnerMeshes.has(mesh);

    const jumperVols = vols.filter((v) => v.unit === 'Minute jumper');
    if (!jumperVols.length) throw new Error("no 'Minute jumper' volumes in the registry");
    const others = vols.filter((v) => v.unit !== 'Minute jumper' && v.unit !== 'Alarm link');
    for (const v of others) v._hb = hullBoxOf(v);

    // ---- 5. FRAME SANITY -------------------------------------------------
    const jb = [Infinity, Infinity, Infinity, -Infinity, -Infinity, -Infinity];
    for (const v of jumperVols) { const b = hullBoxOf(v); for (let k = 0; k < 3; k++) { if (b[k] < jb[k]) jb[k] = b[k]; if (b[3 + k] > jb[3 + k]) jb[3 + k] = b[3 + k]; } }
    const jc = [(jb[0] + jb[3]) / 2, (jb[1] + jb[4]) / 2, (jb[2] + jb[5]) / 2];
    const frame = {
      jumperHullWorldBox: jb.map((x) => +x.toFixed(3)),
      jumperHullCentreWorld: jc.map((x) => +x.toFixed(3)),
      // dialFace is Y-FLIPPED: dial-local (x, y) ↔ world (P.dial.x − x, P.dial.y + y)
      jumperCentreDialLocal: [+(c.P.dial.x - jc[0]).toFixed(3), +(jc[1] - c.P.dial.y).toFixed(3)],
      rFromDialCentre: +Math.hypot(jc[0] - c.P.dial.x, jc[1] - c.P.dial.y).toFixed(3),
      dialRadius: +c.dialRadius.toFixed(3),
      dialCentreWorld: [+c.P.dial.x.toFixed(3), +c.P.dial.y.toFixed(3)],
      jumperMeshes: jumperVols.map((v) => ({ mesh: v.meshName || '(unnamed)', kind: v.kind, boxes: boxesOf(v).length })),
    };

    // ---- 6. THE STATION TABLE -------------------------------------------
    const band = 2.45;                       // the §54 note's own overhang, in chord units
    const ts = new Set();
    for (let t = 0; t <= chordFull + 1e-9; t += 0.25) ts.add(+t.toFixed(4));
    ts.add(+chordFull.toFixed(4));
    for (let t = 0; t <= band + 1e-9; t += 0.05) ts.add(+t.toFixed(4));
    for (let t = Math.max(0, chordFull - band); t <= chordFull + 1e-9; t += 0.05) ts.add(+t.toFixed(4));
    const stations = [];
    for (const t of [...ts].sort((a, b) => a - b)) {
      const p = at(t);
      let J = { e: Infinity, c: Infinity }, jm = null;
      for (const v of jumperVols) { const d = pointToVol(p, v); if (d.e < J.e) { J = d; jm = v.meshName || '(unnamed)'; } }
      const near = [];
      for (const v of others) {
        const g = gaps(p, v._hb);
        if (eu(g) > 0.6 + CLEAR_MARGIN) continue;               // outside every candidate radius
        const d = pointToVol(p, v);
        if (d.e <= 0.6 + CLEAR_MARGIN) near.push({ unit: v.unit, mesh: v.meshName || '(unnamed)', kind: v.kind, dEuclid: +d.e.toFixed(4), dCheb: +d.c.toFixed(4), partner: isPartner(v.unit, v.meshName || '') });
      }
      near.sort((a, b) => a.dEuclid - b.dEuclid);
      // THE ENVELOPE THE STATION ACTUALLY HAS. The jumper is one neighbour;
      // a resize that clears it and fouls the next thing has traded one
      // CONFIRMED pair for another, which is the failure this table exists to
      // forbid. Beyond the 0.6 candidate band nothing is measured, so a
      // station with no neighbour inside it reports its bound as capped.
      const bind = near.length && near[0].dEuclid < J.e ? near[0] : null;
      const dAll = Math.min(J.e, near.length ? near[0].dEuclid : Infinity);
      const wall = near.find((n) => !n.partner) || null;
      const dWall = Math.min(J.e, wall ? wall.dEuclid : Infinity);
      stations.push({
        t: +t.toFixed(3), mm: +(t * UNIT_MM).toFixed(4),
        world: p.map((x) => +x.toFixed(3)),
        onShaft: t >= retreat - 1e-9 && t <= chordFull + 1e-9,
        jumper: { dEuclid: +J.e.toFixed(4), dCheb: +J.c.toFixed(4), mesh: jm },
        maxLegalR: +(J.e - CLEAR_MARGIN).toFixed(4),
        maxLegalRAabb: +(J.c - CLEAR_MARGIN).toFixed(4),
        maxLegalRAll: isFinite(dAll) ? +(dAll - CLEAR_MARGIN).toFixed(4) : null,
        maxLegalRAllCapped: !isFinite(dAll) || dAll > 0.6 + CLEAR_MARGIN,
        maxLegalRWall: isFinite(dWall) ? +(dWall - CLEAR_MARGIN).toFixed(4) : null,
        bindingUnit: bind ? bind.unit : 'Minute jumper',
        bindingMesh: bind ? bind.mesh : jm,
        bindingIsPartner: bind ? bind.partner : false,
        wallUnit: wall ? wall.unit : 'Minute jumper',
        wallMesh: wall ? wall.mesh : jm,
        others: near.slice(0, 5),
      });
    }

    // ---- 7. EVERY ALARM-LINK MEMBER AGAINST THE JUMPER -------------------
    // The table above can only ever indict the shaft. This is what says
    // whether the shaft is even the member in contention.
    const linkVols = vols.filter((v) => v.unit === 'Alarm link');
    const members = linkVols.map((v) => {
      let best = { e: Infinity, c: Infinity }, jm = null;
      for (const j of jumperVols) { const d = volToVol(v, j); if (d.e < best.e) { best = d; jm = j.meshName || '(unnamed)'; } }
      return { mesh: v.meshName || '(unnamed)', kind: v.kind, dEuclid: +best.e.toFixed(4), dCheb: +best.c.toFixed(4), vsJumperMesh: jm };
    }).sort((a, b) => a.dEuclid - b.dEuclid);

    // ---- 8. THE VERDICT --------------------------------------------------
    const inBand = (lo, hi) => stations.filter((s) => s.onShaft && s.t >= lo - 1e-9 && s.t <= hi + 1e-9);
    // Beyond the 0.6 candidate band nothing was measured, so a neighbour
    // envelope is CLAMPED there and says so rather than quoting a distance
    // that only means "further than this probe looked".
    const stat = (rows, key = 'maxLegalR', clamp = false) => {
      if (!rows.length) return null;
      const v = rows.map((r) => Math.min(r[key] === null ? 0.6 : r[key], clamp ? 0.6 : Infinity)).sort((a, b) => a - b);
      return { stations: v.length, min: +v[0].toFixed(4), median: +v[(v.length - 1) >> 1].toFixed(4), max: +v[v.length - 1].toFixed(4), ...(clamp ? { clampedAt: 0.6 } : {}) };
    };
    const driveEnd = inBand(0, bushes[0]);            // fork mid-plane → bush one: the 0.93 mm cantilever
    const rodEndB = inBand(chordFull - band, chordFull);
    const allShaft = stations.filter((s) => s.onShaft);
    const worst = allShaft.reduce((a, s) => (s.maxLegalR < a.maxLegalR ? s : a), allShaft[0]);
    // The stiffness the §54 note sizes against: 3EI/L³ ≥ 2800 N/m, with L the
    // cantilever from the bush to the load — MEASURED here, not the 4.5 mm the
    // target was originally derived on (the §68 chord shortened it).
    const kOf = (rU, Lu) => {
      const r = rU * UNIT_MM * 1e-3, L = Lu * UNIT_MM * 1e-3;
      return 3 * E_PA * (Math.PI * r ** 4 / 4) / L ** 3;
    };
    const rFor = (k, Lu) => {
      const L = Lu * UNIT_MM * 1e-3;
      const I4 = k * L ** 3 / (3 * E_PA);
      return ((4 * I4 / Math.PI) ** 0.25) / (UNIT_MM * 1e-3);
    };
    const Ldrive = bushes[0];                       // fork pin (t 0) to bush one
    const Lrod = chordFull - bushes[1];             // bush two to the rod end
    const verdict = {
      shaftR: +shaftR.toFixed(4), chordLen: +chordLen.toFixed(4), chordFull: +chordFull.toFixed(4),
      retreat: +retreat.toFixed(4),
      bushStations: bushes, bushesFound,
      driveEndBand: { note: 'fork mid-plane (t 0) → bush one — the §54 note\'s 0.93 mm cantilever', lo: 0, hi: bushes[0], mm: +(bushes[0] * UNIT_MM).toFixed(4), ...(stat(driveEnd) || {}), allNeighbours: stat(driveEnd, 'maxLegalRAll', true), wallsOnly: stat(driveEnd, 'maxLegalRWall', true) },
      rodEndBand: { note: 'rod end inboard 2.45 u — the input-crank overhang', lo: +(chordFull - band).toFixed(3), hi: +chordFull.toFixed(3), ...(stat(rodEndB) || {}), allNeighbours: stat(rodEndB, 'maxLegalRAll', true), wallsOnly: stat(rodEndB, 'maxLegalRWall', true) },
      wholeShaft: stat(allShaft),
      wholeShaftAllNeighbours: stat(allShaft, 'maxLegalRAll', true),
      wholeShaftWallsOnly: stat(allShaft, 'maxLegalRWall', true),
      // Which neighbour actually sets the bound, and over how many stations —
      // the table's real answer, since the jumper turns out not to be it.
      bindingCensus: (() => {
        const m = new Map();
        for (const s2 of allShaft) {
          const k = `${s2.bindingUnit} / ${s2.bindingMesh}`;
          const e = m.get(k) || { where: k, partner: s2.bindingIsPartner, stations: 0, minLegalR: Infinity };
          e.stations++; e.minLegalR = Math.min(e.minLegalR, s2.maxLegalRAll === null ? 0.6 : s2.maxLegalRAll);
          m.set(k, e);
        }
        return [...m.values()].map((e) => ({ ...e, minLegalR: +e.minLegalR.toFixed(4) })).sort((a, b) => a.minLegalR - b.minLegalR);
      })(),
      worstStation: worst ? { t: worst.t, maxLegalR: worst.maxLegalR, jumper: worst.jumper } : null,
      r040LegalOverDriveEnd: driveEnd.length ? driveEnd.every((s) => s.maxLegalR >= 0.40) : null,
      r040LegalWholeShaft: allShaft.every((s) => s.maxLegalR >= 0.40),
      r040LegalOverDriveEndAllNeighbours: driveEnd.length ? driveEnd.every((s) => s.maxLegalRAll >= 0.40) : null,
      r040LegalWholeShaftAllNeighbours: allShaft.every((s) => s.maxLegalRAll >= 0.40),
      r040LegalWholeShaftWallsOnly: allShaft.every((s) => s.maxLegalRWall >= 0.40),
      anyStationForbids012: allShaft.some((s) => s.maxLegalR < 0.12),
      anyStationForbids012AllNeighbours: allShaft.some((s) => s.maxLegalRAll < 0.12),
      stationsForbidding012: allShaft.filter((s) => s.maxLegalRAll < 0.12).map((s) => ({ t: s.t, maxLegalRAll: s.maxLegalRAll, where: `${s.bindingUnit} / ${s.bindingMesh}` })),
      // §54's OTHER derivation — the geometry budget the section note quotes
      // beside the force one. λ = len / (second-smallest extent), so the
      // ceiling is a bound on the DIAMETER over an unsupported span.
      // TODO 78 — READ THE SPAN NAMES CAREFULLY, they are two different things.
      // `driveOverhang` here is bushes[0], i.e. chord t 0 → 2.45: the LOAD
      // PATH from the fork's mid-plane, which is the right length for the
      // force budget and is where §137's 2807 N/m comes from. The shaft's
      // METAL starts at t = ALARM_FORK_RETREAT, so its fork-end overhang is
      // 1.350 u, and that is what §54's registered check measures. Likewise
      // `rodOverhang` is chordFull - bushes[1] = 12.487, which IS the metal's
      // and is the free length that governs λ (TODO 79).
      slenderness: (() => {
        shaftRod.geometry.computeBoundingBox();
        const bb = shaftRod.geometry.boundingBox;
        const d = [bb.max.x - bb.min.x, bb.max.y - bb.min.y, bb.max.z - bb.min.z].sort((x, y) => x - y);
        const spans = { wholeMesh: chordLen, bushToBush: bushes[1] - bushes[0], driveOverhang: bushes[0], rodOverhang: chordFull - bushes[1] };
        const out = { lambdaAsBuilt: +(d[2] / d[1]).toFixed(1), ceiling: 30, tMid: +d[1].toFixed(4), spans: {} };
        for (const [k, L] of Object.entries(spans)) out.spans[k] = { span_u: +L.toFixed(3), rForLambda30: +(L / 30 / 2).toFixed(4) };
        return out;
      })(),
      // THE PREMISE THIS PROBE WAS COMMISSIONED UNDER, MEASURED. The
      // post-mortem's blocking pair is quoted at overlap 0.312/0.310; today
      // its two hulls do not come near each other.
      jumperPairToday: { hullGapEuclid: +(members.length ? members[0].dEuclid : NaN).toFixed(4), nearestMember: members[0] ? members[0].mesh : null },
      stiffness: {
        basis: '3EI/L³ with I = πr⁴/4, E = 200 GPa (SLENDER_E_PA / OSC_STEEL_E); L MEASURED from the bush stations',
        target_N_per_m: 2800,
        driveEnd: { L_u: +Ldrive.toFixed(3), L_mm: +(Ldrive * UNIT_MM).toFixed(4),
          k_at_asBuilt: +kOf(shaftR, Ldrive).toFixed(1), k_at_040: +kOf(0.40, Ldrive).toFixed(1),
          rNeededFor2800: +rFor(2800, Ldrive).toFixed(4) },
        rodEnd: { L_u: +Lrod.toFixed(3), L_mm: +(Lrod * UNIT_MM).toFixed(4),
          k_at_asBuilt: +kOf(shaftR, Lrod).toFixed(1), k_at_040: +kOf(0.40, Lrod).toFixed(1),
          rNeededFor2800: +rFor(2800, Lrod).toFixed(4) },
        legacy_4p5mm: { L_mm: 4.5, rNeededFor2800: +rFor(2800, 4.5 / UNIT_MM).toFixed(4) },
        // Gate B's second clause, answered: a stepped plan exists iff the
        // envelope's own bound at the loaded end already carries the target.
        steppedPlanReaches2800AtDriveEnd: (() => {
          const w = stat(driveEnd, 'maxLegalRWall', true);
          if (!w) return null;
          return { maxLegalRAtDriveEnd: w.min, k_there: +kOf(w.min, Ldrive).toFixed(0),
            rNeededFor2800: +rFor(2800, Ldrive).toFixed(4), reaches: w.min >= rFor(2800, Ldrive) };
        })(),
      },
      bindingMember: members[0] || null,
    };

    return {
      probe: '§137 jumper envelope', unitMM: UNIT_MM, clearMargin: CLEAR_MARGIN,
      crown, pulledAxes, frame, verdict,
      registry: { volumes: reg.volumes, byKind: reg.byKind },
      alarmLinkMembersVsJumper: members,
      stations,
    };
  };
  const p = run();
  p.then((r) => { window.__P.res = r; window.__P.done = true; })
   .catch((e) => { window.__P.err = String((e && e.stack) || e); window.__P.done = true; });
});

let st = null;
for (let i = 0; i < 900; i++) {
  await new Promise((r) => setTimeout(r, 500));
  st = await page.evaluate(() => ({ done: window.__P.done, err: window.__P.err || null }));
  if (st.done) break;
}
if (!st || !st.done) { console.error('probe did not finish'); await browser.close(); srv.kill(); process.exit(1); }
if (st.err) { console.error('probe threw:\n' + st.err); await browser.close(); srv.kill(); process.exit(1); }
const R = await page.evaluate(() => window.__P.res);
await browser.close(); srv.kill();

writeFileSync(OUT, JSON.stringify(R, null, 2));

const f = (x, n = 3) => (x === null || x === undefined ? 'n/a' : Number(x).toFixed(n));
const V = R.verdict;
console.log(`\n§137 JUMPER ENVELOPE — ROOT=${ROOT}`);
console.log(`  crown at boot ${f(R.crown.atBoot)} · peak over boot frames ${f(R.crown.maxOverBootFrames)} (setting-lever readout)`);
console.log(`  axes posing a pulled crown: ${R.pulledAxes.map((a) => a.axis).join(', ') || 'NONE'}`);
console.log(`  jumper hull world box ${R.frame.jumperHullWorldBox.join(', ')}`);
console.log(`  jumper centre dial-local ${R.frame.jumperCentreDialLocal.join(', ')} · r ${f(R.frame.rFromDialCentre)} of dialRadius ${f(R.frame.dialRadius)}`);
console.log(`  shaft r ${f(V.shaftR, 4)} · chord ${f(V.chordFull)} u (mesh ${f(V.chordLen)}) · bushes t ${V.bushStations.join(', ')}${V.bushesFound ? '' : ' (SOURCE LITERALS — detection missed)'}`);
console.log(`\n  band                       stations   min      median   max      (max legal radius, u)`);
const row = (n, b) => console.log(`  ${n.padEnd(26)} ${String(b.stations ?? '-').padStart(5)}   ${f(b.min, 4).padStart(7)}  ${f(b.median, 4).padStart(7)}  ${f(b.max, 4).padStart(7)}`);
row(`drive end t 0–${V.bushStations[0]}`, V.driveEndBand);
row(`rod end t ${f(V.rodEndBand.lo, 1)}–${f(V.rodEndBand.hi, 1)}`, V.rodEndBand);
row('whole shaft', V.wholeShaft);
console.log(`  — against the jumper alone. Against EVERY neighbour inside the 0.6 candidate band (clamped at 0.6):`);
row(`drive end t 0–${V.bushStations[0]}`, V.driveEndBand.allNeighbours || {});
row(`rod end t ${f(V.rodEndBand.lo, 1)}–${f(V.rodEndBand.hi, 1)}`, V.rodEndBand.allNeighbours || {});
row('whole shaft', V.wholeShaftAllNeighbours || {});
console.log(`  — and against WALLS only (declared MECH_GRAPH partners of the link dropped):`);
row(`drive end t 0–${V.bushStations[0]}`, V.driveEndBand.wallsOnly || {});
row('whole shaft', V.wholeShaftWallsOnly || {});
console.log(`\n  what BINDS the shaft, station by station:`);
for (const b of V.bindingCensus.slice(0, 6))
  console.log(`    ${b.where.padEnd(44)} ${String(b.stations).padStart(4)} stations   min legal r ${f(b.minLegalR, 4)}` +
    (b.partner ? '   (DECLARED contact, not a wall)' : ''));
console.log(`\n  r ≈ 0.40 legal over the drive-end band? jumper-only ${V.r040LegalOverDriveEnd} · all neighbours ${V.r040LegalOverDriveEndAllNeighbours}`);
console.log(`  r ≈ 0.40 legal over the whole shaft?     jumper-only ${V.r040LegalWholeShaft} · all neighbours ${V.r040LegalWholeShaftAllNeighbours} · walls only ${V.r040LegalWholeShaftWallsOnly}`);
console.log(`  any station forbidding even r 0.12? ${V.anyStationForbids012AllNeighbours}` +
  (V.stationsForbidding012.length ? ` — ${V.stationsForbidding012.slice(0, 6).map((s) => `t ${s.t} (${f(s.maxLegalRAll, 3)}, ${s.where})`).join('; ')}` : ''));
console.log(`  worst station vs the jumper: t ${V.worstStation?.t} maxLegalR ${f(V.worstStation?.maxLegalR, 4)} against ${V.worstStation?.jumper.mesh}`);
console.log(`\n  THE POST-MORTEM'S PAIR, TODAY: Alarm link ⇄ Minute jumper hulls are ${f(V.jumperPairToday.hullGapEuclid, 3)} u apart` +
  ` (nearest member ${V.jumperPairToday.nearestMember}) — the row quoted at overlap 0.312/0.310 does not exist on this chord.`);
const SL = V.slenderness;
console.log(`\n  SLENDERNESS (§54): as built λ ${f(SL.lambdaAsBuilt, 1)} against a ceiling of ${SL.ceiling}; r for λ 30 over` +
  ` the whole mesh ${f(SL.spans.wholeMesh.rForLambda30, 4)}, bush-to-bush ${f(SL.spans.bushToBush.rForLambda30, 4)},` +
  ` drive overhang ${f(SL.spans.driveOverhang.rForLambda30, 4)}, rod overhang ${f(SL.spans.rodOverhang.rForLambda30, 4)}`);
console.log(`\n  ALARM-LINK MEMBERS vs the jumper hull (Euclid / Cheb, units):`);
for (const m of R.alarmLinkMembersVsJumper.slice(0, 10))
  console.log(`    ${String(m.mesh).padEnd(24)} ${m.kind.padEnd(8)} ${f(m.dEuclid, 4).padStart(8)} / ${f(m.dCheb, 4).padStart(8)}   vs ${m.vsJumperMesh}`);
const S = V.stiffness;
console.log(`\n  STIFFNESS (${S.basis})`);
console.log(`    drive end L ${f(S.driveEnd.L_u)} u = ${f(S.driveEnd.L_mm)} mm → k(as-built r ${f(V.shaftR, 2)}) = ${f(S.driveEnd.k_at_asBuilt, 0)} N/m, r for 2800 N/m = ${f(S.driveEnd.rNeededFor2800, 4)} u`);
console.log(`    rod end   L ${f(S.rodEnd.L_u)} u = ${f(S.rodEnd.L_mm)} mm → k(as-built) = ${f(S.rodEnd.k_at_asBuilt, 0)} N/m, r for 2800 N/m = ${f(S.rodEnd.rNeededFor2800, 4)} u`);
console.log(`    the 4.5 mm span the target was derived on would need r = ${f(S.legacy_4p5mm.rNeededFor2800, 4)} u`);
const SP = S.steppedPlanReaches2800AtDriveEnd;
if (SP) console.log(`    a stepped plan at the drive end's own bound (r ${f(SP.maxLegalRAtDriveEnd, 4)}) reaches ${f(SP.k_there, 0)} N/m — target met: ${SP.reaches}`);

const fails = [];
if (!(R.crown.maxOverBootFrames >= 0.95)) fails.push(`the crown never reads pulled at boot (peak ${f(R.crown.maxOverBootFrames)}) — the pose this measurement depends on did not happen`);
if (!R.pulledAxes.length) fails.push('no axis poses a pulled crown — the swept hull cannot contain the engaged jumper');
if (pageErrors.length) fails.push(`page errors: ${pageErrors.length}`);
console.log(`\n  written to ${OUT}`);
if (warns.length) console.log(`  console warnings (${warns.length}): ${warns.slice(0, 4).join(' | ')}`);
console.log(fails.length ? '\nFAIL\n  ' + fails.join('\n  ') : '\nOK — the crown reads pulled, the envelope is measured');
process.exit(fails.length ? 1 : 0);
