// 块B 快速版：单张下载实测 + 网络捕获证明字体 fetch（Edge 存活窗口内快速执行）
import { Page, sleep } from '/Users/zachary/WorkBuddy/2026-08-03-00-40-20/tools/pagecdp.mjs';
import { writeFileSync, readdirSync, statSync, mkdirSync, rmSync, readFileSync } from 'node:fs';

const dlSingleDir = '/Users/zachary/WorkBuddy/2026-08-03-00-40-20/.cache/zip-accept/dl-single';
mkdirSync(dlSingleDir, { recursive: true });
for (const f of readdirSync(dlSingleDir)) rmSync(dlSingleDir + '/' + f, { force: true });

const list = await fetch('http://127.0.0.1:9333/json/list').then(r=>r.json());
const t = list.find(t=>t.type==='page' && !t.url.startsWith('edge://'));
const p = await Page.attach(t.webSocketDebuggerUrl);
await p.send('Page.enable');
await p.send('Runtime.enable');
await p.send('Network.enable');

const fontRequests = [];
p.on('Network.requestWillBeSent', (params) => {
  const u = params.request.url || '';
  if (u.includes('fonts.googleapis') || u.includes('fonts.gstatic')) {
    fontRequests.push({req: u.slice(0, 150)});
  }
});
p.on('Network.responseReceived', (params) => {
  const u = params.response.url || '';
  if (u.includes('fonts.googleapis') || u.includes('fonts.gstatic')) {
    fontRequests.push({res: u.slice(0, 150), status: params.response.status, mime: params.response.mimeType});
  }
});
const consoleErrors = [];
p.on('Runtime.consoleAPICalled', (params) => {
  const txt = (params.args||[]).map(a=>a.value ?? a.description ?? '').join(' ');
  if (/error|securityerror|inlining|uncaught|失败|超时/i.test(txt)) consoleErrors.push({type: params.type, text: txt.slice(0,300)});
});
p.on('Runtime.exceptionThrown', (params) => {
  const d = params.exceptionDetails;
  consoleErrors.push({type:'exception', text: (d.exception?.description || d.text || '').slice(0,300)});
});

await p.send('Browser.setDownloadBehavior', { behavior: 'allow', downloadPath: dlSingleDir, eventsEnabled: true });

// goto（profile 中保留草稿 → 应直接回到编辑器/排版页）
await p.goto('http://localhost:3000', 3500);
await sleep(2500);

// 若不在排版页：找一键排版点一下
let onFormat = await p.eval(`document.body.innerText.includes('一键下载全部 (zip)')`);
if (!onFormat) {
  const fmtBtn = await p.eval(`(()=>{
    const b=[...document.querySelectorAll('button')].find(b=>b.innerText.trim()==='一键排版');
    if(!b) return null;
    const r=b.getBoundingClientRect();
    return {x:Math.round(r.x+r.width/2), y:Math.round(r.y+r.height/2)};
  })()`);
  if (fmtBtn) { await p.mouseClick(fmtBtn.x, fmtBtn.y); await sleep(4000); }
  onFormat = await p.eval(`document.body.innerText.includes('一键下载全部 (zip)')`);
}
console.log('ON FORMAT:', onFormat);
const before = await p.eval(`(()=>{
  const cards = [...document.querySelectorAll('.card-outer-container')].length;
  return {cardsCount: cards};
})()`);
console.log('CARDS:', JSON.stringify(before));

// 注入 MutationObserver 记录按钮文本
await p.eval(`(()=>{
  window.__labelLog = [];
  const obs = new MutationObserver(() => {
    const b = [...document.querySelectorAll('button')].find(x=>/下载此图|准备|生成|完成|失败/.test(x.innerText.trim()));
    if (b) {
      const t = b.innerText.trim();
      if (window.__labelLog[window.__labelLog.length-1] !== t) window.__labelLog.push(t + ' @' + Math.round(performance.now()));
    }
  });
  obs.observe(document.body, {subtree: true, childList: true, characterData: true});
  true;
})()`);

// 点第 0 张（封面）的「下载此图」
const t0 = Date.now();
const clicked = await p.eval(`(()=>{
  const slot = document.querySelectorAll('.card-display-slot')[0];
  if (!slot) return false;
  const btn = slot.querySelector('button[title="下载此图"]');
  if (!btn) return false;
  btn.click();
  return true;
})()`);
console.log('SINGLE CLICKED:', clicked);

let singleFiles = [];
for (let i=0; i<60; i++) {
  await sleep(500);
  const files = readdirSync(dlSingleDir).filter(f => f.endsWith('.png'));
  if (files.length) { singleFiles = files; console.log(`single png after ${(Date.now()-t0)/1000}s: ${files.join(',')}`); break; }
}
await sleep(800);
const labels = await p.eval(`window.__labelLog || []`);
console.log('LABELS:', JSON.stringify(labels));
console.log('FONT REQUESTS:', JSON.stringify(fontRequests, null, 2));
console.log('CONSOLE ERRORS:', JSON.stringify(consoleErrors, null, 2));

if (singleFiles.length) {
  const f = singleFiles[0];
  const buf = readFileSync(dlSingleDir + '/' + f);
  const w = buf.length >= 24 ? buf.readUInt32BE(16) : -1;
  const h = buf.length >= 24 ? buf.readUInt32BE(20) : -1;
  console.log(`SINGLE PNG: ${buf.length} bytes, ${w}x${h}`);
}

writeFileSync('/Users/zachary/WorkBuddy/2026-08-03-00-40-20/.cache/zip-accept/single-result.json', JSON.stringify({
  before, labels, fontRequests, consoleErrors, singleFiles,
  duration: Date.now() - t0
}, null, 2));
p.close();
process.exit(0);
