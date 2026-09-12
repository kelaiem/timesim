// §221 — THE SAFETY ACTION, measured for the first time. A Swiss lever's
// guard pin (dart) rides just clear of the safety roller's rim and drops into
// the roller's crescent only while the impulse pin is in the fork's notch;
// that is what stops the fork unlocking when the balance is not there to
// unlock it. Until §221 the movement could not be asked whether its own
// safety action works: the balance performed ±45°, so the crescent — ±25.8°
// about the impulse pin's azimuth — sat in front of the pin for most of the
// swing and the solid rim never came round. At the physical ±270° the rim
// passes the pin twice a vibration, and the pair either clears or it does not.
//
// WHAT THIS IS NOT. `probe-fork-blank.mjs` (TODO 98) inventories the fork's
// steel and identifies the guard dart, but it measures the BLANK's oneness and
// z-reach, never the dart against anything on the balance. `probe-95-guard.mjs`
// is about mesh CLOSEDNESS, an unrelated sense of "guard".
// `probe-131-escapement-slide.mjs` measures the tooth on the stone, the other
// side of the escapement. Nothing measured this pair.
//
// HOW, and why this way:
//  · GAP, not intersection. This is a designed running clearance, so a
//    triangle test flaps either side of zero as the mesh facets sweep past
//    (the skill's tangency trap). `meshClearance` returns a signed surface
//    distance and the sign carries the answer.
//  · BOTH parts are posed by `tau`, because both move: the roller turns with
//    the balance and the pin banks with the fork, and only the beat law knows
//    their phase relationship. Posing the balance alone would measure a pin
//    that never banks.
//  · The sweep asserts the balance ACTUALLY MOVED across it (the skill's
//    "a pose key nobody reads poses nothing" trap): N identical rows read
//    exactly like a correct invariant result.
//  · Two controls, both asserted. MUST-HIT: the impulse pin against the
//    fork's notch, which is designed to interlock and must measure at or
//    below zero somewhere in the sweep. MUST-MISS: the guard pin against the
//    balance's RIM, which is a different radius entirely and must stay clear
//    everywhere. A probe whose controls fail the way its subject does has
//    measured nothing.
//
// ACCEPTANCE: the guard pin clears the safety roller by CLEAR_MARGIN at every
// pose of the beat axis, and both controls behave. Exit 1 otherwise.
//
// Run: cd tools && node probe-221-safety.mjs
import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = process.env.ROOT || join(dirname(fileURLToPath(import.meta.url)), '..');
const PORT = 8400 + Math.floor(Math.random() * 60);
const srv = spawn('python3', ['-m', 'http.server', String(PORT), '--bind', '127.0.0.1'], { cwd: ROOT, stdio: 'ignore' });
process.on('exit', () => srv.kill());   // reap on a throw as well as on the last line
await new Promise((r) => setTimeout(r, 1000));
const browser = await chromium.launch();
const page = await browser.newPage();
await page.goto(`http://127.0.0.1:${PORT}/index.html`);
await page.waitForFunction('window.__clock && window.__clock.scene', null, { timeout: 60000 });

