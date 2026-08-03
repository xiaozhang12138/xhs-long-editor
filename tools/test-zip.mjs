// 实测：一键下载全部 zip 是否真实可用
import { Page } from '/Users/zachary/WorkBuddy/2026-08-03-00-40-20/tools/pagecdp.mjs';
import { mkdirSync, readdirSync, statSync, existsSync } from 'node:fs';

const DOWN_DIR = '/Users/zachary/WorkBuddy/2026-08-03-00-40-20/.cache/zip-test';
mkdirSync(DOWN_DIR, { recursive: true });

const list = await fetch('http://127.0.0.1:9333/json/list').then(r=>r.json());
const t = list.find(t=>t.type==='page' && !t.url.startsWith('edge://'));
const p = await Page.attach(t.webSocketDebuggerUrl);
await p.send('Page.enable');

// 设置下载行为到指定目录
await p.send('Browser.setDownloadBehavior', { behavior: 'allow', downloadPath: DOWN_DIR, eventsEnabled: true }, 10000);
console.log('download behavior set');

// 清空下载目录
try {
  const { rmSync } = await import('node:fs');
  for (const f of readdirSync(DOWN_DIR)) rmSync(DOWN_DIR + '/' + f, { recursive: true, force: true });
} catch {}

// 导航到页面
await p.goto('http://localhost:3000', 6000);
await new Promise(r=>setTimeout(r,1500));

// 检查当前状态（可能已有草稿）
const state = await p.eval(`(()=>{
  const stage = [...document.querySelectorAll('div')].filter(d=>d.offsetParent && /一键排版/.test(d.innerText||'')).length;
  const btns = [...document.querySelectorAll('button')].map(b=>(b.innerText||'').trim()).filter(t=>t);
  return {hasFormatBtn: !!btns.find(t=>t==='一键排版'), btns: btns.slice(0,12)};
})()`);
console.log('STATE:', JSON.stringify(state));

// 如果在编辑器且有内容，直接点一键排版
let clicked = false;
if (state.hasFormatBtn) {
  const r = await p.eval(`(()=>{const b=[...document.querySelectorAll('button')].find(b=>b.innerText.trim()==='一键排版');const r=b.getBoundingClientRect();return{x:Math.round(r.x+r.width/2),y:Math.round(r.y+r.height/2)}})()`);
  await p.mouseClick(r.x, r.y);
  await new Promise(r=>setTimeout(r,4000));
  clicked = true;
  console.log('clicked 一键排版');
}

// 在排版页找「一键下载全部」/「下载全部」按钮
const dlBtn = await p.eval(`(()=>{
  const all=[...document.querySelectorAll('button')];
  const b=all.find(b=>/一键下载|下载全部|打包|zip/i.test((b.innerText||'')));
  if(!b) return null;
  const r=b.getBoundingClientRect();
  return {t:b.innerText.trim(),x:Math.round(r.x+r.width/2),y:Math.round(r.y+r.height/2),cls:b.className.toString().slice(0,40)};
})()`);
console.log('DL BTN:', JSON.stringify(dlBtn));

if (dlBtn) {
  const t0 = Date.now();
  await p.mouseClick(dlBtn.x, dlBtn.y);
  console.log('clicked download, waiting...');
  // 等待下载完成（轮询目录）
  let files = [];
  for (let i=0;i<30;i++) {
    await new Promise(r=>setTimeout(r,2000));
    files = readdirSync(DOWN_DIR);
    if (files.length>0) {
      // 检查是否有正在下载的 .crdownload 文件
      const done = files.filter(f=>!f.endsWith('.crdownload'));
      if (done.length>0) { console.log('DONE after', Date.now()-t0, 'ms, files:', done); break; }
    }
    if (i%5===0) console.log(`waiting ${(i+1)*2}s... files=${files.join(',')||'none'}`);
  }
  files = readdirSync(DOWN_DIR);
  console.log('FINAL FILES:', JSON.stringify(files));
  if (files.length) {
    const f = files[0];
    const st = statSync(DOWN_DIR + '/' + f);
    console.log('FILE SIZE:', st.size, 'bytes');
  }
} else {
  console.log('NO DOWNLOAD BUTTON FOUND');
  await p.shot('/Users/zachary/WorkBuddy/2026-08-03-00-40-20/.cache/zip-test/nodl-btn.png', {full:true});
}

p.close();
process.exit(0);
