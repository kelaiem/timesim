import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
const port='8511';
const srv=spawn('python3',['-m','http.server',port,'--bind','127.0.0.1'],{cwd:'..',stdio:'ignore'});
await new Promise(r=>setTimeout(r,900));
const b=await chromium.launch(); const p=await b.newPage();
await p.goto(`http://127.0.0.1:${port}/index.html`,{waitUntil:'load',timeout:90000});
await p.waitForFunction(()=>!!window.__clock,null,{timeout:90000});
console.log(JSON.stringify(await p.evaluate(()=>{
  const c=window.__clock; c.scene.updateMatrixWorld(true);
  const THREE_ = null; const out={};
  const want=['alarmArborWheel','alarmBarrelBody','alarmArrestPinion','alarmArborRatchet','alarmStrikePinion','alarmArrestFinger','alarmArrestCross','genevaFingerPin'];
  c.scene.traverse(o=>{
    if(!o.isMesh) return;
    if(!want.includes(o.name)) return;
    o.updateMatrixWorld(true);
    const pos=o.geometry.attributes.position; let zl=1e9,zh=-1e9,rmax=0;
    const v=new (o.matrixWorld.constructor===Object?Object:Object)();
    for(let i=0;i<pos.count;i++){
      const x=pos.getX(i),y=pos.getY(i),z=pos.getZ(i);
      const e=o.matrixWorld.elements;
      const wx=e[0]*x+e[4]*y+e[8]*z+e[12], wy=e[1]*x+e[5]*y+e[9]*z+e[13], wz=e[2]*x+e[6]*y+e[10]*z+e[14];
      zl=Math.min(zl,wz); zh=Math.max(zh,wz);
    }
    const e=o.matrixWorld.elements;
    out[o.name]={z:[+zl.toFixed(3),+zh.toFixed(3)], at:[+e[12].toFixed(3),+e[13].toFixed(3)]};
  });
  return out;
}),null,1));
await b.close(); srv.kill();
