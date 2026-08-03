// 实测 zip 下载 + 捕获 console 错误 + 单张下载
import { Page } from '/Users/zachary/WorkBuddy/2026-08-03-00-40-20/tools/pagecdp.mjs';
import { mkdirSync, readdirSync, statSync, rmSync } from 'node:fs';

const DOWN_DIR = '/Users/zachary/WorkBuddy/2026-08-03-00-40-20/.cache/zip-test2';
mkdirSync(DOWN_DIR, { recursive: true });
for (const f of readdirSync(DOWN_DIR)) rmSync(DOWN_DIR + '/' + f, { recursive: true, force: true });

const list = await fetch('http://127.0.0.1:9333/json/list').then(r=>r.json());
const t = list.find(t=>t.type==='page' && !t.url.startsWith('edge://'));
const p = await Page.attach(t.webSocketDebuggerUrl);
await p.send('Page.enable');
await p.send('Runtime.enable');
await p.send('Browser.setDownloadBehavior', { behavior: 'allow', downloadPath: DOWN_DIR, eventsEnabled: true }, 10000);

// 捕获 console + exception
const errors = [];
p.on('Runtime.consoleAPICalled', (params) => {
  const txt = (params.args||[]).map(a=>a.value||a.description||'').join(' ').slice(0,200);
  if (params.type==='error' || /error|fail|reject/i.test(txt)) errors.push('[console.'+params.type+'] '+txt);
});
p.on('Runtime.exceptionThrown', (params) => {
  errors.push('[exception] ' + (params.exceptionDetails?.exception?.description || params.exceptionDetails?.text || '').slice(0,300));
});

await p.goto('http://localhost:3000', 6000);
await new Promise(r=>setTimeout(r,1500));

// 点一键排版
const fmt = await p.eval(`(()=>{const b=[...document.querySelectorAll('button')].find(b=>b.innerText.trim()==='一键排版');if(!b)return null;const r=b.getBoundingClientRect();return{x:Math.round(r.x+r.width/2),y:Math.round(r.y+r.height/2)}})()`);
if (fmt) { await p.mouseClick(fmt.x, fmt.y); await new Promise(r=>setTimeout(r,4000)); console.log('format clicked'); }

// 检查页面上的卡片数量
const cardInfo = await p.eval(`(()=>{
  const cards=[...document.querySelectorAll('.card-outer-container')].filter(e=>e.offsetParent);
  const dlBtns=[...document.querySelectorAll('button')].filter(b=>/下载|zip/i.test(b.innerText||'')).map(b=>({t:b.innerText.trim().slice(0,20),x:Math.round(b.getBoundingClientRect().x+b.getBoundingClientRect().width/2),y:Math.round(b.getBoundingClientRect().y+b.getBoundingClientRect().height/2)}));
  return {cardCount:cards.length, dlBtns};
})()`);
console.log('CARDS:', JSON.stringify(cardInfo));

// 先点单张下载（第一张卡 hover 后的下载或页面上的下载此图）
if (cardInfo.dlBtns.length) {
  const single = cardInfo.dlBtns.find(b=>/此图|单张|PNG/.test(b.t));
  if (single) {
    console.log('clicking single download:', single.t);
    await p.mouseClick(single.x, single.y);
    await new Promise(r=>setTimeout(r,6000));
    let files = readdirSync(DOWN_DIR);
    console.log('SINGLE FILES:', JSON.stringify(files));
    if (files.length) {
      const st = statSync(DOWN_DIR + '/' + files[0]);
      console.log('SINGLE SIZE:', st.size);
      for (const f of readdirSync(DOWN_DIR)) rmSync(DOWN_DIR + '/' + f, { recursive: true, force: true });
    }
  }
}

// 再点 zip 下载
const zip = cardInfo.dlBtns.find(b=>/全部|zip/i.test(b.t));
if (zip) {
  console.log('clicking zip download');
  const t0=Date.now();
  await p.mouseClick(zip.x, zip.y);
  for (let i=0;i<25;i++) {
    await new Promise(r=>setTimeout(r,2000));
    const files = readdirSync(DOWN_DIR);
    const done = files.filter(f=>!f.endsWith('.crdownload'));
    if (done.length) { console.log('ZIP DONE after', Date.now()-t0, 'ms:', done, 'size:', statSync(DOWN_DIR+'/'+done[0]).size); break; }
    if (i%5===0) console.log(`zip wait ${(i+1)*2}s, files=${files.join(',')||'none'}`);
  }
}

console.log('ERRORS:', JSON.stringify(errors, null, 1));
p.close(); process.exit(0);
