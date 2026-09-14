// IF THE READER ORBITS, HOW DOES ITS SIGNAL GET OUT? — TODO 117's price.
//
// The item's decided topology (the moving reader on the hour) is settled; what
// it files as UNMEASURED is the output path. `probe-feeler-travel.mjs` priced
// the TRAVEL and found the constraint: a reader confined to the track radius
// (r 3.6) orbits the whole 360° with 0.4153 of clearance, while today's long
// arm gets 45° of scattered fragments. But today's arm reaches r 14.261 to a
// release lifter at r 16.942, and that run's length spans 2.682 → 31.203
// across the orbit — a spread of 28.521, an order of magnitude. A fixed-length
// link cannot do it. The item names two candidates, "the reader's own axis, or
// a carrier that orbits with it", and says: price that before building
// anything. This is that price.
//
// IT IS NOT probe-feeler-travel.mjs, which this continues: that one asks
// whether the READER fits as it orbits. This asks how its OUTPUT leaves, which
// is the half that one explicitly leaves open.
//
// WHAT IS ACTUALLY BEING PRICED. Both candidates reduce to the same part. A
// signal leaving an orbiting member without a length that changes with azimuth
// has to be taken COAXIALLY WITH THE ORBIT — a collar about the dial centre
// that the reader acts on wherever it stands, handing off to the fixed lifter
// at one place. So the question is: IS THERE A FREE COAXIAL ANNULUS, at what
// radius and height, and with how much section?
//
// THE MEASUREMENT COLLAPSES TO TWO DIMENSIONS, and that is why it is cheap and
// exact rather than a sweep. The distance from any point to a coaxial circle of
// radius R at height Z is hypot(r − R, z − Z) in the cylindrical frame:
// AZIMUTH DROPS OUT. A full ring must clear everything at every azimuth, which
// is exactly the collar's requirement, so the free-ring map IS the free (r, z)
// map — no stations to sample and no swept-hull error available to make (the
// per-pose discipline probe-feeler-travel had to correct does not arise,
// because a ring is present at every azimuth simultaneously by construction).
// Points are still taken along triangle EDGES, never at vertices: a radial arm
// crosses a band with no vertex in it (MODELING.md rule 5).
//
// TWO READINGS, both reported, because the exclusion is a design choice and
// not a fact:
//   · EVERY unit an obstacle — what a collar riding its own bearing must clear;
//   · the three COAXIAL units excluded (Hour wheel, Alarm release disc, Dial) —
//     what a collar entitled to ride one of them may use. A collar around the
//     hour tube is the obvious construction, and it would be wrong to call the
//     tube an obstacle to a part mounted on it; it would be equally wrong to
//     assume the entitlement. So both maps are printed and the difference is
//     the finding.
//     `Alarm disc` — the alarm HAND's tube — is a fourth dial-centred unit and
//     is deliberately NOT excluded: it turns at the alarm-setting rate, so a
//     collar journalled on any of the three carriers is not rigid with it and
//     it is a genuine obstacle. Measured, it never binds a winning cell (its
//     nearest approach to the best inner rings is 0.85–1.99), so the choice
//     costs nothing here — but it is a choice, and an unstated one would make
//     the second map's inner region look freer than it is.
// Every cell names the OWNER of its nearest metal, because a blocked cell that
// names what blocks it is a design input and a bare boolean is not.
//
// THE BAR IS THE SHIPPED STATION, NOT CLEAR_MARGIN — probe-feeler-travel's own
// finding, kept: the shipped feeler already sits 0.0458 from the alarm winding
// train with a green battery, so the movement contains accepted sub-margin
// proximities and a map demanding 0.15 everywhere asserts something untrue of
// the tree. Both bars are printed.
//
// THE READER'S OWN SIDE IS A THIRD TIER, and it exists because the first
// reading of this map was read wrongly — by its author, in the summary handed
// to the owner. "Best cell at each radius" prints one winner per row, and at
// r 3.5 that winner (world z −4.35) lies BEHIND the disc, on the far side from
// the reader. A ring there is geometrically free and mechanically useless: the
// reader stands between the dial's back face and the disc's track, and cannot
// press a ring through the disc. The free space that matters is the corridor
// the shipped reader already occupies, bounded by the metal it reads — world z
// from the feeler's own envelope floor up to the disc's track top — and tier
// 1b reports the best ring per radius INSIDE it. The other winners are left
// printed rather than removed: a ring behind the disc is the right answer to a
// different construction (one reading the disc's back), and deleting it would
// hide that the map covers both.
//
// CONTROLS, both kinds:
//   · must-hit — a ring on the hour tube's own (r, z) must read BLOCKED. A map
//     that finds clearance inside known metal is not reading the scene.
//   · must-miss — a ring far outside the movement must read CLEAR by a large
//     margin. A map that blocks everywhere has pruned or transformed wrongly,
//     which is how probe-feeler-travel's first two drafts failed.
//
// ACCEPTANCE — exits non-zero, and on exactly one thing: its own CONTROLS, the
// same shape as probe-feeler-travel.mjs, which this continues. The MAP is a
// REPORT and is not gated: what counts as enough section for a collar is a
// design question this does not answer, so it prints the space and names what
// takes it.
//
// cd tools && node probe-117-takeoff.mjs
import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
const ROOT = process.env.ROOT || join(dirname(fileURLToPath(import.meta.url)), '..');
const PORT = Number(process.env.PORT || 8516);
const srv = spawn('python3', ['-m', 'http.server', String(PORT), '--bind', '127.0.0.1'], { cwd: ROOT, stdio: 'ignore' });
process.on('exit', () => srv.kill());
await new Promise((r) => setTimeout(r, 1200));
const browser = await chromium.launch();
const page = await browser.newPage();
page.on('pageerror', (e) => console.log('PAGEERROR', String(e)));
await page.goto(`http://127.0.0.1:${PORT}/index.html`, { waitUntil: 'load', timeout: 90000 });
await page.waitForFunction(() => !!window.__clock, null, { timeout: 90000 });

