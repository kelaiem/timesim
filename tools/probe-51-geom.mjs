// TODO 51 — the arrest's accommodation, measured directly rather than through
// a sweep. Everything is reported in the CONE's own cylindrical frame (r, az,
// z about P.barrel), because every constraint in this item is cylindrical: the
// chain's reach at a band, the lug's orbit, the arm's dip between two clear
// endpoints.
//
// The chain's reach is taken from the chainRun mesh's own world vertices —
// the DISCRETE links the mesh really lays, which is the item's first finding:
// a polygon's corners stand proud of the circle through its facet mids, so a
// continuum ARM_STOP_R under-reads by r(1 − cos(θ_link/2)).
import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
const port = process.env.PORT || '8472';
const root = process.env.ROOT || '..';
const srv = spawn('python3', ['-m', 'http.server', port, '--bind', '127.0.0.1'], { cwd: root, stdio: 'ignore' });
await new Promise((r) => setTimeout(r, 900));
const browser = await chromium.launch();
const page = await browser.newPage();
page.on('pageerror', (e) => console.log('PAGEERROR', String(e)));
const warns = [];
page.on('console', (m) => { if (m.type() === 'warning' || m.type() === 'error') warns.push(m.text()); });
await page.goto(`http://127.0.0.1:${port}/index.html`, { waitUntil: 'load', timeout: 90000 });
await page.waitForFunction(() => !!window.__clock, null, { timeout: 90000 });

// the shared in-page helpers, installed once
await page.evaluate(() => {
  const c = window.__clock;
  window.__C = { x: c.P.barrel.x, y: c.P.barrel.y };
  window.__meshes = (re) => {
    const out = [];
    c.scene.updateMatrixWorld(true);
    c.scene.traverse((o) => { if (o.isMesh && o.name && re.test(o.name)) out.push(o); });
    return out;
  };
  window.__cyl = (m) => {                     // cylindrical footprint of one mesh
    m.updateMatrixWorld(true);
    const pos = m.geometry.attributes.position;
    const v = m.position.clone();
    let rLo = 1e9, rHi = -1e9, zLo = 1e9, zHi = -1e9;
    const azs = [];
    for (let i = 0; i < pos.count; i++) {
      v.set(pos.getX(i), pos.getY(i), pos.getZ(i));
      const w = m.localToWorld(v.clone());
      const r = Math.hypot(w.x - window.__C.x, w.y - window.__C.y);
      const a = Math.atan2(w.y - window.__C.y, w.x - window.__C.x);
      rLo = Math.min(rLo, r); rHi = Math.max(rHi, r);
      zLo = Math.min(zLo, w.z); zHi = Math.max(zHi, w.z);
      azs.push(a);
    }
    // azimuth span, unwrapped about the first sample
    let aLo = 0, aHi = 0;
    const a0 = azs[0];
    for (const a of azs) {
      let d = (a - a0) % (2 * Math.PI);
      if (d > Math.PI) d -= 2 * Math.PI; if (d < -Math.PI) d += 2 * Math.PI;
      aLo = Math.min(aLo, d); aHi = Math.max(aHi, d);
    }
    return { r: [+rLo.toFixed(3), +rHi.toFixed(3)], z: [+zLo.toFixed(3), +zHi.toFixed(3)],
      az: [+(a0 + aLo).toFixed(3), +(a0 + aHi).toFixed(3)] };
  };
});

const facts = await page.evaluate(() => {
  const out = { wind: window.__clock.windArrest, C: window.__C, parts: {} };
  for (const m of window.__meshes(/windArrest/)) out.parts[m.name] = window.__cyl(m);
  return out;
});
console.log('--- solved quantities ---');
console.log(JSON.stringify(facts.wind, null, 1));
console.log('--- arrest members, cone-cylindrical (r, z, az) ---');
for (const [k, v] of Object.entries(facts.parts))
  console.log(`  ${k.padEnd(24)} r ${JSON.stringify(v.r).padEnd(18)} z ${JSON.stringify(v.z).padEnd(18)} az ${JSON.stringify(v.az)}`);

// the chain's DISCRETE reach as a function of azimuth, inside the finger's
// own z band, at each tension — the number ARM_STOP_R owes
const bandProbe = await page.evaluate((parts) => {
  const c = window.__clock;
  const band = parts.windArrestPawl.z;               // the finger's plate band
  const out = { band, byTension: {} };
  for (const t of [0, 0.2, 0.4, 0.6, 0.8, 0.9, 1]) {
    c.resetInputs?.(); c.setPose({ tension: t });
    c.scene.updateMatrixWorld(true);
    const bins = new Array(72).fill(0);
    for (const m of window.__meshes(/^chainRun$/)) {
      m.updateMatrixWorld(true);
      const pos = m.geometry.attributes.position;
      const v = m.position.clone();
      for (let i = 0; i < pos.count; i++) {
        v.set(pos.getX(i), pos.getY(i), pos.getZ(i));
        const w = m.localToWorld(v.clone());
        if (w.z < band[0] - 0.02 || w.z > band[1] + 0.02) continue;
        const r = Math.hypot(w.x - window.__C.x, w.y - window.__C.y);
        let a = Math.atan2(w.y - window.__C.y, w.x - window.__C.x);
        if (a < 0) a += 2 * Math.PI;
        const b = Math.min(71, Math.floor((a / (2 * Math.PI)) * 72));
        bins[b] = Math.max(bins[b], r);
      }
    }
    out.byTension[t] = bins.map((x) => +x.toFixed(3));
  }
  return out;
}, facts.parts);
console.log(`\n--- chain reach by azimuth bin (5° bins) inside the finger band z=${JSON.stringify(bandProbe.band)} ---`);
for (const [t, bins] of Object.entries(bandProbe.byTension)) {
  const worst = Math.max(...bins);
  const occupied = bins.filter((x) => x > 0).length;
  console.log(`t=${t}  maxReach=${worst.toFixed(3)}  bins occupied=${occupied}/72`);
}
console.log('bin index → azimuth = bin*5°;  full table at t=1:');
console.log(JSON.stringify(bandProbe.byTension['1']));

// the two fouling pairs, mesh to mesh, over the wind
console.log('\n--- mesh clearances over tension ---');
const pairs = [['windArrestBeakArm', 'chainRun'], ['windArrestPadArm', 'chainRun'],
  ['windArrestRiser', 'chainRun'], ['windArrestPad', 'chainRun'],
  ['windArrestPad', 'windArrestLug'], ['windArrestPadArm', 'windArrestLug'],
  ['windArrestBeakArm', 'windArrestLug'], ['windArrestPawl', 'windArrestLug']];
for (const t of [0, 0.2, 0.4, 0.6333, 0.8, 0.95, 1]) {
  const row = await page.evaluate(async ({ pairs, t }) => {
    const I = await import('./src/inspect.js');
    const c = window.__clock;
    c.resetInputs?.(); c.setPose({ tension: t });
    c.scene.updateMatrixWorld(true);
    const find = (n) => window.__meshes(new RegExp(`^${n}$`))[0] ?? null;
    const out = {};
    for (const [a, b] of pairs) {
      const A = find(a), B = find(b);
      out[`${a}⇄${b}`] = (A && B) ? +I.meshClearance(A, B).toFixed(4) : 'missing';
    }
    return out;
  }, { pairs, t });
  console.log(`t=${t}`, JSON.stringify(row));
}
if (warns.length) { console.log('\n--- console warnings ---'); for (const w of warns) console.log(' ', w); }
await browser.close();
srv.kill();