const R = await page.evaluate(async () => {
  const I = await import('./src/inspect.js');
  const L = await import('./src/layout.js');
  const C = window.__clock;

  const findMesh = (unit, name) => {
    let hit = null;
    C.labelEntries.find((e) => e.name === unit).obj
      .traverse((o) => { if (o.isMesh && o.name === name) hit = o; });
    return hit;
  };
  const biggestMesh = (unit, pred) => {
    let best = null, bestN = -1;
    C.labelEntries.find((e) => e.name === unit).obj.traverse((o) => {
      if (!o.isMesh || (pred && !pred(o))) return;
      const n = o.geometry.attributes.position.count;
      if (n > bestN) { bestN = n; best = o; }
    });
    return best;
  };

  const guardPin = findMesh('Pallet fork', 'guardPin');
  const safetyRoller = findMesh('Balance', 'safetyRoller');
  if (!guardPin || !safetyRoller) return { fatal: `meshes not found: guardPin=${!!guardPin} safetyRoller=${!!safetyRoller}` };

  // the controls' parts: the fork's notch is in the blank (its largest steel
  // body), the impulse pin is the balance's ruby, the rim is the balance's brass
  // Materials carry no `name`, so the controls' parts are picked by material
  // IDENTITY against the one MATS table — exact, and it cannot drift the way a
  // regex over a missing name silently did (both controls read n/a).
  const { MATS } = await import('./src/materials.js');
  const byMat = (unit, mat) => {
    const hits = [];
    C.labelEntries.find((e) => e.name === unit).obj
      .traverse((o) => { if (o.isMesh && o.material === mat) hits.push(o); });
    return hits;
  };
  // MUST-HIT: a balance timing screw in the rim it is screwed into. NOT the
  // pallet stone in its slot, which was the first choice here and was wrong:
  // that pair measures exactly 0.0500 because `SEAT_SHOW` holds the stone
  // proud of the slot walls on purpose, so a set stone is a designed GAP and
  // not an overlap — the skill's running-fit trap, met head on.
  //
  // This pair's overlap is guaranteed by the builder's own published numbers
  // rather than assumed, and the premise is asserted below: the screws sit at
  // radius `rc` and the rim spans `rI`..`rO`, so rI < rc < rO means screw
  // metal is inside rim metal. Both are in one unit, so the control tests the
  // MEASURE and not the pose.
  const forkBlank = biggestMesh('Pallet fork', (o) => o !== guardPin && o.material !== MATS.ruby);
  const screws = byMat('Balance', MATS.blueSteel);
  const screw = screws[0] || null;
  const balUD = C.labelEntries.find((e) => e.name === 'Balance').obj.userData;
  let balDims = null;
  C.labelEntries.find((e) => e.name === 'Balance').obj
    .traverse((o) => { if (o.userData && o.userData.rim && o.userData.screws) balDims = o.userData; });
  const dims = balDims || balUD;
  const screwInRim = !!(dims && dims.rim && dims.screws
    && dims.screws.rc > dims.rim.rI && dims.screws.rc < dims.rim.rO);
  // MUST-MISS: the balance's brass rim — the annulus out at the wheel's edge,
  // a different radius from the roller stack entirely.
  const rim = byMat('Balance', MATS.brass)
    .reduce((a, o) => (!a || o.geometry.attributes.position.count > a.geometry.attributes.position.count ? o : a), null);

  const balGroup = C.labelEntries.find((e) => e.name === 'Balance').obj;
  const sr = (() => { let u = null; balGroup.traverse((o) => { if (o.userData && o.userData.safetyRoller) u = o.userData.safetyRoller; }); return u; })();

  // one whole oscillation, at the beat axis's own derived density
  const beat = I.AXES.find((a) => a.name === 'beat');
  const N = beat.n;
  const rows = [];
  let balA = [];
  for (let i = 0; i < N; i++) {
    const f = i / (N - 1);
    C.setPose(beat.pose(f));
    balGroup.updateWorldMatrix(true, true);
    balA.push(balGroup.rotation.z);
    // meshClearance returns a signed surface distance (a NUMBER): <= 0 is
    // contact, Infinity means pruned — which cannot happen with no upperBound
    rows.push({ f, tau: beat.pose(f).tau, balRad: balGroup.rotation.z,
                subject: I.meshClearance(guardPin, safetyRoller),
                ctlHit: (screw && rim) ? I.meshClearance(screw, rim) : NaN,
                ctlMiss: rim ? I.meshClearance(guardPin, rim) : NaN });
  }
  const span = Math.max(...balA) - Math.min(...balA);
  const fin = (xs) => xs.filter((x) => Number.isFinite(x));
  const subj = fin(rows.map((r) => r.subject));
  const hit = fin(rows.map((r) => r.ctlHit));
  const miss = fin(rows.map((r) => r.ctlMiss));
  const worst = rows.reduce((a, r) => (Number.isFinite(r.subject) && (!a || r.subject < a.subject) ? r : a), null);
  return {
    clearMargin: L.CLEAR_MARGIN, amplitudeDeg: L.AMPLITUDE_DEG, liftDeg: L.LIFT_DEG, N,
    crescentHalfDeg: sr ? sr.crescentHalfAngleRad * 180 / Math.PI : null,
    rollerR: sr ? sr.r : null,
    balSpanDeg: span * 180 / Math.PI,
    subject: { n: subj.length, min: Math.min(...subj), max: Math.max(...subj),
               atF: worst && worst.f, atBalDeg: worst && worst.balRad * 180 / Math.PI },
    ctlHit: { n: hit.length, min: hit.length ? Math.min(...hit) : null },
    ctlMiss: { n: miss.length, min: miss.length ? Math.min(...miss) : null },
    parts: { screws: screws.length, forkBlank: !!forkBlank, screw: !!screw, rim: !!rim,
             screwInRim, rimI: dims && dims.rim && dims.rim.rI, rimO: dims && dims.rim && dims.rim.rO,
             screwRC: dims && dims.screws && dims.screws.rc },
  };
});

