// TODO 230 — IS THE BEAK LEVER HELD ALONG ITS PIN, BOTH WAYS, BY ITS OWN
// THRUST FACES? TODO 204 put the lever's eye on a pin pressed into the post's
// head and nothing held it toward the arm's line: it slid 0.1735 (seated) /
// 0.1855 (lifted) before the selector rod — its own group's output — stopped
// it, and mid-press 0.0512 before the alarm jumper's blade did. Every battery
// check poses the lever at y = 0, so none of them can see a location along the
// pin that is posed rather than held.
//
// TODO 230 reversed the fit: the pin is pressed into the eye and turns with the
// lever in the post's head (the bush), and carries an integral head outboard of
// it. So the lever is held by two faces on the one fixed part: the eye's outer
// face on the bush's inner face, and the pin's head on the bush's outer face,
// with the end-shake (`beakPivot.endShake`, derived from the nose's flat
// margin) split between them at the build.
//
// Method: translate the lever's whole arm (`alarmLinkBeakEye`'s parent, which
// carries the pin and its head since TODO 230) along its own y and advance
// conservatively on `meshClearance` against every mesh near it — a pure
// translation moves a distance by at most its own length, so stepping by the
// clearance cannot step over a contact. Pairs already touching at y = 0 are
// the working contacts (the nose on its column, the tail on the rod top) and
// are listed, not slid against.
//
// TODO 240 re-aimed the lever: its pin now lies along the column wheel's
// radius at the nose and the eye hangs on the lever's +y (the side the
// reaction's load line stands), so the slide runs along the RADIAL pin, and
// "toward the arm's line" is −side. The slide direction is read off the arm's
// LOCAL rotation, because its parent is the §261 2c fold, a reflection no
// world quaternion carries.
//
// Acceptance, at the LIFTED pose (reset), the SEATED pose (alarmToggle f 0.5)
// and the press stroke (alarmPress at its 64 net samples plus a fine sweep of
// the mid-press window where the jumper's blade passes the eye):
//   1. boot silent;
//   2. toward the arm's line (+y) the FIRST thing the lever meets is the pin's
//      head on the bush, at endShake/2 (±TOL);
//   3. away from it (−y) the first thing is the eye on the bush, at endShake/2;
//   4. nothing else is met within that distance plus TOL, in either direction
//      (the lever's WORKING contacts excepted — the nose on its column and the
//      tail on the rod's top, which are the cam the lever rides, not stops);
//   5. CONTROL — the same slide with the pin's head struck off the lever's
//      member list must NOT find a bearer at endShake/2 toward the arm's line
//      (TODO 204's fit: the rod or the jumper's blade, further out). A probe
//      that cannot fail this is reading something other than the retention.
//
//   cd tools && node probe-230-beak-retention.mjs     (exit 1 on any failure)
import { chromium } from 'playwright';
import { spawn } from 'node:child_process';

const port = process.env.PORT || '8583';
const root = process.env.ROOT || '..';
const srv = spawn('python3', ['-m', 'http.server', port, '--bind', '127.0.0.1'], { cwd: root, stdio: 'ignore' });
await new Promise((r) => setTimeout(r, 900));
const browser = await chromium.launch();
const page = await browser.newPage();
const warns = [];
page.on('console', (m) => { if ((m.type() === 'warning' || m.type() === 'error') && !/WebGL|GPU stall|GL Driver|GroupMarker|404|coplanar/.test(m.text())) warns.push(m.text()); });
page.on('pageerror', (e) => warns.push('PAGEERROR ' + String(e)));
await page.goto(`http://127.0.0.1:${port}/index.html?hud=0&sync=0`, { waitUntil: 'load', timeout: 240000 });
await page.waitForFunction(() => !!window.__clock || !!window.__bootError, null, { timeout: 300000 });
const bootWarns = warns.slice();