const out = await page.evaluate(async () => {
  const THREE = await import('three');
  const I = await import('/src/inspect.js');
  const C = window.__clock;
  const cx = C.P.dial.x, cy = C.P.dial.y;
  const MARGIN = 0.15;            // CLEAR_MARGIN
  const SHIPPED = 0.0458;         // the feeler's own accepted proximity
  const COAXIAL = ['Hour wheel', 'Alarm release disc', 'Dial'];
  // THE THIRD READING IS A DESIGN'S ACTUAL ENTITLEMENT, and it is narrower than
  // either of the two above. A ring BORED ON THE HOUR TUBE is entitled to the
  // tube — it rides it — and to nothing else: the dial it hangs under and the
  // disc it reads are both still obstacles. Excluding all three coaxial units
  // prices a best case no single construction can claim, and counting all of
  // them prices a ring on a bearing that does not exist. Neither is the number
  // a hour-carried reader is designed against.
  const CARRIER = ['Hour wheel'];

  const poses = [];
  for (const ax of I.AXES) for (const f of [0, 0.5, 1]) poses.push(ax.pose(f));

  const v = new THREE.Vector3();
  const walk = (m, emit) => {
    const pos = m.geometry?.attributes?.position; if (!pos) return;
    const idx = m.geometry.index ? m.geometry.index.array : null;
    const cnt = idx ? idx.length : pos.count;
    for (let i = 0; i + 2 < cnt; i += 3) {
      for (const [p, q] of [[0, 1], [1, 2], [2, 0]]) {
        v.fromBufferAttribute(pos, idx ? idx[i + p] : i + p).applyMatrix4(m.matrixWorld);
        const ax = v.x, ay = v.y, az = v.z;
        v.fromBufferAttribute(pos, idx ? idx[i + q] : i + q).applyMatrix4(m.matrixWorld);
        const bx = v.x, by = v.y, bz = v.z;
        const len = Math.hypot(bx - ax, by - ay, bz - az);
        const steps = Math.max(2, Math.ceil(len / (MARGIN / 2)));
        for (let t = 0; t <= steps; t++) emit(ax + (bx - ax) * t / steps, ay + (by - ay) * t / steps, az + (bz - az) * t / steps);
      }
    }
  };
  const meshesOf = (obj) => { const o = []; obj?.traverse((m) => { if (m.isMesh) o.push(m); }); return o; };

  // The dial-side band to scan, taken from the feeler's own envelope so the
  // window is the mechanism's rather than a guess.
  const feeler = C.labelEntries.find((e) => e.name === 'Alarm release feeler')?.obj;
  if (!feeler) return { fatal: 'no Alarm release feeler unit' };
  let fz0 = Infinity, fz1 = -Infinity, fr1 = 0;
  for (const pose of poses) {
    C.setPose(pose); feeler.updateWorldMatrix(true, true);
    for (const m of meshesOf(feeler)) walk(m, (x, y, z) => {
      fz0 = Math.min(fz0, z); fz1 = Math.max(fz1, z);
      fr1 = Math.max(fr1, Math.hypot(x - cx, y - cy));
    });
  }
  const Z0 = fz0 - 2, Z1 = fz1 + 2, R0 = 1, R1 = 20;
  // THE COLLECTION BAND IS PADDED BEYOND THE CANDIDATE BAND, and that is a
  // correction rather than a precaution. The first run pruned obstacles to the
  // candidate band exactly, so a ring near its edge saw no metal beyond it and
  // read clear for that reason alone — every radius from 7 out reported its
  // best cell at z −9.85, the bottom row, at a suspiciously uniform 0.35. The
  // prune was manufacturing the clearance it was supposed to measure. Metal is
  // now gathered PAD further in every direction than any distance the map is
  // allowed to report, and a cell that would report more than PAD is capped and
  // flagged rather than believed.
  const PAD = 4;

  // Collect every obstacle sample, BINNED INTO (r, z) AS IT ARRIVES. Azimuth is
  // discarded on purpose (see the header), and binning is what makes that
  // affordable: the first version pushed every sample and overflowed the array
  // — 42 poses of whole-scene triangle edges at 0.075 spacing is hundreds of
  // millions of points, and all but a few thousand of them are duplicates once
  // azimuth is gone. The cell is well under the margins being measured, so the
  // quantisation cannot manufacture clearance: a cell is 0.05, the bars are
  // 0.0458 and 0.15, and the reported distance is taken from the CELL CENTRE,
  // which can err by at most half a diagonal (0.035) in either direction. That
  // is stated rather than hidden, and it is why the map is a scoping tool.
  const BIN = 0.05;
  const collect = (skip) => {
    const occ = new Map();                       // "ri|zi" -> owner
    for (const pose of poses) {
      C.setPose(pose);
      for (const { name, obj } of C.labelEntries) {
        if (skip.includes(name) || name === 'Alarm release feeler') continue;
        obj.updateWorldMatrix(true, true);
        for (const m of meshesOf(obj)) {
          const box = new THREE.Box3().setFromObject(m);
          if (box.max.z < Z0 - PAD || box.min.z > Z1 + PAD) continue;
          walk(m, (x, y, z) => {
            if (z < Z0 - PAD || z > Z1 + PAD) return;
            const r = Math.hypot(x - cx, y - cy);
            if (r > R1 + PAD) return;
            const k = `${Math.round(r / BIN)}|${Math.round(z / BIN)}`;
            if (!occ.has(k)) occ.set(k, name);
          });
        }
      }
    }
    // flatten to typed arrays for the scan
    const n = occ.size;
    const rr = new Float64Array(n), zz = new Float64Array(n), who = new Array(n);
    let i = 0;
    for (const [k, name] of occ) {
      const [ri, zi] = k.split('|');
      rr[i] = Number(ri) * BIN; zz[i] = Number(zi) * BIN; who[i] = name; i++;
    }
    return { rr, zz, who, n };
  };

  // nearest metal to the ring (R, Z): min over occupied cells of hypot(r−R, z−Z)
  //
  // `raw` exists because the cap and the CONTROLS ask different questions, and
  // conflating them broke the must-miss control once. For a MAP CELL the cap is
  // right: metal beyond Z0−PAD / R1+PAD was never collected, so a reading above
  // PAD would be a claim about emptiness the collection cannot vouch for. The
  // must-miss control asks the opposite — "does this map read CLEAR somewhere it
  // obviously should?" — and there the distance to the nearest metal actually
  // COLLECTED is the honest figure: pruning can only have removed metal further
  // away, so the number is an over-estimate of the true distance and therefore
  // proves clearance rather than assuming it. Routed through the cap instead,
  // the control read exactly PAD, which is indistinguishable from a map that
  // blocks everywhere and caps out — a control that cannot fail and cannot pass.
  const nearest = (pts, R, Z, raw = false) => {
    let best = Infinity, who = null;
    for (let i = 0; i < pts.n; i++) {
      const dr = pts.rr[i] - R, dz = pts.zz[i] - Z;
      const d2 = dr * dr + dz * dz;
      if (d2 < best) { best = d2; who = pts.who[i]; }
    }
    const d = Math.sqrt(best);
    if (raw) return { d, who };
    // capped at PAD: beyond it the collection cannot vouch for emptiness
    return d > PAD ? { d: PAD, who, capped: true } : { d, who };
  };

  const RSTEP = 0.5, ZSTEP = 0.5;
  const scan = (pts) => {
    const rows = [];
    for (let R = R0; R <= R1 + 1e-9; R += RSTEP) {
      const row = [];
      for (let Z = Z0; Z <= Z1 + 1e-9; Z += ZSTEP) {
        const n = nearest(pts, R, Z);
        row.push({ R: +R.toFixed(2), Z: +Z.toFixed(2), d: +n.d.toFixed(4), who: n.who, capped: !!n.capped });
      }
      rows.push(row);
    }
    return rows;
  };

  const ptsAll = collect([]);
  const ptsCoax = collect(COAXIAL);
  const ptsCarrier = collect(CARRIER);
  const mapAll = scan(ptsAll), mapCoax = scan(ptsCoax), mapCarrier = scan(ptsCarrier);

  // THE READER'S CORRIDOR, measured rather than declared: from the feeler's own
  // envelope floor (fz0 — the bracket root at the dial's back face) to the
  // disc's track top, which is the disc unit's near face in world z. A ring the
  // orbiting reader can press lies between those two, and nowhere else.
  const discObj = C.labelEntries.find((e) => e.name === 'Alarm release disc')?.obj;
  let discNear = null;
  if (discObj) {
    discNear = Infinity;
    for (const pose of poses) {
      C.setPose(pose); discObj.updateWorldMatrix(true, true);
      for (const m of meshesOf(discObj)) walk(m, (x, y, z) => { discNear = Math.min(discNear, z); });
    }
  }
  const readerBand = discNear === null ? null : { z0: fz0, z1: discNear };

  // CONTROLS
  // The must-hit target is the Hour wheel UNIT's mid-envelope — its WHEEL, not
  // its tube (the unit spans both, and the midpoint lands on the rim at r≈12.5).
  // That is fine for the control's purpose, which is "a ring inside known metal
  // must read blocked", but it must not be labelled as the tube.
  const hourTube = C.labelEntries.find((e) => e.name === 'Hour wheel')?.obj;
  let tr = null, tz = null;
  if (hourTube) {
    let r0 = Infinity, r1 = 0, z0 = Infinity, z1 = -Infinity;
    C.setPose(poses[0]); hourTube.updateWorldMatrix(true, true);
    for (const m of meshesOf(hourTube)) walk(m, (x, y, z) => {
      const r = Math.hypot(x - cx, y - cy);
      r0 = Math.min(r0, r); r1 = Math.max(r1, r); z0 = Math.min(z0, z); z1 = Math.max(z1, z);
    });
    tr = (r0 + r1) / 2; tz = (z0 + z1) / 2;
  }
  const ctrlHit = tr === null ? null : nearest(ptsAll, tr, tz);
  const ctrlMiss = nearest(ptsAll, 60, 40, true);   // raw: see `nearest`

  // TIER TWO — the hand-off. A collar's motion is AXIAL and its azimuth is
  // everywhere, so the run to the fixed lifter is a FIXED length taken at one
  // place, not a link whose length chases the orbit. Report that length for the
  // best free ring, which is the number the 28.521 spread is replaced by.
  const lifter = C.labelEntries.find((e) => e.name === 'Alarm release lifter')?.obj
    ?? C.labelEntries.find((e) => /lifter/i.test(e.name))?.obj ?? null;
  let lift = null;
  if (lifter) {
    let r0 = Infinity, r1 = 0, z0 = Infinity, z1 = -Infinity;
    C.setPose(poses[0]); lifter.updateWorldMatrix(true, true);
    for (const m of meshesOf(lifter)) walk(m, (x, y, z) => {
      const r = Math.hypot(x - cx, y - cy);
      r0 = Math.min(r0, r); r1 = Math.max(r1, r); z0 = Math.min(z0, z); z1 = Math.max(z1, z);
    });
    lift = { r0: +r0.toFixed(3), r1: +r1.toFixed(3), z0: +z0.toFixed(3), z1: +z1.toFixed(3) };
  }

  // WHERE THE NEIGHBOURS SIT. A free plane is only a decision once you know
  // what it lies between: the widest free ring in the map is 0.35 from metal
  // owned by the Dial and by the alarm HAND, which is a different kind of space
  // from a gap under the dial even though both read as clearance.
  const envOf = (name) => {
    const obj = C.labelEntries.find((e) => e.name === name)?.obj; if (!obj) return null;
    let r0 = Infinity, r1 = 0, z0 = Infinity, z1 = -Infinity;
    for (const pose of poses) {
      C.setPose(pose); obj.updateWorldMatrix(true, true);
      for (const m of meshesOf(obj)) walk(m, (x, y, z) => {
        const r = Math.hypot(x - cx, y - cy);
        r0 = Math.min(r0, r); r1 = Math.max(r1, r); z0 = Math.min(z0, z); z1 = Math.max(z1, z);
      });
    }
    return { name, r0: +r0.toFixed(3), r1: +r1.toFixed(3), z0: +z0.toFixed(3), z1: +z1.toFixed(3) };
  };
  const envs = ['Dial', 'Alarm disc', 'Hour wheel', 'Alarm release disc', 'Motion works',
    'Alarm release lifter', 'Alarm release feeler'].map(envOf).filter(Boolean);

  C.resetInputs();
  return { mapAll, mapCoax, ctrlHit, ctrlMiss, lift, tr, tz, PAD, envs, readerBand,
    band: { Z0: +Z0.toFixed(2), Z1: +Z1.toFixed(2), R0, R1 },
    mapCarrier, nAll: ptsAll.n, nCoax: ptsCoax.n, nCarrier: ptsCarrier.n, nPoses: poses.length,
    lifterName: lifter ? (C.labelEntries.find((e) => e.obj === lifter)?.name) : null };
});
await browser.close(); srv.kill();

