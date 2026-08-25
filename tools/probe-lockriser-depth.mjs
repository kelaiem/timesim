// HOW DEEP is alarmLockBeakRiser in the ratchet skirt, and does it alternate?
//
// meshClearance clamps at 0, so "touching" and "buried" are the same reading.
// This measures in the WHEEL's own frame against userData.ratchetPoly — the
// polygon geometry.js cut the teeth from, probe-87-pawl's method — so the
// number cannot drift from the metal. Per parity, across the whole press.
//
// Why nothing caught it: `Alarm lock ⇄ Alarm switch` is an EXPECTED pair (the
// beak is MEANT to touch the castellations), and TODO 6's named residue is
// that an EXPECTED pair with no EXPECTED_CONTACT_FLOORS row gets the blanket
// excuse for EVERY mesh in both units — including a riser that has no business
// in the saw at all.
import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
const srv = spawn('python3', ['-m', 'http.server', '8490', '--bind', '127.0.0.1'], { cwd: '..', stdio: 'ignore' });
await new Promise((r) => setTimeout(r, 900));
const b = await chromium.launch(); const p = await b.newPage();
p.on('pageerror', (e) => console.log('PAGEERROR', String(e)));
await p.goto('http://127.0.0.1:8490/index.html?hud=0&sync=0', { waitUntil: 'load', timeout: 90000 });
await p.waitForFunction(() => !!window.__clock, null, { timeout: 90000 });
const out = await p.evaluate(async () => {
  const THREE = await import('./vendor/three.module.js');
  const I = await import('./src/inspect.js');
  const clock = window.__clock;
  const find = (n) => { let r = null; clock.scene.traverse((o) => { if (o.name === n) r = o; }); return r; };
  const riser = find('alarmLockBeakRiser'), skirt = find('alarmColSkirt');
  const wheelGroup = skirt.parent;
  const poly = wheelGroup.userData.ratchetPoly;
  if (!poly) return { err: 'no ratchetPoly' };
  const inPoly = (x, y) => { let c = false;
    for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
      const a = poly[i], d = poly[j];
      if ((a.y > y) !== (d.y > y) && x < (d.x - a.x) * (y - a.y) / (d.y - a.y) + a.x) c = !c;
    } return c; };
  const distToPoly = (x, y) => { let best = Infinity;
    for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
      const a = poly[i], d = poly[j], vx = d.x - a.x, vy = d.y - a.y;
      const t = Math.max(0, Math.min(1, ((x - a.x) * vx + (y - a.y) * vy) / (vx * vx + vy * vy || 1)));
      best = Math.min(best, Math.hypot(x - (a.x + vx * t), y - (a.y + vy * t)));
    } return best; };

  clock.resetInputs(); clock.scene.updateMatrixWorld(true);
  const sb = new THREE.Box3().setFromObject(skirt);
  const rb = new THREE.Box3().setFromObject(riser);
  const zOverlap = Math.min(sb.max.z, rb.max.z) - Math.max(sb.min.z, rb.min.z);

  const v = new THREE.Vector3();
  const rows = [];
  for (const alarmOn of [0, 1]) {
    let worst = 0, worstAt = null, insideMax = 0, n = 0;
    for (let i = 0; i <= 48; i++) {
      const f = i / 48;
      I.enterAxis(clock);
      clock.setPose({ tau: 0.13, crownPullT: 0, leverEngage: 0, tension: 1, windAccumTurns: 0,
                      alarmOn, alarmPressCycle: f * 2 });
      clock.scene.updateMatrixWorld(true);
      wheelGroup.updateWorldMatrix(true, false); riser.updateWorldMatrix(true, false);
      const inv = wheelGroup.matrixWorld.clone().invert();
      const toWheel = inv.clone().multiply(riser.matrixWorld);
      // NOT A VERTEX TEST. The riser is a CylinderGeometry with
      // heightSegments 1, so every vertex it has sits at one of the two END
      // rings and NONE inside the saw's band — MODELING.md rule 5's trap, and
      // the first cut of this probe read 0 of 0 because of it. The riser is a
      // rod: its in-plane footprint is a DISC of its own radius about its
      // axis, so that is what gets tested against the cut polygon.
      const axis = new THREE.Vector3().setFromMatrixPosition(toWheel);
      const rR = riser.geometry.parameters.radiusTop;
      const inside = inPoly(axis.x, axis.y) ? 1 : 0;
      const dEdge = distToPoly(axis.x, axis.y);
      // inside: the axis is in the metal, so the whole disc is, and the depth
      // to the nearest cut edge is dEdge + rR. outside: overlap is rR - dEdge
      // when the disc reaches the edge, else no contact.
      const deepest = inside ? dEdge + rR : Math.max(0, rR - dEdge);
      const n2 = 1;
      if (deepest > worst) { worst = deepest; worstAt = +(f * 2).toFixed(3); }
      insideMax = Math.max(insideMax, inside);
      n = n2;
    }
    // AT REST is what a viewer sees between presses, and it is where the
    // parity can show: the saw has 12 teeth to the castellations' 6 columns,
    // so the SAW repeats every press while the LOCK — which reads columns —
    // alternates. A worst-over-the-cycle reading averages that away, which is
    // why the first cut of this probe found both parities identical.
    I.enterAxis(clock);
    clock.setPose({ tau: 0.13, crownPullT: 0, leverEngage: 0, tension: 1, windAccumTurns: 0,
                    alarmOn, alarmPressCycle: 0 });
    clock.scene.updateMatrixWorld(true);
    wheelGroup.updateWorldMatrix(true, false); riser.updateWorldMatrix(true, false);
    {
      const inv2 = wheelGroup.matrixWorld.clone().invert();
      const t2 = inv2.clone().multiply(riser.matrixWorld);
      const a2 = new THREE.Vector3().setFromMatrixPosition(t2);
      const rR2 = riser.geometry.parameters.radiusTop;
      const in2 = inPoly(a2.x, a2.y), d2 = distToPoly(a2.x, a2.y);
      rows.push({ alarmOn, worstDepth: +worst.toFixed(4), at: worstAt, insideMax, sampled: n,
        restDepth: +(in2 ? d2 + rR2 : Math.max(0, rR2 - d2)).toFixed(4),
        restInside: in2, restR: +Math.hypot(a2.x, a2.y).toFixed(4) });
    }
  }
  return {
    riserBand: [+rb.min.z.toFixed(4), +rb.max.z.toFixed(4)],
    skirtBand: [+sb.min.z.toFixed(4), +sb.max.z.toFixed(4)],
    zOverlap: +zOverlap.toFixed(4),
    rows,
  };
});
if (out.err) { console.log(out.err); process.exit(1); }
console.log(`riser z ${out.riserBand[0]} .. ${out.riserBand[1]}`);
console.log(`skirt z ${out.skirtBand[0]} .. ${out.skirtBand[1]}`);
console.log(`they share ${out.zOverlap} of z — so the riser passes THROUGH the saw's band\n`);
for (const r of out.rows)
  console.log(`  alarmOn=${r.alarmOn}: worst over the press ${String(r.worstDepth).padStart(8)} at cycle ${r.at}`
    + `   ·   AT REST ${String(r.restDepth).padStart(8)} (axis ${r.restInside ? 'INSIDE' : 'outside'} the saw, r ${r.restR})`);
await b.close(); srv.kill();
