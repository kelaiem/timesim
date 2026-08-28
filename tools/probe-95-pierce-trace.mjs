// TODO 95 — WHERE does the pass-through witness fire, and on what edge?
// Replicates `_sampledVerdictInner`'s witness loop for BOTH directions of a
// pair (set PAIR='["unit",sel,"unit",sel]') and prints, for each edge that
// fires: the direction, the edge's endpoints and length in the dst-local
// frame, the RAW raycast distances and the ones the dedupe kept.
//
// It was written to test two suspected causes of a believed false positive
// and refuted both. What it found instead: the edges were 17 and 26 units
// long, not the ~2.5 the refutation had assumed, so the pair really did
// intersect; and the raw hit distances came back UNSORTED (3.4463, 2.9659,
// 7.1572, 7.6510), which the dedupe's ascending scan silently dropped a real
// crossing from. Printing the raw list beside the kept list is what exposed
// that, and is why this probe prints both.  REPORT — judges nothing.
import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
const ROOT = process.env.ROOT || join(dirname(fileURLToPath(import.meta.url)), '..');
const PORT = Number(process.env.PORT || 8483);
const srv = spawn('python3',['-m','http.server',String(PORT),'--bind','127.0.0.1'],{cwd:ROOT,stdio:'ignore'});
await new Promise(r=>setTimeout(r,1200));
const b=await chromium.launch(); const p=await b.newPage();
p.on('pageerror',e=>console.log('PAGEERROR',String(e)));
await p.goto(`http://127.0.0.1:${PORT}/index.html`,{waitUntil:'load',timeout:90000});
await p.waitForFunction(()=>!!window.__clock,null,{timeout:90000});
if (process.env.PAIR) await p.evaluate(v=>{window.__PAIR=JSON.parse(v);}, process.env.PAIR);
console.log(await p.evaluate(async ()=>{
  const THREE=await import('three'); const I=await import('./src/inspect.js');
  const c=window.__clock; const o=[];
  const unit=n=>c.labelEntries.find(x=>x.name===n);
  const meshesOf=e=>{const m=[];const w=n=>{if(n.userData&&n.userData.schematic)return;
    if(n.isMesh&&n.geometry&&n.geometry.attributes.position)m.push(n);for(const ch of n.children)w(ch);};w(e.obj);return m;};
  const closed=(g)=>{const pos=g.attributes.position,idx=g.index;const n=idx?idx.count:pos.count;
    const at=t=>idx?idx.getX(t):t;
    const q=v=>{const r=Math.round(v*1e5);return r===0?0:r;};      // -0 and +0 are ONE position
    const key=i=>`${q(pos.getX(i))}_${q(pos.getY(i))}_${q(pos.getZ(i))}`;
    const e=new Map();
    for(let t=0;t+2<n;t+=3){const k=[key(at(t)),key(at(t+1)),key(at(t+2))];
      for(let q=0;q<3;q++){const a=k[q],b2=k[(q+1)%3]; if(a===b2)continue;
        const kk=a<b2?`${a}|${b2}`:`${b2}|${a}`; e.set(kk,(e.get(kk)||0)+1);}}
    let bad=0; for(const v of e.values()) if(v!==2) bad++;
    return {closed:bad===0, bad};};
  I.enterAxis(c); c.setPose(I.AXES[0].pose(0,c));

  const PAIR=(window.__PAIR||['Alarm disc',20,'Hour wheel','hourTube']);
  const pick=(u,s)=>{const l=meshesOf(unit(u)); return typeof s==='number'?l[s]:l.find(x=>x.name===s);};
  const A=pick(PAIR[0],PAIR[1]);
  const B=pick(PAIR[2],PAIR[3]);
  if(!A||!B) return 'pair not found';
  o.push(`A = ${A.name||'(unnamed)'} ${A.geometry.type}  closed:${JSON.stringify(closed(A.geometry))}`);
  o.push(`B = ${B.name} ${B.geometry.type}  closed:${JSON.stringify(closed(B.geometry))}`);
  o.push(`world-centre distance = ${A.getWorldPosition(new THREE.Vector3()).distanceTo(B.getWorldPosition(new THREE.Vector3())).toFixed(4)}`);
  o.push(`meshClearance = ${I.meshClearance(A,B,Infinity).toFixed(4)}`);
  o.push('');

  // Replicate the witness, both directions, with full instrumentation.
  const mat=new THREE.Matrix4(), pe0=new THREE.Vector3(), pe1=new THREE.Vector3();
  const ray=new THREE.Ray(), dir=new THREE.Vector3();
  for(const [src,dst,tag] of [[B,A,'src=B  dst=A'],[A,B,'src=A  dst=B']]){
    const tree=dst.geometry.boundsTree;          // built by the meshClearance call above
    const box=tree.getBoundingBox(new THREE.Box3());
    mat.copy(dst.matrixWorld).invert().multiply(src.matrixWorld);
    const pos=src.geometry.attributes.position, idx=src.geometry.index;
    o.push(`--- ${tag}`);
    o.push(`    dst-local box  min ${box.min.toArray().map(v=>v.toFixed(3))}  max ${box.max.toArray().map(v=>v.toFixed(3))}`);
    o.push(`    src verts ${pos.count}, indexed ${!!idx}`);
    // src's extent in the DST-LOCAL frame — if the frame is wrong this is where it shows.
    const sb=new THREE.Box3(); const v=new THREE.Vector3();
    for(let i=0;i<pos.count;i++) sb.expandByPoint(v.fromBufferAttribute(pos,i).applyMatrix4(mat));
    o.push(`    src box in dst frame  min ${sb.min.toArray().map(x=>x.toFixed(3))}  max ${sb.max.toArray().map(x=>x.toFixed(3))}`);
    o.push(`    boxes intersect? ${box.intersectsBox(sb)}   box-to-box distance ${box.distanceToPoint(sb.getCenter(new THREE.Vector3())).toFixed(4)}`);
    if(!idx){o.push('    (no index — witness would not run)');o.push('');continue;}
    let fired=0, maxLen=0, scanned=0;
    for(let t=0;t<idx.count;t+=3){
      for(const [i0,i1] of [[0,1],[1,2],[2,0]]){
        pe0.fromBufferAttribute(pos,idx.getX(t+i0)).applyMatrix4(mat);
        pe1.fromBufferAttribute(pos,idx.getX(t+i1)).applyMatrix4(mat);
        const L=dir.subVectors(pe1,pe0).length(); scanned++;
        if(L>maxLen) maxLen=L;
        if(L<1e-12) continue;
        ray.origin.copy(pe0); ray.direction.copy(dir.divideScalar(L));
        if(!ray.intersectsBox(box)) continue;
        const hits=tree.raycast(ray,THREE.DoubleSide,0,L);
        let n=0,last=-Infinity; const kept=[];
        for(const h of hits){const d=h.distance;
          if(d<=1e-9||d>=L-1e-9) continue;
          if(d-last<1e-7) continue;
          last=d;n++;kept.push(d);}
        if(n>=2){
          fired++;
          if(fired<=3){
            o.push(`    FIRES tri ${t/3} edge ${i0}-${i1}`);
            o.push(`      p0 ${pe0.toArray().map(x=>x.toFixed(3))}  p1 ${pe1.toArray().map(x=>x.toFixed(3))}  len ${L.toFixed(4)}`);
            o.push(`      raw hits ${hits.length}  all distances ${hits.map(h=>h.distance.toFixed(4)).slice(0,10).join(', ')}`);
            o.push(`      kept ${kept.map(x=>x.toFixed(4)).join(', ')}`);
          }
        }
      }
    }
    o.push(`    edges scanned ${scanned}, longest ${maxLen.toFixed(4)}, FIRED ${fired}`);
    o.push('');
  }
  return o.join('\n');
}));
await b.close(); srv.kill();
