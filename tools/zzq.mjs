import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
const srv = spawn('python3',['-m','http.server','8571','--bind','127.0.0.1'],{cwd:'/home/user/timesim',stdio:'ignore'});
await new Promise(r=>setTimeout(r,1200));
const b=await chromium.launch(); const p=await b.newPage();
p.on('pageerror',e=>console.log('PAGEERROR',String(e)));
await p.goto('http://127.0.0.1:8571/index.html?hud=0&sync=0',{waitUntil:'load',timeout:120000});
await p.waitForFunction(()=>!!window.__clock,null,{timeout:120000});
console.log(JSON.stringify(await p.evaluate(async ()=>{
  const THREE = await import('./vendor/three.module.js');
  const c = window.__clock; c.resetInputs(); c.scene.updateMatrixWorld(true);
  const find=(n)=>{let r=null;c.scene.traverse(o=>{if(o.name===n)r=o;});return r;};
  const out={};

  // ---------- Q1: what is UNDER the sautoir's anchor stud? ----------
  const stud=find('alarmJumperStud');
  const sp=new THREE.Vector3(); stud.getWorldPosition(sp);
  const h=stud.geometry.parameters.height, rr=stud.geometry.parameters.radiusTop;
  const bot=sp.z-h/2;
  // Cast DOWN from just under the stud's foot, on its axis and on four rim points.
  const rc=new THREE.Raycaster(); rc.far=60;
  const targets=[]; c.scene.traverse(o=>{ if(o.isMesh && !o.userData.schematic && o!==stud) targets.push(o); });
  const shots=[];
  for (const [dx,dy,lbl] of [[0,0,'axis'],[rr*0.9,0,'+x'],[-rr*0.9,0,'-x'],[0,rr*0.9,'+y'],[0,-rr*0.9,'-y']]) {
    rc.set(new THREE.Vector3(sp.x+dx, sp.y+dy, bot-1e-4), new THREE.Vector3(0,0,-1));
    const hit=rc.intersectObjects(targets,false)[0];
    shots.push({at:lbl, hit: hit?hit.object.name||('(unnamed '+hit.object.geometry.type+')'):null,
                dropToHit: hit? +(bot-hit.point.z).toFixed(4) : null});
  }
  out.stud={ foot_z:+bot.toFixed(4), top_z:+(sp.z+h/2).toFixed(4), r:+rr.toFixed(4),
             xy:[+sp.x.toFixed(3),+sp.y.toFixed(3)], down:shots };
  // …and the same question of a stud that IS known-good, as a control
  const ctrlStud=find('alarmLockSpringStud');
  if(ctrlStud){ const q=new THREE.Vector3(); ctrlStud.getWorldPosition(q);
    const hh=ctrlStud.geometry.parameters.height;
    rc.set(new THREE.Vector3(q.x,q.y,q.z-hh/2-1e-4), new THREE.Vector3(0,0,-1));
    const hit=rc.intersectObjects(targets.filter(o=>o!==ctrlStud),false)[0];
    out.controlStud={ name:'alarmLockSpringStud', foot_z:+(q.z-hh/2).toFixed(4),
      hit: hit?hit.object.name||('(unnamed '+hit.object.geometry.type+')'):null,
      dropToHit: hit? +((q.z-hh/2)-hit.point.z).toFixed(4):null }; }
  out.plateTops = {};
  for (const n of ['threeQuarterPlate','basePlate']) { const m=find(n); if(m){ const bb=new THREE.Box3().setFromObject(m); out.plateTops[n]=[+bb.min.z.toFixed(4),+bb.max.z.toFixed(4)]; } }

  // ---------- Q2: does the TIP penetrate the saw? ----------
  const cw=find('alarmColumnWheel')||null;
  let wheel=null; c.scene.traverse(o=>{ if(o.userData && o.userData.sawClear) wheel=o; });
  const tip=find('alarmJumperTip'), skirt=find('alarmColSkirt');
  const base=find('alarmColBase'); const wc=new THREE.Vector3(); base.getWorldPosition(wc);
  const J=c.jumperLaw;
  const rows=[];
  for (let k=0;k<=16;k++){
    const a=(k/16)*J.sawPitch; J.poseJumper(a); c.scene.updateMatrixWorld(true);
    const tp=new THREE.Vector3(); tip.getWorldPosition(tp);
    // the tip's own surface, sampled: worst signed clearance against the CUT polygon
    let worst=Infinity;
    const geo=skirt.geometry; // the polygon lives on the wheel group's userData
    const par=skirt.parent;
    const inv=new THREE.Matrix4().copy(par.matrixWorld).invert();
    const local=tp.clone().applyMatrix4(inv);
    const sc=par.userData.sawClear ? par.userData.sawClear(local.x, local.y) : null;
    rows.push({frac:+(k/16).toFixed(3), tipR_world:+Math.hypot(tp.x-wc.x,tp.y-wc.y).toFixed(4),
               sawClearAtCentre: sc===null?null:+sc.toFixed(6),
               minusTipR: sc===null?null:+(sc-J.tipR).toFixed(6)});
  }
  out.tip={ tipR:J.tipR, rows, note:'sawClearAtCentre − tipR: 0 = exact tangency, negative = the tip is INSIDE the cut metal' };
  c.resetInputs();
  return out;
}), null, 1));
await b.close(); srv.kill();