if (out.fatal) { console.log('FATAL', out.fatal); process.exit(1); }
const PAD_OUT = out.PAD;

console.log(`TODO 117 — pricing the OUTPUT path for an orbiting reader.`);
console.log(`pose net ${out.nPoses} poses · ${out.nAll} obstacle samples (${out.nCoax} coaxial-excluded, ${out.nCarrier} carrier-excluded)`);
console.log(`band scanned: r ${out.band.R0}..${out.band.R1}, z ${out.band.Z0}..${out.band.Z1}\n`);
console.log('--- where the neighbours sit (r and z envelopes over the same pose net)');
for (const e of out.envs)
  console.log(`  ${e.name.padEnd(22)} r ${String(e.r0).padStart(8)}..${String(e.r1).padEnd(8)}  z ${String(e.z0).padStart(8)}..${e.z1}`);
console.log('');

// THE WHOLE TABLE, not the winner — a search whose losers are invisible is a
// claim nobody can re-check, and here the shape of the free space is the design
// input rather than any single cell.
const glyph = (d) => (d >= 0.45 ? '#' : d >= 0.15 ? '+' : d >= 0.0458 ? '.' : ' ');
const show = (map, title) => {
  console.log(`=== ${title}`);
  console.log('    a free COAXIAL RING needs clearance ≥ its own half-section; the figure is how much there is');
  console.log('    map:  # ≥ 0.45   + ≥ CLEAR_MARGIN 0.15   . ≥ the shipped bar 0.0458   (blank) under it');
  const zs = map[0].map((c) => c.Z);
  console.log(`         z ${zs[0].toFixed(1)} → ${zs[zs.length - 1].toFixed(1)}`);
  for (const row of map)
    console.log(`    r ${String(row[0].R).padStart(5)} |${row.map((c) => glyph(c.d)).join('')}|`);
  const best = [];
  for (const row of map) for (const c of row) best.push(c);
  best.sort((a, b) => b.d - a.d);
  console.log(`\n    best ring at each radius that clears CLEAR_MARGIN:`);
  for (const row of map) {
    const b = row.slice().sort((a, c) => c.d - a.d)[0];
    if (b.d >= 0.15) console.log(`      r ${String(b.R).padStart(5)}  z ${String(b.Z).padStart(6)}   clear ${b.d.toFixed(4).padStart(8)}   nearest: ${b.who}`);
  }
  const overMargin = best.filter((c) => c.d >= 0.15).length;
  const overShipped = best.filter((c) => c.d >= 0.0458).length;
  const capped = best.filter((c) => c.capped).length;
  console.log(`    cells clear of CLEAR_MARGIN (0.15): ${overMargin} of ${best.length}`);
  console.log(`    cells clear of the SHIPPED bar (0.0458): ${overShipped} of ${best.length}`);
  // A capped cell is one whose clearance ran past the collection PAD; its figure
  // is a floor, not a measurement, and saying how many there are is the
  // difference between a map with a stated horizon and one that hides it.
  console.log(`    cells CAPPED at the collection pad (figure is a floor of ${PAD_OUT}): ${capped} of ${best.length}\n`);
  return best[0];
};
const bestAll = show(out.mapAll, 'EVERY unit an obstacle — a collar on its own bearing');
const bestCoax = show(out.mapCoax, 'COAXIAL units excluded (Hour wheel, Alarm release disc, Dial) — a collar entitled to ride one');
const bestCarrier = show(out.mapCarrier, 'CARRIER excluded (Hour wheel only) — a ring BORED ON THE HOUR TUBE, the hour-carried reader\'s own entitlement');

