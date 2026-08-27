// TODO 99 — HOW MUCH of the movement is open? Every parity witness in this
// repo (`pointInsideTree`, `probe-95-grid`, `sampledVerdict`'s insideness, and
// TODO 27's family) counts ray crossings and is therefore only valid against a
// CLOSED surface. Nothing measures how many surfaces qualify.
//
// Counts boundary edges per mesh, keyed by POSITION — three.js duplicates
// vertices per face for normals, so an index-keyed count calls a plain
// BoxGeometry open (12 triangles, 24 "boundary" edges) and would report the
// whole movement open. An edge shared by exactly two faces is interior;
// anything else (1 face, or 3+) breaks the manifold the parity argument needs.
//
// Reports per unit and in total, plus the share of PAIRS that have no valid
// witness at all, which is the number that matters: a pair is judgeable only
// if at least one side is closed.  REPORT.
import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
const ROOT = process.env.ROOT || join(dirname(fileURLToPath(import.meta.url)), '..');
const PORT = Number(process.env.PORT || 8488);
const srv = spawn('python3',['-m','http.server',String(PORT),'--bind','127.0.0.1'],{cwd:ROOT,stdio:'ignore'});
await new Promise(r=>setTimeout(r,1200));
const b=await chromium.launch(); const p=await b.newPage();
p.on('pageerror',e=>console.log('PAGEERROR',String(e)));
await p.goto(`http://127.0.0.1:${PORT}/index.html`,{waitUntil:'load',timeout:90000});
await p.waitForFunction(()=>!!window.__clock,null,{timeout:90000});
console.log(await p.evaluate(async ()=>{
  const c=window.__clock; const o=[];
  const meshesOf=e=>{const m=[];const w=n=>{if(n.userData&&n.userData.schematic)return;
    if(n.isMesh&&n.geometry&&n.geometry.attributes.position)m.push(n);for(const ch of n.children)w(ch);};w(e.obj);return m;};
  const seen=new Map();   // geometry -> bad edge count, so shared geometry is counted once
  const boundary=(g)=>{if(seen.has(g))return seen.get(g);
    const pos=g.attributes.position,idx=g.index;const n=idx?idx.count:pos.count;
    const at=t=>idx?idx.getX(t):t;
    const q=v=>{const r=Math.round(v*1e5);return r===0?0:r;};      // -0 and +0 are ONE position
    const key=i=>`${q(pos.getX(i))}_${q(pos.getY(i))}_${q(pos.getZ(i))}`;
    const e=new Map();
    for(let t=0;t+2<n;t+=3){const k=[key(at(t)),key(at(t+1)),key(at(t+2))];
      for(let q=0;q<3;q++){const a=k[q],b2=k[(q+1)%3]; if(a===b2)continue;
        const kk=a<b2?`${a}|${b2}`:`${b2}|${a}`; e.set(kk,(e.get(kk)||0)+1);}}
    let bad=0,three=0; for(const v of e.values()){if(v!==2)bad++; if(v>2)three++;}
    const r={bad,three,edges:e.size}; seen.set(g,r); return r;};
  let mTot=0,mOpen=0,mHole=0,mNM=0,mBoth=0; const rows=[]; const byType=new Map();
  for(const e of c.labelEntries){
    const ms=meshesOf(e); let open=0; const worst=[];
    for(const m of ms){const r=boundary(m.geometry); mTot++;
      const t=m.geometry.type; const bt=byType.get(t)||{n:0,open:0,hole:0,nm:0}; bt.n++;
      if(r.bad){open++;mOpen++;bt.open++;worst.push([m.name||`${t}#${ms.indexOf(m)}`,r.bad,r.three]);
        const holes=r.bad-r.three;
        if(holes&&r.three){mBoth++;bt.hole++;bt.nm++;} else if(holes){mHole++;bt.hole++;} else {mNM++;bt.nm++;}}
      byType.set(t,bt);}
    worst.sort((x,y)=>y[1]-x[1]);
    rows.push([e.name,ms.length,open,worst.slice(0,3)]);
  }
  rows.sort((x,y)=>(y[2]/Math.max(1,y[1]))-(x[2]/Math.max(1,x[1])));
  o.push(`MESHES: ${mTot} total, ${mOpen} not closed (${(100*mOpen/mTot).toFixed(1)}%)`);
  o.push(`  HOLES only (edges with 1 face)      ${mHole}  — parity is definitely unsound: a ray can enter and never leave`);
  o.push(`  NON-MANIFOLD only (edges with 3+)   ${mNM}  — usually two solids sharing a welded face; parity may still count correctly`);
  o.push(`  BOTH                                ${mBoth}`);
  o.push('');
  o.push('by geometry type:');
  for(const [t,v] of [...byType].sort((a,b)=>b[1].open-a[1].open))
    o.push(`  ${t.padEnd(20)} ${String(v.open).padStart(4)} of ${String(v.n).padStart(4)}  (${String((100*v.open/v.n).toFixed(0)).padStart(3)}%)   holes ${String(v.hole).padStart(3)}  non-manifold ${String(v.nm).padStart(3)}`);
  o.push('');
  o.push('by unit (worst first, up to 3 exemplars each):');
  for(const [n,tot,open,worst] of rows){
    if(!open) continue;
    o.push(`  ${n}: ${open}/${tot} open` + (worst.length?`  — ${worst.map(([nm,bd,th])=>`${nm} ${bd}${th?` (${th} non-manifold)`:''}`).join(', ')}`:''));
  }
  const closedUnits=rows.filter(r=>!r[2]).map(r=>r[0]);
  o.push('');
  o.push(`units with NO open mesh (${closedUnits.length}): ${closedUnits.join(', ')||'—'}`);
  // the number that matters: what share of mesh PAIRS has no valid witness
  const pOpen=mOpen/mTot;
  o.push('');
  o.push(`share of mesh pairs with BOTH sides open, if openness were independent: ${(100*pOpen*pOpen).toFixed(1)}%`);
  o.push('  (a pair is judgeable by parity only if at least one side is closed)');
  return o.join('\n');
}));
await b.close(); srv.kill();
