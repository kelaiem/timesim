import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
const srv = spawn('python3',['-m','http.server','8573','--bind','127.0.0.1'],{cwd:'/home/user/timesim',stdio:'ignore'});
await new Promise(r=>setTimeout(r,1200));
const b=await chromium.launch(); const p=await b.newPage();
p.on('pageerror',e=>console.log('PAGEERROR',String(e)));
await p.goto('http://127.0.0.1:8573/index.html?hud=0&sync=0',{waitUntil:'load',timeout:120000});
await p.waitForFunction(()=>!!window.__clock,null,{timeout:120000});
const out = await p.evaluate(async ()=>{
  const THREE=await import('./vendor/three.module.js');
  const c=window.__clock; c.resetInputs(); c.scene.updateMatrixWorld(true);
  const find=(n)=>{let r=null;c.scene.traverse(o=>{if(o.name===n)r=o;});return r;};
  const tq=find('threeQuarterPlate'); const oldS=tq.material.side; tq.material.side=THREE.DoubleSide;
  const base=find('alarmColBase'); const wc=new THREE.Vector3(); base.getWorldPosition(wc);
  const J=c.jumperLaw;
  const seatR=J.seat, L=J.L, STEP=J.sawPitch, SEATPHI=J.seatPhi;
  // ALARM_LOCK_ENGAGED, recovered from the spin group's rotation
  let spin=null; c.scene.traverse(o=>{ if(o.children.some(ch=>ch.userData && ch.userData.sawClear)) spin=o; });
  const ENG=spin.rotation.z;
  const onPlate=(x,y)=>{
    const rc=new THREE.Raycaster(new THREE.Vector3(x,y,40), new THREE.Vector3(0,0,-1)); rc.far=80;
    return rc.intersectObject(tq,false).length>0;
  };
  const rows=[];
  for(let steps=0; steps<12; steps++){
    const off=steps*STEP+SEATPHI, az=ENG+off;
    const u={x:Math.cos(az),y:Math.sin(az)};
    for(const dir of [+1,-1]){
      const tan={x:u.y*dir,y:-u.x*dir};
      const ax=wc.x+u.x*seatR+tan.x*L, ay=wc.y+u.y*seatR+tan.y*L;
      rows.push({steps, dir, tipAzDeg:+((az*180/Math.PI%360+360)%360).toFixed(1),
                 anchor:[+ax.toFixed(2),+ay.toFixed(2)],
                 anchorPlateR:+Math.hypot(ax,ay).toFixed(2),
                 onPlate:onPlate(ax,ay)});
    }
  }
  tq.material.side=oldS;
  return {plateR:c.plateR, wheelAt:[+wc.x.toFixed(2),+wc.y.toFixed(2)], engDeg:+(ENG*180/Math.PI).toFixed(2), L:+L.toFixed(3), rows};
});
console.log('plateR ' + out.plateR.toFixed(2) + '  wheel at ' + out.wheelAt + '  ENGAGED ' + out.engDeg + '°  blade L ' + out.L);
console.log('\n steps dir  tip az   anchor (x,y)        r      on plate?');
for(const r of out.rows)
  console.log('  ' + String(r.steps).padStart(3) + '  ' + (r.dir>0?'+':'-')
    + '  ' + String(r.tipAzDeg).padStart(6) + '   ' + String(r.anchor).padEnd(18)
    + ' ' + String(r.anchorPlateR).padStart(6) + '   ' + (r.onPlate?'YES':'no'));
await b.close(); srv.kill();
