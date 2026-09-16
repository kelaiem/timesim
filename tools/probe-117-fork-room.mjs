// IS THERE ROOM ON THE TRACK SIDE AT THE FORKED RADIUS? — TODO 117's next question.
//
// `probe-117-fork-radius.mjs` priced the radius fork and every force and motion
// bar survived it: inboard the lever's arm grows, the bias blade lengthens and
// SOFTENS, the seat walks away from the detent envelope's ceiling rather than
// into it, and the journal shortens past the corridor it was short of. That
// probe is arithmetic over constants and it says so — it deliberately does not
// answer whether a ring, a notch and a lever tip FIT at the forked radius.
// This is that question, and it is geometry over the built tree.
//
// WHY THE ANSWER IS NOT OBVIOUS FROM THE SHIPPED RADIUS. At ALARM_TRACK_RMID the
// track side is SHUT: the feeler's arm is directly overhead, its underside
// stands one ALARM_PIN_SHANK (0.04) off the track top by construction, and the
// arm cannot move dial-ward because ALARM_FEELER_TOP is the alarm release
// sleeve's envelope less one margin. A ring needs 0.5667 there. The fork's whole
// hope is that the SLEEVE IS NOT OVERHEAD INBOARD, so the lever's tip may jog
// dial-ward and open a band for the ring — a fact about where one unit's metal
// is, which nothing but a measurement knows.
//
// WHY THE TRACK SIDE IS THE ONLY SIDE. probe-117-reversed-bias.mjs settled this:
// the ring must lie between the lever's tip and the track, or the blade's force
// path is OPPOSED rather than in series and a second spring is forced whose
// opposed pair leaves the 5–50 mN detent envelope at 83.61 mN. So the band this
// measures is the band dial-ward of the DISC and track-ward of everything else:
// disc face → margin → ring → its ALARM_PIN_DROP of travel → the lever's tip.
//
// WHAT IS EXCLUDED, AND WHY EACH ONE. `Alarm release feeler` and `Alarm release
// reader` are the parts BEING DESIGNED — counting the lever's present arm as an
// obstacle to the lever's future tip forbids the design by construction, which
// is the error probe-117-takeoff.mjs's own header records against its first
// map. `Hour wheel` is the carrier the reader is bored on and `Dial` is what it
// nests under; both are probe-117-takeoff's declared entitlement and are
// reported separately as the corridor's dial-ward FLOOR rather than silently
// dropped. `Alarm release disc` is neither excluded nor an obstacle: it is the
// band's own floor, measured, because the notch is cut in it.
//
// THE BAND IS THE RING'S FOOTPRINT, not a line. A ring of §50 floor stock spans
// STOCK_MIN_U radially, so samples are kept within ±STOCK_MIN_U/2 of each
// candidate radius: a ring must clear metal its own body reaches, and a
// zero-width sample at the centreline would miss a chamfer half a stock away.
//
// CONTROLS, both kinds, and one of the must-hits is the load-bearing one:
//   · must-hit — run the SHIPPED radius with the feeler counted as an obstacle
//     and the band must read SHUT, because that is the state the fork exists to
//     escape. A scan that finds room where the movement already reads is not
//     reading the scene.
//   · must-hit — the disc's two dial-most planes, the raised TRACK outboard and
//     the BODY TOP inboard, must stand exactly ALARM_TRACK_H apart. This is the
//     strongest check available without leaving the world frame: it reproduces
//     a source constant from two of the scan's own bands, so a wrong transform
//     or the wrong metal cannot pass it.
//   · must-miss — a band far outside the movement must find NO disc metal, so
//     the "is there anything to cut a notch in" test is known to be able to
//     say no.
//
// ACCEPTANCE — exits non-zero on its CONTROLS only. The spans are a REPORT:
// what counts as enough room is a design question, and this prints the space
// and names the unit that takes it.
//
// cd tools && node probe-117-fork-room.mjs
import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
const ROOT = process.env.ROOT || join(dirname(fileURLToPath(import.meta.url)), '..');
const PORT = Number(process.env.PORT || 8519);
const srv = spawn('python3', ['-m', 'http.server', String(PORT), '--bind', '127.0.0.1'], { cwd: ROOT, stdio: 'ignore' });
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

  const STOCK_MIN_U = 0.12 / (0.72 / 1.9);   // layout.js §50 floor stock
  const CLEAR_MARGIN = 0.15;
  const ALARM_PIN_DROP = 0.10;
  const HALF = STOCK_MIN_U / 2;              // the ring's own radial half-width
  const STEP = 0.01;                         // edge-walk spacing — see the walk

  // The design's own members, plus the entitlement. Each named for a reason in
  // the header; the entitlement is reported separately, never silently dropped.
  const DESIGN = ['Alarm release feeler', 'Alarm release reader'];
  const ENTITLED = ['Hour wheel', 'Dial'];
  const FLOOR_UNIT = 'Alarm release disc';

  // 2.20 … 3.05 are the fork's candidate take-off radii. 3.30 and 3.50 are not
  // candidates at all: they are the TRANSITION, the radii a jogged lever tip
  // must climb back through to rejoin its own plane outboard of the ring, and
  // a band measured only where the ring sits would be a claim about the jog
  // made without looking at where the jog happens.
  const CANDIDATES = [2.20, 2.40, 2.60, 2.80, 3.05, 3.30, 3.50];

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
        // EDGE STEPPING AT 0.01, AND THE SIZE IS A CORRECTION. The first run
        // stepped at CLEAR_MARGIN/4 = 0.0375 and reported the shipped band as
        // 0.0312 — a figure BELOW its own sample spacing, so it was measuring
        // the walk rather than the metal. A span is only as fine as the step
        // that finds its bound, so the step is now well under the smallest span
        // this is asked to report (ALARM_PIN_SHANK, 0.04).
        const steps = Math.max(2, Math.ceil(len / STEP));
        for (let t = 0; t <= steps; t++) emit(ax + (bx - ax) * t / steps, ay + (by - ay) * t / steps, az + (bz - az) * t / steps);
      }
    }
  };
  const meshesOf = (obj) => { const o = []; obj?.traverse((m) => { if (m.isMesh) o.push(m); }); return o; };

  // One pass over the net, bucketing every sample into whichever candidate
  // bands its radius falls in. Azimuth drops out: a ring is present at every
  // azimuth at once, so a sample anywhere on the band is a sample on the ring.
  const mk = () => ({ discMinZ: Infinity, discMaxZ: -Infinity,
                      obstacle: { z: -Infinity, who: null }, entitled: { z: -Infinity, who: null },
                      feeler: { z: -Infinity, who: null } });
  const bands = CANDIDATES.map(mk);
  const CONTROL_FAR = 40;                     // must-miss band
  const farBand = mk();

  // WHICH MESHES CAN REACH A BAND, and this prune is a CORRECTION. The first
  // version kept any mesh whose far corner fell inside the must-miss band's
  // radius, which is every mesh in the movement — the prune read as one and did
  // nothing, and the walk spent its time on metal 30 units from any question
  // being asked. A mesh reaches a band only if the band's radius lies between
  // the mesh's nearest and furthest distance from the dial centre. Pruning on
  // that cannot manufacture a span: a mesh failing it contributes no sample to
  // any band by construction rather than by assumption.
  const RMAX = Math.max(...CANDIDATES) + HALF;
  const reaches = (box) => {
    const xs = [box.min.x - cx, box.max.x - cx], ys = [box.min.y - cy, box.max.y - cy];
    const nx = (xs[0] <= 0 && xs[1] >= 0) ? 0 : Math.min(Math.abs(xs[0]), Math.abs(xs[1]));
    const ny = (ys[0] <= 0 && ys[1] >= 0) ? 0 : Math.min(Math.abs(ys[0]), Math.abs(ys[1]));
    const nearR = Math.hypot(nx, ny);
    let farR = 0;
    for (const x of xs) for (const y of ys) farR = Math.max(farR, Math.hypot(x, y));
    return { band: nearR <= RMAX && farR >= CANDIDATES[0] - HALF,
             control: nearR <= CONTROL_FAR + HALF && farR >= CONTROL_FAR - HALF };
  };

  // PASS ONE — the disc alone, to fix each band's FLOOR. It has to be its own
  // pass: the floor is a minimum over the whole net, and nothing else in the
  // band can be judged against it until it is known. Doing both at once is what
  // forced the first version to hold every sample in memory.
  const discObj = C.labelEntries.find((e) => e.name === FLOOR_UNIT)?.obj;
  if (!discObj) return { fatal: 'no ' + FLOOR_UNIT + ' unit' };
  for (const pose of poses) {
    C.setPose(pose);
    discObj.updateWorldMatrix(true, true);
    for (const m of meshesOf(discObj)) {
      const rr = reaches(new THREE.Box3().setFromObject(m));
      if (!rr.band && !rr.control) continue;
      walk(m, (x, y, z) => {
        const r = Math.hypot(x - cx, y - cy);
        for (let i = 0; i < CANDIDATES.length; i++) {
          if (Math.abs(r - CANDIDATES[i]) > HALF) continue;
          bands[i].discMinZ = Math.min(bands[i].discMinZ, z);
          bands[i].discMaxZ = Math.max(bands[i].discMaxZ, z);
        }
        if (Math.abs(r - CONTROL_FAR) <= HALF) {
          farBand.discMinZ = Math.min(farBand.discMinZ, z);
          farBand.discMaxZ = Math.max(farBand.discMaxZ, z);
        }
      });
    }
  }

  // PASS TWO — everything else, keeping only the HIGHEST sample below each
  // band's floor per class. One number per band per class, so the walk's memory
  // does not grow with the scene.
  const keep = (slot, z, name) => { if (z > slot.z) { slot.z = z; slot.who = name; } };
  for (const pose of poses) {
    C.setPose(pose);
    for (const { name, obj } of C.labelEntries) {
      if (name === FLOOR_UNIT) continue;
      const isEnt = ENTITLED.includes(name);
      const isFeeler = name === 'Alarm release feeler';
      if (DESIGN.includes(name) && !isFeeler) continue;   // the reader is the part being sited
      obj.updateWorldMatrix(true, true);
      for (const m of meshesOf(obj)) {
        const rr = reaches(new THREE.Box3().setFromObject(m));
        if (!rr.band && !rr.control) continue;
        walk(m, (x, y, z) => {
          const r = Math.hypot(x - cx, y - cy);
          for (let i = 0; i < CANDIDATES.length; i++) {
            if (Math.abs(r - CANDIDATES[i]) > HALF) continue;
            const b = bands[i];
            if (!(z < b.discMinZ)) continue;
            if (isFeeler) keep(b.feeler, z, name);
            else if (isEnt) keep(b.entitled, z, name);
            else keep(b.obstacle, z, name);
          }
          if (Math.abs(r - CONTROL_FAR) <= HALF && z < farBand.discMinZ) keep(farBand.obstacle, z, name);
        });
      }
    }
  }

  // The band a ring may occupy: dial-ward of the disc's dial-most face, and
  // track-ward of the nearest other metal. In WORLD z the dial is the more
  // negative side, so "dial-ward of the disc" means z BELOW the disc's min.
  const spanOf = (b, slots) => {
    if (!isFinite(b.discMinZ)) return null;
    let ceil = -Infinity, who = null;
    for (const sl of slots) if (sl.z > ceil) { ceil = sl.z; who = sl.who; }
    return { floorZ: b.discMinZ, ceilZ: isFinite(ceil) ? ceil : null, who, span: isFinite(ceil) ? b.discMinZ - ceil : null };
  };

  const rows = CANDIDATES.map((r, i) => {
    const b = bands[i];
    return {
      r,
      discPresent: isFinite(b.discMinZ),
      discMinZ: isFinite(b.discMinZ) ? +b.discMinZ.toFixed(4) : null,
      discMaxZ: isFinite(b.discMaxZ) ? +b.discMaxZ.toFixed(4) : null,
      design: spanOf(b, [b.obstacle]),                       // the design's own band
      withFeeler: spanOf(b, [b.obstacle, b.feeler]),         // the shipped state, for the control
      toEntitled: spanOf(b, [b.obstacle, b.entitled]),       // where the dial/carrier floor sits
    };
  });

  return {
    rows,
    bars: {
      ring: STOCK_MIN_U + ALARM_PIN_DROP + CLEAR_MARGIN,
      ringAndTip: STOCK_MIN_U + ALARM_PIN_DROP + CLEAR_MARGIN + STOCK_MIN_U,
      pinShank: 0.04,      // ALARM_PIN_SHANK — arm underside to track top, by construction
      trackH: 0.17,         // ALARM_TRACK_H — the raised track's height off the disc body
    },
    control: { farDiscPresent: isFinite(farBand.discMinZ), farR: CONTROL_FAR },
    poses: poses.length,
  };
});
await browser.close(); srv.kill();

