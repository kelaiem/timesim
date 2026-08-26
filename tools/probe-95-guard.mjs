// TODO 95 — does the closedness guard kill the false positive and keep the
// real one? Two pairs, chosen because they differ in exactly the thing the
// guard tests:
//   alarmPusherStem ⇄ alarmPusherReturnSpring  — spring CLOSED, and the stem
//     really does graze it (surface sampling: 8 of 96,336 points inside).
//     Must stay reported.
//   alarmDisc ExtrudeGeometry#20 ⇄ hourTube    — hourTube OPEN (8 boundary
//     edges) and the pair stands 2.760 u apart radially about the tube's own
//     axis. Must stop being reported.
import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
const ROOT = process.env.ROOT || join(dirname(fileURLToPath(import.meta.url)), '..');
const PORT = Number(process.env.PORT || 8482);
const srv = spawn('python3',['-m','http.server',String(PORT),'--bind','127.0.0.1'],{cwd:ROOT,stdio:'ignore'});
await new Promise(r=>setTimeout(r,1200));
const b=await chromium.launch(); const p=await b.newPage();
p.on('pageerror',e=>console.log('PAGEERROR',String(e)));
await p.goto(`http://127.0.0.1:${PORT}/index.html`,{waitUntil:'load',timeout:90000});
await p.waitForFunction(()=>!!window.__clock,null,{timeout:90000});
console.log(await p.evaluate(async ()=>{
  const THREE=await import('three'); const I=await import('./src/inspect.js');
  const c=window.__clock; const o=[];
  const unit=n=>c.labelEntries.find(x=>x.name===n);
  const meshesOf=e=>{const m=[];const w=n=>{if(n.userData&&n.userData.schematic)return;
    if(n.isMesh&&n.geometry&&n.geometry.attributes.position)m.push(n);for(const ch of n.children)w(ch);};w(e.obj);return m;};
  const closed=(g)=>{const pos=g.attributes.position,idx=g.index;const n=idx?idx.count:pos.count;
    const at=t=>idx?idx.getX(t):t;
    const key=i=>`${pos.getX(i).toFixed(5)}_${pos.getY(i).toFixed(5)}_${pos.getZ(i).toFixed(5)}`;
    const e=new Map();
    for(let t=0;t+2<n;t+=3){const k=[key(at(t)),key(at(t+1)),key(at(t+2))];
      for(let q=0;q<3;q++){const a=k[q],b2=k[(q+1)%3]; if(a===b2)continue;
        const kk=a<b2?`${a}|${b2}`:`${b2}|${a}`; e.set(kk,(e.get(kk)||0)+1);}}
    let bad=0; for(const v of e.values()) if(v!==2) bad++;
    return {closed:bad===0, bad};};
  I.enterAxis(c); c.setPose(I.AXES[0].pose(0,c));
  const rows=[
    ['Alarm switch','alarmPusherStem','Alarm switch','alarmPusherReturnSpring','MUST STAY reported (spring closed, real graze)'],
    ['Alarm disc',20,'Hour wheel','hourTube','MUST STOP being reported (hourTube open, 2.760 u apart)'],
  ];
  for(const [ua,na,ub,nb,expect] of rows){
    const la=meshesOf(unit(ua)), lb=meshesOf(unit(ub));
    const A=typeof na==='number'?la[na]:la.find(x=>x.name===na);
    const B=lb.find(x=>x.name===nb);
    if(!A||!B){o.push(`${na} ⇄ ${nb}: not found`);continue;}
    const ca=closed(A.geometry), cb=closed(B.geometry);
    const d=I.meshClearance(A,B,Infinity);
    o.push(`${(A.name||na)} ⇄ ${nb}`);
    o.push(`  closed? A ${ca.closed?'yes':`no (${ca.bad} bad edges)`} | B ${cb.closed?'yes':`no (${cb.bad} bad edges)`}`);
    o.push(`  meshClearance = ${d.toFixed(4)}   ${d<=0.001?'REPORTED as contact':'not reported'}`);
    o.push(`  expectation: ${expect}`);
    o.push('');
  }
  return o.join('\n');
}));
await b.close(); srv.kill();