// TIER 1b — the same two maps, restricted to the corridor the reader stands in.
if (out.readerBand) {
  const { z0, z1 } = out.readerBand;
  console.log(`--- tier 1b: rings the ORBITING READER can press`);
  console.log(`  the corridor is world z ${z0.toFixed(3)} … ${z1.toFixed(3)} — the feeler's own envelope floor (the`);
  console.log(`  bracket root at the dial's back face) up to the disc's track top. A ring outside it is free`);
  console.log(`  space the reader cannot reach: behind the disc it would have to be pressed THROUGH the disc.`);
  const inBand = (c) => c.Z >= z0 - 1e-9 && c.Z <= z1 + 1e-9;
  for (const [map, title] of [[out.mapAll, 'every unit an obstacle'], [out.mapCoax, 'coaxial units excluded'],
                             [out.mapCarrier, 'carrier excluded (Hour wheel) — the hour-carried reader']]) {
    console.log(`  ${title}:`);
    let any = false;
    for (const row of map) {
      const cells = row.filter(inBand);
      if (!cells.length) continue;
      const b = cells.slice().sort((a, c) => c.d - a.d)[0];
      if (b.d < 0.15) continue;
      any = true;
      console.log(`      r ${String(b.R).padStart(5)}  z ${String(b.Z).padStart(6)}   clear ${b.d.toFixed(4).padStart(8)}   nearest: ${b.who}`);
    }
    if (!any) console.log('      no ring in the corridor clears CLEAR_MARGIN');
  }
  console.log('');
}

