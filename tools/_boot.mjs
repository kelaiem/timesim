import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
const port='8520';
const srv=spawn('python3',['-m','http.server',port,'--bind','127.0.0.1'],{cwd:'..',stdio:'ignore'});
await new Promise(r=>setTimeout(r,900));
const b=await chromium.launch(); const p=await b.newPage();
const errs=[], warns=[];
p.on('pageerror',e=>errs.push(String(e)));
p.on('console',m=>{ if(m.type()==='error') errs.push('CONSOLE '+m.text()); if(m.type()==='warning') warns.push(m.text()); });
await p.goto(`http://127.0.0.1:${port}/index.html`,{waitUntil:'load',timeout:90000});
try { await p.waitForFunction(()=>!!window.__clock,null,{timeout:60000}); console.log('__clock UP'); }
catch(e){ console.log('__clock NEVER CAME UP'); }
console.log('errors:', errs.length); errs.slice(0,6).forEach(e=>console.log('  '+e.slice(0,300)));
console.log('warnings:', warns.length); warns.slice(0,20).forEach(w=>console.log('  W '+w.slice(0,220)));
await b.close(); srv.kill();