if (out.fatal) { console.log('FATAL', out.fatal); process.exit(1); }

const fmt = (x, n = 4) => (x === null || x === undefined ? '   —   ' : x.toFixed(n).padStart(8));
console.log(`\n  THE TRACK-SIDE BAND AT THE FORKED RADIUS (TODO 117) — ${out.poses} poses\n`);
console.log('     r    disc?   disc face    band (design)   bounded by                    with the feeler counted   stack fits?');
for (const row of out.rows) {
  const d = row.design, w = row.withFeeler;
  // THE STACK, named so the column means something: from the disc's face,
  // one margin, the ring, its ALARM_PIN_DROP of travel, then the lever's tip.
  // That is what has to fit dial-ward of the track for the blade to keep its
  // sense — probe-117-reversed-bias.mjs's whole finding in one sum.
  const fits = d?.span != null && d.span >= out.bars.ringAndTip;
  console.log(`  ${row.r.toFixed(2).padStart(5)}    ${row.discPresent ? 'yes' : ' NO'}   ${fmt(row.discMinZ)}   ${fmt(d?.span)}   ${(d?.who || '—').padEnd(28)}  ${fmt(w?.span)}        ${fits ? 'YES' : 'no '}`);
}
console.log(`\n  a ring needs ${out.bars.ring.toFixed(4)} (stock + ALARM_PIN_DROP + one margin to the track)`);
console.log(`  a ring AND the lever's tip need ${out.bars.ringAndTip.toFixed(4)}`);

