import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
const srv = spawn('python3',['-m','http.server','8572','--bind','127.0.0.1'],{cwd:'/home/user/timesim',stdio:'ignore'});
await new Promise(r=>setTimeout(r,1200));
const b=await chromium.launch(); const p=await b.newPage();
p.on('pageerror',e=>console.log('PAGEERROR',String(e)));
await p.goto('http://127.0.0.1:8572/index.html?hud=0&sync=0',{waitUntil:'load',timeout:120000});
await p.waitForFunction(()=>!!window.__clock,null,{timeout:120000});
console.log(JSON.stringify(await p.evaluate(async ()=>{
  const THREE = await import('./vendor/three.module.js');
  const BVH  = await import('./vendor/three-mesh-bvh.module.js');
  const c=window.__clock; c.resetInputs(); c.scene.updateMatrixWorld(true);
  const find=(n)=>{let r=null;c.scene.traverse(o=>{if(o.name===n)r=o;});return r;};
  const bvh=(m)=>{const g=m.geometry; if(!g.index)g.setIndex([...Array(g.getAttribute('position').count).keys()]);
                  if(!g.boundsTree)g.boundsTree=new BVH.MeshBVH(g); return g.boundsTree;};
  const out={};

  // ---- Q1: is the stud's FOOT over three-quarter plate metal?
  // DoubleSide the plate for the cast: a ray that starts inside a solid sees
  // only back faces on the way out, and FrontSide culling drops them — which
  // is why the first cast reported the plate absent when it is not (or is).
  const tq=find('threeQuarterPlate');
  const oldSide=tq.material.side; tq.material.side=THREE.DoubleSide;
  const probe=(x,y,lbl)=>{
    const rc=new THREE.Raycaster(new THREE.Vector3(x,y,40), new THREE.Vector3(0,0,-1)); rc.far=80;
    const hits=rc.intersectObject(tq,false);
    return {at:lbl, hits:hits.map(h=>+h.point.z.toFixed(4))};
  };
  const stud=find('alarmJumperStud'); const sp=new THREE.Vector3(); stud.getWorldPosition(sp);
  const ctrl=find('alarmLockSpringStud'); const cp=new THREE.Vector3(); ctrl.getWorldPosition(cp);
  const wstud=find('alarmColStud'); const wp=new THREE.Vector3(); wstud.getWorldPosition(wp);
  out.tqUnder={
    jumperStud: probe(sp.x,sp.y,'alarmJumperStud'),
    lockSpringStud: probe(cp.x,cp.y,'alarmLockSpringStud (control — a stud known to be seated)'),
    columnWheelStud: probe(wp.x,wp.y,'alarmColStud (control)'),
    plateZ: (()=>{const bb=new THREE.Box3().setFromObject(tq);return [+bb.min.z.toFixed(4),+bb.max.z.toFixed(4)];})(),
  };
  tq.material.side=oldSide;
  out.studFoot=+(sp.z-stud.geometry.parameters.height/2).toFixed(4);

  // ---- Q2: MESH vs MESH. Sample the tip's real surface, ask the skirt's BVH.
  const tip=find('alarmJumperTip'), skirt=find('alarmColSkirt');
  const J=c.jumperLaw;
  const pr=tip.geometry.parameters;
  const worstBy=[];
  for(let k=0;k<=16;k++){
    const a=(k/16)*J.sawPitch; J.poseJumper(a); c.scene.updateMatrixWorld(true);
    bvh(skirt);
    const inv=new THREE.Matrix4().copy(skirt.matrixWorld).invert();
    const M=new THREE.Matrix4().copy(tip.matrixWorld).premultiply(inv);
    let worst=Infinity, at=null; const v=new THREE.Vector3(), t={};
    // the tip's LATERAL surface as built: 24 facets, sampled at facet centres
    // AND vertices, at three heights — a vertex-only sample would miss the
    // facet mid-points, which sit 0.0016 further in (MODELING.md rule 5's cousin)
    for(let i=0;i<48;i++){
      const th=(i/48)*Math.PI*2;
      for(const zz of [-pr.height/2, 0, pr.height/2]){
        v.set(Math.cos(th)*pr.radiusTop, zz, Math.sin(th)*pr.radiusTop).applyMatrix4(M);
        const r=skirt.geometry.boundsTree.closestPointToPoint(v,t);
        if(r && r.distance<worst){worst=r.distance; at=+(th*180/Math.PI).toFixed(1);}
      }
    }
    worstBy.push({frac:+(k/16).toFixed(3), nearest:+worst.toFixed(5), atDeg:at});
  }
  out.tipVsSkirtMesh={rows:worstBy, note:'nearest distance from the BUILT tip surface to the BUILT skirt surface; 0 = coincident, and this cannot go negative — see insideCount'};
  // and an explicit INSIDE test: is any tip sample within the skirt solid?
  J.poseJumper(0); c.scene.updateMatrixWorld(true);
  const inv2=new THREE.Matrix4().copy(skirt.matrixWorld).invert();
  const M2=new THREE.Matrix4().copy(tip.matrixWorld).premultiply(inv2);
  let inside=0, tested=0; const v2=new THREE.Vector3();
  const rc2=new THREE.Raycaster(); rc2.far=1e4; rc2.firstHitOnly=false;
  const oldS=skirt.material.side; skirt.material.side=THREE.DoubleSide;
  for(let i=0;i<48;i++){ const th=(i/48)*Math.PI*2;
    for(const zz of [-pr.height/2*0.9, 0, pr.height/2*0.9]){
      v2.set(Math.cos(th)*pr.radiusTop*0.995, zz, Math.sin(th)*pr.radiusTop*0.995).applyMatrix4(M2).applyMatrix4(skirt.matrixWorld);
      rc2.set(v2, new THREE.Vector3(0.3574,0.6217,0.6969).normalize());
      const n=rc2.intersectObject(skirt,false).length; tested++; if(n%2===1) inside++;
    }}
  skirt.material.side=oldS;
  out.tipInsideSkirt={inside, tested, note:'parity raycast from points just under the tip surface; odd crossings = inside the metal'};
  c.resetInputs();
  return out;
}), null, 1));
await b.close(); srv.kill();
