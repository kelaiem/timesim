import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
const srv = spawn('python3',['-m','http.server','8574','--bind','127.0.0.1'],{cwd:'/home/user/timesim',stdio:'ignore'});
await new Promise(r=>setTimeout(r,1200));
const b=await chromium.launch(); const p=await b.newPage();
const warns=[];
p.on('console',m=>{ if(m.type()==='warning'||m.type()==='error'){ const t=m.text(); if(!/WebGL|GroupMarker|Failed to load resource/.test(t)) warns.push('['+m.type()+'] '+t); }});
p.on('pageerror',e=>warns.push('PAGEERROR '+String(e)));
await p.goto('http://127.0.0.1:8574/index.html?hud=0&sync=0',{waitUntil:'load',timeout:120000});
await p.waitForFunction(()=>!!window.__clock,null,{timeout:120000});
await p.waitForTimeout(2500);
console.log(warns.length ? 'BOOT NOT SILENT:\n'+warns.join('\n') : 'BOOT SILENT');
console.log(JSON.stringify(await p.evaluate(()=>{const j=window.__clock.jumperLaw;
  return {L:j.L, throw_u:j.throw_u, k:j.k_N_per_m, w:j.w, detent:j.detent_Nmm, foldPasses:j.foldPasses,
          fSeat:j.fSeat_mN, fCrest:j.fCrest_mN};})));
await b.close(); srv.kill();