const rows = [];
const push = (what, ok, got, want) => rows.push({ what, ok, got, want });

// CONTROL — the shipped radius, with the feeler counted, must read SHUT. Note
// WHAT bounds it: the feeler's PIN, not its arm. The pin stands from the arm's
// mid-plane past the track top (pinLen carries a +0.02 seat), so the nearest
// feeler metal below the disc's face is the pin's own flank and the band closes
// to nothing. The ARM's underside stands one ALARM_PIN_SHANK off the track by
// construction — a DIFFERENT measurement, and conflating the two is how the
// item's retraction came to quote 0.0133 for a gap the source defines as 0.04.
// This row holds only what it measures: shut is shut.
const ref = out.rows.find((r) => Math.abs(r.r - 3.05) < 1e-9);
const refSpan = ref?.withFeeler?.span;
push('CONTROL the shipped radius reads SHUT — no ring fits where the feeler already reads',
  refSpan !== null && refSpan !== undefined && refSpan < out.bars.ring,
  `${refSpan === null || refSpan === undefined ? 'no bound found' : refSpan.toFixed(4)} bounded by ${ref?.withFeeler?.who || '\u2014'}`,
  `< ${out.bars.ring.toFixed(4)}, the least a ring needs`);
// CONTROL — the scan must reproduce a SOURCE CONSTANT from two of its own bands,
// which is the strongest check available without leaving the world frame. The
// disc's dial-most face is its raised TRACK where the annulus reaches (r 2.40
// outward, through the hub that shares the track's plane) and its BODY TOP
// inboard of that, and those two planes stand exactly ALARM_TRACK_H apart. A
// scan reading the wrong metal, or reading it through a stale transform, cannot
// produce that difference by accident.
{
  const inner = out.rows.find((r) => Math.abs(r.r - 2.20) < 1e-9);
  const outer = out.rows.find((r) => Math.abs(r.r - 3.05) < 1e-9);
  const step = inner && outer ? inner.discMinZ - outer.discMinZ : null;
  push('CONTROL the two disc planes the scan finds stand ALARM_TRACK_H apart',
    step !== null && Math.abs(step - out.bars.trackH) < 1e-3,
    `${step === null ? 'missing' : step.toFixed(4)} between r 2.20 (body top) and r 3.05 (track top)`,
    `${out.bars.trackH}`);
}
push('CONTROL no disc metal exists far outside the movement, so the notch test can say no',
  !out.control.farDiscPresent, `r ${out.control.farR}: disc metal ${out.control.farDiscPresent ? 'FOUND' : 'absent'}`, 'absent');
push('CONTROL the disc IS found at every candidate radius, so the bands are on real metal',
  out.rows.every((r) => r.discPresent), out.rows.map((r) => `${r.r}:${r.discPresent ? 'y' : 'N'}`).join(' '), 'all present');

let bad = 0;
console.log('');
for (const r of rows) {
  if (!r.ok) bad++;
  console.log(`  ${r.ok ? 'ok  ' : 'FAIL'} ${r.what}`);
  console.log(`       got ${r.got}   want ${r.want}`);
}
console.log(`\n  ${rows.length} control rows, ${bad} failing — the SPANS above are a report\n`);
process.exit(bad ? 1 : 0);
