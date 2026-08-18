import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
const port='8577';
const srv=spawn('python3',['-m','http.server',port,'--bind','127.0.0.1'],{cwd:'..',stdio:'ignore'});
await new Promise(r=>setTimeout(r,900));
const b=await chromium.launch(); const p=await b.newPage();
const warns=[],errs=[];
p.on('console',m=>{ if(m.type()==='warning') warns.push(m.text()); if(m.type()==='error') errs.push(m.text()); });
p.on('pageerror',e=>errs.push(String(e)));
await p.goto(`http://127.0.0.1:${port}/index.html`,{waitUntil:'load',timeout:150000});
try { await p.waitForFunction(()=>!!window.__clock,null,{timeout:120000});
  console.log(await p.evaluate(()=>JSON.stringify(window.__clock.arrestDebug.sub))); }
catch(e){ console.log('NO CLOCK'); }
errs.filter(e=>!/404/.test(e)).slice(0,3).forEach(e=>console.log('  E '+e.slice(0,300)));
warns.filter(w=>!/WebGL|GroupMarker|Automatic|GL Driver/.test(w)).forEach(w=>console.log('  W '+w.slice(0,320)));
await b.close(); srv.kill();