const R = await page.evaluate(async () => {
  const THREE = await import('./vendor/three.module.js');
  const I = await import('./src/inspect.js');
  const clock = window.__clock;
  const P = clock.beakPivot;
  const find = (n) => { let r = null; clock.scene.traverse((o) => { if (!r && o.isMesh && o.name === n && !o.userData.schematic) r = o; }); return r; };
  const eye = find('alarmLinkBeakEye');
  const arm = eye.parent;
  const leverAll = []; arm.traverse((o) => { if (o.isMesh && !o.userData.schematic) leverAll.push(o); });
  const isSchem = (o) => { for (let q = o; q; q = q.parent) if (q.userData && q.userData.schematic) return true; return false; };
  const others = []; clock.scene.traverse((o) => {
    if (!o.isMesh || leverAll.includes(o) || isSchem(o) || !(o.layers.mask & 1)) return;
    if (!o.geometry || !o.geometry.getAttribute('position')) return;
    others.push(o);
  });
  const CAP = 0.25;
  // The lever's WORKING contacts are not stops: the nose rides the column (its
  // flank's push along the pin is the very load the retention carries — TODO
  // 239), and the tail rides the rod's top, cut from the tail's own underside.
  // Both stand at or within a hairline of touching through the stroke, and a
  // slide into them measures the cam, not the pivot. (§261 2c: the same-side
  // beak has no tail — its BAR presses the rod between pivot and nose.)
  const WORKING = new Set(['alarmLinkBeak⇄alarmColCastellations', 'alarmLinkBeak⇄alarmColBase', 'alarmLinkBeakTail⇄alarmLinkRod', 'alarmLinkBeakBar⇄alarmLinkRod']);
  const slide = (lever, dir) => {
    const base = arm.position.clone();
    // the arm's own y (its pin) in its PARENT's frame, read off its local
    // rotation: since §261 2c the parent is the fold group, whose matrix is a
    // reflection, and a world QUATERNION cannot carry a reflection — taken
    // through getWorldQuaternion the slide ran the wrong way along the pin
    // (TODO 240 found it when the eye moved to the lever's +y side)
    const yP = new THREE.Vector3(0, 1, 0).applyQuaternion(arm.quaternion);
    const setD = (d) => { arm.position.copy(base).addScaledVector(yP, dir * d); arm.updateMatrixWorld(true); };
    setD(0);
    const lb = new THREE.Box3(); for (const m of lever) lb.expandByObject(m);
    lb.expandByScalar(CAP + 0.05);
    const cand = others.filter((o) => new THREE.Box3().setFromObject(o).intersectsBox(lb));
    const rows = [], touching = [];
    for (const o of cand) for (const m of lever) {
      setD(0);
      if (WORKING.has(`${m.name}⇄${o.name}`)) { touching.push(`${m.name}⇄${o.name}`); continue; }
      let c = I.meshClearance(m, o, CAP + 1);
      if (c < 1e-6) { touching.push(`${m.name}⇄${o.name}`); continue; }
      let d = 0, it = 0;
      while (d < CAP && it < 600) { d += Math.max(c, 2e-4); setD(d); c = I.meshClearance(m, o, CAP + 1); it++; if (c < 2e-4) break; }
      if (d < CAP) rows.push({ a: m.name, b: o.name, d });
    }
    arm.position.copy(base); arm.updateMatrixWorld(true);
    rows.sort((x, y) => x.d - y.d);
    return { rows: rows.slice(0, 4), touching };
  };
  const AX = Object.fromEntries(I.AXES.map((a) => [a.name, a]));
  const poses = [{ label: 'lifted (reset)', pose: null }, { label: 'seated (alarmToggle f 0.5)', pose: AX.alarmToggle.pose(0.5) }];
  const fs = new Set();
  for (let i = 0; i <= 64; i++) fs.add(i / 64);
  for (let i = 0; i <= 40; i++) fs.add(0.36 + 0.06 * i / 40);    // the jumper's blade passing the eye (nearest at f ≈ 0.388)
  for (const f of [...fs].sort((a, b) => a - b)) poses.push({ label: `alarmPress f ${f.toFixed(4)}`, pose: AX.alarmPress.pose(f) });
  const noHead = leverAll.filter((m) => m.name !== 'alarmLinkBeakPinHead');
  const out = [];
  for (const { label, pose } of poses) {
    I.enterAxis(clock); if (pose) clock.setPose(pose); clock.scene.updateMatrixWorld(true);
    const plus = slide(leverAll, +1), minus = slide(leverAll, -1);
    const ctl = label.startsWith('seated') || label.startsWith('lifted') || label === 'alarmPress f 0.3885' ? slide(noHead, P.side < 0 ? +1 : -1) : null;   // toward the arm's line: −side (TODO 240 put the eye on +y)
    out.push({ label, tilt: arm.rotation.y, plus: plus.rows, minus: minus.rows, touching: plus.touching, ctl: ctl && ctl.rows });
  }
  I.enterAxis(clock);
  return { endShake: P.endShake, side: P.side, haveHead: !!find('alarmLinkBeakPinHead'), pinInArm: find('alarmLinkBeakPin')?.parent === arm, out };
});

