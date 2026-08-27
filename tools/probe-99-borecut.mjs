// TODO 95 row 4 / TODO 99 — is the geneva finger disc's BORE actually cut?
// The arbor's own side edges cross the disc's surface twice, at exactly the
// disc's two face planes, from a radius of 0.185 — inside the 0.2347 bore it
// is supposed to pass through freely. That can only mean cap triangles span
// the hole. This counts them: every triangle whose centroid falls inside the
// bore radius is metal where the drawing says air.
// `src/geometry.js` already records this failure once — an `absarc` at
// `curveSegments: 1` collapsing to a single segment — and replaced it with an
// explicit 64-gon. This asks whether that replacement finished the job.  REPORT.
import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
const ROOT = process.env.ROOT || join(dirname(fileURLToPath(import.meta.url)), '..');
const PORT = Number(process.env.PORT || 8490);
const srv = spawn('python3',['-m','http.server',String(PORT),'--bind','127.0.0.1'],{cwd:ROOT,stdio:'ignore'});
await new Promise(r=>setTimeout(r,1200));
const b=await chromium.launch(); const p=await b.newPage();
p.on('pageerror',e=>console.log('PAGEERROR',String(e)));
await p.goto(`http://127.0.0.1:${PORT}/index.html`,{waitUntil:'load',timeout:90000});
await p.waitForFunction(()=>!!window.__clock,null,{timeout:90000});
console.log(await p.evaluate(async ()=>{
  const THREE=await import('three'); const c=window.__clock; const o=[];
  const unit=n=>c.labelEntries.find(x=>x.name===n);
  const meshesOf=e=>{const m=[];const w=n=>{if(n.userData&&n.userData.schematic)return;
    if(n.isMesh&&n.geometry&&n.geometry.attributes.position)m.push(n);for(const ch of n.children)w(ch);};w(e.obj);return m;};
  const AR=meshesOf(unit('Alarm winding arrest'));
  const disc=AR[19], arbor=AR[21];
  const boreR=arbor.geometry.parameters.radiusTop+0.05;   // fingerBoreR = arborR + 0.05
  // Cast a ray straight down the bore on a polar grid and ask what it hits.
  // A cut bore hits nothing anywhere inside its own radius; the bore WALL is
  // not a defect and a centroid test cannot tell the two apart, which is why
  // this asks the question the arbor itself asks.
  const pos=disc.geometry.attributes.position, idx=disc.geometry.index;
  const I=await import('./src/inspect.js');
  I.meshClearance(disc,arbor,Infinity);
  const tree=disc.geometry.boundsTree;
  const ray=new THREE.Ray(); const dirZ=new THREE.Vector3(0,0,1);
  const arborR=arbor.geometry.parameters.radiusTop;
  let grid=0, blocked=0, blockedInArbor=0, gridInArbor=0; const hitAz=[];
  for(let ri=1; ri<=24; ri++){
    const r=(ri/24)*boreR*0.999;
    const NA=Math.max(8, Math.round(64*r/boreR));
    for(let ai=0; ai<NA; ai++){
      const a=(ai/NA)*Math.PI*2;
      const x=Math.cos(a)*r, y=Math.sin(a)*r;
      ray.origin.set(x,y,-1); ray.direction.copy(dirZ);
      const hs=tree.raycast(ray,THREE.DoubleSide);
      grid++; const inA = r<arborR; if(inA) gridInArbor++;
      if(hs.length){blocked++; if(inA){blockedInArbor++; if(hitAz.length<6) hitAz.push(`r ${r.toFixed(3)} az ${(a*180/Math.PI).toFixed(0)}° hits ${hs.length}`);}}
    }
  }
  o.push(`disc: ${(idx?idx.count:pos.count)/3} triangles, bore radius ${boreR.toFixed(4)} (arbor r ${arborR.toFixed(4)} + the 0.05 running fit)`);
  o.push(`rays down the bore: ${grid} sampled, ${blocked} BLOCKED by disc metal (${(100*blocked/grid).toFixed(1)}%)`);
  o.push(`  of those inside the ARBOR's own radius: ${blockedInArbor} of ${gridInArbor} blocked (${(100*blockedInArbor/Math.max(1,gridInArbor)).toFixed(1)}%)`);
  for(const h of hitAz) o.push(`    e.g. ${h}`);
  o.push('');
  o.push(blockedInArbor ? "VERDICT: the bore is NOT fully cut — the disc's cap triangulation carries metal across the hole its arbor runs in, so the arbor's own surface crosses the disc's."
                        : 'VERDICT: the bore is clear where the arbor runs.');
  return o.join('\n');
}));
await b.close(); srv.kill();
