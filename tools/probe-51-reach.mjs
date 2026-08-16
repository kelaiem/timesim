// TODO 51 — the wrap's DEMAND on the finger's plate band, as a function of
// azimuth. Each chain vertex demands a sphere of CLEAR_MARGIN about it, so a
// vertex dz outside the band demands r + √(margin² − dz²) and one inside it
// demands r + margin; the profile is the max of that over the whole wind.
// Printed per 5° bin so the sectors the arms actually occupy can be read off
// separately from the departing span's own corridor.
import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
const port = process.env.PORT || '8474';
const srv = spawn('python3', ['-m', 'http.server', port, '--bind', '127.0.0.1'], { cwd: '..', stdio: 'ignore' });
await new Promise((r) => setTimeout(r, 900));
const browser = await chromium.launch();
const page = await browser.newPage();
page.on('pageerror', (e) => console.log('PAGEERROR', String(e)));
await page.goto(`http://127.0.0.1:${port}/index.html`, { waitUntil: 'load', timeout: 90000 });
await page.waitForFunction(() => !!window.__clock, null, { timeout: 90000 });

const NBIN = 72;
const BAND = process.env.BAND || 'hub';
const bins = new Array(NBIN).fill(0);
const at = new Array(NBIN).fill(null);
const STEPS = Number(process.env.STEPS || 40);
for (let i = 0; i <= STEPS; i++) {
  const t = i / STEPS;
  const row = await page.evaluate(({ t, NBIN, BAND }) => {
    const c = window.__clock;
    const C = { x: c.P.barrel.x, y: c.P.barrel.y };
    const band = BAND === 'lug' ? c.windArrest.tabZ : c.windArrest.hubZ;
    const MARGIN = 0.15;
    c.resetInputs?.(); c.setPose({ tension: t });
    c.scene.updateMatrixWorld(true);
    const out = new Array(NBIN).fill(0);
    c.scene.traverse((o) => {
      if (!o.isMesh || o.name !== 'chainRun') return;
      o.updateMatrixWorld(true);
      const pos = o.geometry.attributes.position; const v = o.position.clone();
      for (let k = 0; k < pos.count; k++) {
        v.set(pos.getX(k), pos.getY(k), pos.getZ(k));
        const w = o.localToWorld(v.clone());
        const dz = w.z < band[0] ? band[0] - w.z : w.z > band[1] ? w.z - band[1] : 0;
        if (dz >= MARGIN) continue;
        const r = Math.hypot(w.x - C.x, w.y - C.y) + Math.sqrt(MARGIN * MARGIN - dz * dz);
        let a = Math.atan2(w.y - C.y, w.x - C.x); if (a < 0) a += 2 * Math.PI;
        const b = Math.min(NBIN - 1, Math.floor((a / (2 * Math.PI)) * NBIN));
        if (r > out[b]) out[b] = r;
      }
    });
    return out;
  }, { t, NBIN, BAND });
  for (let b = 0; b < NBIN; b++) if (row[b] > bins[b]) { bins[b] = row[b]; at[b] = t; }
}
const facts = await page.evaluate(() => window.__clock.windArrest);
console.log(`azRange=${JSON.stringify(facts.azRange)} tabZ=${JSON.stringify(facts.tabZ)}`);
console.log(`band=${BAND} z=${JSON.stringify((BAND === 'lug' ? facts.tabZ : facts.hubZ).map((x) => +x.toFixed(3)))}  lugOuter=${facts.lugOuter.toFixed(3)}`);
console.log('bin  az°     demand   worst-t');
for (let b = 0; b < NBIN; b++)
  console.log(`${String(b).padStart(3)}  ${String(b * 5).padStart(4)}   ${bins[b].toFixed(3).padStart(7)}   ${at[b] ?? '-'}`);
const finite = bins.filter((x) => x > 0);
console.log(`\nglobal max ${Math.max(...finite).toFixed(3)}   median ${finite.sort((a, b) => a - b)[finite.length >> 1].toFixed(3)}`);
await browser.close();
srv.kill();