const TOL = 2e-3;
const half = R.endShake / 2;
const fails = [];
const ok = (c, msg) => { if (!c) fails.push(msg); return c; };
ok(bootWarns.length === 0, `boot not silent: ${bootWarns.slice(0, 3).join(' | ')}`);
ok(R.haveHead, 'no alarmLinkBeakPinHead mesh');
ok(R.pinInArm, 'the pin is not on the lever\'s arm');
// TOWARD the arm's line is −side along the lever's y (the eye hangs on `side`: −1 until TODO 240, +1 since)
const toward = R.side < 0 ? 'plus' : 'minus', away = R.side < 0 ? 'minus' : 'plus';
let worstNext = { d: Infinity }, ctlFound = 0, ctlBad = 0;
for (const r of R.out) {
  for (const [dirKey, want] of [[toward, 'alarmLinkBeakPinHead⇄alarmLinkBeakHead'], [away, 'alarmLinkBeakEye⇄alarmLinkBeakHead']]) {
    const rows = r[dirKey];
    const first = rows[0];
    ok(first && `${first.a}⇄${first.b}` === want && Math.abs(first.d - half) <= TOL,
      `${r.label} ${dirKey === toward ? 'toward' : 'away from'} the arm's line: first bearer ${first ? `${first.a}⇄${first.b} at ${first.d.toFixed(4)}` : 'none'}, want ${want} at ${half.toFixed(4)}`);
    const other = rows.find((x) => `${x.a}⇄${x.b}` !== want && !(x.b === 'alarmLinkBeakHead' && /alarmLinkBeak(Pin|Fulcrum)$/.test(x.a)));
    if (other) {
      ok(other.d > half + TOL, `${r.label}: ${other.a}⇄${other.b} met at ${other.d.toFixed(4)}, within the retention's ${half.toFixed(4)}`);
      if (other.d < worstNext.d) worstNext = { ...other, label: r.label, dir: dirKey === toward ? 'toward' : 'away' };
    }
  }
  if (r.ctl) {
    ctlFound++;
    const first = r.ctl[0];
    if (first && Math.abs(first.d - half) <= TOL) ctlBad++;
    console.log(`  control (${r.label}, no pin head, toward the arm's line): first ${first ? `${first.a}⇄${first.b} at ${first.d.toFixed(4)}` : `nothing within 0.25`}`);
  }
}
ok(ctlFound >= 3 && ctlBad === 0, `CONTROL: with the pin's head struck off, ${ctlBad} of ${ctlFound} slides still found a bearer at the end-shake — the probe is not reading the retention`);
const seated = R.out.find((r) => r.label.startsWith('seated')), lifted = R.out.find((r) => r.label.startsWith('lifted'));
console.log(`TODO 230 — the beak lever along its pin: end-shake ${R.endShake.toFixed(4)} (half ${half.toFixed(4)} each side), ${R.out.length} poses`);
for (const r of [lifted, seated]) console.log(`  ${r.label}: toward ${r[toward].map((x) => `${x.a.replace('alarmLinkBeak', '')}⇄${x.b} ${x.d.toFixed(4)}`).join(', ')} | away ${r[away].map((x) => `${x.a.replace('alarmLinkBeak', '')}⇄${x.b} ${x.d.toFixed(4)}`).join(', ')}`);
if (worstNext.d < Infinity) console.log(`  nearest thing beyond the retention: ${worstNext.a}⇄${worstNext.b} at ${worstNext.d.toFixed(4)} (${worstNext.dir} the arm's line, ${worstNext.label})`);
for (const f of fails) console.log('FAIL ' + f);
console.log(fails.length ? `FAIL — ${fails.length} failure(s)` : 'PASS — the lever is held both ways by its own thrust faces, at the end-shake, before anything else; control fails as it must');
await browser.close(); srv.kill();
process.exit(fails.length ? 1 : 0);
