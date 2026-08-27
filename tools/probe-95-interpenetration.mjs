// TODO 95 — does a claimed interpenetration SURVIVE a witness that is valid on
// the meshes it is applied to? Parity needs a CLOSED surface, so this probe
// never assumes one: it counts boundary edges (keyed by POSITION — three.js
// duplicates vertices per face, so an index-keyed count calls a plain box open)
// and then picks the only sound test available for that pair —
//   both closed      → sample each SURFACE, parity against the other
//   exactly one open → sample the OPEN one's surface, parity against the CLOSED
//   both open        → REFUSE, and say so; no witness here is valid
// Surfaces, never vertices: a barycentric grid over every triangle. The row
// this instrument exists for was retracted on a VERTEX-only radial span that
// read 5.260 where the surface reaches 1.216.  REPORT.
import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
const ROOT = process.env.ROOT || join(dirname(fileURLToPath(import.meta.url)), '..');
const PORT = Number(process.env.PORT || 8485);
const srv = spawn('python3',['-m','http.server',String(PORT),'--bind','127.0.0.1'],{cwd:ROOT,stdio:'ignore'});
await new Promise(r=>setTimeout(r,1200));
const b=await chromium.launch(); const p=await b.newPage();
p.on('pageerror',e=>console.log('PAGEERROR',String(e)));
await p.goto(`http://127.0.0.1:${PORT}/index.html`,{waitUntil:'load',timeout:90000});
await p.waitForFunction(()=>!!window.__clock,null,{timeout:90000});
const PAIRS = [
  ['Alarm selector', 1, 'Alarm selector', 12, 'TODO 95 row 1 — boss vs post'],
  ['Alarm selector', 3, 'Alarm selector', 13, 'TODO 95 row 2'],
  ['Alarm selector', 5, 'Alarm selector', 14, 'TODO 95 row 3'],
  ['Alarm winding arrest', 19, 'Alarm winding arrest', 21, 'TODO 95 row 4 — declaration under review'],
  ['Alarm switch', 'alarmPusherStem', 'Alarm switch', 'alarmPusherReturnSpring', 'TODO 95 row 5 — the real graze'],
  ['Alarm disc', 20, 'Hour wheel', 'hourTube', 'TODO 95 row 6 — the row the handover retracted'],
];
console.log(await p.evaluate(async (PAIRS) => {
  const THREE=await import('three'); const I=await import('./src/inspect.js');
  const c=window.__clock; const o=[];
  const unit=n=>c.labelEntries.find(x=>x.name===n);
  // mirrors collectUnits' PRUNING, not traverse(): a schematic subtree is cut
  // whole, so indices match what the battery labels.
  const meshesOf=e=>{const m=[];const w=n=>{if(n.userData&&n.userData.schematic)return;
    if(n.isMesh&&n.geometry&&n.geometry.attributes.position)m.push(n);for(const ch of n.children)w(ch);};w(e.obj);return m;};
  const boundary=(g)=>{const pos=g.attributes.position,idx=g.index;const n=idx?idx.count:pos.count;
    const at=t=>idx?idx.getX(t):t;
    const q=v=>{const r=Math.round(v*1e5);return r===0?0:r;};      // -0 and +0 are ONE position
    const key=i=>`${q(pos.getX(i))}_${q(pos.getY(i))}_${q(pos.getZ(i))}`;
    const e=new Map();
    for(let t=0;t+2<n;t+=3){const k=[key(at(t)),key(at(t+1)),key(at(t+2))];
      for(let q=0;q<3;q++){const a=k[q],b2=k[(q+1)%3]; if(a===b2)continue;
        const kk=a<b2?`${a}|${b2}`:`${b2}|${a}`; e.set(kk,(e.get(kk)||0)+1);}}
    let bad=0; for(const v of e.values()) if(v!==2) bad++;
    return bad;};
  const surf=(mesh,N)=>{const g=mesh.geometry,pos=g.attributes.position,idx=g.index;
    const n=idx?idx.count:pos.count, out=[];
    const a=new THREE.Vector3(),b2=new THREE.Vector3(),cc=new THREE.Vector3();
    for(let t=0;t+2<n;t+=3){
      const i0=idx?idx.getX(t):t,i1=idx?idx.getX(t+1):t+1,i2=idx?idx.getX(t+2):t+2;
      a.fromBufferAttribute(pos,i0); b2.fromBufferAttribute(pos,i1); cc.fromBufferAttribute(pos,i2);
      for(let u=0;u<=N;u++) for(let v=0;u+v<=N;v++){const w=N-u-v;
        out.push(new THREE.Vector3((a.x*w+b2.x*u+cc.x*v)/N,(a.y*w+b2.y*u+cc.y*v)/N,(a.z*w+b2.z*u+cc.z*v)/N));}}
    return out;};
  // five oblique rays, majority vote — a single axis-ish ray grazes coaxial walls
  const DIRS=[[0.317,0.591,0.741],[0.803,-0.271,0.530],[-0.436,0.712,0.550],
              [0.601,0.499,-0.624],[-0.259,-0.487,0.834]].map(d=>new THREE.Vector3(...d).normalize());
  const insideTree=(tree,box,v,ray)=>{
    if(box.distanceToPoint(v)!==0) return false;
    let yes=0;
    for(const d of DIRS){ray.origin.copy(v);ray.direction.copy(d);
      const hs=tree.raycast(ray,THREE.DoubleSide);
      let k=0; for(const h of hs) if(h.distance>1e-9) k++;
      if(k%2===1) yes++;}
    return yes>=3;};

  I.enterAxis(c); c.setPose(I.AXES[0].pose(0,c));
  const ray=new THREE.Ray();
  for(const [ua,sa,ub,sb,note] of PAIRS){
    const la=meshesOf(unit(ua)||{obj:new THREE.Object3D()});
    const lb=meshesOf(unit(ub)||{obj:new THREE.Object3D()});
    const pick=(l,s)=>typeof s==='number'?l[s]:l.filter(x=>x.name===s);
    let A=pick(la,sa), B=pick(lb,sb);
    if(Array.isArray(A)){ if(A.length!==1) o.push(`  NOTE ${sa} matches ${A.length} meshes in ${ua}`); A=A[0]; }
    if(Array.isArray(B)){ if(B.length!==1) o.push(`  NOTE ${sb} matches ${B.length} meshes in ${ub}`); B=B[0]; }
    const nameOf=(m,s)=>`${m&&m.name?m.name:`${m?m.geometry.type:'?'}#${s}`}`;
    o.push(`=== ${ua}/${nameOf(A,sa)} ⇄ ${ub}/${nameOf(B,sb)}${note?`   (${note})`:''}`);
    if(!A||!B){o.push('  NOT FOUND');o.push('');continue;}
    const ba=boundary(A.geometry), bb=boundary(B.geometry);
    o.push(`  boundary edges: A ${ba} (${ba?'OPEN':'closed'})   B ${bb} (${bb?'OPEN':'closed'})`);
    o.push(`  meshClearance = ${I.meshClearance(A,B,Infinity).toFixed(4)}`);
    if(ba&&bb){o.push('  BOTH OPEN — parity is invalid on either side. This probe cannot judge it.');o.push('');continue;}
    // sample the open one against the closed one; if both closed, do both ways
    const runs = ba ? [[A,B]] : bb ? [[B,A]] : [[A,B],[B,A]];
    for(const [src,dst] of runs){
      I.meshClearance(src,dst,Infinity);            // builds the trees
      const tree=dst.geometry.boundsTree, box=tree.getBoundingBox(new THREE.Box3());
      const m=new THREE.Matrix4().copy(dst.matrixWorld).invert().multiply(src.matrixWorld);
      const pts=surf(src,4);
      let inside=0,deepest=0,nearest=Infinity;
      for(const q of pts){const v=q.clone().applyMatrix4(m);
        const hit=tree.closestPointToPoint(v,{},0,Infinity);
        if(hit&&hit.distance<nearest) nearest=hit.distance;
        if(insideTree(tree,box,v,ray)){inside++; if(hit&&hit.distance>deepest)deepest=hit.distance;}}
      o.push(`  ${src===A?'A':'B'} surface (${pts.length} pts) vs ${dst===A?'A':'B'} solid: inside ${inside}, deepest ${deepest.toFixed(4)}, nearest ${nearest.toFixed(4)}`);
    }
    o.push('');
  }
  return o.join('\n');
}, PAIRS));
await b.close(); srv.kill();
