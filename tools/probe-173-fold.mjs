// §173 FOLD — WHERE THE SAUTOIR'S ANCHOR CAN STAND, all three constraints at once.
//
// The fold's only currencies are position-space: which of the twelve tooth
// seats the tip takes, and which way the blade runs from it. That is 24
// choices, and §173 got it wrong TWICE by satisfying one constraint at a time:
//
//   first  chosen against the free-azimuth window alone — the anchor landed
//          over the three-quarter plate's balance cutaway, standing on air.
//          `support` is declared per UNIT, so one floating mesh inside an
//          otherwise seated unit passed the whole battery in silence.
//   second chosen against the plate alone — the anchor landed inside the alarm
//          hammer's swing, 0.000 clear of `alarmHammerArm` through the strike.
//
// So this prints the WHOLE TABLE rather than a winner: a search whose losers
// are invisible is a claim nobody can re-check, and both bad folds looked fine
// from inside the constraint they were chosen against.
//
// One trap, and it reported the inverse of the truth: the plates must be left
// OUT of the corridor measurement. The stud is meant to stand on the plate, so
// its foot measures 0 to it by design — with the plates in, the candidates
// over the CUTAWAY ranked as the roomiest, because nothing was under them.
// Seating is a separate question and `inCutClearance` answers it.
import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
const srv = spawn('python3',['-m','http.server','8583','--bind','127.0.0.1'],{cwd:'/home/user/timesim',stdio:'ignore'});
await new Promise(r=>setTimeout(r,1200));
const b=await chromium.launch(); const p=await b.newPage();
p.on('pageerror',e=>console.log('PAGEERROR',String(e)));
await p.goto('http://127.0.0.1:8583/index.html?hud=0&sync=0',{waitUntil:'load',timeout:120000});
await p.waitForFunction(()=>!!window.__clock,null,{timeout:120000});
const out = await p.evaluate(async ()=>{
  const THREE=await import('./vendor/three.module.js');
  const BVH=await import('./vendor/three-mesh-bvh.module.js');
  const I=await import('./src/inspect.js');
  const c=window.__clock;
  const find=(n)=>{let r=null;c.scene.traverse(o=>{if(o.name===n)r=o;});return r;};
  const J=c.jumperLaw;
  const base=find('alarmColBase'); const wc=new THREE.Vector3(); base.getWorldPosition(wc);
  let spin=null; c.scene.traverse(o=>{ if(o.children.some(ch=>ch.userData&&ch.userData.sawClear)) spin=o; });
  const ENG=spin.rotation.z;
  const stud=find('alarmJumperStud');
  const studR=stud.geometry.parameters.radiusTop, studH=stud.geometry.parameters.height;
  const sp=new THREE.Vector3(); stud.getWorldPosition(sp);
  const zTop=sp.z+studH/2, zBot=sp.z-studH/2;
  // the members that are NOT ours
  const own=new Set(); const ent=c.labelEntries.find(e=>e.name==='Alarm switch');
  ent.obj.traverse(o=>{ if(o.isMesh) own.add(o.uuid); });
  const bvh=(m)=>{const g=m.geometry; if(!g.index)g.setIndex([...Array(g.getAttribute('position').count).keys()]);
                  if(!g.boundsTree)g.boundsTree=new BVH.MeshBVH(g); return g.boundsTree;};
  // candidate anchors
  const cands=[];
  for(let steps=0;steps<12;steps++) for(const hand of [+1,-1]){
    const off=steps*J.sawPitch+J.seatPhi, az=ENG+off;
    const u={x:Math.cos(az),y:Math.sin(az)};
    const tan={x:-u.y*hand, y:u.x*hand};
    cands.push({steps,hand,
      tipAzDeg:+(((az*180/Math.PI)%360+360)%360).toFixed(1),
      x: wc.x+u.x*J.seat+tan.x*J.L, y: wc.y+u.y*J.seat+tan.y*J.L, worst:Infinity, by:null});
  }
  // sample points on each candidate stud column
  const pts=[]; for(let i=0;i<12;i++){const th=i/12*Math.PI*2;
    for(let k=0;k<=10;k++) pts.push({dx:Math.cos(th)*studR, dy:Math.sin(th)*studR, z:zBot+(zTop-zBot)*k/10});}
  const POSES=[];
  for(const alarmOn of [0,1]) for(const f of [0,0.5,1])
    POSES.push({tau:0.13,crownPullT:0,leverEngage:0,tension:1,windAccumTurns:f*3,alarmOn});
  for(const f of [0,0.5,1,1.5,2]) POSES.push({tau:0.13,crownPullT:0,leverEngage:0,tension:1,windAccumTurns:0,alarmOn:0,alarmPressCycle:f});
  for(const f of [0,0.25,0.5,0.75,1]) POSES.push({tau:0.13+f*0.03,crownPullT:0,leverEngage:0,tension:1,windAccumTurns:0,alarmOn:1});
  const v=new THREE.Vector3(), t={};
  for(const pose of POSES){
    try{ I.enterAxis(c); }catch(e){}
    c.setPose(pose); c.scene.updateMatrixWorld(true);
    const obst=[];
    c.scene.traverse(o=>{ if(!o.isMesh||o.userData.schematic||own.has(o.uuid)||!o.geometry) return;
      // THE GROUND IS NOT AN OBSTACLE. The stud is meant to stand on the plate,
      // so its foot measures 0 to it by design — leaving the plates in made the
      // scan report the candidates over the CUTAWAY as the roomiest, which is
      // the exact inverse of the question. Seating is answered separately, by
      // inCutClearance, below.
      if(/^(threeQuarterPlate|backPlate|basePlate|dialPlate)$/.test(o.name||'')) return;
      const bb=new THREE.Box3().setFromObject(o);
      if(bb.max.z<zBot-1||bb.min.z>zTop+1) return;   // must share the stud's z run
      obst.push({m:o, bb}); });
    for(const cd of cands){
      for(const ob of obst){
        // cheap reject on the column's own box
        const dx=Math.max(ob.bb.min.x-(cd.x+studR), (cd.x-studR)-ob.bb.max.x, 0);
        const dy=Math.max(ob.bb.min.y-(cd.y+studR), (cd.y-studR)-ob.bb.max.y, 0);
        if(Math.hypot(dx,dy)>cd.worst) continue;
        bvh(ob.m);
        const inv=new THREE.Matrix4().copy(ob.m.matrixWorld).invert();
        for(const q of pts){
          v.set(cd.x+q.dx, cd.y+q.dy, q.z).applyMatrix4(inv);
          const r=ob.m.geometry.boundsTree.closestPointToPoint(v,t);
          if(r&&r.distance<cd.worst){cd.worst=r.distance; cd.by=(ob.m.name||('(unnamed '+ob.m.geometry.type+')'));}
        }
      }
    }
  }
  // …and the SEATING question, asked of the same candidates
  c.resetInputs(); c.scene.updateMatrixWorld(true);
  const tq=find('threeQuarterPlate'); const oldS=tq.material.side; tq.material.side=THREE.DoubleSide;
  for(const cd of cands){
    const rc=new THREE.Raycaster(new THREE.Vector3(cd.x,cd.y,40), new THREE.Vector3(0,0,-1)); rc.far=80;
    cd.onPlate = rc.intersectObject(tq,false).length>0;
  }
  tq.material.side=oldS;
  return {cands: cands.map(({steps,hand,tipAzDeg,x,y,worst,by,onPlate})=>({steps,hand,tipAzDeg,
    xy:[+x.toFixed(2),+y.toFixed(2)], clear:+worst.toFixed(4), nearest:by, onPlate})), poses:POSES.length, studR:+studR.toFixed(4)};
});
console.log('stud r ' + out.studR + ', measured over ' + out.poses + ' poses; free-air needed = studR + CLEAR_MARGIN = ' + (out.studR+0.15).toFixed(4) + '\n');
console.log(' steps hand  tip az   anchor (x,y)      seated   clear   nearest member');
for(const r of out.cands.slice().sort((a,b)=>b.clear-a.clear))
  console.log('  ' + String(r.steps).padStart(3) + '   ' + (r.hand>0?'+':'-')
    + '  ' + String(r.tipAzDeg).padStart(6) + '   ' + String(r.xy).padEnd(17)
    + '  ' + (r.onPlate?'PLATE':'  -  ') + ' ' + String(r.clear).padStart(8) + '   ' + r.nearest);
await b.close(); srv.kill();