await browser.close();
srv.kill();

if (R.fatal) { console.log('FAIL  ' + R.fatal); process.exit(1); }

let bad = 0;
const row = (label, ok, detail) => { console.log(`${ok ? 'PASS' : 'FAIL'}  ${label} — ${detail}`); if (!ok) bad++; };

console.log(`§221 safety action — amplitude ${R.amplitudeDeg}°, lift ${R.liftDeg}°, ${R.N} poses over one oscillation`);
console.log(`      safety roller r ${R.rollerR.toFixed(3)}, crescent ±${R.crescentHalfDeg.toFixed(1)}°`);

// the sweep has to have MOVED, or every row below is one pose measured N times
row('the balance actually swung across the sweep', R.balSpanDeg > 1.5 * R.amplitudeDeg,
  `${R.balSpanDeg.toFixed(1)}° of travel against the ${2 * R.amplitudeDeg}° the amplitude implies`);
row('subject measured at every pose', R.subject.n === R.N, `${R.subject.n} of ${R.N} finite`);
row('guard pin clears the safety roller by CLEAR_MARGIN', R.subject.min >= R.clearMargin,
  `min gap ${R.subject.min.toFixed(4)} against ${R.clearMargin} (worst at balance ${R.subject.atBalDeg === null ? '?' : R.subject.atBalDeg.toFixed(1)}°)`);
// CONTROLS — a probe whose controls fail the way its subject does has measured nothing
row('control parts all found', R.parts.screw && R.parts.rim, `${R.parts.screws} screw(s), rim ${R.parts.rim}`);
row("control premise: the screws' radius is inside the rim's annulus", R.parts.screwInRim,
  `rc ${R.parts.screwRC} against rim ${R.parts.rimI}..${R.parts.rimO} — screw metal inside rim metal by construction`);
row('control MUST-HIT: a timing screw overlaps the rim it is set into', R.ctlHit.min !== null && R.ctlHit.min <= 0,
  `min gap ${R.ctlHit.min === null ? 'n/a' : R.ctlHit.min.toFixed(4)}`);
row('control MUST-MISS: guard pin never reaches the balance rim', R.ctlMiss.min !== null && R.ctlMiss.min > R.clearMargin,
  `min gap ${R.ctlMiss.min === null ? 'n/a' : R.ctlMiss.min.toFixed(4)} — a different radius entirely`);

console.log(bad ? `\n${bad} row(s) FAILED` : '\nall rows PASS');
process.exit(bad ? 1 : 0);