console.log('--- tier two: the hand-off');
if (out.lift) console.log(`  ${out.lifterName}: r ${out.lift.r0}..${out.lift.r1}, z ${out.lift.z0}..${out.lift.z1}`);
else console.log('  no lifter unit found by name — hand-off not priced');
if (out.lift) {
  console.log(`  the run from a collar to that lifter is a FIXED length taken at ONE azimuth — the collar's`);
  console.log(`  motion is axial and its azimuth is everywhere — so it replaces today's orbiting arm, whose`);
  console.log(`  run spans 2.682 → 31.203 across the orbit (spread 28.521). Priced per candidate radius:`);
  const cands = [];
  for (const row of out.mapCoax) {
    const b = row.slice().sort((a, c) => c.d - a.d)[0];
    if (b.d >= 0.15) cands.push(b);
  }
  // The run is in (r, z), not r alone: the collar plane and the lifter sit at
  // different HEIGHTS, and a price that reported only the radial leg would
  // understate a link that also has to climb. The nearest point of the lifter's
  // own envelope is the target.
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  for (const c of cands) {
    const tr = clamp(c.R, out.lift.r0, out.lift.r1), tz = clamp(c.Z, out.lift.z0, out.lift.z1);
    const dr = tr - c.R, dz = tz - c.Z;
    console.log(`      collar r ${String(c.R).padStart(5)} z ${String(c.Z).padStart(6)} → nearest lifter metal (r ${tr.toFixed(2)}, z ${tz.toFixed(2)}):`
      + `  run ${Math.hypot(dr, dz).toFixed(3).padStart(7)}  (radial ${dr.toFixed(3)}, axial ${dz.toFixed(3)})   ring clear ${c.d.toFixed(4)}`);
  }
}

console.log('\n--- controls');
const hitOk = out.ctrlHit && out.ctrlHit.d < 0.15;
const missOk = out.ctrlMiss && out.ctrlMiss.d > 5;
console.log(`  must-hit  ring inside the Hour wheel unit's envelope (r ${out.tr?.toFixed(3)}, z ${out.tz?.toFixed(3)} — its rim, not its tube): ${out.ctrlHit ? out.ctrlHit.d.toFixed(4) : 'NOT MEASURED'} — ${hitOk ? 'BLOCKED, OK' : 'CONTROL FAILED (clearance inside known metal)'}`);
console.log(`  must-miss ring outside the movement (r 60, z 40): ${out.ctrlMiss.d.toFixed(3)} — ${missOk ? 'CLEAR, OK' : 'CONTROL FAILED'}`);
if (!(hitOk && missOk)) { console.log('\n  CONTROLS DID NOT BRACKET THE MAP — the figures above mean nothing.'); process.exit(1); }
