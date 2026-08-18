import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
const port='8520';
const srv=spawn('python3',['-m','http.server',port,'--bind','127.0.0.1'],{cwd:'..',stdio:'ignore'});
await new Promise(r=>setTimeout(r,900));
const b=await chromium.launch(); const p=await b.newPage();
const warns=[];
p.on('console',m=>{ if(m.type()==='warning') warns.push(m.text()); });
await p.goto(`http://127.0.0.1:${port}/index.html${process.env.Q||''}`,{waitUntil:'load',timeout:90000});
try { await p.waitForFunction(()=>!!window.__clock,null,{timeout:60000}); } catch(e){ console.log('NO CLOCK'); }
console.log(await p.evaluate(()=>{ try { const S=window.__clock.arrestDebug.sub; return JSON.stringify(S); } catch(e){ return "ERR "+String(e); } }));
warns.filter(w=>!/WebGL|GroupMarker/.test(w)).forEach(w=>console.log('  W '+w.slice(0,900)));
await b.close(); srv.kill();
