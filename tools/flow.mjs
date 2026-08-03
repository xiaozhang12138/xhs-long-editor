import { findPage, Page, sleep } from './pagecdp.mjs';
import { writeFileSync } from 'node:fs';
const OUT = '/Users/zachary/WorkBuddy/2026-08-03-00-40-20/.cache';
const t = await findPage();
const p = await Page.attach(t.webSocketDebuggerUrl);
await p.send('Runtime.enable'); await p.send('Page.enable');

async function click(x,y){
  await p.send('Input.dispatchMouseEvent',{type:'mouseMoved',x,y});await sleep(120);
  await p.send('Input.dispatchMouseEvent',{type:'mousePressed',x,y,button:'left',clickCount:1});await sleep(70);
  await p.send('Input.dispatchMouseEvent',{type:'mouseReleased',x,y,button:'left',clickCount:1});await sleep(1500);
}
async function dump(tag){
  await p.shot(OUT+'/'+tag+'.png');
  const d = await p.eval(`({
    url: location.href,
    text: document.body.innerText.replace(/\\n{2,}/g,'\\n').slice(0,2500),
    modals: [...document.querySelectorAll('[class*="modal"],[class*="dialog"],[class*="drawer"],[class*="mask"]')].filter(e=>{const b=e.getBoundingClientRect();return b.width>100&&b.height>50&&getComputedStyle(e).display!=='none'}).map(e=>{const b=e.getBoundingClientRect();return{cls:(typeof e.className==='string'?e.className:'').slice(0,80),r:[Math.round(b.x),Math.round(b.y),Math.round(b.width),Math.round(b.height)],txt:e.innerText.replace(/\\s+/g,' ').slice(0,400)}}).slice(0,5),
    buttons: [...document.querySelectorAll('button')].filter(e=>{const b=e.getBoundingClientRect();return b.width>0&&e.innerText.trim()}).map(e=>{const b=e.getBoundingClientRect();return e.innerText.trim()+'@'+Math.round(b.x)+','+Math.round(b.y)}).slice(0,20)
  })`);
  console.log('\n### '+tag);
  console.log(JSON.stringify(d,null,1).slice(0,3000));
  return d;
}
const m = process.argv[2];
if (m==='btns') {
  const r = await p.eval(`[...document.querySelectorAll('.parent-btn button, .footer button')].map(e=>{const b=e.getBoundingClientRect();return {txt:e.innerText.trim(), x:Math.round(b.x+b.width/2), y:Math.round(b.y+b.height/2), cls:e.className.slice(0,80), disabled:e.disabled}})`);
  console.log(JSON.stringify(r,null,1));
} else if (m==='click') {
  await click(+process.argv[3], +process.argv[4]);
  await dump(process.argv[5]||'click-result');
} else if (m==='dump') {
  await dump(process.argv[3]||'state');
} else if (m==='eval') {
  console.log(JSON.stringify(await p.eval(process.argv[3]),null,1));
}
p.close(); process.exit(0);
